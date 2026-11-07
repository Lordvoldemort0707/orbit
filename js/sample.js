/* Orbit — sample data, so a first look shows every screen at real density. Everything here is marked
   sample: true and can be removed in Settings without touching anything you added yourself.
   Dates and times are built relative to now, so the sample never shows a future session as done. */
(function () {
  'use strict';
  const { u: U, d: D } = O;

  function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const at = (key, mins) => { const d = U.parseKey(key); d.setMinutes(mins); return d.getTime(); };
  const round30 = (m) => Math.ceil(m / 30) * 30;

  O.loadSample = () => {
    const r = rng(20261107);
    const T = U.today(), now = U.nowMins();
    const pick = (xs) => xs[Math.floor(r() * xs.length)];
    const created = at(U.addDays(T, -75), 9 * 60);

    O.store.update((s) => {
      O.removeSample(s);
      /* habits */
      const H = [
        { id: 'h-read', name: 'Read 20 minutes', target: 1, days: [], p: 0.8 },
        { id: 'h-water', name: 'Drink water', target: 8, unit: 'glasses', days: [], p: 0.6 },
        { id: 'h-gym', name: 'Workout', target: 1, days: [1, 3, 5, 6], p: 0.75 },
        { id: 'h-code', name: 'Solve one coding problem', target: 1, days: [], p: 0.7 },
        { id: 'h-sleep', name: 'Lights out by midnight', target: 1, days: [], p: 0.55 },
      ];
      for (const h of H) {
        s.habits.push({ id: h.id, name: h.name, target: h.target, unit: h.unit || '', days: h.days, createdAt: created, archived: false, sample: true });
        const c = (s.checkins[h.id] = {});
        for (let i = 75; i >= 1; i--) {
          const k = U.addDays(T, -i);
          if (h.days.length && !h.days.includes(U.dow(k))) continue;
          if (h.target > 1) { const n = r() < h.p ? h.target : 3 + Math.floor(r() * (h.target - 3)); c[k] = n; continue; }
          if (h.id === 'h-read') { if (i <= 12) { c[k] = 1; continue; } if (i === 13) continue; }
          if (r() < h.p) c[k] = 1;
        }
      }
      // today, as far as the day has gone
      s.checkins['h-water'][T] = Math.min(8, Math.max(0, Math.floor((now - 7 * 60) / 90)));
      if (!s.checkins['h-water'][T]) delete s.checkins['h-water'][T];
      if ([1, 3, 5, 6].includes(U.dow(T)) && now > 8 * 60) s.checkins['h-gym'][T] = 1;
      if (now > 10 * 60) s.checkins['h-code'][T] = 1;

      /* finished tasks over the last two months */
      const pool = ['Review lecture notes', 'Reply to emails', 'Do the laundry', 'Buy groceries', 'Update resume', 'Clean the desk', 'Read 30 pages', 'Practise two array problems',
        'Call Dad', 'Fix the login redirect bug', 'Write the blog draft', 'Water the plants', 'Pay the electricity bill', 'Revise OS scheduling', 'Plan the week', 'Back up phone photos',
        'Write stand-up notes', 'Refactor portfolio CSS', 'Watch a system design video', 'Book the bus ticket home'];
      const lists = ['personal', 'work', 'study'];
      for (let i = 60; i >= 1; i--) {
        const k = U.addDays(T, -i), weekend = [0, 6].includes(U.dow(k));
        const n = (weekend ? 1 : 2) + Math.floor(r() * (weekend ? 3 : 5));
        for (let j = 0; j < n; j++) {
          const m = 8 * 60 + Math.floor(r() * 14 * 60);
          s.tasks.push({ id: U.uid(), title: pick(pool), notes: '', list: pick(lists), due: k, time: null, priority: Math.floor(r() * 3), repeat: '', subtasks: [], done: true, doneAt: at(k, m), createdAt: at(k, 7 * 60), sample: true });
        }
      }
      /* open and recent tasks */
      const t1 = Math.min(23 * 60 + 30, round30(now + 75)), t2 = Math.min(23 * 60 + 30, round30(now + 180));
      const late = now + 75 > 23 * 60 + 30;
      const add = (f) => s.tasks.push({ id: U.uid(), notes: '', list: 'personal', due: null, time: null, priority: 0, repeat: '', subtasks: [], done: false, doneAt: null, createdAt: Date.now() - 3600e3, sample: true, ...f });
      add({ title: 'Reply to Aman about the hackathon team', list: 'work', due: U.addDays(T, -1), priority: 2 });
      add({ title: 'Submit the DBMS lab report', list: 'study', due: late ? U.addDays(T, 1) : T, time: late ? '10:00' : U.hm(t1), priority: 3, notes: 'Export the ER diagram as PNG and attach the SQL file.' });
      add({ title: 'Call Mom', list: 'personal', due: late ? U.addDays(T, 1) : T, time: late ? '19:00' : U.hm(t2) });
      add({ title: 'Push portfolio fixes to GitHub', list: 'work', due: T, priority: 2 });
      add({ title: 'Buy groceries', list: 'personal', due: T, subtasks: [{ id: U.uid(), title: 'Milk', done: true }, { id: U.uid(), title: 'Eggs', done: false }, { id: U.uid(), title: 'Oats', done: false }] });
      if (now > 7 * 60 + 40) add({ title: 'Morning workout', list: 'personal', due: T, done: true, doneAt: at(T, 7 * 60 + 40) });
      if (now > 9 * 60 + 10) add({ title: 'Review flashcards', list: 'study', due: T, done: true, doneAt: at(T, 9 * 60 + 10) });
      add({ title: 'Pay the phone bill', list: 'personal', due: U.addDays(T, 1), repeat: 'monthly', priority: 1 });
      add({ title: 'Read chapter 4 of the OS book', list: 'study', due: U.addDays(T, 2) });
      add({ title: 'Dentist appointment', list: 'personal', due: U.addDays(T, 5), time: '11:30', priority: 2 });
      let sun = U.addDays(T, 1); while (U.dow(sun) !== 0) sun = U.addDays(sun, 1);
      add({ title: 'Weekly review', list: 'personal', due: sun, repeat: 'weekly', time: '18:00' });
      add({ title: 'Plan a weekend trip to the hills' });
      add({ title: 'Learn how service workers cache files', list: 'study' });
      add({ title: 'Archive old GitHub repos', list: 'work', priority: 1 });

      /* focus sessions */
      for (let i = 60; i >= 1; i--) {
        const k = U.addDays(T, -i), weekend = [0, 6].includes(U.dow(k));
        const n = Math.floor(r() * (weekend ? 3 : 6));
        let m = 9 * 60 + Math.floor(r() * 60);
        for (let j = 0; j < n; j++) {
          const len = r() < 0.15 ? 50 : 25;
          s.sessions.push({ id: U.uid(), start: at(k, m), end: at(k, m + len), minutes: len, taskId: null, sample: true });
          m += len + 5 + Math.floor(r() * 120);
          if (m > 22 * 60) break;
        }
      }
      for (const m of [9 * 60 + 30, 10 * 60 + 5, 11 * 60 + 5, 15 * 60 + 10]) if (m + 25 <= now) s.sessions.push({ id: U.uid(), start: at(T, m), end: at(T, m + 25), minutes: 25, taskId: null, sample: true });

      /* planner blocks */
      const block = (date, a, b, title, kind) => s.blocks.push({ id: U.uid(), date, start: a, end: b, title, kind, sample: true });
      block(T, 540, 660, 'Deep work: portfolio', 'work');
      block(T, 690, 750, 'DBMS lab report', 'study');
      block(T, 780, 840, 'Lunch and a walk', 'personal');
      block(T, 960, 1020, 'Gym', 'health');
      block(T, 1080, 1170, 'OS chapter 4', 'study');
      block(T, 1260, 1290, 'Plan tomorrow', 'personal');
      const Y = U.addDays(T, -1), M = U.addDays(T, 1);
      block(Y, 600, 720, 'Lecture: computer networks', 'study');
      block(Y, 840, 960, 'Hackathon planning', 'work');
      block(Y, 1140, 1200, 'Run', 'health');
      block(M, 570, 690, 'Deep work: API project', 'work');
      block(M, 720, 780, 'Pay bills and errands', 'personal');
      block(M, 1020, 1110, 'DSA practice', 'study');

      /* notes */
      const note = (title, body, daysAgo, pinned = false) => s.notes.push({ id: U.uid(), title, body, pinned, createdAt: at(U.addDays(T, -daysAgo - 3), 600), updatedAt: at(U.addDays(T, -daysAgo), 600 + daysAgo * 37), sample: true });
      note('Weekly review', '## Every Sunday, 20 minutes\n\n- [x] Clear the inbox and the downloads folder\n- [ ] Look at next week in the planner\n- [ ] Move unfinished tasks to new dates\n- [ ] Pick the one thing that matters most\n\nWhat went well? What will I change? #routine', 1, true);
      note('Portfolio site ideas', '- Case study for the expense tracker, with **before and after** screenshots\n- Dark mode that follows the system\n- A /uses page with my setup\n- Contact form that sends to email\n\n#projects', 2, true);
      note('DBMS: normalisation cheat sheet', '# Normal forms\n\n**1NF**: atomic values, no repeating groups.\n\n**2NF**: 1NF and no partial dependency on part of a composite key.\n\n**3NF**: 2NF and no transitive dependency (non-key → non-key).\n\n**BCNF**: for every X → Y, X is a superkey.\n\n#study', 4);
      note('Books to read', '- Atomic Habits\n- Deep Work\n- The Pragmatic Programmer\n- Designing Data-Intensive Applications\n\n#reading', 9);
      note('Hackathon brainstorm', 'Campus lost-and-found with photo matching. Team: Aman (backend), me (frontend), Riya (ML).\n\nNeed: a demo video under 3 minutes. #ideas', 1);

      /* journal */
      const lines = ['Good focus in the morning, slow after lunch.', 'Finally fixed the redirect bug.', 'Too much scrolling tonight.', 'Long walk, felt clear afterwards.',
        'Lab took longer than planned.', 'Slept badly, kept it light.', 'Great call with the hackathon team.', 'Gym and an early night.', 'Got through the OS chapter.', 'Lazy Sunday, needed it.'];
      for (let i = 30; i >= 1; i--) {
        if (r() < 0.2) continue;
        const k = U.addDays(T, -i), x = r();
        const mood = x < 0.07 ? 1 : x < 0.2 ? 2 : x < 0.45 ? 3 : x < 0.82 ? 4 : 5;
        s.journal[k] = { mood, text: r() < 0.7 ? pick(lines) : '', sample: true };
      }
      s.seen.onboarding = true;
      s.hasSample = true;
    });
    // the figures that must agree with each other
    const today = U.today();
    console.assert(D.focusOn(today) === O.store.state.sessions.filter((x) => U.keyOf(x.start) === today).reduce((a, x) => a + x.minutes, 0), 'focus total matches its sessions');
    console.assert(O.store.state.tasks.every((t) => !t.done || t.doneAt), 'every done task has a time');
  };

  O.removeSample = (s = null) => {
    const run = (x) => {
      const ids = new Set(x.habits.filter((h) => h.sample).map((h) => h.id));
      x.habits = x.habits.filter((h) => !h.sample);
      for (const id of ids) delete x.checkins[id];
      x.tasks = x.tasks.filter((t) => !t.sample);
      x.sessions = x.sessions.filter((t) => !t.sample);
      x.blocks = x.blocks.filter((t) => !t.sample);
      x.notes = x.notes.filter((t) => !t.sample);
      for (const k of Object.keys(x.journal)) if (x.journal[k].sample) delete x.journal[k];
      x.hasSample = false;
    };
    if (s) run(s); else O.store.update(run);
  };
})();
