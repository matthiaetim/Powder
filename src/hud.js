// DOM-HUD: Tempo, Distanz, Pause, Fresh-Seite mit Modus-Karten, Debug-Text.
import { C, VERSION } from './constants.js';
import { overlayReady, togglePause, pauseIfRunning, fresh, selectMode } from './game.js';
import { createTunePanel, isTuned } from './tune.js';
import { MODES } from './modes.js';
import { drawModePreview } from './render.js';

export function createHud(g, doc, hooks = {}) {
  const $ = (id) => doc.getElementById(id);
  const doFresh = hooks.fresh || (() => fresh(g));
  const speedEl = $('hud-speed'), distEl = $('hud-dist');
  const deadDist = $('dead-dist'), deadBest = $('dead-best'), debugEl = $('debug');
  $('version').textContent = 'v' + VERSION;
  const nf = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 0 });
  let lastSpeed = -1, lastDist = -1, lastState = '', lastOverlay = '', lastDebug = 0;

  $('ov-pause').addEventListener('click', () => togglePause(g));
  $('btn-fresh').addEventListener('click', doFresh);
  if (g.debug) debugEl.hidden = false;

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
  $('ov-pause').addEventListener('click', closeTune);

  // Modus-Karten: Vorschau einmal zeichnen, aktive Karte markieren, Tipp startet
  const cards = Array.from(doc.querySelectorAll('.mode-card'));
  for (const card of cards) {
    const id = card.dataset.mode;
    const m = MODES[id];
    drawModePreview(card.querySelector('.mode-preview'), id);
    card.querySelector('.mode-cta').textContent = m && m.soon ? 'bald' : 'Tap to play';
    card.addEventListener('click', () => {
      if (!m || m.soon) return;
      if (id === g.mode) { doFresh(); return; }
      if (selectMode(g, id)) markActive();
    });
  }
  function markActive() {
    for (const card of cards) card.classList.toggle('active', card.dataset.mode === g.mode);
  }
  markActive();

  function sync(now, R, force) {
    const kmh = Math.round(g.skier.v * 3.6);
    if (kmh !== lastSpeed) { lastSpeed = kmh; speedEl.textContent = nf.format(kmh) + ' km/h'; }
    const m = Math.floor(g.dist);
    if (m !== lastDist) { lastDist = m; distEl.textContent = nf.format(m) + ' m'; }
    if (g.state !== lastState) {
      lastState = g.state;
      doc.body.dataset.state = g.state;
      doc.body.dataset.intro = g.state === 'ready' && g.intro ? '1' : '';
    }
    const ov = overlayReady(g) ? '1' : '';
    if (ov !== lastOverlay) {
      lastOverlay = ov;
      doc.body.dataset.overlay = ov;
      if (ov) {
        deadDist.textContent = nf.format(m) + ' m';
        deadBest.textContent = g.newBest ? 'Neuer Rekord' : 'Bester Lauf ' + nf.format(g.best) + ' m';
        markActive();
      }
    }
    if (g.debug && (force || now - lastDebug > 250)) {
      lastDebug = now;
      const s = g.skier;
      const deg = (r) => (r * 180 / Math.PI).toFixed(0);
      debugEl.textContent = [
        `${R.frameMs.toFixed(1)} ms/frame  ${R.W}x${R.H}@${R.dpr}  S=${R.S.toFixed(2)} px/m  zoom=${g.zoom.toFixed(2)}  frac=${g.skierFrac.toFixed(2)}`,
        `state=${g.state}  mode=${g.mode}  intro=${g.intro}  seed=${g.seed}  runs=${g.runs}`,
        `v=${s.v.toFixed(1)} m/s (${Math.round(s.v * 3.6)} km/h)  θ=${deg(s.theta)}°  brake=${s.brake.toFixed(1)}  side=${s.side}${s.plow ? '  PFLUG' : ''}`,
        `tap=${C.TURN_TAP_DEG}°+${C.TURN_DEEPEN_DEG_S}°/s  T=${C.TURN_T}-${C.TURN_T_FAST}/${C.RETURN_T}s  target=${deg(s.target)}°  brake=turn ${C.TURN_BRAKE_K} + ${C.BRAKE_K}@${C.BRAKE_START_DEG}-${C.BRAKE_FULL_DEG}° + plow ${C.PLOW_MIN}  g=${C.G_SLOPE}  v0=${C.START_SPEED_KMH}  vmax=${C.MAX_SPEED_KMH}`,
        g.mode === 'chase' ? `gap=${g.av.gap.toFixed(1)} m  lawine=${g.av.speed.toFixed(1)} m/s` : 'lawine: aus (Classic)',
        `objs=${g.world.objCount}  cells=${g.world.cells.size}  track=${g.track.n}`,
        `gesture=${g.lastGesture}`,
      ].join('\n');
    }
  }
  return { sync };
}
