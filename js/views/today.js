/* Orbit — Today. The screen's question: what is left today, and am I on track?
   Its own element: "Your day", one strip from wake to sleep with the plan, the focus that happened and
   the tasks ticked off, against the time now. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------- shared row renderers */
  O.taskRow = (t, { today = U.today(), selected = false, showList = true, star = false } = {}) => {
    const bits = [];
    if (t.due) {
      if (t.due < today && !t.done) bits.push(`<span class="late">${esc(U.relDay(t.due))}</span>`);
      else if (t.due !== today) bits.push(esc(U.relDay(t.due)));
    }
    if (t.time) bits.push(esc(t.time));
    if (showList && D.listName(t.list)) bits.push(esc(D.listName(t.list)));
    if (t.subtasks && t.subtasks.length) bits.push(`${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length} steps`);
    if (t.repeat) bits.push(esc(D.REPEAT[t.repeat]));
    if (t.goalId && O.goals && O.goals.get(t.goalId)) bits.push(`<span class="goal-tag">${O.icon('goals', 12)}${esc(O.goals.get(t.goalId).title)}</span>`);
    if (t.done && t.doneAt) bits.push('Done ' + (U.keyOf(t.doneAt) === today ? 'at ' + U.timeOf(t.doneAt) : U.relDayInline(U.keyOf(t.doneAt))));
    const prio = (!t.done && t.status === 'doing' ? '<span class="pill acc">Doing</span>' : '') + (!t.done && t.priority === 3 ? '<span class="pill warn">High</span>' : !t.done && t.priority === 2 ? '<span class="pill">Medium</span>' : '');
    return `<div class="rcard link ${t.done ? 'done' : ''}" data-task="${t.id}" aria-selected="${selected}">
      <button type="button" class="open-btn" data-act="open-task" data-id="${t.id}" aria-label="Open ${esc(t.title)}"></button>
      <button type="button" class="check" role="checkbox" aria-checked="${t.done}" data-act="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.title)}">${O.icon('check')}</button>
      <div class="main"><span class="t">${esc(t.title)}</span>${bits.length ? `<span class="s">${bits.join(' · ')}</span>` : ''}</div>
      ${prio || star ? `<div class="side">${prio}${star ? `<button type="button" class="star-btn" data-top="${t.id}" aria-pressed="${t.top === today}" aria-label="${t.top === today ? 'Remove from' : 'Add to'} today’s top 3: ${esc(t.title)}" title="${t.top === today ? 'In today’s top 3' : 'Add to today’s top 3'}">${O.icon(t.top === today ? 'starf' : 'star', 16)}</button>` : ''}</div>` : ''}
    </div>`;
  };
  O.habitCtl = (h, k) => {
    const n = D.countOn(h, k), target = h.target || 1;
    if (target > 1) return `<div class="count-ctl">
        <button type="button" class="step-btn" data-act="habit-dec" data-id="${h.id}" data-day="${k}" aria-label="One less ${esc(h.unit || 'time')} for ${esc(h.name)}"><svg class="ic" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 12h12"/></svg></button>
        <span class="count-val num">${n}<small> /${target}</small></span>
        <button type="button" class="step-btn" data-act="habit-inc" data-id="${h.id}" data-day="${k}" aria-label="One more ${esc(h.unit || 'time')} for ${esc(h.name)}">${O.icon('plus')}</button>
      </div>`;
    return `<button type="button" class="check" role="checkbox" aria-checked="${n >= 1}" data-act="habit-toggle" data-id="${h.id}" data-day="${k}" aria-label="${esc(h.name)}">${O.icon('check')}</button>`;
  };
  /* one click handler for task and habit controls, on any screen */
  O.handleCommon = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return false;
    const { act, id, day } = b.dataset;
    if (act === 'toggle-task') { const was = D.task(id) && D.task(id).done; if (!was) O.fx.burst(b); O.toggleTask(id); return true; }
    if (act === 'open-task') { O.go('#/tasks/' + id); return true; }
    if (act === 'habit-toggle' || act === 'habit-inc' || act === 'habit-dec') {
      const h = D.habit(id); if (!h) return true;
      const before = D.hDone(h, day);
      O.store.update(() => {
        if (act === 'habit-toggle') D.toggleHabit(h, day);
        else D.setCount(h, day, D.countOn(h, day) + (act === 'habit-inc' ? 1 : -1));
      });
      if (!before && D.hDone(h, day)) { O.sound('tick'); O.fx.burst(b, 16); const s = D.streak(h); if (s >= 2 && day === U.today()) O.toast(`${h.name}: ${s}-day streak.`); }
      return true;
    }
    return false;
  };

  /* ------------------------------------------------------- the day strip */
  O.drawDayStrip = (el, k = U.today()) => {
    const s = O.store.state, st = s.settings;
    const w = Math.max(280, el.clientWidth || 600);
    const narrow = w < 520;
    const a = st.dayStart * 60, b = st.dayEnd * 60;
    const padL = narrow ? 44 : 60, padR = 8;
    const lanes = { plan: 22, focus: 76, done: 104 }, axisY = 132, h = 142;
    const x = (m) => padL + ((U.clamp(m, a, b) - a) / (b - a)) * (w - padL - padR);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', '100%'); svg.setAttribute('height', h);
    svg.style.overflow = 'visible';
    // attach first, so labels can be measured and cut to fit their block
    el.innerHTML = '';
    el.appendChild(svg);
    const css = (n) => getComputedStyle(el).getPropertyValue(n).trim();
    const add = (tag, attrs, parent = svg, txt) => { const n = document.createElementNS(NS, tag); for (const [kk, v] of Object.entries(attrs)) n.setAttribute(kk, v); if (txt != null) n.textContent = txt; parent.appendChild(n); return n; };
    const grid = css('--grid'), muted = css('--muted'), accent = css('--accent'), ink = css('--text');
    const step = narrow ? 6 : 3;
    for (let hh = st.dayStart; hh <= st.dayEnd; hh++) {
      const xx = x(hh * 60);
      add('line', { x1: xx, x2: xx, y1: 6, y2: axisY - 14, stroke: grid, 'stroke-width': 1, 'shape-rendering': 'crispEdges', opacity: (hh - st.dayStart) % step === 0 ? 1 : 0.45 });
      if ((hh - st.dayStart) % step === 0) add('text', { x: xx, y: axisY, 'text-anchor': hh === st.dayStart ? 'start' : hh === st.dayEnd ? 'end' : 'middle', 'font-size': 12, fill: muted }, svg, U.hm(hh * 60 % 1440));
    }
    // lane labels
    [['Plan', lanes.plan + 22], ['Focus', lanes.focus + 4], ['Done', lanes.done + 4]].forEach(([t, y]) => add('text', { x: 0, y, 'font-size': 12, fill: muted }, svg, t));
    // planned blocks
    const kinds = { work: ['--kind-work', '--kind-work-edge'], study: ['--kind-study', '--kind-study-edge'], personal: ['--kind-personal', '--kind-personal-edge'], health: ['--kind-health', '--kind-health-edge'] };
    const blocks = D.blocksOn(k);
    for (const bl of blocks) {
      const [f, e] = kinds[bl.kind] || kinds.work;
      const x0 = x(bl.start), x1 = x(bl.end), bw = Math.max(3, x1 - x0 - 2);
      const g = add('g', { class: 'sb', style: 'cursor:pointer' });
      add('title', {}, g, `${bl.title}, ${U.hm(bl.start)}–${U.hm(bl.end)}`);
      add('rect', { x: x0 + 1, y: lanes.plan, width: bw, height: 36, rx: 6, fill: css(f) }, g);
      add('rect', { x: x0 + 1, y: lanes.plan, width: Math.min(3, bw), height: 36, fill: css(e) }, g);
      const label = add('text', { x: x0 + 9, y: lanes.plan + 22, 'font-size': 12, fill: ink }, g, bl.title);
      let room = bw - 14;
      try { if (label.getComputedTextLength() > room) { let t = bl.title; while (t.length > 1 && label.getComputedTextLength() > room) { t = t.slice(0, -1); label.textContent = t + '…'; } if (room < 22) label.remove(); } } catch (_) {}
      g.addEventListener('click', () => O.go('#/planner?date=' + k));
    }
    // focus sessions as they happened
    for (const se of D.sessionsOn(k)) {
      const m0 = U.minsOfTs(se.start), m1 = m0 + se.minutes;
      const r = add('rect', { x: x(m0), y: lanes.focus - 6, width: Math.max(3, x(m1) - x(m0)), height: 10, rx: 3, fill: accent });
      add('title', {}, r, `Focus ${U.timeOf(se.start)}–${U.timeOf(se.end)}, ${se.minutes} min${se.taskId && D.task(se.taskId) ? ': ' + D.task(se.taskId).title : ''}`);
    }
    // tasks ticked off
    for (const t of D.doneOn(k)) {
      const c = add('circle', { cx: x(U.minsOfTs(t.doneAt)), cy: lanes.done, r: 4.5, fill: ink, stroke: css('--surface'), 'stroke-width': 2 });
      add('title', {}, c, `${U.timeOf(t.doneAt)} ${t.title}`);
    }
    // now
    if (k === U.today()) {
      const nm = U.nowMins();
      if (nm >= a && nm <= b) {
        const nx = x(nm);
        add('line', { x1: nx, x2: nx, y1: 2, y2: axisY - 14, stroke: accent, 'stroke-width': 2 });
        const lbl = `Now ${U.hm(nm)}`;
        const tx = add('text', { x: nx + 6, y: 12, 'font-size': 12, 'font-weight': 600, fill: accent }, svg, lbl);
        try { if (nx + 6 + tx.getComputedTextLength() > w) { tx.setAttribute('x', nx - 6); tx.setAttribute('text-anchor', 'end'); } } catch (_) {}
      }
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Your day from ${U.hm(a)} to ${U.hm(b % 1440)}: ${U.plural(blocks.length, 'planned block')}, ${D.focusOn(k)} minutes of focus, ${U.plural(D.doneOn(k).length, 'task')} done.`);
  };
  O.watchWidth = (el, fn) => {
    if (!('ResizeObserver' in window)) return () => {};
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => { if (Math.abs(el.clientWidth - w) > 4) { w = el.clientWidth; fn(); } });
    ro.observe(el);
    return () => ro.disconnect();
  };

  /* ------------------------------------------------------------------ view */
  /* ---------------------------------------------------------- customize Today */
  const DEFAULT_ORDER = ['tiles', 'day', 'tasks', 'habits', 'goals', 'money', 'study', 'journal', 'notes'];
  O.todayOrder = () => { const o = (O.store.state.settings.todayOrder || []).filter((k) => DEFAULT_ORDER.includes(k)); return [...o, ...DEFAULT_ORDER.filter((k) => !o.includes(k))]; };
  O.customizeToday = () => {
    let order = O.todayOrder(), hidden = new Set(O.store.state.settings.todayHidden || []);
    const names = O.TODAY_SECTIONS || {};
    const dlg = O.dialog({ title: 'Customize Today', cls: 'small', body: '<p class="lead">Choose what shows on Today, and in what order.</p><div class="cust-list" id="cust"></div>',
      actions: [{ label: 'Reset', left: true, onClick: () => { order = DEFAULT_ORDER.slice(); hidden = new Set(); draw(); return false; } }, { label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => { O.store.update((s) => { s.settings.todayOrder = order; s.settings.todayHidden = [...hidden]; }); O.route(); } }] });
    const box = dlg.body.querySelector('#cust');
    function draw() {
      box.innerHTML = order.map((k, i) => `<div class="cust-row"><label><input type="checkbox" class="switch" data-show="${k}" ${hidden.has(k) ? '' : 'checked'}><span>${esc((names[k] || {}).name || k)}</span></label><span class="cust-btns"><button type="button" class="icon-btn" data-mv="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${O.icon('up', 16)}</button><button type="button" class="icon-btn" data-mv="${i}" data-d="1" ${i === order.length - 1 ? 'disabled' : ''} aria-label="Move down">${O.icon('down', 16)}</button></span></div>`).join('');
    }
    draw();
    box.addEventListener('change', (e) => { const k = e.target.dataset.show; if (k) { if (e.target.checked) hidden.delete(k); else hidden.add(k); } });
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-mv]'); if (!b) return; const i = +b.dataset.mv, j = i + +b.dataset.d; [order[i], order[j]] = [order[j], order[i]]; draw(); const n = box.querySelector(`[data-mv="${j}"][data-d="${b.dataset.d}"]`) || box.querySelector(`[data-mv="${j}"]`); if (n && !n.disabled) n.focus(); });
  };
  /* a different journal prompt each day */
  const PROMPTS = ['One line about today. What went well, what didn’t?', 'What made you smile today?', 'What did you learn today?', 'What drained your energy today?', 'What are you grateful for right now?', 'What would make tomorrow great?', 'Who helped you today, or who did you help?', 'What did you put off, and why?', 'What surprised you today?', 'If today had a title, what would it be?', 'What will you do differently tomorrow?', 'Which moment would you replay?'];
  O.journalPrompt = (k = U.today()) => PROMPTS[Math.floor(U.parseKey(k).getTime() / 864e5) % PROMPTS.length];

  /* ------------------------------------------------------------------ view */
  O.views.today = {
    title: 'Today',
    mount(root) {
      /* every block below the hero is a section you can hide or move (Customize, top right) */
      const SECTIONS = {
        tiles: { name: 'Counts', wide: true, html: () => `<div class="grid tiles" id="tiles"></div>` },
        day: { name: 'Your day and the focus timer', wide: true, html: () => `<div class="grid">
          <section class="panel s9" aria-labelledby="dayh">
            <div class="panel-head"><h2 id="dayh">Your day</h2><span class="meta" id="daymeta"></span><div class="end"><div class="strip-legend"><span><i class="plan"></i>Planned</span><span><i class="focus"></i>Focus</span><span><i class="task"></i>Task done</span></div><a class="card-link" href="#/planner">Planner${O.icon('right')}</a></div></div>
            <div class="daystrip" id="strip"></div>
          </section>
          <section class="panel s3 mini-timer" aria-labelledby="ftitle" id="mini"></section></div>` },
        tasks: { name: 'Tasks and top 3', html: () => `<section class="panel" aria-labelledby="tt">
            <div class="panel-head"><h2 id="tt">Tasks</h2><span class="count-chip" id="tcount"></span><div class="end"><a class="card-link" href="#/tasks">All tasks${O.icon('right')}</a></div></div>
            <div id="top3"></div>
            <form class="qa" id="qa" autocomplete="off">
              <div class="qa-field">${O.icon('plus')}<input name="q" placeholder="Add a task, e.g. Submit essay tomorrow 5pm !high" aria-label="Add a task"></div>
              <div class="qa-chips" aria-live="polite"></div>
            </form>
            <div class="rcards" id="tlist" style="margin-top:12px"></div>
            <div class="panel-foot" id="tfoot"></div>
          </section>` },
        habits: { name: 'Habits', html: () => `<section class="panel" aria-labelledby="hh">
            <div class="panel-head"><h2 id="hh">Habits</h2><span class="count-chip" id="hcount"></span><div class="end"><a class="card-link" href="#/habits">All habits${O.icon('right')}</a></div></div>
            <div class="rcards" id="hlist"></div>
            <div class="panel-foot" id="hfoot"></div>
          </section>` },
        goals: { name: 'Goals', html: () => `<section class="panel" aria-labelledby="gh">
            <div class="panel-head"><h2 id="gh">Goals</h2><span class="meta" id="gmeta"></span><div class="end"><a class="card-link" href="#/goals">All goals${O.icon('right')}</a></div></div>
            <div class="goal-list" id="glist"></div>
          </section>` },
        money: { name: 'Money', html: () => `<section class="panel" aria-labelledby="mh">
            <div class="panel-head"><h2 id="mh">Money this month</h2><div class="end"><a class="card-link" href="#/money">Money${O.icon('right')}</a></div></div>
            <div id="mtop"></div>
            <form class="qa" id="mqa" autocomplete="off" style="margin-top:12px"><div class="qa-field" style="height:42px">${O.icon('money')}<input placeholder="Log spending: 120 coffee" aria-label="Log spending"></div><div class="qa-chips" aria-live="polite"></div></form>
            <div class="tx-list compact" id="mlist"></div>
          </section>` },
        study: { name: 'Flashcards', html: () => `<section class="panel" aria-labelledby="sth">
            <div class="panel-head"><h2 id="sth">Flashcards</h2><span class="count-chip" id="scount"></span><div class="end"><a class="card-link" href="#/study">Study${O.icon('right')}</a></div></div>
            <div id="slist"></div>
          </section>` },
        journal: { name: 'Mood and journal', html: () => `<section class="panel" aria-labelledby="jh">
            <div class="panel-head"><h2 id="jh">How is today going?</h2><div class="end"><span class="saved-stamp" id="jstamp"></span><a class="card-link" href="#/journal">Journal${O.icon('right')}</a></div></div>
            <div class="moods" id="moods" role="group" aria-label="Mood today"></div>
            <textarea class="input journal-text" id="jtext" placeholder="${esc(O.journalPrompt())}" aria-label="Journal entry for today"></textarea>
          </section>` },
        notes: { name: 'Notes', html: () => `<section class="panel" aria-labelledby="nh">
            <div class="panel-head"><h2 id="nh">Notes</h2><div class="end"><a class="card-link" href="#/notes">All notes${O.icon('right')}</a></div></div>
            <div class="rcards" id="nlist"></div>
            <div class="panel-foot"><span id="nmeta"></span><a class="card-link" href="#/notes/new">New note${O.icon('plus')}</a></div>
          </section>` },
      };
      O.TODAY_SECTIONS = SECTIONS;
      const st0 = O.store.state.settings, hidden = new Set(st0.todayHidden || []);
      const order = O.todayOrder();
      let html = `
        <section class="hero" aria-label="Today at a glance">
          <button type="button" class="icon-btn hero-custom" data-customize aria-label="Customize Today" title="Customize Today">${O.icon('layout', 18)}</button>
          <div class="hero-main">
            <div id="greet"></div>
            <div class="hero-chips" id="chips"></div>
          </div>
          <a class="hero-score" href="#/progress" id="score" aria-label="Today's XP and your level"></a>
        </section>`;
      let group = [];
      const flush = () => {
        if (!group.length) return;
        html += `<div class="today-cols"><div class="today-col">${group.map((k, i) => (i % 2 === 0 ? `<div class="tc" style="order:${i}">${SECTIONS[k].html()}</div>` : '')).join('')}</div><div class="today-col">${group.map((k, i) => (i % 2 === 1 ? `<div class="tc" style="order:${i}">${SECTIONS[k].html()}</div>` : '')).join('')}</div></div>`;
        group = [];
      };
      for (const k of order) {
        if (hidden.has(k) || !SECTIONS[k]) continue;
        if (SECTIONS[k].wide) { flush(); html += SECTIONS[k].html(); } else group.push(k);
      }
      flush();
      if (order.every((k) => hidden.has(k))) html += `<div class="empty" style="margin-top:16px">Every section is hidden.<button type="button" class="btn sm" data-customize>${O.icon('layout', 14)}Customize Today</button></div>`;
      root.innerHTML = html;

      const $ = (id) => root.querySelector('#' + id);
      const has = (id) => !!root.querySelector('#' + id);
      const M = O.money;
      const qa = $('qa'), qin = qa && qa.querySelector('input'), chips = qa && qa.querySelector('.qa-chips');
      const mqa = $('mqa'), min = mqa && mqa.querySelector('input'), mchips = mqa && mqa.querySelector('.qa-chips');
      let first = true;

      function greet() {
        const s = O.store.state, name = s.profile.name.trim();
        $('greet').innerHTML = `<h1>${U.greeting()}${name ? ', ' + esc(name) : ''}.</h1><p class="sub">${esc(U.fmtDate(U.today()))} · ${esc(D.todayFact())}</p>`;
        // the chips: weather, the next countdown, the closest badge
        const out = [];
        const today = U.today();
        if (s.wrapups[today]) out.push(`<a class="chip" href="#/review">${O.icon('check', 16)}<span>Day closed at ${U.timeOf(s.wrapups[today])}</span></a>`);
        else if (U.nowMins() >= 19 * 60) out.push(`<a class="chip hot" href="#/review">${O.icon('review', 16)}<span>Wrap up your day</span><b>2 min</b></a>`);
        const loc = s.settings.location, w = O.weather.cached();
        if (loc && w) { const d = O.weather.describe(w.code); out.push(`<a class="chip" href="#/settings" title="${esc(loc.name)}">${O.icon(d.icon, 16)}<span>${esc(O.weather.line(w))}</span><span class="chip-sub">${esc(loc.name)}</span></a>`); }
        else if (loc) out.push(`<span class="chip">${O.icon('w_cloud', 16)}<span>Getting the weather for ${esc(loc.name)}…</span></span>`);
        else out.push(`<a class="chip ghost" href="#/settings?section=weather">${O.icon('w_partly', 16)}<span>Add your city for weather</span></a>`);
        const cd = O.countdowns.upcoming()[0];
        if (cd) { const n = O.countdowns.daysLeft(cd); out.push(`<a class="chip ${n <= 3 ? 'hot' : ''}" href="#/calendar?date=${cd.date}">${O.icon('hourglass', 16)}<span>${esc(cd.title)}</span><b class="num">${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`}</b></a>`); }
        else out.push(`<a class="chip ghost" href="#/calendar">${O.icon('hourglass', 16)}<span>Add a countdown</span></a>`);
        const streak = D.activeHabits().map((h) => ({ h, s: D.streak(h) })).sort((a, b) => b.s - a.s)[0];
        if (streak && streak.s >= 3) out.push(`<a class="chip" href="#/habits/${streak.h.id}">${O.icon('flame', 16)}<span>${esc(streak.h.name)}</span><b class="num">${streak.s} days</b></a>`);
        $('chips').innerHTML = out.join('');
      }
      function score() {
        const x = O.xp.compute(), t = O.xp.today(), goal = O.store.state.settings.dailyXp || 120;
        $('score').innerHTML = `
          <div class="ring-box">${O.fx.ring(t / goal, { size: 104, stroke: 8 })}<div class="ring-in"><b class="num" data-count="${t}" data-key="today-xp">${t}</b><span>of ${goal} XP</span></div></div>
          <div class="score-side">
            <div class="lvl"><span class="lvl-n num">Level ${x.level}</span><span class="lvl-t">${esc(x.title)}</span></div>
            <div class="xp-bar"><i data-grow="${((x.into / x.need) * 100).toFixed(1)}%" style="width:${((x.into / x.need) * 100).toFixed(1)}%"></i></div>
            <div class="xp-line num">${(x.need - x.into).toLocaleString()} XP to level ${x.level + 1}</div>
          </div>`;
      }
      function tiles() {
        const today = U.today();
        const open = D.openToday(today), overdue = open.filter((t) => t.due < today).length, doneT = D.doneOn(today).length;
        const hs = D.activeHabits().filter((h) => D.isScheduled(h, today));
        const hd = hs.filter((h) => D.hDone(h, today));
        const left = hs.filter((h) => !D.hDone(h, today)).map((h) => h.name);
        const sess = D.sessionsOn(today), fm = D.focusOn(today);
        const mk = M.monthKey(), spent = M.spent(M.inMonth(mk)), spentToday = M.spent(O.store.state.money.tx.filter((t) => t.date === today)), bud = M.totalBudget();
        const tile = (href, label, value, cap, icon) => `<a class="panel tile s3" href="${href}"><span class="tile-label">${O.icon(icon, 15)}${label}</span><span><div class="tile-value">${value}</div><div class="tile-cap">${cap}</div></span></a>`;
        $('tiles').innerHTML =
          tile('#/tasks', 'Tasks left today', `<span data-count="${open.length}" data-key="t-open">${open.length}</span>`, overdue ? `${overdue} overdue · ${doneT} done today` : doneT ? `${doneT} done today` : open.length ? 'Nothing done yet' : 'Nothing due today', 'tasks') +
          tile('#/habits', 'Habits done', hs.length ? `<span data-count="${hd.length}" data-key="h-done">${hd.length}</span><small> /${hs.length}</small>` : '0', !hs.length ? (D.activeHabits().length ? 'None scheduled today' : 'No habits yet') : left.length ? esc(U.andList(left.slice(0, 2)) + (left.length > 2 ? ` and ${left.length - 2} more` : '') + ' left') : 'All done today', 'habits') +
          tile('#/focus', 'Focused today', U.durHtml(fm), sess.length ? U.plural(sess.length, 'session') + ', last at ' + U.timeOf(sess.at(-1).end) : 'No sessions yet', 'focus') +
          tile('#/money', 'Spent this month', esc(M.fmt(spent)), bud ? (spent <= bud ? `${esc(M.fmt(bud - spent))} left of ${esc(M.fmt(bud))}` : `<span class="neg-text">${esc(M.fmt(spent - bud))} over budget</span>`) : `${esc(M.fmt(spentToday))} today`, 'money');
      }
      function tasks() {
        const today = U.today();
        const top = O.top3(today).sort((a, b) => (a.done - b.done) || D.sortTasks(a, b));
        const open = D.openToday(today), done = D.doneOn(today).sort((a, b) => b.doneAt - a.doneAt);
        const rest = open.filter((t) => t.top !== today);
        const shown = rest.slice(0, 5);
        const room = Math.max(0, 5 - shown.length);
        const rows = shown.concat(done.filter((t) => t.top !== today).slice(0, Math.min(room, 2)));
        $('tcount').textContent = open.length;
        $('tcount').setAttribute('aria-label', `${open.length} open`);
        const topDone = top.filter((t) => t.done).length;
        $('top3').innerHTML = top.length ? `<div class="top3 ${topDone === top.length ? 'all-done' : ''}"><div class="top3-head">${O.icon('starf', 15)}<b>Top ${top.length} today</b><span class="num">${topDone}/${top.length} done${topDone === top.length ? ` · +${O.xp.RULES.top3} XP` : ''}</span></div>${top.map((t) => O.taskRow(t, { today, star: true })).join('')}</div>`
          : open.length ? `<div class="top3 hint-top">${O.icon('star', 15)}<span>Star up to three tasks that matter most today. Finish all three for ${O.xp.RULES.top3} XP.</span></div>` : '';
        O.fill($('tlist'), rows.length ? rows.map((t) => O.taskRow(t, { today, star: !t.done })).join('') : top.length ? '' : `<div class="empty">${O.store.state.tasks.some((t) => !t.done) ? 'Nothing due today. Add one above, or give a task from your list today’s date.' : 'Nothing due today. Type a task above and press Enter.'}</div>`);
        $('tfoot').innerHTML = `<span>${rest.length > shown.length ? `${rest.length - shown.length} more open` : `${done.length} done today`}</span>${rest.length > shown.length ? `<a class="card-link" href="#/tasks">View all ${open.length}${O.icon('right')}</a>` : ''}`;
      }
      function study() {
        const s = O.store.state, due = O.cards.dueCount();
        $('scount').textContent = due; $('scount').hidden = !s.decks.length;
        $('slist').innerHTML = s.decks.length ? `<div class="rcards">${s.decks.slice(0, 4).map((d) => { const n = O.cards.dueCount(d.id); return `<a class="rcard link" href="#/study/deck/${d.id}"><div class="main"><span class="t">${esc(d.name)}</span><span class="s">${U.plural(O.cards.inDeck(d.id).length, 'card')}</span></div><div class="side">${n ? `<span class="pill acc">${n} due</span>` : '<span>All caught up</span>'}</div></a>`; }).join('')}</div>
          <div class="panel-foot"><span>${due ? `${U.plural(due, 'card')} waiting, about ${Math.max(1, Math.round(due * 0.15))} min` : 'Nothing due. Nice.'}</span>${due ? `<a class="btn sm primary" href="#/study/review/all">${O.icon('play', 13)}Review</a>` : ''}</div>`
          : `<div class="empty">Flashcards that come back right before you’d forget them.<a class="btn sm" href="#/study">${O.icon('plus')}Make a deck</a></div>`;
      }
      function habits() {
        const today = U.today();
        const all = D.activeHabits(), hs = all.filter((h) => D.isScheduled(h, today));
        const rows = hs.slice(0, 5);
        $('hcount').textContent = `${hs.filter((h) => D.hDone(h, today)).length}/${hs.length}`;
        $('hcount').hidden = !hs.length;
        $('hlist').innerHTML = rows.length ? rows.map((h) => {
          const s = D.streak(h), n = D.countOn(h, today);
          const sub = (h.target || 1) > 1 ? `${n} of ${h.target} ${esc(h.unit || 'times')}${s ? ` · ${s}-day streak` : ''}` : s ? `${s}-day streak` : D.hDone(h, today) ? 'Done today' : 'No streak yet';
          return `<div class="rcard habit-row ${D.hDone(h, today) ? 'is-done' : ''}"><div class="main" style="pointer-events:auto"><a class="t" href="#/habits/${h.id}">${esc(h.name)}</a><span class="s">${s >= 3 ? O.icon('flame', 12) + ' ' : ''}${sub}</span></div><div class="side">${O.habitCtl(h, today)}</div></div>`;
        }).join('') : `<div class="empty">${all.length ? 'No habits are scheduled for today.' : 'Track something small every day: reading, water, a walk.'}<a class="btn sm" href="#/habits/new">${O.icon('plus')}New habit</a></div>`;
        const off = all.length - hs.length;
        $('hfoot').innerHTML = `<span>${hs.length > rows.length ? `${hs.length - rows.length} more today` : off ? `${U.plural(off, 'habit')} not scheduled today` : ''}</span>`;
      }
      function goals() {
        const act = O.goals.active().sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1).slice(0, 3);
        $('gmeta').textContent = O.goals.active().length ? `${O.goals.active().length} in progress` : '';
        $('glist').innerHTML = act.length ? act.map((g) => {
          const p = O.goals.progress(g), next = (g.milestones || []).find((m) => !m.done);
          return `<a class="goal-row" href="#/goals/${g.id}"><div class="goal-row-top"><b>${esc(g.title)}</b><span class="num">${Math.round(p.ratio * 100)}%</span></div><div class="bar"><i data-grow="${(p.ratio * 100).toFixed(1)}%" style="width:${(p.ratio * 100).toFixed(1)}%"></i></div><span class="s">${next ? 'Next: ' + esc(next.title) : `${p.done} of ${p.total} steps`}${g.due ? ` · ${esc(U.diffDays(g.due, U.today()) >= 0 ? U.diffDays(g.due, U.today()) + ' days left' : 'past its date')}` : ''}</span></a>`;
        }).join('') : `<div class="empty">Big things, broken into steps. Your goals show up here with their progress.<a class="btn sm" href="#/goals/new">${O.icon('plus')}New goal</a></div>`;
      }
      function money() {
        const s = O.store.state, mk = M.monthKey(), txs = M.inMonth(mk), spent = M.spent(txs), bud = M.totalBudget();
        const days = new Date(+mk.slice(0, 4), +mk.slice(5), 0).getDate(), day = +U.today().slice(8);
        const r = bud ? spent / bud : null;
        $('mtop').innerHTML = bud ? `<div class="money-top"><div><span class="kpi-label">Spent</span><b class="num">${esc(M.fmt(spent))}</b></div><div><span class="kpi-label">Left</span><b class="num ${spent > bud ? 'neg-text' : ''}">${esc(M.fmt(bud - spent))}</b></div><div><span class="kpi-label">Days left</span><b class="num">${days - day + 1}</b></div></div><div class="bar ${r > 1 ? 'over' : r > day / days ? 'near' : ''}"><i data-grow="${Math.min(100, r * 100).toFixed(1)}%" style="width:${Math.min(100, r * 100).toFixed(1)}%"></i><span class="bar-mark" style="left:${((day / days) * 100).toFixed(1)}%" title="Where you'd be at an even pace"></span></div>`
          : `<div class="money-top"><div><span class="kpi-label">Spent</span><b class="num">${esc(M.fmt(spent))}</b></div><div><span class="kpi-label">Entries</span><b class="num">${txs.length}</b></div><div><a class="card-link" href="#/money">Set a budget${O.icon('right')}</a></div></div>`;
        const last = s.money.tx.slice().sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 3);
        $('mlist').innerHTML = last.map((t) => `<a class="tx" href="#/money"><i class="cat-dot" data-cat="${t.category}"></i><span class="tx-main"><span class="t">${esc(t.note || M.catName(t.category))}</span><span class="s">${esc(M.catName(t.category))} · ${esc(U.relDay(t.date))}</span></span><span class="tx-amt num ${t.type === 'income' ? 'pos-text' : ''}">${t.type === 'income' ? '+' : ''}${esc(M.fmt(t.amount))}</span></a>`).join('');
      }
      function journal() {
        const e = O.store.state.journal[U.today()] || {};
        $('moods').innerHTML = D.MOODS.slice(1).map((m, i) => `<button type="button" class="mood-btn" aria-pressed="${e.mood === i + 1}" data-mood="${i + 1}">${m}</button>`).join('');
        const ta = $('jtext');
        if (document.activeElement !== ta) ta.value = e.text || '';
      }
      function notes() {
        const ns = O.store.state.notes.slice().sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt);
        const rows = ns.slice(0, 4);
        $('nlist').innerHTML = rows.length ? rows.map((n) => `<a class="rcard link" href="#/notes/${n.id}"><div class="main"><span class="t">${n.pinned ? O.icon('pin', 13) + ' ' : ''}${esc(n.title || 'Untitled note')}</span><span class="s">${esc(O.notePreview(n.body) || 'Empty note')}</span></div><div class="side">${esc(U.relDay(U.keyOf(n.updatedAt)))}</div></a>`).join('')
          : `<div class="empty">Notes you pin show up here.<a class="btn sm" href="#/notes/new">${O.icon('plus')}New note</a></div>`;
        $('nmeta').textContent = ns.length ? `${U.plural(ns.length, 'note')}, ${ns.filter((n) => n.pinned).length} pinned` : '';
      }
      function strip() {
        O.drawDayStrip($('strip'));
        const now = U.nowMins(), blocks = D.blocksOn(U.today());
        const planned = blocks.reduce((acc, b) => acc + Math.max(0, b.end - Math.max(b.start, now)), 0);
        const next = blocks.find((b) => b.start >= now) || blocks.find((b) => b.end > now);
        $('daymeta').textContent = next ? (next.start >= now ? `${U.dur(planned)} planned ahead · next: ${next.title} at ${U.hm(next.start)}` : `now: ${next.title} until ${U.hm(next.end)}`) : blocks.length ? 'nothing else planned today' : 'nothing planned yet';
      }
      function mini() {
        const t = O.timer, st = O.store.state.timer, task = st.taskId && D.task(st.taskId);
        const running = t.status() === 'running';
        const snd = O.store.state.settings.ambient;
        $('mini').innerHTML = `
          <div class="panel-head"><h2 id="ftitle">${t.MODES[t.mode()]}</h2><div class="end"><a class="card-link" href="#/focus">Open${O.icon('right')}</a></div></div>
          <div class="timer-time num" id="mt-time">${t.fmt(t.left())}</div>
          <div class="what">${task ? 'On: ' + esc(task.title) : t.mode() === 'focus' ? `${O.store.state.settings.focusMin} min, then a break` : 'Stand up, stretch, look away'}</div>
          <div class="bar"><i id="mt-bar" style="width:${(t.progress() * 100).toFixed(1)}%"></i></div>
          <div class="btns">
            <button type="button" class="btn sm primary" data-act="timer-toggle">${O.icon(running ? 'pause' : 'play', 14)}${running ? 'Pause' : t.status() === 'paused' ? 'Resume' : 'Start'}</button>
            ${t.status() !== 'idle' ? `<button type="button" class="btn sm ghost" data-act="timer-reset">${O.icon('reset', 14)}Reset</button>` : snd && snd !== 'off' ? `<span class="hint">${O.icon('sound', 12)} ${esc(O.ambient.KINDS[snd])}</span>` : ''}
          </div>`;
      }
      const all = () => {
        greet(); score();
        if (has('tiles')) tiles(); if (has('tlist')) tasks(); if (has('hlist')) habits(); if (has('glist')) goals(); if (has('mtop')) money();
        if (has('slist')) study(); if (has('moods')) journal(); if (has('nlist')) notes(); if (has('strip')) strip(); if (has('mini')) mini();
        O.fx.counts(root); O.fx.grow(root, first); first = false;
      };
      all();
      O.weather.get().then((w) => { if (w && root.isConnected) greet(); });

      /* events */
      root.addEventListener('click', (e) => {
        const tp = e.target.closest('[data-top]'); if (tp) { O.toggleTop(tp.dataset.top); return; }
        if (e.target.closest('[data-customize]')) { O.customizeToday(); return; }
        if (O.handleCommon(e)) return;
        const b = e.target.closest('[data-act], [data-mood]');
        if (!b) return;
        if (b.dataset.mood) {
          const m = +b.dataset.mood;
          O.store.update((s) => { const k = U.today(); const cur = s.journal[k] || { mood: 0, text: '' }; cur.mood = cur.mood === m ? 0 : m; delete cur.sample; s.journal[k] = cur; });
          stamp();
          return;
        }
        const act = b.dataset.act;
        if (act === 'timer-toggle') O.timer.toggle();
        if (act === 'timer-reset') O.timer.reset();
      });
      if (qa) qin.addEventListener('input', () => { const p = D.parseQuick(qin.value); chips.innerHTML = qin.value.trim() ? D.quickChips(p).map((c) => `<span class="pill">${esc(c)}</span>`).join('') : ''; });
      if (qa) qa.addEventListener('submit', (e) => { e.preventDefault(); if (O.quickAddTask(qin.value, { due: U.today() })) { qin.value = ''; chips.innerHTML = ''; } });
      if (mqa) min.addEventListener('input', () => { const p = M.parse(min.value); mchips.innerHTML = min.value.trim() && p.amount ? [M.fmt(p.amount), p.type === 'income' ? 'Received' : M.catName(p.category), p.note ? `“${p.note}”` : ''].filter(Boolean).map((c) => `<span class="pill">${esc(c)}</span>`).join('') : ''; });
      if (mqa) mqa.addEventListener('submit', (e) => { e.preventDefault(); if (O.quickMoney(min.value)) { min.value = ''; mchips.innerHTML = ''; } });
      const saveJ = U.debounce(() => {
        if (!has('jtext')) return;
        O.store.update((s) => { const k = U.today(); const cur = s.journal[k] || { mood: 0, text: '' }; cur.text = $('jtext').value; delete cur.sample; if (!cur.text && !cur.mood) delete s.journal[k]; else s.journal[k] = cur; }, { silent: true });
        stamp();
      }, 500);
      function stamp() { if (has('jstamp')) $('jstamp').textContent = 'Saved ' + U.hm(U.nowMins()); }
      if (has('jtext')) { $('jtext').addEventListener('input', saveJ); $('jtext').addEventListener('blur', () => saveJ.flush()); }

      const offTimer = O.timer.on((left) => {
        const el = $('mt-time'); if (!el) return;
        const t = O.timer;
        if (el.textContent !== t.fmt(left)) el.textContent = t.fmt(left);
        const bar = $('mt-bar'); if (bar) bar.style.width = (t.progress() * 100).toFixed(1) + '%';
      });
      let lastStatus = O.timer.status() + O.timer.mode();
      const offTimer2 = O.timer.on(() => { const s = O.timer.status() + O.timer.mode(); if (s !== lastStatus) { lastStatus = s; mini(); } });
      const offW = has('strip') ? O.watchWidth($('strip'), strip) : () => {};
      return {
        refresh: all,
        tick() { greet(); if (has('tiles')) tiles(); if (has('strip')) strip(); },
        destroy() { offTimer(); offTimer2(); offW(); saveJ.flush(); },
      };
    },
  };
})();
