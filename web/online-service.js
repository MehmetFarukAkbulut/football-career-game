"use strict";
(function initOnlineService(global) {
  const config = global.IKI_FORMA_CONFIG || {};
  const effectiveMode = new URLSearchParams(location.search).get("onlineMock") === "1" ? "local" : config.onlineMode;
  const encoder = new TextEncoder();
  const supabaseReady = (() => {
    if (effectiveMode !== "production" || global.supabase) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.min.js";
      script.onload = resolve; script.onerror = () => reject(new Error("SUPABASE_LIBRARY_FAILED"));
      document.head.append(script);
    });
  })();
  const randomToken = () => [...crypto.getRandomValues(new Uint8Array(32))].map((value) => value.toString(16).padStart(2, "0")).join("");
  const normalizeCode = (code) => String(code || "").trim().toUpperCase();

  class SupabaseRoomService {
    constructor() {
      if (!global.supabase || !config.supabaseUrl || !config.supabasePublishableKey) throw new Error("ONLINE_NOT_CONFIGURED");
      this.client = global.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
      this.channel = null;
    }
    async rpc(name, args) {
      const { data, error } = await this.client.rpc(name, args);
      if (error) throw new Error(error.message || "ONLINE_REQUEST_FAILED");
      return data;
    }
    async create({ code, playerName, settings }) {
      const token = randomToken();
      const state = await this.rpc("create_game_room", { p_room_code: normalizeCode(code), p_host_token: token, p_player_name: playerName, p_settings: settings });
      return { state, token, playerIndex: 0 };
    }
    async join({ code, playerName }) {
      const token = randomToken();
      const state = await this.rpc("join_game_room", { p_room_code: normalizeCode(code), p_guest_token: token, p_player_name: playerName });
      return { state, token, playerIndex: state.players.length - 1 };
    }
    get(code, token) { return this.rpc("get_game_room", { p_room_code: normalizeCode(code), p_player_token: token }); }
    mutate(code, token, expectedVersion, action) { return this.rpc("apply_game_room_action", { p_room_code: normalizeCode(code), p_player_token: token, p_expected_version: expectedVersion, p_action: action }); }
    subscribe(code, onChange, onStatus) {
      this.unsubscribe();
      this.channel = this.client.channel(`room:${normalizeCode(code)}`, { config: { broadcast: { self: true } } })
        .on("broadcast", { event: "state_changed" }, ({ payload }) => onChange(payload))
        .subscribe((status) => onStatus?.(status));
      return () => this.unsubscribe();
    }
    unsubscribe() { if (this.channel) this.client.removeChannel(this.channel); this.channel = null; }
  }

  class LocalRoomService {
    constructor() { this.channel = null; this.prefix = "iki-forma-local-room:"; }
    read(code) { const value = localStorage.getItem(this.prefix + normalizeCode(code)); return value ? JSON.parse(value) : null; }
    write(state) { localStorage.setItem(this.prefix + state.roomCode, JSON.stringify(state)); this.channel?.postMessage({ stateVersion: state.stateVersion }); return state; }
    async create({ code, playerName, settings }) { const roomCode = normalizeCode(code); if (this.read(roomCode)) throw new Error("ROOM_EXISTS"); return { state: this.write(global.IkiFormaOnlineCore.createOnlineRoom({ code: roomCode, hostName: playerName, settings })), token: "local-host", playerIndex: 0 }; }
    async join({ code, playerName }) { const state = this.read(code); if (!state) throw new Error("ROOM_NOT_FOUND"); const playerIndex = state.players.length, token = `local-player-${playerIndex}`; return { state: this.write(global.IkiFormaOnlineCore.joinOnlineRoom(state, { playerName, expectedVersion: state.stateVersion })), token, playerIndex }; }
    async get(code) { const state = this.read(code); if (!state) throw new Error("ROOM_NOT_FOUND"); return state; }
    async mutate(code, token, expectedVersion, action) {
      const state = this.read(code); let next;
      const playerIndex = token === "local-host" ? 0 : +(token.split("-").at(-1)), args = { ...action, playerIndex, expectedVersion };
      if (action.type === "ready") next = global.IkiFormaOnlineCore.setOnlineReady(state, args);
      else if (action.type === "start") next = global.IkiFormaOnlineCore.startOnlineGame(state, args);
      else if (action.type === "question") next = global.IkiFormaOnlineCore.publishOnlineQuestion(state, { ...args, question: action.question });
      else if (action.type === "answer") next = global.IkiFormaOnlineCore.submitOnlineAnswer(state, args);
      else if (action.type === "timeout") next = global.IkiFormaOnlineCore.timeoutOnlineQuestion(state, args);
      else if (action.type === "special_guess") next = global.IkiFormaOnlineCore.submitOnlineSpecialGuess(state, args);
      else if (action.type === "leave_match") next = global.IkiFormaOnlineCore.leaveOnlineMatch(state, args);
      else if (action.type === "pass") next = global.IkiFormaOnlineCore.passOnlineTurn(state, args);
      else if (action.type === "finish") next = global.IkiFormaOnlineCore.finishOnlineGame(state, args);
      else if (action.type === "mode_state") next = global.IkiFormaOnlineCore.syncOnlineModeState(state, args);
      else if (action.type === "connection") next = global.IkiFormaOnlineCore.updateConnection(state, args);
      else if (action.type === "configure") next = global.IkiFormaOnlineCore.configureOnlineMatch(state, args);
      else throw new Error("UNKNOWN_ACTION");
      return this.write(next);
    }
    subscribe(code, onChange, onStatus) { this.channel = new BroadcastChannel(`iki-forma-${normalizeCode(code)}`); this.channel.onmessage = ({ data }) => onChange(data); onStatus?.("LOCAL_MOCK"); return () => this.unsubscribe(); }
    unsubscribe() { this.channel?.close(); this.channel = null; }
  }
  async function createRoomService() {
    if (effectiveMode === "local") return new LocalRoomService();
    await supabaseReady;
    return new SupabaseRoomService();
  }
  global.IkiFormaOnlineService = { createRoomService, configured: effectiveMode === "local" || Boolean(config.supabaseUrl && config.supabasePublishableKey), isLocal: effectiveMode === "local", randomToken, normalizeCode, encoder };
})(window);
