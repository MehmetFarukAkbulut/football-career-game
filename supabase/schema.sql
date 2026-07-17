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
alter table public.game_rooms enable row level security;
revoke all on public.game_rooms from anon, authenticated;

create or replace function public.game_room_slot(room public.game_rooms, token text)
returns integer language sql immutable security definer set search_path = '' as $$
  select case
    when room.host_token_hash = extensions.digest(token, 'sha256') then 0
    when room.guest_token_hash = extensions.digest(token, 'sha256') then 1
    else null end;
$$;

create or replace function public.create_game_room(p_room_code text, p_host_token text, p_player_name text, p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb; expires_ms bigint := floor(extract(epoch from (now() + interval '2 hours')) * 1000);
begin
  if p_room_code !~ '^[A-HJ-NP-Z2-9]{6}$' or length(p_host_token) < 32 then raise exception 'INVALID_ROOM_DATA'; end if;
  result := jsonb_build_object(
    'roomCode', p_room_code, 'stateVersion', 1, 'status', 'waiting',
    'createdAt', floor(extract(epoch from now()) * 1000), 'expiresAt', expires_ms,
    'questionSequence', 0, 'settings', p_settings || '{"locked":false}'::jsonb,
    'currentTurn', 0, 'scores', '[0,0]'::jsonb, 'usedPlayerIds', '[]'::jsonb,
    'players', jsonb_build_array(jsonb_build_object('name', left(coalesce(nullif(trim(p_player_name), ''), 'Oyuncu 1'), 24), 'ready', false, 'connected', true, 'host', true), null),
    'question', null, 'answeredBy', null, 'selectedPlayerId', null, 'answerResult', null
  );
  insert into public.game_rooms(room_code, state, state_version, host_token_hash, expires_at)
  values (p_room_code, result, 1, extensions.digest(p_host_token, 'sha256'), to_timestamp(expires_ms / 1000.0));
  return result;
exception when unique_violation then raise exception 'ROOM_EXISTS';
end $$;

create or replace function public.join_game_room(p_room_code text, p_guest_token text, p_player_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare room public.game_rooms; next_state jsonb;
begin
  select * into room from public.game_rooms where room_code = p_room_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  if room.guest_token_hash is not null or room.state->>'status' <> 'waiting' then raise exception 'ROOM_FULL'; end if;
  next_state := jsonb_set(room.state, '{players,1}', jsonb_build_object('name', left(coalesce(nullif(trim(p_player_name), ''), 'Oyuncu 2'), 24), 'ready', false, 'connected', true, 'host', false));
  next_state := jsonb_set(next_state, '{stateVersion}', to_jsonb(room.state_version + 1));
  update public.game_rooms set state = next_state, state_version = state_version + 1, guest_token_hash = extensions.digest(p_guest_token, 'sha256'), updated_at = now() where room_code = p_room_code;
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
declare room public.game_rooms; slot integer; next_state jsonb; action_type text := p_action->>'type'; correct boolean; score integer; new_answer_keys jsonb;
begin
  select * into room from public.game_rooms where room_code = p_room_code for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if room.expires_at <= now() then raise exception 'ROOM_EXPIRED'; end if;
  slot := public.game_room_slot(room, p_player_token);
  if slot is null then raise exception 'ROOM_ACCESS_DENIED'; end if;
  if room.state_version <> p_expected_version then raise exception 'STALE_STATE'; end if;
  next_state := room.state;

  if action_type = 'ready' then
    if room.state->>'status' <> 'waiting' then raise exception 'READY_NOT_ALLOWED'; end if;
    next_state := jsonb_set(next_state, array['players', slot::text, 'ready'], to_jsonb(coalesce((p_action->>'ready')::boolean, true)));
  elsif action_type = 'connection' then
    next_state := jsonb_set(next_state, array['players', slot::text, 'connected'], to_jsonb((p_action->>'connected')::boolean));
    next_state := jsonb_set(next_state, array['players', slot::text, 'lastSeenAt'], to_jsonb(floor(extract(epoch from now()) * 1000)));
  elsif action_type = 'start' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    if room.state->>'status' <> 'waiting' or not coalesce((room.state#>>'{players,0,ready}')::boolean, false) or not coalesce((room.state#>>'{players,1,ready}')::boolean, false) then raise exception 'PLAYERS_NOT_READY'; end if;
    next_state := jsonb_set(next_state, '{status}', '"playing"');
    next_state := jsonb_set(next_state, '{settings,locked}', 'true');
  elsif action_type = 'question' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    if room.state->>'status' <> 'playing' or coalesce((room.state#>>'{settings,locked}')::boolean, false) is false then raise exception 'GAME_NOT_STARTED'; end if;
    if room.state->'question' <> 'null'::jsonb and room.state->'answeredBy' = 'null'::jsonb then raise exception 'QUESTION_ACTIVE'; end if;
    new_answer_keys := coalesce(p_action#>'{question,validPlayerIds}', jsonb_build_array((p_action#>>'{question,correctPlayerId}')::bigint));
    next_state := jsonb_set(next_state, '{question}', (p_action->'question') - 'correctPlayerId' - 'validPlayerIds');
    next_state := jsonb_set(next_state, '{questionSequence}', to_jsonb(coalesce((room.state->>'questionSequence')::integer, 0) + 1));
    next_state := jsonb_set(next_state, '{answeredBy}', 'null'); next_state := jsonb_set(next_state, '{selectedPlayerId}', 'null'); next_state := jsonb_set(next_state, '{answerResult}', 'null');
  elsif action_type = 'answer' then
    if room.state->>'status' <> 'playing' or room.state->'question' = 'null'::jsonb then raise exception 'QUESTION_NOT_ACTIVE'; end if;
    if (room.state->>'currentTurn')::integer <> slot then raise exception 'NOT_YOUR_TURN'; end if;
    if room.state->'answeredBy' <> 'null'::jsonb then raise exception 'QUESTION_ALREADY_ANSWERED'; end if;
    if room.state#>>'{question,questionId}' <> p_action->>'questionId' then raise exception 'STALE_QUESTION'; end if;
    if jsonb_array_length(coalesce(room.state#>'{question,optionPlayerIds}', '[]'::jsonb)) > 0 and not (room.state#>'{question,optionPlayerIds}') @> jsonb_build_array((p_action->>'selectedPlayerId')::bigint) then raise exception 'INVALID_OPTION'; end if;
    correct := room.answer_keys @> jsonb_build_array((p_action->>'selectedPlayerId')::bigint);
    if correct then score := (room.state#>>array['scores',slot::text])::integer + 1; next_state := jsonb_set(next_state, array['scores',slot::text], to_jsonb(score));
    else next_state := jsonb_set(next_state, '{currentTurn}', to_jsonb(case when slot = 0 then 1 else 0 end)); end if;
    next_state := jsonb_set(next_state, '{answeredBy}', to_jsonb(slot));
    next_state := jsonb_set(next_state, '{selectedPlayerId}', to_jsonb((p_action->>'selectedPlayerId')::bigint));
    next_state := jsonb_set(next_state, '{answerResult}', to_jsonb(case when correct then 'correct' else 'wrong' end));
    next_state := jsonb_set(next_state, '{question,correctPlayerId}', room.answer_keys->0);
  elsif action_type = 'pass' then
    if room.state->>'status' <> 'playing' or (room.state->>'currentTurn')::integer <> slot then raise exception 'NOT_YOUR_TURN'; end if;
    if room.state->'answeredBy' <> 'null'::jsonb or room.state#>>'{question,questionId}' <> p_action->>'questionId' then raise exception 'QUESTION_ALREADY_ANSWERED'; end if;
    next_state := jsonb_set(next_state, '{answeredBy}', to_jsonb(slot)); next_state := jsonb_set(next_state, '{selectedPlayerId}', 'null'); next_state := jsonb_set(next_state, '{answerResult}', '"pass"'); next_state := jsonb_set(next_state, '{currentTurn}', to_jsonb(case when slot = 0 then 1 else 0 end));
  elsif action_type = 'finish' then
    if slot <> 0 then raise exception 'HOST_ONLY'; end if;
    if room.state->>'status' <> 'playing' or room.state->'answeredBy' = 'null'::jsonb then raise exception 'FINISH_NOT_ALLOWED'; end if;
    next_state := jsonb_set(next_state, '{status}', '"finished"'); next_state := jsonb_set(next_state, '{finishedAt}', to_jsonb(floor(extract(epoch from now()) * 1000)));
  elsif action_type = 'mode_state' then
    if room.state->>'status' <> 'playing' then raise exception 'GAME_NOT_STARTED'; end if;
    if coalesce(room.state->'modeState', 'null'::jsonb) <> 'null'::jsonb and (room.state->>'currentTurn')::integer <> slot then raise exception 'NOT_YOUR_TURN'; end if;
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
