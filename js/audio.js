'use strict';
// ================= 声音（Web Audio 程序化合成，无素材文件）=================
// 真实比赛的节奏：回合中全场安静；分与分之间观众低声交谈；得分后鼓掌，掌声大小看这一分有多精彩
const Sfx = (() => {
  let ac = null, master = null, sfx = null, crowdBus = null, noiseBuf = null, clapBuf = null, babbleBuf = null, murmur = null;
  const CROWD_VOL = [0, .45, .8, 1.15];      // 设置：关 / 低 / 中 / 高
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
      master = ac.createGain(); master.gain.value = SAVE.settings.sound ? .9 : 0;
      master.connect(comp); comp.connect(ac.destination);
      sfx = ac.createGain(); sfx.connect(master);
      crowdBus = ac.createGain(); crowdBus.gain.value = CROWD_VOL[SAVE.settings.crowd ?? 1]; crowdBus.connect(master);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      clapBuf = makeApplause(3.2); babbleBuf = makeBabble(6);
      // 观众交谈声循环（默认静音，按比赛节奏淡入淡出）
      const src = ac.createBufferSource(), lp = ac.createBiquadFilter(); murmur = ac.createGain();
      src.buffer = babbleBuf; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 1100; murmur.gain.value = 0;
      src.connect(lp); lp.connect(murmur); murmur.connect(crowdBus); src.start();
    } catch (e) { ac = null }
  }
  // 二阶带通（逐样本），用来给每一下拍手单独"上色"
  function bandpass(x, f0, q, sr) {
    const w = 2 * Math.PI * f0 / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const b0 = al / a0, b2 = -al / a0, a1 = -2 * Math.cos(w) / a0, a2 = (1 - al) / a0;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const y = b0 * x[i] + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y }
    return x;
  }
  // 掌声：几百个人各自拍手，每下 10–25ms，音色各不相同，左右声道分开
  function makeApplause(sec) {
    const sr = ac.sampleRate, buf = ac.createBuffer(2, sr * sec, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let n = 0; n < 700; n++) {
        const t = Math.random() < .8 ? Math.pow(Math.random(), 1.4) * sec * .8 : Math.random() * sec * .95;
        const env = Math.min(1, t / .15) * Math.pow(1 - t / sec, 1.6);
        const len = Math.floor(sr * rnd(.01, .025)), clap = new Float32Array(len);
        for (let i = 0; i < len; i++) clap[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * .22));
        bandpass(clap, rnd(900, 2600), rnd(1.2, 2.5), sr);
        const start = Math.floor(t * sr), amp = rnd(.25, 1) * env;
        for (let i = 0; i < len && start + i < d.length; i++) d[start + i] += clap[i] * amp;
      }
      let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      for (let i = 0; i < d.length; i++) d[i] *= .5 / (peak || 1);
    }
    return buf;
  }
  // 交谈声：十几个"人声"——低通噪声 + 共振峰，按音节节奏起伏
  function makeBabble(sec) {
    const sr = ac.sampleRate, n = sr * sec, buf = ac.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let v = 0; v < 14; v++) {
        const voice = new Float32Array(n); let lp = 0;
        for (let i = 0; i < n; i++) { lp += .08 * ((Math.random() * 2 - 1) - lp); voice[i] = lp }
        bandpass(voice, rnd(280, 700), 2.2, sr);
        const syl = rnd(3, 5.5), ph = Math.random() * 6, gap = rnd(.3, .9);
        for (let i = 0; i < n; i++) {
          const t = i / sr, s = Math.max(0, Math.sin(2 * Math.PI * syl * t + ph)), talk = Math.sin(2 * Math.PI * t / sec * Math.round(rnd(1, 3)) + ph) > -gap ? 1 : .15;
          d[i] += voice[i] * s * s * talk;
        }
      }
      let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
      for (let i = 0; i < n; i++) d[i] *= .6 / (peak || 1);
      const fade = sr * .2; for (let i = 0; i < fade; i++) { const k = i / fade; d[i] *= k; d[n - 1 - i] *= k }   // 循环处不爆音
    }
    return buf;
  }
  const on = () => ac && SAVE.settings.sound;
  function setEnabled(v) { if (master) master.gain.value = v ? .9 : 0 }
  function setCrowdVolume(i) { if (crowdBus) crowdBus.gain.setTargetAtTime(CROWD_VOL[i], ac.currentTime, .1) }
  function noise(dur, freq, vol, q = 1.5, type = 'bandpass', delay = 0, bus = sfx) {
    const t = ac.currentTime + delay, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur);
  }
  function tone(f0, f1, dur, vol, type = 'sine', delay = 0, bus = sfx) {
    const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur);
  }
  function applause(vol) {
    const t = ac.currentTime, s = ac.createBufferSource(), g = ac.createGain();
    s.buffer = clapBuf; s.playbackRate.value = rnd(.92, 1.06);
    g.gain.value = vol; s.connect(g); g.connect(crowdBus); s.start(t);
  }
  // 观众惊叹"哦——"：交谈声一起抬高再落下
  function ooh(vol) {
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = babbleBuf; s.playbackRate.setValueAtTime(1.15, t); s.playbackRate.linearRampToValueAtTime(.85, t + 1.1);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(.001, t); g.gain.linearRampToValueAtTime(vol, t + .18); g.gain.exponentialRampToValueAtTime(.001, t + 1.3);
    s.connect(f); f.connect(g); g.connect(crowdBus); s.start(t, Math.random() * 4); s.stop(t + 1.4);
  }
  function setMurmur(level, tc = .6) { if (murmur) murmur.gain.setTargetAtTime(level, ac.currentTime, tc) }
  // 裁判 / 司线员语音（排队播报，不互相打断）
  function speak(text, opts = {}) {
    if (!SAVE.settings.voice || !window.speechSynthesis) return;
    try {
      if (opts.cut) speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'en-GB'; u.rate = opts.rate || 1; u.pitch = opts.pitch || .9; u.volume = .85;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  // 关键分：全场屏息 + 轻微心跳
  let beat = null;
  function tension(v) {
    if (!ac) return;
    clearInterval(beat); beat = null;
    if (v) setMurmur(0, .3);
    if (v && SAVE.settings.sound) beat = setInterval(() => { tone(60, 46, .14, .22); tone(56, 42, .12, .16, 'sine', .18) }, 950);
  }
  function whoosh() { noise(.45, 900, .22, .6, 'bandpass'); tone(300, 1300, .35, .05, 'sawtooth') }
  function ui() { if (on()) tone(900, 700, .05, .06, 'triangle') }
  function coin() { if (on()) { tone(1200, 1200, .08, .07, 'square'); tone(1600, 1600, .12, .06, 'square', .07) } }
  // 网球击球声：短促的"啵"——毡面击打（带通噪声）+ 球体共振（衰减正弦）；远处的对手更闷更小
  function hitSound(e) {
    const p = clamp(e.kmh / 150, .35, 1.25), far = e.side === 1, vol = (far ? .45 : 1) * (.45 + .35 * p);
    noise(.03, far ? 1000 : 1350 + p * 300, vol * .9, 3.5);
    tone(far ? 520 : 650 + p * 120, far ? 380 : 450, .045, vol * .55);
    noise(.06, 220, vol * .25, 1, 'lowpass');
    if (e.q === 'perfect') tone(2600, 2500, .09, .05, 'sine', .005);   // 甜区：清脆的弦音
  }
  function bounceSound(e, surf) {
    const far = e.y < 0, v = far ? .45 : 1;
    if (surf === 'clay') { noise(.05, 520, .2 * v, 1.5); tone(150, 110, .05, .12 * v) }
    else if (surf === 'grass') { noise(.04, 420, .1 * v, 1.2); tone(130, 100, .04, .08 * v) }
    else { noise(.035, 900, .22 * v, 2); tone(190, 140, .045, .14 * v) }
  }
  function squeak() { if (on() && Scene3D.arena && (Scene3D.arena.id === 'city' || Scene3D.arena.id === 'night')) tone(rnd(1500, 2100), rnd(2200, 2800), .07, .05, 'sine') }
  let lastPointT = 0;
  function onEvent(type, e) {
    if (!on()) return;
    const surf = Scene3D.arena ? Scene3D.arena.id : 'city';
    if (type === 'hit') { hitSound(e); if (e.kind === 'serve') setMurmur(.0, .25) }            // 发球出手：全场安静
    else if (type === 'bounce') bounceSound(e, surf);
    else if (type === 'dribble') bounceSound({ y: e.side === 0 ? 1 : -1 }, surf);
    else if (type === 'hawk') { tone(880, 880, .06, .05, 'square'); tone(e.ok ? 1320 : 440, e.ok ? 1320 : 330, .18, .06, 'square', .08) }
    else if (type === 'net') { noise(.12, 260, .25, .8, 'lowpass'); ooh(.35) }
    else if (type === 'cord') { noise(.05, 480, .2); ooh(.45) }
    else if (type === 'close') ooh(.5);
    else if (type === 'point') {
      if (e.train) return;
      // 掌声大小：你的精彩球 > 普通得分 > 对手得分（礼貌性鼓掌）
      const great = e.why === 'ace' || e.rally >= 8 || e.big, mine = e.w === 0;
      applause(mine ? (great ? .85 : .55) : (great ? .4 : .22));
      if (e.why === 'out' || e.why === 'net') ooh(.25);
      lastPointT = ac.currentTime;
      setTimeout(() => { if (ac.currentTime - lastPointT > 1.5) setMurmur(.22, 1) }, 1800);  // 掌声过后恢复交谈
    }
    else if (type === 'pointStart') setMurmur(.12, .8);                                          // 准备发球：交谈声渐弱
    else if (type === 'game') applause(e.w === 0 ? 1 : .5);
    else if (type === 'matchOver') { tension(false); applause(1.2); setMurmur(.25, 1.5); if (e.w === 0) [523, 659, 784, 1047].forEach((f, i) => tone(f, f, .25, .08, 'triangle', i * .12)) }
    else if (type === 'skill') tone(400, 1200, .3, .06, 'sawtooth');
    else if (type === 'ult') { whoosh(); ooh(.4) }
    else if (type === 'call') speak(e.text);
    else if (type === 'fault') speak(e.call, { pitch: 1.2, rate: 1.1 });
    else if (type === 'linecall') speak(e.text, { pitch: 1.25, rate: 1.15 });
    else if (type === 'matchStart') { setMurmur(.3, .5); applause(.6) }
  }
  function enterMenu() { if (ac) { tension(false); setMurmur(0, .4) } }
  return { init, onEvent, setEnabled, setCrowdVolume, ui, coin, speak, tension, squeak, enterMenu, applause: v => on() && applause(v) };
})();
