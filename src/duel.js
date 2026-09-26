// Duell (Modus 'duel'): zwei Geräte fahren dieselbe Strecke gegeneinander, verbunden über einen Raum in der Firebase-
// Datenbank (room.js, net.js). Reine Logik ohne DOM: Phasen und Rolle, der gespiegelte Raum, der Start über eine
// gemeinsame Uhr, der eigene Lauf (Zielweite, Sturzpause, Zeit vorbei), die Proben des Gegners samt Interpolation für
// den Geist, der Sende-Takt, die Wertung und der lokale Siegzähler. duel-card.js zeigt das an, main.js ruft beforeFrame
// und afterFrame je Bild. Gewertet wird die eigene Wanduhr-Zeit ab dem gemeinsamen Go (startAt, Serverzeit): so
// spielen Netzlaufzeit und Bildrate keine Rolle, und eine Pause kostet Zeit, statt sie anzuhalten.
import { C, VERSION } from './constants.js';
import { createRoom, validCode, validRoom, SV } from './room.js';
import { reset, beginCount, endRun, randomSeed } from './game.js';
import { suspendTune, restoreTune } from './tune.js';
import { nameKey } from './board.js';
import { loadDuelTally, bumpDuelTally } from './storage.js';

const other = (role) => (role === 'host' ? 'guest' : 'host');
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
const JOIN_ERROR = {
  missing: 'Raum nicht gefunden',
  version: 'Der andere hat eine andere Version: App neu laden',
  full: 'Der Raum ist voll',
  busy: 'Dort läuft schon ein Rennen',
  rules: 'Die Regeln für Räume fehlen in der Datenbank',
  error: 'Kein Netz',
};

// Wertung aus beiden Ständen: fin = Zielzeit in s (0 = keine), done = Lauf gewertet, gone = Gegner weg.
// result '' = noch offen, sonst w/l/d aus meiner Sicht; reason: time (beide im Ziel), out (einer über der Zeit), gone.
export function judge(me, opp) {
  const mf = me.fin > 0 ? Math.round(me.fin * 100) : 0, of = opp.fin > 0 ? Math.round(opp.fin * 100) : 0;
  if (opp.gone) return { result: me.done ? 'w' : '', reason: 'gone' };
  if (mf && of) return { result: mf < of ? 'w' : mf > of ? 'l' : 'd', reason: 'time' };
  if (mf && opp.done) return { result: 'w', reason: 'out' };
  if (of && me.done) return { result: 'l', reason: 'out' };
  if (me.done && opp.done) return { result: 'd', reason: 'out' };
  return { result: '', reason: '' };
}

// Position des Gegners zur Rennzeit t aus seinen Proben: zwischen zwei Proben linear, danach bis extrapS mit seinem
// Tempo entlang der Fahrtrichtung fortgeschrieben (Fahrtrichtung wie in game.js: dx = sin θ, dy = cos θ), dann Halt.
export function sampleAt(samples, t, extrapS) {
  const n = samples.length;
  if (n === 0) return null;
  if (t <= samples[0].t) return { ...samples[0], live: false };
  for (let i = n - 1; i >= 0; i--) {
    const a = samples[i];
    if (t < a.t) continue;
    const b = samples[i + 1];
    if (!b) {
      const dt = Math.min(extrapS, t - a.t);
      return { t, x: a.x + Math.sin(a.th) * a.v * dt, y: a.y + Math.cos(a.th) * a.v * dt, th: a.th, v: a.v, live: t - a.t <= extrapS };
    }
    const f = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
    return { t, x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, th: a.th + (b.th - a.th) * f, v: a.v + (b.v - a.v) * f, live: true };
  }
  return { ...samples[0], live: false };
}

