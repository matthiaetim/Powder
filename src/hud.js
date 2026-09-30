// DOM-HUD: Tempo, Distanz, Pause, Fresh-Seite mit Laufzeit, Bestenliste samt Namensfeld und Detail-Kachel,
// Moduswahl (drei Vorschauen unter Fresh und Kachel mit allen Modi), Ton-Icon, Einstellungen (Zahnrad), Debug-Text.
// Alle Texte kommen aus i18n.js; ein Sprachwechsel beschriftet alles neu (relabel).
// Super-G: dazu die laufende Zeit, Hinweise zu Torfehler und Zwischenzeit, der Countdown in der Bildmitte.
import { C, VERSION } from './constants.js';
import { overlayReady, togglePause, pauseIfRunning, fresh, restart, selectMode, selectRider } from './game.js';
import { createTunePanel, isTuned } from './tune.js';
import { verdictText } from './board.js';
import { MODES, MODE_ORDER, lowerIsBetter, modeOn, onlineBoard } from './modes.js';
import { RIDER_ORDER } from './riders.js';
import { drawModePreview, drawRiderPreview } from './render.js';
import { loadBest, loadBestTime, loadDuelTally, loadRecentModes } from './storage.js';
import { createDuelCard } from './duel-card.js';
import { t, num, sep, applyStatic, onLang } from './i18n.js';
import { createSettings } from './settings.js';
import { levelAt, laneAt, paceAt, onPiste, nightAt } from './piste.js';
import { crashesUsed } from './piste-life.js';
import { drawPistePlan } from './piste-view.js';

const pad2 = (n) => String(n).padStart(2, '0');
const SHORT_PX = 720; // darunter ist das Bild zu niedrig für Liste und Pistenplan zusammen (styles.css nutzt dieselbe Grenze)

// Laufzeit: unter einer Minute „43,27 Sekunden“, sonst „1:34:07 Minuten“ (Minuten:Sekunden:Hundertstel). Trenner
// und Wort je Sprache (i18n.js).
export function formatRunTime(sec) {
  const cs = Math.max(0, Math.round(sec * 100));
  const hh = pad2(cs % 100);
  const total = Math.floor(cs / 100);
  const m = Math.floor(total / 60), s = total % 60;
  return m === 0 ? t('time.sec', { v: `${s}${sep()}${hh}` }) : t('time.min', { v: `${m}:${pad2(s)}:${hh}` });
}

// Uhr im Super-G: „41,27“ (Hundertstel), ab einer Minute „1:02,47“; mit unit hängt unter einer Minute „ s“ an.
export function formatClock(sec, unit) {
  const cs = Math.max(0, Math.round(sec * 100));
  const hh = pad2(cs % 100);
  const total = Math.floor(cs / 100);
  const m = Math.floor(total / 60), s = total % 60;
  if (m > 0) return `${m}:${pad2(s)}${sep()}${hh}`;
  return `${s}${sep()}${hh}${unit ? ' s' : ''}`;
}

