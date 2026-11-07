/* Orbit — motion: confetti, number count-ups and bars that grow in. All of it switches off with the
   Motion setting or the system's reduce-motion preference. */
(function () {
  'use strict';
  const calm = () => O.store.state.settings.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fx = (O.fx = {});

  /* ------------------------------------------------------------ confetti */
  let canvas, ctx, parts = [], raf = 0;
  function ensure() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.className = 'fx-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    const size = () => { const d = devicePixelRatio || 1; canvas.width = innerWidth * d; canvas.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
    size(); addEventListener('resize', size);
  }
  const palette = () => {
    const css = getComputedStyle(document.documentElement);
    return [css.getPropertyValue('--accent').trim(), '#f2b544', '#e86a6a', '#5b9cf5', '#7cc576', '#f08bc2'];
  };
  fx.confetti = ({ x = innerWidth / 2, y = innerHeight * 0.35, count = 120, spread = 1 } = {}) => {
    if (calm()) return;
    ensure();
    const cols = palette();
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3 * spread, v = 6 + Math.random() * 9;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, w: 5 + Math.random() * 6, h: 3 + Math.random() * 5, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length], life: 0, max: 110 + Math.random() * 60, round: Math.random() < 0.3 });
    }
    if (!raf) raf = requestAnimationFrame(step);
  };
  /* a small pop where you clicked, for ticking things off */
  fx.burst = (el, count = 14) => {
    if (calm() || !el || !O.store.state.settings.celebrate) return;
    const r = el.getBoundingClientRect();
    fx.confetti({ x: r.left + r.width / 2, y: r.top + r.height / 2, count, spread: 1.6 });
  };
  function step() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter((p) => p.life < p.max && p.y < innerHeight + 40);
    for (const p of parts) {
      p.life++; p.vy += 0.28; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - p.life / p.max); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
      if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    raf = parts.length ? requestAnimationFrame(step) : 0;
    if (!raf) ctx.clearRect(0, 0, innerWidth, innerHeight);
  }

  /* --------------------------------------------------------- count-ups */
  /* numbers marked data-count="123" count up from the last value shown for the same data-key */
  const last = new Map();
  fx.counts = (root) => {
    root.querySelectorAll('[data-count]').forEach((el) => {
      const to = parseFloat(el.dataset.count), key = el.dataset.key || null;
      const from = key && last.has(key) ? last.get(key) : 0;
      if (key) last.set(key, to);
      if (calm() || from === to || !Number.isFinite(to)) { el.textContent = fmt(el, to); return; }
      const t0 = performance.now(), dur = Math.min(900, 300 + Math.abs(to - from) * 8);
      const tick = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(el, from + (to - from) * e); if (k < 1) requestAnimationFrame(tick); };
      el.textContent = fmt(el, from);
      requestAnimationFrame(tick);
    });
  };
  const fmt = (el, v) => (el.dataset.dec ? v.toFixed(+el.dataset.dec) : Math.round(v).toLocaleString());

  /* ------------------------------------------------------- grow-ins */
  /* bars and rings marked data-grow start empty and fill to their value, the first time a screen opens */
  fx.grow = (root, animate = true) => {
    const els = root.querySelectorAll('[data-grow]');
    if (calm() || !animate) { els.forEach(apply); return; }
    els.forEach((el) => { if (el.dataset.grown) { apply(el); return; } el.style.transition = 'none'; zero(el); });
    requestAnimationFrame(() => requestAnimationFrame(() => els.forEach((el) => { el.style.transition = ''; apply(el); el.dataset.grown = '1'; })));
  };
  const zero = (el) => { if (el.tagName === 'circle') el.style.strokeDashoffset = el.dataset.len; else el.style.width = '0%'; };
  const apply = (el) => { if (el.tagName === 'circle') el.style.strokeDashoffset = el.dataset.grow; else el.style.width = el.dataset.grow; };

  /* a ring as an SVG string: value 0–1, with a track; it grows in through fx.grow */
  fx.ring = (value, { size = 120, stroke = 9, cls = '' } = {}) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(1, value)));
    return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" class="ring-track" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" class="ring-fill" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" style="stroke-dashoffset:${off.toFixed(2)}" data-grow="${off.toFixed(2)}" data-len="${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  };
  fx.calm = calm;
})();
