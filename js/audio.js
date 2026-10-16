'use strict';
// ================= 声音（Web Audio 程序化合成，无素材文件）=================
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null, clapBuf = null, crowdGain = null;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain(); master.gain.value = SAVE.settings.sound ? 1 : 0; master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      clapBuf = makeApplause(3);
      // 观众背景人声：低通噪声循环
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(); crowdGain = ac.createGain();
      src.buffer = noiseBuf; src.loop = true; f.type = 'lowpass'; f.frequency.value = 520; crowdGain.gain.value = 0;
      src.connect(f); f.connect(crowdGain); crowdGain.connect(master); src.start();
    } catch (e) { ac = null }
  }
  function makeApplause(sec) {
    const sr = ac.sampleRate, buf = ac.createBuffer(1, sr * sec, sr), d = buf.getChannelData(0);
    for (let n = 0; n < 900; n++) {
      const t = Math.pow(Math.random(), 1.6) * sec * .85, start = Math.floor(t * sr), len = Math.floor(sr * .012), amp = (.3 + Math.random() * .7) * (1 - t / sec);
      for (let i = 0; i < len && start + i < d.length; i++) d[start + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (len * .25));
    }
    for (let i = 0; i < d.length; i++) d[i] *= .35;
    return buf;
  }
  const on = () => ac && SAVE.settings.sound;
  function setEnabled(v) { if (master) master.gain.value = v ? 1 : 0 }
  function noise(dur, freq, vol, q = 1.5, type = 'bandpass', delay = 0) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + dur);
  }
  function tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
  }
  function applause(vol) {
    const t = ac.currentTime, s = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
    s.buffer = clapBuf; f.type = 'highpass'; f.frequency.value = 700; g.gain.value = vol;
    s.playbackRate.value = .9 + Math.random() * .2;
    s.connect(f); f.connect(g); g.connect(master); s.start(t);
  }
  function ooh(vol) {
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'bandpass'; f.Q.value = 3; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(260, t + 1);
    g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(vol, t + .25); g.gain.exponentialRampToValueAtTime(.001, t + 1.2);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + 1.3);
  }
  function speak(text) {
    if (!SAVE.settings.voice || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = 1.0; u.pitch = .9; u.volume = .9; speechSynthesis.speak(u) } catch (e) {}
  }
  // 关键分：观众安静 + 心跳声
  let beat = null;
  function tension(on) {
    if (!ac) return;
    clearInterval(beat); beat = null;
    setCrowd(on ? .006 : .035);
    if (on && SAVE.settings.sound) beat = setInterval(() => { tone(62, 48, .14, .45); tone(58, 44, .12, .35, 'sine', .18) }, 900);
  }
  function whoosh() { noise(.5, 900, .35, .6, 'bandpass'); tone(300, 1400, .4, .1, 'sawtooth') }
  function setCrowd(level) { if (crowdGain) crowdGain.gain.setTargetAtTime(level, ac.currentTime, .5) }
  function ui() { if (on()) tone(900, 700, .05, .08, 'triangle') }
  function coin() { if (on()) { tone(1200, 1200, .08, .1, 'square'); tone(1600, 1600, .12, .08, 'square', .07) } }
  function onEvent(type, e) {
    if (!on()) return;
    const surf = Scene3D.arena ? Scene3D.arena.id : 'city';
    if (type === 'hit') {
      const p = clamp(e.kmh / 160, .3, 1.2);
      noise(.05, 2200 + p * 800, .35 + p * .35); tone(220 + p * 90, 110, .08, .25 + p * .15);
      if (e.q === 'perfect') tone(2400, 2300, .12, .07, 'sine', .01);
    } else if (type === 'bounce') noise(.05, surf === 'clay' ? 600 : surf === 'grass' ? 500 : 950, surf === 'grass' ? .12 : .2);
    else if (type === 'net') { noise(.12, 300, .3, .8, 'lowpass'); ooh(.25) }
    else if (type === 'cord') { noise(.06, 500, .25); ooh(.3) }
    else if (type === 'point') { if (!e.train) { applause(e.w === 0 ? .9 : .4); if (e.why === 'out' || e.why === 'net') ooh(.18) } }
    else if (type === 'game') applause(1);
    else if (type === 'matchOver') { tension(false); applause(1.2); if (e.w === 0) [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .25, .12, 'triangle', i * .12)) }
    else if (type === 'skill') tone(400, 1200, .35, .12, 'sawtooth');
    else if (type === 'ult') { whoosh(); ooh(.35) }
    else if (type === 'call') speak(e.text);
    else if (type === 'fault') speak(e.call);
    else if (type === 'matchStart') setCrowd(.035);
  }
  return { init, onEvent, setEnabled, setCrowd, ui, coin, speak, tension, applause: v => on() && applause(v) };
})();
