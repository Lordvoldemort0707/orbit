/* Orbit — shared interface pieces: toasts with undo, dialogs, confirm, the command palette and shortcuts. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;

  /* ------------------------------------------------------------------ toast */
  O.toast = (msg, { action, onAction, ms = 5000 } = {}) => {
    const root = document.getElementById('toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button" class="toast-act">${esc(action)}</button>` : ''}`;
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    let t = setTimeout(close, ms);
    function close() { clearTimeout(t); el.classList.remove('in'); setTimeout(() => el.remove(), 200); }
    if (action) el.querySelector('.toast-act').addEventListener('click', () => { close(); onAction && onAction(); });
    el.addEventListener('pointerenter', () => clearTimeout(t));
    el.addEventListener('pointerleave', () => { t = setTimeout(close, 2500); });
    return close;
  };

  /* ----------------------------------------------------------------- dialog */
  O.dialog = ({ title, body = '', actions = [], cls = '', onClose, label } = {}) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'modal ' + cls;
    dlg.setAttribute('aria-label', label || title || 'Dialog');
    dlg.innerHTML = `
      ${title ? `<header class="modal-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${O.icon('x', 18)}</button></header>` : ''}
      <div class="modal-body"></div>
      ${actions.length ? `<footer class="modal-foot">${actions.map((a, i) => `<button type="button" class="btn ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''} ${a.left ? 'push-left' : ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</footer>` : ''}`;
    const bodyEl = dlg.querySelector('.modal-body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
    document.body.appendChild(dlg);
    const api = {
      el: dlg, body: bodyEl,
      close(v) { if (dlg.open) dlg.close(v); },
    };
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) { api.close('backdrop'); return; }
      if (e.target.closest('[data-close]')) { api.close('x'); return; }
      const b = e.target.closest('.modal-foot [data-i]');
      if (b) { const a = actions[+b.dataset.i]; const r = a.onClick ? a.onClick(api) : undefined; if (r !== false) api.close(a.value || a.label); }
    });
    dlg.addEventListener('close', () => { onClose && onClose(dlg.returnValue); dlg.remove(); });
    dlg.showModal();
    return api;
  };

  O.confirm = ({ title, text, ok = 'Delete', danger = true }) => new Promise((resolve) => {
    let answer = false;
    O.dialog({
      title, cls: 'small',
      body: `<p class="lead">${esc(text)}</p>`,
      actions: [
        { label: 'Cancel' },
        { label: ok, primary: !danger, danger, onClick: () => { answer = true; } },
      ],
      onClose: () => resolve(answer),
    });
  });

  /* a dialog that asks for one line of text */
  O.prompt = ({ title, label, value = '', ok = 'Save', placeholder = '' }) => new Promise((resolve) => {
    let answer = null;
    const d = O.dialog({
      title, cls: 'small',
      body: `<form class="field" id="pf"><label for="pfi">${esc(label)}</label><input id="pfi" class="input" value="${esc(value)}" placeholder="${esc(placeholder)}" autocomplete="off"></form>`,
      actions: [{ label: 'Cancel' }, { label: ok, primary: true, onClick: () => { answer = d.body.querySelector('input').value.trim(); } }],
      onClose: () => resolve(answer || null),
    });
    const inp = d.body.querySelector('input');
    inp.focus(); inp.select();
    d.body.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); answer = inp.value.trim(); d.close('ok'); });
  });

  /* ------------------------------------------------------- command palette */
  const score = (q, s) => {
    q = q.toLowerCase(); s = s.toLowerCase();
    if (!q) return 1;
    const i = s.indexOf(q);
    if (i >= 0) return 100 - i - (s.length - q.length) * 0.05;
    let qi = 0, sc = 0, last = -1;
    for (let j = 0; j < s.length && qi < q.length; j++) if (s[j] === q[qi]) { sc += last === j - 1 ? 3 : 1; last = j; qi++; }
    return qi === q.length ? sc : 0;
  };
  function paletteItems(q) {
    const st = O.store.state, t = O.timer;
    const nav = [
      ['Today', '#/today', 'today'], ['Tasks', '#/tasks', 'tasks'], ['Habits', '#/habits', 'habits'], ['Focus', '#/focus', 'focus'],
      ['Planner', '#/planner', 'planner'], ['Notes', '#/notes', 'notes'], ['Journal', '#/journal', 'journal'], ['Stats', '#/stats', 'stats'], ['Settings', '#/settings', 'settings'],
      ['Calendar', '#/calendar', 'calendar'], ['Goals', '#/goals', 'goals'], ['Money', '#/money', 'money'], ['Progress', '#/progress', 'progress'],
      ['Study', '#/study', 'study'], ['Review', '#/review', 'review'],
    ].map(([n, h, i]) => ({ group: 'Go to', label: n, icon: i, run: () => O.go(h) }));
    const actions = [
      { label: 'New task', icon: 'plus', run: () => O.newTask() },
      { label: t && t.status() === 'running' ? 'Pause the focus timer' : 'Start a focus session', icon: 'focus', run: () => { t.toggle(); } },
      { label: 'New note', icon: 'notes', run: () => O.go('#/notes/new') },
      { label: 'New habit', icon: 'habits', run: () => O.go('#/habits/new') },
      { label: 'Plan a time block', icon: 'planner', run: () => O.go('#/planner/new') },
      { label: 'Write today’s journal', icon: 'journal', run: () => O.go('#/journal') },
      { label: 'Switch light or dark theme', icon: 'moon', run: () => O.toggleTheme() },
      { label: 'Export a backup', icon: 'download', run: () => O.exportData() },
      { label: 'Keyboard shortcuts', icon: 'keyboard', run: () => O.showShortcuts() },
      { label: 'New goal', icon: 'goals', run: () => O.go('#/goals/new') },
      { label: 'New countdown', icon: 'hourglass', run: () => { O.go('#/calendar'); setTimeout(() => O.countdownDialog(), 50); } },
      { label: 'Add a subscription', icon: 'money', run: () => { O.go('#/money'); setTimeout(() => O.subDialog(), 50); } },
      { label: 'Play focus sounds', icon: 'sound', run: () => { const k = O.store.state.settings.ambient; O.ambient.playing() ? O.ambient.stop() : O.ambient.play(k && k !== 'off' ? k : 'rain'); } },
      { label: 'See level and achievements', icon: 'progress', run: () => O.go('#/progress') },
      { label: 'Review flashcards', icon: 'study', run: () => O.go('#/study/review/all') },
      { label: 'New flashcard', icon: 'study', run: () => O.cardDialog() },
      { label: 'Wrap up the day', icon: 'review', run: () => O.go('#/review') },
      { label: 'Weekly review', icon: 'review', run: () => O.go('#/review/week') },
      { label: 'Customize the Today page', icon: 'layout', run: () => { O.go('#/today'); setTimeout(() => O.customizeToday(), 60); } },
    ].map((a) => ({ group: 'Actions', ...a }));
    const tasks = st.tasks.filter((x) => !x.done).map((x) => ({ group: 'Tasks', label: x.title, hint: x.due ? U.relDay(x.due) : D.listName(x.list), icon: 'tasks', run: () => O.go('#/tasks/' + x.id) }));
    const notes = st.notes.map((n) => ({ group: 'Notes', label: n.title || 'Untitled note', hint: U.short(U.keyOf(n.updatedAt)), icon: 'notes', run: () => O.go('#/notes/' + n.id) }));
    const habits = D.activeHabits().map((h) => ({ group: 'Habits', label: h.name, hint: D.hDone(h, U.today()) ? 'Done today' : 'Open today', icon: 'habits', run: () => O.go('#/habits/' + h.id) }));
    let all = [...actions, ...nav, ...tasks, ...habits, ...notes];
    if (!q) return [...actions.slice(0, 5), ...nav].slice(0, 14);
    all = all.map((it) => ({ it, s: score(q, it.label) + (it.group === 'Actions' || it.group === 'Go to' ? 2 : 0) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.it);
    const goals = O.store.state.goals.map((g) => ({ group: 'Goals', label: g.title, hint: g.done ? 'Achieved' : Math.round(O.goals.progress(g).ratio * 100) + '%', icon: 'goals', run: () => O.go('#/goals/' + g.id) }));
    all = all.concat(goals.map((it) => ({ it, s: score(q, it.label) })).filter((x) => x.s > 0).slice(0, 3).map((x) => x.it));
    const p = D.parseQuick(q);
    const chips = D.quickChips(p);
    const mp = O.money.parse(q);
    if (/^\s*[+\-₹$€£]?\s*\d/.test(q) && mp.amount) all.unshift({ group: 'Add', label: `Log ${mp.type === 'income' ? 'income' : 'spending'}: ${O.money.fmt(mp.amount)}${mp.type === 'expense' ? ' on ' + O.money.catName(mp.category) : ''}`, hint: mp.note, icon: 'money', run: () => O.quickMoney(q) });
    all.push({ group: 'Add', label: `Add task “${p.title || q}”`, hint: chips.join(' · '), icon: 'plus', run: () => O.quickAddTask(q) });
    return all;
  }
  O.palette = () => {
    if (document.querySelector('dialog.palette')) return;
    const d = O.dialog({ cls: 'palette', label: 'Search and commands', body: `
      <div class="pal-search">${O.icon('search', 18)}<input class="pal-input" placeholder="Search tasks, notes, habits or type a command" aria-label="Search or type a command" autocomplete="off" spellcheck="false"></div>
      <div class="pal-list" role="listbox" aria-label="Results"></div>
      <div class="pal-foot"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></div>` });
    const inp = d.body.querySelector('.pal-input'), list = d.body.querySelector('.pal-list');
    let items = [], sel = 0;
    const draw = () => {
      items = paletteItems(inp.value.trim());
      sel = Math.min(sel, items.length - 1);
      let g = '';
      list.innerHTML = items.map((it, i) => {
        const head = it.group !== g ? `<div class="pal-group">${esc((g = it.group))}</div>` : '';
        return `${head}<div class="pal-item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === sel}">${O.icon(it.icon)}<span class="pal-label">${esc(it.label)}</span>${it.hint ? `<span class="pal-hint">${esc(it.hint)}</span>` : ''}</div>`;
      }).join('');
      inp.setAttribute('aria-activedescendant', 'pal-' + sel);
    };
    const run = (i) => { const it = items[i]; if (!it) return; d.close('run'); setTimeout(() => it.run(), 0); };
    inp.addEventListener('input', () => { sel = 0; draw(); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % items.length; draw(); list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + items.length) % items.length; draw(); list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); run(sel); }
    });
    list.addEventListener('click', (e) => { const r = e.target.closest('.pal-item'); if (r) run(+r.dataset.i); });
    list.addEventListener('pointermove', (e) => { const r = e.target.closest('.pal-item'); if (r && +r.dataset.i !== sel) { sel = +r.dataset.i; U.$$('.pal-item', list).forEach((x) => x.setAttribute('aria-selected', x === r)); } });
    draw();
    inp.focus();
  };

  /* ------------------------------------------------------------- shortcuts */
  const SHORTCUTS = [
    ['Ctrl K', 'Search and run any command'], ['/', 'Search'], ['N', 'New task'], ['Space', 'Start or pause the timer (on Focus)'],
    ['G then T', 'Go to Today'], ['G then K', 'Go to Tasks'], ['G then H', 'Go to Habits'], ['G then F', 'Go to Focus'],
    ['G then P', 'Go to Planner'], ['G then N', 'Go to Notes'], ['G then J', 'Go to Journal'], ['G then S', 'Go to Stats'],
    ['G then C', 'Go to Calendar'], ['G then G', 'Go to Goals'], ['G then M', 'Go to Money'], ['G then L', 'Go to Progress (level)'],
    ['G then D', 'Go to Study (decks)'], ['G then R', 'Go to Review'], ['Space, then 1 to 4', 'Show a flashcard, then grade it'], ['?', 'Show this list'],
  ];
  O.showShortcuts = () => O.dialog({
    title: 'Keyboard shortcuts', cls: 'small',
    body: `<dl class="keys">${SHORTCUTS.map(([k, v]) => `<div><dt>${k.split(' ').map((x) => (x === 'then' ? '<span class="then">then</span>' : `<kbd>${x}</kbd>`)).join('')}</dt><dd>${v}</dd></div>`).join('')}</dl>`,
  });
  const typing = (el) => el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  let gPending = 0;
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); O.palette(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
    const k = e.key.toLowerCase();
    if (gPending && Date.now() - gPending < 1200) {
      gPending = 0;
      const map = { t: 'today', k: 'tasks', h: 'habits', f: 'focus', p: 'planner', n: 'notes', j: 'journal', s: 'stats', c: 'calendar', g: 'goals', m: 'money', l: 'progress', d: 'study', r: 'review' };
      if (map[k]) { e.preventDefault(); O.go('#/' + map[k]); }
      return;
    }
    if (k === 'g') { gPending = Date.now(); return; }
    if (k === '/') { e.preventDefault(); O.palette(); }
    else if (k === 'n') { e.preventDefault(); O.newTask(); }
    else if (e.key === '?') { e.preventDefault(); O.showShortcuts(); }
  });

  /* ------------------------------------------------------- shared actions */
  O.go = (hash) => { if (location.hash === hash) O.route(); else location.hash = hash; };
  /* the quick-add on the current screen if there is one, otherwise the Tasks screen's */
  O.newTask = () => {
    const qa = document.querySelector('#view .qa input');
    if (qa) { qa.focus(); qa.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
    O.pendingFocus = '.qa input';
    O.go('#/tasks');
  };
  O.quickAddTask = (text, extra = {}) => {
    const p = D.parseQuick(text);
    if (!p.title) return null;
    let t;
    O.store.update((s) => {
      const list = p.listName ? D.ensureList(p.listName) : extra.list || 'personal';
      t = D.addTask({ title: p.title, due: p.due ?? extra.due ?? null, time: p.time, priority: p.priority, repeat: p.repeat, list });
    });
    O.toast(`Added “${t.title}”${t.due ? ' for ' + U.relDayInline(t.due) : ''}`, {
      action: 'Undo', onAction: () => O.store.update((s) => { s.tasks = s.tasks.filter((x) => x.id !== t.id); }),
    });
    return t;
  };
  /* tick a task, with undo; repeating tasks open their next date */
  O.toggleTask = (id) => {
    const t = D.task(id); if (!t) return;
    const was = t.done;
    let spawned;
    O.store.update(() => { spawned = D.setDone(id, !was); });
    if (!was) {
      if (O.sound) O.sound('tick');
      O.toast(spawned ? `Done. The next one is due ${U.relDayInline(spawned.due)}.` : `Done: “${t.title}”`, { action: 'Undo', onAction: () => O.store.update(() => D.setDone(id, false)) });
    }
  };
  O.toggleTheme = () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    O.store.update((s) => { s.settings.theme = dark ? 'light' : 'dark'; });
    O.applyTheme();
  };
  /* accents: [light, dark], each readable as text on its own ground */
  O.ACCENTS = {
    teal: { name: 'Teal', c: ['#1b6e66', '#3fb3a5'] },
    ocean: { name: 'Ocean', c: ['#1d5fbf', '#6ea8ff'] },
    forest: { name: 'Forest', c: ['#2f7d3a', '#62c46f'] },
    amber: { name: 'Amber', c: ['#a85208', '#f2a33a'] },
    rose: { name: 'Rose', c: ['#b8195a', '#f36fa7'] },
    graphite: { name: 'Graphite', c: ['#3a3b3f', '#d6d6da'] },
  };
  O.applyTheme = () => {
    const st = O.store.state.settings, t = st.theme;
    const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    root.dataset.theme = dark ? 'dark' : 'light';
    const a = (O.ACCENTS[st.accent] || O.ACCENTS.teal).c[dark ? 1 : 0];
    root.style.setProperty('--accent', a);
    root.dataset.headings = st.headings === 'sans' ? 'sans' : 'serif';
    root.dataset.motion = st.motion === 'reduced' ? 'reduced' : 'full';
    try { localStorage.setItem('orbit.accent', a); } catch (_) {}
    const meta = document.querySelector('meta[name="theme-color"]:not([media])') || (() => { const m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); return m; })();
    meta.content = dark ? '#000000' : '#f6f6f3';
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => O.applyTheme());

  O.downloadFile = (name, text, type) => {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  O.exportData = async () => {
    const data = JSON.stringify(O.store.state, null, 2);
    const name = `orbit-backup-${U.today()}.json`;
    try {
      const file = new File([data], name, { type: 'application/json' });
      if (U.isPhone() && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Orbit backup' });
        O.store.update((s) => { s.lastBackup = Date.now(); }, { silent: true });
        O.toast('Backup shared.');
        return;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    O.store.update((s) => { s.lastBackup = Date.now(); }, { silent: true });
    O.toast('Backup saved to your downloads.');
  };
  O.importData = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object' || !Array.isArray(data.tasks)) throw new Error('not an Orbit backup');
        const ok = await O.confirm({ title: 'Replace your data?', text: `This backup has ${U.plural(data.tasks.length, 'task')}, ${U.plural((data.habits || []).length, 'habit')} and ${U.plural((data.notes || []).length, 'note')}. Everything in Orbit now will be replaced by it.`, ok: 'Replace', danger: true });
        if (ok) { O.store.replace(data); O.applyTheme(); O.toast('Backup restored.'); }
        resolve(ok);
      } catch (e) { O.toast('That file is not an Orbit backup.'); resolve(false); }
    };
    r.readAsText(file);
  });
})();
