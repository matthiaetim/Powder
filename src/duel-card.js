// Kachel „Duell“ (DOM) auf der Fresh-Seite, wie die anderen Kacheln über body[data-panel="duel"] sichtbar (hud.js).
// Drei Ansichten aus einem Satz Elemente: Beitritt (Name, neuer Raum, Code eingeben), Lobby (Raum-Code, Teilen,
// Startnummern, Zielschild, Los/Bereit, Code eingeben) und Ergebnis (Sieger, Zeiten, Stürze, Zähler, Revanche). Zeigt
// den Stand aus duel.js (view) an und reicht Tipps weiter. Eingabefelder, Regler und der Teilen-Knopf tragen .native:
// input.js lässt ihnen den nativen Tipp, nur so kommen Tastatur, Wischen und der click für navigator.share.
import { C } from './constants.js';
import { isTuned } from './tune.js';
import { drawRiderPreview } from './render.js';

export function createDuelCard(doc, g, duel, { onTap, board, fmtClock, nf, onLeave }) {
  const $ = (id) => doc.getElementById(id);
  const card = $('duel-card'), noteEl = $('duel-note'), errEl = $('duel-error');
  const nameRow = $('duel-name-row'), nameIn = $('duel-name'), createBtn = $('btn-duel-create');
  const codeRow = $('duel-code-row'), codeEl = $('duel-code'), shareBtn = $('btn-duel-share');
  const bibsEl = $('duel-bibs'), targetEl = $('duel-target'), targetVal = $('duel-target-val'), range = $('duel-target-range');
  const goBtn = $('btn-duel-go'), verdictEl = $('duel-verdict'), linesEl = $('duel-lines'), againBtn = $('btn-duel-again');
  const joinRow = $('duel-join-row'), codeIn = $('duel-code-in'), joinBtn = $('btn-duel-join'), leaveBtn = $('btn-duel-leave');
  range.min = String(C.DUEL_TARGET_MIN_M);
  range.max = String(C.DUEL_TARGET_MAX_M);
  range.step = String(C.DUEL_TARGET_STEP_M);
  let sliding = false; // Regler unter dem Finger: den Wert nicht aus dem Raum zurückschreiben
  let shareNote = '';

  const el = (tag, cls, text) => {
    const e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const meters = (m) => nf.format(m) + ' m';
  const nf1 = new Intl.NumberFormat(C.HUD_LOCALE, { maximumFractionDigits: 1 }); // Sturzpause: 1,5 s
  const crashText = (n) => (n === 0 ? 'kein Sturz' : n === 1 ? '1 Sturz' : nf.format(n) + ' Stürze');

  // Startnummer eines Spielers (Host 1, Gast 2); ohne Spieler eine gestrichelte Leerstelle
  function bib(num, p, mine, v) {
    if (!p) return el('div', 'bib empty', 'wartet auf Gegner');
    const b = el('div', 'bib' + (mine ? ' me' : ''));
    const cv = el('canvas', 'rider-preview');
    drawRiderPreview(cv, p.rider, 40);
    let state = mine ? 'du' : '';
    if (num === 1) state = mine ? 'du · Host' : 'Host';
    if (num === 2 && p.ready) { state = mine ? 'du · bereit' : 'bereit'; b.classList.add('ready'); }
    if (num === 2 && !p.ready) state = mine ? 'du' : 'noch nicht bereit';
    if (!mine && v.oppVersion && !v.versionOk) { state = 'Version ' + v.oppVersion; b.classList.add('warn'); }
    if (!mine && v.oppGone) { state = 'weg?'; b.classList.add('warn'); }
    b.append(el('div', 'bib-num', String(num)), cv, el('div', 'bib-name', p.name), el('div', 'bib-state', state));
    return b;
  }

  function renderResult(v) {
    const r = v.verdict;
    const oppName = (v.opp && v.opp.name) || (r && r.oppName) || 'Gegner';
    verdictEl.replaceChildren();
    let title, sub = '';
    if (!r) {
      title = v.myFin > 0 ? 'Ziel!' : 'Vorbei';
      sub = v.out ? 'Zeit überschritten' : `Warten auf ${oppName}` + (v.oppLive && v.oppLive.y > 0 ? ` · bei ${meters(Math.floor(v.oppLive.y))}` : '');
    } else {
      title = r.result === 'w' ? 'Gewonnen!' : r.result === 'l' ? 'Verloren' : 'Unentschieden';
      if (r.reason === 'gone') sub = `${oppName} ist weg`;
      else if (r.reason === 'out') sub = r.result === 'w' ? `${oppName} hat die Zeit überschritten` : 'Zeit überschritten';
    }
    verdictEl.append(doc.createTextNode(title));
    if (sub) verdictEl.append(el('span', 'sub', sub));
    const mine = el('div', 'duel-line me');
    mine.append(el('span', '', 'Du'), el('span', 'num', v.myFin > 0 ? fmtClock(v.myFin, false) : 'kein Ziel'), el('span', 'sub', crashText(v.myCrashes)));
    const theirs = el('div', 'duel-line');
    const ol = v.oppLive;
    const oppFin = r ? r.oppFin : ol && ol.fin > 0 ? ol.fin : 0;
    const oppDone = r ? true : !!(ol && ol.done);
    theirs.append(el('span', '', oppName),
      el('span', 'num', oppFin > 0 ? fmtClock(oppFin, false) : oppDone ? 'kein Ziel' : ol && ol.y > 0 ? meters(Math.floor(ol.y)) : '…'),
      el('span', 'sub', ol ? crashText(ol.c || 0) : ''));
    linesEl.replaceChildren(mine, theirs);
    if (v.tally) {
      const t = v.tally;
      linesEl.append(el('div', 'duel-tally', `Gegen ${oppName}: ${t.w} : ${t.l}` + (t.d ? ` · ${t.d} unentschieden` : '')));
    }
    againBtn.hidden = !r; // erst wenn das Ergebnis feststeht, sonst risse der Host dem anderen den Lauf weg
    if (v.role === 'host') againBtn.textContent = v.oppWantsRematch ? `Revanche · ${oppName} will auch` : 'Revanche';
    else againBtn.textContent = v.ready ? 'Revanche? ✓' : 'Revanche?';
  }

  function render() {
    const v = duel.view();
    const view = v.phase === 'result' || (v.phase === 'race' && v.done) ? 'result'
      : v.phase === 'lobby' || v.phase === 'count' || v.phase === 'race' ? 'lobby' : 'join';
    card.dataset.view = view;
    const show = (node, on) => { node.hidden = !on; };
    show(nameRow, view === 'join' && !v.hasName);
    show(createBtn, view === 'join' && v.hasName);
    show(codeRow, view === 'lobby');
    show(bibsEl, view === 'lobby');
    show(targetEl, view === 'lobby');
    show(goBtn, view === 'lobby');
    show(verdictEl, view === 'result');
    show(linesEl, view === 'result');
    show(againBtn, view === 'result' && !!v.verdict);
    show(joinRow, view !== 'result' && v.hasName);
    errEl.textContent = v.error || '';

    if (view === 'join') {
      noteEl.textContent = v.notice || (!v.hasName ? 'Für das Duell brauchst du einen Namen.' : v.busy ? 'Verbinde …'
        : !v.netOk ? 'Das Duell braucht Internet.' : 'Neuen Raum eröffnen oder mit einem Code beitreten.');
      if (v.pendingCode && !codeIn.value) codeIn.value = v.pendingCode;
      if (nameIn.value === '' && v.myName) nameIn.value = v.myName;
      return;
    }
    if (view === 'lobby') {
      codeEl.textContent = v.code.split('').join(' ');
      if (codeIn.value === v.code) codeIn.value = ''; // der eigene Code gehört nicht ins Feld zum Beitreten
      const hostBib = bib(1, v.host, v.role === 'host', v), guestBib = bib(2, v.guest, v.role === 'guest', v);
      bibsEl.replaceChildren(hostBib, guestBib);
      if (!sliding) { range.value = String(v.target); targetVal.textContent = meters(v.target); }
      range.disabled = v.role !== 'host';
      const hints = [];
      if (v.phase === 'count') hints.push('Start …');
      else if (v.role === 'host') hints.push(v.guest ? (v.canGo ? 'Alles bereit' : v.versionOk ? `Warte, bis ${v.guest.name} bereit ist` : 'Der andere muss die App neu laden') : 'Teile den Code, dann kann der andere beitreten');
      else hints.push(v.ready ? `Warte auf ${v.host ? v.host.name : 'den Host'}` : 'Tipp auf „Bereit“');
      hints.push(`Sturzpause ${nf1.format(v.pause)} s`);
      if (isTuned()) hints.push('Regler im Duell auf Standard');
      if (shareNote) hints.push(shareNote);
      if (v.role && !v.streaming) hints.push('kein Stream');
      noteEl.textContent = hints.join(' · ');
      if (v.role === 'host') { goBtn.textContent = v.phase === 'count' ? 'Start …' : 'Los'; goBtn.disabled = !v.canGo || v.phase === 'count'; }
      else { goBtn.textContent = v.phase === 'count' ? 'Start …' : v.ready ? 'Bereit ✓' : 'Bereit'; goBtn.disabled = v.phase === 'count'; }
      return;
    }
    noteEl.textContent = v.notice || (v.round > 1 ? `Runde ${v.round}` : '');
    renderResult(v);
  }

  // Name wie bei der Bestenliste: dieselbe Identität, gespeichert beim Verlassen des Felds; danach geht es weiter
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); nameIn.blur(); } });
  nameIn.addEventListener('blur', () => {
    if (!board.setName(nameIn.value)) { nameIn.value = board.name(); return; }
    duel.open(duel.view().pendingCode);
  });
  codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, C.DUEL_CODE_LEN); });
  codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); codeIn.blur(); duel.join(codeIn.value); } });
  onTap(joinBtn, () => { codeIn.blur(); duel.join(codeIn.value); });
  onTap(createBtn, () => duel.create());
  onTap(goBtn, () => {
    const v = duel.view();
    if (v.role === 'host') duel.go(); else duel.setReady(!v.ready);
  });
  onTap(againBtn, () => duel.rematch());
  // Zurück sofort, das Austragen aus dem Raum läuft im Hintergrund weiter (leave räumt den Stand vor dem ersten await)
  onTap(leaveBtn, () => { const p = duel.leave(); onLeave(); return p; });
  // Teilen braucht eine echte Nutzergeste: der Knopf ist .native, deshalb kommt hier ein click
  shareBtn.addEventListener('click', () => {
    const data = duel.shareData();
    shareNote = '';
    if (navigator.share) {
      navigator.share(data).catch(() => { /* abgebrochen */ });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(`${data.text} ${data.url}`).then(() => { shareNote = 'Link kopiert'; render(); }, () => {});
    } else shareNote = 'Code weitersagen: ' + duel.view().code;
    render();
  });
  range.addEventListener('pointerdown', () => { sliding = true; });
  range.addEventListener('input', () => { targetVal.textContent = meters(Number(range.value)); duel.setTarget(Number(range.value)); });
  const slideEnd = () => { sliding = false; render(); };
  range.addEventListener('change', slideEnd);
  range.addEventListener('pointerup', slideEnd);
  range.addEventListener('pointercancel', slideEnd);

  duel.onChange(render);
  render();
  return { render };
}
