-- Supabase SQL Editor'da tek parça çalıştırın. Tarayıcıda service_role/secret key kullanmayın.
create extension if not exists pgcrypto;

create table if not exists public.game_rooms (
  room_code text primary key check (room_code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  state jsonb not null,
  state_version bigint not null default 1,
  host_token_hash bytea not null,
  guest_token_hash bytea,
  answer_keys jsonb,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  updated_at timestamptz not null default now()
);
alter table public.game_rooms add column if not exists answer_keys jsonb;
alter table public.game_rooms add column if not exists player_token_hashes jsonb not null default '[]'::jsonb;
alter table public.game_rooms enable row level security;
revoke all on public.game_rooms from anon, authenticated;

create or replace function public.game_room_slot(room public.game_rooms, token text)
returns integer language sql immutable security definer set search_path = '' as $$
  select (entry.ordinality - 1)::integer
  from jsonb_array_elements_text(room.player_token_hashes) with ordinality entry(value, ordinality)
  where entry.value = encode(extensions.digest(token, 'sha256'), 'hex') limit 1;
$$;

create or replace function public.create_game_room(p_room_code text, p_host_token text, p_player_name text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; expires_ms bigint := floor(extract(epoch from (now() + interval '2 hours')) * 1000);
begin
  if p_room_code !~ '^[A-HJ-NP-Z2-9]{6}$' or length(p_host_token) < 32 then raise exception 'INVALID_ROOM_DATA'; end if;
  result := jsonb_build_object(
    'roomCode', p_room_code, 'stateVersion', 1, 'status', 'waiting', 'matchNumber', 0,
    'createdAt', floor(extract(epoch from now()) * 1000), 'expiresAt', expires_ms,
    'questionSequence', 0, 'settings', p_settings || '{"locked":false}'::jsonb,
    'currentTurn', 0, 'scores', '[0]'::jsonb, 'usedPlayerIds', '[]'::jsonb,
    'players', jsonb_build_array(jsonb_build_object('name', left(coalesce(nullif(trim(p_player_name), ''), 'Oyuncu 1'), 24), 'ready', false, 'connected', true, 'host', true)),
    'question', null, 'roundAnswers', '{}'::jsonb, 'revealUntil', null, 'answerResult', null
  );
  insert into public.game_rooms(room_code, state, state_version, host_token_hash, player_token_hashes, expires_at)
  values (p_room_code, result, 1, extensions.digest(p_host_token, 'sha256'), jsonb_build_array(encode(extensions.digest(p_host_token, 'sha256'), 'hex')), to_timestamp(expires_ms / 1000.0));
  return result;
exception when unique_violation then raise exception 'ROOM_EXISTS';
end $$;

create or replace function public.join_game_room(p_room_code text, p_guest_token text, p_player_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare room public.game_rooms; next_state jsonb; player_count integer;
begin
  select * into room from public.game_rooms where room_code = p_room_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  player_count := jsonb_array_length(room.state->'players');
  if room.state->>'status' = 'playing' or player_count >= 5 then raise exception 'ROOM_FULL'; end if;
  next_state := jsonb_set(room.state, '{players}', (room.state->'players') || jsonb_build_array(jsonb_build_object('name', left(coalesce(nullif(trim(p_player_name), ''), 'Oyuncu ' || (player_count + 1)), 24), 'ready', false, 'connected', true, 'host', false)));
  next_state := jsonb_set(next_state, '{scores}', coalesce(room.state->'scores', '[]'::jsonb) || '0'::jsonb);
  next_state := jsonb_set(next_state, '{stateVersion}', to_jsonb(room.state_version + 1));
  update public.game_rooms set state = next_state, state_version = state_version + 1, player_token_hashes = player_token_hashes || jsonb_build_array(encode(extensions.digest(p_guest_token, 'sha256'), 'hex')), updated_at = now() where room_code = p_room_code;
  return next_state;
end $$;

create or replace function public.get_game_room(p_room_code text, p_player_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare room public.game_rooms;
begin
  select * into room from public.game_rooms where room_code = p_room_code;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  if public.game_room_slot(room, p_player_token) is null then raise exception 'ROOM_ACCESS_DENIED'; end if;
  return room.state;
end $$;

create or replace function public.apply_game_room_action(p_room_code text, p_player_token text, p_expected_version bigint, p_action jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare room public.game_rooms; slot integer; match_slot integer; next_state jsonb; action_type text := p_action->>'type'; correct boolean; score integer; new_answer_keys jsonb; answers jsonb; guess_ids jsonb; choice_ids jsonb; player_count integer; answer_count integer; remaining_count integer; i integer; special_step integer; results jsonb;
begin
  select * into room from public.game_rooms where room_code = p_room_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  slot := public.game_room_slot(room, p_player_token);
  if slot is null then raise exception 'ROOM_ACCESS_DENIED'; end if;
  if room.state_version <> p_expected_version then raise exception 'STALE_STATE'; end if;
  next_state := room.state;
  select ordinality - 1 into match_slot from jsonb_array_elements(coalesce(room.state->'matchPlayers', '[]'::jsonb)) with ordinality active(player, ordinality) where (player->>'roomSlot')::integer = slot;

  if action_type = 'ready' then
    if room.state->>'status' not in ('waiting', 'finished') then raise exception 'READY_NOT_ALLOWED'; end if;
    next_state := jsonb_set(next_state, array['players', slot::text, 'ready'], to_jsonb(coalesce((p_action->>'ready')::boolean, true)));
  elsif action_type = 'connection' then
    next_state := jsonb_set(next_state, array['players', slot::text, 'connected'], to_jsonb((p_action->>'connected')::boolean));
    next_state := jsonb_set(next_state, array['players', slot::text, 'lastSeenAt'], to_jsonb(floor(extract(epoch from now()) * 1000)));
  elsif action_type = 'leave_match' then
    if room.state->>'status' <> 'playing' or match_slot is null then raise exception 'NOT_IN_MATCH'; end if;
    results := coalesce(room.state->'matchResults', '{}'::jsonb) || coalesce((select jsonb_object_agg(player->>'roomSlot', room.state#>array['scores',(ordinality - 1)::text]) from jsonb_array_elements(room.state->'matchPlayers') with ordinality roster(player, ordinality)), '{}'::jsonb);
    next_state := jsonb_set(next_state, '{matchResults}', results);
    remaining_count := jsonb_array_length(room.state->'matchPlayers') - 1;
    if slot = 0 or remaining_count < 2 then
      next_state := jsonb_set(next_state, '{status}', '"finished"');
      next_state := jsonb_set(next_state, '{finishedAt}', to_jsonb(floor(extract(epoch from now()) * 1000)));
      next_state := jsonb_set(next_state, '{players}', (select jsonb_agg(jsonb_set(p, '{ready}', 'false')) from jsonb_array_elements(room.state->'players') p));
    else
      next_state := jsonb_set(next_state, '{matchPlayers}', (select jsonb_agg(player order by ordinality) from jsonb_array_elements(room.state->'matchPlayers') with ordinality listed(player, ordinality) where ordinality - 1 <> match_slot));
      next_state := jsonb_set(next_state, '{scores}', (room.state->'scores') - match_slot);
      next_state := jsonb_set(next_state, '{roundAnswers}', (select coalesce(jsonb_object_agg(case when key::integer > match_slot then (key::integer - 1)::text else key end, value), '{}'::jsonb) from jsonb_each(coalesce(room.state->'roundAnswers', '{}'::jsonb)) where key::integer <> match_slot));
      next_state := jsonb_set(next_state, '{currentTurn}', to_jsonb(case when (room.state->>'currentTurn')::integer > match_slot then (room.state->>'currentTurn')::integer - 1 when (room.state->>'currentTurn')::integer = match_slot then match_slot % remaining_count else (room.state->>'currentTurn')::integer end));
      if room.state#>>'{modeState,kind}' = 'randomFive' then
        guess_ids := (select coalesce(jsonb_object_agg(case when key::integer > match_slot then (key::integer - 1)::text else key end, value), '{}'::jsonb) from jsonb_each(coalesce(room.state#>'{modeState,value,guessIds}', '{}'::jsonb)) where key::integer <> match_slot);
        next_state := jsonb_set(next_state, '{modeState,value,guessIds}', guess_ids);
        next_state := jsonb_set(next_state, '{modeState,value,scores}', (room.state#>'{modeState,value,scores}') - match_slot);
      elsif room.state#>>'{modeState,kind}' = 'twin' then
        if jsonb_array_length(coalesce(room.state#>'{modeState,value,guesses}', '[]'::jsonb)) > match_slot then next_state := jsonb_set(next_state, '{modeState,value,guesses}', (room.state#>'{modeState,value,guesses}') - match_slot); end if;
        next_state := jsonb_set(next_state, '{modeState,value,scores}', (room.state#>'{modeState,value,scores}') - match_slot);
      elsif room.state#>>'{modeState,kind}' = 'grid' then
        next_state := jsonb_set(next_state, '{modeState,value,players}', (room.state#>'{modeState,value,players}') - match_slot);
        next_state := jsonb_set(next_state, '{modeState,value,scores}', (room.state#>'{modeState,value,scores}') - match_slot);
        next_state := jsonb_set(next_state, '{modeState,value,correct}', (room.state#>'{modeState,value,correct}') - match_slot);
        next_state := jsonb_set(next_state, '{modeState,value,wrong}', (room.state#>'{modeState,value,wrong}') - match_slot);
        next_state := jsonb_set(next_state, '{modeState,value,currentTurn}', next_state->'currentTurn');
        next_state := jsonb_set(next_state, '{modeState,value,grid,marks}', (select jsonb_agg(case when mark = 'null'::jsonb then mark when (mark->>'owner')::integer = match_slot then 'null'::jsonb when (mark->>'owner')::integer > match_slot then jsonb_set(mark, '{owner}', to_jsonb((mark->>'owner')::integer - 1)) else mark end order by ordinality) from jsonb_array_elements(coalesce(room.state#>'{modeState,value,grid,marks}', '[]'::jsonb)) with ordinality marks(mark, ordinality)));
      end if;
      if next_state->'question' <> 'null'::jsonb and (select count(*) from jsonb_object_keys(next_state->'roundAnswers')) = remaining_count then
        next_state := jsonb_set(next_state, '{revealUntil}', to_jsonb(floor(extract(epoch from now() + interval '2 seconds') * 1000)));
        next_state := jsonb_set(next_state, '{answerResult}', '"revealed"');
        next_state := jsonb_set(next_state, '{question,correctPlayerId}', room.answer_keys->0);
      elsif next_state#>>'{modeState,kind}' = 'randomFive' and (select count(*) from jsonb_object_keys(coalesce(next_state#>'{modeState,value,guessIds}', '{}'::jsonb))) = remaining_count then
        next_state := jsonb_set(next_state, '{modeState,value,revealUntil}', to_jsonb(floor(extract(epoch from now() + interval '2 seconds') * 1000)));
      end if;
    end if;
  elsif action_type = 'start' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    player_count := (select count(*) from jsonb_array_elements(room.state->'players') p where coalesce((p->>'ready')::boolean, false));
    if room.state->>'status' not in ('waiting', 'finished') or player_count < 2 or not coalesce((room.state#>>'{players,0,ready}')::boolean, false) then raise exception 'PLAYERS_NOT_READY'; end if;
    next_state := jsonb_set(next_state, '{matchPlayers}', (select jsonb_agg(player || jsonb_build_object('roomSlot', ordinality - 1) order by ordinality) from jsonb_array_elements(room.state->'players') with ordinality listed(player, ordinality) where coalesce((player->>'ready')::boolean, false)));
    next_state := jsonb_set(next_state, '{status}', '"playing"');
    next_state := jsonb_set(next_state, '{matchNumber}', to_jsonb(coalesce((room.state->>'matchNumber')::integer, 0) + 1));
    next_state := jsonb_set(next_state, '{questionSequence}', '0');
    next_state := jsonb_set(next_state, '{matchResults}', '{}');
    next_state := jsonb_set(next_state, '{scores}', (select jsonb_agg(0) from generate_series(1, player_count)));
    next_state := jsonb_set(next_state, '{question}', 'null'); next_state := jsonb_set(next_state, '{roundAnswers}', '{}'); next_state := jsonb_set(next_state, '{revealUntil}', 'null'); next_state := jsonb_set(next_state, '{modeState}', 'null');
    next_state := jsonb_set(next_state, '{settings,locked}', 'true');
  elsif action_type = 'configure' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    if room.state->>'status' not in ('waiting', 'finished') then raise exception 'SETTINGS_LOCKED'; end if;
    next_state := jsonb_set(next_state, '{status}', '"waiting"');
    next_state := jsonb_set(next_state, '{settings}', (p_action->'settings') || '{"locked":false}'::jsonb);
    next_state := jsonb_set(next_state, '{players}', (select jsonb_agg(jsonb_set(p, '{ready}', 'false')) from jsonb_array_elements(room.state->'players') p));
    next_state := jsonb_set(next_state, '{question}', 'null'); next_state := jsonb_set(next_state, '{roundAnswers}', '{}'); next_state := jsonb_set(next_state, '{revealUntil}', 'null'); next_state := jsonb_set(next_state, '{modeState}', 'null');
  elsif action_type = 'question' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    if room.state->>'status' <> 'playing' or coalesce((room.state#>>'{settings,locked}')::boolean, false) is false then raise exception 'GAME_NOT_STARTED'; end if;
    if room.state->'question' <> 'null'::jsonb and room.state->'revealUntil' = 'null'::jsonb then raise exception 'QUESTION_ACTIVE'; end if;
    new_answer_keys := coalesce(p_action#>'{question,validPlayerIds}', jsonb_build_array((p_action#>>'{question,correctPlayerId}')::bigint));
    next_state := jsonb_set(next_state, '{question}', (p_action->'question') - 'correctPlayerId' - 'validPlayerIds');
    next_state := jsonb_set(next_state, '{questionSequence}', to_jsonb(coalesce((room.state->>'questionSequence')::integer, 0) + 1));
    next_state := jsonb_set(next_state, '{roundAnswers}', '{}'); next_state := jsonb_set(next_state, '{revealUntil}', 'null'); next_state := jsonb_set(next_state, '{answerResult}', 'null');
  elsif action_type = 'answer' then
    if match_slot is null then raise exception 'NOT_IN_MATCH'; end if;
    if room.state->>'status' <> 'playing' or room.state->'question' = 'null'::jsonb then raise exception 'QUESTION_NOT_ACTIVE'; end if;
    if coalesce(room.state->'roundAnswers', '{}'::jsonb) ? match_slot::text then raise exception 'QUESTION_ALREADY_ANSWERED'; end if;
    if room.state#>>'{question,questionId}' <> p_action->>'questionId' then raise exception 'STALE_QUESTION'; end if;
    if jsonb_array_length(coalesce(room.state#>'{question,optionPlayerIds}', '[]'::jsonb)) > 0 and not (room.state#>'{question,optionPlayerIds}') @> jsonb_build_array((p_action->>'selectedPlayerId')::bigint) then raise exception 'INVALID_OPTION'; end if;
    correct := room.answer_keys @> jsonb_build_array((p_action->>'selectedPlayerId')::bigint);
    if correct then score := (room.state#>>array['scores',match_slot::text])::integer + 1; next_state := jsonb_set(next_state, array['scores',match_slot::text], to_jsonb(score)); end if;
    answers := coalesce(room.state->'roundAnswers', '{}'::jsonb) || jsonb_build_object(match_slot::text, jsonb_build_object('selectedPlayerId', (p_action->>'selectedPlayerId')::bigint, 'result', case when correct then 'correct' else 'wrong' end));
    next_state := jsonb_set(next_state, '{roundAnswers}', answers);
    player_count := jsonb_array_length(room.state->'matchPlayers'); answer_count := (select count(*) from jsonb_object_keys(answers));
    if answer_count = player_count then
      next_state := jsonb_set(next_state, '{revealUntil}', to_jsonb(floor(extract(epoch from now() + interval '2 seconds') * 1000)));
      next_state := jsonb_set(next_state, '{answerResult}', '"revealed"');
      next_state := jsonb_set(next_state, '{question,correctPlayerId}', room.answer_keys->0);
    end if;
  elsif action_type = 'timeout' then
    if room.state->>'status' <> 'playing' or room.state->'question' = 'null'::jsonb then raise exception 'QUESTION_NOT_ACTIVE'; end if;
    if room.state#>>'{question,questionId}' <> p_action->>'questionId' then raise exception 'STALE_QUESTION'; end if;
    if room.state->'revealUntil' <> 'null'::jsonb then raise exception 'QUESTION_ALREADY_ANSWERED'; end if;
    if coalesce((room.state#>>'{question,deadlineAt}')::bigint, 0) > floor(extract(epoch from now()) * 1000) then raise exception 'TIME_REMAINING'; end if;
    answers := coalesce(room.state->'roundAnswers', '{}'::jsonb); player_count := jsonb_array_length(room.state->'matchPlayers');
    for i in 0..player_count - 1 loop
      if not answers ? i::text then answers := answers || jsonb_build_object(i::text, jsonb_build_object('selectedPlayerId', null, 'result', 'timeout')); end if;
    end loop;
    next_state := jsonb_set(next_state, '{roundAnswers}', answers);
    next_state := jsonb_set(next_state, '{revealUntil}', to_jsonb(floor(extract(epoch from now() + interval '2 seconds') * 1000)));
    next_state := jsonb_set(next_state, '{answerResult}', '"revealed"');
    next_state := jsonb_set(next_state, '{question,correctPlayerId}', room.answer_keys->0);
  elsif action_type = 'pass' then
    if match_slot is null or room.state->>'status' <> 'playing' or (room.state->>'currentTurn')::integer <> match_slot then raise exception 'NOT_YOUR_TURN'; end if;
    if room.state->'answeredBy' <> 'null'::jsonb or room.state#>>'{question,questionId}' <> p_action->>'questionId' then raise exception 'QUESTION_ALREADY_ANSWERED'; end if;
    next_state := jsonb_set(next_state, '{answeredBy}', to_jsonb(match_slot)); next_state := jsonb_set(next_state, '{selectedPlayerId}', 'null'); next_state := jsonb_set(next_state, '{answerResult}', '"pass"'); next_state := jsonb_set(next_state, '{currentTurn}', to_jsonb((match_slot + 1) % jsonb_array_length(room.state->'matchPlayers')));
  elsif action_type = 'finish' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    if room.state->>'status' <> 'playing' or (room.state->'revealUntil' = 'null'::jsonb and not coalesce((room.state#>>'{modeState,value,finished}')::boolean, false) and coalesce(room.state#>>'{modeState,value,status}', '') <> 'finished') then raise exception 'FINISH_NOT_ALLOWED'; end if;
    results := coalesce(room.state->'matchResults', '{}'::jsonb) || coalesce((select jsonb_object_agg(player->>'roomSlot', room.state#>array['scores',(ordinality - 1)::text]) from jsonb_array_elements(room.state->'matchPlayers') with ordinality roster(player, ordinality)), '{}'::jsonb);
    next_state := jsonb_set(next_state, '{matchResults}', results);
    next_state := jsonb_set(next_state, '{status}', '"finished"'); next_state := jsonb_set(next_state, '{finishedAt}', to_jsonb(floor(extract(epoch from now()) * 1000)));
    next_state := jsonb_set(next_state, '{players}', (select jsonb_agg(jsonb_set(p, '{ready}', 'false')) from jsonb_array_elements(room.state->'players') p));
  elsif action_type = 'special_guess' then
    if match_slot is null then raise exception 'NOT_IN_MATCH'; end if;
    if room.state->>'status' <> 'playing' or room.state#>>'{modeState,kind}' <> p_action->>'kind' then raise exception 'SPECIAL_GAME_NOT_ACTIVE'; end if;
    special_step := coalesce((room.state#>>'{modeState,value,round}')::integer, -1);
    if special_step <> (p_action->>'step')::integer then raise exception 'STALE_SPECIAL_STEP'; end if;
    guess_ids := coalesce(room.state#>'{modeState,value,guessIds}', '{}'::jsonb);
    if guess_ids ? match_slot::text then raise exception 'SPECIAL_GUESS_ALREADY_SUBMITTED'; end if;
    choice_ids := room.state#>array['modeState','value','choiceIds',special_step::text];
    if room.state#>>'{modeState,value,answerMethod}' = 'multiple' and (choice_ids is null or not choice_ids @> jsonb_build_array((p_action->>'selectedPlayerId')::bigint)) then raise exception 'INVALID_OPTION'; end if;
    guess_ids := guess_ids || jsonb_build_object(match_slot::text, (p_action->>'selectedPlayerId')::bigint);
    next_state := jsonb_set(next_state, '{modeState,value,guessIds}', guess_ids);
    player_count := jsonb_array_length(room.state->'matchPlayers'); answer_count := (select count(*) from jsonb_object_keys(guess_ids));
    if answer_count = player_count then next_state := jsonb_set(next_state, '{modeState,value,revealUntil}', to_jsonb(floor(extract(epoch from now() + interval '2 seconds') * 1000))); end if;
  elsif action_type = 'mode_state' then
    if room.state->>'status' <> 'playing' then raise exception 'GAME_NOT_STARTED'; end if;
    if coalesce(room.state->'modeState', 'null'::jsonb) <> 'null'::jsonb and (match_slot is null or (room.state->>'currentTurn')::integer <> match_slot) then raise exception 'NOT_YOUR_TURN'; end if;
    if coalesce(room.state->'modeState', 'null'::jsonb) = 'null'::jsonb and slot <> 0 then raise exception 'HOST_ONLY'; end if;
    next_state := jsonb_set(next_state, '{modeState}', p_action->'modeState');
    next_state := jsonb_set(next_state, '{currentTurn}', to_jsonb(coalesce((p_action->>'currentTurn')::integer, 0)));
    next_state := jsonb_set(next_state, '{scores}', coalesce(p_action->'scores', room.state->'scores'));
  else raise exception 'UNKNOWN_ACTION'; end if;

  next_state := jsonb_set(next_state, '{stateVersion}', to_jsonb(room.state_version + 1));
  update public.game_rooms set state = next_state, state_version = state_version + 1, answer_keys = case when action_type = 'question' then new_answer_keys else answer_keys end, updated_at = now() where room_code = p_room_code;
  return next_state;
end $$;

create or replace function public.notify_game_room_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform realtime.send(jsonb_build_object('stateVersion', new.state_version), 'state_changed', 'room:' || new.room_code, false);
  return new;
end $$;
drop trigger if exists game_room_change on public.game_rooms;
create trigger game_room_change after insert or update on public.game_rooms for each row execute function public.notify_game_room_change();

revoke all on function public.game_room_slot(public.game_rooms, text) from public, anon, authenticated;
grant execute on function public.create_game_room(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.join_game_room(text, text, text) to anon, authenticated;
grant execute on function public.get_game_room(text, text) to anon, authenticated;
grant execute on function public.apply_game_room_action(text, text, bigint, jsonb) to anon, authenticated;

-- İsteğe bağlı günlük temizlik (pg_cron açıksa):
-- select cron.schedule('cleanup-game-rooms', '15 * * * *', $$delete from public.game_rooms where expires_at < now()$$);
