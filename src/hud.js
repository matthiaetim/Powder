// DOM-HUD: Tempo, Distanz, Pause, Fresh-Seite mit Laufzeit, Bestenliste samt Namensfeld und Modus-Karten, Debug-Text.
// Super-G: dazu die laufende Zeit, Hinweise zu Torfehler und Zwischenzeit, der Countdown in der Bildmitte.
import { C, VERSION } from './constants.js';
import { overlayReady, togglePause, pauseIfRunning, fresh, selectMode, selectRider } from './game.js';
import { createTunePanel, isTuned } from './tune.js';
import { verdictText } from './board.js';
import { MODES, lowerIsBetter } from './modes.js';
import { RIDERS, RIDER_ORDER } from './riders.js';
import { drawModePreview, drawRiderPreview } from './render.js';

const pad2 = (n) => String(n).padStart(2, '0');

// Laufzeit: unter einer Minute „43,27 Sekunden“, sonst „1:34:07 Minuten“ (Minuten:Sekunden:Hundertstel).
export function formatRunTime(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  const hh = pad2(cs % 100);
  const total = Math.floor(cs / 100);
  const m = Math.floor(total / 60), s = total % 60;
  return m === 0 ? `${s},${hh} Sekunden` : `${m}:${pad2(s)}:${hh} Minuten`;
}

// Uhr im Super-G: „41,27“ (Hundertstel), ab einer Minute „1:02,47“; mit unit hängt unter einer Minute „ s“ an.
export function formatClock(sec, unit) {
  const cs = Math.max(0, Math.round(sec * 100));
  const hh = pad2(cs % 100);
  const total = Math.floor(cs / 100);
  const m = Math.floor(total / 60), s = total % 60;
  if (m > 0) return `${m}:${pad2(s)},${hh}`;
  return `${s},${hh}${unit ? ' s' : ''}`;
}

