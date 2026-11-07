/* Orbit — Focus. The screen's question: how long is left, and what am I working on?
   The countdown is the screen's object, set large so it reads from across the desk. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const R = 46, C = 2 * Math.PI * R;

  O.views.focus = {
    title: 'Focus',
    mount(root) {
      root.innerHTML = `
        <header class="title-row"><div><h1>Focus</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><a class="btn" href="#/settings">${O.icon('settings', 14)}Timer settings</a></div></header>
        <div class="grid">
          <div class="s7" style="display:flex;flex-direction:column;gap:16px;min-width:0">
            <section class="panel focus-main" aria-label="Focus timer" id="main"></section>
            <section class="panel" aria-labelledby="sndh"><div class="panel-head"><h2 id="sndh">Focus sounds</h2><span class="meta" id="sndmeta"></span></div><div id="snd"></div></section>
          </div>
          <div class="s5" style="display:flex;flex-direction:column;gap:16px;min-width:0">
            <section class="panel" aria-labelledby="sh"><div class="panel-head"><h2 id="sh">Today’s sessions</h2><span class="count-chip" id="scount"></span><div class="end"><span class="meta num" id="stotal"></span></div></div><div class="sess-list" id="sessions"></div></section>
            <section class="panel" style="flex:1" aria-labelledby="bh"><div class="panel-head"><h2 id="bh">Minutes focused, last 14 days</h2></div><div class="chart" id="bars"></div><p class="finding" id="bfind"></p></section>
          </div>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const t = O.timer;

      function sub() {
        const today = U.today(), m = D.focusOn(today), n = D.sessionsOn(today).length;
        const week = U.lastDays(7).reduce((a, k) => a + D.focusOn(k), 0);
        $('sub').textContent = n ? `${U.dur(m)} today across ${U.plural(n, 'session')} · ${U.dur(week)} in the last 7 days` : week ? `No sessions yet today · ${U.dur(week)} in the last 7 days` : 'Pick a task, press Start, and work until the chime.';
      }
      function main() {
        const st = O.store.state, s = st.settings, ts = st.timer;
        const running = t.status() === 'running', idle = t.status() === 'idle';
        const open = st.tasks.filter((x) => !x.done && (!x.due || x.due <= U.addDays(U.today(), 2))).sort(D.sortTasks).slice(0, 30);
        const cur = ts.taskId && D.task(ts.taskId);
        if (cur && !open.includes(cur)) open.unshift(cur);
        const every = s.longEvery || 4, inSet = (ts.cycle || 0) % every;
        O.fill($('main'), `
          <div class="seg" role="group" aria-label="Timer mode">${Object.entries(t.MODES).map(([k, v]) => `<button type="button" data-mode="${k}" data-k="m-${k}" aria-pressed="${t.mode() === k}">${v}</button>`).join('')}</div>
          ${t.mode() === 'focus' && idle ? `<div class="presets" role="group" aria-label="Focus length">${[15, 25, 50, 90].map((n) => `<button type="button" class="fchip" data-len="${n}" data-k="len-${n}" aria-pressed="${s.focusMin === n}">${n} min</button>`).join('')}</div>` : ''}
          <div class="ring-wrap">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="${R}" fill="none" stroke-width="2.4"/><circle class="prog" id="prog" cx="50" cy="50" r="${R}" fill="none" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${(C * (1 - t.progress())).toFixed(2)}"/></svg>
            <div class="ring-center"><div class="timer-time num" id="time" role="timer" aria-live="off">${t.fmt(t.left())}</div><div class="what">${t.MODES[t.mode()]} · ${Math.round(t.lengthOf(t.mode()) / 60)} min</div></div>
          </div>
          <div class="focus-btns">
            <button type="button" class="btn primary" data-k="toggle" data-t="toggle">${O.icon(running ? 'pause' : 'play', 15)}${running ? 'Pause' : idle ? 'Start' : 'Resume'}</button>
            ${!idle ? `<button type="button" class="btn" data-k="finish" data-t="finish">${O.icon('skip', 15)}${t.mode() === 'focus' ? 'Finish now' : 'Skip break'}</button><button type="button" class="btn ghost icon" data-k="reset" data-t="reset" aria-label="Reset the timer">${O.icon('reset', 16)}</button>` : ''}
          </div>
          <div class="field focus-task"><label for="ftask">Working on</label>
            <select id="ftask" class="input"><option value="">Nothing in particular</option>${open.map((x) => `<option value="${x.id}" ${x.id === ts.taskId ? 'selected' : ''}>${esc(x.title)}${x.due && x.due !== U.today() ? ' · ' + esc(U.relDay(x.due)) : ''}</option>`).join('')}</select>
          </div>
          <div class="cycle-dots" aria-label="${inSet} of ${every} focus sessions before a long break">${Array.from({ length: every }, (_, i) => `<i class="${i < inSet ? 'on' : ''}"></i>`).join('')}<span style="margin-left:6px">${every - inSet} until a ${s.longMin} min break</span></div>`);
      }
      function sessions() {
        const list = D.sessionsOn(U.today()).slice().reverse();
        $('scount').textContent = list.length;
        $('stotal').textContent = list.length ? U.dur(D.focusOn(U.today())) : '';
        $('sessions').innerHTML = list.length ? list.slice(0, 6).map((s) => `<div class="sess"><span class="when">${U.timeOf(s.start)}–${U.timeOf(s.end)}</span><span class="what">${s.taskId && D.task(s.taskId) ? esc(D.task(s.taskId).title) : '<span class="muted">No task</span>'}</span><span class="n">${s.minutes} min</span></div>`).join('') + (list.length > 6 ? `<div class="sess"><span></span><span class="muted">${list.length - 6} earlier</span><span></span></div>` : '')
          : `<div class="empty">Finished sessions are logged here with their task.</div>`;
      }
      function bars() {
        const days = U.lastDays(14), vals = days.map((k) => D.focusOn(k));
        const box = document.createElement('div'); $('bars').innerHTML = ''; $('bars').appendChild(box);
        Charts.bars(box, { labels: days.map((k) => U.parseKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), values: vals, highlight: 13, height: 168, format: (v) => `${v} min`, tickFormat: Charts.fmt.int });
        const prev = vals.slice(0, 7).reduce((a, b) => a + b, 0), last = vals.slice(7).reduce((a, b) => a + b, 0);
        const bestI = vals.indexOf(Math.max(...vals));
        $('bfind').innerHTML = last || prev ? `Last 7 days: <b>${U.dur(last)}</b>, ${last === prev ? 'the same as' : U.dur(Math.abs(last - prev)) + (last > prev ? ' more than' : ' less than')} the 7 days before. Best day: ${esc(U.relDayInline(days[bestI]))}, ${vals[bestI]} min.` : 'Today’s bar is the one in colour.';
      }
      function sounds() {
        const s = O.store.state.settings, on = O.ambient.playing();
        $('sndmeta').textContent = on ? `playing: ${O.ambient.KINDS[on]}` : s.ambientAuto && s.ambient !== 'off' ? 'starts with each focus session' : '';
        O.fill($('snd'), `
          <div class="sound-grid" role="group" aria-label="Sound">${[['off', 'Off'], ...Object.entries(O.ambient.KINDS)].map(([k, v]) => `<button type="button" class="sound-btn" data-snd="${k}" data-k="snd-${k}" aria-pressed="${k === 'off' ? !on && s.ambient === 'off' : on === k || (!on && s.ambient === k)}">${k === 'off' ? '' : `<span class="eq ${on === k ? 'live' : ''}"><i></i><i></i><i></i></span>`}${v}</button>`).join('')}</div>
          <div class="sound-row">
            <label class="vol">${O.icon('sound', 16)}<span class="visually-hidden">Volume</span><input type="range" min="0" max="1" step="0.05" value="${s.ambientVol}" id="vol" aria-label="Volume"></label>
            <label class="switch-row" style="align-items:center;gap:10px"><span><b>Play with the timer</b></span><input type="checkbox" class="switch" id="sauto" ${s.ambientAuto ? 'checked' : ''}></label>
          </div>`);
      }
      const all = () => { sub(); main(); sessions(); bars(); sounds(); };
      all();

      root.addEventListener('click', (e) => {
        const ln = e.target.closest('[data-len]');
        if (ln) { O.store.update((st) => { st.settings.focusMin = +ln.dataset.len; st.timer.left = null; }); t.emit(); return; }
        const m = e.target.closest('[data-mode]');
        if (m) { if (m.dataset.mode !== t.mode()) t.setMode(m.dataset.mode); return; }
        const b = e.target.closest('[data-t]');
        if (!b) return;
        if (b.dataset.t === 'toggle') t.toggle();
        if (b.dataset.t === 'finish') t.finishEarly();
        if (b.dataset.t === 'reset') t.reset();
      });
      root.addEventListener('change', (e) => {
        if (e.target.id === 'ftask') t.setTask(e.target.value);
        if (e.target.id === 'sauto') O.store.update((s) => { s.settings.ambientAuto = e.target.checked; });
      });
      root.addEventListener('input', (e) => { if (e.target.id === 'vol') { O.store.update((s) => { s.settings.ambientVol = +e.target.value; }, { silent: true }); O.ambient.volume(); } });
      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-snd]'); if (!b) return;
        const k = b.dataset.snd;
        O.store.update((s) => { s.settings.ambient = k; }, { silent: true });
        if (k === 'off') O.ambient.stop(); else O.ambient.play(k);
        sounds();
      });
      const offSnd = O.ambient.on(() => sounds());
      const onKey = (e) => {
        if (e.code !== 'Space' || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(document.activeElement.tagName) || document.querySelector('dialog[open]')) return;
        e.preventDefault(); t.toggle();
      };
      document.addEventListener('keydown', onKey);
      let last = t.status() + t.mode();
      const off = t.on((left) => {
        const s = t.status() + t.mode();
        if (s !== last) { last = s; main(); return; }
        const el = $('time'); if (el) el.textContent = t.fmt(left);
        const p = $('prog'); if (p) p.setAttribute('stroke-dashoffset', (C * (1 - t.progress())).toFixed(2));
      });
      return { refresh: all, tick: sub, destroy() { off(); offSnd(); document.removeEventListener('keydown', onKey); } };
    },
  };
})();
