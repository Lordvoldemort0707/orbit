/* Orbit — Goals. The screen's question: am I moving toward the things that matter?
   A goal is broken into milestones; tasks and habits can be linked to it, and its progress fills in from them. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const G = O.goals;
  const esc = U.esc;

  const dueText = (g) => { if (!g.due) return ''; const n = U.diffDays(g.due, U.today()); return n < 0 ? `${-n} days past the date` : n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : n < 60 ? `${n} days left` : `By ${U.short(g.due)}`; };

  /* ------------------------------------------------------------- the editor */
  O.goalDialog = (id = null, preset = {}) => {
    let g = id ? G.get(id) : null;
    if (!g) {
      O.store.update(() => { g = G.add({ title: preset.title || '', why: preset.why || '' }); }, { silent: true });
      id = g.id;
    }
    const isNew = !g.title;
    const box = document.createElement('div');
    const dlg = O.dialog({ title: isNew ? 'New goal' : 'Goal', body: box, cls: 'wide goal-dlg', onClose: () => { const x = G.get(id); if (x && !x.title.trim()) O.store.update((s) => { s.goals = s.goals.filter((y) => y.id !== id); }); else O.store.emit(); } });
    const draw = () => {
      const x = G.get(id); if (!x) { dlg.close(); return; }
      const p = G.progress(x), ts = G.tasks(x).sort(D.sortTasks), hs = D.activeHabits();
      O.fill(box, `
        <div class="field"><label for="gt">What do you want to achieve?</label><input id="gt" class="input goal-title-in" data-k="gt" value="${esc(x.title)}" placeholder="e.g. Land a summer internship" maxlength="120" autocomplete="off"></div>
        <div class="row2">
          <div class="field"><label for="gw">Why it matters</label><input id="gw" class="input" data-k="gw" value="${esc(x.why || '')}" placeholder="One line to come back to" maxlength="160"></div>
          <div class="field"><label for="gd">Target date</label><input id="gd" type="date" class="input" data-k="gd" value="${x.due || ''}"></div>
        </div>
        <div class="goal-prog"><div class="bar"><i style="width:${(p.ratio * 100).toFixed(1)}%"></i></div><span class="num">${Math.round(p.ratio * 100)}% · ${p.done} of ${p.total} steps</span></div>
        <div class="field"><span class="label">Milestones</span>
          <div class="subtasks">
            ${(x.milestones || []).map((m) => `<div class="subtask ${m.done ? 'done' : ''}"><button type="button" class="check" role="checkbox" aria-checked="${m.done}" data-g="ms-done" data-k="md-${m.id}" data-mid="${m.id}" aria-label="Milestone done">${O.icon('check')}</button><input value="${esc(m.title)}" data-g="ms-title" data-k="mt-${m.id}" data-mid="${m.id}" aria-label="Milestone"><button type="button" class="icon-btn" data-g="ms-del" data-mid="${m.id}" aria-label="Remove milestone">${O.icon('x', 14)}</button></div>`).join('')}
            <div class="subtask"><span class="check" style="border-style:dashed" aria-hidden="true"></span><input data-g="ms-new" data-k="ms-new" placeholder="Add a milestone, e.g. Finish the portfolio site" aria-label="Add a milestone"></div>
          </div>
        </div>
        <div class="field"><span class="label">Tasks for this goal${ts.length ? ` <span class="muted num">${ts.filter((t) => t.done).length}/${ts.length}</span>` : ''}</span>
          <div class="rcards">${ts.slice(0, 8).map((t) => O.taskRow(t)).join('')}</div>
          <form class="qa" data-g="task-form" autocomplete="off"><div class="qa-field" style="height:40px">${O.icon('plus')}<input placeholder="Add a task for this goal: Apply to 3 companies friday" aria-label="Add a task for this goal"></div></form>
        </div>
        <div class="field"><span class="label">Habits that build it</span>
          ${hs.length ? `<div class="chips">${hs.map((h) => `<button type="button" class="fchip" data-g="habit" data-hid="${h.id}" data-k="h-${h.id}" aria-pressed="${h.goalId === id}">${esc(h.name)}</button>`).join('')}</div>` : '<p class="hint">Habits you add can be linked here.</p>'}
        </div>
        <div class="goal-foot">
          <button type="button" class="btn sm danger" data-g="delete">${O.icon('trash', 14)}Delete</button>
          <span style="flex:1"></span>
          ${x.done ? `<button type="button" class="btn sm" data-g="reopen">Reopen</button>` : `<button type="button" class="btn primary" data-g="complete">${O.icon('trophy', 15)}Mark goal achieved</button>`}
        </div>`);
    };
    const set = (fn, silent = false) => O.store.update(() => { const x = G.get(id); if (x) fn(x); }, { silent });
    const saveT = U.debounce((v) => set((x) => { x.title = v.trim(); }, true), 300);
    const saveW = U.debounce((v) => set((x) => { x.why = v; }, true), 300);
    const saveM = U.debounce((mid, v) => set((x) => { const m = x.milestones.find((y) => y.id === mid); if (m) m.title = v; }, true), 300);
    box.addEventListener('input', (e) => { const k = e.target.dataset.k; if (k === 'gt') saveT(e.target.value); if (k === 'gw') saveW(e.target.value); if (e.target.dataset.g === 'ms-title') saveM(e.target.dataset.mid, e.target.value); });
    box.addEventListener('focusout', (e) => { const k = e.target.dataset.k; if (k === 'gt') saveT.flush(e.target.value); if (k === 'gw') saveW.flush(e.target.value); if (e.target.dataset.g === 'ms-title') saveM.flush(e.target.dataset.mid, e.target.value); });
    box.addEventListener('change', (e) => { if (e.target.dataset.k === 'gd') set((x) => { x.due = e.target.value || null; }); });
    box.addEventListener('keydown', (e) => {
      if (e.target.dataset.g === 'ms-new' && e.key === 'Enter') {
        e.preventDefault(); const v = e.target.value.trim(); if (!v) return;
        e.target.value = ''; set((x) => { x.milestones.push({ id: U.uid(), title: v, done: false }); }); e.target.blur(); draw();
        box.querySelector('[data-k="ms-new"]').focus();
      }
      if (e.target.dataset.k === 'gt' && e.key === 'Enter') { e.preventDefault(); saveT.flush(e.target.value); box.querySelector('#gw').focus(); }
    });
    box.addEventListener('submit', (e) => {
      if (e.target.dataset.g !== 'task-form') return;
      e.preventDefault();
      const inp = e.target.querySelector('input'), p = D.parseQuick(inp.value); if (!p.title) return;
      O.store.update(() => { D.addTask({ title: p.title, due: p.due, time: p.time, priority: p.priority, repeat: p.repeat, list: p.listName ? D.ensureList(p.listName) : 'personal', goalId: id }); });
      inp.value = ''; draw(); box.querySelector('[data-g="task-form"] input').focus();
    });
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-g], [data-act]'); if (!b) return;
      if (b.dataset.act === 'toggle-task') { O.toggleTask(b.dataset.id); if (!D.task(b.dataset.id).done) {} else O.fx.burst(b); draw(); return; }
      if (b.dataset.act === 'open-task') { dlg.close(); O.go('#/tasks/' + b.dataset.id); return; }
      const g = b.dataset.g;
      if (g === 'ms-done') { set((x) => { const m = x.milestones.find((y) => y.id === b.dataset.mid); m.done = !m.done; m.doneAt = m.done ? Date.now() : null; if (m.done) O.fx.burst(b, 18); }); draw(); }
      if (g === 'ms-del') { set((x) => { x.milestones = x.milestones.filter((y) => y.id !== b.dataset.mid); }); draw(); }
      if (g === 'habit') { O.store.update(() => { const h = D.habit(b.dataset.hid); h.goalId = h.goalId === id ? null : id; }); draw(); }
      if (g === 'complete') { saveT.flush(box.querySelector('#gt').value); if (!G.get(id).title.trim()) { box.querySelector('#gt').focus(); return; } set((x) => { x.done = true; x.doneAt = Date.now(); }); dlg.close(); O.fx.confetti({ count: 200 }); O.toast(`Goal achieved: ${G.get(id).title}. +${O.xp.RULES.goal} XP`, { ms: 7000 }); }
      if (g === 'reopen') { set((x) => { x.done = false; x.doneAt = null; }); draw(); }
      if (g === 'delete') {
        const x = G.get(id);
        if (x.title && !(await O.confirm({ title: `Delete “${x.title}”?`, text: 'Its milestones go with it. Linked tasks and habits stay, unlinked.', ok: 'Delete goal' }))) return;
        O.store.update((s) => { s.goals = s.goals.filter((y) => y.id !== id); s.tasks.forEach((t) => { if (t.goalId === id) t.goalId = null; }); s.habits.forEach((h) => { if (h.goalId === id) h.goalId = null; }); });
        dlg.close();
      }
    });
    draw();
    setTimeout(() => { const t = box.querySelector('#gt'); if (t && !t.value) t.focus(); }, 30);
    return dlg;
  };

  /* ------------------------------------------------------------- a card */
  O.goalCard = (g, { compact = false } = {}) => {
    const p = G.progress(g), hs = G.habits(g);
    const next = (g.milestones || []).filter((m) => !m.done).slice(0, compact ? 1 : 3);
    return `<article class="goal-card ${g.done ? 'is-done' : ''}" data-goal="${g.id}">
      <button type="button" class="open-btn" data-open-goal="${g.id}" aria-label="Open goal ${esc(g.title)}"></button>
      <div class="goal-top">
        <div class="goal-ring">${O.fx.ring(p.ratio, { size: compact ? 52 : 64, stroke: compact ? 5 : 6 })}<span class="num">${Math.round(p.ratio * 100)}<small>%</small></span></div>
        <div class="goal-head"><h3>${esc(g.title || 'Untitled goal')}</h3><p>${g.done ? `Achieved ${esc(U.relDayInline(U.keyOf(g.doneAt)))}` : esc(g.why || `${p.done} of ${p.total} steps done`)}</p></div>
        ${g.due && !g.done ? `<span class="pill ${U.diffDays(g.due, U.today()) < 0 ? 'neg' : U.diffDays(g.due, U.today()) <= 7 ? 'warn' : ''}">${esc(dueText(g))}</span>` : ''}
      </div>
      ${!compact && next.length ? `<ul class="goal-next">${next.map((m) => `<li><button type="button" class="check" role="checkbox" aria-checked="false" data-ms="${m.id}" data-gid="${g.id}" aria-label="Done: ${esc(m.title)}">${O.icon('check')}</button><span>${esc(m.title)}</span></li>`).join('')}</ul>` : ''}
      ${!compact && hs.length ? `<div class="goal-habits">${hs.map((h) => `<span class="pill">${O.icon('flame')}${esc(h.name)} · ${D.streak(h)} d</span>`).join('')}</div>` : ''}
    </article>`;
  };
  O.goalCardClick = (e) => {
    const ms = e.target.closest('[data-ms]');
    if (ms) { O.store.update(() => { const m = G.get(ms.dataset.gid).milestones.find((y) => y.id === ms.dataset.ms); m.done = true; m.doneAt = Date.now(); }); O.fx.burst(ms, 18); O.toast(`Milestone reached. +${O.xp.RULES.milestone} XP`); return true; }
    const o = e.target.closest('[data-open-goal]');
    if (o) { O.goalDialog(o.dataset.openGoal); return true; }
    return false;
  };

  /* ------------------------------------------------------------------ view */
  const IDEAS = [['Land a summer internship', 'Real experience before final year'], ['Run a 5K without stopping', 'Feel fit and have more energy'], ['Read 12 books this year', 'One a month, fewer screens'], ['Save for a new laptop', 'Stop fighting my old one']];
  O.views.goals = {
    title: 'Goals',
    mount(root, params) {
      root.innerHTML = `
        <header class="title-row"><div><h1>Goals</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><button type="button" class="btn primary" data-new>${O.icon('plus')}New goal</button></div></header>
        <div class="goal-grid" id="active"></div>
        <section id="done" style="margin-top:28px"></section>`;
      const $ = (id) => root.querySelector('#' + id);
      let first = true;
      function draw() {
        const act = G.active().sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1), done = O.store.state.goals.filter((g) => g.done).sort((a, b) => b.doneAt - a.doneAt);
        const steps = act.reduce((a, g) => { const p = G.progress(g); return [a[0] + p.done, a[1] + p.total]; }, [0, 0]);
        const soon = act.find((g) => g.due);
        $('sub').textContent = act.length ? `${U.plural(act.length, 'goal')} in progress · ${steps[1] ? Math.round((steps[0] / steps[1]) * 100) : 0}% of their steps done${soon ? ` · next date: ${soon.title}, ${dueText(soon).toLowerCase()}` : ''}` : 'Pick something that would make this year count, and break it into steps.';
        $('active').innerHTML = act.length ? act.map((g) => O.goalCard(g)).join('') + `<button type="button" class="goal-card goal-add" data-new>${O.icon('plus', 20)}<span>New goal</span></button>`
          : `<div class="empty goal-empty"><p>No goals yet. Start from one of these, or write your own.</p><div class="chips">${IDEAS.map(([t, w]) => `<button type="button" class="fchip" data-idea="${esc(t)}" data-why="${esc(w)}">${esc(t)}</button>`).join('')}</div><button type="button" class="btn sm primary" data-new>${O.icon('plus')}New goal</button></div>`;
        $('done').innerHTML = done.length ? `<div class="panel-head"><h2>Achieved</h2><span class="count-chip">${done.length}</span></div><div class="goal-grid compact">${done.map((g) => O.goalCard(g, { compact: true })).join('')}</div>` : '';
        O.fx.grow(root, first);
        first = false;
      }
      draw();
      if (params.arg === 'new') setTimeout(() => { history.replaceState(null, '', '#/goals'); O.goalDialog(); }, 0);
      else if (params.arg && G.get(params.arg)) setTimeout(() => O.goalDialog(params.arg), 0);
      root.addEventListener('click', (e) => {
        if (O.goalCardClick(e)) return;
        const idea = e.target.closest('[data-idea]'); if (idea) { O.goalDialog(null, { title: idea.dataset.idea, why: idea.dataset.why }); return; }
        if (e.target.closest('[data-new]')) O.goalDialog();
      });
      return { refresh: draw };
    },
  };
})();