export function createDuel({ g, net, board, onTune = null, debug = false }) {
  const d = {
    phase: 'off', // off | join | lobby | count | race | result
    role: '', error: '', notice: '', busy: false, pendingCode: '', stream: '',
    round: 0, goWall: 0, raceStartedAt: 0, fin: 0, done: false, out: false, outAt: 0,
    samples: [], lastSampleAt: 0, myHist: [], oppStale: false, oppGone: false,
    verdict: null, tallied: 0, doneWritten: false,
    lastSend: -1e9, sending: false, sentFinal: false, failed: 0, lastBeat: 0, targetTimer: 0,
  };
  const listeners = [];
  const emit = () => { for (const fn of listeners) fn(); };
  const room = createRoom(net, { onChange: onRoom, onStatus: (s) => { d.stream = s; emit(); }, debug });
  const me = () => ({ name: board.name(), rider: g.rider });
  const raceT = () => (Date.now() - d.goWall) / 1000;
  const countClock = () => raceT() + C.SG_COUNT_BEEPS * C.SG_COUNT_STEP_S;
  const oppRole = () => other(d.role);
  const oppPlayer = (r) => (validRoom(r) && d.role ? r.players[oppRole()] || null : null);
  const oppLive = (r) => (validRoom(r) && r.live && d.role ? r.live[oppRole()] || null : null);

  // Jede Änderung im Raum: neue Proben des Gegners sammeln (nach seiner Rennzeit), dann die Anzeige wecken
  function onRoom(r) {
    const ol = oppLive(r);
    if (ol && typeof ol.t === 'number') {
      const last = d.samples[d.samples.length - 1];
      if (!last || ol.t > last.t) {
        d.samples.push({ t: ol.t, x: ol.x || 0, y: ol.y || 0, th: ol.th || 0, v: ol.done || ol.p ? 0 : ol.v || 0 });
        if (d.samples.length > 40) d.samples.shift();
        d.lastSampleAt = Date.now();
      }
    }
    emit();
  }

  function applyTune(suspend) {
    if (suspend) suspendTune(); else restoreTune();
    if (onTune) onTune();
  }

  // Alles verlassen: Regler zurück, Spiel freigeben, Raum vergessen
  function end() {
    applyTune(false);
    if (d.targetTimer) clearTimeout(d.targetTimer);
    d.targetTimer = 0;
    g.hold = false; g.finishM = 0; g.respawnS = 0; g.raceOver = false; g.onFinish = null; g.ghost.on = false;
    d.phase = 'off'; d.role = ''; d.error = ''; d.busy = false; d.verdict = null; d.samples = []; d.myHist = [];
    d.fin = 0; d.done = false; d.out = false; d.round = 0;
    room.reset();
    emit();
  }

  // Laufender Lauf ist vorbei (Zeit überschritten, Raum weg): Auslauf, keine Weiterfahrt mehr
  function stopRun() {
    g.raceOver = true;
    endRun(g, { duel: true, out: true });
  }

  function newRound() {
    d.fin = 0; d.done = false; d.out = false; d.outAt = 0; d.samples = []; d.myHist = []; d.lastSampleAt = 0;
    d.oppStale = false; d.oppGone = false; d.verdict = null; d.doneWritten = false; d.sentFinal = false;
    g.ghost.on = false;
  }

  function enterLobby() {
    d.phase = 'lobby';
    d.error = '';
    d.lastBeat = 0; // sofort ein Lebenszeichen, damit der andere nicht „weg?“ liest
    emit();
  }

  // Beide Geräte: Regler auf Standard, dieselbe Welt bauen, auf den gemeinsamen Countdown warten (hold)
  function startRace(r) {
    applyTune(true);
    reset(g, r.seed >>> 0, false);
    g.finishM = r.target;
    g.respawnS = r.pause;
    g.raceOver = false;
    g.onFinish = onFinish;
    d.goWall = r.startAt - room.offset();
    d.raceStartedAt = Date.now();
    d.lastSend = -1e9;
    d.phase = 'count';
    emit();
  }

  // Zielweite gekreuzt: eigene Zeit steht, sofort melden
  function onFinish(secBeforeFrameEnd) {
    d.fin = Math.max(0.01, round2(raceT() - secBeforeFrameEnd));
    d.done = true;
    d.lastSend = -1e9;
    emit();
  }

  // Eigene Meter je Rennzeit, für den fairen Abstand zum Geist bei gleicher Rennzeit
  function trackMe() {
    const t = raceT();
    d.myHist.push({ t, y: g.skier.y });
    while (d.myHist.length > 2 && d.myHist[0].t < t - 3) d.myHist.shift();
  }
  function myYAt(t) {
    const h = d.myHist;
    for (let i = h.length - 1; i >= 0; i--) {
      if (h[i].t <= t) {
        const b = h[i + 1];
        if (!b || b.t <= h[i].t) return h[i].y;
        return h[i].y + (b.y - h[i].y) * ((t - h[i].t) / (b.t - h[i].t));
      }
    }
    return h.length ? h[0].y : g.skier.y;
  }

  function raceRules(r) {
    const ol = oppLive(r);
    const oppFin = ol && ol.fin > 0 ? ol.fin : 0;
    // Gegner im Ziel und meine Uhr schon darüber: verloren, der Lauf endet sofort
    if (oppFin && !d.done && raceT() > oppFin) {
      d.done = true; d.out = true; d.outAt = round2(raceT());
      d.lastSend = -1e9;
      stopRun();
    }
    const oppDone = !!(ol && ol.done);
    const at = ol && typeof ol.at === 'number' ? ol.at : 0;
    d.oppStale = !oppDone && d.lastSampleAt > 0 && Date.now() - d.lastSampleAt > C.DUEL_STALE_S * 1000;
    // Gegner weg: nur bei gesundem eigenen Stream, sonst bin ich es, der nichts mehr hört
    const quietMs = at ? room.serverNow() - at : Date.now() - d.raceStartedAt;
    d.oppGone = !oppDone && room.healthy() && quietMs > C.DUEL_GONE_S * 1000;
  }

  function updateVerdict(r) {
    if (d.verdict) return;
    const ol = oppLive(r);
    const v = judge({ fin: d.fin, done: d.done }, { fin: ol && ol.fin > 0 ? ol.fin : 0, done: !!(ol && ol.done), gone: d.oppGone });
    if (!v.result) return;
    const opp = oppPlayer(r);
    d.verdict = {
      ...v, oppName: opp ? opp.name : 'Gegner', oppFin: ol && ol.fin > 0 ? ol.fin : 0, oppY: ol ? ol.y || 0 : 0,
      oppCrashes: ol ? ol.c || 0 : 0, myFin: d.fin, myOutAt: d.outAt, myCrashes: g.crashes, round: d.round,
    };
    d.phase = 'result';
    d.lastBeat = 0;
    if (opp && d.tallied !== d.round) { bumpDuelTally(nameKey(opp.name), opp.name, v.result); d.tallied = d.round; }
    if (d.role === 'host' && !d.doneWritten) { d.doneWritten = true; room.patch('', { state: 'done', ts: SV }, true); }
    emit();
  }

  // Pose des Gegners für render.js: bei meiner Rennzeit minus Geist-Verzögerung, damit seine Proben schon da sind
  function ghostTick(r) {
    const opp = oppPlayer(r);
    const t = raceT() - C.DUEL_GHOST_DELAY_S;
    const p = sampleAt(d.samples, t, C.DUEL_GHOST_EXTRAP_S);
    const gh = g.ghost;
    if (!p || !opp) { gh.on = false; return; }
    gh.on = true;
    gh.x = p.x; gh.y = p.y; gh.theta = p.th; gh.v = p.v;
    gh.carve = Math.min(1, Math.abs(p.th) / (Math.PI / 2));
    gh.name = opp.name;
    gh.rider = opp.rider;
    const ol = oppLive(r);
    gh.stale = d.oppStale || (!p.live && !(ol && ol.done)); // im Ziel steht er zu Recht still
    gh.gone = d.oppGone;
    gh.gap = p.y - myYAt(t); // positiv: der Gegner liegt vorn
  }

  function heartbeatTick() {
    if (!d.role || d.phase === 'count' || d.phase === 'race') return;
    const now = Date.now();
    if (now - d.lastBeat < C.DUEL_HEARTBEAT_MS) return;
    d.lastBeat = now;
    room.heartbeat();
  }

  function roomGone() {
    const racing = d.phase === 'count' || d.phase === 'race';
    if (racing) stopRun();
    applyTune(false);
    room.reset();
    d.role = '';
    d.phase = 'join';
    d.notice = 'Der andere hat den Raum geschlossen';
    d.verdict = null;
    g.finishM = 0; g.respawnS = 0; g.onFinish = null; g.ghost.on = false;
    emit();
  }

  // ---------- je Bild ----------

  function beforeFrame() {
    if (d.phase === 'off') return;
    const r = room.data();
    if (d.role && room.streaming() && r === null) { roomGone(); return; }
    if (!validRoom(r)) return;
    if (r.round !== d.round) { d.round = r.round; newRound(); }
    if (r.state === 'lobby') { if (d.phase !== 'lobby') enterLobby(); }
    else if ((r.state === 'count' || r.state === 'race') && d.phase === 'lobby') startRace(r);
    if (d.phase === 'count') {
      if (g.state === 'ready' && countClock() >= 0) beginCount(g, countClock);
      if (g.state === 'running' || g.state === 'paused') {
        d.phase = 'race';
        if (d.role === 'host' && r.state === 'count') room.patch('', { state: 'race' }, true);
      }
    }
    if (d.phase === 'race' || d.phase === 'result') {
      trackMe();
      raceRules(r);
      updateVerdict(r);
      ghostTick(r);
    }
    heartbeatTick();
  }

  // Eigene Position senden: alle DUEL_SEND_MS, nach Sturz, Weiterfahrt und Ziel sofort; läuft noch ein Senden, wird
  // der Takt übersprungen. Das letzte Paket (done, fin) muss ankommen, sonst wartet der andere vergeblich auf die
  // Wertung: es geht auch dann noch raus, wenn die eigene Wertung schon steht (Phase result, weil der andere längst im
  // Ziel war), und wird nach einem Fehlschlag wiederholt. Bis v0.23.0 blieb es aus, sobald in dem Bild noch ein
  // Positions-Paket unterwegs war: der andere sah nie „im Ziel“ und bekam keine Revanche.
  function afterFrame() {
    if (d.sending || !d.role) return;
    const racing = d.phase === 'count' || d.phase === 'race';
    const finalDue = d.done && !d.sentFinal && d.phase !== 'lobby';
    if (!(racing && !d.done) && !finalDue) return;
    const now = Date.now();
    if (now - d.lastSend < C.DUEL_SEND_MS) return;
    sendLive(now);
  }
  async function sendLive(now) {
    d.sending = true;
    d.lastSend = now;
    const s = g.skier;
    const body = {
      t: round2(Math.max(0, raceT())), x: round2(s.x), y: round2(s.y), th: round3(s.theta), v: round2(s.v),
      c: g.crashes, done: d.done ? 1 : 0, fin: d.fin, p: g.state === 'paused' ? 1 : 0, at: SV,
    };
    const final = d.done;
    const r = await room.patch(`live/${d.role}`, body, true);
    d.sending = false;
    d.failed = r.ok ? 0 : d.failed + 1;
    if (final && r.ok) d.sentFinal = true;
  }

  // ---------- Aktionen der Kachel ----------

  // Duell gewählt: sofort einen Raum eröffnen (oder mit Code beitreten); ohne Namen wartet die Kachel auf einen
  async function open(code = '') {
    d.pendingCode = validCode(code);
    d.error = ''; d.notice = '';
    if (d.phase === 'off') d.phase = 'join';
    if (!board.name()) { emit(); return; }
    if (d.pendingCode) await join(d.pendingCode); else if (!room.code()) await create();
    else emit();
  }

  async function create() {
    if (!net.enabled) { d.error = JOIN_ERROR.error; d.phase = 'join'; emit(); return; }
    if (room.code()) await dropRoom();
    d.busy = true; d.error = ''; d.phase = 'join'; emit();
    const res = await room.create(me(), randomSeed());
    d.busy = false;
    if (res === 'ok') { d.role = 'host'; d.round = 0; d.pendingCode = ''; enterLobby(); }
    else { d.error = JOIN_ERROR[res] || JOIN_ERROR.error; emit(); }
  }

  async function join(raw) {
    const code = validCode(raw);
    if (!code) { d.error = 'Der Code hat vier Buchstaben, ohne I und O'; emit(); return; }
    if (!board.name()) { d.pendingCode = code; d.phase = 'join'; emit(); return; }
    if (room.code() === code) return;
    if (room.code()) await dropRoom();
    d.busy = true; d.error = ''; d.phase = 'join'; emit();
    const res = await room.join(code, me());
    d.busy = false;
    if (res === 'ok') { d.role = 'guest'; d.round = 0; d.pendingCode = ''; enterLobby(); }
    else { d.error = JOIN_ERROR[res] || JOIN_ERROR.error; emit(); }
  }

  // Eigenen Raum aufgeben (Host löscht, Gast trägt sich aus), ohne das Duell zu beenden
  async function dropRoom() {
    const role = d.role;
    d.role = '';
    const p = role === 'host' ? room.remove() : role === 'guest' ? room.leaveGuest() : Promise.resolve();
    room.reset();
    await p;
  }

  function setReady(on) {
    if (d.role !== 'guest') return;
    room.patch('players/guest', { ready: !!on }, true);
  }

  function setTarget(m) {
    if (d.role !== 'host') return;
    const v = Math.min(C.DUEL_TARGET_MAX_M, Math.max(C.DUEL_TARGET_MIN_M, Math.round(m / C.DUEL_TARGET_STEP_M) * C.DUEL_TARGET_STEP_M));
    if (d.targetTimer) clearTimeout(d.targetTimer);
    d.targetTimer = setTimeout(() => { d.targetTimer = 0; room.patch('', { target: v, ts: SV }, true); }, 150);
  }

  function setRider(id) {
    if (d.role) room.patch(`players/${d.role}`, { rider: id }, true);
  }

  // Host: Los. Der Gast wird dabei wieder „nicht bereit“, damit sein späteres „Revanche?“ eindeutig ist
  function go() {
    const v = view();
    if (!v.canGo) return;
    room.patch('', { state: 'count', startAt: room.serverNow() + C.DUEL_COUNT_LEAD_MS, pause: C.DUEL_CRASH_PAUSE_S, ts: SV, 'players/guest/ready': false }, true);
  }

  // Revanche: der Host würfelt neu und schickt beide in die Lobby, der Gast meldet nur seinen Wunsch (ready). Hat er
  // das schon getan, bleibt er in der neuen Lobby bereit und der Host kann sofort auf „Los“ tippen.
  function rematch() {
    if (d.role === 'host') {
      const body = { state: 'lobby', round: d.round + 1, seed: randomSeed(), startAt: 0, ts: SV, 'live/host': null, 'live/guest': null };
      if (!view().oppWantsRematch) body['players/guest/ready'] = false;
      room.patch('', body, true);
    } else setReady(true);
  }

  async function leave() {
    const racing = d.phase === 'count' || d.phase === 'race';
    if (racing) stopRun();
    const role = d.role;
    const p = role === 'host' ? room.remove() : role === 'guest' ? room.leaveGuest() : Promise.resolve();
    end();
    await p;
  }

  function shareData() {
    const code = room.code();
    const url = typeof location !== 'undefined' ? `${location.origin}${location.pathname}?room=${code}` : '';
    return { title: 'Powder – Duell', text: `Fahr gegen mich in Powder! Raum-Code ${code}`, url };
  }

  const tallyFor = (name) => {
    const e = loadDuelTally()[nameKey(name)];
    return e ? { w: e.w || 0, l: e.l || 0, d: e.d || 0 } : { w: 0, l: 0, d: 0 };
  };

  // Alles, was die Kachel zum Anzeigen braucht, aus Raumspiegel und eigenem Stand
  function view() {
    const r = room.data();
    const ok = validRoom(r);
    const players = ok ? r.players : {};
    const host = players.host || null, guest = players.guest || null;
    const opp = d.role ? (d.role === 'host' ? guest : host) : null;
    const now = room.serverNow();
    const seenOk = (p) => !p || typeof p.seen !== 'number' || now - p.seen < C.DUEL_LOBBY_GONE_S * 1000;
    return {
      phase: d.phase, role: d.role, code: room.code(), error: d.error, notice: d.notice, busy: d.busy,
      hasName: !!board.name(), myName: board.name(), pendingCode: d.pendingCode, netOk: net.enabled,
      target: ok ? r.target : C.DUEL_TARGET_DEFAULT_M, pause: ok ? r.pause : C.DUEL_CRASH_PAUSE_S,
      round: ok ? r.round : 0, state: ok ? r.state : '',
      host, guest, opp, oppGone: opp ? !seenOk(opp) : false,
      versionOk: !opp || opp.v === VERSION, oppVersion: opp ? opp.v : '',
      canGo: d.role === 'host' && !!guest && !!guest.ready && guest.v === VERSION && seenOk(guest),
      ready: d.role === 'guest' ? !!(guest && guest.ready) : true,
      streaming: room.streaming(), healthy: room.healthy(),
      verdict: d.verdict, myFin: d.fin, myCrashes: g.crashes, done: d.done, out: d.out, outAt: d.outAt,
      oppLive: oppLive(r), oppWantsRematch: d.role === 'host' && d.phase === 'result' && !!(guest && guest.ready),
      tally: opp ? tallyFor(opp.name) : null,
    };
  }

  // Für das HUD während des Rennens: eigene Uhr, Stand des Gegners
  function hud() {
    if (d.phase !== 'count' && d.phase !== 'race' && d.phase !== 'result') return null;
    const r = room.data();
    const ol = oppLive(r), opp = oppPlayer(r);
    return {
      clock: d.done ? (d.fin || d.outAt) : Math.max(0, raceT()),
      oppName: opp ? opp.name : 'Gegner',
      oppFin: ol && ol.fin > 0 ? ol.fin : 0,
      oppPaused: !!(ol && ol.p && !ol.done),
      oppGone: d.oppGone,
      gap: g.ghost.on ? g.ghost.gap : null,
    };
  }

  return {
    open, create, join, setReady, setTarget, setRider, go, rematch, leave, shareData, view, hud,
    beforeFrame, afterFrame,
    event: (type) => { if (type === 'crash' || type === 'respawn') d.lastSend = -1e9; },
    resume: () => { if (d.role) room.reopen(); },
    active: () => d.phase !== 'off',
    racing: () => d.phase === 'count' || d.phase === 'race',
    onChange: (fn) => { listeners.push(fn); },
    tallyFor,
    raceT,
  };
}
