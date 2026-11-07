/* Orbit — the shell: navigation, the router, first run, reminders, offline and install. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const $ = (id) => document.getElementById(id);

  const GROUPS = [
    ['', [['today', 'Today'], ['tasks', 'Tasks'], ['calendar', 'Calendar'], ['planner', 'Planner']]],
    ['Grow', [['habits', 'Habits'], ['goals', 'Goals'], ['focus', 'Focus'], ['study', 'Study']]],
    ['Life', [['money', 'Money'], ['notes', 'Notes'], ['journal', 'Journal']]],
    ['Insights', [['review', 'Review'], ['stats', 'Stats'], ['progress', 'Progress']]],
  ].map(([g, items]) => [g, items.map(([id, label]) => ({ id, label, icon: id === 'calendar' ? 'calendar' : id }))]);
  const TABS = ['today', 'tasks', 'habits', 'calendar'];
  const ALL = [...GROUPS.flatMap(([, xs]) => xs), { id: 'settings', label: 'Settings', icon: 'settings' }];

  /* a region that holds the caret is left alone, so a redraw never eats what you are typing */
  O.fill = (el, html) => {
    if (!el) return;
    const a = document.activeElement;
    const inside = a && el.contains(a);
    if (inside && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|button)$/.test(a.type)) || a.tagName === 'SELECT')) return;
    const key = inside ? (a.dataset.k ? `[data-k="${a.dataset.k}"]` : a.id ? '#' + CSS.escape(a.id) : null) : null;
    el.innerHTML = html;
    if (key) { const n = el.querySelector(key); if (n) n.focus({ preventScroll: true }); }
  };

  /* ------------------------------------------------------------------ shell */
  function shell() {
    $('brand').innerHTML = `${O.mark(24)}<b>Orbit</b>`;
    const item = (n) => `<a class="nav-item" href="#/${n.id}" data-route="${n.id}">${O.icon(n.icon)}<span>${n.label}</span><span class="count" data-navcount="${n.id}"></span></a>`;
    $('navs').innerHTML = GROUPS.map(([g, xs]) => `${g ? `<div class="side-group">${g}</div>` : ''}<nav class="nav" aria-label="${g || 'Plan'}">${xs.map(item).join('')}</nav>`).join('');
    $('nav-settings').innerHTML = `${O.icon('settings')}<span>Settings</span>`;
    $('search-btn').innerHTML = `${O.icon('search')}<span class="lbl">Search or jump to…</span><kbd>Ctrl K</kbd>`;
    $('keys-btn').innerHTML = O.icon('keyboard', 18);
    $('tabbar').innerHTML = TABS.map((id) => { const n = ALL.find((x) => x.id === id); return `<a class="tab" href="#/${id}" data-route="${id}">${O.icon(n.icon, 22)}<span>${n.label}</span></a>`; }).join('') +
      `<button type="button" class="tab" id="more-btn" data-route="more">${O.icon('menu', 22)}<span>More</span></button>`;
    O.timer.on(() => O.ambient.follow());
    $('search-btn').addEventListener('click', () => O.palette());
    $('keys-btn').addEventListener('click', () => O.showShortcuts());
    $('theme-btn').addEventListener('click', () => { O.toggleTheme(); shellState(); });
    $('more-btn').addEventListener('click', openMore);
    O.timer.on(timerChip);
    timerChip();
    shellState();
  }
  function shellState() {
    const s = O.store.state, today = U.today();
    const open = D.openToday(today).length;
    const c = document.querySelector('[data-navcount="tasks"]');
    if (c) { c.textContent = open || ''; c.setAttribute('aria-label', open ? `${open} due today` : ''); }
    const sc = document.querySelector('[data-navcount="study"]');
    if (sc && O.cards) { const n = O.cards.dueCount(); sc.textContent = n || ''; sc.setAttribute('aria-label', n ? `${n} cards due` : ''); }
    const name = s.profile.name.trim(), x = O.xp.compute();
    $('user-row').href = '#/progress';
    $('user-row').innerHTML = `<span class="avatar lvl-avatar" aria-hidden="true">${x.level}</span><span class="who"><b>${esc(name || 'You')}</b><span>Level ${x.level} · ${esc(x.title)}</span><span class="side-xp"><i style="width:${((x.into / x.need) * 100).toFixed(1)}%"></i></span></span>`;
    $('user-row').setAttribute('aria-label', `${name || 'You'}, level ${x.level}, ${x.into} of ${x.need} XP to the next level`);
    $('theme-btn').innerHTML = O.icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon', 18);
  }
  function timerChip() {
    const t = O.timer, chip = $('timer-chip');
    const on = t.status() !== 'idle';
    chip.classList.toggle('on', on);
    chip.classList.toggle('paused', t.status() === 'paused');
    if (on) chip.innerHTML = `<span class="dot"></span><span class="num">${t.MODES[t.mode()]} ${t.fmt(t.left())}</span>`;
  }
  function openMore() {
    const d = O.dialog({
      title: 'More', cls: 'small more-sheet',
      body: `<nav class="nav more-nav">${ALL.filter((n) => !TABS.includes(n.id)).map((n) => `<a class="nav-item" href="#/${n.id}">${O.icon(n.icon, 20)}<span>${n.label}</span></a>`).join('')}
        <button type="button" class="nav-item" id="more-search" style="border:0;background:none;width:100%">${O.icon('search', 20)}<span>Search</span></button></nav>`,
    });
    d.body.addEventListener('click', (e) => {
      if (e.target.closest('a')) d.close();
      if (e.target.closest('#more-search')) { d.close(); setTimeout(() => O.palette(), 0); }
    });
  }

  /* ----------------------------------------------------------------- router */
  let current = null, currentName = '';
  O.views = O.views || {};
  O.route = () => {
    const raw = location.hash.replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const [name, ...rest] = path.split('/');
    const params = { arg: rest.join('/') || null, query: new URLSearchParams(qs || '') };
    const root = $('view');
    const s = O.store.state;
    let viewName = O.views[name] ? name : 'today';
    if (!s.seen.onboarding && viewName !== 'settings') viewName = 'welcome';
    const same = viewName === currentName;
    if (current && current.destroy) current.destroy();
    root.innerHTML = '';
    const v = O.views[viewName];
    current = v.mount(root, params) || {};
    currentName = viewName;
    O.viewTitle = v.title || '';
    // blocks rise in when a screen opens; the class comes off afterwards so redraws don't replay it
    root.classList.remove('enter'); void root.offsetWidth;
    if (!O.fx.calm() && !same) { root.classList.add('enter'); clearTimeout(O._enterT); O._enterT = setTimeout(() => root.classList.remove('enter'), 900); }
    O.timer.emit();
    U.$$('[data-route]').forEach((a) => a.setAttribute('aria-current', a.dataset.route === viewName ? 'page' : 'false'));
    const more = $('more-btn'); if (more) more.setAttribute('aria-current', !TABS.includes(viewName) && viewName !== 'welcome' ? 'page' : 'false');
    $('top-left').innerHTML = `${O.mark(22)}<b>${esc(v.title || 'Orbit')}</b>`;
    if (!same) { $('sheet').scrollTop = 0; window.scrollTo(0, 0); root.focus({ preventScroll: true }); }
    if (O.pendingFocus) { const el = root.querySelector(O.pendingFocus); O.pendingFocus = null; if (el) setTimeout(() => el.focus(), 30); }
  };
  window.addEventListener('hashchange', O.route);
  O.store.subscribe(() => {
    shellState();
    if (current && current.refresh) current.refresh();
    O.celebrateCheck();
  });

  /* ------------------------------------------------------------- first run */
  O.views.welcome = {
    title: 'Welcome',
    mount(root) {
      root.innerHTML = `
        <section class="welcome">
          ${O.mark(40)}
          <div>
            <h1>One place for your day.</h1>
            <p class="lead" style="margin-top:12px">Orbit keeps your tasks, habits, focus sessions, plans, notes and journal together. Everything stays on this device; nothing is sent anywhere.</p>
          </div>
          <ul>
            <li><b>Tasks</b><span>Type “Call Mom tomorrow 6pm !high” and the date, time and priority fill themselves in.</span></li>
            <li><b>Habits</b><span>Check off each day and keep streaks going, with a year of history.</span></li>
            <li><b>Focus</b><span>A pomodoro timer that logs every session against a task.</span></li>
            <li><b>Planner</b><span>Drag out time blocks on your day and see plan against what happened.</span></li>
          </ul>
          <form id="wf">
            <div class="field"><label for="wname">What should Orbit call you?</label><input id="wname" class="input" autocomplete="given-name" placeholder="Your first name" maxlength="40"></div>
            <div class="set-actions">
              <button class="btn primary" type="submit">Start with a clean slate</button>
              <button class="btn" type="button" id="wsample">Explore with sample data</button>
            </div>
            <p class="hint">Sample data can be removed in Settings at any time, without touching anything you add.</p>
          </form>
        </section>`;
      const name = root.querySelector('#wname');
      const finish = (sample) => {
        O.store.update((s) => { s.profile.name = name.value.trim(); s.seen.onboarding = true; });
        if (sample) O.loadSample();
        O.go('#/today');
      };
      root.querySelector('#wf').addEventListener('submit', (e) => { e.preventDefault(); finish(false); });
      root.querySelector('#wsample').addEventListener('click', () => finish(true));
      setTimeout(() => name.focus(), 50);
    },
  };

  /* ------------------------------------------------------ minute heartbeat */
  let day = U.today();
  const fired = new Set();
  function heartbeat() {
    const today = U.today();
    if (today !== day) { day = today; O.money.processSubs(); O.route(); return; }
    if (Date.now() - (O.lastWeather || 0) > 30 * 60e3) { O.lastWeather = Date.now(); O.weather.get().then((w) => { if (w && currentName === 'today' && current.tick) current.tick(); }); }
    if (current && current.tick) current.tick();
    // reminders for timed tasks, while Orbit is open
    const s = O.store.state;
    if (!s.settings.reminders) return;
    const now = U.hm(U.nowMins());
    for (const t of s.tasks) {
      if (t.done || t.due !== today || t.time !== now || fired.has(t.id + now)) continue;
      fired.add(t.id + now);
      O.sound('chime');
      O.toast(`It’s ${now}: ${t.title}`, { action: 'Done', onAction: () => O.toggleTask(t.id), ms: 12000 });
      O.notify(t.title, `Due now, ${now}`);
    }
    for (const h of D.activeHabits()) {
      if (!h.remindAt || h.remindAt !== now || !D.isScheduled(h, today) || D.hDone(h, today) || fired.has(h.id + now)) continue;
      fired.add(h.id + now);
      O.sound('chime');
      O.toast(`Time for ${h.name}`, { action: 'Done', ms: 12000, onAction: () => { O.store.update(() => D.setCount(h, today, h.target || 1)); } });
      O.notify(h.name, 'Your habit reminder');
    }
  }
  setInterval(heartbeat, 20000);

  /* --------------------------------------------------- offline and install */
  O.installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); O.installPrompt = e; if (currentName === 'settings' && current.refresh) current.refresh(); });
  window.addEventListener('appinstalled', () => { O.installPrompt = null; O.toast('Orbit is installed. Open it from your apps.'); });
  O.isInstalled = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) O.toast('A new version of Orbit is ready.', { action: 'Reload', ms: 15000, onAction: () => reg.waiting.postMessage('skip-waiting') });
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w && w.addEventListener('statechange', () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              O.toast('A new version of Orbit is ready.', { action: 'Reload', ms: 15000, onAction: () => w.postMessage('skip-waiting') });
            }
          });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded) { reloaded = true; location.reload(); } });
    });
  }

  /* ------------------------------------------------------------------ boot */
  O.applyTheme();
  O.money.processSubs();
  // ?demo on a fresh browser opens straight into the sample data
  if (new URLSearchParams(location.search).has('demo') && !O.store.state.seen.onboarding) O.loadSample();
  O.timerBoot();
  O.celebrateCheck(true);
  shell();
  O.route();
})();
