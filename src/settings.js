// Kachel „Einstellungen“ (DOM), geöffnet über das Zahnrad links neben dem Ton-Icon (hud.js, body[data-panel="settings"]).
// Oben die Einwilligung in die anonyme Spielstatistik (Opt-in, aus bis der Spieler sie einschaltet), dann Name und
// Namenslinien (nur mit Bestenliste), die Sprache (i18n.js) als Auswahlzeile mit Flagge und die Lautstärken aus dem
// Tuning-Abschnitt „Ton“ (TUNABLES mit user, tune.js speichert sie getrennt vom Tuning). Die Regler tragen .native und liegen in #settings-body, das input.js
// natives Wischen lässt: so lassen sie sich ziehen und die Kachel scrollt auf kleinen iPhones.
import { C } from './constants.js';
import { LANGS, getLang, setLang, t, num } from './i18n.js';
import { setUserTune, resetUserTune, userTunables, userTuned } from './tune.js';
import { loadStatsOk, saveStatsOk } from './storage.js';
import { setMarksOn } from './game.js';

// Flaggen als SVG im Rahmen 3:2 (styles.css .lang-flag), je auf die Fläche beschnitten (slice): der Union Jack ist 2:1,
// Schwarz-Rot-Gold 5:3, beide vertragen das; Spanien (vereinfacht, ohne Wappen) und Japan sind 3:2.
const FLAGS = {
  de: '<svg viewBox="0 0 5 3" preserveAspectRatio="none"><rect width="5" height="1" fill="#000"/>'
    + '<rect y="1" width="5" height="1" fill="#DD0000"/><rect y="2" width="5" height="1" fill="#FFCE00"/></svg>',
  en: '<svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><clipPath id="flag-uk">'
    + '<path d="M30,15h30v15zv15h-30zh-30v-15zv-15h30z"/></clipPath><path d="M0,0v30h60v-30z" fill="#012169"/>'
    + '<path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/>'
    + '<path d="M0,0L60,30M60,0L0,30" clip-path="url(#flag-uk)" stroke="#C8102E" stroke-width="4"/>'
    + '<path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>',
  es: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#AA151B"/><rect y="0.5" width="3" height="1" fill="#F1BF00"/></svg>',
  ja: '<svg viewBox="0 0 3 2"><rect width="3" height="2" fill="#fff"/><circle cx="1.5" cy="1" r="0.6" fill="#BC002D"/></svg>',
};
const LANG_NAMES = { de: 'Deutsch', en: 'English', es: 'Español', ja: '日本語' };

export function createSettings(doc, { onTap, g, board }) {
  const $ = (id) => doc.getElementById(id);
  const statsBtn = $('set-stats'), langsEl = $('set-langs'), soundsEl = $('set-sounds'), resetBtn = $('set-snd-reset');
  const boardEl = $('set-board'), nameIn = $('set-name'), nameNote = $('set-name-note'), marksBtn = $('set-marks');
  const boardOn = !!(board && board.enabled);
  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  const syncStats = () => statsBtn.setAttribute('aria-checked', loadStatsOk() ? 'true' : 'false');
  onTap(statsBtn, () => { saveStatsOk(!loadStatsOk()); syncStats(); });

  // Name wie im Feld der Bestenliste: gespeichert beim Verlassen des Felds (iOS „Fertig“ endet im blur), Ungültiges
  // fällt auf den alten Namen zurück. Ohne Datenbank gibt es weder Liste noch Linien, der Abschnitt fehlt dann.
  boardEl.hidden = !boardOn;
  const syncName = () => {
    if (doc.activeElement !== nameIn) nameIn.value = board.name();
    nameNote.textContent = board.taken() ? t('board.taken') : t('settings.nameSub');
  };
  const syncMarks = () => marksBtn.setAttribute('aria-checked', g.marksOn ? 'true' : 'false');
  if (boardOn) {
    let before = '';
    nameIn.addEventListener('focus', () => { before = nameIn.value; });
    nameIn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); }
      else if (e.key === 'Escape') { nameIn.value = before; nameIn.blur(); }
    });
    nameIn.addEventListener('blur', () => {
      if (!board.setName(nameIn.value)) nameIn.value = board.name();
      syncName();
    });
    board.onChange(syncName); // Besitz des Namens steht erst nach dem Laden fest
    onTap(marksBtn, () => { setMarksOn(g, !g.marksOn); syncMarks(); });
  }

  // Sprache: eine Zeile mit Flagge, Name und ▾, darüber unsichtbar ein natives select. Ein Tipp öffnet so die
  // Auswahl des iPhones (Rad), die Zeile selbst bleibt im Look der App.
  const langRow = el('label', 'lang-row');
  const langFlag = el('span', 'lang-flag');
  const langName = el('span', 'lang-name');
  const langSel = el('select', 'native lang-select');
  for (const id of LANGS) {
    const opt = el('option', '', LANG_NAMES[id]);
    opt.value = id;
    opt.lang = id;
    langSel.append(opt);
  }
  langSel.addEventListener('change', () => { setLang(langSel.value); markLang(); });
  langRow.append(langFlag, langName, el('span', 'lang-chev', '▾'), langSel);
  langsEl.append(langRow);
  function markLang() {
    const id = getLang();
    langSel.value = id;
    langSel.setAttribute('aria-label', t('settings.lang'));
    langFlag.innerHTML = FLAGS[id]; // feste SVG-Texte von oben, keine Eingabe
    langName.textContent = LANG_NAMES[id];
    langName.lang = id;
  }

  // Lautstärke je Gruppe in Prozent wie im Tuning-Panel; der Ton liest C in jedem Bild (audio.js)
  const pct = (v) => num(Math.round(v * 100)) + ' %';
  const rows = userTunables().map((tn) => {
    const row = el('label', 'set-slider');
    const name = el('span', 'set-slider-name');
    const val = el('span', 'set-slider-val');
    const input = el('input', 'native');
    input.type = 'range';
    input.min = String(tn.min);
    input.max = String(tn.max);
    input.step = String(tn.step);
    input.addEventListener('input', () => {
      setUserTune(tn.key, Number(input.value));
      val.textContent = pct(C[tn.key]);
      resetBtn.disabled = !userTuned();
    });
    row.append(name, input, val);
    soundsEl.append(row);
    return { tn, name, val, input };
  });
  onTap(resetBtn, () => { resetUserTune(); refresh(); });

  // Werte und Beschriftungen neu: beim Öffnen (das Tuning-Panel kann dieselben Regler verstellt haben) und nach
  // einem Sprachwechsel
  function refresh() {
    syncStats();
    if (boardOn) { syncName(); syncMarks(); }
    markLang();
    for (const r of rows) {
      r.name.textContent = t('snd.' + r.tn.key);
      r.input.value = String(C[r.tn.key]);
      r.val.textContent = pct(C[r.tn.key]);
    }
    resetBtn.disabled = !userTuned();
  }
  refresh();
  return { refresh };
}
