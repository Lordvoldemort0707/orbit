/* Orbit — Notes. Plain text with a little Markdown: headings, lists, checklists, bold, links and #tags.
   Everything saves as you type. */
(function () {
  'use strict';
  const { u: U } = O;
  const esc = U.esc;
  const mem = { id: null, q: '', tag: null, preview: false };

  /* ------------------------------------------------------- markdown-lite */
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>')
    .replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, '$1<span class="tag">#$2</span>');
  O.md = (src) => {
    const lines = String(src || '').split('\n');
    let html = '', list = null, para = [];
    const endPara = () => { if (para.length) { html += `<p>${para.map(inline).join('<br>')}</p>`; para = []; } };
    const endList = () => { if (list) { html += '</ul>'; list = null; } };
    lines.forEach((line, i) => {
      let m;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) { endPara(); endList(); const n = m[1].length; html += `<h${n}>${inline(m[2])}</h${n}>`; }
      else if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { endPara(); if (!list) { html += '<ul>'; list = true; } const done = m[1] !== ' '; html += `<li class="task ${done ? 'done' : ''}"><button type="button" class="check" role="checkbox" aria-checked="${done}" data-line="${i}" aria-label="Toggle item">${O.icon('check')}</button><span>${inline(m[2])}</span></li>`; }
      else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) { endPara(); if (!list) { html += '<ul>'; list = true; } html += `<li>${inline(m[1])}</li>`; }
      else if (!line.trim()) { endPara(); endList(); }
      else { endList(); para.push(line); }
    });
    endPara(); endList();
    return html;
  };
  O.notePreview = (body) => String(body || '').replace(/^#+\s*/gm, '').replace(/^\s*[-*]\s+(\[[ xX]\]\s+)?/gm, '').replace(/[*`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const tagsOf = (n) => Array.from(new Set((String(n.body || '').match(/(^|\s)#([\p{L}\p{N}_-]+)/gu) || []).map((t) => t.trim().slice(1).toLowerCase())));

  O.views.notes = {
    title: 'Notes',
    mount(root, params) {
      const st = () => O.store.state;
      if (params.arg === 'new') {
        const n = { id: U.uid(), title: '', body: '', pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
        O.store.update((s) => { s.notes.unshift(n); }, { silent: true });
        mem.id = n.id; mem.preview = false;
        history.replaceState(null, '', '#/notes/' + n.id);
        setTimeout(() => { const t = root.querySelector('#ntitle'); t && t.focus(); }, 30);
      } else if (params.arg && st().notes.some((n) => n.id === params.arg)) { mem.id = params.arg; mem.preview = true; }
      else if (!st().notes.some((n) => n.id === mem.id)) { mem.id = U.isPhone() ? null : (sorted()[0] || {}).id || null; mem.preview = true; }

      root.innerHTML = `
        <header class="title-row"><div><h1>Notes</h1><p class="sub" id="sub"></p></div>
          <div class="actions"><a class="btn primary" href="#/notes/new">${O.icon('plus')}New note</a></div></header>
        <div class="notes-layout" id="layout">
          <section class="panel note-side" aria-label="All notes">
            <label class="search-field" style="width:100%;margin-bottom:12px">${O.icon('search', 14)}<span class="visually-hidden">Search notes</span><input class="input" id="nq" type="search" placeholder="Search notes" value="${esc(mem.q)}"></label>
            <div class="tagbar" id="tags"></div>
            <div class="note-list" id="list"></div>
          </section>
          <section class="panel white editor" id="editor" aria-label="Note"></section>
        </div>`;
      const $ = (id) => root.querySelector('#' + id);
      function sorted() { return st().notes.slice().sort((a, b) => (b.pinned - a.pinned) || b.updatedAt - a.updatedAt); }
      const cur = () => st().notes.find((n) => n.id === mem.id);

      function list() {
        const q = mem.q.trim().toLowerCase();
        const all = sorted();
        const tags = Array.from(new Set(all.flatMap(tagsOf))).sort();
        if (mem.tag && !tags.includes(mem.tag)) mem.tag = null;
        $('sub').textContent = all.length ? `${U.plural(all.length, 'note')}${all.some((n) => n.pinned) ? `, ${all.filter((n) => n.pinned).length} pinned` : ''} · saved as you type` : 'Ideas, lists, cheat sheets. Notes save as you type.';
        $('tags').innerHTML = tags.length ? tags.map((t) => `<button type="button" class="fchip" data-tag="${esc(t)}" aria-pressed="${mem.tag === t}">#${esc(t)}</button>`).join('') : '';
        const rows = all.filter((n) => (!mem.tag || tagsOf(n).includes(mem.tag)) && (!q || (n.title + ' ' + n.body).toLowerCase().includes(q)));
        O.fill($('list'), rows.length ? rows.map((n) => `<button type="button" class="note-item" data-note="${n.id}" aria-current="${n.id === mem.id}">
            <span class="t">${n.pinned ? O.icon('pin') : ''}<span>${esc(n.title || 'Untitled note')}</span></span>
            <span class="p">${esc(O.notePreview(n.body) || 'Empty note')}</span>
            <span class="m">${esc(U.relDay(U.keyOf(n.updatedAt)))}, ${U.timeOf(n.updatedAt)}</span></button>`).join('')
          : `<div class="empty">${all.length ? 'No notes match.' : 'No notes yet.'}</div>`);
      }
      function editor() {
        const n = cur();
        $('layout').classList.toggle('editing', !!n);
        if (!n) { $('editor').innerHTML = `<div class="empty" style="min-height:240px">Pick a note on the left, or start a new one.<a class="btn sm" href="#/notes/new">${O.icon('plus')}New note</a></div>`; return; }
        $('editor').innerHTML = `
          <div class="editor-tools">
            <button type="button" class="icon-btn phone-back" data-back aria-label="Back to all notes">${O.icon('back', 18)}</button>
            <span class="saved-stamp" id="stamp">Edited ${esc(U.relDayInline(U.keyOf(n.updatedAt)))}, ${U.timeOf(n.updatedAt)}</span>
            <button type="button" class="icon-btn" data-preview aria-pressed="${mem.preview}" aria-label="${mem.preview ? 'Edit' : 'Preview'}" title="${mem.preview ? 'Edit' : 'Preview'}">${O.icon(mem.preview ? 'edit' : 'eye', 18)}</button>
            <button type="button" class="icon-btn" data-pin aria-pressed="${!!n.pinned}" aria-label="${n.pinned ? 'Unpin' : 'Pin'}" title="${n.pinned ? 'Unpin' : 'Pin to Today'}">${O.icon('pin', 18)}</button>
            <button type="button" class="icon-btn" data-del aria-label="Delete note" title="Delete">${O.icon('trash', 18)}</button>
          </div>
          <input class="editor-title" id="ntitle" value="${esc(n.title)}" placeholder="Title" aria-label="Note title" maxlength="200">
          ${mem.preview ? `<div class="md" id="md">${O.md(n.body) || '<p class="muted">Nothing here yet.</p>'}</div>` : `<textarea class="editor-body" id="nbody" placeholder="Write anything. Use - for lists, - [ ] for checklists, # for headings and #tags to group notes." aria-label="Note text">${esc(n.body)}</textarea>`}`;
        grow();
      }
      function grow() { const ta = $('nbody'); if (ta) { ta.style.height = 'auto'; ta.style.height = Math.max(420, ta.scrollHeight + 4) + 'px'; } }
      const all = () => { list(); if (!$('editor').contains(document.activeElement) || !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) editor(); };
      list(); editor();

      const save = U.debounce(() => {
        const n = cur(); if (!n) return;
        const t = $('ntitle'), b = $('nbody');
        O.store.update(() => { if (t) n.title = t.value; if (b) n.body = b.value; n.updatedAt = Date.now(); delete n.sample; }, { silent: true });
        const s = $('stamp'); if (s) s.textContent = 'Saved ' + U.timeOf(n.updatedAt);
        list();
      }, 400);
      root.addEventListener('input', (e) => { if (e.target.id === 'ntitle' || e.target.id === 'nbody') { save(); if (e.target.id === 'nbody') grow(); } if (e.target.id === 'nq') { mem.q = e.target.value; list(); } });
      root.addEventListener('focusout', (e) => { if (e.target.id === 'ntitle' || e.target.id === 'nbody') save.flush(); });
      root.addEventListener('keydown', (e) => {
        if (e.target.id === 'ntitle' && e.key === 'Enter') { e.preventDefault(); const b = $('nbody'); if (b) b.focus(); }
        // continue a list on Enter
        if (e.target.id === 'nbody' && e.key === 'Enter' && !e.shiftKey) {
          const ta = e.target, pos = ta.selectionStart, before = ta.value.slice(0, pos), line = before.slice(before.lastIndexOf('\n') + 1);
          const m = line.match(/^(\s*[-*]\s+(\[[ xX]\]\s+)?)(.*)$/);
          if (m) {
            e.preventDefault();
            if (!m[3].trim()) { ta.value = before.slice(0, before.length - line.length) + ta.value.slice(pos); ta.selectionStart = ta.selectionEnd = pos - line.length; }
            else { const ins = '\n' + m[1].replace(/\[[xX]\]/, '[ ]'); ta.setRangeText(ins, pos, ta.selectionEnd, 'end'); }
            save(); grow();
          }
        }
      });
      root.addEventListener('click', async (e) => {
        const it = e.target.closest('[data-note]');
        if (it) { save.flush(); cleanup(); mem.id = it.dataset.note; mem.preview = true; history.replaceState(null, '', '#/notes/' + mem.id); list(); editor(); if (U.isPhone()) window.scrollTo(0, 0); return; }
        const tg = e.target.closest('[data-tag]'); if (tg) { mem.tag = mem.tag === tg.dataset.tag ? null : tg.dataset.tag; list(); return; }
        if (e.target.closest('[data-back]')) { save.flush(); cleanup(); mem.id = null; history.replaceState(null, '', '#/notes'); list(); editor(); return; }
        if (e.target.closest('[data-preview]')) { save.flush(); mem.preview = !mem.preview; editor(); if (!mem.preview) { const b = $('nbody'); b && b.focus(); } return; }
        if (e.target.closest('[data-pin]')) { const n = cur(); O.store.update(() => { n.pinned = !n.pinned; }); return; }
        // clicking the text of a note opens it for editing
        if (e.target.closest('#md') && !e.target.closest('a, [data-line]')) { mem.preview = false; editor(); const b = $('nbody'); if (b) { b.focus(); b.selectionStart = b.selectionEnd = b.value.length; } return; }
        const ln = e.target.closest('[data-line]');
        if (ln) { const n = cur(), lines = n.body.split('\n'), i = +ln.dataset.line; lines[i] = lines[i].replace(/\[( |x|X)\]/, (m, c) => (c === ' ' ? '[x]' : '[ ]')); O.store.update(() => { n.body = lines.join('\n'); n.updatedAt = Date.now(); }); return; }
        if (e.target.closest('[data-del]')) {
          const n = cur(), i = st().notes.indexOf(n);
          O.store.update((s) => { s.notes.splice(i, 1); });
          mem.id = U.isPhone() ? null : (sorted()[0] || {}).id || null;
          history.replaceState(null, '', mem.id ? '#/notes/' + mem.id : '#/notes');
          list(); editor();
          O.toast(`Deleted “${n.title || 'Untitled note'}”`, { action: 'Undo', onAction: () => { O.store.update((s) => { s.notes.splice(i, 0, n); }); mem.id = n.id; O.go('#/notes/' + n.id); } });
        }
      });
      /* a note left empty is not kept */
      function cleanup() { const n = cur(); if (n && !n.title.trim() && !n.body.trim()) O.store.update((s) => { s.notes = s.notes.filter((x) => x !== n); }, { silent: true }); }
      return { refresh: all, destroy() { save.flush(); cleanup(); } };
    },
  };
})();
