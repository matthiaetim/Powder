// Ton: alles synthetisch über die Web Audio API, keine Audiodateien. Vier Gruppen mit eigenem Regler im Tuning:
// Wind (Bergwind als ständiges Grundrauschen mit Böen und Pfeifen, Fahrtwind mit dem Tempo), Ski (Schneezischen mit
// dem Tempo, Kante beim Carven, Kratzen mit Rattern beim Bremsen, im Pflug lauter und tiefer, Zischen beim Antippen
// und Loslassen), Lawine
// (Grollen, das mit der Nähe lauter und heller wird, Bass, Knacken, Zischen ganz nah, Krachen beim Losbrechen)
// und Aufprall (kurzer dumpfer Schlag, an der Lawine schwerer). Super-G hat einen eigenen Bus: Pieptöne des
// Countdowns, Fähnchen beim Durchfahren, Buzzer beim Torfehler, Klacken an der Stange, Doppelton im Ziel.
// Das Zielstadion (Slalom, Super-G) hat den Bus crowd: Publikum als Rauschen mit zwei Formanten, das mit der Stimmung
// anschwillt, Kuhglocken, im Ziel ein Aufbrüllen mit Tröte. Am Starthaus klackt beim Go der Startbügel.
// iOS gibt Ton erst nach einer Berührung frei: der Kontext entsteht beim ersten Tipp, davor bleibt alles still.
// Beim Verlassen der App (Heimgeste, App-Umschalter, Sperrtaste, Tab-Wechsel) blendet der Ton aus, bevor er angehalten
// wird, sonst schnarrt es auf dem iPhone beim Schließen verzerrt (siehe „App verlassen“ unten).
// Piste: Absprung und Landung, Piepton und Auslöser an der Tempomessung, kleine Fanfare für eine Torstrecke ohne
// Fehler; dazu an der Strecke die Hütte (Stimmen, Kuhglocken, Polka), der Lift (Brummen, Klacken der Rollen) und das
// Zischen der Schneekanone, alles lauter, je näher man ist.
// Der Klingelschalter gilt wie bei nativen Spielen: steht er auf lautlos, bleibt die App stumm.
import { C } from './constants.js';
import { loadSoundOn, saveSoundOn } from './storage.js';
import { ambience } from './piste-life.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const LOOP_S = 4; // Länge der Rauschschleifen in s, ganzzahlig lassen (siehe makeNoise)
// Rauschdaten der Schleifen: weiß, rosa (Kellet) oder braun (Zufallsweg, am Ende auf den Anfang zurückgeführt: kein
// Knacken am Nahtpunkt). Sie werden kurz nach dem Laden in Ruhe vorgerechnet, nicht erst beim ersten Tipp: das waren
// rund 576 000 Samples im Berührungs-Handler, der erste Tipp ruckelte spürbar. Gerechnet wird für NOISE_RATE (iPhone).
// Läuft das Gerät langsamer, nimmt makeNoise davon nur die ersten LOOP_S Sekunden (bei 44,1 kHz 176 400 Samples, die
// Färbung liegt dann 8 % tiefer, das hört niemand); läuft es schneller oder kommt der erste Tipp früher, rechnet
// makeNoise selbst.
const NOISE_RATE = 48000;
const noiseData = { white: null, pink: null, brown: null };
let noiseUsed = false;

function genNoise(kind, len = Math.round(LOOP_S * NOISE_RATE)) {
  const d = new Float32Array(len);
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
    closeSeam(d);
  }
  return d;
}

// Braunes Rauschen wandert: das Ende linear auf den Anfang zurückführen, sonst knackt es am Nahtpunkt der Schleife
function closeSeam(d) {
  const len = d.length, tilt = d[len - 1] - d[0];
  for (let i = 0; i < len; i++) d[i] -= (tilt * i) / (len - 1);
}

