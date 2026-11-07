/* Orbit — goals, money, countdowns, XP and achievements.
   XP and achievements are worked out from what you actually did (tasks, habits, focus, journal, goals, money),
   never stored as a loose number, so undoing a task takes its XP back with it. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const S = () => O.store.state;

  /* ================================================================= GOALS */
  const G = (O.goals = {});
  G.get = (id) => S().goals.find((g) => g.id === id);
  G.active = () => S().goals.filter((g) => !g.done && !g.archived);
  G.tasks = (g) => S().tasks.filter((t) => t.goalId === g.id);
  G.habits = (g) => S().habits.filter((h) => h.goalId === g.id && !h.archived);
  /* progress counts milestones and linked tasks; each is one step */
  G.progress = (g) => {
    const ms = g.milestones || [], ts = G.tasks(g).filter((t) => !t.repeat || t.done);
    const total = ms.length + ts.length;
    const done = ms.filter((m) => m.done).length + ts.filter((t) => t.done).length;
    return { done, total, ratio: g.done ? 1 : total ? done / total : 0 };
  };
  G.add = (fields) => { const g = { id: U.uid(), title: '', why: '', due: null, milestones: [], done: false, doneAt: null, createdAt: Date.now(), ...fields }; S().goals.push(g); return g; };

  /* ================================================================= MONEY */
  const M = (O.money = {});
  M.CATS = {
    food: { name: 'Food', words: ['food', 'lunch', 'dinner', 'breakfast', 'snack', 'snacks', 'coffee', 'chai', 'tea', 'groceries', 'grocery', 'zomato', 'swiggy', 'restaurant', 'pizza', 'cafe', 'canteen', 'mess'] },
    transport: { name: 'Transport', words: ['uber', 'ola', 'rapido', 'auto', 'metro', 'bus', 'fuel', 'petrol', 'diesel', 'cab', 'taxi', 'train', 'travel', 'transport', 'parking', 'flight'] },
    shopping: { name: 'Shopping', words: ['shopping', 'amazon', 'flipkart', 'myntra', 'clothes', 'shoes', 'shirt', 'gift', 'gifts'] },
    bills: { name: 'Bills', words: ['bill', 'bills', 'rent', 'electricity', 'wifi', 'internet', 'recharge', 'phone', 'mobile', 'water'] },
    fun: { name: 'Fun', words: ['movie', 'movies', 'game', 'games', 'netflix', 'spotify', 'party', 'fun', 'outing', 'concert', 'trip'] },
    health: { name: 'Health', words: ['medicine', 'medicines', 'doctor', 'gym', 'health', 'pharmacy', 'chemist', 'dentist'] },
    study: { name: 'Study', words: ['book', 'books', 'course', 'college', 'fees', 'fee', 'stationery', 'study', 'notes', 'exam', 'printout', 'xerox'] },
    other: { name: 'Other', words: [] },
  };
  M.INCOME = ['salary', 'income', 'pocket', 'allowance', 'freelance', 'stipend', 'refund', 'cashback', 'got', 'received', 'bonus'];
  M.currency = () => {
    const c = S().settings.currency;
    if (c) return c;
    const region = (navigator.language || 'en-US').split('-')[1] || '';
    return { IN: 'INR', US: 'USD', GB: 'GBP', JP: 'JPY', CA: 'CAD', AU: 'AUD', SG: 'SGD', AE: 'AED', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', IE: 'EUR', PK: 'PKR', BD: 'BDT', NP: 'NPR', LK: 'LKR' }[region] || 'USD';
  };
  const whole = (cur) => ['INR', 'JPY', 'KRW', 'PKR', 'BDT', 'NPR', 'LKR'].includes(cur);
  /* every amount on screen goes through here: one currency, fixed decimals */
  M.fmt = (v, { sign = false } = {}) => {
    const cur = M.currency(), d = whole(cur) ? 0 : 2;
    const s = new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(Math.abs(v));
    return (sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : v < 0 ? '−' : '') + s;
  };
  M.symbol = () => new Intl.NumberFormat(undefined, { style: 'currency', currency: M.currency() }).formatToParts(0).find((p) => p.type === 'currency').value;
  M.monthKey = (k = U.today()) => k.slice(0, 7);
  M.inMonth = (mk) => S().money.tx.filter((t) => t.date.slice(0, 7) === mk);
  M.spent = (txs) => txs.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  M.earned = (txs) => txs.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  M.totalBudget = () => Object.values(S().money.budgets).reduce((a, b) => a + (+b || 0), 0);
  M.catName = (c) => (M.CATS[c] || { name: c === 'income' ? 'Income' : 'Other' }).name;
  /* "250 lunch with Aman", "+5000 stipend", "spent 1200 on books yesterday" */
  M.parse = (text) => {
    let s = ' ' + text.toLowerCase() + ' ';
    const out = { amount: null, type: 'expense', category: 'other', note: '', date: U.today() };
    // the amount: one with a currency sign or a "k" if there is one, otherwise the largest number ("2 coffees 120" is 120)
    const nums = [...s.matchAll(/(^|\s)([+-]?)\s*([₹$€£])?\s*(\d+(?:[.,]\d{1,2})?)\s*(k\b)?/gi)].map((x) => ({ raw: x[0], sign: x[2], cur: !!x[3] || !!x[5], v: parseFloat(x[4].replace(',', '.')) * (x[5] ? 1000 : 1) }));
    const pickN = nums.find((n) => n.cur) || nums.slice().sort((a, b) => b.v - a.v)[0];
    if (pickN) { out.amount = pickN.v; if (pickN.sign === '+') out.type = 'income'; s = s.replace(pickN.raw, ' '); }
    if (/\byesterday\b/.test(s)) { out.date = U.addDays(U.today(), -1); s = s.replace(/\byesterday\b/, ' '); }
    s = s.replace(/\b(spent|paid|for|on|at|rs\.?|inr|rupees?|bucks)\b/g, ' ');
    const words = s.split(/\s+/).filter(Boolean);
    if (words.some((w) => M.INCOME.some((x) => w.startsWith(x)))) out.type = 'income';
    if (out.type === 'income') out.category = 'income';
    else for (const [id, c] of Object.entries(M.CATS)) if (words.some((w) => { const one = w.replace(/(es|s)$/, ''); return w === id || c.words.includes(w) || c.words.includes(one) || c.words.includes(w.replace(/s$/, '')); })) { out.category = id; break; }
    // the note is what is left, with the words around the amount kept apart
    let note = ' ' + text + ' ';
    if (pickN) { const re = new RegExp('(^|\\s)[+-]?\\s*[₹$€£]?\\s*' + String(pickN.raw.match(/\d+(?:[.,]\d{1,2})?/)[0]).replace('.', '\\.') + '\\s*k?(?=\\s|$)', 'i'); note = note.replace(re, ' '); }
    note = note.replace(/\b(spent|paid|rs\.?|inr|rupees?|bucks|yesterday|got|received)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    out.note = note.replace(/^(on|for|at|from)\s+/i, '').replace(/\s+(on|for|at|from)$/i, '');
    return out;
  };
  M.addTx = (f) => { const t = { id: U.uid(), date: U.today(), amount: 0, type: 'expense', category: 'other', note: '', createdAt: Date.now(), ...f }; S().money.tx.push(t); return t; };
  M.subMonthly = (sub) => (sub.cycle === 'yearly' ? sub.amount / 12 : sub.cycle === 'weekly' ? (sub.amount * 52) / 12 : sub.amount);
  M.nextDate = (k, cycle) => (cycle === 'yearly' ? U.key(new Date(U.parseKey(k).setFullYear(U.parseKey(k).getFullYear() + 1))) : cycle === 'weekly' ? U.addDays(k, 7) : D.nextDue(k, 'monthly'));
  /* a renewal whose date has come is logged as spending, once, and moves to its next date */
  M.processSubs = () => {
    const today = U.today(), due = S().money.subs.filter((x) => x.autoLog !== false && x.next && x.next <= today);
    if (!due.length) return 0;
    let n = 0;
    O.store.update((s) => {
      for (const sub of due) {
        let guard = 0;
        while (sub.next <= today && guard++ < 24) { M.addTx({ date: sub.next, amount: sub.amount, type: 'expense', category: sub.category || 'bills', note: sub.name + ' (renewal)', subId: sub.id, sample: sub.sample }); sub.next = M.nextDate(sub.next, sub.cycle); n++; }
      }
    }, { silent: true });
    return n;
  };

  /* ============================================================ COUNTDOWNS */
  const C = (O.countdowns = {});
  C.upcoming = () => S().countdowns.filter((c) => c.date >= U.today()).sort((a, b) => (a.date < b.date ? -1 : 1));
  C.daysLeft = (c) => U.diffDays(c.date, U.today());
  C.label = (c) => { const n = C.daysLeft(c); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n < 0 ? `${-n} days ago` : `${n} days`; };

  /* =================================================================== XP */
  const X = (O.xp = {});
  X.RULES = { task: 10, taskHigh: 5, taskMed: 2, habit: 5, streak7: 25, streak30: 100, streak100: 300, focusMin: 1, journal: 5, milestone: 20, goal: 100, tx: 2, txDailyCap: 5, card: 1, cardDailyCap: 100, wrapup: 10, top3: 15 };
  X.TITLES = [[1, 'Starter'], [3, 'Steady'], [6, 'Focused'], [10, 'Driven'], [15, 'Unstoppable'], [20, 'Legend'], [30, 'Mythic']];
  let memoV = -1, memo = null;
  X.compute = () => {
    if (memoV === O.store.ver && memo) return memo;
    const s = S(), R = X.RULES, byDay = {}, bySource = { Tasks: 0, Habits: 0, Focus: 0, Study: 0, Journal: 0, Goals: 0, Money: 0, Reviews: 0 };
    const add = (k, n, src) => { if (!k || !n) return; byDay[k] = (byDay[k] || 0) + n; bySource[src] += n; };
    for (const t of s.tasks) if (t.done && t.doneAt) add(U.keyOf(t.doneAt), R.task + (t.priority === 3 ? R.taskHigh : t.priority === 2 ? R.taskMed : 0), 'Tasks');
    const today = U.today();
    for (const h of s.habits) {
      const c = s.checkins[h.id] || {}, keys = Object.keys(c).sort();
      if (!keys.length) continue;
      let k = keys[0] < D.habitStart(h) ? keys[0] : D.habitStart(h), run = 0, guard = 0;
      while (k <= today && guard++ < 4000) {
        if (D.hDone(h, k)) { add(k, R.habit, 'Habits'); if (D.isScheduled(h, k)) { run++; if (run === 7) add(k, R.streak7, 'Habits'); if (run === 30) add(k, R.streak30, 'Habits'); if (run === 100) add(k, R.streak100, 'Habits'); } }
        else if (D.isScheduled(h, k) && k !== today) run = 0;
        k = U.addDays(k, 1);
      }
    }
    for (const se of s.sessions) add(U.keyOf(se.start), se.minutes * R.focusMin, 'Focus');
    for (const [k, e] of Object.entries(s.journal)) if (e.mood || (e.text || '').trim()) add(k, R.journal, 'Journal');
    for (const g of s.goals) {
      for (const m of g.milestones || []) if (m.done && m.doneAt) add(U.keyOf(m.doneAt), R.milestone, 'Goals');
      if (g.done && g.doneAt) add(U.keyOf(g.doneAt), R.goal, 'Goals');
    }
    const txDay = {};
    for (const t of s.money.tx) { if (t.subId) continue; txDay[t.date] = (txDay[t.date] || 0) + 1; }
    for (const [k, n] of Object.entries(txDay)) add(k, Math.min(n, R.txDailyCap) * R.tx, 'Money');
    const cardDay = {};
    for (const r of s.reviews) { const k = U.keyOf(r.at); cardDay[k] = (cardDay[k] || 0) + 1; }
    for (const [k, n] of Object.entries(cardDay)) add(k, Math.min(n, R.cardDailyCap) * R.card, 'Study');
    for (const k of Object.keys(s.wrapups)) add(k, R.wrapup, 'Reviews');
    for (const k of X.top3Days()) add(k, R.top3, 'Tasks');
    const total = Object.values(byDay).reduce((a, b) => a + b, 0);
    memo = { total, byDay, bySource, ...X.level(total) };
    memoV = O.store.ver;
    return memo;
  };
  /* each level asks for 50 more XP than the last: 100, 150, 200 … */
  /* days on which every task marked top 3 for that day was finished that day */
  X.top3Days = () => {
    const by = {};
    for (const t of S().tasks) if (t.top) (by[t.top] = by[t.top] || []).push(t);
    return Object.entries(by).filter(([k, ts]) => ts.length >= 1 && ts.every((t) => t.done && t.doneAt && U.keyOf(t.doneAt) === k)).map(([k]) => k);
  };
  X.need = (L) => 100 + (L - 1) * 50;
  X.level = (total) => {
    let L = 1, left = total;
    while (left >= X.need(L)) { left -= X.need(L); L++; }
    const title = X.TITLES.filter(([n]) => L >= n).at(-1)[1];
    return { level: L, into: left, need: X.need(L), title };
  };
  X.today = () => X.compute().byDay[U.today()] || 0;

  /* ========================================================= ACHIEVEMENTS */
  const A = (O.achievements = {});
  function stats() {
    const s = S(), today = U.today();
    const done = s.tasks.filter((t) => t.done && t.doneAt);
    const hours = done.map((t) => new Date(t.doneAt).getHours());
    const perDaySessions = {}; s.sessions.forEach((x) => { const k = U.keyOf(x.start); perDaySessions[k] = (perDaySessions[k] || 0) + 1; });
    const perDayBlocks = {}; s.blocks.forEach((b) => { perDayBlocks[b.date] = (perDayBlocks[b.date] || 0) + 1; });
    const best = Math.max(0, ...s.habits.map((h) => D.bestStreak(h)));
    // a perfect day: every scheduled habit done, and three or more tasks finished
    const doneByDay = {}; done.forEach((t) => { const k = U.keyOf(t.doneAt); doneByDay[k] = (doneByDay[k] || 0) + 1; });
    let perfect = 0;
    for (const [k, n] of Object.entries(doneByDay)) {
      if (n < 3) continue;
      const hs = s.habits.filter((h) => !h.archived && k >= D.habitStart(h) && D.isScheduled(h, k));
      if (hs.length && hs.every((h) => D.hDone(h, k))) perfect++;
    }
    // a month that ended under the total budget
    const tb = M.totalBudget();
    let underMonths = 0;
    if (tb > 0) { const months = Array.from(new Set(s.money.tx.map((t) => t.date.slice(0, 7)))).filter((m) => m < today.slice(0, 7)); underMonths = months.filter((m) => M.spent(M.inMonth(m)) <= tb).length; }
    return {
      tasks: done.length, early: hours.filter((h) => h < 8).length, late: hours.filter((h) => h >= 23).length,
      streak: best, sessions: s.sessions.length, focusH: s.sessions.reduce((a, x) => a + x.minutes, 0) / 60,
      daySessions: Math.max(0, ...Object.values(perDaySessions)), dayBlocks: Math.max(0, ...Object.values(perDayBlocks)),
      journal: Object.values(s.journal).filter((e) => e.mood || (e.text || '').trim()).length,
      goals: s.goals.filter((g) => g.done).length, milestones: s.goals.reduce((a, g) => a + (g.milestones || []).filter((m) => m.done).length, 0),
      tx: s.money.tx.filter((t) => !t.subId).length, underMonths, perfect, notes: s.notes.length,
      countdowns: s.countdowns.length, level: X.compute().level,
      cards: s.reviews.length, wrapups: Object.keys(s.wrapups).length, top3: X.top3Days().length,
      studyStreak: (() => { const days = new Set(s.reviews.map((r) => U.keyOf(r.at))); let k = days.has(today) ? today : U.addDays(today, -1), n = 0; while (days.has(k)) { n++; k = U.addDays(k, -1); } return n; })(),
    };
  }
  A.LIST = [
    { id: 'first-task', name: 'First step', desc: 'Finish your first task', icon: 'check', key: 'tasks', target: 1 },
    { id: 'tasks-25', name: 'Getting it done', desc: 'Finish 25 tasks', icon: 'tasks', key: 'tasks', target: 25 },
    { id: 'tasks-100', name: 'Centurion', desc: 'Finish 100 tasks', icon: 'trophy', key: 'tasks', target: 100 },
    { id: 'tasks-500', name: 'Machine', desc: 'Finish 500 tasks', icon: 'star', key: 'tasks', target: 500 },
    { id: 'early', name: 'Early bird', desc: 'Finish 5 tasks before 08:00', icon: 'sunrise', key: 'early', target: 5 },
    { id: 'late', name: 'Night owl', desc: 'Finish 5 tasks after 23:00', icon: 'moon', key: 'late', target: 5 },
    { id: 'streak-7', name: 'On a roll', desc: 'Keep a habit going 7 days', icon: 'flame', key: 'streak', target: 7 },
    { id: 'streak-30', name: 'Iron will', desc: 'Keep a habit going 30 days', icon: 'flame', key: 'streak', target: 30 },
    { id: 'streak-100', name: 'Unbreakable', desc: 'Keep a habit going 100 days', icon: 'flame', key: 'streak', target: 100 },
    { id: 'focus-1', name: 'Deep diver', desc: 'Finish a focus session', icon: 'focus', key: 'sessions', target: 1 },
    { id: 'focus-day', name: 'Flow state', desc: '4 focus sessions in one day', icon: 'focus', key: 'daySessions', target: 4 },
    { id: 'focus-25h', name: 'Deep work', desc: 'Focus for 25 hours in all', icon: 'hourglass', key: 'focusH', target: 25 },
    { id: 'planner', name: 'Architect', desc: 'Plan 5 blocks in one day', icon: 'planner', key: 'dayBlocks', target: 5 },
    { id: 'journal-7', name: 'Dear diary', desc: 'Write 7 journal entries', icon: 'journal', key: 'journal', target: 7 },
    { id: 'journal-30', name: 'Know thyself', desc: 'Write 30 journal entries', icon: 'journal', key: 'journal', target: 30 },
    { id: 'milestones', name: 'Milestone maker', desc: 'Reach 5 goal milestones', icon: 'goals', key: 'milestones', target: 5 },
    { id: 'goal', name: 'Goal getter', desc: 'Complete a goal', icon: 'goals', key: 'goals', target: 1 },
    { id: 'money-30', name: 'Penny wise', desc: 'Log 30 expenses', icon: 'money', key: 'tx', target: 30 },
    { id: 'budget', name: 'Under budget', desc: 'Finish a month under your budget', icon: 'money', key: 'underMonths', target: 1 },
    { id: 'perfect', name: 'Perfect day', desc: 'All habits and 3 tasks in a day', icon: 'star', key: 'perfect', target: 1 },
    { id: 'cards-1', name: 'First recall', desc: 'Review your first flashcard', icon: 'study', key: 'cards', target: 1 },
    { id: 'cards-500', name: 'Memory palace', desc: 'Review 500 flashcards', icon: 'study', key: 'cards', target: 500 },
    { id: 'study-7', name: 'Daily learner', desc: 'Study flashcards 7 days in a row', icon: 'study', key: 'studyStreak', target: 7 },
    { id: 'top3', name: 'Big three', desc: 'Finish all of a day’s top 3', icon: 'starf', key: 'top3', target: 1 },
    { id: 'wrap-7', name: 'Closer', desc: 'Wrap up 7 days', icon: 'review', key: 'wrapups', target: 7 },
    { id: 'level-5', name: 'Rising', desc: 'Reach level 5', icon: 'progress', key: 'level', target: 5 },
    { id: 'level-10', name: 'Driven', desc: 'Reach level 10', icon: 'progress', key: 'level', target: 10 },
  ];
  let aV = -1, aMemo = null;
  A.all = () => {
    if (aV === O.store.ver && aMemo) return aMemo;
    const st = stats(), seen = S().achievements;
    aMemo = A.LIST.map((a) => { const v = st[a.key] || 0; return { ...a, value: v, done: v >= a.target, at: seen[a.id] || null }; });
    aV = O.store.ver;
    return aMemo;
  };

  /* ===================================================== celebrations */
  /* After every change, look for something worth celebrating: a level, a badge, the day's XP goal,
     every habit done. The first look after start-up only takes notes, so a reload never throws confetti. */
  let prev = null;
  O.celebrateCheck = (quiet = false) => {
    const xp = X.compute(), ach = A.all(), today = U.today(), s = S();
    const habitsToday = D.activeHabits().filter((h) => D.isScheduled(h, today));
    const now = {
      level: xp.level, unlocked: new Set(ach.filter((a) => a.done).map((a) => a.id)), xpToday: X.today(),
      allHabits: habitsToday.length > 0 && habitsToday.every((h) => D.hDone(h, today)), day: today,
    };
    const fresh = ach.filter((a) => a.done && !s.achievements[a.id]);
    if (fresh.length) O.store.update((st) => { fresh.forEach((a) => { st.achievements[a.id] = Date.now(); }); }, { silent: true });
    const loud = !quiet && prev && prev.day === now.day && !O.quietFx && s.settings.celebrate;
    if (loud) {
      if (now.level > prev.level) { O.fx && O.fx.confetti({ count: 160 }); O.toast(`Level ${now.level}! You’re now ${xp.title}.`, { ms: 6000 }); }
      else if (fresh.length && fresh.length <= 3) { O.fx && O.fx.confetti({ count: 80 }); O.toast(`Achievement unlocked: ${fresh.map((a) => a.name).join(', ')}`, { ms: 6000, action: 'See all', onAction: () => O.go('#/progress') }); }
      else if (now.allHabits && !prev.allHabits) { O.fx && O.fx.confetti({ count: 70 }); O.toast('Every habit done today. Nice.'); }
      const goal = s.settings.dailyXp || 120;
      if (now.xpToday >= goal && prev.xpToday < goal) { O.fx && O.fx.confetti({ count: 90 }); O.toast(`Daily goal reached: ${now.xpToday} XP today.`); }
    }
    prev = now;
  };
})();
