/* Orbit — core: utilities, the store, domain logic and icons.
   Everything lives on one global, O, so the app runs from plain <script> tags with no build step. */
(function () {
  'use strict';
  const O = (window.O = window.O || {});
  O.views = O.views || {};

  /* ------------------------------------------------------------------ utils */
  const pad = (n) => String(n).padStart(2, '0');
  const MINUS = '−';
  const U = (O.u = {});
  U.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  U.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  U.key = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  U.today = () => U.key();
  U.addDays = (k, n) => { const d = U.parseKey(k); d.setDate(d.getDate() + n); return U.key(d); };
  U.diffDays = (a, b) => Math.round((U.parseKey(a) - U.parseKey(b)) / 86400000);
  U.dow = (k) => U.parseKey(k).getDay();
  U.days = (from, n) => Array.from({ length: n }, (_, i) => U.addDays(from, i));
  U.lastDays = (n, end = U.today()) => U.days(U.addDays(end, -(n - 1)), n);
  U.mins = (t) => { if (t == null || t === '') return null; const [h, m] = String(t).split(':').map(Number); return h * 60 + (m || 0); };
  U.hm = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60))}`;
  U.nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  U.timeOf = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  U.keyOf = (ts) => U.key(new Date(ts));
  U.minsOfTs = (ts) => { const d = new Date(ts); return d.getHours() * 60 + d.getMinutes(); };
  U.dur = (m) => { m = Math.round(m); if (m < 60) return `${m} m`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} m` : `${h} h`; };
  /* duration as value + grey unit suffixes, for figures */
  U.durHtml = (m) => { m = Math.round(m); if (m < 60) return `${m}<small> m</small>`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h}<small> h </small>${r}<small> m</small>` : `${h}<small> h</small>`; };
  U.plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  U.greeting = (h = new Date().getHours()) => (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
  U.signed = (v, f = (x) => String(x)) => (v > 0 ? '+' : v < 0 ? MINUS : '') + f(Math.abs(v));
  U.fmtDate = (k, o = { weekday: 'long', day: 'numeric', month: 'long' }) => U.parseKey(k).toLocaleDateString(undefined, o);
  U.short = (k) => {
    const d = U.parseKey(k), sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  U.relDay = (k) => {
    const t = U.today(), n = U.diffDays(k, t);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1 && n < 7) return U.parseKey(k).toLocaleDateString(undefined, { weekday: 'long' });
    return U.short(k);
  };
  /* for use mid-sentence: "today", "tomorrow", "Monday", "12 Nov" */
  U.relDayInline = (k) => { const r = U.relDay(k); return /^(Today|Tomorrow|Yesterday)$/.test(r) ? r.toLowerCase() : r; };
  U.debounce = (fn, ms = 300) => {
    let t, pending = false;
    const d = (...a) => { pending = true; clearTimeout(t); t = setTimeout(() => { pending = false; fn(...a); }, ms); };
    d.flush = (...a) => { if (!pending) return; pending = false; clearTimeout(t); fn(...a); };
    return d;
  };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.weekdayShort = (i) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
  U.weekdayLong = (i) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i];
  U.isPhone = () => matchMedia('(max-width: 860px)').matches;
  /* a sentence-safe list: "Water", "Water and Read", "Water, Read and Gym" */
  U.andList = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs.at(-1));

  /* --------------------------------------------------------------- the store */
  const KEY = 'orbit.v1';
  const defaults = () => ({
    version: 1,
    createdAt: Date.now(),
    profile: { name: '' },
    settings: {
      theme: 'system',
      focusMin: 25, shortMin: 5, longMin: 15, longEvery: 4,
      autoBreak: true, autoFocus: false, sound: true, notify: false, reminders: true,
      dayStart: 6, dayEnd: 24, weekStart: 1,
      accent: 'teal', headings: 'serif', motion: 'full', celebrate: true, dailyXp: 120,
      ambient: 'off', ambientVol: 0.5, ambientAuto: true,
      location: null, currency: null,
      newCards: 20, todayHidden: [], todayOrder: null,
    },
    lists: [
      { id: 'personal', name: 'Personal' },
      { id: 'work', name: 'Work' },
      { id: 'study', name: 'Study' },
    ],
    tasks: [],
    habits: [],
    checkins: {},
    sessions: [],
    blocks: [],
    notes: [],
    journal: {},
    goals: [],
    money: { tx: [], budgets: {}, subs: [] },
    countdowns: [],
    achievements: {},
    decks: [],
    cards: [],
    reviews: [],
    wrapups: {},
    weekly: {},
    timer: { mode: 'focus', status: 'idle', endsAt: null, left: null, startedAt: null, cycle: 0, taskId: null },
    seen: { onboarding: false },
  });
  const merge = (base, over) => {
    if (!over || typeof over !== 'object' || Array.isArray(over)) return over === undefined ? base : over;
    const out = Array.isArray(base) ? [] : { ...base };
    for (const k of Object.keys(over)) out[k] = base && typeof base[k] === 'object' && !Array.isArray(base[k]) && base[k] !== null ? merge(base[k], over[k]) : over[k];
    return out;
  };
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return merge(defaults(), JSON.parse(raw));
    } catch (e) { console.warn('Orbit: could not read saved data', e); }
    return defaults();
  }
  const listeners = new Set();
  let state = load();
  let ver = 0; /* bumps on every change, so derived figures (XP, achievements) can be cached */
  let saveFailed = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); saveFailed = false; }
    catch (e) {
      if (!saveFailed && O.toast) O.toast('Could not save. Your browser storage may be full or blocked.');
      saveFailed = true;
    }
  }
  const emit = () => listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  O.store = {
    KEY,
    get state() { return state; },
    get ver() { return ver; },
    update(fn, { silent = false } = {}) { fn(state); ver++; save(); if (!silent) emit(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    replace(next) { state = merge(defaults(), next); ver++; save(); emit(); },
    reset() { state = defaults(); state.seen.onboarding = true; ver++; save(); emit(); },
    emit,
    defaults,
  };
  /* another tab changed the data: take it and redraw */
  window.addEventListener('storage', (e) => { if (e.key === KEY && e.newValue) { try { state = merge(defaults(), JSON.parse(e.newValue)); ver++; emit(); } catch (_) {} } });

  /* ------------------------------------------------------------------ domain */
  const D = (O.d = {});
  const S = () => state;

  /* lists */
  D.list = (id) => S().lists.find((l) => l.id === id);
  D.listName = (id) => (D.list(id) || {}).name || '';
  D.ensureList = (name) => {
    const n = name.trim();
    if (!n) return null;
    const found = S().lists.find((l) => l.name.toLowerCase() === n.toLowerCase() || l.id === n.toLowerCase());
    if (found) return found.id;
    const id = n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || U.uid();
    S().lists.push({ id, name: n[0].toUpperCase() + n.slice(1) });
    return id;
  };

  /* tasks */
  D.PRIORITY = ['None', 'Low', 'Medium', 'High'];
  D.REPEAT = { '': 'Does not repeat', daily: 'Every day', weekdays: 'Every weekday', weekly: 'Every week', monthly: 'Every month' };
  D.task = (id) => S().tasks.find((t) => t.id === id);
  D.isOverdue = (t, today = U.today()) => !t.done && !!t.due && t.due < today;
  D.sortTasks = (a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due || '9999', bd = b.due || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    const at = a.time ? U.mins(a.time) : 9999, bt = b.time ? U.mins(b.time) : 9999;
    if (at !== bt) return at - bt;
    if ((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
    return (a.createdAt || 0) - (b.createdAt || 0);
  };
  D.openToday = (today = U.today()) => S().tasks.filter((t) => !t.done && t.due && t.due <= today).sort(D.sortTasks);
  D.doneOn = (k) => S().tasks.filter((t) => t.done && t.doneAt && U.keyOf(t.doneAt) === k);
  D.addTask = (fields) => {
    const t = { id: U.uid(), title: '', notes: '', list: 'personal', due: null, time: null, priority: 0, repeat: '', subtasks: [], done: false, doneAt: null, createdAt: Date.now(), ...fields };
    S().tasks.push(t);
    return t;
  };
  D.nextDue = (due, repeat) => {
    const base = due || U.today();
    if (repeat === 'daily') return U.addDays(base, 1);
    if (repeat === 'weekly') return U.addDays(base, 7);
    if (repeat === 'weekdays') { let k = U.addDays(base, 1); while ([0, 6].includes(U.dow(k))) k = U.addDays(k, 1); return k; }
    if (repeat === 'monthly') { const d = U.parseKey(base), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return U.key(d); }
    return null;
  };
  /* completing a repeating task closes this one and opens the next */
  D.setDone = (id, done) => {
    const t = D.task(id); if (!t) return null;
    let spawned = null;
    t.done = done; t.doneAt = done ? Date.now() : null;
    if (done && t.repeat) {
      if (t.spawnedId && D.task(t.spawnedId)) return null;
      spawned = D.addTask({ ...t, id: U.uid(), done: false, doneAt: null, due: D.nextDue(t.due, t.repeat), createdAt: Date.now(), subtasks: (t.subtasks || []).map((s) => ({ ...s, id: U.uid(), done: false })), spawnedId: null, sample: t.sample });
      t.spawnedId = spawned.id;
    }
    if (!done && t.spawnedId) { const s = D.task(t.spawnedId); if (s && !s.done) S().tasks = S().tasks.filter((x) => x.id !== s.id); t.spawnedId = null; }
    return spawned;
  };

  /* habits: a day counts when its check-ins reach the target */
  D.habit = (id) => S().habits.find((h) => h.id === id);
  D.activeHabits = () => S().habits.filter((h) => !h.archived);
  D.isScheduled = (h, k) => !h.days || h.days.length === 0 || h.days.length === 7 || h.days.includes(U.dow(k));
  D.countOn = (h, k) => ((S().checkins[h.id] || {})[k] || 0);
  D.hDone = (h, k) => D.countOn(h, k) >= (h.target || 1);
  D.habitStart = (h) => U.keyOf(h.createdAt || Date.now());
  D.setCount = (h, k, n) => {
    const c = (S().checkins[h.id] = S().checkins[h.id] || {});
    n = U.clamp(n, 0, Math.max(h.target || 1, 99));
    if (n) c[k] = n; else delete c[k];
  };
  D.toggleHabit = (h, k) => { const t = h.target || 1; D.setCount(h, k, D.countOn(h, k) >= t ? 0 : t); };
  /* the current run of scheduled days that were done; today still open does not break it */
  D.streak = (h, today = U.today()) => {
    let k = today, n = 0, guard = 0;
    if (D.isScheduled(h, k) && !D.hDone(h, k)) k = U.addDays(k, -1);
    const start = D.habitStart(h);
    while (guard++ < 3660) {
      if (k < start && !D.hDone(h, k)) break;
      if (D.isScheduled(h, k)) { if (D.hDone(h, k)) n++; else break; }
      k = U.addDays(k, -1);
    }
    return n;
  };
  D.bestStreak = (h, today = U.today()) => {
    const keys = Object.keys(S().checkins[h.id] || {}).sort();
    let k = keys[0] && keys[0] < D.habitStart(h) ? keys[0] : D.habitStart(h);
    let best = 0, run = 0, guard = 0;
    while (k <= today && guard++ < 3660) {
      if (D.isScheduled(h, k)) {
        if (D.hDone(h, k)) { run++; best = Math.max(best, run); } else if (k !== today) run = 0;
      }
      k = U.addDays(k, 1);
    }
    return best;
  };
  /* share of scheduled days done in the window, from the habit's start; today counts only once it is done */
  D.rate = (h, n = 30, today = U.today()) => {
    let due = 0, done = 0; const start = D.habitStart(h);
    for (const k of U.lastDays(n, today)) {
      if (k < start || !D.isScheduled(h, k)) continue;
      if (k === today && !D.hDone(h, k)) continue;
      due++; if (D.hDone(h, k)) done++;
    }
    return due ? done / due : null;
  };
  D.scheduleText = (h) => {
    const days = h.days && h.days.length && h.days.length < 7 ? h.days : null;
    let s = days ? (days.join() === '1,2,3,4,5' ? 'Weekdays' : days.join() === '0,6' ? 'Weekends' : days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(U.weekdayShort).join(', ')) : 'Every day';
    if ((h.target || 1) > 1) s += ` · ${h.target} ${h.unit || 'times'} a day`;
    return s;
  };

  /* focus */
  D.sessionsOn = (k) => S().sessions.filter((s) => U.keyOf(s.start) === k).sort((a, b) => a.start - b.start);
  D.focusOn = (k) => D.sessionsOn(k).reduce((a, s) => a + s.minutes, 0);

  /* planner */
  /* a block is one day's, or repeats each week on its days (a class timetable) from its date on */
  D.blockOn = (b, k) => (b.days && b.days.length ? k >= b.date && b.days.includes(U.dow(k)) && !(b.skip || []).includes(k) && (!b.until || k <= b.until) : b.date === k);
  D.blocksOn = (k) => S().blocks.filter((b) => D.blockOn(b, k)).sort((a, b) => a.start - b.start);
  D.KINDS = { work: 'Work', study: 'Study', personal: 'Personal', health: 'Health' };

  /* journal */
  D.MOODS = ['', 'Rough', 'Low', 'Okay', 'Good', 'Great'];

  /* today's one fact, for the line under the greeting */
  D.todayFact = () => {
    const today = U.today(), now = U.nowMins();
    const open = D.openToday(today);
    const overdue = open.filter((t) => t.due < today);
    if (overdue.length) {
      const oldest = overdue.reduce((a, t) => (t.due < a ? t.due : a), today);
      return `${U.plural(overdue.length, 'task is', 'tasks are')} overdue, the oldest from ${U.relDay(oldest).replace('Yesterday', 'yesterday')}.`;
    }
    const next = open.find((t) => t.time && U.mins(t.time) >= now);
    if (next) return `${U.plural(open.length, 'task')} left today; next at ${next.time} is “${next.title}”.`;
    const risk = D.activeHabits().filter((h) => D.isScheduled(h, today) && !D.hDone(h, today)).map((h) => ({ h, s: D.streak(h) })).filter((x) => x.s >= 3).sort((a, b) => b.s - a.s)[0];
    if (open.length) return `${U.plural(open.length, 'task')} left today${risk ? `, and ${risk.h.name} is on a ${risk.s}-day streak` : ''}.`;
    if (risk) return `${risk.h.name} is on a ${risk.s}-day streak and still open today.`;
    const habitsLeft = D.activeHabits().filter((h) => D.isScheduled(h, today) && !D.hDone(h, today));
    if (S().tasks.length || S().habits.length) {
      if (!habitsLeft.length) return 'Everything for today is done.';
      return `No tasks left today; ${U.andList(habitsLeft.map((h) => h.name))} still to check off.`;
    }
    return 'Nothing planned yet. Add your first task below.';
  };

  /* ------------------------------------------- quick add: words become fields */
  const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  D.parseQuick = (input) => {
    let s = ' ' + input + ' ';
    const out = { title: '', due: null, time: null, priority: 0, list: null, listName: null, repeat: '' };
    const take = (re, fn) => { s = s.replace(re, (...m) => { const r = fn(...m); return r === false ? m[0] : ' '; }); };
    const today = U.today();
    // repeat
    take(/\s(every ?day|daily)(?=\s)/i, () => { out.repeat = 'daily'; });
    take(/\s(every ?weekday|weekdays)(?=\s)/i, () => { out.repeat = 'weekdays'; });
    take(/\s(every ?week|weekly)(?=\s)/i, () => { out.repeat = 'weekly'; });
    take(/\s(every ?month|monthly)(?=\s)/i, () => { out.repeat = 'monthly'; });
    // priority
    take(/\s(!!!|!1|!high|p1)(?=\s)/i, () => { out.priority = 3; });
    take(/\s(!!|!2|!med(ium)?|p2)(?=\s)/i, () => { out.priority = 2; });
    take(/\s(!3|!low|p3)(?=\s)/i, () => { out.priority = 1; });
    // list
    take(/\s#([\p{L}\p{N}_-]+)(?=\s)/u, (_, name) => { out.listName = name; });
    // time
    take(/\s(?:at\s)?(\d{1,2})(?::(\d{2}))?\s?(am|pm)(?=\s)/i, (_, h, m, ap) => { h = +h % 12 + (ap.toLowerCase() === 'pm' ? 12 : 0); if (h > 23) return false; out.time = `${pad(h)}:${pad(+(m || 0))}`; });
    take(/\s(?:at\s)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/, (_, h, m) => { out.time = `${pad(+h)}:${m}`; });
    take(/\s(noon|midday)(?=\s)/i, () => { out.time = '12:00'; });
    // "at 8": a bare hour after "at"; 1 to 7 mean the afternoon, 8 to 11 the next time that hour comes round
    take(/\sat (\d{1,2})(?=\s)/i, (_, h) => { h = +h; if (h < 1 || h > 12) return false; const hh = h === 12 ? 12 : h <= 7 ? h + 12 : U.nowMins() < h * 60 ? h : h + 12; out.time = `${pad(hh)}:00`; });
    // dates ("tom" is left alone: it is more often a name than tomorrow)
    take(/\s(today|tod|tonight)(?=\s)/i, (_, w) => { out.due = today; if (w.toLowerCase() === 'tonight' && !out.time) out.time = '20:00'; });
    take(/\s(tomorrow|tmr|tmrw)(?=\s)/i, () => { out.due = U.addDays(today, 1); });
    take(/\snext week(?=\s)/i, () => { let k = U.addDays(today, 1); while (U.dow(k) !== 1) k = U.addDays(k, 1); out.due = k; });
    take(/\sin (\d{1,3}) ?(days?|d|weeks?|w)(?=\s)/i, (_, n, u) => { out.due = U.addDays(today, +n * (/^w/i.test(u) ? 7 : 1)); });
    take(/\s(\d{4})-(\d{2})-(\d{2})(?=\s)/, (_, y, m, d) => { out.due = `${y}-${m}-${d}`; });
    take(/\s(\d{1,2}) ([a-z]{3})[a-z]*(?=\s)/i, (_, d, mon) => { const mi = MONTHS.indexOf(mon.toLowerCase()); if (mi < 0) return false; out.due = futureDate(mi, +d); });
    take(/\s([a-z]{3})[a-z]* (\d{1,2})(?=\s)/i, (_, mon, d) => { const mi = MONTHS.indexOf(mon.toLowerCase()); if (mi < 0) return false; out.due = futureDate(mi, +d); });
    // "on the 1st", "15th of the month": the next time that day of the month comes round
    take(/\s(?:on\s)?(?:the\s)?(\d{1,2})(?:st|nd|rd|th)(?:\s+of\s+(?:the\s+|every\s+)?month)?(?=\s)/i, (_, d) => {
      d = +d; if (d < 1 || d > 31) return false;
      const dt = U.parseKey(today); if (dt.getDate() > d) { dt.setDate(1); dt.setMonth(dt.getMonth() + 1); }
      dt.setDate(Math.min(d, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate())); out.due = U.key(dt);
    });
    // weekdays: a full name anywhere; a short one ("fri") only after on/next/this/by, or as the last word,
    // so "sun cream" and "sat exam" stay text. "every monday" also repeats weekly
    const setWd = (w) => { const i = WD.indexOf(w.slice(0, 3).toLowerCase()); let k = today; for (let j = 0; j < 7; j++) { if (U.dow(k) === i) break; k = U.addDays(k, 1); } out.due = k; };
    take(/\s(?:(on|next|this|by|every)\s)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?(?=\s)/i, (_, pre, w) => { setWd(w); if (pre && pre.toLowerCase() === 'every') out.repeat = 'weekly'; });
    take(/\s(?:on|next|this|by)\s(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?=\s)/i, (_, w) => setWd(w));
    take(/\s(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\s*$/i, (_, w) => setWd(w));
    if (out.repeat && !out.due) { out.due = today; if (out.repeat === 'weekdays') while ([0, 6].includes(U.dow(out.due))) out.due = U.addDays(out.due, 1); }
    if (out.time && !out.due) out.due = U.mins(out.time) > U.nowMins() ? today : U.addDays(today, 1);
    // "Pay rent on 1 dec" leaves "Pay rent on": drop the word that only pointed at the date
    out.title = s.replace(/\s+/g, ' ').trim().replace(/\s+(on|at|by|due|for|this|next)$/i, '');
    return out;
  };
  function futureDate(mi, d) {
    const now = new Date(); let y = now.getFullYear();
    const k = (yy) => `${yy}-${pad(mi + 1)}-${pad(d)}`;
    if (k(y) < U.today()) y++;
    return k(y);
  }
  /* the chips under the quick-add field, so the parse is seen before Enter */
  D.quickChips = (p) => {
    const c = [];
    if (p.due) c.push(U.relDay(p.due) + (p.time ? ' ' + p.time : ''));
    else if (p.time) c.push(p.time);
    if (p.repeat) c.push(D.REPEAT[p.repeat]);
    if (p.priority) c.push(D.PRIORITY[p.priority] + ' priority');
    if (p.listName) c.push('#' + p.listName);
    return c;
  };

  /* -------------------------------------------------------------- icons (svg) */
  const P = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    tasks: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    habits: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
    focus: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9.5 2h5M12 2v3"/>',
    planner: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    notes: '<path d="M14.5 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7.5z"/><path d="M14.5 2.5v5h5M8.5 13h7M8.5 17h5"/>',
    journal: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5A2.5 2.5 0 0 1 6.5 19H20v3H6.5"/>',
    stats: '<path d="M4 20V10M10 20V4M16 20v-7M21 20H3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 12.5a2 2 0 0 0 2 1.5h7a2 2 0 0 0 2-1.5l1-12.5M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7"/>',
    pin: '<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3zM12 14v7"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    pause: '<path d="M8 4.5v15M16 4.5v15"/>',
    skip: '<path d="M5 4.5v15l10-7.5zM19 5v14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11V10a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    edit: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h1M10.5 10h1M14.5 10h1M8 14h8"/>',
    archive: '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/>',
    install: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M12 7v7M9 11l3 3 3-3M10 18.5h4"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    study: '<rect x="3" y="6" width="14" height="14" rx="2.5"/><path d="M7 3h11.5A2.5 2.5 0 0 1 21 5.5V17"/><path d="M7 11h6M7 15h4"/>',
    review: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/>',
    starf: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>',
    layout: '<rect x="3" y="3" width="18" height="6" rx="2"/><rect x="3" y="12" width="8" height="9" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
    goals: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    money: '<rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10h19M16.5 14.5h1.5"/><path d="M5 6V4.5h12.5V6"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 13.5h2M11 13.5h2M14.5 13.5h2M7.5 17h2M11 17h2"/>',
    progress: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5M17 6h2.5v1.5a3 3 0 0 1-3 3"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5M17 6h2.5v1.5a3 3 0 0 1-3 3"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    flame: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.6 3-5.4 3.6-9 2.4 1.2 3.4 3.4 3.4 5 1.1-.6 1.8-1.8 1.9-3 2.4 1.9 4.1 4.3 4.1 7 0 3.4-2.6 6-6.5 6z"/>',
    sunrise: '<path d="M4 18h16M7 14.5a5 5 0 0 1 10 0M12 4v4M9.5 6.5 12 4l2.5 2.5M4.2 11l1.4 1M19.8 11l-1.4 1M3 21h18"/>',
    sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    board: '<rect x="3" y="4" width="5" height="16" rx="1.5"/><rect x="9.5" y="4" width="5" height="11" rx="1.5"/><rect x="16" y="4" width="5" height="7" rx="1.5"/>',
    hourglass: '<path d="M6.5 3h11M6.5 21h11M7.5 3c0 5 9 5 9 9s-9 4-9 9M16.5 3c0 5-9 5-9 9s9 4 9 9"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1.2-1.6-1.2-2.8 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4c0-4.4-4-7.9-9-7.9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10.5" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    pin2: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    w_clear: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    w_partly: '<path d="M8.5 6.2A4 4 0 0 1 15.3 8"/><path d="M8 3v1.2M3.6 7.6h1.2M4.9 4.5l.9.9"/><path d="M7 19.5h10a3.5 3.5 0 0 0 .4-7A5 5 0 0 0 8 13a3.3 3.3 0 0 0-1 6.5z"/>',
    w_cloud: '<path d="M7 19h10.5a4 4 0 0 0 .5-8A6 6 0 0 0 6.6 12.6 3.3 3.3 0 0 0 7 19z"/>',
    w_rain: '<path d="M7 15.5h10.5a3.8 3.8 0 0 0 .5-7.5A6 6 0 0 0 6.6 9.3 3.2 3.2 0 0 0 7 15.5z"/><path d="M8.5 18.5l-1 2M12.5 18.5l-1 2M16.5 18.5l-1 2"/>',
    w_snow: '<path d="M7 15h10.5a3.8 3.8 0 0 0 .5-7.5A6 6 0 0 0 6.6 8.8 3.2 3.2 0 0 0 7 15z"/><path d="M8 19h.01M12 18.5h.01M16 19h.01M10 21.5h.01M14 21.5h.01"/>',
    w_storm: '<path d="M7 14.5h10.5a3.8 3.8 0 0 0 .5-7.5A6 6 0 0 0 6.6 8.3 3.2 3.2 0 0 0 7 14.5z"/><path d="m12.5 15.5-2 3.5h3l-2 3"/>',
    w_fog: '<path d="M4 9h16M3 13h18M5 17h14M8 21h8"/>',
  };
  O.icon = (name, size = 16, cls = '') => `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  /* the product's mark: one planet on its orbit */
  O.mark = (size = 22) => `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18.2" cy="6.6" r="3.1" fill="currentColor" stroke="var(--chrome)" stroke-width="1.6"/></svg>`;
})();
