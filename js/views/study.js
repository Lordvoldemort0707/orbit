/* Orbit — Study: flashcards with spaced repetition. The screen's question: what should I revise today?
   Each answer moves a card's next review further out (or back to today), so you only see what you're about to forget. */
(function () {
  'use strict';
  const { u: U } = O;
  const esc = U.esc;
  const S = () => O.store.state;

  /* ------------------------------------------------------------- the deck engine */
  const C = (O.cards = {});
  C.deck = (id) => S().decks.find((d) => d.id === id);
  C.inDeck = (id) => S().cards.filter((c) => c.deckId === id);
  C.isNew = (c) => !c.reps && !c.lapses && !c.lastReview;
  /* new cards are let in a few a day, so a fresh deck of 200 does not land all at once */
  C.newLeftToday = () => {
    const today = U.today();
    const firstSeen = new Set(), seenBefore = new Set();
    for (const r of S().reviews) { if (U.keyOf(r.at) < today) seenBefore.add(r.cardId); else if (!seenBefore.has(r.cardId)) firstSeen.add(r.cardId); }
    return Math.max(0, (S().settings.newCards || 20) - [...firstSeen].filter((id) => !seenBefore.has(id)).length);
  };
  C.queue = (deckId = null) => {
    const today = U.today(), cs = S().cards.filter((c) => !deckId || c.deckId === deckId);
    const due = cs.filter((c) => !C.isNew(c) && (c.due || today) <= today).sort((a, b) => (a.due < b.due ? -1 : 1));
    const fresh = cs.filter(C.isNew).sort((a, b) => a.createdAt - b.createdAt).slice(0, C.newLeftToday());
    return [...due, ...fresh];
  };
  C.dueCount = (deckId = null) => C.queue(deckId).length;
  /* grades: 0 again, 1 hard, 2 good, 3 easy */
  C.next = (c, g) => {
    let ease = c.ease || 2.5, iv = c.interval || 0;
    const reps = c.reps || 0;
    if (g === 0) return { interval: 0, ease: Math.max(1.3, ease - 0.2), reps: 0 };
    if (reps === 0) iv = g === 1 ? 1 : g === 2 ? 1 : 4;
    else if (reps === 1) iv = g === 1 ? 2 : g === 2 ? 3 : 6;
    else iv = Math.round(iv * (g === 1 ? 1.2 : g === 2 ? ease : ease * 1.3));
    ease = g === 1 ? Math.max(1.3, ease - 0.15) : g === 3 ? ease + 0.15 : ease;
    return { interval: Math.max(1, iv), ease: +ease.toFixed(2), reps: reps + 1 };
  };
  C.label = (iv) => (iv === 0 ? 'again today' : iv === 1 ? '1 day' : iv < 30 ? `${iv} days` : iv < 365 ? `${Math.round(iv / 30)} mo` : `${(iv / 365).toFixed(1)} yr`);
  C.answer = (card, g) => {
    const n = C.next(card, g);
    O.store.update((s) => {
      Object.assign(card, n, { due: U.addDays(U.today(), n.interval), lastReview: Date.now(), lapses: (card.lapses || 0) + (g === 0 && card.reps ? 1 : 0) });
      s.reviews.push({ id: U.uid(), cardId: card.id, at: Date.now(), grade: g });
    }, { silent: true });
    return n;
  };
  C.mature = (c) => (c.interval || 0) >= 21;
  /* "front | back", "front - back", "front: back" or tab-separated; one card a line */
  C.parseImport = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.split(/\t| \| | — | – | - |::|: (?=\S)/);
    return m.length >= 2 ? { front: m[0].trim(), back: m.slice(1).join(' ').trim() } : null;
  }).filter((x) => x && x.front && x.back);

  /* ------------------------------------------------------------- dialogs */
  O.deckDialog = (id = null) => {
    const d = id ? C.deck(id) : { name: '' };
    let ans = null;
    const dlg = O.dialog({
      title: id ? 'Rename deck' : 'New deck', cls: 'small',
      body: `<div class="field"><label for="dn">Deck name</label><input id="dn" class="input" value="${esc(d.name)}" placeholder="e.g. DBMS, Spanish, Anatomy" maxlength="60" autocomplete="off"></div>`,
      actions: [
        ...(id ? [{ label: 'Delete deck', danger: true, left: true, onClick: () => { setTimeout(async () => { const n = C.inDeck(id).length; if (await O.confirm({ title: `Delete “${d.name}”?`, text: `Its ${U.plural(n, 'card')} and their review history go with it.`, ok: 'Delete deck' })) { O.store.update((s) => { const ids = new Set(C.inDeck(id).map((c) => c.id)); s.decks = s.decks.filter((x) => x.id !== id); s.cards = s.cards.filter((c) => c.deckId !== id); s.reviews = s.reviews.filter((r) => !ids.has(r.cardId)); }); O.go('#/study'); } }, 0); } }] : []),
        { label: 'Cancel' },
        { label: id ? 'Save' : 'Create deck', primary: true, onClick: (x) => { const v = x.body.querySelector('#dn').value.trim(); if (!v) { x.body.querySelector('#dn').focus(); return false; } O.store.update((s) => { if (id) C.deck(id).name = v; else { ans = U.uid(); s.decks.push({ id: ans, name: v, createdAt: Date.now() }); } }); } },
      ],
      onClose: () => { if (ans) O.go('#/study/deck/' + ans); },
    });
    const i = dlg.body.querySelector('#dn'); i.focus();
    dlg.body.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dlg.el.querySelector('.modal-foot .primary').click(); } });
  };
  O.cardDialog = ({ id = null, deckId = null } = {}) => {
    const c = id ? S().cards.find((x) => x.id === id) : { front: '', back: '', deckId: deckId || (S().decks[0] || {}).id };
    if (!S().decks.length) { O.deckDialog(); return; }
    let added = 0;
    const dlg = O.dialog({
      title: id ? 'Edit card' : 'New card', cls: 'wide',
      body: `<div class="field"><label for="cdk">Deck</label><select id="cdk" class="input">${S().decks.map((d) => `<option value="${d.id}" ${d.id === c.deckId ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="cf">Front: the question</label><textarea id="cf" class="input" style="min-height:76px" placeholder="e.g. What is 3NF?">${esc(c.front)}</textarea></div>
        <div class="field"><label for="cb">Back: the answer</label><textarea id="cb" class="input" style="min-height:96px" placeholder="e.g. 2NF, and no non-key column depends on another non-key column">${esc(c.back)}</textarea></div>
        <p class="hint" id="cadded">${id ? `Next review ${c.due ? esc(U.relDayInline(c.due)) : 'not yet set'} · seen ${c.reps || 0} times in a row` : 'Ctrl + Enter saves and starts the next card.'}</p>`,
      actions: [
        ...(id ? [{ label: 'Delete', danger: true, left: true, onClick: () => { O.store.update((s) => { s.cards = s.cards.filter((x) => x.id !== id); s.reviews = s.reviews.filter((r) => r.cardId !== id); }); O.toast('Card deleted'); } }] : []),
        { label: id ? 'Cancel' : 'Done' },
        ...(id ? [] : [{ label: 'Add and next', onClick: (x) => { save(x); return false; } }]),
        { label: id ? 'Save' : 'Add card', primary: true, onClick: (x) => save(x) },
      ],
    });
    function save(x) {
      const b = x.body, f = b.querySelector('#cf').value.trim(), bk = b.querySelector('#cb').value.trim(), dk = b.querySelector('#cdk').value;
      if (!f) { b.querySelector('#cf').focus(); return false; }
      if (!bk) { b.querySelector('#cb').focus(); return false; }
      O.store.update((s) => { if (id) Object.assign(c, { front: f, back: bk, deckId: dk }); else s.cards.push({ id: U.uid(), deckId: dk, front: f, back: bk, createdAt: Date.now(), reps: 0, ease: 2.5, interval: 0, due: null }); });
      if (!id) { added++; b.querySelector('#cf').value = ''; b.querySelector('#cb').value = ''; b.querySelector('#cf').focus(); b.querySelector('#cadded').textContent = `${U.plural(added, 'card')} added. Keep going, or press Done.`; }
    }
    dlg.body.querySelector('#cf').focus();
    dlg.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); const p = save(dlg); if (id && p !== false) dlg.close(); } });
  };
  O.importDialog = (deckId) => {
    const dlg = O.dialog({
      title: 'Add many cards', cls: 'wide',
      body: `<p class="lead">Paste one card a line, with the question and the answer split by a <b>|</b>, a dash, a colon or a tab. Notes and spreadsheets copy straight in.</p>
        <textarea id="imp" class="input" style="min-height:200px;font-family:inherit" placeholder="Primary key | A column that uniquely identifies each row&#10;Foreign key - A column that refers to a primary key in another table&#10;hola: hello"></textarea>
        <p class="hint" id="impn">Nothing to add yet.</p>`,
      actions: [{ label: 'Cancel' }, { label: 'Add cards', primary: true, onClick: (x) => { const cs = C.parseImport(x.body.querySelector('#imp').value); if (!cs.length) return false; O.store.update((s) => { cs.forEach((c, i) => s.cards.push({ id: U.uid(), deckId, front: c.front, back: c.back, createdAt: Date.now() + i, reps: 0, ease: 2.5, interval: 0, due: null })); }); O.toast(`${U.plural(cs.length, 'card')} added to ${C.deck(deckId).name}.`); } }],
    });
    const ta = dlg.body.querySelector('#imp');
    ta.addEventListener('input', () => { const cs = C.parseImport(ta.value); dlg.body.querySelector('#impn').textContent = cs.length ? `${U.plural(cs.length, 'card')} ready: “${cs[0].front}” → “${cs[0].back}”${cs.length > 1 ? ' and more' : ''}.` : 'Nothing to add yet.'; });
    ta.focus();
  };

  /* ------------------------------------------------------------------ view */
  const mem = { q: '' };
  O.views.study = {
    title: 'Study',
    mount(root, params) {
      const parts = (params.arg || '').split('/');
      const mode = parts[0] === 'review' ? 'review' : parts[0] === 'deck' ? 'deck' : 'home';
      const deckId = parts[1] && parts[1] !== 'all' ? parts[1] : null;
      if (mode === 'deck' && !C.deck(deckId)) { O.go('#/study'); return {}; }
      if (mode === 'review') return review(root, deckId);
      if (mode === 'deck') return deckView(root, deckId);
      return home(root);
    },
  };

  function home(root) {
    root.innerHTML = `
      <header class="title-row"><div><h1>Study</h1><p class="sub" id="sub"></p></div>
        <div class="actions"><button type="button" class="btn" data-new-deck>${O.icon('plus')}New deck</button><a class="btn primary" id="revall" href="#/study/review/all">${O.icon('play', 15)}Review due cards</a></div></header>
      <div class="deck-grid" id="decks"></div>
      <div class="grid" style="margin-top:16px" id="stats"></div>`;
    const $ = (id) => root.querySelector('#' + id);
    let first = true;
    function draw() {
      const s = S(), due = C.dueCount(), today = U.today();
      const streak = O.achievements.all().find((a) => a.key === 'studyStreak');
      const st = streak ? Math.floor(streak.value) : 0;
      $('sub').textContent = s.decks.length ? `${U.plural(due, 'card')} to review today across ${U.plural(s.decks.length, 'deck')}${st ? ` · ${st}-day study streak` : ''}` : 'Make a deck, add a few cards, and Orbit decides when each one comes back.';
      $('revall').classList.toggle('disabled-link', !due);
      $('revall').innerHTML = `${O.icon('play', 15)}${due ? `Review ${due} due` : 'Nothing due'}`;
      $('decks').innerHTML = s.decks.length ? s.decks.map((d) => {
        const cs = C.inDeck(d.id), dq = C.dueCount(d.id), mat = cs.filter(C.mature).length, fresh = cs.filter(C.isNew).length;
        return `<article class="deck">
          <a class="deck-open" href="#/study/deck/${d.id}" aria-label="Open ${esc(d.name)}"></a>
          <div class="deck-top"><span class="deck-ic">${O.icon('study', 20)}</span><div class="deck-name"><h3>${esc(d.name)}</h3><span>${U.plural(cs.length, 'card')}${fresh ? ` · ${fresh} new` : ''}</span></div></div>
          <div class="deck-due"><b class="num">${dq}</b><span>${dq === 1 ? 'card' : 'cards'} due</span></div>
          <div class="bar" title="${mat} of ${cs.length} cards are learned (21 days or more apart)"><i data-grow="${cs.length ? ((mat / cs.length) * 100).toFixed(1) : 0}%" style="width:${cs.length ? ((mat / cs.length) * 100).toFixed(1) : 0}%"></i></div>
          <div class="deck-foot"><span>${cs.length ? Math.round((mat / cs.length) * 100) : 0}% learned</span><span class="deck-btns"><button type="button" class="btn sm" data-add="${d.id}">${O.icon('plus', 14)}Card</button>${dq ? `<a class="btn sm primary" href="#/study/review/${d.id}">Review</a>` : ''}</span></div>
        </article>`;
      }).join('') + `<button type="button" class="deck deck-add" data-new-deck>${O.icon('plus', 20)}<span>New deck</span></button>`
        : `<div class="empty study-empty"><p>Flashcards that come back just before you’d forget them. Great for exams, languages and interview prep.</p><div class="set-actions" style="justify-content:center"><button type="button" class="btn primary" data-new-deck>${O.icon('plus')}Make your first deck</button></div></div>`;
      // reviews over the last 30 days, and how often you remembered
      const days = U.lastDays(30), byDay = {};
      s.reviews.forEach((r) => { const k = U.keyOf(r.at); byDay[k] = (byDay[k] || 0) + 1; });
      const recent = s.reviews.slice(-200), kept = recent.filter((r) => r.grade >= 2).length;
      $('stats').innerHTML = s.reviews.length ? `<section class="panel s7"><div class="panel-head"><h2>Cards reviewed per day</h2><span class="meta">last 30 days · today in colour</span></div><div class="chart" id="rchart"></div></section>
        <section class="panel s5"><div class="panel-head"><h2>How much you remember</h2></div>
          <div class="recall"><div class="ring-box">${O.fx.ring(recent.length ? kept / recent.length : 0, { size: 112, stroke: 9 })}<div class="ring-in"><b class="num">${recent.length ? Math.round((kept / recent.length) * 100) : 0}%</b><span>recalled</span></div></div>
          <div class="recall-list"><div><span>Reviews, all time</span><b class="num">${s.reviews.length.toLocaleString()}</b></div><div><span>Today</span><b class="num">${byDay[today] || 0}</b></div><div><span>Learned cards</span><b class="num">${s.cards.filter(C.mature).length}</b></div><div><span>New a day</span><b class="num">${s.settings.newCards || 20}</b></div></div></div>
          <p class="finding">Of your last ${recent.length} answers, ${kept} were Good or Easy. Around 85–90% means the spacing is right.</p></section>` : '';
      if (s.reviews.length) { const b = document.createElement('div'); root.querySelector('#rchart').appendChild(b); Charts.bars(b, { labels: days.map((k) => U.parseKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), values: days.map((k) => byDay[k] || 0), highlight: 29, height: 176, format: (v) => U.plural(v, 'card'), tickFormat: Charts.fmt.int }); }
      O.fx.grow(root, first); first = false;
    }
    draw();
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-new-deck]')) { O.deckDialog(); return; }
      const a = e.target.closest('[data-add]'); if (a) { e.preventDefault(); O.cardDialog({ deckId: a.dataset.add }); return; }
      if (e.target.closest('#revall.disabled-link')) { e.preventDefault(); O.toast('Nothing is due. Add cards, or come back tomorrow.'); }
    });
    return { refresh: draw };
  }

  function deckView(root, deckId) {
    root.innerHTML = `
      <header class="title-row"><div><a class="card-link back-link" href="#/study">${O.icon('left', 14)}All decks</a><h1 id="dname"></h1><p class="sub" id="sub"></p></div>
        <div class="actions"><button type="button" class="btn" data-rename>${O.icon('edit', 14)}Rename</button><button type="button" class="btn" data-import>${O.icon('upload', 14)}Add many</button><button type="button" class="btn" data-add>${O.icon('plus', 14)}Card</button><a class="btn primary" id="rev" href="#/study/review/${deckId}">${O.icon('play', 15)}Review</a></div></header>
      <div class="task-tools"><label class="search-field">${O.icon('search', 14)}<span class="visually-hidden">Search cards</span><input class="input" id="q" type="search" placeholder="Search cards" value="${esc(mem.q)}"></label><span class="muted" id="count"></span></div>
      <section class="panel"><div class="card-list" id="list"></div></section>`;
    const $ = (id) => root.querySelector('#' + id);
    function draw() {
      const d = C.deck(deckId); if (!d) { O.go('#/study'); return; }
      const cs = C.inDeck(deckId), q = mem.q.trim().toLowerCase(), dq = C.dueCount(deckId);
      $('dname').textContent = d.name;
      $('sub').textContent = `${U.plural(cs.length, 'card')} · ${dq} due today · ${cs.filter(C.mature).length} learned`;
      $('rev').hidden = !dq;
      const shown = cs.filter((c) => !q || (c.front + ' ' + c.back).toLowerCase().includes(q)).sort((a, b) => (a.due || '0') < (b.due || '0') ? -1 : 1);
      $('count').textContent = q ? `${shown.length} of ${cs.length}` : '';
      O.fill($('list'), shown.length ? `<div class="card-row head"><span>Front</span><span>Back</span><span class="n">Next review</span></div>` + shown.map((c) => `<button type="button" class="card-row" data-card="${c.id}"><span class="cf">${esc(c.front)}</span><span class="cb">${esc(c.back)}</span><span class="n">${C.isNew(c) ? '<span class="pill acc">New</span>' : c.due <= U.today() ? '<span class="pill warn">Due</span>' : esc(U.relDay(c.due))}</span></button>`).join('')
        : `<div class="empty">${cs.length ? 'No cards match.' : 'An empty deck. Add cards one by one, or paste a list.'}<div class="set-actions" style="justify-content:center"><button type="button" class="btn sm" data-add>${O.icon('plus', 14)}Card</button><button type="button" class="btn sm" data-import>${O.icon('upload', 14)}Add many</button></div></div>`);
    }
    draw();
    root.addEventListener('input', (e) => { if (e.target.id === 'q') { mem.q = e.target.value; draw(); } });
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) { O.cardDialog({ deckId }); return; }
      if (e.target.closest('[data-import]')) { O.importDialog(deckId); return; }
      if (e.target.closest('[data-rename]')) { O.deckDialog(deckId); return; }
      const c = e.target.closest('[data-card]'); if (c) O.cardDialog({ id: c.dataset.card });
    });
    return { refresh: draw };
  }

  /* ------------------------------------------------------------- a review session */
  function review(root, deckId) {
    const queue = C.queue(deckId).map((c) => c.id);
    const total = queue.length, done = { n: 0, good: 0, again: 0 };
    let shown = false, startXp = O.xp.compute().total;
    const name = deckId ? (C.deck(deckId) || {}).name : 'All decks';
    root.innerHTML = `
      <header class="title-row"><div><a class="card-link back-link" href="#/study">${O.icon('left', 14)}Study</a><h1>${esc(name || 'Review')}</h1><p class="sub" id="sub"></p></div></header>
      <div class="rev-bar"><i id="pbar"></i></div>
      <section class="flash-wrap" id="stage" aria-live="polite"></section>`;
    const $ = (id) => root.querySelector('#' + id);
    function draw() {
      const left = queue.length;
      $('sub').textContent = left ? `${left} to go · ${done.n} reviewed` : `${done.n} reviewed`;
      $('pbar').style.width = total ? `${(done.n / (done.n + left || 1)) * 100}%` : '100%';
      if (!left) {
        const pct = done.n ? Math.round((done.good / done.n) * 100) : 0, gained = O.xp.compute().total - startXp;
        $('stage').innerHTML = `<div class="flash done-card"><div class="flash-face"><span class="done-ic">${O.icon('trophy', 28)}</span><h2>${done.n ? 'Session complete' : 'Nothing to review'}</h2><p>${done.n ? `${U.plural(done.n, 'card')} reviewed · ${pct}% remembered first time${gained > 0 ? ` · +${gained} XP` : ''}` : 'Every card here is scheduled for later. Add new ones, or come back tomorrow.'}</p>
          <div class="set-actions" style="justify-content:center;margin-top:18px"><a class="btn primary" href="#/study">Back to decks</a>${deckId ? `<button type="button" class="btn" data-more>${O.icon('plus', 14)}Add cards</button>` : ''}</div></div></div>`;
        if (done.n) O.fx.confetti({ count: 110 });
        O.store.emit();
        return;
      }
      const c = S().cards.find((x) => x.id === queue[0]);
      if (!c) { queue.shift(); draw(); return; }
      const deck = C.deck(c.deckId);
      const ivs = [0, 1, 2, 3].map((g) => C.next(c, g).interval);
      $('stage').innerHTML = `
        <div class="flash ${shown ? 'flipped' : ''}">
          <div class="flash-meta"><span>${esc(deck ? deck.name : '')}</span><span>${C.isNew(c) ? '<span class="pill acc">New card</span>' : `seen ${c.reps || 0}× in a row`}</span></div>
          <div class="flash-face"><div class="flash-q">${esc(c.front).replace(/\n/g, '<br>')}</div>${shown ? `<div class="flash-sep"></div><div class="flash-a">${esc(c.back).replace(/\n/g, '<br>')}</div>` : ''}</div>
          <div class="flash-actions">${shown ? `
            <button type="button" class="grade g0" data-g="0"><b>Again</b><span>${C.label(ivs[0])}</span><kbd>1</kbd></button>
            <button type="button" class="grade g1" data-g="1"><b>Hard</b><span>${C.label(ivs[1])}</span><kbd>2</kbd></button>
            <button type="button" class="grade g2" data-g="2"><b>Good</b><span>${C.label(ivs[2])}</span><kbd>3</kbd></button>
            <button type="button" class="grade g3" data-g="3"><b>Easy</b><span>${C.label(ivs[3])}</span><kbd>4</kbd></button>`
            : `<button type="button" class="btn primary show-btn" data-show>Show answer <kbd>Space</kbd></button>`}
          </div>
        </div>`;
      const focusEl = $('stage').querySelector(shown ? '[data-g="2"]' : '[data-show]'); if (focusEl) focusEl.focus({ preventScroll: true });
    }
    function grade(g) {
      const c = S().cards.find((x) => x.id === queue[0]); if (!c) return;
      C.answer(c, g);
      done.n++; if (g >= 2) done.good++;
      queue.shift();
      if (g === 0) { queue.splice(Math.min(queue.length, 3), 0, c.id); done.again++; }
      shown = false; draw();
    }
    draw();
    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-show]')) { shown = true; draw(); return; }
      const g = e.target.closest('[data-g]'); if (g) { grade(+g.dataset.g); return; }
      if (e.target.closest('[data-more]')) O.cardDialog({ deckId });
    });
    const onKey = (e) => {
      if (document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (!queue.length) return;
      if (!shown && (e.code === 'Space' || e.key === 'Enter')) { e.preventDefault(); shown = true; draw(); }
      else if (shown && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); grade(+e.key - 1); }
    };
    document.addEventListener('keydown', onKey);
    return { destroy() { document.removeEventListener('keydown', onKey); O.store.emit(); } };
  }
})();
