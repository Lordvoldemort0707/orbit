/* Orbit — Planner. The screen's question: how is this day laid out, and did it go to plan?
   Drag on the day to block out time, drag a block to move it, drag its foot to resize. The narrow teal bars are
   the focus sessions that really happened; dots are tasks with a time. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const SNAP = 15;
  const mem = { date: null, on: null };

  /* a block can repeat every week on chosen days, like a class timetable; on = the day it was opened from */
  O.blockDialog = ({ id = null, date, start = 540, end = 600, kind = 'work', title = '', on = null } = {}) => {
    const b = id ? O.store.state.blocks.find((x) => x.id === id) : { date, start, end, kind, title };
    const day = on || b.date;
    let k = b.kind, weekly = !!(b.days && b.days.length);
    const order = [1, 2, 3, 4, 5, 6, 0];
    const body = `
      <div class="field"><label for="bt">What</label><input id="bt" class="input" value="${esc(b.title)}" placeholder="e.g. Lecture: DBMS, or Deep work: thesis" maxlength="80" autocomplete="off"></div>
      <div class="field"><span class="label" id="bkl">Kind</span><div class="kindpick" role="group" aria-labelledby="bkl">${Object.entries(D.KINDS).map(([kk, v]) => `<button type="button" data-kind="${kk}" aria-pressed="${kk === k}">${v}</button>`).join('')}</div></div>
      <div class="row3">
        <div class="field"><label for="bd">${weekly ? 'Starts' : 'Day'}</label><input id="bd" type="date" class="input" value="${b.date}"></div>
        <div class="field"><label for="bs">From</label><input id="bs" type="time" class="input" step="900" value="${U.hm(b.start)}"></div>
        <div class="field"><label for="be">To</label><input id="be" type="time" class="input" step="900" value="${U.hm(b.end % 1440)}"></div>
      </div>
      <div class="field"><span class="label" id="brl">Repeats</span>
        <div class="seg" role="group" aria-labelledby="brl"><button type="button" data-rep="once" aria-pressed="${!weekly}">Just this day</button><button type="button" data-rep="weekly" aria-pressed="${weekly}">Every week</button></div>
        <div class="daypick" id="bdays" ${weekly ? '' : 'hidden'}>${order.map((d) => `<label><input type="checkbox" value="${d}" ${(weekly ? b.days : [U.dow(b.date)]).includes(d) ? 'checked' : ''}><span>${U.weekdayShort(d)}</span></label>`).join('')}</div>
        <span class="hint" id="bhint">${weekly ? 'Changes apply to every week.' : 'For classes and routines, choose Every week.'}</span>
      </div>`;
    const actions = [{ label: 'Cancel' }, { label: id ? 'Save' : 'Add block', primary: true, onClick: () => save() }];
    const remove = (all) => {
      const s0 = O.store.state, i = s0.blocks.findIndex((x) => x.id === id), old = JSON.parse(JSON.stringify(s0.blocks[i]));
      O.store.update((st) => { if (all) st.blocks.splice(i, 1); else { const x = st.blocks[i]; x.skip = [...(x.skip || []), day]; } });
      O.toast(all ? `Removed “${old.title}”${weekly ? ' from every week' : ''}` : `Skipped “${old.title}” on ${U.relDayInline(day)}`, { action: 'Undo', onAction: () => O.store.update((st) => { const j = st.blocks.findIndex((x) => x.id === id); if (j >= 0) st.blocks[j] = old; else st.blocks.splice(i, 0, old); }) });
    };
    if (id && weekly) { actions.unshift({ label: 'Delete every week', danger: true, left: true, onClick: () => remove(true) }); actions.splice(1, 0, { label: 'Skip this day', onClick: () => remove(false) }); }
    else if (id) actions.unshift({ label: 'Delete', danger: true, left: true, onClick: () => remove(true) });
    const dlg = O.dialog({ title: id ? (weekly ? 'Edit weekly block' : 'Edit block') : 'New block', body, actions, cls: 'wide' });
    const bd = dlg.body;
    bd.addEventListener('click', (e) => {
      const kb = e.target.closest('[data-kind]'); if (kb) { k = kb.dataset.kind; bd.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-pressed', x === kb)); }
      const rp = e.target.closest('[data-rep]');
      if (rp) { weekly = rp.dataset.rep === 'weekly'; bd.querySelectorAll('[data-rep]').forEach((x) => x.setAttribute('aria-pressed', x === rp)); bd.querySelector('#bdays').hidden = !weekly; bd.querySelector('label[for="bd"]').textContent = weekly ? 'Starts' : 'Day'; bd.querySelector('#bhint').textContent = weekly ? 'It shows on these days every week from the start date.' : 'For classes and routines, choose Every week.'; }
    });
    bd.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); dlg.el.querySelector('.modal-foot .primary').click(); } });
    const inp = bd.querySelector('#bt'); inp.focus();
    function save() {
      const title = inp.value.trim() || D.KINDS[k];
      const s = U.mins(bd.querySelector('#bs').value), e0 = U.mins(bd.querySelector('#be').value);
      if (s == null || e0 == null) return false;
      const e = e0 <= s ? (e0 === 0 ? 1440 : s + 30) : e0;
      const date = bd.querySelector('#bd').value || b.date;
      const days = weekly ? U.$$('#bdays input:checked', bd).map((x) => +x.value) : null;
      if (weekly && !days.length) { bd.querySelector('#bdays input').focus(); return false; }
      O.store.update((st) => {
        const f = { title, kind: k, start: s, end: e, date, days: days || undefined };
        if (id) { const x = st.blocks.find((y) => y.id === id); Object.assign(x, f); if (!weekly) { delete x.days; delete x.skip; } }
        else st.blocks.push({ id: U.uid(), ...f });
      });
      if (!weekly && date !== mem.date) { mem.date = date; }
      if (weekly && !id) O.toast(`“${title}” added every ${days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(U.weekdayLong).join(', ')}.`);
    }
    return dlg;
  };

  /* side-by-side columns for blocks that overlap */
  function layout(blocks) {
    const out = [], cols = [];
    let cluster = [], clusterEnd = -1;
    const flush = () => { const n = Math.max(1, ...cluster.map((x) => x.col + 1)); cluster.forEach((x) => (x.n = n)); cluster = []; };
    for (const b of blocks) {
      if (b.start >= clusterEnd) { flush(); cols.length = 0; clusterEnd = -1; }
      let c = cols.findIndex((end) => end <= b.start);
      if (c < 0) { c = cols.length; cols.push(b.end); } else cols[c] = b.end;
      const it = { b, col: c, n: 1 };
      cluster.push(it); out.push(it);
      clusterEnd = Math.max(clusterEnd, b.end);
    }
    flush();
    return out;
  }

  O.views.planner = {
    title: 'Planner',
    mount(root, params) {
      if (mem.on !== U.today()) { mem.on = U.today(); mem.date = U.today(); }
      const qd = params.query.get('date');
      if (qd && /^\d{4}-\d{2}-\d{2}$/.test(qd)) mem.date = qd;
      root.innerHTML = `
        <header class="title-row"><div><h1 id="ttl">Planner</h1><p class="sub" id="sub"></p></div>
          <div class="actions plan-head">
            <button type="button" class="btn icon" data-nav="-1" aria-label="Previous day">${O.icon('left')}</button>
            <button type="button" class="btn" data-nav="0">Today</button>
            <button type="button" class="btn icon" data-nav="1" aria-label="Next day">${O.icon('right')}</button>
            <button type="button" class="btn primary" data-newblock>${O.icon('plus')}New block</button>
          </div></header>
        <div class="plan-layout">
          <section class="panel" aria-label="Time blocks for the day"><div class="panel-head"><h2 id="dayname"></h2><div class="end kind-legend" id="legend"></div></div><div class="plan-board" id="board"></div></section>
          <aside style="display:flex;flex-direction:column;gap:16px;min-width:0">
            <section class="panel" aria-labelledby="oth"><div class="panel-head"><h2 id="oth">Tasks on this day</h2><span class="count-chip" id="tcount"></span></div><div class="rcards" id="dtasks"></div></section>
            <section class="panel" aria-labelledby="sumh"><div class="panel-head"><h2 id="sumh">Plan and what happened</h2></div><div id="sum"></div></section>
          </aside>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const hourPx = () => (U.isPhone() ? 48 : 56);
      let drag = null;

      function head() {
        const k = mem.date, today = U.today();
        const bl = D.blocksOn(k), planned = bl.reduce((a, b) => a + (b.end - b.start), 0);
        $('dayname').textContent = U.relDay(k) === 'Today' || U.relDay(k) === 'Tomorrow' || U.relDay(k) === 'Yesterday' ? `${U.relDay(k)}, ${U.fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })}` : U.fmtDate(k);
        $('sub').textContent = bl.length ? `${U.plural(bl.length, 'block')}, ${U.dur(planned)} planned${k <= today ? ` · ${U.dur(D.focusOn(k))} focused` : ''}` : k < today ? 'Nothing was planned for this day.' : 'Drag across the day to block out time.';
        $('legend').innerHTML = Object.entries(D.KINDS).filter(([kk]) => bl.some((b) => b.kind === kk)).map(([kk, v]) => `<span><i data-kind="${kk}"></i>${v}</span>`).join('') + (D.sessionsOn(k).length ? '<span><i class="f"></i>Focus</span>' : '') + (O.store.state.tasks.some((t) => t.due === k && t.time) ? '<span><i class="t"></i>Task</span>' : '');
        root.querySelector('[data-nav="0"]').disabled = k === today;
      }
      function board() {
        const st = O.store.state.settings, a = st.dayStart * 60, z = st.dayEnd * 60, hp = hourPx();
        const y = (m) => ((U.clamp(m, a, z) - a) / 60) * hp;
        const H = y(z);
        let hours = '', lines = '';
        for (let hh = st.dayStart; hh <= st.dayEnd; hh++) {
          hours += `<span style="top:${y(hh * 60)}px">${U.hm((hh * 60) % 1440)}</span>`;
          lines += `<div class="hl" style="top:${y(hh * 60)}px"></div>`;
          if (hh < st.dayEnd) lines += `<div class="hl half" style="top:${y(hh * 60 + 30)}px"></div>`;
        }
        const k = mem.date;
        const blocks = layout(D.blocksOn(k).filter((b) => b.end > a && b.start < z)).map(({ b, col, n }) => {
          const top = y(b.start), h = Math.max(18, y(b.end) - top - 2);
          const short = h < 40;
          return `<div class="pblock ${short ? 'short' : ''}" data-block="${b.id}" data-kind="${b.kind}" tabindex="0" role="button" aria-label="${esc(b.title)}, ${U.hm(b.start)} to ${U.hm(b.end % 1440)}. Press Enter to edit."
            style="top:${top}px;height:${h}px;left:calc(6px + ${col} * (100% - 78px) / ${n});right:auto;width:calc((100% - 78px) / ${n} - 4px)">
            <div class="bt">${b.days && b.days.length ? O.icon('repeat', 11) + ' ' : ''}${esc(b.title)}</div><div class="bs">${U.hm(b.start)}–${U.hm(b.end % 1440)}</div><div class="grip" data-grip></div></div>`;
        }).join('');
        const sess = D.sessionsOn(k).map((s) => { const m0 = U.minsOfTs(s.start); return `<div class="fsess" style="top:${y(m0)}px;height:${Math.max(3, y(m0 + s.minutes) - y(m0))}px" title="Focus ${U.timeOf(s.start)}–${U.timeOf(s.end)}, ${s.minutes} min"></div>`; }).join('');
        const tasks = O.store.state.tasks.filter((t) => t.due === k && t.time).map((t) => `<button type="button" class="ptask ${t.done ? 'done' : ''}" style="top:${y(U.mins(t.time))}px;border:0;background:none;padding:0" data-act="open-task" data-id="${t.id}" title="${t.time} ${esc(t.title)}" aria-label="Task at ${t.time}: ${esc(t.title)}"><i></i></button>`).join('');
        const now = k === U.today() && U.nowMins() >= a && U.nowMins() <= z ? `<div class="now-line" style="top:${y(U.nowMins())}px"><span>${U.hm(U.nowMins())}</span></div>` : '';
        $('board').innerHTML = `<div class="plan-hours" style="height:${H}px">${hours}</div><div class="plan-col" id="col" style="height:${H}px">${lines}${blocks}${sess}${tasks}${now}</div>`;
        $('board').style.paddingTop = '12px';
      }
      function side() {
        const k = mem.date, today = U.today();
        const ts = O.store.state.tasks.filter((t) => t.due === k).sort(D.sortTasks);
        $('tcount').textContent = ts.length;
        $('dtasks').innerHTML = ts.length ? ts.slice(0, 8).map((t) => O.taskRow(t, { today })).join('') : `<div class="empty">No tasks due ${esc(U.relDayInline(k))}.</div>`;
        const bl = D.blocksOn(k), planned = bl.reduce((a, b) => a + (b.end - b.start), 0);
        const prev = D.blocksOn(U.addDays(k, -1)).filter((b) => !(b.days && b.days.length));
        const byKind = Object.entries(D.KINDS).map(([kk, v]) => ({ v, m: bl.filter((b) => b.kind === kk).reduce((a, b) => a + (b.end - b.start), 0) })).filter((x) => x.m);
        const st = O.store.state.settings;
        const free = (st.dayEnd - st.dayStart) * 60 - planned;
        $('sum').innerHTML = `
          <div class="sess-list">
            ${byKind.map((x) => `<div class="sess" style="grid-template-columns:1fr auto"><span>${x.v}</span><span class="n">${U.dur(x.m)}</span></div>`).join('')}
            <div class="sess" style="grid-template-columns:1fr auto"><span class="muted">Unplanned, ${String(st.dayStart).padStart(2, '0')}:00–${String(st.dayEnd).padStart(2, '0')}:00</span><span class="n muted">${U.dur(Math.max(0, free))}</span></div>
            ${k <= today ? `<div class="sess" style="grid-template-columns:1fr auto"><span>Focus sessions logged</span><span class="n">${U.dur(D.focusOn(k))}</span></div>` : ''}
          </div>
          ${!bl.length && prev.length ? `<button type="button" class="btn sm" data-copy style="margin-top:14px">${O.icon('repeat', 14)}Copy ${U.plural(prev.length, 'block')} from ${esc(U.relDayInline(U.addDays(k, -1)))}</button>` : ''}`;
      }
      const all = () => { head(); if (!drag) board(); side(); };
      all();
      // start the day scrolled to a sensible hour
      setTimeout(() => {
        const sheet = document.getElementById('sheet');
        const col = $('col'); if (!col) return;
        const st = O.store.state.settings, target = mem.date === U.today() ? Math.max(st.dayStart * 60, U.nowMins() - 90) : 8 * 60;
        const yy = col.getBoundingClientRect().top + ((target - st.dayStart * 60) / 60) * hourPx() - 160;
        if (U.isPhone()) window.scrollTo({ top: Math.max(0, window.scrollY + yy) }); else if (yy > 0) sheet.scrollTop += yy;
      }, 0);
      if (params.arg === 'new') setTimeout(() => { history.replaceState(null, '', '#/planner'); newBlock(); }, 0);

      function newBlock(start) {
        const now = U.nowMins();
        const s = start != null ? start : mem.date === U.today() ? Math.ceil(now / 30) * 30 : 9 * 60;
        O.blockDialog({ date: mem.date, start: Math.min(s, 23 * 60), end: Math.min(s + 60, 1440) });
      }
      const minsAt = (clientY) => {
        const col = $('col'), r = col.getBoundingClientRect(), st = O.store.state.settings;
        const m = st.dayStart * 60 + ((clientY - r.top) / hourPx()) * 60;
        return U.clamp(Math.round(m / SNAP) * SNAP, st.dayStart * 60, st.dayEnd * 60);
      };

      /* pointer work on the day column */
      let lastPointer = 'mouse';
      root.addEventListener('pointerdown', (e) => {
        lastPointer = e.pointerType || 'mouse';
        const col = e.target.closest('#col'); if (!col || e.button !== 0) return;
        const blockEl = e.target.closest('.pblock');
        if (e.target.closest('.ptask') || e.target.closest('.fsess')) return;
        if (blockEl) {
          const b = O.store.state.blocks.find((x) => x.id === blockEl.dataset.block); if (!b) return;
          drag = { kind: e.target.closest('[data-grip]') ? 'resize' : 'move', el: blockEl, b, y0: e.clientY, start: b.start, end: b.end, moved: false };
          blockEl.setPointerCapture(e.pointerId);
          blockEl.classList.add('dragging');
          e.preventDefault();
          return;
        }
        if (e.pointerType === 'touch') return; // on touch a tap creates; a drag scrolls
        const m = minsAt(e.clientY);
        const ghost = document.createElement('div'); ghost.className = 'pblock ghost';
        col.appendChild(ghost);
        drag = { kind: 'create', el: ghost, m0: m, m1: m + 30 };
        placeGhost();
        col.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      function placeGhost() {
        const st = O.store.state.settings, a = Math.min(drag.m0, drag.m1), z = Math.max(drag.m0, drag.m1, a + SNAP);
        drag.el.style.top = ((a - st.dayStart * 60) / 60) * hourPx() + 'px';
        drag.el.style.height = Math.max(16, ((z - a) / 60) * hourPx() - 2) + 'px';
        drag.el.innerHTML = `<div class="bs">${U.hm(a)}–${U.hm(z % 1440)}</div>`;
      }
      root.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const st = O.store.state.settings;
        if (drag.kind === 'create') { drag.m1 = minsAt(e.clientY); placeGhost(); return; }
        const dm = Math.round(((e.clientY - drag.y0) / hourPx()) * 60 / SNAP) * SNAP;
        if (Math.abs(e.clientY - drag.y0) > 4) drag.moved = true;
        if (!drag.moved) return;
        if (drag.kind === 'move') {
          const len = drag.end - drag.start;
          drag.ns = U.clamp(drag.start + dm, st.dayStart * 60, st.dayEnd * 60 - len); drag.ne = drag.ns + len;
        } else { drag.ns = drag.start; drag.ne = U.clamp(drag.end + dm, drag.start + SNAP, st.dayEnd * 60); }
        drag.el.style.top = ((drag.ns - st.dayStart * 60) / 60) * hourPx() + 'px';
        drag.el.style.height = Math.max(18, ((drag.ne - drag.ns) / 60) * hourPx() - 2) + 'px';
        const bs = drag.el.querySelector('.bs'); if (bs) bs.textContent = `${U.hm(drag.ns)}–${U.hm(drag.ne % 1440)}`;
      });
      const end = () => {
        if (!drag) return;
        const d = drag; drag = null;
        if (d.kind === 'create') {
          d.el.remove();
          const a = Math.min(d.m0, d.m1), z = Math.max(d.m0, d.m1);
          O.blockDialog({ date: mem.date, start: a, end: z - a >= SNAP * 2 ? z : a + 60 });
          return;
        }
        d.el.classList.remove('dragging');
        if (!d.moved) { O.blockDialog({ id: d.b.id, on: mem.date }); return; }
        O.store.update(() => { d.b.start = d.ns; d.b.end = d.ne; });
        if (d.b.days && d.b.days.length) O.toast(`Moved “${d.b.title}” to ${U.hm(d.ns)} every week.`);
      };
      root.addEventListener('pointerup', end);
      root.addEventListener('pointercancel', () => { if (drag) { if (drag.kind === 'create') drag.el.remove(); drag = null; board(); } });
      root.addEventListener('click', (e) => {
        const col = e.target.closest('#col');
        if (col && (e.pointerType || lastPointer) === 'touch' && !e.target.closest('.pblock, .ptask')) { newBlock(Math.floor(minsAt(e.clientY) / 30) * 30); return; }
        const nav = e.target.closest('[data-nav]');
        if (nav) { const n = +nav.dataset.nav; mem.date = n === 0 ? U.today() : U.addDays(mem.date, n); history.replaceState(null, '', '#/planner?date=' + mem.date); all(); return; }
        if (e.target.closest('[data-newblock]')) { newBlock(); return; }
        if (e.target.closest('[data-copy]')) {
          const prev = D.blocksOn(U.addDays(mem.date, -1)).filter((b) => !(b.days && b.days.length));
          O.store.update((s) => { prev.forEach((b) => s.blocks.push({ ...b, id: U.uid(), date: mem.date, sample: undefined })); });
          O.toast(`Copied ${U.plural(prev.length, 'block')}.`);
          return;
        }
        O.handleCommon(e);
      });
      root.addEventListener('keydown', (e) => { const b = e.target.closest('.pblock'); if (b && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); O.blockDialog({ id: b.dataset.block, on: mem.date }); } });
      return { refresh: all, tick: () => { if (!drag) board(); head(); } };
    },
  };
})();
