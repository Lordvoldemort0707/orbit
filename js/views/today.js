/* Orbit — Today. The screen's question: what is left today, and am I on track?
   Its own element: "Your day", one strip from wake to sleep with the plan, the focus that happened and
   the tasks ticked off, against the time now. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const NS = 'http://www.w3.org/2000/svg';

  /* ------------------------------------------------- shared row renderers */
  O.taskRow = (t, { today = U.today(), selected = false, showList = true } = {}) => {
    const bits = [];
    if (t.due) {
      if (t.due < today && !t.done) bits.push(`<span class="late">${esc(U.relDay(t.due))}</span>`);
      else if (t.due !== today) bits.push(esc(U.relDay(t.due)));
    }
    if (t.time) bits.push(esc(t.time));
    if (showList && D.listName(t.list)) bits.push(esc(D.listName(t.list)));
    if (t.subtasks && t.subtasks.length) bits.push(`${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length} steps`);
    if (t.repeat) bits.push(esc(D.REPEAT[t.repeat]));
    if (t.done && t.doneAt) bits.push('Done ' + (U.keyOf(t.doneAt) === today ? 'at ' + U.timeOf(t.doneAt) : U.relDayInline(U.keyOf(t.doneAt))));
    const prio = !t.done && t.priority === 3 ? '<span class="pill warn">High</span>' : !t.done && t.priority === 2 ? '<span class="pill">Medium</span>' : '';
    return `<div class="rcard link ${t.done ? 'done' : ''}" data-task="${t.id}" aria-selected="${selected}">
      <button type="button" class="open-btn" data-act="open-task" data-id="${t.id}" aria-label="Open ${esc(t.title)}"></button>
      <button type="button" class="check" role="checkbox" aria-checked="${t.done}" data-act="toggle-task" data-id="${t.id}" aria-label="${t.done ? 'Mark not done' : 'Mark done'}: ${esc(t.title)}">${O.icon('check')}</button>
      <div class="main"><span class="t">${esc(t.title)}</span>${bits.length ? `<span class="s">${bits.join(' · ')}</span>` : ''}</div>
      ${prio ? `<div class="side">${prio}</div>` : ''}
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
    if (act === 'toggle-task') { O.toggleTask(id); return true; }
    if (act === 'open-task') { O.go('#/tasks/' + id); return true; }
    if (act === 'habit-toggle' || act === 'habit-inc' || act === 'habit-dec') {
      const h = D.habit(id); if (!h) return true;
      const before = D.hDone(h, day);
      O.store.update(() => {
        if (act === 'habit-toggle') D.toggleHabit(h, day);
        else D.setCount(h, day, D.countOn(h, day) + (act === 'habit-inc' ? 1 : -1));
      });
      if (!before && D.hDone(h, day)) { O.sound('tick'); const s = D.streak(h); if (s >= 2 && day === U.today()) O.toast(`${h.name}: ${s}-day streak.`); }
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
  O.views.today = {
    title: 'Today',
    mount(root) {
      root.innerHTML = `
        <header class="greet"><div id="greet"></div><div class="actions"><button type="button" class="btn primary" data-act="new-task">${O.icon('plus')}New task</button></div></header>
        <div class="grid tiles" id="tiles"></div>
        <div class="grid">
          <section class="panel s9" aria-labelledby="dayh">
            <div class="panel-head"><h2 id="dayh">Your day</h2><div class="end"><div class="strip-legend"><span><i class="plan"></i>Planned</span><span><i class="focus"></i>Focus</span><span><i class="task"></i>Task done</span></div><a class="card-link" href="#/planner">Planner${O.icon('right')}</a></div></div>
            <div class="daystrip" id="strip"></div>
          </section>
          <section class="panel s3 mini-timer" aria-labelledby="ftitle" id="mini"></section>
        </div>
        <div class="grid">
          <section class="panel s6" aria-labelledby="tt">
            <div class="panel-head"><h2 id="tt">Tasks</h2><span class="count-chip" id="tcount"></span><div class="end"><a class="card-link" href="#/tasks">All tasks${O.icon('right')}</a></div></div>
            <form class="qa" id="qa" autocomplete="off">
              <div class="qa-field">${O.icon('plus')}<input name="q" placeholder="Add a task, e.g. Submit essay tomorrow 5pm !high" aria-label="Add a task"></div>
              <div class="qa-chips" aria-live="polite"></div>
            </form>
            <div class="rcards" id="tlist" style="margin-top:12px"></div>
            <div class="panel-foot" id="tfoot"></div>
          </section>
          <section class="panel s6" aria-labelledby="hh">
            <div class="panel-head"><h2 id="hh">Habits</h2><span class="count-chip" id="hcount"></span><div class="end"><a class="card-link" href="#/habits">All habits${O.icon('right')}</a></div></div>
            <div class="rcards" id="hlist"></div>
            <div class="panel-foot" id="hfoot"></div>
          </section>
        </div>
        <div class="grid">
          <section class="panel s6" aria-labelledby="jh">
            <div class="panel-head"><h2 id="jh">How is today going?</h2><div class="end"><span class="saved-stamp" id="jstamp"></span><a class="card-link" href="#/journal">Journal${O.icon('right')}</a></div></div>
            <div class="moods" id="moods" role="group" aria-label="Mood today"></div>
            <textarea class="input journal-text" id="jtext" placeholder="One line about today. What went well, what didn’t?" aria-label="Journal entry for today"></textarea>
          </section>
          <section class="panel s6" aria-labelledby="nh">
            <div class="panel-head"><h2 id="nh">Notes</h2><div class="end"><a class="card-link" href="#/notes">All notes${O.icon('right')}</a></div></div>
            <div class="rcards" id="nlist"></div>
            <div class="panel-foot"><span id="nmeta"></span><a class="card-link" href="#/notes/new">New note${O.icon('plus')}</a></div>
          </section>
        </div>`;

      const $ = (id) => root.querySelector('#' + id);
      const qa = $('qa'), qin = qa.querySelector('input'), chips = qa.querySelector('.qa-chips');

      function greet() {
        const s = O.store.state, name = s.profile.name.trim();
        $('greet').innerHTML = `<h1>${U.greeting()}${name ? ', ' + esc(name) : ''}.</h1><p class="sub">${esc(U.fmtDate(U.today()))} · ${esc(D.todayFact())}</p>`;
      }
      function tiles() {
        const today = U.today(), now = U.nowMins();
        const open = D.openToday(today), overdue = open.filter((t) => t.due < today).length, doneT = D.doneOn(today).length;
        const hs = D.activeHabits().filter((h) => D.isScheduled(h, today));
        const hd = hs.filter((h) => D.hDone(h, today));
        const left = hs.filter((h) => !D.hDone(h, today)).map((h) => h.name);
        const sess = D.sessionsOn(today), fm = D.focusOn(today);
        const blocks = D.blocksOn(today);
        const planned = blocks.reduce((acc, b) => acc + Math.max(0, b.end - Math.max(b.start, now)), 0);
        const next = blocks.find((b) => b.start >= now) || blocks.find((b) => b.end > now);
        const tile = (href, label, value, cap) => `<a class="panel tile s3" href="${href}"><span class="tile-label">${label}</span><span><div class="tile-value">${value}</div><div class="tile-cap">${cap}</div></span></a>`;
        $('tiles').innerHTML =
          tile('#/tasks', 'Tasks left today', open.length, overdue ? `${overdue} overdue · ${doneT} done today` : doneT ? `${doneT} done today` : open.length ? 'Nothing done yet' : 'Nothing due today') +
          tile('#/habits', 'Habits done', hs.length ? `${hd.length}<small> /${hs.length}</small>` : '0', !hs.length ? (D.activeHabits().length ? 'None scheduled today' : 'No habits yet') : left.length ? esc(U.andList(left.slice(0, 2)) + (left.length > 2 ? ` and ${left.length - 2} more` : '') + ' left') : 'All done today') +
          tile('#/focus', 'Focused today', U.durHtml(fm), sess.length ? U.plural(sess.length, 'session') + ', last at ' + U.timeOf(sess.at(-1).end) : 'No sessions yet') +
          tile('#/planner', 'Planned time left', U.durHtml(planned), next ? (next.start >= now ? `Next: ${esc(next.title)} at ${U.hm(next.start)}` : `Now: ${esc(next.title)} until ${U.hm(next.end)}`) : blocks.length ? 'Nothing else planned' : 'No plan for today');
      }
      function tasks() {
        const today = U.today();
        const open = D.openToday(today), done = D.doneOn(today).sort((a, b) => b.doneAt - a.doneAt);
        const shown = open.slice(0, 5);
        const room = Math.max(0, 5 - shown.length);
        const rows = shown.concat(done.slice(0, Math.min(room, 2)));
        $('tcount').textContent = open.length;
        $('tcount').setAttribute('aria-label', `${open.length} open`);
        O.fill($('tlist'), rows.length ? rows.map((t) => O.taskRow(t, { today })).join('') : `<div class="empty">${O.store.state.tasks.some((t) => !t.done) ? 'Nothing due today. Add one above, or give a task from your list today’s date.' : 'Nothing due today. Type a task above and press Enter.'}</div>`);
        $('tfoot').innerHTML = `<span>${open.length > shown.length ? `${open.length - shown.length} more open` : `${done.length} done today`}</span>${open.length > shown.length ? `<a class="card-link" href="#/tasks">View all ${open.length}${O.icon('right')}</a>` : ''}`;
      }
      function habits() {
        const today = U.today();
        const all = D.activeHabits(), hs = all.filter((h) => D.isScheduled(h, today));
        const rows = hs.slice(0, 5);
        $('hcount').textContent = `${hs.filter((h) => D.hDone(h, today)).length}/${hs.length}`;
        $('hcount').hidden = !hs.length;
        $('hcount').setAttribute('aria-label', 'done today');
        $('hlist').innerHTML = rows.length ? rows.map((h) => {
          const s = D.streak(h), n = D.countOn(h, today);
          const sub = (h.target || 1) > 1 ? `${n} of ${h.target} ${esc(h.unit || 'times')}${s ? ` · ${s}-day streak` : ''}` : s ? `${s}-day streak` : D.hDone(h, today) ? 'Done today' : 'No streak yet';
          return `<div class="rcard habit-row"><div class="main" style="pointer-events:auto"><a class="t" href="#/habits/${h.id}">${esc(h.name)}</a><span class="s">${sub}</span></div><div class="side">${O.habitCtl(h, today)}</div></div>`;
        }).join('') : `<div class="empty">${all.length ? 'No habits are scheduled for today.' : 'Track something small every day: reading, water, a walk.'}<a class="btn sm" href="#/habits/new">${O.icon('plus')}New habit</a></div>`;
        const off = all.length - hs.length;
        $('hfoot').innerHTML = `<span>${hs.length > rows.length ? `${hs.length - rows.length} more today` : off ? `${U.plural(off, 'habit')} not scheduled today` : ''}</span>`;
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
      function strip() { O.drawDayStrip($('strip')); }
      function mini() {
        const t = O.timer, st = O.store.state.timer, task = st.taskId && D.task(st.taskId);
        const running = t.status() === 'running';
        $('mini').innerHTML = `
          <div class="panel-head"><h2 id="ftitle">${t.MODES[t.mode()]}</h2><div class="end"><a class="card-link" href="#/focus">Open${O.icon('right')}</a></div></div>
          <div class="timer-time num" id="mt-time">${t.fmt(t.left())}</div>
          <div class="what">${task ? 'On: ' + esc(task.title) : t.mode() === 'focus' ? `${O.store.state.settings.focusMin} min, then a break` : 'Stand up, stretch, look away'}</div>
          <div class="bar"><i id="mt-bar" style="width:${(t.progress() * 100).toFixed(1)}%"></i></div>
          <div class="btns">
            <button type="button" class="btn sm primary" data-act="timer-toggle">${O.icon(running ? 'pause' : 'play', 14)}${running ? 'Pause' : t.status() === 'paused' ? 'Resume' : 'Start'}</button>
            ${t.status() !== 'idle' ? `<button type="button" class="btn sm ghost" data-act="timer-reset">${O.icon('reset', 14)}Reset</button>` : ''}
          </div>`;
      }
      const all = () => { greet(); tiles(); tasks(); habits(); journal(); notes(); strip(); mini(); };
      all();

      /* events */
      root.addEventListener('click', (e) => {
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
        if (act === 'new-task') { qin.focus(); qin.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        if (act === 'timer-toggle') O.timer.toggle();
        if (act === 'timer-reset') O.timer.reset();
      });
      qin.addEventListener('input', () => { const p = D.parseQuick(qin.value); chips.innerHTML = qin.value.trim() ? D.quickChips(p).map((c) => `<span class="pill">${esc(c)}</span>`).join('') : ''; });
      qa.addEventListener('submit', (e) => { e.preventDefault(); if (O.quickAddTask(qin.value, { due: U.today() })) { qin.value = ''; chips.innerHTML = ''; } });
      const saveJ = U.debounce(() => {
        O.store.update((s) => { const k = U.today(); const cur = s.journal[k] || { mood: 0, text: '' }; cur.text = $('jtext').value; delete cur.sample; if (!cur.text && !cur.mood) delete s.journal[k]; else s.journal[k] = cur; }, { silent: true });
        stamp();
      }, 500);
      function stamp() { $('jstamp').textContent = 'Saved ' + U.hm(U.nowMins()); }
      $('jtext').addEventListener('input', saveJ);
      $('jtext').addEventListener('blur', () => saveJ.flush());

      const offTimer = O.timer.on((left) => {
        const el = $('mt-time'); if (!el) return;
        const t = O.timer;
        if (el.textContent !== t.fmt(left)) el.textContent = t.fmt(left);
        const bar = $('mt-bar'); if (bar) bar.style.width = (t.progress() * 100).toFixed(1) + '%';
      });
      let lastStatus = O.timer.status() + O.timer.mode();
      const offTimer2 = O.timer.on(() => { const s = O.timer.status() + O.timer.mode(); if (s !== lastStatus) { lastStatus = s; mini(); } });
      const offW = O.watchWidth($('strip'), strip);
      return {
        refresh: all,
        tick() { greet(); tiles(); strip(); },
        destroy() { offTimer(); offTimer2(); offW(); saveJ.flush(); },
      };
    },
  };
})();
