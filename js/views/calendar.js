/* Orbit — Calendar. The screen's question: what is coming up this month?
   Everything with a date in one grid: tasks, plans, habits, spending, moods and countdowns. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const C = O.countdowns, M = O.money;
  const esc = U.esc;
  const mem = { month: null, day: null, on: null };

  O.countdownDialog = (id = null, preset = {}) => {
    const c = id ? O.store.state.countdowns.find((x) => x.id === id) : { title: '', date: preset.date || U.addDays(U.today(), 7), note: '' };
    const dlg = O.dialog({
      title: id ? 'Countdown' : 'New countdown', cls: 'small',
      body: `<div class="field"><label for="cn">What’s coming</label><input id="cn" class="input" value="${esc(c.title)}" placeholder="e.g. DBMS final exam" maxlength="80" autocomplete="off"></div>
        <div class="field"><label for="cdd">Date</label><input id="cdd" class="input" type="date" value="${c.date}"></div>
        <p class="hint">It shows on Today and in the calendar, counting down the days.</p>`,
      actions: [
        ...(id ? [{ label: 'Delete', danger: true, left: true, onClick: () => O.store.update((s) => { s.countdowns = s.countdowns.filter((x) => x.id !== id); }) }] : []),
        { label: 'Cancel' },
        { label: id ? 'Save' : 'Add countdown', primary: true, onClick: (d) => {
          const t = d.body.querySelector('#cn').value.trim(), dt = d.body.querySelector('#cdd').value;
          if (!t) { d.body.querySelector('#cn').focus(); return false; }
          if (!dt) { d.body.querySelector('#cdd').focus(); return false; }
          O.store.update((s) => { if (id) Object.assign(s.countdowns.find((x) => x.id === id), { title: t, date: dt }); else s.countdowns.push({ id: U.uid(), title: t, date: dt, createdAt: Date.now() }); });
        } },
      ],
    });
    const i = dlg.body.querySelector('#cn'); i.focus();
    dlg.body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); dlg.el.querySelector('.modal-foot .primary').click(); } });
  };

  const monthName = (mk) => U.parseKey(mk + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shift = (mk, n) => { const d = U.parseKey(mk + '-01'); d.setMonth(d.getMonth() + n); return U.key(d).slice(0, 7); };

  /* what one day holds, worked out once and used by the grid and the day panel */
  function dayInfo(k) {
    const s = O.store.state, today = U.today();
    const tasks = s.tasks.filter((t) => t.due === k);
    const hs = D.activeHabits().filter((h) => k >= D.habitStart(h) && D.isScheduled(h, k));
    const hd = hs.filter((h) => D.hDone(h, k)).length;
    return {
      tasks, open: tasks.filter((t) => !t.done).length, late: k < today ? tasks.filter((t) => !t.done).length : 0,
      blocks: D.blocksOn(k), habits: hs.length, habitsDone: hd, focus: D.focusOn(k),
      spent: M.spent(s.money.tx.filter((t) => t.date === k)), mood: (s.journal[k] || {}).mood || 0, text: (s.journal[k] || {}).text || '',
      events: s.countdowns.filter((c) => c.date === k), goals: s.goals.filter((g) => g.due === k && !g.done),
      subs: s.money.subs.filter((x) => x.next === k),
    };
  }

  O.views.calendar = {
    title: 'Calendar',
    mount(root, params) {
      if (mem.on !== U.today()) { mem.on = U.today(); mem.month = U.today().slice(0, 7); mem.day = U.today(); }
      const qd = params.query.get('date'); if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) { mem.day = qd; mem.month = qd.slice(0, 7); }
      root.innerHTML = `
        <header class="title-row"><div><h1>Calendar</h1><p class="sub" id="sub"></p></div>
          <div class="actions plan-head">
            <button type="button" class="btn icon" data-m="-1" aria-label="Previous month">${O.icon('left')}</button>
            <button type="button" class="btn" data-m="0">Today</button>
            <button type="button" class="btn icon" data-m="1" aria-label="Next month">${O.icon('right')}</button>
            <button type="button" class="btn primary" data-cd-new>${O.icon('hourglass', 15)}New countdown</button>
          </div></header>
        <div class="cal-layout">
          <section class="panel cal-panel" aria-labelledby="mh"><div class="panel-head"><h2 id="mh"></h2><div class="end cal-key"><span><i class="k-task"></i>Tasks</span><span><i class="k-ev"></i>Countdown</span><span><i class="k-hab"></i>Habits done</span></div></div><div class="cal-grid" id="grid" role="grid"></div></section>
          <aside class="cal-side">
            <section class="panel" id="day" aria-live="polite"></section>
            <section class="panel" aria-labelledby="ch"><div class="panel-head"><h2 id="ch">Countdowns</h2><div class="end"><button type="button" class="card-link" data-cd-new>Add${O.icon('plus')}</button></div></div><div class="cd-list" id="cds"></div></section>
          </aside>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);

      function grid() {
        const mk = mem.month, today = U.today(), ws = O.store.state.settings.weekStart;
        let start = mk + '-01'; while (U.dow(start) !== ws) start = U.addDays(start, -1);
        const cells = U.days(start, 42);
        const lastRowUsed = cells.slice(35).some((k) => k.slice(0, 7) === mk);
        const shown = lastRowUsed ? cells : cells.slice(0, 35);
        $('mh').textContent = monthName(mk);
        const head = Array.from({ length: 7 }, (_, i) => `<div class="cal-dow" role="columnheader">${U.weekdayShort((ws + i) % 7)}</div>`).join('');
        let monthTasks = 0;
        const body = shown.map((k) => {
          const inM = k.slice(0, 7) === mk, info = dayInfo(k);
          if (inM) monthTasks += info.tasks.length;
          const chips = [...info.events.map((c) => `<span class="cal-ev">${esc(c.title)}</span>`), ...info.goals.map((g) => `<span class="cal-ev goal">${esc(g.title)}</span>`)];
          const hr = info.habits ? info.habitsDone / info.habits : 0;
          const label = `${U.fmtDate(k)}: ${U.plural(info.tasks.length, 'task')}${info.events.length ? ', ' + info.events.map((c) => c.title).join(', ') : ''}`;
          return `<button type="button" role="gridcell" class="cal-cell ${inM ? '' : 'out'} ${k === today ? 'today' : ''} ${k === mem.day ? 'sel' : ''} ${U.dow(k) === 0 || U.dow(k) === 6 ? 'wkend' : ''}" data-day="${k}" data-k="d-${k}" aria-label="${esc(label)}" aria-selected="${k === mem.day}">
            <span class="cal-n num">${+k.slice(8)}</span>
            <span class="cal-items">${chips.slice(0, 2).join('')}${info.tasks.length ? `<span class="cal-t ${info.late ? 'late' : ''}">${info.open ? U.plural(info.open, 'task') : info.tasks.length + ' done'}</span>` : ''}${info.blocks.length ? `<span class="cal-b">${U.plural(info.blocks.length, 'block')}</span>` : ''}</span>
            <span class="cal-dots">${info.tasks.length ? '<i class="k-task"></i>' : ''}${info.events.length || info.goals.length ? '<i class="k-ev"></i>' : ''}</span>
            ${info.habits && k <= today ? `<span class="cal-hab" title="${info.habitsDone} of ${info.habits} habits"><i style="width:${(hr * 100).toFixed(0)}%"></i></span>` : ''}
          </button>`;
        }).join('');
        O.fill($('grid'), head + body);
        const evs = O.store.state.countdowns.filter((c) => c.date.slice(0, 7) === mk).length;
        $('sub').textContent = `${monthName(mk)} · ${U.plural(monthTasks, 'task')} with a date${evs ? ` · ${U.plural(evs, 'countdown')}` : ''}`;
        root.querySelector('[data-m="0"]').disabled = mk === today.slice(0, 7) && mem.day === today;
      }
      function day() {
        const k = mem.day, i = dayInfo(k), today = U.today();
        const moodW = i.mood ? D.MOODS[i.mood] : null;
        $('day').innerHTML = `
          <div class="panel-head"><h2>${esc(U.relDay(k) === 'Today' || U.relDay(k) === 'Tomorrow' || U.relDay(k) === 'Yesterday' ? U.relDay(k) + ', ' + U.fmtDate(k, { day: 'numeric', month: 'long' }) : U.fmtDate(k))}</h2></div>
          ${i.events.length || i.goals.length || i.subs.length ? `<div class="day-evs">${i.events.map((c) => `<button type="button" class="day-ev" data-cd="${c.id}">${O.icon('hourglass', 14)}<span>${esc(c.title)}</span></button>`).join('')}${i.goals.map((g) => `<a class="day-ev goal" href="#/goals/${g.id}">${O.icon('goals', 14)}<span>Goal date: ${esc(g.title)}</span></a>`).join('')}${i.subs.map((x) => `<span class="day-ev">${O.icon('money', 14)}<span>${esc(x.name)} renews, ${M.fmt(x.amount)}</span></span>`).join('')}</div>` : ''}
          <div class="day-stats">
            <div><span class="kpi-label">Habits</span><b class="num">${i.habits ? `${i.habitsDone}<small>/${i.habits}</small>` : '–'}</b></div>
            <div><span class="kpi-label">Focus</span><b class="num">${k <= today ? U.durHtml(i.focus) : '–'}</b></div>
            <div><span class="kpi-label">Spent</span><b class="num">${k <= today ? M.fmt(i.spent) : '–'}</b></div>
            <div><span class="kpi-label">Mood</span><b>${moodW || '–'}</b></div>
          </div>
          ${i.text ? `<p class="day-note">“${esc(i.text)}”</p>` : ''}
          <div class="panel-head" style="margin:16px 0 10px"><h2>Tasks</h2><span class="count-chip">${i.tasks.length}</span></div>
          <div class="rcards">${i.tasks.length ? i.tasks.sort(D.sortTasks).slice(0, 6).map((t) => O.taskRow(t, { today })).join('') : `<div class="empty">No tasks due ${esc(U.relDayInline(k))}.</div>`}</div>
          <form class="qa" id="dqa" autocomplete="off" style="margin-top:10px"><div class="qa-field" style="height:40px">${O.icon('plus')}<input placeholder="Add a task for ${esc(U.relDayInline(k))}" aria-label="Add a task for this day"></div></form>
          ${i.blocks.length ? `<div class="panel-head" style="margin:16px 0 10px"><h2>Planned</h2><div class="end"><a class="card-link" href="#/planner?date=${k}">Planner${O.icon('right')}</a></div></div><div class="sess-list">${i.blocks.map((b) => `<div class="sess" style="grid-template-columns:92px 1fr"><span class="when">${U.hm(b.start)}–${U.hm(b.end % 1440)}</span><span class="what"><i class="kind-dot" data-kind="${b.kind}"></i>${esc(b.title)}</span></div>`).join('')}</div>` : `<div class="day-actions"><a class="btn sm" href="#/planner?date=${k}">${O.icon('planner', 14)}Plan this day</a><button type="button" class="btn sm" data-cd-new-day="${k}">${O.icon('hourglass', 14)}Countdown to this day</button></div>`}`;
      }
      function countdowns() {
        const up = C.upcoming();
        $('cds').innerHTML = up.length ? up.slice(0, 6).map((c) => { const n = C.daysLeft(c); return `<button type="button" class="cd" data-cd="${c.id}"><span class="cd-n num">${n === 0 ? 'Today' : n}</span><span class="cd-main"><span class="t">${esc(c.title)}</span><span class="s">${n === 0 ? esc(U.fmtDate(c.date, { weekday: 'long', day: 'numeric', month: 'short' })) : `${n === 1 ? 'day' : 'days'} · ${esc(U.fmtDate(c.date, { weekday: 'short', day: 'numeric', month: 'short' }))}`}</span></span></button>`; }).join('')
          : `<div class="empty">Exams, trips, birthdays, deadlines: add a date and watch the days count down.<button type="button" class="btn sm" data-cd-new>${O.icon('plus')}New countdown</button></div>`;
      }
      const all = () => { grid(); day(); countdowns(); };
      all();

      root.addEventListener('click', (e) => {
        const cell = e.target.closest('[data-day]');
        if (cell) { mem.day = cell.dataset.day; if (mem.day.slice(0, 7) !== mem.month) mem.month = mem.day.slice(0, 7); history.replaceState(null, '', '#/calendar?date=' + mem.day); grid(); day(); if (U.isPhone()) $('day').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        const m = e.target.closest('[data-m]');
        if (m) { const n = +m.dataset.m; if (n === 0) { mem.month = U.today().slice(0, 7); mem.day = U.today(); } else { mem.month = shift(mem.month, n); mem.day = mem.month === U.today().slice(0, 7) ? U.today() : mem.month + '-01'; } all(); return; }
        if (e.target.closest('[data-cd-new]')) { O.countdownDialog(null, { date: mem.day > U.today() ? mem.day : undefined }); return; }
        const nd = e.target.closest('[data-cd-new-day]'); if (nd) { O.countdownDialog(null, { date: nd.dataset.cdNewDay }); return; }
        const cd = e.target.closest('[data-cd]'); if (cd) { O.countdownDialog(cd.dataset.cd); return; }
        O.handleCommon(e);
      });
      root.addEventListener('submit', (e) => { if (e.target.id !== 'dqa') return; e.preventDefault(); const inp = e.target.querySelector('input'); if (O.quickAddTask(inp.value, { due: mem.day })) inp.value = ''; });
      root.addEventListener('keydown', (e) => {
        const cell = e.target.closest('.cal-cell'); if (!cell) return;
        const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!delta) return;
        e.preventDefault(); mem.day = U.addDays(cell.dataset.day, delta); mem.month = mem.day.slice(0, 7); grid(); day();
        const n = root.querySelector(`[data-day="${mem.day}"]`); n && n.focus();
      });
      return { refresh: all, tick: grid };
    },
  };
})();
