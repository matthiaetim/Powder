// DOM-HUD: Tempo, Distanz, Pause, Fresh-Seite mit Modus-Karten, Debug-Text.
import { C, VERSION } from './constants.js';
import { overlayReady, togglePause, fresh, selectMode } from './game.js';
import { MODES } from './modes.js';
import { drawModePreview } from './render.js';

export function createHud(g, doc) {
  const $ = (id) => doc.getElementById(id);
  const speedEl = $('hud-speed'), distEl = $('hud-dist');
  const deadDist = $('dead-dist'), deadBest = $('dead-best'), debugEl = $('debug');
  $('version').textContent = 'v' + VERSION;
  const nf = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 0 });
  let lastSpeed = -1, lastDist = -1, lastState = '', lastOverlay = '', lastDebug = 0;

  $('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); togglePause(g); });
  $('ov-pause').addEventListener('click', () => togglePause(g));
  $('btn-fresh').addEventListener('click', () => fresh(g));
  if (g.debug) debugEl.hidden = false;

  // Modus-Karten: Vorschau einmal zeichnen, aktive Karte markieren, Tipp startet
  const cards = Array.from(doc.querySelectorAll('.mode-card'));
  for (const card of cards) {
    const id = card.dataset.mode;
    const m = MODES[id];
    drawModePreview(card.querySelector('.mode-preview'), id);
    card.querySelector('.mode-cta').textContent = m && m.soon ? 'bald' : 'Tap to play';
    card.addEventListener('click', () => {
      if (!m || m.soon) return;
      if (id === g.mode) { fresh(g); return; }
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
        `${R.frameMs.toFixed(1)} ms/frame  ${R.W}x${R.H}@${R.dpr}  S=${R.S.toFixed(2)} px/m`,
        `state=${g.state}  mode=${g.mode}  intro=${g.intro}  seed=${g.seed}  runs=${g.runs}`,
        `v=${s.v.toFixed(1)} m/s  θ=${deg(s.theta)}°  base=${deg(s.thetaBase)}°  carve=${deg(s.thetaCarve)}°`,
        `air=${s.airborne}  cooldown=${s.jumpCooldown.toFixed(2)}`,
        `gap=${g.av.gap.toFixed(1)} m  lawine=${g.av.speed.toFixed(1)} m/s`,
        `objs=${g.world.objCount}  cells=${g.world.cells.size}  track=${g.track.n}`,
        `gesture=${g.lastGesture}`,
      ].join('\n');
    }
  }
  return { sync };
}
