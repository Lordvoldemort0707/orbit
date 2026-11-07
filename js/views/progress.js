/* Orbit — Progress: level, XP and achievements. The screen's question: how far have I come?
   XP is earned from what you do, so the numbers here always agree with the other screens. */
(function () {
  'use strict';
  const { u: U } = O;
  const X = O.xp, A = O.achievements;
  const esc = U.esc;

  O.views.progress = {
    title: 'Progress',
    mount(root) {
      root.innerHTML = `
        <header class="title-row"><div><h1>Progress</h1><p class="sub" id="sub"></p></div></header>
        <div class="grid" id="top"></div>
        <div class="grid">
          <section class="panel s7" aria-labelledby="xh"><div class="panel-head"><h2 id="xh">XP per day, last 30 days</h2><span class="meta" id="xmeta"></span></div><div class="chart" id="xchart"></div></section>
          <section class="panel s5" aria-labelledby="sh"><div class="panel-head"><h2 id="sh">Where your XP comes from</h2></div><div id="src"></div></section>
        </div>
        <section style="margin-top:28px" aria-labelledby="ah"><div class="panel-head"><h2 id="ah">Achievements</h2><span class="count-chip" id="acount"></span><span class="meta" id="ameta"></span></div><div class="ach-grid" id="ach"></div></section>
        <section class="panel" style="margin-top:16px" aria-labelledby="rh"><div class="panel-head"><h2 id="rh">How XP works</h2></div><div class="xp-rules" id="rules"></div></section>`;
      const $ = (id) => root.querySelector('#' + id);
      let first = true;
      function draw() {
        const x = X.compute(), today = X.today(), goal = O.store.state.settings.dailyXp || 120;
        const days = U.lastDays(30), vals = days.map((k) => x.byDay[k] || 0);
        const avg = Math.round(vals.reduce((a, b) => a + b, 0) / 30);
        $('sub').textContent = `Level ${x.level}, ${x.title} · ${x.total.toLocaleString()} XP in all · ${(x.need - x.into).toLocaleString()} XP to level ${x.level + 1}`;
        const ach = A.all(), got = ach.filter((a) => a.done);
        const next = ach.filter((a) => !a.done).sort((a, b) => b.value / b.target - a.value / a.target)[0];
        $('top').innerHTML = `
          <section class="panel s5 level-card" aria-label="Level">
            <div class="level-top"><div class="level-badge"><span class="num" data-count="${x.level}" data-key="lvl">${x.level}</span></div><div><div class="level-title">${esc(x.title)}</div><div class="muted">Level ${x.level}</div></div></div>
            <div class="xp-bar"><i data-grow="${((x.into / x.need) * 100).toFixed(1)}%" style="width:${((x.into / x.need) * 100).toFixed(1)}%"></i></div>
            <div class="xp-line num"><span>${x.into.toLocaleString()} / ${x.need.toLocaleString()} XP</span><span>${(x.need - x.into).toLocaleString()} to level ${x.level + 1}</span></div>
          </section>
          <section class="panel s4 today-xp" aria-label="Today’s XP">
            <div class="ring-box">${O.fx.ring(today / goal, { size: 112, stroke: 9 })}<div class="ring-in"><b class="num" data-count="${today}" data-key="xpt">${today}</b><span>of ${goal} XP</span></div></div>
            <div><div class="panel-head" style="margin-bottom:6px"><h2>Today</h2></div><p class="muted">${today >= goal ? 'Daily goal reached. Anything more is a bonus.' : `${goal - today} XP to your daily goal. A focus session is worth ${O.store.state.settings.focusMin}.`}</p></div>
          </section>
          <section class="panel s3" aria-label="Next achievement">
            <div class="panel-head"><h2>Closest badge</h2></div>
            ${next ? `<div class="ach-mini"><span class="ach-ic">${O.icon(next.icon, 20)}</span><div><b>${esc(next.name)}</b><span class="muted">${esc(next.desc)}</span></div></div><div class="xp-bar thin"><i style="width:${Math.min(100, (next.value / next.target) * 100).toFixed(1)}%"></i></div><div class="xp-line num"><span>${Math.floor(next.value).toLocaleString()} / ${next.target.toLocaleString()}</span></div>` : '<p class="muted">Every badge unlocked. Legend.</p>'}
          </section>`;
        const box = document.createElement('div'); $('xchart').innerHTML = ''; $('xchart').appendChild(box);
        Charts.bars(box, { labels: days.map((k) => U.parseKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), values: vals, highlight: 29, height: 190, format: (v) => `${v} XP`, tickFormat: Charts.fmt.int, reference: { value: goal, label: '' } });
        const hit = vals.filter((v) => v >= goal).length;
        $('xmeta').textContent = `dashed line: your ${goal} XP goal · met on ${hit} of 30 days · average ${avg}`;
        const src = Object.entries(x.bySource).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
        if (src.length) Charts.barList($('src'), src.map(([k, v]) => ({ label: k, value: v })), { format: (v) => `${v.toLocaleString()} XP` });
        else $('src').innerHTML = '<div class="empty">Finish a task or a focus session to earn your first XP.</div>';
        $('acount').textContent = `${got.length}/${ach.length}`;
        $('ameta').textContent = got.length ? `latest: ${got.filter((a) => a.at).sort((a, b) => b.at - a.at)[0]?.name || got[0].name}` : '';
        $('ach').innerHTML = ach.slice().sort((a, b) => (b.done - a.done) || (b.value / b.target - a.value / a.target)).map((a) => `
          <article class="ach ${a.done ? 'got' : ''}">
            <span class="ach-ic">${O.icon(a.icon, 20)}</span>
            <div class="ach-body"><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>
              ${a.done ? `<span class="ach-when">${a.at ? 'Unlocked ' + esc(U.relDayInline(U.keyOf(a.at))) : 'Unlocked'}</span>` : `<div class="xp-bar thin"><i style="width:${Math.min(100, (a.value / a.target) * 100).toFixed(1)}%"></i></div><span class="ach-when num">${Math.floor(a.value).toLocaleString()} / ${a.target.toLocaleString()}</span>`}
            </div>
          </article>`).join('');
        const R = X.RULES;
        $('rules').innerHTML = [['Finish a task', `${R.task} XP, +${R.taskHigh} if high priority`], ['Check off a habit', `${R.habit} XP; +${R.streak7} at a 7-day streak, +${R.streak30} at 30`], ['Focus', `${R.focusMin} XP a minute`], ['Write in the journal', `${R.journal} XP a day`], ['Reach a milestone', `${R.milestone} XP`], ['Achieve a goal', `${R.goal} XP`], ['Log money', `${R.tx} XP an entry, up to ${R.txDailyCap} a day`]].map(([a, b]) => `<div><span>${a}</span><b class="num">${b}</b></div>`).join('') + `<p class="hint" style="grid-column:1/-1">Each level needs 50 XP more than the last. Undo a task and its XP goes with it.</p>`;
        O.fx.grow(root, first); O.fx.counts(root); first = false;
      }
      draw();
      return { refresh: draw };
    },
  };
})();
