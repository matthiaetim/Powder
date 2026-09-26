// Ton: alles synthetisch über die Web Audio API, keine Audiodateien. Vier Gruppen mit eigenem Regler im Tuning:
// Wind (Bergwind als ständiges Grundrauschen mit Böen und Pfeifen, Fahrtwind mit dem Tempo), Ski (Schneezischen mit
// dem Tempo, Kante beim Carven, Kratzen mit Rattern beim Bremsen, im Pflug lauter und tiefer, Zischen beim Antippen
// und Loslassen), Lawine
// (Grollen, das mit der Nähe lauter und heller wird, Bass, Knacken, Zischen ganz nah, Krachen beim Losbrechen)
// und Aufprall (kurzer dumpfer Schlag, an der Lawine schwerer). Super-G hat einen eigenen Bus: Pieptöne des
// Countdowns, Fähnchen beim Durchfahren, Buzzer beim Torfehler, Klacken an der Stange, Doppelton im Ziel.
// iOS gibt Ton erst nach einer Berührung frei: der Kontext entsteht beim ersten Tipp, davor bleibt alles still.
// Der Klingelschalter gilt wie bei nativen Spielen: steht er auf lautlos, bleibt die App stumm.
import { C } from './constants.js';
import { loadSoundOn, saveSoundOn } from './storage.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const LOOP_S = 4; // Länge der Rauschschleifen in s
// Der Begrenzer (DynamicsCompressor) hebt alles um seine Ausgleichsverstärkung an, bei den Werten unten ≈ 1,2×;
// der Trim gleicht das aus, damit SND_MASTER 1 wirklich Vollpegel heißt.
const MASTER_TRIM = 0.82;

