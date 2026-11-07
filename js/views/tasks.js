/* Orbit — Tasks. The screen's question: what do I need to do, and when?
   A list that drives a detail pane on desktop; on a phone the detail opens as a sheet. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const mem = { view: 'today', list: 'all', q: '' };
  const VIEWS = [['today', 'Today'], ['upcoming', 'Upcoming'], ['anytime', 'Anytime'], ['done', 'Done']];

  /* ---------------------------------------------------------- the editor */
  O.taskEditor = (el, id, { onClose } = {}) => {
    const draw = () => {
      const t = D.task(id);
      if (!t) { el.innerHTML = `<div class="empty">This task was deleted.</div>`; return; }
      const lists = O.store.state.lists;
      O.fill(el, `
        <div class="detail-top">
          <button type="button" class="check" role="checkbox" aria-checked="${t.done}" data-k="done" data-ed="done" aria-label="${t.done ? 'Mark not done' : 'Mark done'}">${O.icon('check')}</button>
          <input class="title-input" data-k="title" value="${esc(t.title)}" aria-label="Task title" maxlength="200">
        </div>
        <div class="detail-form">
          <div class="row2">
            <div class="field"><label for="ed-due">Date</label><input id="ed-due" data-k="due" type="date" class="input" value="${t.due || ''}"></div>
            <div class="field"><label for="ed-time">Time</label><input id="ed-time" data-k="time" type="time" class="input" value="${t.time || ''}"></div>
          </div>
          <div class="row2">
            <div class="field"><label for="ed-list">List</label><select id="ed-list" data-k="list" class="input">${lists.map((l) => `<option value="${l.id}" ${l.id === t.list ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}<option value="__new">New list…</option></select></div>
            <div class="field"><label for="ed-rep">Repeat</label><select id="ed-rep" data-k="repeat" class="input">${Object.entries(D.REPEAT).map(([k, v]) => `<option value="${k}" ${k === (t.repeat || '') ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          </div>
          <div class="field"><span class="label" id="ed-pl">Priority</span><div class="seg" role="group" aria-labelledby="ed-pl">${D.PRIORITY.map((p, i) => `<button type="button" data-k="p${i}" data-ed="prio" data-v="${i}" aria-pressed="${(t.priority || 0) === i}">${p}</button>`).join('')}</div></div>
          <div class="field"><span class="label">Steps${t.subtasks.length ? ` <span class="muted num">${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>` : ''}</span>
            <div class="subtasks">
              ${t.subtasks.map((s) => `<div class="subtask ${s.done ? 'done' : ''}"><button type="button" class="check" role="checkbox" aria-checked="${s.done}" data-ed="sub-done" data-k="sd-${s.id}" data-sid="${s.id}" aria-label="Step done">${O.icon('check')}</button><input value="${esc(s.title)}" data-ed="sub-title" data-k="st-${s.id}" data-sid="${s.id}" aria-label="Step"><button type="button" class="icon-btn" data-ed="sub-del" data-sid="${s.id}" aria-label="Remove step">${O.icon('x', 14)}</button></div>`).join('')}
              <div class="subtask"><span class="check" style="border-style:dashed" aria-hidden="true"></span><input data-ed="sub-new" data-k="sub-new" placeholder="Add a step" aria-label="Add a step"></div>
            </div>
          </div>
          <div class="field"><label for="ed-notes">Notes</label><textarea id="ed-notes" data-k="notes" class="input" placeholder="Links, details, anything useful">${esc(t.notes || '')}</textarea></div>
        </div>
        <div class="detail-foot">
          <span>Added ${esc(U.relDayInline(U.keyOf(t.createdAt)))}${t.done && t.doneAt ? ` · done ${esc(U.relDayInline(U.keyOf(t.doneAt)))} at ${U.timeOf(t.doneAt)}` : ''} <span class="saved-stamp" data-stamp></span></span>
          <span style="display:flex;gap:6px">
            <button type="button" class="btn sm ghost" data-ed="focus">${O.icon('focus', 14)}Focus on this</button>
            <button type="button" class="btn sm danger" data-ed="delete">${O.icon('trash', 14)}Delete</button>
          </span>
        </div>`);
    };
    const set = (fn, silent = false) => { O.store.update(() => { const t = D.task(id); if (t) fn(t); }, { silent }); const s = el.querySelector('[data-stamp]'); if (s) s.textContent = '· Saved'; };
    const saveTitle = U.debounce((v) => set((t) => { t.title = v.trim() || t.title; }), 350);
    const saveNotes = U.debounce((v) => set((t) => { t.notes = v; }), 400);
    const saveSub = U.debounce((sid, v) => set((t) => { const s = t.subtasks.find((x) => x.id === sid); if (s) s.title = v; }), 400);
    el.addEventListener('input', (e) => {
      const k = e.target.dataset.k, ed = e.target.dataset.ed;
      if (k === 'title') saveTitle(e.target.value);
      else if (k === 'notes') saveNotes(e.target.value);
      else if (ed === 'sub-title') saveSub(e.target.dataset.sid, e.target.value);
    });
    el.addEventListener('change', async (e) => {
      const k = e.target.dataset.k, v = e.target.value;
      if (k === 'due') set((t) => { t.due = v || null; });
      else if (k === 'time') set((t) => { t.time = v || null; if (v && !t.due) t.due = U.today(); });
      else if (k === 'repeat') set((t) => { t.repeat = v; if (v && !t.due) t.due = U.today(); });
      else if (k === 'list') {
        if (v === '__new') {
          const name = await O.prompt({ title: 'New list', label: 'List name', placeholder: 'e.g. Side project', ok: 'Create' });
          if (name) set((t) => { t.list = D.ensureList(name); }); else draw();
        } else set((t) => { t.list = v; });
      }
    });
    el.addEventListener('keydown', (e) => {
      if (e.target.dataset.ed === 'sub-new' && e.key === 'Enter') {
        e.preventDefault();
        const v = e.target.value.trim(); if (!v) return;
        e.target.value = '';
        set((t) => { t.subtasks.push({ id: U.uid(), title: v, done: false }); });
        e.target.blur(); draw();
        const n = el.querySelector('[data-k="sub-new"]'); n && n.focus();
      }
      if (e.target.dataset.k === 'title' && e.key === 'Enter') { e.preventDefault(); saveTitle.flush(e.target.value); e.target.blur(); }
    });
    el.addEventListener('focusout', (e) => {
      if (e.target.dataset.k === 'title') saveTitle.flush(e.target.value);
      if (e.target.dataset.k === 'notes') saveNotes.flush(e.target.value);
      if (e.target.dataset.ed === 'sub-title') saveSub.flush(e.target.dataset.sid, e.target.value);
    });
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ed]'); if (!b) return;
      const ed = b.dataset.ed;
      if (ed === 'done') O.toggleTask(id);
      else if (ed === 'prio') set((t) => { t.priority = +b.dataset.v; });
      else if (ed === 'sub-done') set((t) => { const s = t.subtasks.find((x) => x.id === b.dataset.sid); if (s) s.done = !s.done; });
      else if (ed === 'sub-del') set((t) => { t.subtasks = t.subtasks.filter((x) => x.id !== b.dataset.sid); });
      else if (ed === 'focus') { O.store.update((s) => { s.timer.taskId = id; }); O.go('#/focus'); }
      else if (ed === 'delete') {
        const s = O.store.state, i = s.tasks.findIndex((x) => x.id === id), t = s.tasks[i];
        O.store.update((st) => { st.tasks.splice(i, 1); });
        onClose && onClose();
        O.toast(`Deleted “${t.title}”`, { action: 'Undo', onAction: () => O.store.update((st) => { st.tasks.splice(i, 0, t); }) });
      }
    });
    draw();
    return { refresh: draw, flush() { const ti = el.querySelector('[data-k="title"]'); if (ti) saveTitle.flush(ti.value); const n = el.querySelector('[data-k="notes"]'); if (n) saveNotes.flush(n.value); } };
  };

  /* ------------------------------------------------------------ grouping */
  function groups(view, tasks, today) {
    const g = [];
    const push = (title, items, cls = '') => { if (items.length) g.push({ title, items, cls }); };
    if (view === 'today') {
      const open = tasks.filter((t) => !t.done && t.due && t.due <= today).sort(D.sortTasks);
      push('Overdue', open.filter((t) => t.due < today), 'late');
      push('Today', open.filter((t) => t.due === today));
      push('Done today', tasks.filter((t) => t.done && t.doneAt && U.keyOf(t.doneAt) === today).sort((a, b) => b.doneAt - a.doneAt));
    } else if (view === 'upcoming') {
      const up = tasks.filter((t) => !t.done && t.due && t.due > today).sort(D.sortTasks);
      const soon = U.addDays(today, 14);
      const byDay = {};
      for (const t of up.filter((x) => x.due <= soon)) (byDay[t.due] = byDay[t.due] || []).push(t);
      for (const k of Object.keys(byDay).sort()) push(`${U.relDay(k)}${U.diffDays(k, today) < 7 && U.diffDays(k, today) > 1 ? ', ' + U.short(k) : U.diffDays(k, today) === 1 ? ', ' + U.fmtDate(k, { weekday: 'long' }) : ''}`, byDay[k]);
      push('Later', up.filter((x) => x.due > soon));
    } else if (view === 'anytime') {
      push('No date', tasks.filter((t) => !t.done && !t.due).sort(D.sortTasks));
    } else {
      const done = tasks.filter((t) => t.done && t.doneAt).sort((a, b) => b.doneAt - a.doneAt).slice(0, 150);
      const byDay = {};
      for (const t of done) (byDay[U.keyOf(t.doneAt)] = byDay[U.keyOf(t.doneAt)] || []).push(t);
      for (const k of Object.keys(byDay).sort().reverse()) push(U.relDay(k) === 'Today' || U.relDay(k) === 'Yesterday' ? U.relDay(k) : U.fmtDate(k, { weekday: 'short', day: 'numeric', month: 'short' }), byDay[k]);
    }
    return g;
  }
  const counts = (tasks, today) => ({
    today: tasks.filter((t) => !t.done && t.due && t.due <= today).length,
    upcoming: tasks.filter((t) => !t.done && t.due && t.due > today).length,
    anytime: tasks.filter((t) => !t.done && !t.due).length,
    done: null,
  });

  /* ------------------------------------------------------------------ view */
  O.views.tasks = {
    title: 'Tasks',
    mount(root, params) {
      const qv = params.query.get('view');
      if (qv && VIEWS.some(([k]) => k === qv)) mem.view = qv;
      let selected = params.arg && D.task(params.arg) ? params.arg : null;
      if (selected) {
        const t = D.task(selected), today = U.today();
        mem.view = t.done ? 'done' : !t.due ? 'anytime' : t.due > today ? 'upcoming' : 'today';
      }
      root.innerHTML = `
        <header class="title-row"><div><h1>Tasks</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><button type="button" class="btn primary" id="newbtn">${O.icon('plus')}New task</button></div></header>
        <div class="tabs" role="tablist" id="tabs" aria-label="Which tasks"></div>
        <div class="task-tools">
          <div class="chips" id="chips" role="group" aria-label="Filter by list"></div>
          <label class="search-field">${O.icon('search', 14)}<span class="visually-hidden">Search tasks</span><input class="input" id="q" type="search" placeholder="Search tasks" value="${esc(mem.q)}"></label>
        </div>
        <div class="task-layout">
          <section aria-label="Task list">
            <form class="qa" id="qa" autocomplete="off">
              <div class="qa-field">${O.icon('plus')}<input name="q" placeholder="Add a task: Pay rent on 1 dec every month #home !high" aria-label="Add a task"></div>
              <div class="qa-chips" aria-live="polite"></div>
            </form>
            <div id="list" style="margin-top:8px"></div>
          </section>
          <aside class="panel white detail side" id="detail" aria-label="Task details"></aside>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const qa = $('qa'), qin = qa.querySelector('input'), chips = qa.querySelector('.qa-chips');
      let editor = null, sheet = null;

      const filtered = () => {
        const s = O.store.state, q = mem.q.trim().toLowerCase();
        return s.tasks.filter((t) => (mem.list === 'all' || t.list === mem.list) && (!q || t.title.toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q)));
      };
      function head() {
        const today = U.today(), all = O.store.state.tasks;
        const open = D.openToday(today), od = open.filter((t) => t.due < today).length, dn = D.doneOn(today).length;
        $('sub').textContent = open.length || dn ? `${U.plural(open.length, 'task')} open today${od ? `, ${od} overdue` : ''} · ${dn} done today` : all.length ? 'Nothing due today.' : 'Add your first task below. Dates, times and lists are read from what you type.';
        const c = counts(filtered(), today);
        O.fill($('tabs'), VIEWS.map(([k, label]) => `<button type="button" role="tab" data-k="tab-${k}" data-view="${k}" aria-selected="${mem.view === k}">${label}${c[k] != null ? ` <span class="count num">${c[k]}</span>` : ''}</button>`).join(''));
        const lists = O.store.state.lists;
        if (mem.list !== 'all' && !lists.some((l) => l.id === mem.list)) mem.list = 'all';
        O.fill($('chips'), [`<button type="button" class="fchip" data-k="l-all" data-list="all" aria-pressed="${mem.list === 'all'}">All lists</button>`]
          .concat(lists.map((l) => `<button type="button" class="fchip" data-k="l-${l.id}" data-list="${l.id}" aria-pressed="${mem.list === l.id}">${esc(l.name)}</button>`))
          .concat(`<button type="button" class="fchip" data-k="l-new" data-newlist style="border-style:dashed">New list</button>`).join(''));
      }
      function list() {
        const today = U.today();
        const gs = groups(mem.view, filtered(), today);
        const empties = {
          today: mem.q ? 'No tasks match your search.' : 'Nothing due today. Enjoy it, or pull something from Anytime.',
          upcoming: 'Nothing scheduled ahead. Give a task a date and it will show up here.',
          anytime: 'Tasks without a date land here, ready for when you have time.',
          done: 'Finished tasks are kept here, newest first.',
        };
        O.fill($('list'), gs.length ? gs.map((g) => `<h3 class="group-title ${g.cls}"><span>${esc(g.title)}</span><span class="num">${g.items.length}</span></h3><div class="rcards">${g.items.map((t) => O.taskRow(t, { today, selected: t.id === selected, showList: mem.list === 'all' })).join('')}</div>`).join('')
          : `<div class="empty" style="margin-top:8px">${empties[mem.view]}</div>`);
      }
      function comingUp() {
        const today = U.today(), s = O.store.state;
        const up = s.tasks.filter((t) => !t.done && t.due && t.due > today).sort(D.sortTasks).slice(0, 6);
        const perList = s.lists.map((l) => ({ l, n: s.tasks.filter((t) => !t.done && t.list === l.id).length }));
        const done7 = U.lastDays(7).reduce((a, k) => a + D.doneOn(k).length, 0);
        return `<div class="panel-head"><h2>Coming up</h2><div class="end"><button type="button" class="card-link" data-view="upcoming">Upcoming${O.icon('right')}</button></div></div>
          ${up.length ? `<div class="rcards">${up.map((t) => `<div class="rcard link" style="min-height:52px"><button type="button" class="open-btn" data-act="open-task" data-id="${t.id}" aria-label="Open ${esc(t.title)}"></button><div class="main"><span class="t">${esc(t.title)}</span><span class="s">${esc(D.listName(t.list))}${t.time ? ' · ' + t.time : ''}</span></div><div class="side">${esc(U.relDay(t.due))}</div></div>`).join('')}</div>` : `<div class="empty">Nothing scheduled after today.</div>`}
          <div class="panel-head" style="margin-top:22px"><h2>Open by list</h2></div>
          <div class="rcards">${perList.map(({ l, n }) => `<button type="button" class="rcard link" data-list="${l.id}" style="min-height:44px;text-align:left"><div class="main"><span class="t">${esc(l.name)}</span></div><div class="side num">${n}</div></button>`).join('')}</div>
          <p class="finding" style="margin-top:16px"><b>${done7}</b> tasks finished in the last 7 days. Select a task to edit it.</p>`;
      }
      function detail() {
        const el = $('detail');
        if (selected && D.task(selected) && !U.isPhone()) {
          if (!editor || editor.id !== selected) { el.innerHTML = '<div id="ed"></div>'; editor = O.taskEditor(el.querySelector('#ed'), selected, { onClose: () => select(null) }); editor.id = selected; }
          else editor.refresh();
        } else { editor = null; O.fill(el, comingUp()); }
      }
      function select(id, { push = true } = {}) {
        if (editor) editor.flush();
        selected = id && D.task(id) ? id : null;
        if (push) history.replaceState(null, '', selected ? `#/tasks/${selected}` : '#/tasks');
        list();
        if (U.isPhone() && selected) openSheet(selected); else detail();
      }
      function openSheet(id) {
        const box = document.createElement('div');
        sheet = O.dialog({ title: 'Task', body: box, cls: 'wide', onClose: () => { sheet = null; ed.flush(); select(null); } });
        const ed = O.taskEditor(box, id, { onClose: () => sheet && sheet.close() });
        sheet.editor = ed;
      }
      const all = () => { head(); list(); if (sheet && sheet.editor) sheet.editor.refresh(); else detail(); };
      all();
      if (selected && U.isPhone()) openSheet(selected);

      root.addEventListener('click', async (e) => {
        const tab = e.target.closest('[data-view]');
        if (tab) { mem.view = tab.dataset.view; head(); list(); return; }
        const lf = e.target.closest('[data-list]');
        if (lf) { mem.list = lf.dataset.list; head(); list(); return; }
        if (e.target.closest('[data-newlist]')) { const name = await O.prompt({ title: 'New list', label: 'List name', placeholder: 'e.g. Side project', ok: 'Create' }); if (name) { let id; O.store.update(() => { id = D.ensureList(name); }); mem.list = id; head(); list(); } return; }
        const open = e.target.closest('[data-act="open-task"]');
        if (open) { select(open.dataset.id === selected ? null : open.dataset.id); return; }
        if (e.target.closest('#detail') && e.target.closest('[data-act]') === null) return;
        O.handleCommon(e);
      });
      $('newbtn').addEventListener('click', () => qin.focus());
      $('q').addEventListener('input', (e) => { mem.q = e.target.value; head(); list(); });
      qin.addEventListener('input', () => { chips.innerHTML = qin.value.trim() ? D.quickChips(D.parseQuick(qin.value)).map((c) => `<span class="pill">${esc(c)}</span>`).join('') : ''; });
      qa.addEventListener('submit', (e) => {
        e.preventDefault();
        const extra = { list: mem.list !== 'all' ? mem.list : undefined, due: mem.view === 'today' ? U.today() : undefined };
        const t = O.quickAddTask(qin.value, extra);
        if (t) { qin.value = ''; chips.innerHTML = ''; }
      });
      const onKey = (e) => { if (e.key === 'Escape' && selected && !document.querySelector('dialog[open]')) select(null); };
      document.addEventListener('keydown', onKey);
      return {
        refresh: all,
        tick() { head(); },
        destroy() { if (editor) editor.flush(); document.removeEventListener('keydown', onKey); if (sheet) sheet.close(); },
      };
    },
  };
})();