export function createHud(g, doc, hooks = {}) {
  const $ = (id) => doc.getElementById(id);
  const doFresh = hooks.fresh || (() => fresh(g));
  const speedEl = $('hud-speed'), distEl = $('hud-dist'), timeEl = $('hud-time'), raceNoteEl = $('hud-note'), oppEl = $('hud-opp');
  const livesEl = $('hud-lives'), planEl = $('piste-plan'), extraEl = $('dead-extra');
  const pauseSub = doc.querySelector('#ov-pause .ov-sub');
  const countEl = $('ov-count'), hintEl = $('hint');
  const deadDist = $('dead-dist'), deadTime = $('dead-time'), deadBest = $('dead-best'), debugEl = $('debug');
  const themeEl = doc.querySelector('meta[name="theme-color"]'); // färbt die iOS-Statusleiste (Safari-Tab) mit
  $('version').textContent = 'v' + VERSION;
  applyStatic(doc);
  // Zahlen im Format der gewählten Sprache (6.978 m, 6,978 m), bei jedem Aufruf neu, damit ein Sprachwechsel greift
  const nf = { format: (v) => num(v) };
  const nf1 = { format: (v) => num(v, 1) };
  const nf2 = { format: (v) => num(v, 2, 2) };
  let lastSpeed = -1, lastDist = '', lastTime = '', lastState = '', lastOverlay = '', lastDebug = 0, lastText = -1e9;
  let lastMode = '', lastRace = '', lastNote = '', lastCount = '', lastOpp = '', lastLives = '', lastNight = '';
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
    soundEl.setAttribute('aria-label', t(on ? 'aria.soundOn' : 'aria.soundOff'));
    soundEl.setAttribute('aria-pressed', on ? 'true' : 'false');
    soundEl.classList.toggle('off', !on);
  };
  onTap(soundEl, () => { if (snd) { snd.toggle(); syncSound(); } });

  // Neustart im Super-G und im Duell gegen den Bot: sichtbar über body[data-race] und den Zustand (styles.css), ein
  // Tipp beginnt von vorn
  onTap($('btn-restart'), () => {
    const ok = duel && duel.vsBot() ? duel.restart() : restart(g);
    if (ok && hooks.onRestart) hooks.onRestart();
  });
  syncSound();

  // Tuning-Panel: langer Druck auf das Versions-Label öffnet es, Spiel pausiert derweil.
  const tuneEl = $('tune');
  const versionEl = $('version');
  const markTuned = (t) => {
    versionEl.classList.toggle('tuned', isTuned());
    // mitten im Lauf verstellt: zählt nicht online (board.js); Regler, die nur das Bild ändern (visual), und
    // Beta-Schalter (keep) ausgenommen
    if (!(t && (t.visual || t.keep)) && (g.state === 'running' || g.state === 'paused')) g.runTainted = true;
    if (t && t.keep) showBeta();
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
  const avgText = (meters, sec) => (sec > 0 ? t('dead.avg', { v: nf.format((meters / sec) * 3.6) }) : '');
  // Piste: die Zeit zählt erst im Ziel, eine Bestzeit hat also nur, wer schon unten war
  const tied = (id) => MODES[id].tie === 't';
  const crashText = (n) => (n === 0 ? t('piste.crashes0') : n === 1 ? t('piste.crashes1') : t('piste.crashesN', { n: nf.format(n) }));
  // Piste: was im Lauf sonst noch war, als eine Zeile unter der Laufzeit (Tricks, Torstrecken, Tempomessung), und
  // der Pistenplan mit dem gefahrenen Weg
  function pisteExtra() {
    const L = g.life;
    if (!L || g.runMode !== 'piste') return '';
    const parts = [];
    if (L.tricks > 0) parts.push(L.tricks === 1 ? t('piste.tricks1') : t('piste.tricksN', { n: nf.format(L.tricks) }));
    if (L.gateRuns > 0) parts.push(L.gateRuns === 1 ? t('piste.gateRuns1') : t('piste.gateRunsN', { n: nf.format(L.gateRuns) }));
    if (L.topKmh > 0) parts.push(t('piste.top', { v: nf.format(Math.round(L.topKmh)) }));
    return parts.join(' · ');
  }
  function refreshDead() {
    const cs = g.course;
    const plan = g.runMode === 'piste' && g.mode === 'piste' && !!g.life && (g.state === 'dead' || g.state === 'finished');
    planEl.hidden = !plan;
    if (plan) drawPistePlan(planEl, g);
    extraEl.textContent = plan ? pisteExtra() : '';
    if (tied(g.runMode) && g.state === 'finished' && g.finTime > 0) {
      // im Tal: die Zeit groß, darunter die Stürze und das Durchschnittstempo
      deadDist.textContent = formatClock(g.finTime, true);
      deadTime.textContent = t('piste.valley') + ' · ' + crashText(g.crashes) + avgText(C.PISTE_FINISH_M, g.finTime);
    } else if (lowerIsBetter(g.runMode) && g.state === 'finished') {
      deadDist.textContent = formatClock(cs.total, true);
      deadTime.textContent = (cs.misses === 0
        ? t('gates.all', { n: nf.format(cs.gates.length) })
        : `${cs.misses === 1 ? t('gates.miss1') : t('gates.missN', { n: nf.format(cs.misses) })} · +${nf1.format(cs.penalty)} s`)
        + avgText(cs.finishY, cs.time);
    } else {
      const m = Math.floor(g.dist);
      deadDist.textContent = nf.format(m) + ' m';
      deadTime.textContent = lowerIsBetter(g.runMode) ? t('noFinish') : t('dead.in', { t: formatRunTime(g.runT) }) + avgText(m, g.runT);
    }
    if (lowerIsBetter(g.mode) || (tied(g.mode) && g.bestTime > 0)) {
      deadBest.textContent = g.newBestTime && g.mode === g.runMode ? t('best.newTime')
        : g.bestTime > 0 ? t('best.time', { t: formatClock(g.bestTime / 100, true) }) : t('best.noTime');
    } else {
      deadBest.textContent = g.newBest && g.mode === g.runMode ? t('best.newRecord') : t('best.run', { m: nf.format(g.best) + ' m' });
    }
  }

  // Hinweis im HUD (Super-G): Torfehler mit Strafe, Zwischenzeit als Differenz zur Bestzeit oder als Zeit
  function noteText(n) {
    if (n.kind === 'miss') return t('note.miss', { v: nf1.format(n.value) });
    if (n.kind === 'split') return formatClock(n.value, true);
    return (n.value < 0 ? '−' : n.value > 0 ? '+' : '±') + nf2.format(Math.abs(n.value)) + ' s';
  }

  // Karten statt der Ergebniskarte: Moduswahl ('modes'), Fahrerwahl ('riders'), Einstellungen ('settings') oder
  // Detail-Kachel der Bestenliste ('stats'), immer nur eine
  const showPanel = (name) => { doc.body.dataset.panel = name; };

  // Moduswahl: unter Fresh stehen drei Vorschauen, links immer Classic, daneben die zwei zuletzt gewählten oder
  // gefahrenen Modi (storage.js), fehlen die, die nächsten aus MODE_ORDER. Die gewählte ist gelb, ein Tipp darauf
  // startet Fresh, ein Tipp auf eine andere wählt sie. „Modus auswählen“ öffnet die Kachel „Modus“ mit allen Modi als
  // Zeilen samt persönlichem Bestwert. Die Bestwerte der anderen Modi liegen nur im Storage (g.best gilt für den
  // gewählten), deshalb werden sie beim Öffnen frisch gelesen. Die Vorschauen zeigen den gewählten Fahrer und werden
  // bei einem Fahrerwechsel neu gezeichnet.
  const modesList = $('modes-list');
  const modeOff = (id) => id === 'duel' && !duel; // ohne Datenbank (BOARD_URL) bleibt im Duell der Bot
  const bestText = (id) => {
    if (id === 'duel') {
      if (!duelOn) return 'Bot';
      const w = Object.values(loadDuelTally()).reduce((n, e) => n + (e && e.w ? e.w : 0), 0);
      return w > 0 ? (w === 1 ? t('wins1') : t('winsN', { n: nf.format(w) })) : '–';
    }
    if (MODES[id].board === 'time' || (tied(id) && loadBestTime(id) > 0)) { const v = loadBestTime(id); return v > 0 ? formatClock(v / 100, true) : '–'; }
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
    const desc = doc.createElement('span');
    desc.className = 'mode-desc';
    text.append(name, desc);
    if (m.beta) name.after(betaTag());
    row.hidden = !!m.beta && !modeOn(id);
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
    const beta = betaTag();
    beta.hidden = true;
    // nur beim gewählten sichtbar, steht überall, damit die Kärtchen gleich hoch sind (Text: labelModes)
    card.append(cv, name, beta, cta);
    onTap(card, () => {
      const id = card.dataset.mode;
      if (!id || !modeOn(id) || modeOff(id)) return;
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
    const ok = (id) => modeOn(id) && !modeOff(id) && id !== 'classic';
    // der gewählte Modus steht vorn, auch wenn der Speicher fehlt (selectMode merkt ihn sonst ohnehin)
    const ids = ['classic', ...new Set([g.mode, ...loadRecentModes(), ...MODE_ORDER].filter(ok))].slice(0, 3);
    cards.forEach((card, i) => {
      const id = ids[i];
      card.hidden = !id;
      if (!id || card.dataset.mode === id) return;
      card.dataset.mode = id;
      card.querySelector('.mode-beta').hidden = !MODES[id].beta;
      card.querySelector('.mode-name').textContent = t('mode.' + id);
      drawModePreview(card.querySelector('.mode-preview'), id, g.rider);
    });
  }
  // Namen und Kurztexte der Modi in der gewählten Sprache (beim Start und nach einem Sprachwechsel)
  function labelModes() {
    for (const row of modeRows) {
      const id = row.dataset.mode;
      row.querySelector('.mode-name').textContent = t('mode.' + id);
      row.querySelector('.mode-desc').textContent = modeOff(id) ? t('mode.offline') : t('mode.' + id + '.desc');
    }
    for (const card of cards) {
      card.querySelector('.mode-cta').textContent = t('tapToPlay');
      if (card.dataset.mode) card.querySelector('.mode-name').textContent = t('mode.' + card.dataset.mode);
    }
    for (const tag of doc.querySelectorAll('.mode-beta')) tag.textContent = t('mode.beta');
  }
  labelModes();
  const drawModes = () => {
    for (const row of modeRows) drawModePreview(row.querySelector('.mode-preview'), row.dataset.mode, g.rider);
    for (const card of cards) if (card.dataset.mode) drawModePreview(card.querySelector('.mode-preview'), card.dataset.mode, g.rider);
  };
  function markActive(keep = true) {
    for (const row of modeRows) row.classList.toggle('active', row.dataset.mode === g.mode);
    layoutModes(keep);
    for (const card of cards) card.classList.toggle('active', card.dataset.mode === g.mode);
  }
  // Beta-Modi (modes.js beta): Etikett neben dem Namen, Text aus i18n wie alle Texte des Spielers
  function betaTag() {
    const tag = doc.createElement('span');
    tag.className = 'mode-beta';
    tag.textContent = t('mode.beta');
    return tag;
  }
  // Beta-Schalter im Tuning-Panel umgelegt: Zeile ein- oder ausblenden. Ist der gewählte Modus nun gesperrt, geht
  // die Wahl auf der Fresh-Seite zurück auf Classic; ein laufender Lauf bleibt, wie er ist.
  function showBeta() {
    for (const row of modeRows) if (MODES[row.dataset.mode].beta) row.hidden = !modeOn(row.dataset.mode);
    if (!modeOn(g.mode) && (g.state === 'dead' || g.state === 'finished')) {
      selectMode(g, 'classic'); refreshDead(); renderBoard();
    }
    markActive(false);
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
  const duelCard = duel ? createDuelCard(doc, g, duel, { onTap, board: hooks.board, fmtClock: formatClock, nf, nf1, onLeave: leaveDuel }) : null;

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
    name.textContent = t('rider.' + id);
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

  // Einstellungen (settings.js): das Zahnrad links neben dem Ton-Icon tauscht die Ergebniskarte gegen die Kachel,
  // noch ein Tipp oder „Zurück“ schließen sie
  const settings = createSettings(doc, { onTap, g, board: hooks.board });
  const showSettings = (on) => { if (on) settings.refresh(); showPanel(on ? 'settings' : ''); };
  onTap($('btn-settings'), () => showSettings(doc.body.dataset.panel !== 'settings'));
  onTap($('btn-settings-back'), () => showSettings(false));

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
  // Wert einer Zeile: Meter oder Gesamtzeit; in der Piste steht bei allen, die im Ziel waren, die Laufzeit
  const scoreText = (e) => (tied(g.mode) && e.m >= C.PISTE_FINISH_M && e.t > 0 ? formatClock(e.t, true)
    : lowerIsBetter(g.mode) ? formatClock(e.m / 100, true) : nf.format(e.m) + ' m');
  const rowEl = (rank, name, e) => {
    const row = doc.createElement('div');
    row.className = 'board-row';
    for (const [cls, text] of [['board-rank', rank], ['board-name', name], ['board-m', scoreText(e)]]) {
      const span = doc.createElement('span');
      span.className = cls;
      span.textContent = text;
      row.append(span);
    }
    return row;
  };
  function renderBoard() {
    if (!boardOn || doc.activeElement === nameInput) return; // ohne Server bleibt #board hidden; nicht unter den Fingern umbauen
    boardEl.hidden = !onlineBoard(g.mode); // das Duell hat keine Bestenliste, die Piste (Beta) keine online
    if (boardEl.hidden) return;
    const name = board.name();
    boardEl.dataset.named = name ? '1' : '';
    rowsEl.replaceChildren();
    moreEl.after(ownRow);
    moreEl.hidden = true;
    nameInput.value = name;
    if (!name) { noteEl.textContent = t('board.forList'); return; }
    // Piste auf kleinen iPhones: der Pistenplan braucht Platz, darum dort nur die ersten drei Zeilen
    const v = board.view(g.mode, !planEl.hidden && window.innerHeight < SHORT_PX ? 3 : undefined);
    for (const e of v.top) {
      if (!e.own) { rowsEl.append(rowEl(e.rank, e.name, e)); continue; }
      rowsEl.append(ownRow);
      ownRank.textContent = e.rank;
      ownM.textContent = scoreText(e);
    }
    if (!v.ownInTop) {
      // Eigener Eintrag unter den Top-Zeilen mit Rang, oder noch nicht auf dem Server: dann der lokale Bestwert ohne
      // Rang (im Super-G ohne Bestzeit ein Strich)
      moreEl.hidden = !v.own;
      ownRank.textContent = v.own ? v.own.rank : '–';
      const local = lowerIsBetter(g.mode) ? g.bestTime : g.best;
      ownM.textContent = v.own ? scoreText(v.own) : local > 0 ? scoreText({ m: local, t: tied(g.mode) ? g.bestTime / 100 : 0 }) : '–';
    }
    const verdict = board.lastVerdict();
    noteEl.textContent = verdict ? verdictText(verdict) : board.taken() ? t('board.taken')
      : board.stale() ? t('board.stale') : t('board.details');
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
    statsMode.textContent = t('mode.' + g.mode);
    statsHead.replaceChildren(cell('stats-rank', '#'), cell('stats-name', t('stats.name')),
      cell('stats-num', t(time ? 'stats.total' : 'stats.meters')), cell('stats-num', t(time ? 'stats.ride' : 'stats.time')),
      cell('stats-num', t('stats.avg')));
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
    statsNote.textContent = list.length ? '' : t('stats.empty');
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
        if (dh.oppGone) opp = t('opp.gone', { n: dh.oppName });
        else if (dh.oppFin) opp = t('opp.fin', { t: formatClock(dh.oppFin, false), n: dh.oppName });
        else if (dh.oppPaused) opp = t('opp.paused', { n: dh.oppName });
        else if (dh.gap != null) {
          const gp = Math.round(dh.gap);
          opp = `${dh.oppName} ${gp >= 0 ? '+' : '−'}${nf.format(Math.abs(gp))} m`;
          cls = gp > 3 ? 'slow' : gp < -3 ? 'fast' : '';
        }
        if (opp !== lastOpp) { lastOpp = opp; oppEl.textContent = opp; oppEl.className = cls; }
      } else if (lastOpp) { lastOpp = ''; oppEl.textContent = ''; oppEl.className = ''; }
    }
    // Piste: freie Stürze als Punkte, verbrauchte bleiben als Ring stehen (eine Torstrecke mit allen Toren gibt einen zurück)
    const usedNow = g.life ? Math.min(crashesUsed(g.life), C.PISTE_FREE_CRASHES) : 0;
    const lives = g.mode === 'piste' ? `${C.PISTE_FREE_CRASHES}:${usedNow}` : '';
    if (lives !== lastLives) {
      lastLives = lives;
      const used = usedNow;
      livesEl.replaceChildren(...Array.from({ length: lives ? C.PISTE_FREE_CRASHES : 0 }, (_, i) => {
        const dot = doc.createElement('i');
        if (i >= C.PISTE_FREE_CRASHES - used) dot.className = 'used';
        return dot;
      }));
      livesEl.setAttribute('aria-label', lives ? t('piste.lives', { n: nf.format(C.PISTE_FREE_CRASHES - used) }) : '');
    }
    if (g.mode !== lastMode) {
      lastMode = g.mode;
      doc.body.dataset.mode = g.mode;
      hintEl.textContent = t(lowerIsBetter(g.mode) ? 'hint.superg' : 'hint'); // Torlauf: der Tipp startet den Countdown
    }
    // Neustart-Knopf: im Torlauf und gegen den Bot, der Bot kann im Duell jederzeit dazukommen oder gehen
    const race = lowerIsBetter(g.mode) || !!(duel && duel.vsBot()) ? '1' : '';
    if (race !== lastRace) { lastRace = race; doc.body.dataset.race = race; }
    if (g.state !== lastState) {
      lastState = g.state;
      doc.body.dataset.state = g.state;
      doc.body.dataset.intro = g.state === 'ready' && g.intro && !g.hold ? '1' : '';
      // Bestwert steht fest: die() bzw. finish() lief im Physikschritt davor; das Duell hat keine Liste
      if ((g.state === 'dead' || g.state === 'finished') && boardOn && onlineBoard(g.runMode)) board.onRunEnd(g);
      if (pauseSub && g.state === 'paused') pauseSub.textContent = t(duel && duel.racing() && !duel.vsBot() ? 'pause.duel' : 'pause.sub');
    }
    // Hinweis unter dem Fahrer, verschwindet nach SG_NOTE_S (gates.js zählt note.t hoch)
    const note = cs && cs.note && cs.note.t < C.SG_NOTE_S && g.state !== 'finished' ? cs.note : null;
    // Piste: Tor 2/5, alle Tore, gemessenes Tempo (piste-life.js)
    const pn = g.life && g.life.note.t < C.PISTE_NOTE_S && g.state === 'running' ? g.life.note : null;
    const noteKey = note ? `${note.kind}:${note.value}` : pn ? `${pn.key}:${pn.a}:${pn.b}` : '';
    if (noteKey !== lastNote) {
      lastNote = noteKey;
      raceNoteEl.className = note ? note.kind : pn ? pn.kind : '';
      raceNoteEl.textContent = note ? noteText(note) : pn ? t(pn.key, { a: nf.format(pn.a), b: nf.format(pn.b) }) : '';
    }
    // Flutlicht: im Dunkeln wird das HUD hell (styles.css)
    const night = g.piste && g.state !== 'ready' && nightAt(g.skier.y) * C.PISTE_NIGHT_ALPHA > 0.3 ? '1' : '';
    if (night !== lastNight) { lastNight = night; doc.body.dataset.night = night; }
    // Countdown 3 · 2 · 1 in der Mitte, nach dem Start kurz „Go“
    let count = '';
    if (g.state === 'count') count = String(Math.min(C.SG_COUNT_BEEPS, Math.max(1, C.SG_COUNT_BEEPS - Math.floor(g.countT / C.SG_COUNT_STEP_S))));
    else if (g.state === 'running' && (cs || g.mode === 'duel') && g.runT < C.SG_GO_SHOW_S) count = t('go');
    if (count !== lastCount) {
      lastCount = count;
      countEl.textContent = count;
      countEl.classList.toggle('go', g.state === 'running' && count !== '');
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
        `tap=${C.TURN_TAP_DEG}°+${C.TURN_DEEPEN_DEG_S}°/s  T=${C.TURN_T}-${C.TURN_T_FAST}/${C.RETURN_T}s  target=${deg(s.target)}°  brake=turn ${C.TURN_BRAKE_K} + ${C.BRAKE_K}@${C.BRAKE_START_DEG}-${C.BRAKE_FULL_DEG}° + plow ${C.PLOW_MIN}  g=${C.G_SLOPE}  v0=${C.START_SPEED_KMH}  vmax=${g.mode === 'superg' ? C.SG_MAX_SPEED_KMH : g.piste ? Math.round(paceAt(g.piste, s.x, s.y).kmh) : C.MAX_SPEED_KMH}`,
        g.mode === 'chase'
          ? `lawine gap=${av.gap.toFixed(1)} m  v=${(av.speed * 3.6).toFixed(0)} km/h  pace=${(av.pace * 3.6).toFixed(0)} km/h  stall=${av.stallT.toFixed(1)} s  near=${av.near.toFixed(2)}  threat=${av.threat.toFixed(2)}  gnade=${av.mercy.toFixed(2)}`
          : cs
            ? `torlauf tor=${cs.next}/${cs.gates.length}  verpasst=${cs.misses}  strafe=${cs.penalty} s  stangen=${cs.hits}  splits=${cs.splits.map((c) => (c / 100).toFixed(2)).join('/')}  best=${(g.bestTime / 100).toFixed(2)} [${g.bestSplits.map((c) => (c / 100).toFixed(2)).join('/')}]  ziel=${cs.finished ? cs.total.toFixed(2) : '-'}`
            : g.piste
              ? pisteDebug()
              : 'lawine: aus (Classic)',
        `objs=${g.world.objCount}  cells=${g.world.cells.size}  track=${g.track.n}`,
        `gesture=${g.lastGesture}`,
        snd ? snd.debugLine() : '',
      ].join('\n');
    }
  }
  function pisteDebug() {
    const s = g.skier, a = laneAt(g.piste, s.x, s.y), L = g.life, pc = paceAt(g.piste, s.x, s.y);
    return `piste stufe=${levelAt(g.piste, s.y).toFixed(1)}  zweig=${a.lane} farbe=${a.grade}  breite=${(2 * a.half).toFixed(1)} m  vmax=${pc.kmh.toFixed(0)} km/h g=${pc.g.toFixed(2)}  mitte=${a.c.toFixed(1)}  stürze=${crashesUsed(L)}/${C.PISTE_FREE_CRASHES} (+${L.bonus})  ${onPiste(g.piste, s.x, s.y) ? 'auf' : 'neben'} der Piste  fahrer=${L.npcs.length}  tricks=${L.tricks}  tore=${L.gateRuns}  ${L.air ? 'FLUG' : ''}`;
  }
  // Sprachwechsel (Einstellungen): statische Texte, Kacheln, Liste und Ergebnis neu beschriften; was sync() nur bei
  // Änderungen schreibt, wird über die last*-Merker neu angestoßen
  onLang(() => {
    applyStatic(doc);
    labelModes();
    riderTiles.forEach((tile) => { tile.querySelector('.mode-name').textContent = t('rider.' + tile.dataset.rider); });
    syncSound();
    settings.refresh();
    if (doc.body.dataset.panel === 'modes') openModes();
    if (doc.body.dataset.panel === 'stats') renderStats();
    if (duelCard) duelCard.render();
    refreshDead();
    renderBoard();
    lastMode = ''; lastSpeed = -1; lastDist = ''; lastTime = ''; lastOpp = ''; lastNote = ''; lastText = -1e9; lastLives = '';
    lastCount = ''; // Countdown und Laufwerte im nächsten Bild neu, sync läuft in jedem Bild
    if (pauseSub) pauseSub.textContent = t('pause.sub'); // nicht über lastState: der Zustandswechsel meldet den Lauf
  });

  return { sync, openDuel };
}