// Gestaffelt nach den ersten Bildern, je Schleife nur wenige Millisekunden
function prepareNoise() {
  let delay = 250;
  for (const kind of ['white', 'pink', 'brown']) {
    setTimeout(() => { if (!noiseUsed && !noiseData[kind]) noiseData[kind] = genNoise(kind); }, delay);
    delay += 150;
  }
}
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
  let prevBreaks = 0, crackleAcc = 0, lastSwish = -1, lastFrame = 0, bellAcc = 0, polkaAcc = 0, polkaStep = 0, clackAcc = 0;
  const amb = { hut: 0, lift: 0, cannon: 0 }; // Piste: Nähe zu Hütte, Lift und Schneekanone
  let away = false, stopTimer = 0; // App wird verlassen: Ausgang auf null, dann Kontext anhalten
  prepareNoise();

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

  // Rauschschleife aus den vorgerechneten Daten (genNoise); die Kopie wird danach freigegeben. Der Puffer ist genau
  // LOOP_S lang, in Samples der Geräte-Abtastrate. Chromium (gesehen in Version 152) bleibt sonst bei manchen Längen
  // am Schleifenende hängen, etwa bei 192 000 Samples mit 44,1 kHz: Es wiederholt endlos die letzten 128 Samples,
  // hinter einem Tiefpass schaukelt sich das bis NaN auf und der ganze Ton fällt aus.
  function makeNoise(kind) {
    const len = Math.round(LOOP_S * ctx.sampleRate);
    let d = noiseData[kind];
    noiseData[kind] = null;
    noiseUsed = true;
    if (!d || d.length < len) d = genNoise(kind, len);
    else if (d.length > len) { d = d.subarray(0, len); if (kind === 'brown') closeSeam(d); }
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    buf.getChannelData(0).set(d);
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
    // Ausgang hinter dem Begrenzer: nur fürs Verlassen der App, damit update() und Ein/Aus ihn nicht zurückstellen
    n.out = gain(1);
    n.an = ctx.createAnalyser();
    n.an.fftSize = 1024;
    chain(n.master, n.comp, n.out, n.an, ctx.destination);
    for (const b of ['wind', 'ski', 'av', 'fx', 'race', 'crowd']) { n[b] = gain(0); n[b].connect(n.master); }
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

    // Publikum: rosa Rauschen durch zwei Formanten („ah“ und „ey“), wogt langsam
    n.crowdBed = gain(0);
    n.crowdSwell = gain(1); lfo(0.23, 0.18, n.crowdSwell.gain); lfo(0.61, 0.08, n.crowdSwell.gain);
    n.crowdF1 = filt('bandpass', 700, 0.9);
    n.crowdF2 = filt('bandpass', 1900, 1.3);
    const cp = loop(pink);
    cp.connect(n.crowdF1); cp.connect(n.crowdF2);
    n.crowdF1.connect(n.crowdBed); n.crowdF2.connect(n.crowdBed);
    chain(n.crowdBed, n.crowdSwell, n.crowd);

    // Piste: Lift (tiefes Brummen des Antriebs) und Schneekanone (helles Zischen), beide im Wind-Bus
    n.lift = gain(0);
    chain(osc('sawtooth', 58), filt('lowpass', 210, 0.8), n.lift, n.wind);
    n.cannon = gain(0);
    chain(loop(n.white), filt('bandpass', 3600, 0.7), n.cannon, n.wind);
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

  // Kuhglocke: zwei unharmonische Rechtecktöne durch ein Band, kurz und blechern, jede etwas anders gestimmt
  function cowbell(level) {
    const t0 = ctx.currentTime;
    const f = 520 * (0.85 + Math.random() * 0.35);
    const fl = filt('bandpass', 1500 + Math.random() * 600, 1.6);
    const gn = gain(0);
    envelope(gn.gain, t0, level, 0.002, 0.18 + Math.random() * 0.15);
    const oscs = [f, f * 1.48].map((fr) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(fl); o.start(t0); o.stop(t0 + 0.4); return o; });
    chain(fl, gn, n.crowd);
    oscs[0].onended = () => { for (const o of oscs) o.disconnect(); fl.disconnect(); gn.disconnect(); };
  }

  // Im Ziel: das Publikum brüllt auf, zweimal die Tröte
  function roar() {
    shot(n.crowd, 'bandpass', 1100, 0.7, 1.4, 0.25, 2.4);
    shot(n.crowd, 'bandpass', 2600, 1.4, 0.5, 0.2, 1.6);
    for (const d of [0.15, 0.6]) { tone(n.crowd, 'sawtooth', 233, 0.35, 0.07, d); tone(n.crowd, 'sawtooth', 294, 0.35, 0.05, d); }
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
      back(); // eine Berührung heißt: die App ist wieder da, auch wenn iOS kein focus geschickt hat
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
    // Läuft der Kontext wieder (nach Hintergrund, Anruf oder Ton aus), kommt der Ausgang weich zurück
    ctx.onstatechange = () => { if (ctx.state === 'running' && !away) ramp(1, C.SND_BACK_FADE_S); };
    if (on) ctx.resume().catch(() => {}); else ctx.suspend().catch(() => {});
  }
  for (const ev of ['pointerdown', 'touchend', 'keydown', 'click']) window.addEventListener(ev, unlock, { capture: true, passive: true });

  // ---------- App verlassen: ausblenden, dann anhalten ----------

  // Beim Schließen hält iOS die Seite an, während der Ton noch läuft. Was dann noch im Ausgabepuffer steht, spielt das
  // iPhone kurz in Schleife ab: das verzerrte Schnarren beim Schließen, umso lauter, je lauter der Klang gerade war.
  // Ein sofortiges suspend() hilft nicht, es schneidet mitten in der Welle ab und kommt oft erst, wenn iOS schon
  // anhält. Darum geht der Ausgang beim ersten Anzeichen (Fokus weg, Seite versteckt, Seite geht) in SND_LEAVE_FADE_S
  // auf null und erst danach wird angehalten; kommt der Timer nicht mehr dran, steht im Puffer schon Stille.
  function leave() {
    if (!ctx || away) return;
    away = true;
    ramp(0, C.SND_LEAVE_FADE_S);
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => { if (away) ctx.suspend().catch(() => {}); }, (C.SND_LEAVE_FADE_S + C.SND_LEAVE_STOP_S) * 1000);
  }
  // Zurück: läuft der Kontext noch, gleich einblenden, sonst wieder anwerfen und in onstatechange einblenden
  function back() {
    if (!ctx || !away || document.hidden) return;
    away = false;
    clearTimeout(stopTimer);
    if (ctx.state === 'running') ramp(1, C.SND_BACK_FADE_S);
    else if (on) ctx.resume().catch(() => {});
  }
  // Ausgang vom jetzigen Wert linear aufs Ziel. Steht der Kontext, wartet die Rampe und läuft beim Weiterlaufen ab.
  function ramp(to, s) {
    const p = n.out.gain, t = ctx.currentTime;
    p.cancelScheduledValues(t);
    p.setValueAtTime(p.value, t);
    p.linearRampToValueAtTime(to, t + s);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); else back(); });
  window.addEventListener('pagehide', leave);
  window.addEventListener('blur', leave);
  window.addEventListener('pageshow', back);
  window.addEventListener('focus', back);

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
    if (!ctx || !on || away) return; // beim Verlassen keine Einmal-Klänge mehr, sie kämen sonst beim Zurückkommen
    const s = g.skier;
    switch (type) {
      case 'press': if (g.state === 'running') swish(s.v, false); break;
      case 'plow': if (d && g.state === 'running') swish(s.v * 0.6, false); break;
      case 'release': if (g.state === 'running' && s.carve > 0.25 && s.v > 3) swish(s.v, true); break;
      case 'crash': crash(d.cause, d.v); break;
      // Torlauf (Super-G, Slalom)
      case 'beep':
        if (d.go) tone(n.race, 'sine', 1175, 0.4, 0.5); else tone(n.race, 'sine', 880, 0.1, 0.4);
        if (d.go && g.course && g.course.spec.house) shot(n.race, 'bandpass', 2200, 4, 0.6, 0.001, 0.05); // der Startbügel klappt auf
        break;
      case 'gate':
        if (d.ok) shot(n.race, 'bandpass', 900, 1.2, 0.3, 0.004, 0.07); // das Fähnchen schlägt kurz
        else { tone(n.race, 'square', 220, 0.12, 0.2); tone(n.race, 'square', 220, 0.12, 0.2, 0.17); } // Buzzer
        break;
      case 'pole':
        // Kippstange (Slalom): hohles Klacken des Gelenks, kürzer und heller als das Panel im Super-G
        if (d && d.kipp) { shot(n.race, 'bandpass', 2300, 5, 0.5, 0.001, 0.03); thud(n.race, 'triangle', 1100, 420, 0.03, 0.28, 0.05); }
        else { shot(n.race, 'bandpass', 1400, 3, 0.6, 0.002, 0.05); thud(n.race, 'triangle', 700, 250, 0.05, 0.3, 0.08); }
        break;
      // Fangzaun (Slalom, Trichter im Super-G): das Netz fängt dumpf und raschelt nach, lauter bei mehr Tempo
      case 'fence': {
        const k = clamp(d.v / 18, 0.35, 1);
        thud(n.fx, 'sine', 170, 60, 0.12, 0.5 * k, 0.22);
        shot(n.fx, 'bandpass', 1900, 0.8, 0.45 * k, 0.01, 0.25);
        break;
      }
      case 'finish': tone(n.race, 'sine', 660, 0.15, 0.45); tone(n.race, 'sine', 990, 0.4, 0.45, 0.17); if (g.stadium) roar(); break;
      // Gipfel (Classic, Everest-Höhe): Dreiklang aufwärts, verwandt mit dem Zielton, deshalb in derselben Gruppe
      case 'summit': tone(n.race, 'sine', 660, 0.15, 0.4); tone(n.race, 'sine', 830, 0.15, 0.4, 0.15); tone(n.race, 'sine', 990, 0.5, 0.45, 0.3); break;
      // Piste: Absprung (der Schnee reißt ab, Luft rauscht auf), Landung (dumpf, Schnee stiebt)
      case 'jump': {
        const k = d.kind === 1 ? 1 : d.kind === 2 ? 0.35 : 0.65;
        shot(n.ski, 'bandpass', 700, 0.9, 0.7 * k, 0.03, 0.35 + 0.4 * k, (fl, t0) => { fl.frequency.exponentialRampToValueAtTime(2600, t0 + 0.3 + 0.3 * k); });
        break;
      }
      case 'land': {
        const k = d.kind === 1 ? 1 : d.kind === 2 ? 0.3 : 0.6;
        thud(n.fx, 'sine', 130, 48, 0.12, 0.55 * k, 0.22);
        shot(n.ski, 'bandpass', 1500, 0.8, 0.8 * k, 0.005, 0.3, (fl, t0) => { fl.frequency.exponentialRampToValueAtTime(500, t0 + 0.28); });
        break;
      }
      // Tempomessung: Piepton der Lichtschranke, dann der Auslöser der Kamera
      case 'trap':
        tone(n.race, 'sine', 1320, 0.09, 0.35);
        shot(n.race, 'bandpass', 3200, 3, 0.5, 0.001, 0.025);
        shot(n.race, 'bandpass', 2400, 3, 0.4, 0.001, 0.04);
        break;
      // Torstrecke ohne Fehler: kleine Fanfare, mit zurückgewonnenem Sturz ein Ton mehr
      case 'gates':
        tone(n.race, 'sine', 660, 0.12, 0.4); tone(n.race, 'sine', 880, 0.12, 0.4, 0.12); tone(n.race, 'sine', 1100, 0.3, 0.42, 0.24);
        if (d && d.bonus) tone(n.race, 'sine', 1320, 0.4, 0.42, 0.42);
        break;
      // Geheimweg gefunden: zwei helle Töne aufwärts
      case 'secret':
        tone(n.race, 'sine', 880, 0.1, 0.35); tone(n.race, 'sine', 1320, 0.25, 0.35, 0.1);
        break;
      // Slalom-Zweig über der Zeit: zwei fallende Töne
      case 'slalomSlow':
        tone(n.race, 'sine', 520, 0.16, 0.35); tone(n.race, 'sine', 390, 0.3, 0.35, 0.16);
        break;
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
    set(n.crowd.gain, C.SND_CROWD, 0.05);

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

    // Piste: was an der Strecke klingt. Die Hütte nutzt das Publikum des Zielstadions (Stimmen, Kuhglocken), leiser.
    if (g.life && (running || g.state === 'dead' || g.state === 'finished')) ambience(g.life, s, amb);
    else { amb.hut = 0; amb.lift = 0; amb.cannon = 0; }
    set(n.lift.gain, 0.22 * amb.lift * amb.lift, 0.2);
    set(n.cannon.gain, 0.3 * amb.cannon * amb.cannon, 0.2);
    if (amb.lift > 0.15 && g.state !== 'paused') {
      // die Klemmen laufen über die Rollen der Stütze: zwei kurze Schläge, dann Ruhe
      clackAcc += dt;
      if (clackAcc >= 1.1) { clackAcc = 0; for (const dl of [0, 0.14]) { const lv = 0.3 * amb.lift; setTimeout(() => { if (ctx && on && !away) shot(n.wind, 'bandpass', 1700, 6, lv, 0.001, 0.035); }, dl * 1000); } }
    } else clackAcc = 0;
    if (amb.hut > 0.12 && g.state !== 'paused') {
      // Polka aus der Hütte: Bass auf eins und drei, Akkord dazwischen
      polkaAcc += dt;
      if (polkaAcc >= 0.26) {
        polkaAcc = 0;
        const lv = amb.hut * amb.hut, st = polkaStep++ % 8;
        if (st % 2 === 0) tone(n.crowd, 'triangle', st % 4 === 0 ? 110 : 82.4, 0.2, 0.3 * lv);
        else { const root = st < 4 ? 220 : 196; tone(n.crowd, 'square', root * 1.26, 0.09, 0.035 * lv); tone(n.crowd, 'square', root * 1.5, 0.09, 0.035 * lv); }
      }
    } else polkaAcc = 0;

    // Publikum: mit Zielstadion lauter und heller mit der Stimmung, dazu Kuhglocken; an einer Hütte der Piste leise
    const hype = g.stadium ? g.stadium.hype : 0.45 * amb.hut;
    set(n.crowdBed.gain, 0.5 * Math.pow(hype, 1.2), 0.25);
    set(n.crowdF1.frequency, 650 + 250 * hype, 0.3);
    if (hype > 0.1 && g.state !== 'paused') {
      bellAcc += 9 * hype * hype * dt;
      while (bellAcc >= 1) { bellAcc -= 1; cowbell(0.05 + 0.1 * Math.random() * hype); }
    } else bellAcc = 0;
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
