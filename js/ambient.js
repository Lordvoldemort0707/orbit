/* Orbit — focus sounds, made live in the browser from noise (no audio files to download).
   Rain, Brown noise, Waves and Café hum; they can follow the focus timer on their own. */
(function () {
  'use strict';
  const A = (O.ambient = {});
  A.KINDS = { rain: 'Rain', brown: 'Brown noise', waves: 'Waves', cafe: 'Café hum', white: 'White noise' };
  let ctx = null, nodes = null, playing = null;
  const cfg = () => O.store.state.settings;

  function noise(kind, seconds = 4) {
    const len = ctx.sampleRate * seconds, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.35;
        else if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
        else { // pink, Paul Kellet's filter
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.09; b6 = w * 0.115926;
        }
      }
    }
    return buf;
  }
  function build(kind) {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    const src = ctx.createBufferSource();
    src.buffer = noise(kind === 'brown' || kind === 'waves' ? 'brown' : kind === 'white' ? 'white' : 'pink');
    src.loop = true;
    let chain = src;
    const extra = [];
    if (kind === 'rain') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
      src.connect(hp).connect(lp); chain = lp;
    } else if (kind === 'cafe') {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
      src.connect(bp); chain = bp;
      // a slow murmur: the level drifts like a room of voices
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.21; lg.gain.value = 0.25;
      const g = ctx.createGain(); g.gain.value = 0.85; lfo.connect(lg).connect(g.gain); lfo.start(); chain.connect(g); chain = g; extra.push(lfo);
    } else if (kind === 'waves') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      src.connect(lp);
      const g = ctx.createGain(); g.gain.value = 0.55;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 0.45;
      lfo.connect(lg).connect(g.gain); lfo.start(); lp.connect(g); chain = g; extra.push(lfo);
    }
    chain.connect(master);
    src.start();
    return { master, src, extra };
  }
  A.play = (kind = cfg().ambient) => {
    if (!kind || kind === 'off') { A.stop(); return; }
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      if (playing === kind && nodes) { A.volume(); return; }
      A.stop(true);
      nodes = build(kind); playing = kind;
      nodes.master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.4);
    } catch (_) {}
    A.emit();
  };
  A.stop = (instant = false) => {
    if (!nodes) { playing = null; return; }
    const n = nodes; nodes = null; playing = null;
    try {
      n.master.gain.setTargetAtTime(0, ctx.currentTime, instant ? 0.02 : 0.3);
      setTimeout(() => { try { n.src.stop(); n.extra.forEach((o) => o.stop()); n.master.disconnect(); } catch (_) {} }, instant ? 80 : 1200);
    } catch (_) {}
    A.emit();
  };
  const vol = () => Math.max(0, Math.min(1, cfg().ambientVol ?? 0.5)) * 0.9;
  A.volume = () => { if (nodes && ctx) nodes.master.gain.setTargetAtTime(vol(), ctx.currentTime, 0.1); };
  A.playing = () => playing;
  const ls = new Set();
  A.on = (fn) => { ls.add(fn); return () => ls.delete(fn); };
  A.emit = () => ls.forEach((fn) => fn(playing));

  /* follow the timer: sound during focus, quiet on breaks and when paused */
  let lastKey = '';
  A.follow = () => {
    const s = cfg(); if (!s.ambientAuto || s.ambient === 'off') return;
    const t = O.timer, key = t.status() + t.mode();
    if (key === lastKey) return; lastKey = key;
    if (t.status() === 'running' && t.mode() === 'focus') A.play(s.ambient); else if (playing) A.stop();
  };
})();
