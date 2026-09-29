// Raum für das Duell gegen den Bot (bot.js): dieselbe Schnittstelle wie room.js, aber nur im Speicher dieses Geräts,
// ohne Netz. So bleibt duel.js für beide Gegner dasselbe: der Spieler ist Host, der Bot sitzt als Gast auf
// Startnummer 2 und ist immer bereit. Zeitstempel löst der Raum mit der eigenen Uhr auf, es gibt keine Serverzeit.
import { C, VERSION } from './constants.js';
import { applyEvent } from './room.js';
import { botLevel } from './bot.js';
import { t } from './i18n.js';

export const BOT_CODE = 'BOT'; // kein gültiger Raum-Code (vier Buchstaben), die Kachel zeigt ihn nicht

const clampLevel = (n) => Math.min(C.BOT_LEVELS.length, Math.max(1, Math.round(n) || C.BOT_LEVEL_DEFAULT));
// Name der Stufe in der gewählten Sprache (i18n.js bot.1 … bot.6), botLevel begrenzt die Stufe auf 1 bis 6
const botPlayer = (level) => ({ name: t('bot.' + (C.BOT_LEVELS.indexOf(botLevel(level)) + 1)), rider: C.BOT_RIDER, ready: true, v: VERSION, bot: level });

// { '.sv': 'timestamp' } wie bei Firebase durch die Zeit ersetzen
function stamp(v, now) {
  if (!v || typeof v !== 'object') return v;
  if (v['.sv']) return now;
  const out = Array.isArray(v) ? [] : {};
  for (const [k, x] of Object.entries(v)) out[k] = stamp(x, now);
  return out;
}

export function createBotRoom({ onChange = null } = {}) {
  let mirror = null;
  const emit = () => { if (onChange) onChange(mirror); };
  const done = (ok) => Promise.resolve({ ok, status: ok ? 200 : 0, data: null });

  function create(player, seed, level) {
    const lv = clampLevel(level);
    mirror = {
      v: VERSION, ts: Date.now(), round: 1, seed, target: C.DUEL_TARGET_DEFAULT_M, pause: C.DUEL_CRASH_PAUSE_S,
      state: 'lobby', startAt: 0, bot: lv,
      players: { host: { name: player.name, rider: player.rider, ready: true, v: VERSION }, guest: botPlayer(lv) },
    };
    emit();
    return 'ok';
  }

  function write(kind, sub, body) {
    if (!mirror) return done(false);
    mirror = applyEvent(mirror, kind, '/' + (sub || ''), stamp(body, Date.now()));
    emit();
    return done(true);
  }

  // Stufe wechseln (Lobby): der Bot auf Startnummer 2 trägt den Namen der Stufe
  function setLevel(level) {
    if (!mirror) return;
    const lv = clampLevel(level);
    mirror.bot = lv;
    mirror.players.guest = botPlayer(lv);
    emit();
  }

  // Stand des Bots je Bild, ohne die Anzeige zu wecken: die Kachel liest ihn, wenn sich sonst etwas ändert
  function setLive(role, live) {
    if (!mirror) return;
    if (!mirror.live) mirror.live = {};
    mirror.live[role] = live;
  }

  function reset() {
    mirror = null;
  }

  return {
    create, setLevel, setLive, reset,
    join: async () => 'missing',
    heartbeat: async () => {},
    reopen: () => {},
    patch: (sub, body) => write('patch', sub, body),
    set: (sub, value) => write('put', sub, value),
    remove: async () => { reset(); return true; },
    leaveGuest: () => done(true),
    serverNow: () => Date.now(),
    offset: () => 0,
    healthy: () => !!mirror,
    streaming: () => !!mirror,
    data: () => mirror,
    code: () => (mirror ? BOT_CODE : ''),
    role: () => (mirror ? 'host' : ''),
  };
}
