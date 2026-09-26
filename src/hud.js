// DOM-HUD: Tempo, Distanz, Pause, Fresh-Seite mit Laufzeit, Bestenliste samt Namensfeld und Detail-Kachel,
// Moduswahl (drei Vorschauen unter Fresh und Kachel mit allen Modi), Ton-Icon, Debug-Text.
// Super-G: dazu die laufende Zeit, Hinweise zu Torfehler und Zwischenzeit, der Countdown in der Bildmitte.
import { C, VERSION } from './constants.js';
import { overlayReady, togglePause, pauseIfRunning, fresh, selectMode, selectRider } from './game.js';
import { createTunePanel, isTuned } from './tune.js';
import { verdictText } from './board.js';
import { MODES, MODE_ORDER, lowerIsBetter } from './modes.js';
import { RIDERS, RIDER_ORDER } from './riders.js';
import { drawModePreview, drawRiderPreview } from './render.js';
import { loadBest, loadBestTime, loadDuelTally, loadRecentModes } from './storage.js';
import { createDuelCard } from './duel-card.js';

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
  const speedEl = $('hud-speed'), distEl = $('hud-dist'), timeEl = $('hud-time'), raceNoteEl = $('hud-note'), oppEl = $('hud-opp');
  const pauseSub = doc.querySelector('#ov-pause .ov-sub'), pauseDefault = pauseSub ? pauseSub.textContent : '';
  const countEl = $('ov-count'), hintEl = $('hint');
  const deadDist = $('dead-dist'), deadTime = $('dead-time'), deadBest = $('dead-best'), debugEl = $('debug');
  const themeEl = doc.querySelector('meta[name="theme-color"]'); // färbt die iOS-Statusleiste (Safari-Tab) mit
  $('version').textContent = 'v' + VERSION;
  const nf = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 1 });
  const nf2 = new Intl.NumberFormat(C.HUD_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const hintDefault = hintEl.textContent;
  let lastSpeed = -1, lastDist = '', lastTime = '', lastState = '', lastOverlay = '', lastDebug = 0, lastText = -1e9;
  let lastMode = '', lastNote = '', lastCount = '', lastOpp = '';
  const duel = hooks.duel || null;
  const duelOn = !!(duel && hooks.net && hooks.net.enabled);

  // Tipp auf Buttons und Overlay: Maus und Tastatur über click, Touch über pointerup (input.js bricht touchstart
  // gegen die iOS-Lupe ab, dann kommt kein click). Nur wenn der Finger auf dem Element losgelassen wird. fn bekommt
  // das Element unter dem Finger, damit ein Container Tipps auf einzelne Kinder ausnehmen kann.
  const onTap = (el, fn) => {
    let touchAt = -1e9;
    el.addEventListener('pointerup', (e) => {
      const hit = doc.elementFromPoint(e.clientX, e.clientY);
      if (e.pointerType === 'mouse' || !el.contains(hit)) return;
      touchAt = performance.now();
      fn(hit);
    });
    el.addEventListener('click', (e) => { if (performance.now() - touchAt > 500) fn(e.target); });
  };

  onTap($('btn-fresh'), doFresh);
  if (g.debug) debugEl.hidden = false;

  // Ton an/aus: Icon oben rechts auf der Fresh-Seite (audio.js), bleibt gespeichert. Aus: Lautsprecher mit Kreuz.
  const snd = hooks.sound;
  const soundEl = $('btn-sound');
  const syncSound = () => {
    const on = !snd || snd.isOn();
    soundEl.setAttribute('aria-label', on ? 'Ton an' : 'Ton aus');
    soundEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundEl.classList.toggle('off', !on);
  };
  onTap(soundEl, () => { if (snd) { snd.toggle(); syncSound(); } });
  syncSound();

  // Tuning-Panel: langer Druck auf das Versions-Label öffnet es, Spiel pausiert derweil.
  const tuneEl = $('tune');
  const versionEl = $('version');
  const markTuned = (t) => {
    versionEl.classList.toggle('tuned', isTuned());
    // mitten im Lauf verstellt: zählt nicht online (board.js); Regler, die nur das Bild ändern (visual), ausgenommen
    if (!(t && t.visual) && (g.state === 'running' || g.state === 'paused')) g.runTainted = true;
    if (hooks.onTune) hooks.onTune();
  };
  const tune = createTunePanel(doc, tuneEl, markTuned);
  markTuned();
  let pressTimer = 0;
  const openTune = () => {
    if (duel && duel.active()) return; // im Duell stehen die Regler auf Standard, verstellen wäre unfair
    tune.refresh(); tuneEl.hidden = false; pauseIfRunning(g);
  };
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
  // Durchschnittstempo des Laufs wie in der Detail-Kachel (board.js statsFor): Weite durch Laufzeit, im Super-G die
  // Kurslänge durch die reine Fahrzeit ohne Strafen
  const avgText = (meters, sec) => (sec > 0 ? ` · Ø ${nf.format((meters / sec) * 3.6)} km/h` : '');
  function refreshDead() {
    const cs = g.course;
    if (g.runMode === 'superg' && g.state === 'finished') {
      deadDist.textContent = formatClock(cs.total, true);
      deadTime.textContent = (cs.misses === 0
        ? `alle ${nf.format(cs.gates.length)} Tore`
        : `${cs.misses === 1 ? '1 Tor' : nf.format(cs.misses) + ' Tore'} verpasst · +${nf1.format(cs.penalty)} s`)
        + avgText(C.SG_FINISH_M, cs.time);
    } else {
      const m = Math.floor(g.dist);
      deadDist.textContent = nf.format(m) + ' m';
      deadTime.textContent = g.runMode === 'superg' ? 'kein Ziel' : 'in ' + formatRunTime(g.runT) + avgText(m, g.runT);
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

  // Karten statt der Ergebniskarte: Moduswahl ('modes'), Fahrerwahl ('riders') oder Detail-Kachel der Bestenliste
  // ('stats'), immer nur eine
  const showPanel = (name) => { doc.body.dataset.panel = name; };

  // Moduswahl: unter Fresh stehen drei Vorschauen, links immer Classic, daneben die zwei zuletzt gewählten oder
  // gefahrenen Modi (storage.js), fehlen die, die nächsten aus MODE_ORDER. Die gewählte ist gelb, ein Tipp darauf
  // startet Fresh, ein Tipp auf eine andere wählt sie. „Modus auswählen“ öffnet die Kachel „Modus“ mit allen Modi als
  // Zeilen samt persönlichem Bestwert. Die Bestwerte der anderen Modi liegen nur im Storage (g.best gilt für den
  // gewählten), deshalb werden sie beim Öffnen frisch gelesen. Die Vorschauen zeigen den gewählten Fahrer und werden
  // bei einem Fahrerwechsel neu gezeichnet.
  const modesList = $('modes-list');
  const modeOff = (id) => id === 'duel' && !duelOn; // Duell braucht die Datenbank (BOARD_URL)
  const bestText = (id) => {
    if (id === 'duel') {
      if (!duelOn) return 'offline';
      const w = Object.values(loadDuelTally()).reduce((n, e) => n + (e && e.w ? e.w : 0), 0);
      return w > 0 ? (w === 1 ? '1 Sieg' : nf.format(w) + ' Siege') : '–';
    }
    if (MODES[id].board === 'time') { const v = loadBestTime(id); return v > 0 ? formatClock(v / 100, true) : '–'; }
    const v = loadBest(id);
    return v > 0 ? nf.format(v) + ' m' : '–';
  };
  const modeRows = MODE_ORDER.map((id) => {
    const m = MODES[id];
    const row = doc.createElement('button');
    row.type = 'button';
    const off = modeOff(id);
    row.className = 'mode-card mode-row' + (m.soon || off ? ' soon' : '');
    row.dataset.mode = id;
    const cv = doc.createElement('canvas');
    cv.className = 'mode-preview';
    const text = doc.createElement('span');
    text.className = 'mode-text';
    const name = doc.createElement('span');
    name.className = 'mode-name';
    name.textContent = m.name;
    const desc = doc.createElement('span');
    desc.className = 'mode-desc';
    desc.textContent = off ? 'Braucht Internet und die Datenbank.' : m.desc;
    text.append(name, desc);
    const best = doc.createElement('span');
    best.className = 'mode-best';
    row.append(cv, text, best);
    onTap(row, () => {
      if (m.soon || off) return;
      if (id === 'duel') { openDuel(); return; }
      if (id !== g.mode && selectMode(g, id)) { markActive(); refreshDead(); renderBoard(); }
      showPanel('');
    });
    modesList.append(row);
    return row;
  });
  const modesEl = $('modes');
  const cards = [0, 1, 2].map(() => {
    const card = doc.createElement('button');
    card.type = 'button';
    card.className = 'mode-card';
    const cv = doc.createElement('canvas');
    cv.className = 'mode-preview';
    const name = doc.createElement('span');
    name.className = 'mode-name';
    const cta = doc.createElement('span');
    cta.className = 'mode-cta';
    cta.textContent = 'Tap to play'; // nur beim gewählten sichtbar, steht überall, damit die Kärtchen gleich hoch sind
    card.append(cv, name, cta);
    onTap(card, () => {
      const id = card.dataset.mode;
      if (!id || MODES[id].soon || modeOff(id)) return;
      if (id === g.mode) { doFresh(); return; }
      if (id === 'duel') { openDuel(); return; }
      if (selectMode(g, id)) { markActive(); refreshDead(); renderBoard(); }
    });
    modesEl.append(card);
    return card;
  });
  // Belegung der drei Plätze. Beim Wählen bleibt sie stehen, solange der Modus schon zu sehen ist, sonst spränge die
  // getippte Vorschau unter dem Finger auf den mittleren Platz; neu sortiert wird, wenn die Fresh-Seite erscheint.
  function layoutModes(keep) {
    if (keep && cards.some((c) => c.dataset.mode === g.mode)) return;
    const ok = (id) => MODES[id] && !MODES[id].soon && !modeOff(id) && id !== 'classic';
    // der gewählte Modus steht vorn, auch wenn der Speicher fehlt (selectMode merkt ihn sonst ohnehin)
    const ids = ['classic', ...new Set([g.mode, ...loadRecentModes(), ...MODE_ORDER].filter(ok))].slice(0, 3);
    cards.forEach((card, i) => {
      const id = ids[i];
      card.hidden = !id;
      if (!id || card.dataset.mode === id) return;
      card.dataset.mode = id;
      card.querySelector('.mode-name').textContent = MODES[id].name;
      drawModePreview(card.querySelector('.mode-preview'), id, g.rider);
    });
  }
  const drawModes = () => {
    for (const row of modeRows) drawModePreview(row.querySelector('.mode-preview'), row.dataset.mode, g.rider);
    for (const card of cards) if (card.dataset.mode) drawModePreview(card.querySelector('.mode-preview'), card.dataset.mode, g.rider);
  };
  function markActive(keep = true) {
    for (const row of modeRows) row.classList.toggle('active', row.dataset.mode === g.mode);
    layoutModes(keep);
    for (const card of cards) card.classList.toggle('active', card.dataset.mode === g.mode);
  }
  function openModes() {
    for (const row of modeRows) row.querySelector('.mode-best').textContent = bestText(row.dataset.mode);
    showPanel('modes');
  }
  drawModes();
  markActive(false);
  onTap($('btn-modes'), openModes);
  onTap($('btn-modes-back'), () => showPanel(''));

  // Duell (duel.js, duel-card.js): Modus wählen und die Kachel öffnen; im Zustand ready (App-Start mit ?room=CODE)
  // hält hold den Lauf an und zeigt die Fresh-Seite über dem Startbild. Verlassen führt wie ein Zurück auf die Kachel
  // und in den Modus von vorher, ohne einen Lauf zu starten; nur im Zustand ready fährt der wartende Lauf dann los,
  // weil es davor keine Kachel gab.
  let beforeDuel = null; // { mode, panel } beim Öffnen, damit ein zweites openDuel (Fresh, Link) es nicht überschreibt
  function openDuel(code = '') {
    if (!duel) return;
    if (!beforeDuel) beforeDuel = { mode: g.mode === 'duel' ? 'classic' : g.mode, panel: doc.body.dataset.panel || '' };
    if (g.mode !== 'duel') selectMode(g, 'duel');
    if (g.state === 'ready') g.hold = true;
    markActive();
    showPanel('duel');
    duel.open(code);
  }
  function leaveDuel() {
    const back = beforeDuel || { mode: 'classic', panel: '' };
    beforeDuel = null;
    selectMode(g, back.mode);
    markActive(); refreshDead(); renderBoard();
    if (back.panel === 'modes') openModes(); else showPanel(back.panel === 'duel' ? '' : back.panel);
  }
  if (duel) createDuelCard(doc, g, duel, { onTap, board: hooks.board, fmtClock: formatClock, nf, onLeave: leaveDuel });

  const showRiders = (on) => showPanel(on ? 'riders' : '');

  // Fahrerwahl: das Icon oben links zeigt den gewählten Fahrer, ein Tipp tauscht die Ergebniskarte gegen die
  // Auswahl. Ein Tipp auf eine Kachel wählt und führt zurück; auch das Icon und „Zurück“ schließen.
  const riderBtn = $('btn-rider'), riderIcon = riderBtn.querySelector('.rider-preview'), ridersEl = $('riders');
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
      if (id !== g.rider && selectRider(g, id)) { markRider(); drawModes(); if (duel) duel.setRider(id); }
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
  onTap(riderBtn, () => showRiders(doc.body.dataset.panel !== 'riders'));
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
    boardEl.hidden = !MODES[g.mode].board; // das Duell hat keine Bestenliste
    if (boardEl.hidden) return;
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
    noteEl.textContent = verdict ? verdictText(verdict) : board.stale() ? 'Letzter bekannter Stand' : 'Tippen für Details';
  }

  // Detail-Kachel: ein Tipp auf die Liste (nicht auf die eigene Zeile, die gehört dem Namensfeld) zeigt alle Einträge
  // des gewählten Modus mit Wert, Fahrzeit und Durchschnittstempo des besten Laufs. Ohne Namen gibt es keine Liste,
  // also auch keine Details. Die Liste scrollt (input.js lässt #stats-list natives Wischen).
  const statsMode = $('stats-mode'), statsHead = $('stats-head'), statsList = $('stats-list'), statsNote = $('stats-note');
  const cell = (cls, text) => {
    const span = doc.createElement('span');
    span.className = cls;
    span.textContent = text;
    return span;
  };
  function renderStats() {
    const time = lowerIsBetter(g.mode);
    statsMode.textContent = MODES[g.mode].name;
    statsHead.replaceChildren(cell('stats-rank', '#'), cell('stats-name', 'Name'), cell('stats-num', time ? 'Gesamt' : 'Meter'),
      cell('stats-num', time ? 'Fahrzeit' : 'Zeit'), cell('stats-num', 'Ø km/h'));
    const list = board.stats(g.mode);
    statsList.replaceChildren(...list.map((e) => {
      const row = doc.createElement('div');
      row.className = 'stats-row' + (e.own ? ' own' : '');
      row.append(
        cell('stats-rank', e.rank),
        cell('stats-name', e.name),
        cell('stats-num', time ? formatClock(e.m / 100, false) : nf.format(e.m)),
        cell('stats-num', e.t > 0 ? formatClock(e.t, false) : '–'),
        cell('stats-num', e.kmh > 0 ? nf.format(e.kmh) : '–'),
      );
      return row;
    }));
    statsNote.textContent = list.length ? '' : 'Noch keine Einträge';
  }
  function openStats() {
    if (!boardOn || !board.name()) return;
    if (doc.activeElement === nameInput) nameInput.blur();
    renderStats();
    statsList.scrollTop = 0;
    showPanel('stats');
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
    board.onChange(() => {
      if (doc.body.dataset.overlay !== '1') return;
      refreshDead();
      renderBoard();
      if (doc.body.dataset.panel === 'stats') renderStats();
    });
    onTap(boardEl, (hit) => { if (!(hit && hit.closest && hit.closest('.board-own'))) openStats(); });
    onTap($('btn-stats-back'), () => showPanel(''));
  }

  function sync(now, R, force) {
    const m = Math.floor(g.dist);
    const cs = g.course;
    // Tempo und Distanz nur alle HUD_TEXT_MS schreiben: jede Textänderung kostet Layout und Neuzeichnen des HUD
    if (force || now - lastText >= C.HUD_TEXT_MS) {
      lastText = now;
      const kmh = Math.round(g.skier.v * 3.6);
      if (kmh !== lastSpeed) { lastSpeed = kmh; speedEl.textContent = nf.format(kmh) + ' km/h'; }
      // Gipfel (Classic): kurz „Everest“ statt der Meter
      const summit = g.summitT >= 0 && g.state === 'running' && g.runT - g.summitT < C.EVEREST_HUD_S;
      const dist = summit ? 'Everest' : nf.format(m) + ' m';
      if (dist !== lastDist) { lastDist = dist; distEl.textContent = dist; }
      if (cs) {
        // Wirksame Zeit: Laufzeit plus Strafen, nach dem Ziel die Gesamtzeit
        const txt = formatClock(cs.finished ? cs.total : g.runT + cs.penalty, false);
        if (txt !== lastTime) { lastTime = txt; timeEl.textContent = txt; }
      }
      // Duell: eigene Uhr (Wanduhr ab dem Go) und der Stand des Gegners: Abstand bei gleicher Rennzeit (rot, wenn
      // er vorn liegt), seine Vorgabe nach dem Ziel, Pause, weg
      const dh = !cs && g.mode === 'duel' && duel ? duel.hud() : null;
      if (dh) {
        const txt = formatClock(dh.clock, false);
        if (txt !== lastTime) { lastTime = txt; timeEl.textContent = txt; }
        let opp = '', cls = '';
        if (dh.oppGone) opp = `${dh.oppName} weg`;
        else if (dh.oppFin) opp = `Vorgabe ${formatClock(dh.oppFin, false)} · ${dh.oppName} im Ziel`;
        else if (dh.oppPaused) opp = `${dh.oppName} pausiert`;
        else if (dh.gap != null) {
          const gp = Math.round(dh.gap);
          opp = `${dh.oppName} ${gp >= 0 ? '+' : '−'}${nf.format(Math.abs(gp))} m`;
          cls = gp > 3 ? 'slow' : gp < -3 ? 'fast' : '';
        }
        if (opp !== lastOpp) { lastOpp = opp; oppEl.textContent = opp; oppEl.className = cls; }
      } else if (lastOpp) { lastOpp = ''; oppEl.textContent = ''; oppEl.className = ''; }
    }
    if (g.mode !== lastMode) {
      lastMode = g.mode;
      doc.body.dataset.mode = g.mode;
      hintEl.textContent = g.mode === 'superg' ? 'Tippen zum Start' : hintDefault;
    }
    if (g.state !== lastState) {
      lastState = g.state;
      doc.body.dataset.state = g.state;
      doc.body.dataset.intro = g.state === 'ready' && g.intro && !g.hold ? '1' : '';
      // Bestwert steht fest: die() bzw. finish() lief im Physikschritt davor; das Duell hat keine Liste
      if ((g.state === 'dead' || g.state === 'finished') && boardOn && MODES[g.runMode].board) board.onRunEnd(g);
      if (pauseSub && g.state === 'paused') pauseSub.textContent = duel && duel.racing() ? 'Die Zeit läuft weiter · Tippen zum Weiterfahren' : pauseDefault;
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
    if (g.state === 'count') count = String(Math.min(C.SG_COUNT_BEEPS, Math.max(1, C.SG_COUNT_BEEPS - Math.floor(g.countT / C.SG_COUNT_STEP_S))));
    else if (g.state === 'running' && (cs || g.mode === 'duel') && g.runT < C.SG_GO_SHOW_S) count = 'Go';
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
      if (ov) { refreshDead(); markActive(false); renderBoard(); if (g.mode === 'duel' && duel && duel.active()) showPanel('duel'); } else showPanel('');
    }
    if (g.debug && (force || now - lastDebug > 250)) {
      lastDebug = now;
      const s = g.skier, av = g.av;
      const deg = (r) => (r * 180 / Math.PI).toFixed(0);
      const p = R.prof; // Zeit je Phase (main.js), erst nach der ersten Sekunde
      const ms = (a, b) => `${a.toFixed(2)}/${b.toFixed(1)}`;
      debugEl.textContent = [
        p
          ? `${p.fps.toFixed(0)} fps  ${R.frameMs.toFixed(1)} ms/frame  Takt ${R.paceMs.toFixed(2)} ms  rechnen ${ms(p.upd, p.updMax)}  zeichnen ${ms(p.draw, p.drawMax)}  hud ${ms(p.hud, p.hudMax)} ms (Mittel/Max)  leerlauf ${(p.idle * 100).toFixed(0)} %`
          : `${R.frameMs.toFixed(1)} ms/frame  Takt ${R.paceMs.toFixed(2)} ms`,
        `${R.W}x${R.H}@${R.dpr}  S=${R.S.toFixed(2)} px/m  zoom=${g.zoom.toFixed(2)}  frac=${g.skierFrac.toFixed(2)}`,
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
  return { sync, openDuel };
}
