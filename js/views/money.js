/* Orbit — Money. The screen's question: how much have I spent this month, and is it within budget?
   Type "250 lunch" and it is logged under Food; renewals of subscriptions log themselves on their date. */
(function () {
  'use strict';
  const { u: U, d: D } = O;
  const M = O.money;
  const esc = U.esc;
  const mem = { month: null, on: null, cat: 'all', more: 25 };

  const monthName = (mk) => U.parseKey(mk + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const shiftMonth = (mk, n) => { const d = U.parseKey(mk + '-01'); d.setMonth(d.getMonth() + n); return U.key(d).slice(0, 7); };
  const daysIn = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  const catOpts = (sel, income = false) => (income ? [['income', 'Income']] : Object.entries(M.CATS).map(([k, c]) => [k, c.name])).map(([k, n]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}</option>`).join('');

  /* ------------------------------------------------------------- dialogs */
  O.txDialog = (id) => {
    const t = O.store.state.money.tx.find((x) => x.id === id); if (!t) return;
    let type = t.type;
    const dlg = O.dialog({
      title: 'Edit entry', cls: 'small',
      body: `<div class="seg" role="group" aria-label="Kind"><button type="button" data-type="expense" aria-pressed="${type === 'expense'}">Spent</button><button type="button" data-type="income" aria-pressed="${type === 'income'}">Received</button></div>
        <div class="row2"><div class="field"><label for="ta">Amount (${esc(M.symbol())})</label><input id="ta" class="input" type="number" step="0.01" min="0" value="${t.amount}"></div>
        <div class="field"><label for="td">Date</label><input id="td" class="input" type="date" value="${t.date}"></div></div>
        <div class="field"><label for="tc">Category</label><select id="tc" class="input">${catOpts(t.category, type === 'income')}</select></div>
        <div class="field"><label for="tn">Note</label><input id="tn" class="input" value="${esc(t.note)}" maxlength="120"></div>`,
      actions: [
        { label: 'Delete', danger: true, left: true, onClick: () => { const s = O.store.state, i = s.money.tx.indexOf(t); O.store.update((st) => { st.money.tx.splice(i, 1); }); O.toast('Entry deleted', { action: 'Undo', onAction: () => O.store.update((st) => { st.money.tx.splice(i, 0, t); }) }); } },
        { label: 'Cancel' },
        { label: 'Save', primary: true, onClick: (d) => { const b = d.body, a = parseFloat(b.querySelector('#ta').value); if (!(a > 0)) { b.querySelector('#ta').focus(); return false; } O.store.update(() => { Object.assign(t, { type, amount: Math.round(a * 100) / 100, date: b.querySelector('#td').value || t.date, category: b.querySelector('#tc').value, note: b.querySelector('#tn').value.trim() }); }); } },
      ],
    });
    dlg.body.addEventListener('click', (e) => { const b = e.target.closest('[data-type]'); if (!b) return; type = b.dataset.type; dlg.body.querySelectorAll('[data-type]').forEach((x) => x.setAttribute('aria-pressed', x === b)); dlg.body.querySelector('#tc').innerHTML = catOpts(type === 'income' ? 'income' : 'other', type === 'income'); });
  };
  O.subDialog = (id = null) => {
    const s = O.store.state, sub = id ? s.money.subs.find((x) => x.id === id) : { name: '', amount: '', cycle: 'monthly', next: U.addDays(U.today(), 1), category: 'bills', autoLog: true };
    const dlg = O.dialog({
      title: id ? 'Subscription' : 'New subscription', cls: 'small',
      body: `<div class="field"><label for="sn">Name</label><input id="sn" class="input" value="${esc(sub.name)}" placeholder="e.g. Spotify" maxlength="60"></div>
        <div class="row2"><div class="field"><label for="sa">Amount (${esc(M.symbol())})</label><input id="sa" class="input" type="number" step="0.01" min="0" value="${sub.amount}"></div>
        <div class="field"><label for="sc">Every</label><select id="sc" class="input">${[['weekly', 'Week'], ['monthly', 'Month'], ['yearly', 'Year']].map(([k, v]) => `<option value="${k}" ${k === sub.cycle ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
        <div class="row2"><div class="field"><label for="sd">Next renewal</label><input id="sd" class="input" type="date" value="${sub.next}"></div>
        <div class="field"><label for="sk">Category</label><select id="sk" class="input">${catOpts(sub.category)}</select></div></div>
        <label class="switch-row"><span><b>Log it on the renewal date</b><span>Adds the payment to your spending by itself.</span></span><input type="checkbox" class="switch" id="sl" ${sub.autoLog !== false ? 'checked' : ''}></label>`,
      actions: [
        ...(id ? [{ label: 'Delete', danger: true, left: true, onClick: () => O.store.update((st) => { st.money.subs = st.money.subs.filter((x) => x.id !== id); }) }] : []),
        { label: 'Cancel' },
        { label: id ? 'Save' : 'Add', primary: true, onClick: (d) => {
          const b = d.body, name = b.querySelector('#sn').value.trim(), a = parseFloat(b.querySelector('#sa').value);
          if (!name) { b.querySelector('#sn').focus(); return false; }
          if (!(a > 0)) { b.querySelector('#sa').focus(); return false; }
          const f = { name, amount: Math.round(a * 100) / 100, cycle: b.querySelector('#sc').value, next: b.querySelector('#sd').value || U.today(), category: b.querySelector('#sk').value, autoLog: b.querySelector('#sl').checked };
          O.store.update((st) => { if (id) Object.assign(st.money.subs.find((x) => x.id === id), f); else st.money.subs.push({ id: U.uid(), ...f }); });
          M.processSubs(); O.store.emit();
        } },
      ],
    });
    dlg.body.querySelector('#sn').focus();
  };
  O.budgetDialog = () => {
    const b = O.store.state.money.budgets;
    O.dialog({
      title: 'Monthly budgets', cls: 'small',
      body: `<p class="lead">Set a limit for the categories you want to watch. Leave the rest empty.</p>
        <div class="budget-grid">${Object.entries(M.CATS).map(([k, c]) => `<label class="field"><span class="label">${c.name}</span><input class="input" type="number" min="0" step="1" data-bud="${k}" value="${b[k] || ''}" placeholder="No limit"></label>`).join('')}</div>`,
      actions: [{ label: 'Cancel' }, { label: 'Save budgets', primary: true, onClick: (d) => { O.store.update((s) => { d.body.querySelectorAll('[data-bud]').forEach((i) => { const v = parseFloat(i.value); if (v > 0) s.money.budgets[i.dataset.bud] = Math.round(v); else delete s.money.budgets[i.dataset.bud]; }); }); } }],
    });
  };
  O.quickMoney = (text) => {
    const p = M.parse(text);
    if (!(p.amount > 0)) return null;
    let t;
    O.store.update(() => { t = M.addTx({ amount: Math.round(p.amount * 100) / 100, type: p.type, category: p.category, note: p.note, date: p.date }); });
    O.toast(`${p.type === 'income' ? 'Received' : 'Spent'} ${M.fmt(t.amount)}${p.type === 'expense' ? ' on ' + M.catName(t.category) : ''}`, { action: 'Undo', onAction: () => O.store.update((s) => { s.money.tx = s.money.tx.filter((x) => x.id !== t.id); }) });
    return t;
  };

  /* ------------------------------------------------------------------ view */
  O.views.money = {
    title: 'Money',
    mount(root) {
      if (mem.on !== U.today()) { mem.on = U.today(); mem.month = M.monthKey(); }
      root.innerHTML = `
        <header class="title-row"><div><h1>Money</h1><p class="sub" id="sub"></p></div>
          <div class="actions plan-head">
            <button type="button" class="btn icon" data-m="-1" aria-label="Previous month">${O.icon('left')}</button>
            <span class="month-label" id="mlabel"></span>
            <button type="button" class="btn icon" data-m="1" aria-label="Next month">${O.icon('right')}</button>
            <button type="button" class="btn" data-budgets>Budgets</button>
          </div></header>
        <form class="qa money-qa" id="qa" autocomplete="off">
          <div class="qa-field">${O.icon('plus')}<input name="q" placeholder="Log money: 250 lunch, 1200 books yesterday, +5000 stipend" aria-label="Log spending or income"></div>
          <div class="qa-chips" aria-live="polite"></div>
        </form>
        <div class="kpis" id="kpis" style="margin-top:16px"></div>
        <div class="grid" style="margin-top:16px">
          <section class="panel s7" aria-labelledby="dh"><div class="panel-head"><h2 id="dh">Spent per day</h2><span class="meta" id="dmeta"></span></div><div class="chart" id="days"></div></section>
          <section class="panel s5" aria-labelledby="bh"><div class="panel-head"><h2 id="bh">By category</h2><div class="end"><button type="button" class="card-link" data-budgets>Edit budgets${O.icon('right')}</button></div></div><div id="cats"></div></section>
        </div>
        <div class="grid top">
          <section class="panel s7" aria-labelledby="th"><div class="panel-head"><h2 id="th">Entries</h2><span class="count-chip" id="tcount"></span><div class="end"><select class="input sm-select" id="catf" aria-label="Filter by category"></select></div></div><div id="txs"></div></section>
          <section class="panel s5" aria-labelledby="sh"><div class="panel-head"><h2 id="sh">Subscriptions</h2><span class="meta" id="smeta"></span><div class="end"><button type="button" class="card-link" data-sub-new>Add${O.icon('plus')}</button></div></div><div class="rcards" id="subs"></div></section>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      const qa = $('qa'), qin = qa.querySelector('input'), chips = qa.querySelector('.qa-chips');

      function draw() {
        const mk = mem.month, cur = M.monthKey(), isCur = mk === cur, s = O.store.state;
        const txs = M.inMonth(mk).sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
        const spent = M.spent(txs), earned = M.earned(txs), budget = M.totalBudget();
        const days = daysIn(mk), elapsed = isCur ? +U.today().slice(8) : mk < cur ? days : 0;
        // the month before, over the same days, so a part month is never set against a whole one
        const pm = shiftMonth(mk, -1), prevSpent = M.spent(M.inMonth(pm).filter((t) => +t.date.slice(8) <= (isCur ? elapsed : 31)));
        const prevLabel = isCur ? `${U.parseKey(pm + '-01').toLocaleDateString(undefined, { month: 'short' })} 1–${elapsed}` : monthName(pm).split(' ')[0];
        $('mlabel').textContent = monthName(mk);
        root.querySelector('[data-m="1"]').disabled = mk >= cur;
        // the finding
        let sub;
        if (!txs.length) sub = isCur ? 'Nothing logged this month yet. Type an amount and what it was for.' : 'Nothing was logged this month.';
        else if (budget) {
          const left = budget - spent;
          sub = left >= 0 ? `${M.fmt(spent)} spent of your ${M.fmt(budget)} budget; ${M.fmt(left)} left${isCur ? ` for the ${days - elapsed + 1} days to go` : ''}.` : `${M.fmt(-left)} over your ${M.fmt(budget)} budget${isCur ? ` with ${days - elapsed} days to go` : ''}.`;
        } else sub = `${M.fmt(spent)} spent in ${monthName(mk).split(' ')[0]}${prevSpent ? `, ${M.fmt(Math.abs(spent - prevSpent))} ${spent > prevSpent ? 'more' : 'less'} than ${esc(prevLabel)}` : ''}. Set budgets to see what’s left.`;
        $('sub').textContent = sub;

        const avg = elapsed ? spent / elapsed : 0, pace = avg * days;
        $('kpis').innerHTML = `
          <div class="kpi"><div class="kpi-label">Spent</div><div class="kpi-value num">${M.fmt(spent)}</div><div class="delta">${prevSpent ? `<span class="${spent > prevSpent ? 'bad' : 'good'}">${M.fmt(spent - prevSpent, { sign: true })}</span> vs ${esc(prevLabel)}` : 'Nothing last month to compare'}</div></div>
          <div class="kpi"><div class="kpi-label">Received</div><div class="kpi-value num">${M.fmt(earned)}</div><div class="delta">${earned ? `Net ${M.fmt(earned - spent, { sign: true })}` : '–'}</div></div>
          <div class="kpi"><div class="kpi-label">Left in budget</div><div class="kpi-value num ${budget && spent > budget ? 'neg-text' : ''}">${budget ? M.fmt(budget - spent) : '<span class="muted">–</span>'}</div><div class="delta">${budget ? `${Math.round((spent / budget) * 100)}% of ${M.fmt(budget)} used` : '<button type="button" class="card-link" data-budgets>Set a budget</button>'}</div></div>
          <div class="kpi"><div class="kpi-label">Per day</div><div class="kpi-value num">${M.fmt(avg)}</div><div class="delta">${isCur && elapsed ? `On pace for ${M.fmt(pace)}${budget ? (pace > budget ? ' <span class="bad">over budget</span>' : '') : ''}` : `${days} days`}</div></div>`;

        // per day bars
        const keys = Array.from({ length: days }, (_, i) => `${mk}-${String(i + 1).padStart(2, '0')}`);
        const vals = keys.map((k) => M.spent(txs.filter((t) => t.date === k)));
        const box = document.createElement('div'); $('days').innerHTML = ''; $('days').appendChild(box);
        Charts.bars(box, { labels: keys.map((k) => String(+k.slice(8))), values: vals, highlight: isCur ? elapsed - 1 : null, height: 190, format: (v) => M.fmt(v), tickFormat: (v) => M.fmt(v).replace(/\.00$/, ''), reference: budget ? { value: Math.round(budget / days), label: 'Daily budget' } : undefined });
        const big = vals.indexOf(Math.max(...vals));
        $('dmeta').textContent = spent ? `biggest day: ${U.short(keys[big])}, ${M.fmt(vals[big])}` : '';

        // categories
        const byCat = Object.keys(M.CATS).map((k) => ({ k, spent: M.spent(txs.filter((t) => t.category === k)), planned: +s.money.budgets[k] || 0 })).filter((x) => x.spent || x.planned).sort((a, b) => b.spent - a.spent);
        if (!byCat.length) $('cats').innerHTML = '<div class="empty">Spending by category shows up here.</div>';
        else if (Object.keys(s.money.budgets).length) {
          $('cats').innerHTML = `<div class="cat-rows">${byCat.map((x) => { const r = x.planned ? x.spent / x.planned : null; return `<div class="cat-row"><div class="cat-line"><span><i class="cat-dot" data-cat="${x.k}"></i>${esc(M.CATS[x.k].name)}</span><span class="num">${M.fmt(x.spent)}${x.planned ? `<small> / ${M.fmt(x.planned)}</small>` : ''}</span></div>${x.planned ? `<div class="bar ${r > 1 ? 'over' : r > 0.85 ? 'near' : ''}"><i data-grow="${Math.min(100, r * 100).toFixed(1)}%" style="width:${Math.min(100, r * 100).toFixed(1)}%"></i></div>` : '<div class="bar none"></div>'}</div>`; }).join('')}</div>`;
        } else {
          Charts.barList($('cats'), byCat.map((x) => ({ label: M.CATS[x.k].name, value: x.spent })), { format: (v) => M.fmt(v) });
        }

        // entries
        const cats = Array.from(new Set(txs.map((t) => t.category)));
        if (mem.cat !== 'all' && !cats.includes(mem.cat)) mem.cat = 'all';
        $('catf').innerHTML = `<option value="all">All categories</option>` + cats.map((c) => `<option value="${c}" ${mem.cat === c ? 'selected' : ''}>${esc(M.catName(c))}</option>`).join('');
        const shown = txs.filter((t) => mem.cat === 'all' || t.category === mem.cat);
        $('tcount').textContent = shown.length;
        let lastDay = '';
        O.fill($('txs'), shown.length ? `<div class="tx-list">${shown.slice(0, mem.more).map((t) => { const head = t.date !== lastDay ? `<div class="tx-day"><span>${esc(U.relDay(t.date))}${U.relDay(t.date) === 'Today' || U.relDay(t.date) === 'Yesterday' ? '' : ''}</span><span class="num">${M.fmt(M.spent(shown.filter((x) => x.date === t.date)))}</span></div>` : ''; lastDay = t.date; return `${head}<button type="button" class="tx" data-tx="${t.id}"><i class="cat-dot" data-cat="${t.category}"></i><span class="tx-main"><span class="t">${esc(t.note || M.catName(t.category))}</span><span class="s">${esc(M.catName(t.category))}${t.subId ? ' · renewal' : ''}</span></span><span class="tx-amt num ${t.type === 'income' ? 'pos-text' : ''}">${t.type === 'income' ? '+' : ''}${M.fmt(t.amount)}</span></button>`; }).join('')}</div>${shown.length > mem.more ? `<button type="button" class="btn sm" data-more style="margin-top:12px">Show ${Math.min(25, shown.length - mem.more)} more</button>` : ''}`
          : `<div class="empty">${txs.length ? 'Nothing in this category.' : 'Every entry for the month is listed here.'}</div>`);

        // subscriptions
        const subs = s.money.subs.slice().sort((a, b) => (a.next < b.next ? -1 : 1));
        const monthly = subs.reduce((a, x) => a + M.subMonthly(x), 0);
        $('smeta').textContent = subs.length ? `${M.fmt(monthly)} a month` : '';
        $('subs').innerHTML = subs.length ? subs.map((x) => { const n = U.diffDays(x.next, U.today()); return `<div class="rcard link"><button type="button" class="open-btn" data-sub="${x.id}" aria-label="Edit ${esc(x.name)}"></button><div class="main"><span class="t">${esc(x.name)}</span><span class="s">${M.fmt(x.amount)} every ${x.cycle.replace('ly', '').replace('dai', 'day')}</span></div><div class="side">${n <= 3 ? `<span class="pill warn">${n <= 0 ? 'Renews today' : n === 1 ? 'Renews tomorrow' : `In ${n} days`}</span>` : `<span>${esc(U.short(x.next))}</span>`}</div></div>`; }).join('')
          : `<div class="empty">Netflix, Spotify, your phone plan: add them to see what they cost a month and get a heads-up before they renew.<button type="button" class="btn sm" data-sub-new>${O.icon('plus')}Add subscription</button></div>`;
        O.fx.grow(root, first);
        first = false;
      }
      let first = true;
      draw();

      qin.addEventListener('input', () => {
        const p = M.parse(qin.value);
        chips.innerHTML = qin.value.trim() && p.amount ? [M.fmt(p.amount), p.type === 'income' ? 'Received' : M.catName(p.category), U.relDay(p.date), p.note ? `“${p.note}”` : ''].filter(Boolean).map((c) => `<span class="pill">${esc(c)}</span>`).join('') : qin.value.trim() ? '<span class="pill">Start with an amount</span>' : '';
      });
      qa.addEventListener('submit', (e) => { e.preventDefault(); if (O.quickMoney(qin.value)) { qin.value = ''; chips.innerHTML = ''; mem.month = M.monthKey(); } });
      root.addEventListener('change', (e) => { if (e.target.id === 'catf') { mem.cat = e.target.value; draw(); } });
      root.addEventListener('click', (e) => {
        const m = e.target.closest('[data-m]'); if (m) { mem.month = shiftMonth(mem.month, +m.dataset.m); draw(); return; }
        if (e.target.closest('[data-budgets]')) { O.budgetDialog(); return; }
        if (e.target.closest('[data-sub-new]')) { O.subDialog(); return; }
        const sb = e.target.closest('[data-sub]'); if (sb) { O.subDialog(sb.dataset.sub); return; }
        const tx = e.target.closest('[data-tx]'); if (tx) { O.txDialog(tx.dataset.tx); return; }
        if (e.target.closest('[data-more]')) { mem.more += 25; draw(); }
      });
      return { refresh: draw };
    },
  };
})();
