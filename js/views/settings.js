/* Orbit — Settings. Every control saves itself; the stamp by the title confirms it. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;

  O.views.settings = {
    title: 'Settings',
    mount(root, params) {
      const S = () => O.store.state;
      const goTo = params && params.query.get('section');
      if (goTo) setTimeout(() => { const el = root.querySelector('#' + goTo); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); const i = el.querySelector('input'); if (i) i.focus({ preventScroll: true }); } }, 60);
      const sw = (key, title, desc) => `<label class="switch-row"><span><b>${title}</b><span>${desc}</span></span><input type="checkbox" class="switch" data-set="${key}" ${S().settings[key] ? 'checked' : ''}></label>`;
      const hourOpts = (from, to, sel) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => `<option value="${h}" ${h === sel ? 'selected' : ''}>${String(h % 24).padStart(2, '0')}:00${h === 24 ? ' (midnight)' : ''}</option>`).join('');

      function draw() {
        const s = S(), st = s.settings;
        const counts = `${U.plural(s.tasks.length, 'task')}, ${U.plural(s.habits.length, 'habit')}, ${U.plural(s.notes.length, 'note')}, ${U.plural(s.sessions.length, 'focus session')} and ${U.plural(Object.keys(s.journal).length, 'journal entry', 'journal entries')}`;
        const perm = 'Notification' in window ? Notification.permission : 'unsupported';
        const http = /^https?:$/.test(location.protocol);
        O.fill(root, `
          <header class="title-row"><div><h1>Settings</h1><p class="sub">Changes save as you make them. <span class="saved-stamp" id="stamp"></span></p></div></header>

          <section class="set-row"><div class="set-label"><h2>Profile</h2><p>Used in the greeting on Today.</p></div>
            <div class="set-panel"><div class="field"><label for="sname">Your name</label><input id="sname" class="input" data-k="name" value="${esc(s.profile.name)}" placeholder="Your first name" maxlength="40" autocomplete="given-name"></div></div></section>

          <section class="set-row"><div class="set-label"><h2>Appearance</h2><p>Make Orbit yours. Changes show at once.</p>
              <div class="look-preview" aria-hidden="true">
                <div class="lp-top"><span class="lp-h">Good evening.</span>${O.fx.ring(0.68, { size: 54, stroke: 5 })}</div>
                <div class="lp-row"><span class="check" aria-checked="true" role="presentation">${O.icon('check')}</span><span>Read 20 minutes</span><span class="pill acc">12 days</span></div>
                <div class="lp-bar"><i></i></div>
                <span class="btn sm primary">Start focus</span>
              </div></div>
            <div class="set-panel">
              <div class="field"><span class="label" id="thl">Theme</span><div class="seg" role="group" aria-labelledby="thl">${[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']].map(([k, v]) => `<button type="button" data-k="th-${k}" data-theme-set="${k}" aria-pressed="${st.theme === k}">${v}</button>`).join('')}</div></div>
              <div class="field"><span class="label" id="acl">Accent colour</span><div class="swatches" role="radiogroup" aria-labelledby="acl">${Object.entries(O.ACCENTS).map(([k, a]) => `<button type="button" role="radio" class="swatch" data-k="ac-${k}" data-accent="${k}" aria-checked="${(st.accent || 'teal') === k}" aria-label="${a.name}" title="${a.name}" style="--sw:${a.c[document.documentElement.dataset.theme === 'dark' ? 1 : 0]}"><span></span></button>`).join('')}</div></div>
              <div class="row2">
                <div class="field"><span class="label" id="hdl">Headings</span><div class="seg" role="group" aria-labelledby="hdl">${[['serif', 'Editorial'], ['sans', 'Modern']].map(([k, v]) => `<button type="button" data-k="hd-${k}" data-head="${k}" aria-pressed="${(st.headings || 'serif') === k}" class="${k === 'serif' ? 'serif-btn' : ''}">${v}</button>`).join('')}</div></div>
                <div class="field"><span class="label" id="mol">Motion</span><div class="seg" role="group" aria-labelledby="mol">${[['full', 'Full'], ['reduced', 'Reduced']].map(([k, v]) => `<button type="button" data-k="mo-${k}" data-motion-set="${k}" aria-pressed="${(st.motion || 'full') === k}">${v}</button>`).join('')}</div></div>
              </div>
              ${sw('celebrate', 'Celebrations', 'Confetti for level-ups, badges, finished goals and a full set of habits.')}
              <div class="field"><label for="dxp">Daily XP goal</label><select id="dxp" class="input" data-num="dailyXp" style="max-width:240px">${[60, 90, 120, 150, 200, 300].map((n) => `<option value="${n}" ${n === (st.dailyXp || 120) ? 'selected' : ''}>${n} XP a day${n === 120 ? ' (default)' : ''}</option>`).join('')}</select><span class="hint">The ring on Today fills toward it. About five tasks and a focus session.</span></div>
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Focus timer</h2><p>Currently ${st.focusMin} minutes of focus, then ${st.shortMin} minutes off; every ${st.longEvery}th break lasts ${st.longMin} minutes.</p>
              <span class="hint" style="display:block;margin:20px 0 8px">What you’ll see when a session ends</span>
              <div class="preview-note">${O.mark(20)}<div><b>Focus session done</b><span>${st.focusMin} min logged. Time for a ${st.shortMin} min break.</span></div></div></div>
            <div class="set-panel">
              <div class="row2">
                <div class="field"><label for="f1">Focus, minutes</label><input id="f1" class="input" type="number" min="1" max="180" data-num="focusMin" value="${st.focusMin}"></div>
                <div class="field"><label for="f2">Short break, minutes</label><input id="f2" class="input" type="number" min="1" max="60" data-num="shortMin" value="${st.shortMin}"></div>
                <div class="field"><label for="f3">Long break, minutes</label><input id="f3" class="input" type="number" min="1" max="90" data-num="longMin" value="${st.longMin}"></div>
                <div class="field"><label for="f4">Long break after</label><select id="f4" class="input" data-num="longEvery">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === st.longEvery ? 'selected' : ''}>${n} focus sessions</option>`).join('')}</select></div>
              </div>
              ${sw('autoBreak', 'Start breaks by themselves', 'When a focus session ends, the break starts counting down.')}
              ${sw('autoFocus', 'Start focus after a break', 'Off by default, so you choose when to begin again.')}
              ${sw('sound', 'Sounds', 'A soft chime when a session or break ends.')}
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Reminders</h2><p>Orbit can’t send anything while it’s closed; reminders fire while it’s open in a tab or installed.</p></div>
            <div class="set-panel">
              ${sw('reminders', 'Remind me when a timed task is due', 'A chime and a message at the task’s time.')}
              <label class="switch-row"><span><b>System notifications</b><span>${perm === 'denied' ? 'Blocked in your browser’s site settings. Allow notifications for this site, then switch this on.' : perm === 'unsupported' ? 'This browser can’t show notifications.' : 'Show reminders and timer alerts even when Orbit is in the background.'}</span></span><input type="checkbox" class="switch" id="notify" ${st.notify && perm === 'granted' ? 'checked' : ''} ${perm === 'denied' || perm === 'unsupported' ? 'disabled' : ''}></label>
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Your day</h2><p>The hours the planner and the day strip on Today show.</p></div>
            <div class="set-panel"><div class="row3">
              <div class="field"><label for="d1">Day starts</label><select id="d1" class="input" data-num="dayStart">${hourOpts(0, 12, st.dayStart)}</select></div>
              <div class="field"><label for="d2">Day ends</label><select id="d2" class="input" data-num="dayEnd">${hourOpts(14, 24, st.dayEnd)}</select></div>
              <div class="field"><label for="d3">Weeks start on</label><select id="d3" class="input" data-num="weekStart"><option value="1" ${st.weekStart === 1 ? 'selected' : ''}>Monday</option><option value="0" ${st.weekStart === 0 ? 'selected' : ''}>Sunday</option></select></div>
            </div></div></section>

          <section class="set-row" id="weather"><div class="set-label"><h2>Weather</h2><p>Shown on Today. Only the city’s coordinates are sent, to Open-Meteo, a free weather service.</p></div>
            <div class="set-panel">
              ${st.location ? `<div class="loc-now">${O.icon('pin2', 16)}<b>${esc(st.location.name)}</b><span class="muted">${esc(st.location.region || '')}</span><button type="button" class="btn sm ghost" data-loc-clear>Remove</button></div>` : ''}
              <div class="field"><label for="wq">${st.location ? 'Change city' : 'Your city'}</label><input id="wq" class="input" placeholder="Start typing, e.g. Delhi" autocomplete="off"></div>
              <div class="loc-results" id="wres"></div>
              <div><button type="button" class="btn sm" data-loc-here>${O.icon('pin2', 14)}Use my current location</button></div>
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Money</h2><p>The currency used everywhere amounts are shown. Budgets are set per category.</p></div>
            <div class="set-panel">
              <div class="row2">
                <div class="field"><label for="cur">Currency</label><select id="cur" class="input">${['INR', 'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'SGD', 'AED', 'PKR', 'BDT', 'NPR', 'LKR'].map((c) => `<option value="${c}" ${c === O.money.currency() ? 'selected' : ''}>${c} · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).formatToParts(0).find((p) => p.type === 'currency').value}</option>`).join('')}</select></div>
                <div class="field"><span class="label">Budgets</span><div><button type="button" class="btn" data-budgets>Edit monthly budgets</button></div></div>
              </div>
              <p class="hint">${s.money.tx.length} entries, ${s.money.subs.length} subscriptions. ${O.money.totalBudget() ? `Total budget ${esc(O.money.fmt(O.money.totalBudget()))} a month.` : 'No budget set yet.'}</p>
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Task lists</h2><p>Deleting a list moves its tasks to ${esc(s.lists[0] ? s.lists[0].name : 'the first list')}.</p></div>
            <div class="set-panel">
              ${s.lists.map((l, i) => `<div style="display:flex;gap:8px;align-items:center"><label class="visually-hidden" for="ln-${l.id}">List name</label><input id="ln-${l.id}" class="input" data-list-name="${l.id}" value="${esc(l.name)}" maxlength="40"><span class="muted num" style="min-width:72px;text-align:right">${U.plural(s.tasks.filter((t) => t.list === l.id && !t.done).length, 'open', 'open')}</span>${i ? `<button type="button" class="btn sm icon ghost" data-list-del="${l.id}" aria-label="Delete list ${esc(l.name)}">${O.icon('trash', 14)}</button>` : '<span style="width:32px"></span>'}</div>`).join('')}
              <div><button type="button" class="btn sm" data-list-add>${O.icon('plus', 14)}New list</button></div>
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Install Orbit</h2><p>Installed, Orbit opens in its own window, works offline and sits with your other apps.</p></div>
            <div class="set-panel">
              ${O.isInstalled() ? `<p>Orbit is installed on this device.</p>` : O.installPrompt ? `<div><button type="button" class="btn primary" data-install>${O.icon('install', 15)}Install Orbit</button></div>` : `<p>${http ? 'In Chrome or Edge, open the browser menu and choose <b>Install Orbit</b>. On an iPhone, tap Share, then <b>Add to Home Screen</b>.' : 'Orbit is open as a file. Start it with <b>npm start</b> (or host the folder) and open it from that address to install it and use it offline.'}</p>`}
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Backup</h2><p>Your data lives in this browser only. Export a backup now and then, and to move to another device.</p></div>
            <div class="set-panel">
              <p>Orbit holds ${counts}.${s.lastBackup ? ` Last backup ${esc(U.relDayInline(U.keyOf(s.lastBackup)))}.` : ' No backup yet.'}</p>
              <div class="set-actions">
                <button type="button" class="btn" data-export>${O.icon('download', 15)}Export backup</button>
                <label class="btn" style="cursor:pointer">${O.icon('upload', 15)}Restore from file<input type="file" accept="application/json,.json" data-import class="visually-hidden"></label>
              </div>
              <div class="set-actions">${s.hasSample ? `<button type="button" class="btn" data-sample-off>Remove sample data</button><span class="hint">Only sample items are removed; what you added stays.</span>` : `<button type="button" class="btn" data-sample-on>Load sample data</button><span class="hint">Fills every screen with two months of example data.</span>`}</div>
            </div></section>

          <section class="set-row"><div class="set-label"><h2>Erase everything</h2><p>Deletes all of Orbit’s data from this browser. It can’t be undone, so export a backup first.</p></div>
            <div class="set-panel"><div><button type="button" class="btn danger" data-erase>${O.icon('trash', 15)}Erase all data</button></div></div></section>`);
      }
      draw();
      const stamp = () => { const s = root.querySelector('#stamp'); if (s) s.textContent = '· Saved ' + U.hm(U.nowMins()); };
      const setS = (fn) => { O.store.update(fn); stamp(); };
      const saveName = U.debounce((v) => { setS((s) => { s.profile.name = v.trim(); }); }, 400);
      const saveList = U.debounce((id, v) => { if (v.trim()) setS((s) => { s.lists.find((l) => l.id === id).name = v.trim(); }); }, 400);

      const findCity = U.debounce(async (q) => {
        const box = root.querySelector('#wres'); if (!box) return;
        if (q.trim().length < 2) { box.innerHTML = ''; return; }
        box.innerHTML = '<span class="hint">Searching…</span>';
        try {
          const rs = await O.weather.search(q.trim());
          box.innerHTML = rs.length ? rs.map((r) => `<button type="button" class="loc-opt" data-loc='${esc(JSON.stringify(r))}'>${O.icon('pin2', 14)}<b>${esc(r.name)}</b><span>${esc(r.region)}</span></button>`).join('') : '<span class="hint">No places found by that name.</span>';
        } catch (_) { box.innerHTML = '<span class="hint">Couldn’t search right now. Check your connection.</span>'; }
      }, 350);
      root.addEventListener('input', (e) => {
        if (e.target.id === 'wq') findCity(e.target.value);
        if (e.target.dataset.k === 'name') saveName(e.target.value);
        if (e.target.dataset.listName) saveList(e.target.dataset.listName, e.target.value);
      });
      root.addEventListener('focusout', (e) => { if (e.target.dataset.k === 'name') saveName.flush(e.target.value); if (e.target.dataset.listName) saveList.flush(e.target.dataset.listName, e.target.value); });
      root.addEventListener('change', async (e) => {
        const t = e.target;
        if (t.dataset.set) { setS((s) => { s.settings[t.dataset.set] = t.checked; }); return; }
        if (t.dataset.num) {
          const key = t.dataset.num, lim = { focusMin: [1, 180], shortMin: [1, 60], longMin: [1, 90], longEvery: [2, 6], dayStart: [0, 12], dayEnd: [14, 24], weekStart: [0, 1], dailyXp: [30, 1000] }[key];
          const v = U.clamp(parseInt(t.value, 10) || lim[0], lim[0], lim[1]);
          setS((s) => { s.settings[key] = v; if (O.timer.status() === 'idle') { s.timer.left = null; } });
          O.timer.emit();
          return;
        }
        if (t.id === 'notify') {
          if (t.checked && Notification.permission !== 'granted') {
            const p = await Notification.requestPermission();
            if (p !== 'granted') { t.checked = false; draw(); return; }
          }
          setS((s) => { s.settings.notify = t.checked; });
          if (t.checked) O.notify('Notifications are on', 'Orbit will let you know when a session ends or a task is due.');
          return;
        }
        if (t.dataset.import !== undefined && t.files && t.files[0]) { await O.importData(t.files[0]); t.value = ''; }
        if (t.id === 'cur') { setS((s) => { s.settings.currency = t.value; }); }
      });
      root.addEventListener('click', async (e) => {
        const th = e.target.closest('[data-theme-set]');
        if (th) { setS((s) => { s.settings.theme = th.dataset.themeSet; }); O.applyTheme(); draw(); return; }
        const ac = e.target.closest('[data-accent]');
        if (ac) { setS((s) => { s.settings.accent = ac.dataset.accent; }); O.applyTheme(); return; }
        const hd = e.target.closest('[data-head]');
        if (hd) { setS((s) => { s.settings.headings = hd.dataset.head; }); O.applyTheme(); return; }
        const mo = e.target.closest('[data-motion-set]');
        if (mo) { setS((s) => { s.settings.motion = mo.dataset.motionSet; }); O.applyTheme(); return; }
        if (e.target.closest('[data-budgets]')) { O.budgetDialog(); return; }
        const lc = e.target.closest('[data-loc]');
        if (lc) { const r = JSON.parse(lc.dataset.loc); setS((s) => { s.settings.location = r; }); O.toast(`Weather set to ${r.name}.`); O.weather.get({ force: true }); return; }
        if (e.target.closest('[data-loc-clear]')) { setS((s) => { s.settings.location = null; }); return; }
        if (e.target.closest('[data-loc-here]')) {
          if (!navigator.geolocation) { O.toast('This browser can’t share your location.'); return; }
          navigator.geolocation.getCurrentPosition((p) => { setS((s) => { s.settings.location = { name: 'My location', region: '', lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) }; }); O.weather.get({ force: true }); O.toast('Weather set to your location.'); }, () => O.toast('Location was not shared. Search for your city instead.'), { timeout: 10000 });
          return;
        }
        if (e.target.closest('[data-export]')) { O.exportData(); draw(); return; }
        if (e.target.closest('[data-install]') && O.installPrompt) { O.installPrompt.prompt(); const r = await O.installPrompt.userChoice; O.installPrompt = null; if (r.outcome !== 'accepted') O.toast('You can install Orbit any time from here.'); draw(); return; }
        if (e.target.closest('[data-sample-on]')) { O.loadSample(); O.toast('Sample data loaded. Remove it here any time.'); return; }
        if (e.target.closest('[data-sample-off]')) { O.removeSample(); O.toast('Sample data removed.'); return; }
        if (e.target.closest('[data-list-add]')) { const name = await O.prompt({ title: 'New list', label: 'List name', placeholder: 'e.g. Side project', ok: 'Create' }); if (name) setS(() => { D.ensureList(name); }); return; }
        const ld = e.target.closest('[data-list-del]');
        if (ld) {
          const s = S(), l = s.lists.find((x) => x.id === ld.dataset.listDel), n = s.tasks.filter((t) => t.list === l.id).length;
          const ok = await O.confirm({ title: `Delete the list “${l.name}”?`, text: n ? `Its ${U.plural(n, 'task')} will move to ${s.lists[0].name}.` : 'It has no tasks.', ok: 'Delete list' });
          if (ok) setS((st) => { st.tasks.forEach((t) => { if (t.list === l.id) t.list = st.lists[0].id; }); st.lists = st.lists.filter((x) => x.id !== l.id); });
          return;
        }
        if (e.target.closest('[data-erase]')) {
          const s = S();
          const ok = await O.confirm({ title: 'Erase all of Orbit’s data?', text: `This deletes ${U.plural(s.tasks.length, 'task')}, ${U.plural(s.habits.length, 'habit')}, ${U.plural(s.notes.length, 'note')} and everything else from this browser. It cannot be undone.`, ok: 'Erase everything' });
          if (ok) { O.store.reset(); O.applyTheme(); O.toast('All data erased.'); O.go('#/today'); }
        }
      });
      return { refresh: draw };
    },
  };
})();
