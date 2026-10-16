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
  Scene3D.setPlayerLook(playerLook());
  UI.resizeOverlay(); UI.show('home');
  addEventListener('resize', () => { UI.resizeOverlay(); UI.layoutSafe() });
  document.addEventListener('visibilitychange', () => { if (document.hidden && M && phase !== 'over' && !paused) document.getElementById('pauseBtn').click() });

  let last = 0, acc = 0;
  function frame(t) {
    const rdt = Math.min(.05, (t - last) / 1000 || 0); last = t;
    if (M && !paused) {
      if (hitStop > 0) hitStop -= rdt;
      else { acc += rdt; while (acc >= DT) { tick(DT); acc -= DT } }
    }
    Scene3D.update(rdt); Scene3D.render(); UI.frame(rdt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
