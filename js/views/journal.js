/* Orbit — Journal. The screen's question: how have my days been feeling? One mood and a line or two a day. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const esc = U.esc;
  const mem = { day: null, more: 30 };

  O.views.journal = {
    title: 'Journal',
    mount(root, params) {
      mem.day = params.query.get('day') || U.today();
      root.innerHTML = `
        <header class="title-row"><div><h1>Journal</h1><p class="sub" id="sub"></p></div></header>
        <div class="grid">
          <section class="panel s6" aria-labelledby="eh"><div class="panel-head"><h2 id="eh"></h2><div class="end"><span class="saved-stamp" id="stamp"></span></div></div>
            <div class="moods" id="moods" role="group" aria-label="Mood"></div>
            <textarea class="input journal-text" id="jt" style="min-height:150px" placeholder="What happened today? What are you grateful for? What will you do differently tomorrow?" aria-label="Journal entry"></textarea>
          </section>
          <section class="panel s6" aria-labelledby="mh"><div class="panel-head"><h2 id="mh">Mood, last 30 days</h2><span class="meta">7-day average</span></div><div class="chart" id="chart"></div><p class="finding" id="find"></p></section>
        </div>
        <section class="panel" style="margin-top:16px" aria-labelledby="ph"><div class="panel-head"><h2 id="ph">Past entries</h2><span class="count-chip" id="pcount"></span></div><div class="jlist" id="past"></div></section>`;
      const $ = (id) => root.querySelector('#' + id);
      const J = () => O.store.state.journal;

      function sub() {
        const days = U.lastDays(30), ms = days.map((k) => (J()[k] || {}).mood).filter(Boolean);
        const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : 0;
        $('sub').textContent = ms.length ? `Average mood over the last 30 days: ${D.MOODS[Math.round(avg)]} (${avg.toFixed(1)} of 5) · ${U.plural(Object.keys(J()).length, 'entry', 'entries')} in all` : 'A mood and a line a day. In a month you will see the pattern.';
      }
      function entry() {
        const e = J()[mem.day] || {};
        $('eh').textContent = mem.day === U.today() ? 'Today' : U.fmtDate(mem.day);
        $('moods').innerHTML = D.MOODS.slice(1).map((m, i) => `<button type="button" class="mood-btn" aria-pressed="${e.mood === i + 1}" data-mood="${i + 1}">${m}</button>`).join('');
        if (document.activeElement !== $('jt')) $('jt').value = e.text || '';
        $('stamp').innerHTML = mem.day !== U.today() ? `<button type="button" class="card-link" data-day="${U.today()}">Back to today</button>` : '';
      }
      function chart() {
        // each point is the average of the entries in the seven days ending that day, so single days don't zigzag
        const days = U.lastDays(30);
        const vals = days.map((k) => { const ms = U.lastDays(7, k).map((d) => (J()[d] || {}).mood).filter(Boolean); return ms.length ? +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(2) : null; });
        const box = document.createElement('div'); $('chart').innerHTML = ''; $('chart').appendChild(box);
        Charts.line(box, { labels: days.map((k) => U.parseKey(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })), series: [{ name: 'Mood, 7-day average', values: vals }], yTicks: [1, 2, 3, 4, 5], tickFormat: (v) => D.MOODS[v] || '', format: (v) => `${D.MOODS[Math.round(v)]} (${v.toFixed(1)})`, height: 196 });
        // the weekday that feels best
        const byDow = Array.from({ length: 7 }, () => []);
        Object.entries(J()).forEach(([k, e]) => { if (e.mood && U.diffDays(U.today(), k) < 90) byDow[U.dow(k)].push(e.mood); });
        const avgs = byDow.map((xs, i) => ({ i, n: xs.length, a: xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : 0 })).filter((x) => x.n >= 2);
        const best = avgs.sort((a, b) => b.a - a.a)[0], worst = avgs[avgs.length - 1];
        $('find').innerHTML = best && worst && best.i !== worst.i ? `Over the last 90 days, <b>${U.weekdayLong(best.i)}s</b> feel best (${best.a.toFixed(1)}) and ${U.weekdayLong(worst.i)}s feel worst (${worst.a.toFixed(1)}).` : vals.some(Boolean) ? 'Gaps are days with no entry.' : 'Pick a mood above to start the line.';
      }
      function past() {
        const keys = Object.keys(J()).filter((k) => k !== U.today()).sort().reverse();
        $('pcount').textContent = keys.length;
        $('past').innerHTML = keys.length ? keys.slice(0, mem.more).map((k) => { const e = J()[k]; return `<button type="button" class="jrow" data-day="${k}" style="border:0;background:none;width:100%;text-align:left;cursor:pointer;color:inherit" aria-label="Edit the entry for ${esc(U.fmtDate(k))}"><span class="d">${esc(U.fmtDate(k, { weekday: 'short', day: 'numeric', month: 'short' }))}</span><span class="mood-word">${e.mood ? D.MOODS[e.mood] : '<span class="muted">–</span>'}</span><span class="t ${e.text ? '' : 'none'}">${e.text ? esc(e.text) : 'No words, just the mood.'}</span></button>`; }).join('') + (keys.length > mem.more ? `<button type="button" class="btn sm" data-more style="margin-top:12px">Show ${Math.min(30, keys.length - mem.more)} more</button>` : '')
          : `<div class="empty">Past days show up here. Click one to edit it.</div>`;
      }
      const all = () => { sub(); entry(); chart(); past(); };
      all();

      const save = U.debounce(() => {
        O.store.update((s) => { const cur = s.journal[mem.day] || { mood: 0, text: '' }; cur.text = $('jt').value; delete cur.sample; if (!cur.text && !cur.mood) delete s.journal[mem.day]; else s.journal[mem.day] = cur; }, { silent: true });
        if (mem.day === U.today()) $('stamp').textContent = 'Saved ' + U.hm(U.nowMins());
        past(); sub();
      }, 500);
      $('jt').addEventListener('input', save);
      $('jt').addEventListener('blur', () => save.flush());
      root.addEventListener('click', (e) => {
        const m = e.target.closest('[data-mood]');
        if (m) { const v = +m.dataset.mood; O.store.update((s) => { const cur = s.journal[mem.day] || { mood: 0, text: '' }; cur.mood = cur.mood === v ? 0 : v; delete cur.sample; if (!cur.text && !cur.mood) delete s.journal[mem.day]; else s.journal[mem.day] = cur; }); return; }
        const d = e.target.closest('[data-day]');
        if (d) { save.flush(); mem.day = d.dataset.day; history.replaceState(null, '', mem.day === U.today() ? '#/journal' : '#/journal?day=' + mem.day); entry(); $('jt').focus(); document.getElementById('sheet').scrollTo({ top: 0, behavior: 'smooth' }); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
        if (e.target.closest('[data-more]')) { mem.more += 30; past(); }
      });
      return { refresh: all, destroy() { save.flush(); } };
    },
  };
})();
