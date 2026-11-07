/* Orbit — Stats. The screen's question: am I doing more, or less, than before?
   Every figure is computed from the same rows the other screens show; each change names its baseline. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const mem = { n: 30 };

  function period(n, end = U.today()) {
    const days = U.lastDays(n, end);
    const tasks = days.map((k) => D.doneOn(k).length);
    const focus = days.map((k) => D.focusOn(k));
    let due = 0, done = 0;
    for (const h of D.activeHabits()) for (const k of days) {
      if (k < D.habitStart(h) || !D.isScheduled(h, k) || (k === U.today() && !D.hDone(h, k))) continue;
      due++; if (D.hDone(h, k)) done++;
    }
    const moods = days.map((k) => (O.store.state.journal[k] || {}).mood).filter(Boolean);
    return {
      days, tasks, focus,
      tasksTotal: tasks.reduce((a, b) => a + b, 0),
      focusTotal: focus.reduce((a, b) => a + b, 0),
      habitRate: due ? done / due : null,
      mood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
    };
  }
  /* colour says good or bad; zero and "no baseline" stay grey */
  const delta = (cur, prev, fmt, n, goodUp = true) => {
    if (cur == null) return `<div class="delta">–</div>`;
    if (prev == null || (prev === 0 && cur !== 0 && fmt !== 'pts')) return `<div class="delta">${prev == null ? 'Nothing to compare with yet' : `${U.signed(cur, (v) => fmtv(v, fmt))} (new) vs previous ${n} days`}</div>`;
    const d = cur - prev;
    const shown = fmt === 'pts' ? Math.round(d * 100) : fmt === 'mood' ? +d.toFixed(1) : d;
    if (!shown) return `<div class="delta">Same as the previous ${n} days</div>`;
    const good = goodUp ? shown > 0 : shown < 0;
    return `<div class="delta"><span class="${good ? 'good' : 'bad'}">${U.signed(shown, (v) => fmtv(v, fmt))}</span> vs previous ${n} days</div>`;
  };
  const fmtv = (v, f) => (f === 'min' ? U.dur(v) : f === 'pts' ? `${v} pts` : f === 'mood' ? v.toFixed(1) : String(v));

  O.views.stats = {
    title: 'Stats',
    mount(root) {
      root.innerHTML = `
        <header class="title-row"><div><h1>Stats</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><div class="seg" role="group" aria-label="Period" id="range">${[7, 30, 90].map((n) => `<button type="button" data-n="${n}" aria-pressed="${mem.n === n}">${n} days</button>`).join('')}</div></div></header>
        <div class="kpis" id="kpis"></div>
        <div class="grid" style="margin-top:16px">
          <section class="panel s6" aria-labelledby="c1"><div class="panel-head"><h2 id="c1">Tasks done per day</h2><span class="meta" id="c1m"></span></div><div class="chart" id="tchart"></div></section>
          <section class="panel s6" aria-labelledby="c2"><div class="panel-head"><h2 id="c2">Minutes focused per day</h2><span class="meta" id="c2m"></span></div><div class="chart" id="fchart"></div></section>
        </div>
        <div class="grid">
          <section class="panel s6" aria-labelledby="c3"><div class="panel-head"><h2 id="c3">Habits kept</h2><span class="meta" id="c3m"></span><div class="end"><a class="card-link" href="#/habits">Habits${O.icon('right')}</a></div></div><div id="hlist"></div></section>
          <section class="panel s6" aria-labelledby="c4"><div class="panel-head"><h2 id="c4">When tasks get done</h2><span class="meta">by hour of day</span></div><div class="chart" id="hchart"></div><p class="finding" id="hfind"></p></section>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);

      function draw() {
        const n = mem.n, cur = period(n), prev = period(n, U.addDays(U.today(), -n));
        // the one finding: the strongest weekday in the window
        const dow = Array.from({ length: 7 }, () => ({ s: 0, c: 0 }));
        cur.days.forEach((k, i) => { if (k !== U.today()) { dow[U.dow(k)].s += cur.tasks[i]; dow[U.dow(k)].c++; } });
        const best = dow.map((x, i) => ({ i, a: x.c ? x.s / x.c : 0 })).sort((a, b) => b.a - a.a)[0];
        const diff = cur.tasksTotal - prev.tasksTotal;
        $('sub').innerHTML = cur.tasksTotal || cur.focusTotal ? `${U.plural(cur.tasksTotal, 'task')} finished in the last ${n} days${prev.tasksTotal ? `, ${diff === 0 ? 'the same as' : Math.abs(diff) + (diff > 0 ? ' more than' : ' fewer than')} the ${n} days before` : ''}.${best && best.a > 0 && n >= 14 ? ` ${U.weekdayLong(best.i)}s are your strongest day, ${best.a.toFixed(1)} tasks on average.` : ''}` : 'Finish tasks, log focus and check off habits; the numbers fill in from there.';
        U.$$('#range button', root).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.n === n));

        $('kpis').innerHTML = `
          <div class="kpi"><div class="kpi-label">Tasks done</div><div class="kpi-value num">${cur.tasksTotal}</div>${delta(cur.tasksTotal, prev.tasksTotal, 'n', n)}</div>
          <div class="kpi"><div class="kpi-label">Focus time</div><div class="kpi-value num">${U.durHtml(cur.focusTotal)}</div>${delta(cur.focusTotal, prev.focusTotal, 'min', n)}</div>
          <div class="kpi"><div class="kpi-label">Habit days kept</div><div class="kpi-value num">${cur.habitRate == null ? '<span class="muted">–</span>' : Math.round(cur.habitRate * 100) + '<small>%</small>'}</div>${delta(cur.habitRate, prev.habitRate, 'pts', n)}</div>
          <div class="kpi"><div class="kpi-label">Average mood</div><div class="kpi-value num">${cur.mood == null ? '<span class="muted">–</span>' : `${D.MOODS[Math.round(cur.mood)]}<small> ${cur.mood.toFixed(1)}</small>`}</div>${delta(cur.mood, prev.mood, 'mood', n)}</div>`;

        const labels = cur.days.map((k) => U.parseKey(k).toLocaleDateString(undefined, n <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' }));
        const box = (id) => { const b = document.createElement('div'); $(id).innerHTML = ''; $(id).appendChild(b); return b; };
        Charts.bars(box('tchart'), { labels, values: cur.tasks, highlight: n - 1, height: 188, format: (v) => U.plural(v, 'task'), tickFormat: Charts.fmt.int });
        Charts.bars(box('fchart'), { labels, values: cur.focus, highlight: n - 1, height: 188, format: (v) => `${v} min`, tickFormat: Charts.fmt.int });
        $('c1m').textContent = `average ${(cur.tasksTotal / n).toFixed(1)} a day · today in colour`;
        $('c2m').textContent = `average ${Math.round(cur.focusTotal / n)} min a day`;

        const hs = D.activeHabits().map((h) => ({ h, r: D.rate(h, n) })).filter((x) => x.r != null).sort((a, b) => b.r - a.r);
        $('c3m').textContent = `share of scheduled days, last ${n} days`;
        if (hs.length) Charts.barList($('hlist'), hs.map((x) => ({ label: x.h.name, value: Math.round(x.r * 100) })), { format: (v) => `${v}%` });
        else $('hlist').innerHTML = `<div class="empty">No habit history in this period.</div>`;

        const st = O.store.state.settings, hours = [];
        for (let h = st.dayStart; h < Math.min(24, st.dayEnd); h++) hours.push(h);
        const counts = hours.map(() => 0);
        cur.days.forEach((k) => D.doneOn(k).forEach((t) => { const hh = new Date(t.doneAt).getHours(); const i = hours.indexOf(hh); if (i >= 0) counts[i]++; }));
        const peak = counts.indexOf(Math.max(...counts));
        Charts.bars(box('hchart'), { labels: hours.map((h) => U.hm(h * 60)), values: counts, highlight: peak, height: 168, format: (v) => U.plural(v, 'task'), tickFormat: Charts.fmt.int });
        const total = counts.reduce((a, b) => a + b, 0);
        const am = counts.reduce((a, c, i) => a + (hours[i] < 12 ? c : 0), 0);
        $('hfind').innerHTML = total ? `Most tasks are finished around <b>${U.hm(hours[peak] * 60)}</b>; ${Math.round((am / total) * 100)}% before noon.` : 'No finished tasks in this period yet.';
      }
      draw();
      root.addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (b) { mem.n = +b.dataset.n; draw(); } });
      return { refresh: draw };
    },
  };
})();
