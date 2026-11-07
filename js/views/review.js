/* Orbit — Review: wrap up the day, and look back on the week.
   The day's question: what's left, and what are tomorrow's three? The week's: how did it go, and what's next? */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const S = () => O.store.state;
  const M = O.money;

  /* top 3: a task marked for a day; at most three a day */
  O.top3 = (k = U.today()) => S().tasks.filter((t) => t.top === k);
  O.toggleTop = (id, k = U.today()) => {
    const t = D.task(id); if (!t) return;
    if (t.top === k) { O.store.update(() => { t.top = null; }); return; }
    if (O.top3(k).length >= 3) { O.toast(`${U.relDay(k)} already has three. Unstar one first.`); return; }
    O.store.update(() => { t.top = k; if (!t.due || t.due > k) t.due = k; });
  };

  const PROMPTS = [
    ['What went well this week?', 'Wins, small or big.'],
    ['What didn’t go to plan, and why?', 'No blame, just the cause.'],
    ['What’s the one thing that matters most next week?', 'If only one thing gets done.'],
  ];
  const weekKey = (k = U.today()) => { let d = k; while (U.dow(d) !== (S().settings.weekStart ?? 1)) d = U.addDays(d, -1); return d; };

  O.views.review = {
    title: 'Review',
    mount(root, params) {
      const tab = params.arg === 'week' ? 'week' : 'day';
      root.innerHTML = `
        <header class="title-row"><div><h1>${tab === 'week' ? 'Weekly review' : 'Wrap up the day'}</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><div class="seg" role="group" aria-label="Review"><a role="button" class="seg-a" href="#/review" aria-pressed="${tab === 'day'}">Today</a><a role="button" class="seg-a" href="#/review/week" aria-pressed="${tab === 'week'}">This week</a></div></div></header>
        <div id="body"></div>`;
      return tab === 'week' ? week(root) : day(root);
    },
  };

  /* ------------------------------------------------------------------ the day */
  function day(root) {
    const $ = (id) => root.querySelector('#' + id);
    const today = U.today(), tmr = U.addDays(today, 1);
    $('body').innerHTML = `
      <div class="kpis" id="kpis"></div>
      <div class="grid top" style="margin-top:16px">
        <section class="panel s7" aria-labelledby="oh"><div class="panel-head"><h2 id="oh">Still open</h2><span class="count-chip" id="ocount"></span><div class="end"><button type="button" class="btn sm" id="moveall">${O.icon('right', 14)}Move all to tomorrow</button></div></div><div class="rcards" id="open"></div></section>
        <section class="panel s5" aria-labelledby="wh"><div class="panel-head"><h2 id="wh">Done today</h2><span class="count-chip" id="dcount"></span></div><div class="wins" id="wins"></div></section>
      </div>
      <div class="grid top">
        <section class="panel s7" aria-labelledby="th"><div class="panel-head"><h2 id="th">Tomorrow’s top 3</h2><span class="meta" id="tmeta"></span></div><p class="hint" style="margin:-6px 0 12px">Star up to three. They head Today tomorrow, and finishing all three is worth ${O.xp.RULES.top3} XP.</p><div class="rcards" id="picks"></div></section>
        <section class="panel s5" aria-labelledby="jh"><div class="panel-head"><h2 id="jh">How was today?</h2><span class="saved-stamp" id="jstamp"></span></div>
          <div class="moods" id="moods" role="group" aria-label="Mood today"></div>
          <textarea class="input journal-text" id="jt" style="min-height:120px" placeholder="One line to remember today by."></textarea></section>
      </div>
      <div class="close-day" id="close"></div>`;
    function draw() {
      const s = S(), done = D.doneOn(today).sort((a, b) => a.doneAt - b.doneAt), open = D.openToday(today);
      const hs = D.activeHabits().filter((h) => D.isScheduled(h, today)), hd = hs.filter((h) => D.hDone(h, today)).length;
      const xp = O.xp.today(), spent = M.spent(s.money.tx.filter((t) => t.date === today)), cards = s.reviews.filter((r) => U.keyOf(r.at) === today).length;
      const closed = s.wrapups[today];
      $('sub').textContent = closed ? `Day closed at ${U.timeOf(closed)}. You can still change anything below.` : `${U.fmtDate(today)} · ${open.length ? `${U.plural(open.length, 'task')} still open` : 'nothing left open'} · ${xp} XP so far`;
      $('kpis').innerHTML = [
        ['Tasks done', done.length], ['Focus', U.durHtml(D.focusOn(today))], ['Habits', hs.length ? `${hd}<small> /${hs.length}</small>` : '–'], ['Cards reviewed', cards], ['XP today', xp], ['Spent', esc(M.fmt(spent))],
      ].map(([l, v]) => `<div class="kpi"><div class="kpi-label">${l}</div><div class="kpi-value num">${v}</div></div>`).join('');
      $('ocount').textContent = open.length;
      $('moveall').hidden = !open.length;
      O.fill($('open'), open.length ? open.map((t) => `<div class="rcard">
          <button type="button" class="check" role="checkbox" aria-checked="false" data-act="toggle-task" data-id="${t.id}" aria-label="Done: ${esc(t.title)}">${O.icon('check')}</button>
          <div class="main"><span class="t">${esc(t.title)}</span><span class="s">${t.due < today ? `<span class="late">${esc(U.relDay(t.due))}</span> · ` : ''}${esc(D.listName(t.list))}</span></div>
          <div class="side move-btns"><button type="button" class="btn sm" data-move="${t.id}" data-to="tmr">Tomorrow</button><button type="button" class="btn sm ghost" data-move="${t.id}" data-to="week">Next week</button><button type="button" class="btn sm ghost" data-move="${t.id}" data-to="none" title="Move to Anytime">No date</button></div>
        </div>`).join('') : `<div class="empty">Everything due today is done. Nothing to carry over.</div>`);
      $('dcount').textContent = done.length;
      const ms = s.goals.flatMap((g) => (g.milestones || []).filter((m) => m.done && m.doneAt && U.keyOf(m.doneAt) === today).map((m) => ({ g, m })));
      $('wins').innerHTML = done.length || ms.length ? ms.map(({ g, m }) => `<div class="win goal">${O.icon('goals', 14)}<span>${esc(m.title)} <span class="muted">· ${esc(g.title)}</span></span></div>`).join('') + done.map((t) => `<div class="win">${O.icon('check', 14)}<span>${esc(t.title)}</span><span class="muted num">${U.timeOf(t.doneAt)}</span></div>`).join('')
        : `<div class="empty">Nothing ticked off yet today.</div>`;
      // tomorrow's picks: due tomorrow first, then today's leftovers, then the rest
      const picks = s.tasks.filter((t) => !t.done).sort((a, b) => { const r = (t) => (t.top === tmr ? 0 : t.due === tmr ? 1 : t.due && t.due <= today ? 2 : !t.due ? 4 : 3); return r(a) - r(b) || D.sortTasks(a, b); }).slice(0, 8);
      const n = O.top3(tmr).length;
      $('tmeta').textContent = `${n} of 3 picked`;
      O.fill($('picks'), picks.length ? picks.map((t) => `<div class="rcard ${t.top === tmr ? 'is-top' : ''}"><button type="button" class="star-btn" data-top="${t.id}" aria-pressed="${t.top === tmr}" aria-label="${t.top === tmr ? 'Remove from' : 'Add to'} tomorrow’s top 3: ${esc(t.title)}">${O.icon(t.top === tmr ? 'starf' : 'star', 18)}</button><div class="main"><span class="t">${esc(t.title)}</span><span class="s">${t.due ? esc(U.relDay(t.due)) : 'No date'} · ${esc(D.listName(t.list))}</span></div>${t.priority === 3 ? '<div class="side"><span class="pill warn">High</span></div>' : ''}</div>`).join('') : '<div class="empty">No open tasks to choose from. Add one on Today.</div>');
      const e = s.journal[today] || {};
      $('moods').innerHTML = D.MOODS.slice(1).map((m, i) => `<button type="button" class="mood-btn" aria-pressed="${e.mood === i + 1}" data-mood="${i + 1}">${m}</button>`).join('');
      if (document.activeElement !== $('jt')) $('jt').value = e.text || '';
      $('close').innerHTML = closed ? `<p class="muted">${O.icon('check', 14)} Closed at ${U.timeOf(closed)}. Sleep well.</p><button type="button" class="btn ghost" data-reopen>Reopen the day</button>`
        : `<button type="button" class="btn primary big" data-close>${O.icon('moon', 16)}Close the day</button><p class="hint">Worth ${O.xp.RULES.wrapup} XP. Open tasks are moved only if you chose to.</p>`;
    }
    draw();
    const saveJ = U.debounce(() => { O.store.update((s) => { const cur = s.journal[today] || { mood: 0, text: '' }; cur.text = $('jt').value; delete cur.sample; if (!cur.text && !cur.mood) delete s.journal[today]; else s.journal[today] = cur; }, { silent: true }); $('jstamp').textContent = 'Saved ' + U.hm(U.nowMins()); }, 500);
    root.addEventListener('input', (e) => { if (e.target.id === 'jt') saveJ(); });
    root.addEventListener('focusout', (e) => { if (e.target.id === 'jt') saveJ.flush(); });
    root.addEventListener('click', (e) => {
      if (O.handleCommon(e)) return;
      const mv = e.target.closest('[data-move]');
      if (mv) { const t = D.task(mv.dataset.move), to = mv.dataset.to; let k = to === 'tmr' ? tmr : null; if (to === 'week') { k = U.addDays(today, 1); while (U.dow(k) !== 1) k = U.addDays(k, 1); } O.store.update(() => { t.due = k; if (t.top && t.top <= today) t.top = null; }); O.toast(`Moved “${t.title}” to ${k ? U.relDayInline(k) : 'Anytime'}.`); return; }
      if (e.target.closest('#moveall')) {
        const open = D.openToday(today), was = open.map((t) => [t, t.due, t.top]);
        O.store.update(() => { open.forEach((t) => { t.due = tmr; if (t.top && t.top <= today) t.top = null; }); });
        O.toast(`Moved ${U.plural(open.length, 'task')} to tomorrow.`, { action: 'Undo', onAction: () => O.store.update(() => { was.forEach(([t, due, top]) => { t.due = due; t.top = top; }); }) });
        return;
      }
      const st = e.target.closest('[data-top]'); if (st) { O.toggleTop(st.dataset.top, tmr); return; }
      const m = e.target.closest('[data-mood]'); if (m) { const v = +m.dataset.mood; O.store.update((s) => { const cur = s.journal[today] || { mood: 0, text: '' }; cur.mood = cur.mood === v ? 0 : v; delete cur.sample; s.journal[today] = cur; }); return; }
      if (e.target.closest('[data-close]')) { saveJ.flush(); O.store.update((s) => { s.wrapups[today] = Date.now(); }); O.fx.confetti({ count: 120 }); O.toast(`Day closed. +${O.xp.RULES.wrapup} XP. See you tomorrow.`); return; }
      if (e.target.closest('[data-reopen]')) O.store.update((s) => { delete s.wrapups[today]; });
    });
    return { refresh: draw, destroy() { saveJ.flush(); } };
  }

  /* ----------------------------------------------------------------- the week */
  function week(root) {
    const $ = (id) => root.querySelector('#' + id);
    const today = U.today(), days = U.lastDays(7), prev = U.lastDays(7, U.addDays(today, -7)), wk = weekKey();
    $('body').innerHTML = `
      <div class="kpis five" id="kpis"></div>
      <div class="grid top" style="margin-top:16px">
        <section class="panel s7" aria-labelledby="wh"><div class="panel-head"><h2 id="wh">Wins</h2><span class="meta">last 7 days</span></div><div class="wins" id="wins"></div></section>
        <section class="panel s5" aria-labelledby="hh"><div class="panel-head"><h2 id="hh">Habits this week</h2></div><div id="habs"></div></section>
      </div>
      <div class="grid top">
        <section class="panel s5" aria-labelledby="nh"><div class="panel-head"><h2 id="nh">The next 7 days</h2></div><div id="next"></div></section>
        <section class="panel s7" aria-labelledby="rh"><div class="panel-head"><h2 id="rh">Reflect</h2><span class="saved-stamp" id="rstamp"></span><div class="end"><button type="button" class="btn sm" id="tonote">${O.icon('notes', 14)}Save as a note</button></div></div>
          <div class="reflect" id="reflect"></div></section>
      </div>`;
    const sum = (ks, f) => ks.reduce((a, k) => a + f(k), 0);
    const habitRate = (ks) => { let due = 0, ok = 0; for (const h of D.activeHabits()) for (const k of ks) { if (k < D.habitStart(h) || !D.isScheduled(h, k) || (k === today && !D.hDone(h, k))) continue; due++; if (D.hDone(h, k)) ok++; } return due ? ok / due : null; };
    const moodAvg = (ks) => { const ms = ks.map((k) => (S().journal[k] || {}).mood).filter(Boolean); return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null; };
    function draw() {
      const s = S();
      const cur = { tasks: sum(days, (k) => D.doneOn(k).length), focus: sum(days, D.focusOn), habits: habitRate(days), spent: M.spent(s.money.tx.filter((t) => days.includes(t.date))), mood: moodAvg(days) };
      const was = { tasks: sum(prev, (k) => D.doneOn(k).length), focus: sum(prev, D.focusOn), habits: habitRate(prev), spent: M.spent(s.money.tx.filter((t) => prev.includes(t.date))), mood: moodAvg(prev) };
      const best = days.map((k) => ({ k, n: D.doneOn(k).length })).sort((a, b) => b.n - a.n)[0];
      $('sub').textContent = `${U.short(days[0])} – ${U.short(days[6])} · ${cur.tasks} tasks, ${U.dur(cur.focus)} of focus${best && best.n ? ` · best day ${U.relDayInline(best.k)} with ${best.n}` : ''}`;
      const delta = (a, b, fmt, goodUp = true) => { if (a == null || b == null) return '<div class="delta">–</div>'; const d = a - b; if (Math.abs(d) < 1e-9) return '<div class="delta">Same as the week before</div>'; const good = goodUp ? d > 0 : d < 0; return `<div class="delta"><span class="${good ? 'good' : 'bad'}">${fmt(d)}</span> vs the 7 days before</div>`; };
      $('kpis').innerHTML = `
        <div class="kpi"><div class="kpi-label">Tasks done</div><div class="kpi-value num">${cur.tasks}</div>${delta(cur.tasks, was.tasks, (d) => U.signed(d))}</div>
        <div class="kpi"><div class="kpi-label">Focus</div><div class="kpi-value num">${U.durHtml(cur.focus)}</div>${delta(cur.focus, was.focus, (d) => U.signed(d, U.dur))}</div>
        <div class="kpi"><div class="kpi-label">Habit days kept</div><div class="kpi-value num">${cur.habits == null ? '–' : Math.round(cur.habits * 100) + '<small>%</small>'}</div>${delta(cur.habits, was.habits, (d) => U.signed(Math.round(d * 100)) + ' pts')}</div>
        <div class="kpi"><div class="kpi-label">Spent</div><div class="kpi-value num">${esc(M.fmt(cur.spent))}</div>${delta(cur.spent, was.spent, (d) => M.fmt(d, { sign: true }), false)}</div>
        <div class="kpi"><div class="kpi-label">Mood</div><div class="kpi-value num">${cur.mood == null ? '–' : `${D.MOODS[Math.round(cur.mood)]}<small> ${cur.mood.toFixed(1)}</small>`}</div>${delta(cur.mood, was.mood, (d) => U.signed(+d.toFixed(1)))}</div>`;
      // wins: milestones, goals, high-priority tasks, badges, the longest streaks
      const inWeek = (ts) => ts && days.includes(U.keyOf(ts));
      const wins = [
        ...s.goals.filter((g) => g.done && inWeek(g.doneAt)).map((g) => ({ ic: 'trophy', t: `Achieved: ${g.title}`, cls: 'goal' })),
        ...s.goals.flatMap((g) => (g.milestones || []).filter((m) => m.done && inWeek(m.doneAt)).map((m) => ({ ic: 'goals', t: m.title, sub: g.title, cls: 'goal' }))),
        ...s.tasks.filter((t) => t.done && t.priority >= 2 && inWeek(t.doneAt)).sort((a, b) => b.priority - a.priority || b.doneAt - a.doneAt).slice(0, 6).map((t) => ({ ic: 'check', t: t.title, sub: U.relDay(U.keyOf(t.doneAt)) })),
        ...O.achievements.all().filter((a) => a.at && inWeek(a.at)).sort((a, b) => b.at - a.at).slice(0, 3).map((a) => ({ ic: a.icon, t: `Badge: ${a.name}`, cls: 'badge' })),
      ];
      $('wins').innerHTML = wins.length ? wins.slice(0, 12).map((w) => `<div class="win ${w.cls || ''}">${O.icon(w.ic, 14)}<span>${esc(w.t)}${w.sub ? ` <span class="muted">· ${esc(w.sub)}</span>` : ''}</span></div>`).join('') : '<div class="empty">Finish a high-priority task or reach a milestone and it shows up here.</div>';
      // habits as a 7-day strip each
      const hs = D.activeHabits();
      $('habs').innerHTML = hs.length ? `<div class="week-habs">${hs.map((h) => { const r = habitRate.call(null, days); const cells = days.map((k) => { const ok = D.hDone(h, k), sch = D.isScheduled(h, k); return `<i class="${ok ? 'd' : sch && k < today ? 'm' : 'o'}" title="${esc(U.fmtDate(k, { weekday: 'short', day: 'numeric' }))}: ${ok ? 'done' : sch ? 'not done' : 'not scheduled'}"></i>`; }).join(''); const n = days.filter((k) => D.hDone(h, k)).length; return `<div class="wh"><span class="t">${esc(h.name)}</span><span class="cells">${cells}</span><span class="num">${n}/${days.filter((k) => D.isScheduled(h, k) && k >= D.habitStart(h)).length}</span></div>`; }).join('')}</div>` : '<div class="empty">No habits yet.</div>';
      // what's coming
      const ahead = U.days(U.addDays(today, 1), 7);
      const cds = s.countdowns.filter((c) => ahead.includes(c.date));
      const subs = s.money.subs.filter((x) => ahead.includes(x.next));
      const gds = s.goals.filter((g) => !g.done && ahead.includes(g.due));
      const dueBy = ahead.map((k) => ({ k, n: s.tasks.filter((t) => !t.done && t.due === k).length }));
      $('next').innerHTML = `${cds.length || subs.length || gds.length ? `<div class="day-evs">${cds.map((c) => `<a class="day-ev" href="#/calendar?date=${c.date}">${O.icon('hourglass', 14)}<span>${esc(c.title)} · ${esc(U.relDayInline(c.date))}</span></a>`).join('')}${gds.map((g) => `<a class="day-ev goal" href="#/goals/${g.id}">${O.icon('goals', 14)}<span>Goal date: ${esc(g.title)}</span></a>`).join('')}${subs.map((x) => `<span class="day-ev">${O.icon('money', 14)}<span>${esc(x.name)} renews ${esc(U.relDayInline(x.next))}, ${esc(M.fmt(x.amount))}</span></span>`).join('')}</div>` : ''}
        <div class="next-days">${dueBy.map(({ k, n }) => `<a href="#/calendar?date=${k}" class="nd"><span>${U.weekdayShort(U.dow(k))}</span><b class="num">${n}</b><i style="height:${Math.min(100, n * 18)}%"></i></a>`).join('')}</div><p class="hint">Tasks due each day ahead.</p>`;
      // the reflection keeps its draft per week
      const draft = (s.weekly[wk] || {}).answers || [];
      O.fill($('reflect'), PROMPTS.map(([q, h], i) => `<div class="field"><label for="rq${i}">${q}</label><textarea id="rq${i}" class="input" data-q="${i}" placeholder="${h}" style="min-height:76px">${esc(draft[i] || '')}</textarea></div>`).join(''));
    }
    draw();
    const saveR = U.debounce(() => {
      O.store.update((s) => { s.weekly[wk] = { answers: PROMPTS.map((_, i) => (root.querySelector('#rq' + i) || {}).value || ''), at: Date.now(), noteId: (s.weekly[wk] || {}).noteId || null }; }, { silent: true });
      $('rstamp').textContent = 'Saved ' + U.hm(U.nowMins());
    }, 500);
    root.addEventListener('input', (e) => { if (e.target.dataset.q != null) saveR(); });
    root.addEventListener('focusout', (e) => { if (e.target.dataset.q != null) saveR.flush(); });
    root.addEventListener('click', (e) => {
      if (!e.target.closest('#tonote')) return;
      saveR.flush();
      const w = S().weekly[wk] || { answers: [] };
      if (!w.answers.some((a) => a.trim())) { O.toast('Write something first.'); root.querySelector('#rq0').focus(); return; }
      const title = `Weekly review, ${U.short(days[0])} – ${U.short(days[6])}`;
      const body = PROMPTS.map(([q], i) => `## ${q}\n\n${(w.answers[i] || '').trim() || '–'}`).join('\n\n') + '\n\n#review';
      let id = w.noteId;
      O.store.update((s) => { const n = id && s.notes.find((x) => x.id === id); if (n) Object.assign(n, { title, body, updatedAt: Date.now() }); else { id = U.uid(); s.notes.unshift({ id, title, body, pinned: false, createdAt: Date.now(), updatedAt: Date.now() }); } s.weekly[wk].noteId = id; });
      O.toast('Saved to Notes.', { action: 'Open', onAction: () => O.go('#/notes/' + id) });
    });
    return { refresh: draw, destroy() { saveR.flush(); } };
  }
})();
