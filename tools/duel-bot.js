// Automatischer Gegner fürs Duell, nur zum Testen: tritt einem Raum bei (oder eröffnet einen), meldet sich bereit und
// fährt beim Start eine plausible Linie mit fünf Positionen pro Sekunde bis zur Zielweite. Läuft in Node gegen den
// Mock (node tools/serve.js 8082 --board) oder gegen die echte Datenbank.
// Aufruf: node tools/duel-bot.js <basis-url> <code> [--name Jo] [--rider board] [--kmh 110] [--crash 400] [--host]
//   --crash <m>: stürzt einmal bei dieser Weite (Halt für die Sturzpause des Raums)
//   --host: eröffnet selbst einen Raum, wartet auf einen Gast und startet, sobald er bereit ist
const { NodeEventSource } = require('./sse.js');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : def; };
const base = args[0], codeArg = (args[1] || '').toUpperCase();
if (!base || (!codeArg && !args.includes('--host'))) {
  console.log('Aufruf: node tools/duel-bot.js <basis-url> <code> [--name Jo] [--rider board] [--kmh 110] [--crash 400] [--host]');
  process.exit(1);
}
const name = opt('name', 'Bot'), rider = opt('rider', 'board');
const vmax = Number(opt('kmh', 110)) / 3.6, crashAt = Number(opt('crash', 0));

(async () => {
  const { C } = await import('../src/constants.js');
  const { createNet } = await import('../src/net.js');
  const { createRoom, SV } = await import('../src/room.js');
  const net = createNet(base, { EventSourceImpl: NodeEventSource });
  let mirror = null;
  const room = createRoom(net, { onChange: (m) => { mirror = m; } });
  const role = args.includes('--host') ? 'host' : 'guest';
  const me = { name, rider };
  if (role === 'host') {
    const res = await room.create(me, (Math.random() * 4294967296) >>> 0);
    if (res !== 'ok') { console.log('Raum anlegen:', res); process.exit(1); }
    console.log(`[bot] Raum ${room.code()} eröffnet, warte auf einen Gast …`);
  } else {
    const res = await room.join(codeArg, me);
    if (res !== 'ok') { console.log('Beitritt:', res); process.exit(1); }
    console.log(`[bot] ${name} ist Raum ${codeArg} beigetreten`);
    await room.patch('players/guest', { ready: true }, true);
  }
  const other = role === 'host' ? 'guest' : 'host';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let round = 0, lastBeat = Date.now();
  for (;;) {
    await sleep(100);
    const r = mirror;
    if (!r) continue;
    if (Date.now() - lastBeat > C.DUEL_HEARTBEAT_MS) { lastBeat = Date.now(); await room.heartbeat(); } // sonst gilt der Bot in der Lobby als weg
    if (role === 'host' && r.state === 'lobby' && r.players.guest && r.players.guest.ready && r.round !== round) {
      console.log(`[bot] ${r.players.guest.name} ist bereit, Start in ${C.DUEL_COUNT_LEAD_MS} ms`);
      await room.patch('', { state: 'count', startAt: room.serverNow() + C.DUEL_COUNT_LEAD_MS, ts: SV, 'players/guest/ready': false }, true);
      continue;
    }
    if (role === 'guest' && r.state === 'lobby' && r.round !== round && r.players.guest && !r.players.guest.ready) {
      await room.patch('players/guest', { ready: true }, true); // Revanche: wieder bereit
      continue;
    }
    if ((r.state === 'count' || r.state === 'race') && r.round !== round) {
      round = r.round;
      await race(r);
    }
  }

  // Fahrt: ab dem Go beschleunigen wie das Spiel (G_SLOPE, Luftwiderstand gegen vmax), leichter Schlangenlinie
  // folgen, optional einmal stürzen, am Ziel fin melden. Zeit ist die Wanduhr ab startAt, wie im Spiel.
  async function race(r) {
    const target = r.target, pause = r.pause;
    const goLocal = r.startAt - room.offset();
    console.log(`[bot] Runde ${r.round}: Ziel ${target} m, Go in ${Math.max(0, goLocal - Date.now())} ms`);
    while (Date.now() < goLocal) await sleep(20);
    let y = 0, v = C.START_SPEED_KMH / 3.6, crashes = 0, crashed = false, last = Date.now();
    let fin = 0, done = 0;
    while (!done) {
      await sleep(C.DUEL_SEND_MS);
      const now = Date.now(), dt = (now - last) / 1000; last = now;
      const t = (now - goLocal) / 1000;
      if (crashed) {
        if (t >= crashed) { crashed = false; v = C.START_SPEED_KMH / 3.6; }
      } else {
        v = Math.min(vmax, v + C.G_SLOPE * (1 - (v / vmax) ** 2) * dt);
        const yNew = y + v * dt;
        if (crashAt > 0 && y < crashAt && yNew >= crashAt && crashes === 0) { crashes++; crashed = t + pause; v = 0; console.log(`[bot] Sturz bei ${crashAt} m`); }
        if (yNew >= target) { fin = Math.round((t - (yNew - target) / v) * 100) / 100; y = target; done = 1; }
        else y = yNew;
      }
      const x = 4 * Math.sin(y / 60), th = Math.atan2(4 * Math.cos(y / 60) / 60 * v, v) || 0;
      const body = { t: Math.round(t * 100) / 100, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, th: Math.round(th * 1000) / 1000, v: Math.round(v * 100) / 100, c: crashes, done, fin, p: 0, at: SV };
      const res = await room.patch(`live/${role}`, body, true);
      if (!res.ok) console.log('[bot] senden:', res.status);
    }
    console.log(`[bot] im Ziel nach ${fin} s (${crashes} Stürze)`);
  }
})().catch((err) => { console.error(err); process.exit(1); });
