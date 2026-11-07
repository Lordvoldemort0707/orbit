/* Orbit — Habits. The screen's question: am I keeping my habits this week?
   Each habit's last seven days can be ticked in place; the selected habit shows a year of history. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const NS = 'http://www.w3.org/2000/svg';
  let mem = { selected: null };

  /* --------------------------------------------------------- the editor */
  O.habitDialog = (id = null) => {
    const h = id ? D.habit(id) : { name: '', days: [], target: 1, unit: '' };
    const specific = h.days && h.days.length && h.days.length < 7;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const body = `
      <div class="field"><label for="hn">Name</label><input id="hn" class="input" value="${esc(h.name)}" placeholder="e.g. Read 20 minutes" maxlength="80" autocomplete="off"></div>
      <div class="field"><span class="label" id="hsl">How often</span>
        <div class="seg" role="group" aria-labelledby="hsl"><button type="button" data-often="daily" aria-pressed="${!specific}">Every day</button><button type="button" data-often="days" aria-pressed="${!!specific}">On certain days</button></div>
        <div class="daypick" id="hdays" ${specific ? '' : 'hidden'}>${order.map((d) => `<label><input type="checkbox" value="${d}" ${specific && h.days.includes(d) ? 'checked' : ''}><span>${U.weekdayShort(d)}</span></label>`).join('')}</div>
      </div>
      <div class="row2">
        <div class="field"><label for="ht">Times a day</label><input id="ht" class="input" type="number" min="1" max="50" value="${h.target || 1}"></div>
        <div class="field"><label for="hu">Counted in</label><input id="hu" class="input" value="${esc(h.unit || '')}" placeholder="e.g. glasses" maxlength="20"></div>
      </div>
      <p class="hint">A habit with more than one a day is done when its count reaches the target.</p>
      ${O.store.state.goals.some((g) => !g.done) ? `<div class="field"><label for="hg">Builds toward a goal</label><select id="hg" class="input"><option value="">No goal</option>${O.store.state.goals.filter((g) => !g.done).map((g) => `<option value="${g.id}" ${g.id === h.goalId ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div>` : ''}`;
    let ok = false;
    const actions = [{ label: 'Cancel' }, { label: id ? 'Save' : 'Create habit', primary: true, onClick: (d) => { const r = save(d); if (r === false) return false; ok = true; } }];
    if (id) actions.unshift({ label: 'Delete', danger: true, left: true, onClick: () => { setTimeout(() => del(id), 0); } });
    const dlg = O.dialog({ title: id ? 'Edit habit' : 'New habit', body, actions });
    const b = dlg.body;
    b.addEventListener('click', (e) => {
      const o = e.target.closest('[data-often]');
      if (!o) return;
      b.querySelectorAll('[data-often]').forEach((x) => x.setAttribute('aria-pressed', x === o));
      b.querySelector('#hdays').hidden = o.dataset.often !== 'days';
    });
    b.querySelector('#hn').focus();
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); dlg.el.querySelector('.modal-foot .primary').click(); } });
    function save() {
      const name = b.querySelector('#hn').value.trim();
      if (!name) { b.querySelector('#hn').focus(); return false; }
      const days = b.querySelector('[data-often="days"]').getAttribute('aria-pressed') === 'true' ? U.$$('#hdays input:checked', b).map((x) => +x.value) : [];
      const target = U.clamp(parseInt(b.querySelector('#ht').value, 10) || 1, 1, 50), unit = b.querySelector('#hu').value.trim();
      let nid = id;
      const gsel = b.querySelector('#hg'), goalId = gsel ? gsel.value || null : h.goalId || null;
      O.store.update((s) => {
        if (id) Object.assign(D.habit(id), { name, days, target, unit, goalId });
        else { nid = U.uid(); s.habits.push({ id: nid, name, days, target, unit, goalId, createdAt: Date.now(), archived: false }); }
      });
      mem.selected = nid;
      if (!id) O.toast(`Added “${name}”. Tick it off today to start a streak.`);
      return true;
    }
    return dlg;
  };
  async function del(id) {
    const h = D.habit(id); if (!h) return;
    const yes = await O.confirm({ title: `Delete “${h.name}”?`, text: `Its ${Object.keys(O.store.state.checkins[id] || {}).length} check-ins will be deleted too. Archive it instead to keep the history.`, ok: 'Delete habit' });
    if (!yes) return;
    O.store.update((s) => { s.habits = s.habits.filter((x) => x.id !== id); delete s.checkins[id]; });
    mem.selected = null;
    O.toast(`Deleted “${h.name}”`);
  }

  /* --------------------------------------------------------- the heatmap */
  function heatmap(el, h) {
    const w = Math.max(260, el.clientWidth);
    const gap = 3, padL = 30, padT = 18;
    const today = U.today();
    // a young habit gets fewer, larger weeks instead of a year of blank cells
    const age = Math.ceil((U.diffDays(today, D.habitStart(h)) + 1) / 7) + 1;
    const fit = Math.min(53, Math.floor((w - padL) / (13 + gap)));
    const weeks = U.clamp(age, Math.min(20, fit), fit);
    const cell = U.clamp(Math.floor((w - padL) / weeks) - gap, 11, 20);
    const ws = O.store.state.settings.weekStart;
    let end = today; while (U.dow(end) !== (ws + 6) % 7) end = U.addDays(end, 1);
    const start = U.addDays(end, -(weeks * 7 - 1)), hs = D.habitStart(h);
    const svg = document.createElementNS(NS, 'svg');
    const width = padL + weeks * (cell + gap), height = padT + 7 * (cell + gap);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('width', width); svg.setAttribute('height', height);
    svg.classList.add('heat');
    const add = (tag, attrs, txt) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); if (txt != null) n.textContent = txt; svg.appendChild(n); return n; };
    [1, 3, 5].forEach((r) => add('text', { x: 0, y: padT + r * (cell + gap) + cell / 2 + 4, class: 'hl' }, U.weekdayShort((ws + r) % 7)));
    let lastMonth = -1, done = 0;
    for (let c = 0; c < weeks; c++) {
      const first = U.addDays(start, c * 7), m = U.parseKey(first).getMonth();
      if (m !== lastMonth && c < weeks - 1) { add('text', { x: padL + c * (cell + gap), y: 11, class: 'hl' }, U.parseKey(first).toLocaleDateString(undefined, { month: 'short' })); lastMonth = m; }
      for (let r = 0; r < 7; r++) {
        const k = U.addDays(start, c * 7 + r);
        if (k > today) continue;
        const n = D.countOn(h, k), sched = D.isScheduled(h, k);
        const cls = n >= (h.target || 1) ? 'd' : n > 0 ? 'p' : k < hs ? 'b' : sched ? 'z' : 'o';
        if (cls === 'd') done++;
        const rect = add('rect', { x: padL + c * (cell + gap), y: padT + r * (cell + gap), width: cell, height: cell, rx: cell > 14 ? 4 : 3, class: cls, 'data-day': k });
        const t = document.createElementNS(NS, 'title');
        t.textContent = `${U.fmtDate(k, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}: ${(h.target || 1) > 1 ? `${n} of ${h.target}` : n ? 'done' : sched ? 'not done' : 'not scheduled'}`;
        rect.appendChild(t);
      }
    }
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${h.name}: done on ${done} days in the last ${weeks} weeks`);
    el.innerHTML = '';
    el.appendChild(svg);
  }

  /* ------------------------------------------------------------------ view */
  O.views.habits = {
    title: 'Habits',
    mount(root, params) {
      if (params.arg && params.arg !== 'new' && D.habit(params.arg)) mem.selected = params.arg;
      root.innerHTML = `
        <header class="title-row"><div><h1>Habits</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><button type="button" class="btn primary" id="newh">${O.icon('plus')}New habit</button></div></header>
        <section class="panel" aria-labelledby="wk"><div class="panel-head"><h2 id="wk">This week</h2><span class="meta" id="wkmeta"></span></div><div id="rows"></div></section>
        <section class="panel" style="margin-top:16px" id="detail" aria-live="polite"></section>
        <div id="arch"></div>`;
      const $ = (id) => root.querySelector('#' + id);
      let offW = () => {};

      function rows() {
        const today = U.today(), hs = D.activeHabits();
        const days = U.lastDays(7);
        const sched = hs.filter((h) => D.isScheduled(h, today));
        const best = hs.map((h) => ({ h, s: D.streak(h) })).sort((a, b) => b.s - a.s)[0];
        $('sub').textContent = hs.length ? `${sched.filter((h) => D.hDone(h, today)).length} of ${sched.length} done today${best && best.s ? ` · longest run going: ${best.h.name}, ${best.s} days` : ''}` : 'Small things, done often. Add a habit to start tracking it.';
        $('wkmeta').textContent = `${U.short(days[0])} – ${U.short(days[6])}`;
        if (!hs.length) { O.fill($('rows'), `<div class="empty">No habits yet. Try “Read 20 minutes”, “Drink water, 8 glasses” or “Walk 30 minutes”.<button type="button" class="btn sm" data-new>${O.icon('plus')}New habit</button></div>`); return; }
        if (!mem.selected || !D.habit(mem.selected) || D.habit(mem.selected).archived) mem.selected = hs[0].id;
        const head = `<div class="hhead" aria-hidden="true"><span>Habit</span>${days.map((k) => `<span class="d ${k === today ? 'today' : ''}">${U.weekdayShort(U.dow(k))}<b>${U.parseKey(k).getDate()}</b></span>`).join('')}<span class="n">Streak</span><span class="n rate">30 days</span></div>`;
        const body = hs.map((h) => {
          const s = D.streak(h), r = D.rate(h, 30), hstart = D.habitStart(h);
          const cells = days.map((k) => {
            const n = D.countOn(h, k), t = h.target || 1, sc = D.isScheduled(h, k);
            const state = n >= t ? 'done' : n > 0 ? 'part' : k < hstart ? 'before' : sc ? 'open' : 'off';
            const label = `${h.name}, ${U.fmtDate(k, { weekday: 'long', day: 'numeric', month: 'short' })}: ${t > 1 ? `${n} of ${t}` : n ? 'done' : sc ? 'not done' : 'not scheduled'}`;
            return `<button type="button" class="hcell" data-state="${state}" data-cell="${h.id}" data-day="${k}" data-k="c-${h.id}-${k}" aria-label="${esc(label)}">${state === 'done' ? O.icon('check') : state === 'part' ? n : ''}</button>`;
          }).join('');
          return `<div class="hrow" data-sel="${h.id}" aria-selected="${h.id === mem.selected}"><div class="main"><span class="t">${esc(h.name)}</span><span class="s">${esc(D.scheduleText(h))}</span></div>${cells}<span class="n num">${s}<small> d</small></span><span class="n num rate">${r == null ? '<span class="muted">–</span>' : Math.round(r * 100) + '<small>%</small>'}</span></div>`;
        }).join('');
        O.fill($('rows'), head + `<div class="hlist">${body}</div>`);
      }
      function detail() {
        const h = D.habit(mem.selected);
        if (!h || h.archived) { $('detail').hidden = true; return; }
        $('detail').hidden = false;
        const total = Object.keys(O.store.state.checkins[h.id] || {}).filter((k) => D.hDone(h, k)).length;
        const r = D.rate(h, 30), s = D.streak(h), b = D.bestStreak(h);
        $('detail').innerHTML = `
          <div class="panel-head"><h2>${esc(h.name)}</h2><span class="meta">${esc(D.scheduleText(h))} · since ${esc(U.short(D.habitStart(h)))}</span>
            <div class="end"><button type="button" class="btn sm ghost" data-arch="${h.id}">${O.icon('archive', 14)}Archive</button><button type="button" class="btn sm" data-edit="${h.id}">${O.icon('edit', 14)}Edit</button></div></div>
          <div class="stat-strip">
            <div><div class="kpi-label">Current streak</div><div class="kpi-value num">${s}<small> days</small></div></div>
            <div><div class="kpi-label">Best streak</div><div class="kpi-value num">${b}<small> days</small></div></div>
            <div><div class="kpi-label">Last 30 days</div><div class="kpi-value num">${r == null ? '<span class="muted">–</span>' : Math.round(r * 100) + '<small>%</small>'}</div></div>
            <div><div class="kpi-label">Days done, all time</div><div class="kpi-value num">${total}</div></div>
          </div>
          <div class="panel-head" style="margin-bottom:10px"><h2>History</h2><div class="end heat-legend"><span>Not done</span><i></i><i class="p"></i><i class="d"></i><span>Done</span></div></div>
          <div class="heat-wrap" id="heat"></div>
          <p class="finding">${s && s === b && s > 2 ? `<b>${s} days</b> is your best run yet. ` : b > s ? `Your best run is <b>${b} days</b>; ${b - s + 1} more ${b - s + 1 === 1 ? 'day beats' : 'days beat'} it. ` : ''}Click any day to fix a missed check-in.</p>`;
        heatmap($('heat'), h);
        offW(); offW = O.watchWidth($('heat'), () => { const hh = D.habit(mem.selected); if (hh) heatmap($('heat'), hh); });
      }
      function archived() {
        const a = O.store.state.habits.filter((h) => h.archived);
        $('arch').innerHTML = a.length ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><h2>Archived</h2><span class="count-chip">${a.length}</span></div><div class="rcards">${a.map((h) => `<div class="rcard"><div class="main"><span class="t">${esc(h.name)}</span><span class="s">${Object.keys(O.store.state.checkins[h.id] || {}).length} check-ins kept</span></div><div class="side"><button type="button" class="btn sm" data-unarch="${h.id}">Restore</button></div></div>`).join('')}</div></section>` : '';
      }
      const all = () => { rows(); detail(); archived(); };
      all();
      if (params.arg === 'new') setTimeout(() => { O.habitDialog(); history.replaceState(null, '', '#/habits'); }, 0);

      root.addEventListener('click', (e) => {
        const c = e.target.closest('[data-cell]');
        if (c) {
          const h = D.habit(c.dataset.cell), k = c.dataset.day, t = h.target || 1;
          const before = D.hDone(h, k);
          O.store.update(() => { if (t > 1) D.setCount(h, k, D.countOn(h, k) >= t ? 0 : D.countOn(h, k) + 1); else D.toggleHabit(h, k); });
          if (!before && D.hDone(h, k)) O.sound('tick');
          return;
        }
        const r = e.target.closest('rect[data-day]');
        if (r) { const h = D.habit(mem.selected); O.store.update(() => { if ((h.target || 1) > 1) D.setCount(h, r.dataset.day, D.hDone(h, r.dataset.day) ? 0 : h.target); else D.toggleHabit(h, r.dataset.day); }); return; }
        const sel = e.target.closest('[data-sel]');
        if (sel) { mem.selected = sel.dataset.sel; history.replaceState(null, '', '#/habits/' + mem.selected); rows(); detail(); return; }
        if (e.target.closest('[data-new]')) { O.habitDialog(); return; }
        const ed = e.target.closest('[data-edit]'); if (ed) { O.habitDialog(ed.dataset.edit); return; }
        const ar = e.target.closest('[data-arch]');
        if (ar) { const h = D.habit(ar.dataset.arch); O.store.update(() => { h.archived = true; }); mem.selected = null; O.toast(`Archived “${h.name}”`, { action: 'Undo', onAction: () => O.store.update(() => { h.archived = false; }) }); return; }
        const un = e.target.closest('[data-unarch]'); if (un) { O.store.update(() => { D.habit(un.dataset.unarch).archived = false; }); }
      });
      $('newh').addEventListener('click', () => O.habitDialog());
      return { refresh: all, tick: rows, destroy() { offW(); } };
    },
  };
})();
