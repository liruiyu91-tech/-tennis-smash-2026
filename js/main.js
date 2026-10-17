'use strict';
// ================= 启动与主循环 =================
(() => {
  // 出错时把错误直接显示在屏幕上，方便手机上截图反馈
  const showErr = msg => { let e = document.getElementById('err'); if (!e) { e = document.createElement('div'); e.id = 'err'; document.body.appendChild(e) } e.textContent += msg + '\n' };
  addEventListener('error', e => showErr('出错了：' + (e.message || e) + (e.filename ? ` (${e.filename.split('/').pop()}:${e.lineno})` : '')));
  addEventListener('unhandledrejection', e => showErr('出错了：' + (e.reason && e.reason.message || e.reason)));

  if (!window.THREE) { showErr('3D 引擎没有加载成功（lib/three.min.js），请刷新重试。'); return }
  try { Scene3D.init(document.getElementById('gl'), SAVE.settings.hq) }
  catch (e) { showErr('你的浏览器无法启动 3D 画面（WebGL）。请更新系统或换用 Chrome / Safari 打开。\n' + e.message); return }

  onGame((t, e) => { Scene3D.onEvent(t, e); Sfx.onEvent(t, e); UI.onEvent(t, e) });
  Scene3D.buildArena(ARENAS[0]);
  Scene3D.setPlayerLook(playerLook(), myChar().bh);
  UI.resizeOverlay(); UI.show('home');
  addEventListener('resize', () => { UI.resizeOverlay(); UI.layoutSafe() });
  document.addEventListener('visibilitychange', () => { if (document.hidden && M && phase !== 'over' && !paused) document.getElementById('pauseBtn').click() });

  // 物理固定 120Hz，屏幕刷新率不一定整除（60/90/120Hz、掉帧），
  // 画面按两次物理步之间的插值位置绘制，否则球和人会一顿一顿地跳
  const objs = () => [ball, P, A], prev = [{}, {}, {}], KEYS = ['x', 'y', 'z'];
  const snap = () => objs().forEach((o, i) => { for (const k of KEYS) prev[i][k] = o[k] });
  // 帧率面板（设置里打开）：每 0.5 秒显示帧率、最慢一帧、掉帧次数、渲染倍率和阴影
  let fpsEl = null, fpsN = 0, fpsT = 0, fpsMax = 0, fpsDrop = 0;
  function fpsMeter(ms) {
    if (!SAVE.settings.fps) { if (fpsEl) { fpsEl.remove(); fpsEl = null } return }
    if (!fpsEl) { fpsEl = document.createElement('div'); fpsEl.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top) + 2px);z-index:98;pointer-events:none;background:rgba(0,0,0,.6);color:#d7f94a;font:700 11px/1.3 monospace;padding:2px 8px;border-radius:6px;white-space:nowrap'; document.body.appendChild(fpsEl) }
    if (!(ms > 0) || ms > 1000) return;
    fpsN++; fpsT += ms; fpsMax = Math.max(fpsMax, ms); if (ms > 25) fpsDrop++;
    if (fpsT < 500) return;
    const R = Scene3D._renderer;
    fpsEl.textContent = `${Math.round(fpsN * 1000 / fpsT)} fps · 最慢 ${Math.round(fpsMax)}ms · 掉帧 ${fpsDrop} · ${R.getPixelRatio()}x · 阴影${R.shadowMap.enabled ? '开' : '关'}`;
    fpsN = fpsT = fpsMax = fpsDrop = 0;
  }
  let last = 0, acc = 0;
  function frame(t) {
    const raw = t - last, rdt = Math.min(.05, raw / 1000 || 0); last = t;
    let alpha = 1;
    if (M && !paused && !UI.blocking) {
      if (hitStop > 0) hitStop -= rdt;
      else { acc += rdt; while (acc >= DT) { snap(); tick(DT); acc -= DT } }
      alpha = acc / DT;
    }
    const cur = M && alpha < 1 ? objs().map((o, i) => {
      const c = {}; for (const k of KEYS) c[k] = o[k];
      const p = prev[i];
      if (p.x !== undefined && Math.abs(c.x - p.x) + Math.abs(c.y - p.y) < 2) for (const k of KEYS) if (typeof c[k] === 'number') o[k] = p[k] + (c[k] - p[k]) * alpha;
      return c;
    }) : null;
    Scene3D.update(rdt); Scene3D.render();
    if (cur) objs().forEach((o, i) => Object.assign(o, cur[i]));
    UI.frame(rdt); Scene3D.perf(raw); fpsMeter(raw);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  // 离线缓存（需要 https 或本机）
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})();
