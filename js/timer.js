/* Orbit — the focus timer. It keeps an end time rather than counting ticks, so it stays right when the tab sleeps,
   and it survives reloads: a session that finished while Orbit was closed is still logged. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const st = () => O.store.state.timer;
  const cfg = () => O.store.state.settings;
  const MODES = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  const lengthOf = (mode) => 60 * (mode === 'focus' ? cfg().focusMin : mode === 'short' ? cfg().shortMin : cfg().longMin);
  const listeners = new Set();

  function left() {
    const t = st();
    if (t.status === 'running') return Math.max(0, Math.round((t.endsAt - Date.now()) / 1000));
    return t.left == null ? lengthOf(t.mode) : t.left;
  }
  const save = (fn, silent = true) => O.store.update((s) => fn(s.timer), { silent });

  /* --------------------------------------------------------------- sound */
  let ctx;
  O.sound = (kind = 'chime') => {
    if (!cfg().sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      const notes = kind === 'tick' ? [[880, 0, 0.07]] : kind === 'break' ? [[660, 0, 0.35], [523, 0.22, 0.5]] : [[523, 0, 0.35], [659, 0.18, 0.35], [784, 0.36, 0.7]];
      const t0 = ctx.currentTime + 0.02;
      for (const [f, at, dur] of notes) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(kind === 'tick' ? 0.06 : 0.18, t0 + at + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g).connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
      }
    } catch (_) {}
  };

  O.notify = async (title, body) => {
    if (!cfg().notify || !('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'orbit' });
      else new Notification(title, { body, icon: 'icons/icon-192.png' });
    } catch (_) {}
  };

  /* ------------------------------------------------------------ actions */
  function start() {
    const secs = left();
    save((t) => { t.status = 'running'; t.endsAt = Date.now() + secs * 1000; t.startedAt = t.startedAt || Date.now(); t.left = null; }, false);
    O.sound('tick');
    emit();
  }
  function pause() {
    const secs = left();
    save((t) => { t.status = 'paused'; t.left = secs; t.endsAt = null; }, false);
    emit();
  }
  function toggle() { st().status === 'running' ? pause() : start(); }
  function setMode(mode, keepRunning = false) {
    save((t) => { t.mode = mode; t.status = keepRunning ? 'running' : 'idle'; t.left = keepRunning ? null : lengthOf(mode); t.endsAt = keepRunning ? Date.now() + lengthOf(mode) * 1000 : null; t.startedAt = keepRunning ? Date.now() : null; }, false);
    emit();
  }
  function reset() { setMode(st().mode); }
  /* log what was focused so far (a minute or more), then move on */
  function finishEarly() {
    const t = st();
    if (t.mode === 'focus' && t.startedAt) {
      const done = lengthOf('focus') - left();
      if (done >= 60) logSession(Math.round(done / 60), Date.now());
    }
    complete({ early: true });
  }
  function logSession(minutes, end) {
    const t = st();
    O.store.update((s) => { s.sessions.push({ id: U.uid(), start: end - minutes * 60000, end, minutes, taskId: t.taskId || null }); });
  }
  function complete({ early = false, quiet = false, at = Date.now() } = {}) {
    const t = st();
    let next;
    if (t.mode === 'focus') {
      if (!early) logSession(Math.round(lengthOf('focus') / 60), at);
      const cycle = (t.cycle || 0) + 1;
      next = cycle % (cfg().longEvery || 4) === 0 ? 'long' : 'short';
      save((x) => { x.cycle = cycle; });
      if (!quiet) { O.sound('chime'); O.notify('Focus session done', `${early ? 'Ended early' : U.dur(lengthOf('focus') / 60) + ' logged'}. Time for a ${MODES[next].toLowerCase()}.`); O.toast(`Focus session done. ${MODES[next]} next.`); }
      setMode(next, !early && cfg().autoBreak && !quiet);
    } else {
      next = 'focus';
      if (!quiet) { O.sound('break'); O.notify('Break over', 'Ready for the next focus session?'); O.toast('Break over. Ready when you are.'); }
      setMode('focus', !early && cfg().autoFocus && !quiet);
    }
  }
  const setTask = (id) => { save((t) => { t.taskId = id || null; }, false); emit(); };

  /* --------------------------------------------------------------- tick */
  function emit() { const l = left(); listeners.forEach((fn) => fn(l, st())); title(l); }
  const baseTitle = 'Orbit';
  function title(l) {
    const t = st();
    document.title = t.status === 'running' ? `${fmt(l)} · ${MODES[t.mode]} · ${baseTitle}` : (O.viewTitle ? `${O.viewTitle} · ${baseTitle}` : baseTitle);
  }
  const fmt = (secs) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  let lastSec = -1;
  setInterval(() => {
    const t = st();
    if (t.status !== 'running') return;
    const l = left();
    if (l <= 0) { complete(); return; }
    if (l !== lastSec) { lastSec = l; emit(); }
  }, 250);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && st().status === 'running' && left() <= 0) complete(); });

  /* a session that ran out while Orbit was closed: log it once, without sound */
  O.timerBoot = () => {
    const t = st();
    if (t.status === 'running' && t.endsAt && t.endsAt <= Date.now()) complete({ quiet: true, at: t.endsAt });
  };

  O.timer = {
    MODES, start, pause, toggle, reset, setMode, finishEarly, setTask, fmt,
    left, lengthOf,
    status: () => st().status,
    mode: () => st().mode,
    state: st,
    progress: () => 1 - left() / lengthOf(st().mode),
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    emit,
  };
})();