export function createSound(g) {
  let ctx = null;
  let on = loadSoundOn();
  let muteTimer = 0;
  const n = {};               // Knoten des Klanggraphen
  const last = new Map();     // zuletzt gesetzter Zielwert je AudioParam (spart Automationsereignisse)
  const dbg = { rush: 0, hiss: 0, scrape: 0, rumble: 0 };
  let prevBreaks = 0, crackleAcc = 0, lastSwish = -1, lastFrame = 0;

  // ---------- Bausteine ----------

  const gain = (v) => { const x = ctx.createGain(); x.gain.value = v; return x; };
  const filt = (type, f, q) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  const osc = (type, f) => { const x = ctx.createOscillator(); x.type = type; x.frequency.value = f; x.start(); return x; };
  const chain = (...nodes) => { for (let i = 1; i < nodes.length; i++) nodes[i - 1].connect(nodes[i]); return nodes[nodes.length - 1]; };
  // Langsame Schwingung auf einen Parameter: addiert ±depth auf dessen Grundwert
  const lfo = (hz, depth, param) => { const d = gain(depth); osc('sine', hz).connect(d); d.connect(param); };

  function set(param, value, tau) {
    const prev = last.get(param);
    if (prev !== undefined && Math.abs(prev - value) <= 1e-4 * (1 + Math.abs(value))) return;
    last.set(param, value);
    param.setTargetAtTime(value, ctx.currentTime, tau);
  }

  // Rauschschleife: weiß, rosa (Kellet) oder braun (Zufallsweg, am Ende auf den Anfang zurückgeführt: kein Knacken am Nahtpunkt)
  function makeNoise(kind) {
    const len = Math.round(LOOP_S * ctx.sampleRate);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856; b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      let b = 0;
      for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = b * 3.5; }
      const tilt = d[len - 1] - d[0];
      for (let i = 0; i < len; i++) d[i] -= (tilt * i) / (len - 1);
    }
    return buf;
  }

  function loop(buf) {
    const s = ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(0, Math.random() * LOOP_S);
    return s;
  }

  // Einmal-Klang aus Rauschen: Filter, Hüllkurve (Anstieg, Abfall), Ziel-Bus. Räumt sich selbst auf.
  function shot(bus, type, f, q, peak, attack, decay, tune) {
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = n.white;
    src.start(t0, Math.random() * (LOOP_S - 1));
    const fl = filt(type, f, q);
    const gn = gain(0);
    envelope(gn.gain, t0, peak, attack, decay);
    if (tune) tune(fl, t0);
    chain(src, fl, gn, bus);
    src.stop(t0 + attack + decay + 0.05);
    src.onended = () => { src.disconnect(); fl.disconnect(); gn.disconnect(); };
  }

  function envelope(param, t0, peak, attack, decay) {
    param.cancelScheduledValues(t0);
    param.setValueAtTime(0.0001, t0);
    param.linearRampToValueAtTime(peak, t0 + attack);
    param.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // Sinkender Ton (Aufprall): Frequenz fällt exponentiell, Lautstärke klingt ab
  function thud(bus, type, f0, f1, fallS, peak, decay) {
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    o.frequency.exponentialRampToValueAtTime(f1, t0 + fallS);
    const gn = gain(0);
    envelope(gn.gain, t0, peak, 0.004, decay);
    chain(o, gn, bus);
    o.start(t0);
    o.stop(t0 + decay + 0.05);
    o.onended = () => { o.disconnect(); gn.disconnect(); };
  }

  // ---------- Klanggraph ----------

  function build() {
    n.master = gain(0);
    // Begrenzer: greift erst knapp unter Vollpegel, damit Lawine plus Aufprall nicht übersteuern
    n.comp = ctx.createDynamicsCompressor();
    n.comp.threshold.value = -3; n.comp.knee.value = 3; n.comp.ratio.value = 20;
    n.comp.attack.value = 0.002; n.comp.release.value = 0.15;
    n.an = ctx.createAnalyser();
    n.an.fftSize = 1024;
    chain(n.master, n.comp, n.an, ctx.destination);
    for (const b of ['wind', 'ski', 'av', 'fx', 'race']) { n[b] = gain(0); n[b].connect(n.master); }
    n.white = makeNoise('white');
    const pink = makeNoise('pink'), brown = makeNoise('brown');

    // Wind: Bergwind (tiefes Rauschen mit Böen), Pfeifen (schmales Band, das langsam wandert), Fahrtwind (öffnet mit dem Tempo)
    n.gust = gain(1); lfo(0.07, 0.35, n.gust.gain); lfo(0.19, 0.2, n.gust.gain);
    n.amb = gain(0.27);
    chain(loop(pink), filt('lowpass', 380, 0.6), n.amb, n.gust, n.wind);
    n.whistleF = filt('bandpass', 720, 6); lfo(0.05, 180, n.whistleF.frequency); lfo(0.023, 120, n.whistleF.frequency);
    n.whistleG = gain(1); lfo(0.11, 0.6, n.whistleG.gain);
    n.whistleAmp = gain(0.18);
    chain(loop(n.white), n.whistleF, n.whistleAmp, n.whistleG, n.wind);
    n.rushF = filt('lowpass', 250, 0.7);
    n.rush = gain(0);
    chain(loop(pink), n.rushF, n.rush, n.wind);

    // Ski: Zischen (Tempo, beim Carven tiefer und lauter), Kratzen mit Rattern (Kante, Bremsen, Pflug)
    n.hissF = filt('bandpass', 2700, 0.8);
    n.hiss = gain(0);
    chain(loop(n.white), n.hissF, n.hiss, n.ski);
    n.scrapeF = filt('bandpass', 1100, 1.4);
    n.scrape = gain(0);
    n.chatter = gain(1); n.chatterDepth = gain(0);
    osc('sawtooth', 27).connect(n.chatterDepth); n.chatterDepth.connect(n.chatter.gain);
    chain(loop(n.white), n.scrapeF, n.scrape, n.chatter, n.ski);

    // Lawine: Grollen (braunes Rauschen, das rollt), Bass, Zischen ganz nah
    n.rumbleF = filt('lowpass', 90, 0.8);
    n.rumble = gain(0);
    n.roll = gain(1); lfo(0.37, 0.3, n.roll.gain); lfo(1.7, 0.12, n.roll.gain);
    chain(loop(brown), n.rumbleF, n.rumble, n.roll, n.av);
    n.subO = osc('sine', 46); lfo(0.35, 4, n.subO.frequency);
    n.sub = gain(0);
    chain(n.subO, n.sub, n.av);
    n.avHissF = filt('bandpass', 1800, 0.6);
    n.avHiss = gain(0);
    chain(loop(n.white), n.avHissF, n.avHiss, n.av);
  }

  // Ton mit fester Höhe (Countdown, Torfehler, Ziel): kurzer Anstieg, gehalten, kurzer Abfall. delay schiebt den
  // Start nach hinten, für Doppeltöne aus einem Ereignis.
  function tone(bus, type, f, dur, peak, delay = 0) {
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const gn = gain(0);
    const p = gn.gain;
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(peak, t0 + 0.006);
    p.setValueAtTime(peak, t0 + Math.max(0.006, dur - 0.03));
    p.exponentialRampToValueAtTime(0.0001, t0 + dur);
    chain(o, gn, bus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    o.onended = () => { o.disconnect(); gn.disconnect(); };
  }

  // ---------- Einmal-Klänge ----------

  // Zischen beim Antippen (kräftig) und Loslassen (leise): Band fällt von hell nach dunkel
  function swish(v, soft) {
    const t = ctx.currentTime;
    if (t - lastSwish < 0.1) return;
    lastSwish = t;
    const k = clamp(v / 18, 0, 1);
    const peak = (soft ? 0.25 : 0.7) * (0.35 + 0.65 * k);
    shot(n.ski, 'bandpass', 1600 + 1400 * k, 1.1, peak, 0.02, 0.26, (fl, t0) => {
      fl.frequency.exponentialRampToValueAtTime(420, t0 + 0.24);
    });
  }

  // Aufprall: kurz und dumpf. Baum mit knappem Knacken, Fels mit Klonk, Lawine schwerer und länger.
  function crash(cause, v) {
    const k = clamp(v / 25, 0.4, 1);
    const heavy = cause === 'avalanche';
    thud(n.fx, 'sine', heavy ? 110 : 150, heavy ? 28 : 38, heavy ? 0.35 : 0.14, 0.85 * k, heavy ? 0.6 : 0.3);
    thud(n.fx, 'triangle', heavy ? 170 : 230, 70, 0.1, 0.35 * k, heavy ? 0.25 : 0.14);
    shot(n.fx, 'lowpass', heavy ? 240 : 380, 1, 1.6 * k, 0.003, heavy ? 0.35 : 0.13);
    if (cause === 'tree') shot(n.fx, 'bandpass', 1400, 2, 0.5 * k, 0.002, 0.035);
    if (cause === 'rock') shot(n.fx, 'lowpass', 700, 1.5, 0.6 * k, 0.003, 0.06);
  }

  // Lawine bricht los (nach Stillstand): fernes Krachen mit tiefem Nachhall
  function boom() {
    shot(n.av, 'lowpass', 220, 0.9, 3, 0.01, 0.6);
    shot(n.av, 'bandpass', 600, 1.5, 0.6, 0.004, 0.09);
    thud(n.av, 'sine', 90, 30, 0.4, 0.7, 0.7);
  }

  // Knacken in der Lawine: kurze zufällige Schläge
  function crackle(level) {
    shot(n.av, 'bandpass', 250 + Math.random() * 500, 2 + Math.random() * 3, level * (0.3 + Math.random() * 0.7), 0.004, 0.03 + Math.random() * 0.07);
  }

  // ---------- Freigabe, Ein/Aus ----------

  function unlock() {
    if (ctx) {
      if (on && ctx.state !== 'running') ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ctx = new AC({ latencyHint: 'interactive' }); } catch { try { ctx = new AC(); } catch { return; } }
    build();
    // Ein stummer Puffer weckt die Ausgabe (iOS spielt sonst manchmal erst nach dem zweiten Tipp)
    const kick = ctx.createBufferSource();
    kick.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    kick.connect(ctx.destination);
    kick.start(0);
    if (on) ctx.resume().catch(() => {}); else ctx.suspend().catch(() => {});
  }
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else if (on) ctx.resume().catch(() => {});
  });

  function setOn(next) {
    on = !!next;
    saveSoundOn(on);
    clearTimeout(muteTimer);
    if (!ctx) return;
    if (on) {
      ctx.resume().catch(() => {});
      set(n.master.gain, C.SND_MASTER * MASTER_TRIM, 0.08);
    } else {
      set(n.master.gain, 0, 0.05);
      muteTimer = setTimeout(() => { if (!on && ctx) ctx.suspend().catch(() => {}); }, 400);
    }
  }

  // ---------- Ereignisse aus dem Spiel ----------

  function event(type, d) {
    if (!ctx || !on) return;
    const s = g.skier;
    switch (type) {
      case 'press': if (g.state === 'running') swish(s.v, false); break;
      case 'plow': if (d && g.state === 'running') swish(s.v * 0.6, false); break;
      case 'release': if (g.state === 'running' && s.carve > 0.25 && s.v > 3) swish(s.v, true); break;
      case 'crash': crash(d.cause, d.v); break;
      // Super-G
      case 'beep': if (d.go) tone(n.race, 'sine', 1175, 0.4, 0.5); else tone(n.race, 'sine', 880, 0.1, 0.4); break;
      case 'gate':
        if (d.ok) shot(n.race, 'bandpass', 900, 1.2, 0.3, 0.004, 0.07); // das Fähnchen schlägt kurz
        else { tone(n.race, 'square', 220, 0.12, 0.2); tone(n.race, 'square', 220, 0.12, 0.2, 0.17); } // Buzzer
        break;
      case 'pole': shot(n.race, 'bandpass', 1400, 3, 0.6, 0.002, 0.05); thud(n.race, 'triangle', 700, 250, 0.05, 0.3, 0.08); break;
      case 'finish': tone(n.race, 'sine', 660, 0.15, 0.45); tone(n.race, 'sine', 990, 0.4, 0.45, 0.17); break;
      // Gipfel (Classic, Everest-Höhe): Dreiklang aufwärts, verwandt mit dem Zielton, deshalb in derselben Gruppe
      case 'summit': tone(n.race, 'sine', 660, 0.15, 0.4); tone(n.race, 'sine', 830, 0.15, 0.4, 0.15); tone(n.race, 'sine', 990, 0.5, 0.45, 0.3); break;
      default: break;
    }
  }

  // ---------- Jedes Bild: Ziele aus dem Spielzustand ----------

  function update(g, dt) {
    if (!ctx || !on || ctx.state !== 'running') return;
    const s = g.skier, av = g.av;
    const running = g.state === 'running';
    const moving = running || g.state === 'finished'; // Auslauf nach dem Ziel (Super-G) klingt aus
    const v = moving ? s.v : 0;
    const k = clamp(v / (C.SND_SPEED_REF_KMH / 3.6), 0, 1); // Tempo 0..1
    const move = clamp(v / 10, 0, 1);
    const carve = moving ? s.carve : 0;
    const skid = moving ? clamp(s.brake / 28, 0, 1) : 0;
    const plow = moving ? s.plowK * move : 0; // Schneepflug: schiebt und kratzt, nur mit Fahrt

    set(n.master.gain, C.SND_MASTER * MASTER_TRIM, 0.1);
    set(n.wind.gain, C.SND_WIND, 0.05);
    set(n.ski.gain, C.SND_SKI, 0.05);
    set(n.av.gain, C.SND_AV, 0.05);
    set(n.fx.gain, C.SND_CRASH, 0.05);
    set(n.race.gain, C.SND_RACE, 0.05);

    // Wind: Fahrtwind öffnet und wächst mit dem Tempo, der Bergwind bleibt, auf der Fresh-Seite etwas leiser
    dbg.rush = Math.pow(k, 0.9);
    set(n.rush.gain, dbg.rush, 0.12);
    set(n.rushF.frequency, 250 + 2800 * k, 0.15);
    set(n.amb.gain, g.state === 'dead' ? 0.17 : 0.27, 0.5);

    // Ski: Zischen mit dem Tempo, beim Carven tiefer und lauter; Kratzen aus Kante, Bremse und Pflug, Rattern beim Rutschen
    dbg.hiss = 0.34 * Math.pow(k, 1.2) * (1 + 0.5 * carve);
    set(n.hiss.gain, dbg.hiss, 0.08);
    set(n.hissF.frequency, 2700 - 1000 * carve, 0.1);
    dbg.scrape = Math.min(0.9, (0.45 * carve + 0.7 * skid) * move * 0.8 + 0.55 * plow);
    set(n.scrape.gain, dbg.scrape, 0.06);
    set(n.scrapeF.frequency, 1100 - 500 * skid - 350 * plow, 0.08);
    set(n.chatterDepth.gain, 0.75 * Math.max(skid, plow), 0.08);

    // Lawine: nur im Modus Lawine, solange sie rollt (Lauf oder Erwischt-Moment); nach dem Erwischen klingt sie aus
    const chase = g.mode === 'chase' && (running || (g.state === 'dead' && g.deadCause === 'avalanche'));
    let near = 0, threat = 0;
    if (chase) {
      near = av.near; threat = av.threat;
      if (g.state === 'dead') { const f = clamp(1 - (g.deadT - 0.9) / 2.4, 0, 1); near *= f; threat *= f; }
      if (running && av.breaks > prevBreaks) boom(); // die Front springt an den Bildrand: Losbrechen
    }
    prevBreaks = av.breaks;
    dbg.rumble = 0.85 * Math.pow(near, 1.1);
    set(n.rumble.gain, dbg.rumble, 0.15);
    set(n.rumbleF.frequency, 90 + 330 * threat, 0.2);
    set(n.sub.gain, 0.15 * Math.pow(threat, 1.5), 0.15);
    set(n.avHiss.gain, 0.3 * threat * threat, 0.12);
    if (threat > 0.05) {
      crackleAcc += (2 + 14 * threat) * dt;
      while (crackleAcc >= 1) { crackleAcc -= 1; crackle(0.5 + threat); }
    } else crackleAcc = 0;
    lastFrame = ctx.currentTime;
  }

  // Pegel am Ausgang (Debug): Effektiv- und Spitzenwert des letzten Blocks
  function meter() {
    if (!ctx) return { rms: 0, peak: 0 };
    const buf = new Float32Array(n.an.fftSize);
    n.an.getFloatTimeDomainData(buf);
    let sum = 0, peak = 0;
    for (let i = 0; i < buf.length; i++) { const x = buf[i]; sum += x * x; const a = x < 0 ? -x : x; if (a > peak) peak = a; }
    return { rms: Math.sqrt(sum / buf.length), peak };
  }

  function debugLine() {
    if (!ctx) return 'ton: wartet auf Tipp';
    const m = meter();
    return `ton=${on ? ctx.state : 'aus'}  rms=${m.rms.toFixed(3)}  peak=${m.peak.toFixed(2)}  wind=${dbg.rush.toFixed(2)}  zisch=${dbg.hiss.toFixed(2)}  kratz=${dbg.scrape.toFixed(2)}  grollen=${dbg.rumble.toFixed(2)}  t=${lastFrame.toFixed(1)}`;
  }

  return {
    update, event, meter, debugLine,
    isOn: () => on,
    toggle: () => setOn(!on),
    setOn,
    get ctx() { return ctx; },
    nodes: n,
  };
}