export function createHud(g, doc, hooks = {}) {
  const $ = (id) => doc.getElementById(id);
  const doFresh = hooks.fresh || (() => fresh(g));
  const speedEl = $('hud-speed'), distEl = $('hud-dist'), timeEl = $('hud-time'), raceNoteEl = $('hud-note');
  const countEl = $('ov-count'), hintEl = $('hint');
  const deadDist = $('dead-dist'), deadTime = $('dead-time'), deadBest = $('dead-best'), debugEl = $('debug');
  const themeEl = doc.querySelector('meta[name="theme-color"]'); // färbt die iOS-Statusleiste (Safari-Tab) mit
  $('version').textContent = 'v' + VERSION;
  const nf = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(C.HUD_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hintDefault = hintEl.textContent;
  let lastSpeed = -1, lastDist = -1, lastTime = '', lastState = '', lastOverlay = '', lastDebug = 0, lastText = -1e9;
  let lastMode = '', lastNote = '', lastCount = '';

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
  const markTuned = () => {
    versionEl.classList.toggle('tuned', isTuned());
    if (g.state === 'running' || g.state === 'paused') g.runTainted = true; // mitten im Lauf verstellt: zählt nicht online (board.js)
    if (hooks.onTune) hooks.onTune();
  };
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

  // Fresh-Seite: Ergebnis des Laufs nach runMode (Meter und Laufzeit; im Super-G Zeit und Tore), darunter der
  // Bestwert des gewählten Modus (ein Kartenwechsel ruft erneut auf): Bestzeit im Super-G, sonst Meter
  function refreshDead() {
    const cs = g.course;
    if (g.runMode === 'superg' && g.state === 'finished') {
      deadDist.textContent = formatClock(cs.total, true);
      deadTime.textContent = cs.misses === 0
        ? `alle ${nf.format(cs.gates.length)} Tore`
        : `${cs.misses === 1 ? '1 Tor' : nf.format(cs.misses) + ' Tore'} verpasst · +${nf1.format(cs.penalty)} s`;
    } else {
      deadDist.textContent = nf.format(Math.floor(g.dist)) + ' m';
      deadTime.textContent = g.runMode === 'superg' ? 'kein Ziel' : 'in ' + formatRunTime(g.runT);
    }
    if (g.mode === 'superg') {
      deadBest.textContent = g.newBestTime && g.mode === g.runMode ? 'Neue Bestzeit'
        : g.bestTime > 0 ? 'Bestzeit ' + formatClock(g.bestTime / 100, true) : 'Noch keine Bestzeit';
    } else {
      deadBest.textContent = g.newBest && g.mode === g.runMode ? 'Neuer Rekord' : 'Bester Lauf ' + nf.format(g.best) + ' m';
    }
  }

  // Hinweis im HUD (Super-G): Torfehler mit Strafe, Zwischenzeit als Differenz zur Bestzeit oder als Zeit
  function noteText(n) {
    if (n.kind === 'miss') return `Torfehler +${nf1.format(n.value)} s`;
    if (n.kind === 'split') return formatClock(n.value, true);
    return (n.value < 0 ? '−' : n.value > 0 ? '+' : '±') + nf2.format(Math.abs(n.value)) + ' s';
  }

  // Modus-Karten: Vorschau zeichnen (neu, wenn der Fahrer wechselt), aktive Karte markieren, Tipp startet
  const cards = Array.from(doc.querySelectorAll('#modes .mode-card'));
  const drawModes = () => { for (const card of cards) drawModePreview(card.querySelector('.mode-preview'), card.dataset.mode, g.rider); };
  drawModes();
  for (const card of cards) {
    const id = card.dataset.mode;
    const m = MODES[id];
    card.querySelector('.mode-cta').textContent = m && m.soon ? 'bald' : 'Tap to play';
    onTap(card, () => {
      if (!m || m.soon) return;
      if (id === g.mode) { doFresh(); return; }
      if (selectMode(g, id)) { markActive(); refreshDead(); renderBoard(); }
    });
  }
  function markActive() {
    for (const card of cards) card.classList.toggle('active', card.dataset.mode === g.mode);
  }
  markActive();

  // Fahrerwahl: das Icon oben links zeigt den gewählten Fahrer, ein Tipp tauscht die Ergebniskarte gegen die
  // Auswahl. Ein Tipp auf eine Kachel wählt und führt zurück; auch das Icon und „Zurück“ schließen.
  const riderBtn = $('btn-rider'), riderIcon = riderBtn.querySelector('.rider-preview'), ridersEl = $('riders');
  const showRiders = (on) => { doc.body.dataset.riders = on ? '1' : ''; };
  const riderTiles = RIDER_ORDER.map((id) => {
    const tile = doc.createElement('button');
    tile.type = 'button';
    tile.className = 'mode-card';
    tile.dataset.rider = id;
    const cv = doc.createElement('canvas');
    cv.className = 'rider-preview';
    const name = doc.createElement('span');
    name.className = 'mode-name';
    name.textContent = RIDERS[id].name;
    tile.append(cv, name);
    drawRiderPreview(cv, id, 82);
    onTap(tile, () => {
      if (id !== g.rider && selectRider(g, id)) { markRider(); drawModes(); }
      showRiders(false);
    });
    ridersEl.append(tile);
    return tile;
  });
  function markRider() {
    for (const tile of riderTiles) tile.classList.toggle('active', tile.dataset.rider === g.rider);
    drawRiderPreview(riderIcon, g.rider, 40);
  }
  markRider();
  onTap(riderBtn, () => showRiders(doc.body.dataset.riders !== '1'));
  onTap($('btn-rider-back'), () => showRiders(false));

  // Bestenliste (board.js): Top-Zeilen des gewählten Modus, die eigene Zeile trägt das Namensfeld. Ohne Namen steht
  // nur das Feld da, zentriert und unterstrichen; mit Namen wird es zur Namenszelle, ein Tipp darauf öffnet die
  // Tastatur nativ (programmatischer Fokus aus pointerup heraus ist auf iOS unzuverlässig).
  // Der Wert m ist je Modus Meter oder (Super-G) die Gesamtzeit in Hundertstel, die Spalte zeigt entsprechend.
  const board = hooks.board;
  const boardOn = !!(board && board.enabled);
  const boardEl = $('board'), rowsEl = $('board-rows'), moreEl = $('board-more'), noteEl = $('board-note');
  const ownRow = boardEl.querySelector('.board-own'), nameInput = $('board-name');
  const ownRank = ownRow.querySelector('.board-rank'), ownM = ownRow.querySelector('.board-m');
  doc.body.dataset.board = boardOn ? '1' : '';
  const scoreText = (m) => (lowerIsBetter(g.mode) ? formatClock(m / 100, true) : nf.format(m) + ' m');
  const rowEl = (rank, name, m) => {
    const row = doc.createElement('div');
    row.className = 'board-row';
    for (const [cls, text] of [['board-rank', rank], ['board-name', name], ['board-m', scoreText(m)]]) {
      const span = doc.createElement('span');
      span.className = cls;
      span.textContent = text;
      row.append(span);
    }
    return row;
  };
  function renderBoard() {
    if (!boardOn || doc.activeElement === nameInput) return; // ohne Server bleibt #board hidden; nicht unter den Fingern umbauen
    boardEl.hidden = false;
    const name = board.name();
    boardEl.dataset.named = name ? '1' : '';
    rowsEl.replaceChildren();
    moreEl.after(ownRow);
    moreEl.hidden = true;
    nameInput.value = name;
    if (!name) { noteEl.textContent = 'für die Bestenliste'; return; }
    const v = board.view(g.mode);
    for (const e of v.top) {
      if (!e.own) { rowsEl.append(rowEl(e.rank, e.name, e.m)); continue; }
      rowsEl.append(ownRow);
      ownRank.textContent = e.rank;
      ownM.textContent = scoreText(e.m);
    }
    if (!v.ownInTop) {
      // Eigener Eintrag unter den Top-Zeilen mit Rang, oder noch nicht auf dem Server: dann der lokale Bestwert ohne
      // Rang (im Super-G ohne Bestzeit ein Strich)
      moreEl.hidden = !v.own;
      ownRank.textContent = v.own ? v.own.rank : '–';
      const local = lowerIsBetter(g.mode) ? g.bestTime : g.best;
      ownM.textContent = v.own ? scoreText(v.own.m) : local > 0 ? scoreText(local) : '–';
    }
    const verdict = board.lastVerdict();
    noteEl.textContent = verdict ? verdictText(verdict) : board.stale() ? 'Letzter bekannter Stand' : '';
  }
  if (boardOn) {
    let nameBefore = '';
    nameInput.addEventListener('focus', () => { nameBefore = nameInput.value; });
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
      else if (e.key === 'Escape') { nameInput.value = nameBefore; nameInput.blur(); }
    });
    // iOS „Fertig“ wie ein Tipp daneben enden im blur: hier wird gespeichert, Ungültiges fällt auf den alten Namen zurück
    nameInput.addEventListener('blur', () => {
      if (!board.setName(nameInput.value)) nameInput.value = board.name();
      renderBoard();
    });
    board.onChange(() => { if (doc.body.dataset.overlay === '1') { refreshDead(); renderBoard(); } });
  }

  function sync(now, R, force) {
    const m = Math.floor(g.dist);
    const cs = g.course;
    // Tempo und Distanz nur alle HUD_TEXT_MS schreiben: jede Textänderung kostet Layout und Neuzeichnen des HUD
    if (force || now - lastText >= C.HUD_TEXT_MS) {
      lastText = now;
      const kmh = Math.round(g.skier.v * 3.6);
      if (kmh !== lastSpeed) { lastSpeed = kmh; speedEl.textContent = nf.format(kmh) + ' km/h'; }
      if (m !== lastDist) { lastDist = m; distEl.textContent = nf.format(m) + ' m'; }
      if (cs) {
        // Wirksame Zeit: Laufzeit plus Strafen, nach dem Ziel die Gesamtzeit
        const txt = formatClock(cs.finished ? cs.total : g.runT + cs.penalty, false);
        if (txt !== lastTime) { lastTime = txt; timeEl.textContent = txt; }
      }
    }
    if (g.mode !== lastMode) {
      lastMode = g.mode;
      doc.body.dataset.mode = g.mode;
      hintEl.textContent = g.mode === 'superg' ? 'Tippen zum Start' : hintDefault;
    }
    if (g.state !== lastState) {
      lastState = g.state;
      doc.body.dataset.state = g.state;
      doc.body.dataset.intro = g.state === 'ready' && g.intro ? '1' : '';
      // Bestwert steht fest: die() bzw. finish() lief im Physikschritt davor
      if ((g.state === 'dead' || g.state === 'finished') && boardOn) board.onRunEnd(g);
    }
    // Hinweis unter dem Fahrer, verschwindet nach SG_NOTE_S (gates.js zählt note.t hoch)
    const note = cs && cs.note && cs.note.t < C.SG_NOTE_S && g.state !== 'finished' ? cs.note : null;
    const noteKey = note ? `${note.kind}:${note.value}` : '';
    if (noteKey !== lastNote) {
      lastNote = noteKey;
      raceNoteEl.className = note ? note.kind : '';
      raceNoteEl.textContent = note ? noteText(note) : '';
    }
    // Countdown 3 · 2 · 1 in der Mitte, nach dem Start kurz „Go“
    let count = '';
    if (g.state === 'count') count = String(Math.max(1, C.SG_COUNT_BEEPS - Math.floor(g.countT / C.SG_COUNT_STEP_S)));
    else if (g.state === 'running' && cs && g.runT < C.SG_GO_SHOW_S) count = 'Go';
    if (count !== lastCount) {
      lastCount = count;
      countEl.textContent = count;
      countEl.classList.toggle('go', count === 'Go');
    }
    const ov = overlayReady(g) ? '1' : '';
    if (ov !== lastOverlay) {
      lastOverlay = ov;
      doc.body.dataset.overlay = ov;
      if (themeEl) themeEl.content = ov ? C.BG_DIM : C.BG;
      if (ov) { refreshDead(); markActive(); renderBoard(); } else showRiders(false);
    }
    if (g.debug && (force || now - lastDebug > 250)) {
      lastDebug = now;
      const s = g.skier, av = g.av;
      const deg = (r) => (r * 180 / Math.PI).toFixed(0);
      debugEl.textContent = [
        `${R.frameMs.toFixed(1)} ms/frame  Takt ${R.paceMs.toFixed(2)} ms  ${R.W}x${R.H}@${R.dpr}  S=${R.S.toFixed(2)} px/m  zoom=${g.zoom.toFixed(2)}  frac=${g.skierFrac.toFixed(2)}`,
        `state=${g.state}  mode=${g.mode}  intro=${g.intro}  seed=${g.seed}  runs=${g.runs}  t=${g.runT.toFixed(1)} s`,
        `v=${s.v.toFixed(1)} m/s (${Math.round(s.v * 3.6)} km/h)  θ=${deg(s.theta)}°  brake=${s.brake.toFixed(1)}  side=${s.side}${s.plow ? '  PFLUG' : ''}`,
        `tap=${C.TURN_TAP_DEG}°+${C.TURN_DEEPEN_DEG_S}°/s  T=${C.TURN_T}-${C.TURN_T_FAST}/${C.RETURN_T}s  target=${deg(s.target)}°  brake=turn ${C.TURN_BRAKE_K} + ${C.BRAKE_K}@${C.BRAKE_START_DEG}-${C.BRAKE_FULL_DEG}° + plow ${C.PLOW_MIN}  g=${C.G_SLOPE}  v0=${C.START_SPEED_KMH}  vmax=${g.mode === 'superg' ? C.SG_MAX_SPEED_KMH : C.MAX_SPEED_KMH}`,
        g.mode === 'chase'
          ? `lawine gap=${av.gap.toFixed(1)} m  v=${(av.speed * 3.6).toFixed(0)} km/h  pace=${(av.pace * 3.6).toFixed(0)} km/h  stall=${av.stallT.toFixed(1)} s  near=${av.near.toFixed(2)}  threat=${av.threat.toFixed(2)}  gnade=${av.mercy.toFixed(2)}`
          : cs
            ? `super-g tor=${cs.next}/${cs.gates.length}  verpasst=${cs.misses}  strafe=${cs.penalty} s  stangen=${cs.hits}  splits=${cs.splits.map((c) => (c / 100).toFixed(2)).join('/')}  best=${(g.bestTime / 100).toFixed(2)} [${g.bestSplits.map((c) => (c / 100).toFixed(2)).join('/')}]  ziel=${cs.finished ? cs.total.toFixed(2) : '-'}`
            : 'lawine: aus (Classic)',
        `objs=${g.world.objCount}  cells=${g.world.cells.size}  track=${g.track.n}`,
        `gesture=${g.lastGesture}`,
        snd ? snd.debugLine() : '',
      ].join('\n');
    }
  }
  return { sync };
}
