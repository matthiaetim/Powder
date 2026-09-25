// DOM-HUD: Tempo, Distanz, Pause, Fresh-Seite mit Laufzeit und Modus-Karten, Debug-Text.
import { C, VERSION } from './constants.js';
import { overlayReady, togglePause, pauseIfRunning, fresh, selectMode } from './game.js';
import { createTunePanel, isTuned } from './tune.js';
import { MODES } from './modes.js';
import { drawModePreview } from './render.js';

const pad2 = (n) => String(n).padStart(2, '0');

// Laufzeit: unter einer Minute „43,27 Sekunden“, sonst „1:34:07 Minuten“ (Minuten:Sekunden:Hundertstel).
export function formatRunTime(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  const hh = pad2(cs % 100);
  const total = Math.floor(cs / 100);
  const m = Math.floor(total / 60), s = total % 60;
  return m === 0 ? `${s},${hh} Sekunden` : `${m}:${pad2(s)}:${hh} Minuten`;
}

export function createHud(g, doc, hooks = {}) {
  const $ = (id) => doc.getElementById(id);
  const doFresh = hooks.fresh || (() => fresh(g));
  const speedEl = $('hud-speed'), distEl = $('hud-dist');
  const deadDist = $('dead-dist'), deadTime = $('dead-time'), deadBest = $('dead-best'), debugEl = $('debug');
  const themeEl = doc.querySelector('meta[name="theme-color"]'); // färbt die iOS-Statusleiste (Safari-Tab) mit
  $('version').textContent = 'v' + VERSION;
  const nf = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 0 });
  let lastSpeed = -1, lastDist = -1, lastState = '', lastOverlay = '', lastDebug = 0, lastText = -1e9;

  // Tipp auf Buttons und Overlay: Maus und Tastatur über click, Touch über pointerup (input.js bricht touchstart
  // gegen die iOS-Lupe ab, dann kommt kein click). Nur wenn der Finger auf dem Element losgelassen wird.
  const onTap = (el, fn) => {
    let touchAt = -1e9;
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'mouse' || !el.contains(doc.elementFromPoint(e.clientX, e.clientY))) return;
      touchAt = performance.now();
      fn();
    });
    el.addEventListener('click', () => { if (performance.now() - touchAt > 500) fn(); });
  };

  onTap($('btn-fresh'), doFresh);
  if (g.debug) debugEl.hidden = false;

  // Ton an/aus auf der Fresh-Seite (audio.js), bleibt gespeichert
  const snd = hooks.sound;
  const soundEl = $('btn-sound');
  const syncSound = () => {
    const on = !snd || snd.isOn();
    soundEl.textContent = on ? 'Ton an' : 'Ton aus';
    soundEl.classList.toggle('off', !on);
  };
  onTap(soundEl, () => { if (snd) { snd.toggle(); syncSound(); } });
  syncSound();

  // Tuning-Panel: langer Druck auf das Versions-Label öffnet es, Spiel pausiert derweil.
  const tuneEl = $('tune');
  const versionEl = $('version');
  const markTuned = () => { versionEl.classList.toggle('tuned', isTuned()); if (hooks.onTune) hooks.onTune(); };
  const tune = createTunePanel(doc, tuneEl, markTuned);
  markTuned();
  let pressTimer = 0;
  const openTune = () => { tune.refresh(); tuneEl.hidden = false; pauseIfRunning(g); };
  const closeTune = () => { tuneEl.hidden = true; };
  versionEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    pressTimer = setTimeout(openTune, 600);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) versionEl.addEventListener(ev, () => clearTimeout(pressTimer));
  tune.closeButton.addEventListener('click', closeTune);
  onTap($('ov-pause'), () => { togglePause(g); closeTune(); });

  // Fresh-Seite: Meter und Laufzeit des letzten Laufs, Bestwert des gewählten Modus
  function refreshDead() {
    deadDist.textContent = nf.format(Math.floor(g.dist)) + ' m';
    deadTime.textContent = 'in ' + formatRunTime(g.runT);
    deadBest.textContent = g.newBest && g.mode === g.runMode ? 'Neuer Rekord' : 'Bester Lauf ' + nf.format(g.best) + ' m';
  }

  // Modus-Karten: Vorschau einmal zeichnen, aktive Karte markieren, Tipp startet
  const cards = Array.from(doc.querySelectorAll('.mode-card'));
  for (const card of cards) {
    const id = card.dataset.mode;
    const m = MODES[id];
    drawModePreview(card.querySelector('.mode-preview'), id);
    card.querySelector('.mode-cta').textContent = m && m.soon ? 'bald' : 'Tap to play';
    onTap(card, () => {
      if (!m || m.soon) return;
      if (id === g.mode) { doFresh(); return; }
      if (selectMode(g, id)) { markActive(); refreshDead(); }
    });
  }
  function markActive() {
    for (const card of cards) card.classList.toggle('active', card.dataset.mode === g.mode);
  }
  markActive();

  function sync(now, R, force) {
    const m = Math.floor(g.dist);
    // Tempo und Distanz nur alle HUD_TEXT_MS schreiben: jede Textänderung kostet Layout und Neuzeichnen des HUD
    if (force || now - lastText >= C.HUD_TEXT_MS) {
      lastText = now;
      const kmh = Math.round(g.skier.v * 3.6);
      if (kmh !== lastSpeed) { lastSpeed = kmh; speedEl.textContent = nf.format(kmh) + ' km/h'; }
      if (m !== lastDist) { lastDist = m; distEl.textContent = nf.format(m) + ' m'; }
    }
    if (g.state !== lastState) {
      lastState = g.state;
      doc.body.dataset.state = g.state;
      doc.body.dataset.intro = g.state === 'ready' && g.intro ? '1' : '';
    }
    const ov = overlayReady(g) ? '1' : '';
    if (ov !== lastOverlay) {
      lastOverlay = ov;
      doc.body.dataset.overlay = ov;
      if (themeEl) themeEl.content = ov ? C.BG_DIM : C.BG;
      if (ov) { refreshDead(); markActive(); }
    }
    if (g.debug && (force || now - lastDebug > 250)) {
      lastDebug = now;
      const s = g.skier, av = g.av;
      const deg = (r) => (r * 180 / Math.PI).toFixed(0);
      debugEl.textContent = [
        `${R.frameMs.toFixed(1)} ms/frame  Takt ${R.paceMs.toFixed(2)} ms  ${R.W}x${R.H}@${R.dpr}  S=${R.S.toFixed(2)} px/m  zoom=${g.zoom.toFixed(2)}  frac=${g.skierFrac.toFixed(2)}`,
        `state=${g.state}  mode=${g.mode}  intro=${g.intro}  seed=${g.seed}  runs=${g.runs}  t=${g.runT.toFixed(1)} s`,
        `v=${s.v.toFixed(1)} m/s (${Math.round(s.v * 3.6)} km/h)  θ=${deg(s.theta)}°  brake=${s.brake.toFixed(1)}  side=${s.side}${s.plow ? '  PFLUG' : ''}`,
        `tap=${C.TURN_TAP_DEG}°+${C.TURN_DEEPEN_DEG_S}°/s  T=${C.TURN_T}-${C.TURN_T_FAST}/${C.RETURN_T}s  target=${deg(s.target)}°  brake=turn ${C.TURN_BRAKE_K} + ${C.BRAKE_K}@${C.BRAKE_START_DEG}-${C.BRAKE_FULL_DEG}° + plow ${C.PLOW_MIN}  g=${C.G_SLOPE}  v0=${C.START_SPEED_KMH}  vmax=${C.MAX_SPEED_KMH}`,
        g.mode === 'chase'
          ? `lawine gap=${av.gap.toFixed(1)} m  v=${(av.speed * 3.6).toFixed(0)} km/h  pace=${(av.pace * 3.6).toFixed(0)} km/h  stall=${av.stallT.toFixed(1)} s  near=${av.near.toFixed(2)}  threat=${av.threat.toFixed(2)}`
          : 'lawine: aus (Classic)',
        `objs=${g.world.objCount}  cells=${g.world.cells.size}  track=${g.track.n}`,
        `gesture=${g.lastGesture}`,
        snd ? snd.debugLine() : '',
      ].join('\n');
    }
  }
  return { sync };
}
