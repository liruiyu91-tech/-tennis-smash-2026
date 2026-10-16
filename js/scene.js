'use strict';
// ================= 3D 场景（three.js）=================
// 游戏坐标 (x, y, z) → three 坐标 (x, z, y)：three 的 Y 轴朝上
const Scene3D = (() => {
  const T = THREE;
  const W3 = (x, y, z = 0) => new T.Vector3(x, z, y);
  let renderer, scene, camera, sun, hemi, arenaGroup = null, arena = null;
  let W = 1, H = 1, hq = true, mode = 'menu', clock = 0, shake = 0, safe = { top: 0, bottom: 0, left: 0, right: 0 };
  let crowd = null, cheer = 0, gradMap, dotTex, ringTex;
  const fit = { pos: new T.Vector3(), look: new T.Vector3() };
  const camFollow = { x: 0 };
  const models = {};
  let ballMesh, ballShadow, trail = [], trailPts = [], timing, timingFill, aimMark, sparks = [], marks = [], rings = [];

  // ---------- 工具 ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c);
    if (repeat) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]) }
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }
  const lam = (color, extra) => new T.MeshLambertMaterial(Object.assign({ color }, extra || {}));
  const toon = color => new T.MeshToonMaterial({ color, gradientMap: gradMap });
  function mesh(geo, mat, cast = true, recv = false) { const m = new T.Mesh(geo, mat); m.castShadow = cast && hq; m.receiveShadow = recv; return m }
  function disposeTree(o) { o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) { [].concat(c.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose() }) } }) }

  // ---------- 初始化 ----------
  function init(canvas, quality) {
    hq = quality;
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(40, 1, .1, 400);
    hemi = new T.HemisphereLight(0xffffff, 0x445566, .75); scene.add(hemi);
    sun = new T.DirectionalLight(0xffffff, .85); scene.add(sun, sun.target);
    sun.castShadow = true;
    const sc = sun.shadow.camera; sc.left = -15; sc.right = 15; sc.top = 20; sc.bottom = -20; sc.near = 1; sc.far = 80;
    sun.shadow.bias = -.0006; sun.shadow.normalBias = .03;
    gradMap = new T.DataTexture(new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1, T.RGBAFormat);
    gradMap.minFilter = gradMap.magFilter = T.NearestFilter; gradMap.needsUpdate = true;
    dotTex = canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w) });
    ringTex = canvasTex(128, 128, g => { g.strokeStyle = '#fff'; g.lineWidth = 10; g.beginPath(); g.arc(64, 64, 56, 0, Math.PI * 2); g.stroke() });
    buildBall(); buildFx();
    models.P = makePlayer(playerLook()); models.A = makePlayer(QUICK_LOOK);
    scene.add(models.P.root, models.A.root);
    setQuality(quality);
  }
  function setQuality(q) {
    hq = q;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, hq ? 2 : 1.25));
    renderer.shadowMap.enabled = hq; sun.castShadow = hq;
    sun.shadow.mapSize.set(hq ? 2048 : 512, hq ? 2048 : 512);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null }
    scene.traverse(o => { if (o.isMesh && o.userData.cast !== false) o.castShadow = hq; if (o.material) [].concat(o.material).forEach(m => m.needsUpdate = true) });
    resize(W, H, safe);
  }

  // ---------- 球员模型（卡通风格，程序化骨骼）----------
  function cap(r, len, mat) { const g = new T.CapsuleGeometry(r, len, 4, 10); g.translate(0, -len / 2 - r * .3, 0); return mesh(g, mat) }
  function makePlayer(look) {
    const mats = { shirt: toon(look.shirt), shorts: toon(look.shorts), skin: toon(look.skin), hair: toon(look.hair || '#222'),
      shoe: toon('#f4f4f4'), band: toon(look.band || look.shirt), dark: toon('#1a1a1a'), racket: toon('#1d1f26'), frame: toon('#e8ff4f') };
    const root = new T.Group(), body = new T.Group(); root.add(body);
    const hips = new T.Group(); hips.position.y = .95; body.add(hips);
    const shorts = mesh(new T.CylinderGeometry(.165, .19, .27, 12), mats.shorts); shorts.position.y = -.04; hips.add(shorts);
    const legs = [];
    for (const s of [-1, 1]) {           // s=-1 右侧（模型面朝 +Z，右手在 -X）
      const thigh = new T.Group(); thigh.position.set(s * .1, -.1, 0); hips.add(thigh);
      thigh.add(cap(.078, .32, mats.skin));
      const knee = new T.Group(); knee.position.y = -.42; thigh.add(knee);
      knee.add(cap(.064, .3, mats.skin));
      const sock = mesh(new T.CylinderGeometry(.068, .066, .1, 10), mats.shoe); sock.position.y = -.33; knee.add(sock);
      const shoe = mesh(new T.BoxGeometry(.12, .085, .27), mats.shoe); shoe.position.set(0, -.41, .045); knee.add(shoe);
      const sole = mesh(new T.BoxGeometry(.125, .025, .28), mats.dark); sole.position.set(0, -.455, .045); knee.add(sole);
      legs.push({ thigh, knee });
    }
    const torso = new T.Group(); torso.position.y = .06; hips.add(torso);
    const chest = mesh(new T.CapsuleGeometry(.17, .3, 4, 12), mats.shirt); chest.position.y = .3; chest.scale.set(1.12, 1, .78); torso.add(chest);
    const neck = mesh(new T.CylinderGeometry(.05, .06, .1, 8), mats.skin); neck.position.y = .62; torso.add(neck);
    const head = new T.Group(); head.position.y = .76; torso.add(head);
    head.add(mesh(new T.SphereGeometry(.125, 16, 12), mats.skin));
    const hair = mesh(new T.SphereGeometry(.133, 16, 10, 0, Math.PI * 2, 0, Math.PI * .52), mats.hair); hair.rotation.x = -.25; hair.position.set(0, .012, -.012); head.add(hair);
    if (look.long) { const tail = cap(.05, .16, mats.hair); tail.position.set(0, .06, -.13); tail.rotation.x = .5; head.add(tail) }
    if (look.band) { const band = mesh(new T.TorusGeometry(.128, .018, 6, 20), mats.band); band.rotation.x = Math.PI / 2 - .25; band.position.y = .03; head.add(band) }
    for (const s of [-1, 1]) { const eye = mesh(new T.SphereGeometry(.016, 6, 6), mats.dark, false); eye.position.set(s * .045, .0, .114); head.add(eye) }
    const nose = mesh(new T.SphereGeometry(.018, 6, 6), mats.skin, false); nose.position.set(0, -.03, .125); head.add(nose);
    const arms = {};
    for (const s of [-1, 1]) {
      const sh = new T.Group(); sh.position.set(s * .24, .5, 0); torso.add(sh);
      const sleeve = mesh(new T.SphereGeometry(.075, 10, 8), mats.shirt); sleeve.scale.set(1, 1.15, 1); sleeve.position.y = -.04; sh.add(sleeve);
      sh.add(cap(.05, .22, mats.skin));
      const el = new T.Group(); el.position.y = -.3; sh.add(el);
      el.add(cap(.045, .2, mats.skin));
      const wristband = mesh(new T.CylinderGeometry(.052, .052, .05, 10), mats.band); wristband.position.y = -.22; el.add(wristband);
      const hand = mesh(new T.SphereGeometry(.055, 10, 8), mats.skin); hand.position.y = -.3; el.add(hand);
      arms[s < 0 ? 'r' : 'l'] = { sh, el };
    }
    // 球拍挂在右手
    const racket = new T.Group(); racket.position.y = -.3; arms.r.el.add(racket);
    const grip = mesh(new T.CylinderGeometry(.017, .02, .2, 8), mats.dark); grip.position.y = -.08; racket.add(grip);
    const throat = mesh(new T.CylinderGeometry(.012, .012, .12, 6), mats.racket); throat.position.y = -.22; racket.add(throat);
    const frame = mesh(new T.TorusGeometry(.125, .013, 6, 24), mats.frame); frame.scale.set(.82, 1.1, 1); frame.position.y = -.41; racket.add(frame);
    const strings = mesh(new T.CircleGeometry(.12, 20), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .32, side: T.DoubleSide, depthWrite: false }), false);
    strings.userData.cast = false; strings.scale.set(.82, 1.1, 1); strings.position.y = -.41; racket.add(strings);
    root.traverse(o => { if (o.isMesh) o.castShadow = hq });
    return { root, body, hips, torso, head, legs, arms, racket, mats, look,
      a: { sw: null, emote: null, phase: Math.random() * 6, spd: 0, px: 0, py: 0, pose: Object.assign({}, POSES.READY) } };
  }
  function setLook(m, look) {
    m.look = look;
    m.mats.shirt.color.set(look.shirt); m.mats.shorts.color.set(look.shorts); m.mats.skin.color.set(look.skin);
    m.mats.hair.color.set(look.hair || '#222'); m.mats.band.color.set(look.band || look.shirt);
  }
  function setPlayerLook(look) { setLook(models.P, look) }
  function setOpponentLook(look) {      // 长发/发带等结构差异需要重建模型
    scene.remove(models.A.root); disposeTree(models.A.root);
    models.A = makePlayer(look); scene.add(models.A.root);
  }

  // ---------- 动作姿态（弧度）----------
  const R0 = { crouch: .1, torsoX: .18, torsoY: 0, headX: -.1, rThigh: -.35, rKnee: .6, lThigh: -.35, lKnee: .6,
    rShX: -.75, rShY: 0, rShZ: -.15, rEl: -1.0, lShX: -.7, lShY: 0, lShZ: .15, lEl: -1.1, wrist: -.2, jump: 0 };
  const mk = o => Object.assign({}, R0, o);
  const POSES = {
    READY: R0,
    STAND: mk({ crouch: 0, torsoX: .02, headX: 0, rThigh: 0, rKnee: .05, lThigh: 0, lKnee: .05, rShX: -.35, rShZ: -.12, rEl: -.7, lShX: -.05, lShZ: .12, lEl: -.2, wrist: -.3 }),
    FH_BACK: mk({ crouch: .14, torsoY: -1.15, rShX: .2, rShZ: -1.0, rEl: -.7, lShX: -1.3, lShZ: .45, lEl: -.2, wrist: -.6 }),
    FH_HIT: mk({ crouch: .12, torsoY: -.05, rShX: -.65, rShZ: -1.25, rEl: -.25, lShX: -.6, lShZ: .7, lEl: -.6, wrist: -.1 }),
    FH_FOLLOW: mk({ torsoY: 1.0, rShX: -2.3, rShZ: -.3, rEl: -1.5, lShX: -.3, lShZ: .35, lEl: -1.3, wrist: .2 }),
    BH_BACK: mk({ crouch: .14, torsoY: 1.15, rShX: -.45, rShZ: .75, rEl: -.7, lShX: -.5, lShZ: .9, lEl: -.9, wrist: -.6 }),
    BH_HIT: mk({ crouch: .12, torsoY: .1, rShX: -.9, rShZ: .55, rEl: -.3, lShX: -.9, lShZ: 1.0, lEl: -.4, wrist: -.1 }),
    BH_FOLLOW: mk({ torsoY: -.9, rShX: -2.2, rShZ: .25, rEl: -1.2, lShX: -2.1, lShZ: .5, lEl: -1.3, wrist: .2 }),
    SM_BACK: mk({ crouch: .05, torsoY: -.7, torsoX: -.15, headX: -.5, rShX: -2.4, rShZ: -.5, rEl: -1.9, lShX: -2.9, lShZ: .15, lEl: -.1, wrist: .3 }),
    SM_HIT: mk({ crouch: 0, torsoY: -.1, torsoX: .15, headX: -.4, rShX: -3.0, rShZ: -.25, rEl: -.1, lShX: -1.0, lShZ: .4, lEl: -.5, wrist: 0, jump: .08 }),
    SM_FOLLOW: mk({ torsoY: .7, torsoX: .45, headX: .1, rShX: -.5, rShZ: .5, rEl: -.4, lShX: -.4, lShZ: .3, lEl: -.6, wrist: -.3 }),
    SERVE_STANCE: mk({ crouch: .02, torsoX: .05, torsoY: -.5, headX: 0, rShX: -.3, rShZ: -.3, rEl: -.5, lShX: -.6, lShZ: .1, lEl: -.3, wrist: -.4 }),
    SERVE_TOSS: mk({ crouch: .18, torsoX: -.1, torsoY: -.9, headX: -.6, rShX: .4, rShZ: -.9, rEl: -1.3, lShX: -3.0, lShZ: .2, lEl: 0, wrist: -.3, rKnee: 1.0, lKnee: 1.0, rThigh: -.45, lThigh: -.45 }),
    VO_BACK: mk({ torsoY: -.5, rShX: -.7, rShZ: -.9, rEl: -.8, wrist: -.4 }),
    VO_HIT: mk({ torsoY: 0, rShX: -1.2, rShZ: -.9, rEl: -.4, wrist: -.2 }),
    VB_BACK: mk({ torsoY: .5, rShX: -.9, rShZ: .4, rEl: -.9, wrist: -.4 }),
    VB_HIT: mk({ torsoY: 0, rShX: -1.3, rShZ: .3, rEl: -.4, wrist: -.2 }),
    CELEB: mk({ crouch: 0, torsoX: -.1, headX: -.3, rThigh: 0, rKnee: .1, lThigh: 0, lKnee: .1, rShX: -3.0, rShZ: -.35, rEl: -.2, lShX: -3.0, lShZ: .35, lEl: -.2, wrist: 0 }),
    FIST: mk({ crouch: .05, torsoX: .1, headX: -.1, rShX: -1.2, rShZ: -.2, rEl: -2.0, lShX: -.9, lShZ: .25, lEl: -2.2 }),
    SAD: mk({ crouch: .04, torsoX: .45, headX: .5, rThigh: 0, rKnee: .15, lThigh: 0, lKnee: .15, rShX: -.05, rShZ: -.1, rEl: -.2, lShX: .05, lShZ: .1, lEl: -.1, wrist: -.2 }),
  };
  const SWINGS = {
    fh: [[0, 'FH_BACK'], [.08, 'FH_HIT'], [.32, 'FH_FOLLOW'], [.75, 'READY']],
    bh: [[0, 'BH_BACK'], [.08, 'BH_HIT'], [.32, 'BH_FOLLOW'], [.75, 'READY']],
    sm: [[0, 'SM_BACK'], [.1, 'SM_HIT'], [.36, 'SM_FOLLOW'], [.8, 'READY']],
    vo: [[0, 'VO_BACK'], [.07, 'VO_HIT'], [.3, 'VO_HIT'], [.6, 'READY']],
    vb: [[0, 'VB_BACK'], [.07, 'VB_HIT'], [.3, 'VB_HIT'], [.6, 'READY']],
  };
  const BACK = { fh: 'FH_BACK', bh: 'BH_BACK', sm: 'SM_BACK', vo: 'VO_BACK', vb: 'VB_BACK' };
  const ease = t => t * t * (3 - 2 * t);
  function blend(out, a, b, t) { for (const k in R0) out[k] = a[k] + (b[k] - a[k]) * t; return out }
  function swingPose(kind, t, out) {
    const ks = SWINGS[kind];
    for (let i = 0; i < ks.length - 1; i++) {
      if (t <= ks[i + 1][0]) return blend(out, POSES[ks[i][1]], POSES[ks[i + 1][1]], ease((t - ks[i][0]) / (ks[i + 1][0] - ks[i][0])));
    }
    return Object.assign(out, POSES.READY);
  }
  function swingKind(e, m) {
    if (e.kind === 'serve' || e.kind === 'smash') return 'sm';
    if (e.kind === 'volley') return e.fore ? 'vo' : 'vb';
    return e.fore ? 'fh' : 'bh';
  }
  const tmpPose = Object.assign({}, R0), tmpPose2 = Object.assign({}, R0);
  function animatePlayer(m, o, side, dt) {
    const a = m.a, s = sideSign(side);
    // 位置与速度
    const nx = o.x, ny = o.y, sp = Math.hypot(nx - a.px, ny - a.py) / Math.max(dt, 1e-3);
    a.spd += (Math.min(sp, 9) - a.spd) * Math.min(1, dt * 10); a.px = nx; a.py = ny;
    m.root.position.set(nx, 0, ny);
    m.root.rotation.y = side === 0 ? Math.PI : 0;
    let target;
    if (mode === 'menu') target = POSES.STAND;
    else if (a.emote && clock - a.emote.t < a.emote.dur) target = POSES[a.emote.pose];
    else if (a.sw) {
      const t = clock - a.sw.t0;
      if (t > SWINGS[a.sw.kind][SWINGS[a.sw.kind].length - 1][0]) a.sw = null;
      target = a.sw ? swingPose(a.sw.kind, t, tmpPose) : POSES.READY;
    } else if (phase === 'serve' && toss && toss.server === side) {
      const t = now - toss.t0;
      target = t < 0 ? POSES.SERVE_STANCE : t < .5 ? blend(tmpPose, POSES.SERVE_STANCE, POSES.SERVE_TOSS, ease(t / .5)) : blend(tmpPose, POSES.SERVE_TOSS, POSES.SM_BACK, ease(clamp((t - .5) / .35, 0, 1)));
    } else if (phase === 'rally' && plan && plan.side === side && plan.t - now < .55) {
      const fore = side === 0 ? plan.x >= o.x : plan.x <= o.x;
      const kind = plan.kind === 'smash' ? 'sm' : plan.kind === 'volley' ? (fore ? 'vo' : 'vb') : (fore ? 'fh' : 'bh');
      target = blend(tmpPose, POSES.READY, POSES[BACK[kind]], ease(clamp(1 - (plan.t - now) / .55, 0, 1)));
    } else target = phase === 'over' ? POSES.STAND : POSES.READY;
    // 平滑过渡到目标姿态（挥拍时跟得更紧）
    const k = Math.min(1, dt * (a.sw ? 40 : 12));
    const p = a.pose; for (const key in R0) p[key] += (target[key] - p[key]) * k;
    // 跑步叠加
    const run = clamp(a.spd / 5, 0, 1) * (mode === 'menu' ? 0 : 1);
    a.phase += dt * (6 + a.spd * 1.6);
    const sw = Math.sin(a.phase), cw = Math.cos(a.phase);
    const idle = mode === 'menu' ? Math.sin(clock * 2) * .01 : Math.abs(Math.sin(clock * 5)) * .02 * (1 - run);
    m.hips.position.y = .95 - p.crouch + idle + Math.abs(cw) * .04 * run + p.jump;
    m.torso.rotation.set(p.torsoX + run * .15, p.torsoY, 0);
    m.head.rotation.x = p.headX;
    m.legs[0].thigh.rotation.x = p.rThigh + sw * .8 * run; m.legs[0].knee.rotation.x = p.rKnee + Math.max(0, -cw) * .9 * run;
    m.legs[1].thigh.rotation.x = p.lThigh - sw * .8 * run; m.legs[1].knee.rotation.x = p.lKnee + Math.max(0, cw) * .9 * run;
    m.arms.r.sh.rotation.set(p.rShX, p.rShY, p.rShZ); m.arms.r.el.rotation.x = p.rEl;
    m.arms.l.sh.rotation.set(p.lShX - sw * .5 * run * (a.sw ? 0 : 1), p.lShY, p.lShZ); m.arms.l.el.rotation.x = p.lEl;
    m.racket.rotation.x = p.wrist;
    // 侧向移动时身体微倾
    const lat = clamp((o.vxs || 0), -1, 1);
    m.body.rotation.z = -lat * .08;
  }

  // ---------- 球与特效 ----------
  function buildBall() {
    const tex = canvasTex(128, 64, (g, w, h) => {
      g.fillStyle = '#dcf53c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath();
      for (let x = 0; x <= w; x += 2) { const y = h / 2 + Math.sin(x / w * Math.PI * 4) * h * .28; x ? g.lineTo(x, y) : g.moveTo(x, y) } g.stroke();
    });
    ballMesh = new T.Mesh(new T.SphereGeometry(.075, 16, 12), new T.MeshLambertMaterial({ map: tex, emissive: 0x2a3300 }));
    ballMesh.castShadow = true; scene.add(ballMesh);
    ballShadow = new T.Mesh(new T.CircleGeometry(.11, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2; ballShadow.renderOrder = 2; scene.add(ballShadow);
    for (let i = 0; i < 12; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xeaff6a, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      s.visible = false; scene.add(s); trail.push(s);
    }
  }
  function buildFx() {
    timing = new T.Sprite(new T.SpriteMaterial({ map: ringTex, color: 0xffffff, transparent: true, depthTest: false }));
    timing.renderOrder = 10; timing.visible = false; scene.add(timing);
    timingFill = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xc8ff4d, transparent: true, opacity: .45, depthTest: false }));
    timingFill.renderOrder = 9; timingFill.visible = false; scene.add(timingFill);
    aimMark = new T.Group();
    const am = new T.MeshBasicMaterial({ color: 0xfff15a, transparent: true, opacity: .9, depthWrite: false });
    const r1 = new T.Mesh(new T.RingGeometry(.42, .52, 32), am); r1.rotation.x = -Math.PI / 2; aimMark.add(r1);
    const r2 = new T.Mesh(new T.CircleGeometry(.14, 16), am); r2.rotation.x = -Math.PI / 2; aimMark.add(r2);
    aimMark.position.y = .02; aimMark.visible = false; aimMark.renderOrder = 3; scene.add(aimMark);
    for (let i = 0; i < 48; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      s.visible = false; scene.add(s); sparks.push({ s, life: 0, vx: 0, vy: 0, vz: 0, max: 1, size: .1, add: true });
    }
    for (let i = 0; i < 6; i++) {
      const s = new T.Sprite(new T.SpriteMaterial({ map: ringTex, color: 0xffffff, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
      s.visible = false; scene.add(s); rings.push({ s, life: 0 });
    }
    for (let i = 0; i < 8; i++) {
      const m = new T.Mesh(new T.RingGeometry(.1, .17, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2; scene.add(m); marks.push({ m, life: 0, max: 1 });
    }
  }
  function burst(x, y, z, n, color, speed, life, size, additive = true) {
    for (let i = 0; i < n; i++) {
      const p = sparks.find(p => p.life <= 0); if (!p) return;
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
      p.life = p.max = life * rnd(.6, 1); p.size = size * rnd(.6, 1.2);
      p.vx = Math.cos(a) * Math.cos(e) * speed; p.vy = Math.sin(e) * speed + speed * .3; p.vz = Math.sin(a) * Math.cos(e) * speed;
      p.s.material.color.set(color); p.s.material.blending = additive ? T.AdditiveBlending : T.NormalBlending;
      p.s.position.copy(W3(x, y, z)); p.s.visible = true;
    }
  }
  function ring(x, y, z, color) {
    const r = rings.find(r => r.life <= 0); if (!r) return;
    r.life = .35; r.s.material.color.set(color); r.s.position.copy(W3(x, y, z)); r.s.visible = true;
  }
  function mark(x, y, ok) {
    const m = marks.find(m => m.life <= 0) || marks[0];
    const clay = arena && arena.id === 'clay';
    m.life = m.max = clay ? 5 : 1.4;
    m.m.material.color.set(ok ? (clay ? '#8a3d1c' : '#ffffff') : '#ff4040');
    m.m.scale.set(clay ? 1.2 : 1, clay ? 1.8 : 1, 1);
    m.m.position.copy(W3(x, y, .012)); m.m.visible = true;
  }

  // ---------- 赛场 ----------
  function buildArena(a) {
    arena = a;
    if (arenaGroup) { scene.remove(arenaGroup); disposeTree(arenaGroup) }
    arenaGroup = new T.Group(); scene.add(arenaGroup);
    const add = (o, x = 0, y = 0, z = 0) => { o.position.set(x, y, z); arenaGroup.add(o); return o };
    // 天空与雾
    scene.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a.sky[0]); gr.addColorStop(1, a.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, w, h) });
    scene.fog = new T.Fog(new T.Color(a.sky[1]), 80, 190);
    // 灯光
    if (a.night) { hemi.color.set(0xbcd0ff); hemi.groundColor.set(0x202840); hemi.intensity = .6; sun.color.set(0xffffff); sun.intensity = .95; sun.position.set(-4, 30, 6) }
    else { hemi.color.set(0xffffff); hemi.groundColor.set(0x51605a); hemi.intensity = .72; sun.color.set(0xfff4e0); sun.intensity = .9; sun.position.set(-10, 24, 12) }
    sun.target.position.set(0, 0, -1);
    // 地面与场地
    const noise = (base, amt) => canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) { g.fillStyle = Math.random() < .5 ? `rgba(255,255,255,${amt * Math.random()})` : `rgba(0,0,0,${amt * Math.random()})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2) }
    }, [10, 14]);
    add(mesh(new T.PlaneGeometry(140, 180), lam(a.apron, { map: noise(a.apron, .08) }), false, true)).rotation.x = -Math.PI / 2;
    let courtMat;
    if (a.stripes) courtMat = lam('#ffffff', { map: canvasTex(4, 512, (g, w, h) => { for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#4a9a3b' : '#5aaa48'; g.fillRect(0, i * h / 16, w, h / 16) } }) });
    else courtMat = lam(a.court, { map: noise(a.court, .07) });
    const court = add(mesh(new T.PlaneGeometry(DHW * 2 + 6, HL * 2 + 10), courtMat, false, true), 0, .002, 0); court.rotation.x = -Math.PI / 2;
    if (a.id === 'city' || a.id === 'night') {   // 硬地：内场蓝、外圈另一色
      court.scale.set((DHW * 2) / (DHW * 2 + 6), (HL * 2) / (HL * 2 + 10), 1);
    }
    // 球场线
    const lineMat = new T.MeshBasicMaterial({ color: 0xffffff });
    const seg = (x1, y1, x2, y2, w = .05) => {
      const len = Math.hypot(x2 - x1, y2 - y1), m = new T.Mesh(new T.PlaneGeometry(w, len), lineMat);
      m.rotation.x = -Math.PI / 2; m.rotation.z = -Math.atan2(x2 - x1, y2 - y1);
      m.position.set((x1 + x2) / 2, .006, (y1 + y2) / 2); m.receiveShadow = true; arenaGroup.add(m);
    };
    for (const s of [-1, 1]) {
      seg(-DHW, s * HL, DHW, s * HL, .08); seg(s * DHW, -HL, s * DHW, HL); seg(s * HW, -HL, s * HW, HL);
      seg(-HW, s * SVC, HW, s * SVC); seg(0, s * HL, 0, s * (HL - .15), .05);
    }
    seg(0, -SVC, 0, SVC);
    buildNet(add);
    buildStands(a, add);
    buildUmpire(add);
    if (a.scenery === 'city') for (let i = 0; i < 26; i++) { const h = rnd(10, 34), b = mesh(new T.BoxGeometry(rnd(5, 9), h, rnd(5, 9)), lam(i % 2 ? '#7c9cc4' : '#93b1d6'), false); add(b, -70 + i * 5.5 + rnd(-1, 1), h / 2, -HL - 34 - rnd(0, 12)) }
    if (a.scenery === 'trees') for (let i = 0; i < 40; i++) {
      const side = i % 2 ? 1 : -1, x = i < 20 ? -40 + i * 4 : side * rnd(26, 34), z = i < 20 ? -HL - 24 - rnd(0, 6) : rnd(-24, 16);
      const tr = new T.Group(); const s = rnd(.8, 1.4);
      tr.add(mesh(new T.CylinderGeometry(.25 * s, .35 * s, 2.4 * s, 6), lam('#6b4a2e'), false)).position.y = 1.2 * s;
      tr.add(mesh(new T.ConeGeometry(2.2 * s, 5 * s, 8), lam(Math.random() < .5 ? '#2f6b34' : '#3c7d3a'), false)).position.y = 4.6 * s;
      add(tr, x, 0, z);
    }
    if (a.scenery === 'lights') for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const g = new T.Group();
      g.add(mesh(new T.CylinderGeometry(.25, .35, 22, 8), lam('#2a2f45'), false)).position.y = 11;
      const panel = mesh(new T.BoxGeometry(4, 2.2, .4), new T.MeshBasicMaterial({ color: 0xfffbe6 }), false); panel.position.set(0, 22.5, 0); panel.lookAt(-sx * 20, 0, -sz * 20); g.add(panel);
      const glow = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xfff3c4, transparent: true, opacity: .7, depthWrite: false, blending: T.AdditiveBlending })); glow.scale.set(14, 14, 1); glow.position.y = 22.5; g.add(glow);
      add(g, sx * (DHW + 14), 0, sz * (HL + 6));
    }
  }
  function buildNet(add) {
    const L = DHW + .45, segs = 24;
    const geo = new T.PlaneGeometry(L * 2, 1, segs, 1), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), top = pos.getY(i) > 0; pos.setY(i, top ? netH(x) + (Math.abs(x) > 5.03 ? .155 : 0) : 0) }
    geo.computeVertexNormals();
    const netTex = canvasTex(64, 64, (g, w) => { g.strokeStyle = 'rgba(25,25,25,.9)'; g.lineWidth = 3; for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke() } }, [L * 2 / .09, 1 / .09]);
    const net = mesh(geo, new T.MeshBasicMaterial({ map: netTex, transparent: true, alphaTest: .25, side: T.DoubleSide }), false);
    add(net);
    const pts = []; for (let i = 0; i <= segs; i++) { const x = -L + 2 * L * i / segs; pts.push(new T.Vector3(x, netH(x) + (Math.abs(x) > 5.03 ? .155 : 0), 0)) }
    add(mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, .035, 6), lam('#ffffff')));
    add(mesh(new T.BoxGeometry(.05, .914, .02), lam('#ffffff')), 0, .457, 0);
    for (const s of [-1, 1]) add(mesh(new T.CylinderGeometry(.06, .06, 1.12, 10), lam('#1c3a2c')), s * L, .56, 0);
  }
  function buildStands(a, add) {
    // 挡板广告
    const boardTex = canvasTex(1024, 96, (g, w, h) => {
      g.fillStyle = a.wall; g.fillRect(0, 0, w, h);
      g.font = '900 italic 54px Arial, sans-serif'; g.textBaseline = 'middle';
      let x = 20; let i = 0;
      while (x < w) { const t = ['TENNIS SMASH', 'ACE TOUR', '2026', 'SMASH'][i++ % 4]; g.fillStyle = i % 2 ? '#ffffff' : '#d7f94a'; g.fillText(t, x, h / 2 + 3); x += g.measureText(t).width + 60 }
    }, [3, 1]);
    const boardMat = lam('#ffffff', { map: boardTex });
    const wallZ = HL + 6.5, wallX = DHW + 5.2;
    add(mesh(new T.BoxGeometry(wallX * 2, 1.1, .2), boardMat, false, true), 0, .55, -wallZ);
    for (const s of [-1, 1]) add(mesh(new T.BoxGeometry(.2, 1.1, wallZ * 2), boardMat, false, true), s * wallX, .55, 0);
    // 看台（阶梯）+ 观众（实例化）
    const rows = hq ? 8 : 4, step = .85, rise = .48;
    const standMat = lam(a.stand), seats = [];
    for (let r = 0; r < rows; r++) {
      const h = (r + 1) * rise, z = -(wallZ + .6 + r * step);
      add(mesh(new T.BoxGeometry(wallX * 2 + 2 * (rows * step), h, step), standMat, false, true), 0, h / 2, z - step / 2);
      for (let x = -wallX - r * step; x < wallX + r * step; x += .62) seats.push([x + rnd(-.05, .05), h, z - step * .55]);
      for (const s of [-1, 1]) {
        const xs = s * (wallX + .6 + r * step);
        add(mesh(new T.BoxGeometry(step, h, wallZ * 2 + 1.2), standMat, false, true), xs + s * step / 2, h / 2, -.0);
        for (let z2 = -wallZ + .3; z2 < wallZ - 3; z2 += .62) seats.push([xs + s * step * .55, h, z2 + rnd(-.05, .05)]);
      }
    }
    const filled = seats.filter(() => Math.random() < .86);
    const bodyGeo = new T.BoxGeometry(.4, .55, .3); bodyGeo.translate(0, .3, 0);
    const headGeo = new T.SphereGeometry(.12, 8, 6); headGeo.translate(0, .72, 0);
    const bodies = new T.InstancedMesh(bodyGeo, lam('#ffffff'), filled.length), heads = new T.InstancedMesh(headGeo, lam('#ffffff'), filled.length);
    const shirts = ['#e94b3c', '#f5f5f5', '#2f6fe0', '#ffd23f', '#2f9e5b', '#ff8fbf', '#7b4dff', '#1b1b1f', '#ff8a1f', '#22b5a5'];
    const skins = ['#f1c9a5', '#e2b08a', '#c99068', '#8a5a3c', '#f6d8c2'];
    const m4 = new T.Matrix4(), col = new T.Color();
    crowd = { bodies, heads, base: filled.map(p => ({ x: p[0], y: p[1], z: p[2], ph: Math.random() * 6, ry: Math.atan2(-p[0], -p[2]) })) };
    crowd.base.forEach((b, i) => {
      m4.makeRotationY(b.ry).setPosition(b.x, b.y, b.z); bodies.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
      bodies.setColorAt(i, col.set(shirts[i % shirts.length]).offsetHSL(0, 0, rnd(-.08, .05))); heads.setColorAt(i, col.set(skins[(i * 7) % skins.length]));
    });
    bodies.castShadow = heads.castShadow = false;
    add(bodies); add(heads);
  }
  function buildUmpire(add) {
    const g = new T.Group(), dark = lam('#24343f');
    for (const [x, z] of [[-.35, -.35], [.35, -.35], [-.35, .35], [.35, .35]]) g.add(mesh(new T.BoxGeometry(.07, 1.7, .07), dark)).position.set(x, .85, z);
    g.add(mesh(new T.BoxGeometry(.9, .08, .9), dark)).position.y = 1.7;
    g.add(mesh(new T.BoxGeometry(.9, .6, .08), dark)).position.set(0, 2.05, -.42);
    const ump = makePlayer({ shirt: '#1f2f55', shorts: '#2b2b2b', skin: '#e8c4a0', hair: '#555555', band: null });
    ump.racket.visible = false;
    const pose = mk({ crouch: .45, torsoX: .05, headX: .05, rThigh: -1.45, rKnee: 1.45, lThigh: -1.45, lKnee: 1.45, rShX: -.4, rShZ: -.1, rEl: -1.2, lShX: -.4, lShZ: .1, lEl: -1.2 });
    ump.hips.position.y = .5; ump.torso.rotation.set(pose.torsoX, 0, 0);
    ump.legs.forEach(l => { l.thigh.rotation.x = pose.rThigh; l.knee.rotation.x = pose.rKnee });
    ump.arms.r.sh.rotation.set(pose.rShX, 0, pose.rShZ); ump.arms.r.el.rotation.x = pose.rEl; ump.arms.l.sh.rotation.set(pose.lShX, 0, pose.lShZ); ump.arms.l.el.rotation.x = pose.lEl;
    ump.root.position.y = 1.74; g.add(ump.root);
    g.rotation.y = Math.PI / 2;
    add(g, -(DHW + 1.6), 0, 0);
  }

  // ---------- 相机：按安全区自动取景（HUD 不遮挡球场）----------
  const FIT_PTS = [[-(HW + .7), -HL - 1.3, 0], [HW + .7, -HL - 1.3, 0], [-(HW + .9), HL + 1.1, 0], [HW + .9, HL + 1.1, 0], [0, -HL - 1.0, 2.2], [0, HL + 1.4, 0]];
  function resize(w, h, s) {
    W = w; H = h; safe = s || safe;
    renderer.setSize(W, H, false);
    fitCamera();
  }
  function fitCamera() {
    if (mode !== 'game') { camera.clearViewOffset(); camera.aspect = W / H; camera.fov = W < H ? 46 : 34; camera.updateProjectionMatrix(); return }
    const port = H >= W;
    const cp = port ? W3(0, HL + 8.5, 16.5) : W3(0, HL + 12.5, 7.2);
    const lk = port ? W3(0, -1.2, 0) : W3(0, -2.6, 0);
    camera.clearViewOffset(); camera.position.copy(cp); camera.lookAt(lk); camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const p of FIT_PTS) { const v = W3(p[0], p[1], p[2]).applyMatrix4(inv), u = v.x / -v.z, q = v.y / -v.z; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, q); v1 = Math.max(v1, q) }
    const r = { x: safe.left, y: safe.top, w: Math.max(50, W - safe.left - safe.right), h: Math.max(50, H - safe.top - safe.bottom) };
    const F = Math.min(r.w / (u1 - u0), r.h / (v1 - v0));
    const ax = r.x + r.w / 2 - F * (u0 + u1) / 2, ay = r.y + r.h / 2 + F * (v0 + v1) / 2;
    const Wv = 2 * Math.max(ax, W - ax), Hv = 2 * Math.max(ay, H - ay);
    camera.aspect = Wv / Hv; camera.fov = 2 * Math.atan(Hv / 2 / F) * 180 / Math.PI;
    camera.setViewOffset(Wv, Hv, Wv / 2 - ax, Hv / 2 - ay, W, H); camera.updateProjectionMatrix();
    fit.pos.copy(cp); fit.look.copy(lk);
  }
  function setMode(m) {
    mode = m; fitCamera();
    models.A.root.visible = m === 'game';
    if (m === 'menu') { models.P.a.px = models.P.root.position.x; ballMesh.visible = false; ballShadow.visible = false; timing.visible = timingFill.visible = aimMark.visible = false }
  }

  // ---------- 事件 ----------
  function onEvent(type, e) {
    if (type === 'hit') {
      const m = e.side === 0 ? models.P : models.A;
      m.a.sw = { kind: swingKind(e, m), t0: clock - (e.kind === 'serve' || e.kind === 'smash' ? .1 : .08) };
      const perfect = e.q === 'perfect';
      burst(e.x, e.y, e.z, perfect ? 18 : 8, perfect ? '#e6ff5c' : '#ffffff', perfect ? 4 : 2.5, .35, perfect ? .22 : .14);
      ring(e.x, e.y, e.z, perfect ? '#e6ff5c' : '#ffffff');
      if (e.kind === 'smash' || (e.kmh > 150 && e.side === 0)) shake = .35;
      else if (perfect) shake = .12;
    } else if (type === 'bounce') {
      mark(e.x, e.y, e.ok);
      burst(e.x, e.y, .05, arena.id === 'clay' ? 10 : 4, arena.dust, 1.1, .6, arena.id === 'clay' ? .35 : .18, false);
    } else if (type === 'point') {
      if (e.train) return;
      const win = e.w === 0 ? models.P : models.A, lose = e.w === 0 ? models.A : models.P;
      win.a.emote = { pose: 'FIST', t: clock, dur: 1.1 }; lose.a.emote = { pose: 'SAD', t: clock, dur: 1.1 };
      cheer = Math.max(cheer, e.w === 0 ? 1 : .45);
    } else if (type === 'matchOver') {
      const win = e.w === 0 ? models.P : models.A, lose = e.w === 0 ? models.A : models.P;
      win.a.emote = { pose: 'CELEB', t: clock, dur: 99 }; lose.a.emote = { pose: 'SAD', t: clock, dur: 99 };
      cheer = 1.6;
    } else if (type === 'matchStart' || type === 'pointStart') {
      models.P.a.emote = models.A.a.emote = null;
      if (type === 'matchStart') { models.P.a.px = P.x; models.P.a.py = P.y; models.A.a.px = A.x; models.A.a.py = A.y }
    } else if (type === 'game') cheer = Math.max(cheer, 1.2);
  }
  let aimTgt = null;
  function setAim(t) { aimTgt = t }

  // ---------- 每帧 ----------
  function update(dt) {
    clock += dt;
    if (mode === 'menu') {
      const m = models.P; m.root.position.set(0, 0, HL - 4); m.root.rotation.y = 0;
      animatePlayer(m, { x: 0, y: HL - 4 }, 0, dt); m.root.rotation.y = Math.sin(clock * .4) * .5;
      const r = W < H ? 4.2 : 5.2;
      camera.position.set(Math.sin(clock * .15) * .8 + (W < H ? 0 : -1.4), 1.45, HL - 4 + r);
      camera.lookAt(W < H ? 0 : -1.4 + .9, W < H ? 1.0 : 1.05, HL - 4);
      updateCrowd(dt); updateFx(dt);
      return;
    }
    animatePlayer(models.P, P, 0, dt); animatePlayer(models.A, A, 1, dt);
    // 球
    const show = ball.vis && phase !== 'over';
    ballMesh.visible = ballShadow.visible = show;
    if (show) {
      ballMesh.position.set(ball.x, ball.z + .06, ball.y);
      ballMesh.rotation.x += (ball.wx || 0) * dt * .2; ballMesh.rotation.z -= (ball.wy || 0) * dt * .2; ballMesh.rotation.y += 8 * dt;
      ballShadow.position.set(ball.x, .01, ball.y);
      const sc = 1 + ball.z * .25; ballShadow.scale.set(sc, sc, 1); ballShadow.material.opacity = clamp(.4 - ball.z * .05, .12, .4);
      trailPts.push([ball.x, ball.y, ball.z + .06]); if (trailPts.length > trail.length) trailPts.shift();
    } else trailPts.length = 0;
    const fast = Math.hypot(ball.vx, ball.vy) > 6 && phase === 'rally';
    trail.forEach((s, i) => {
      const p = trailPts[trailPts.length - 1 - i];
      s.visible = !!p && fast && i > 0;
      if (s.visible) { s.position.set(p[0], p[2], p[1]); const k = 1 - i / trail.length; s.scale.setScalar(.17 * k); s.material.opacity = .55 * k }
    });
    // 击球时机光圈
    let rem = null, at = null;
    if (phase === 'rally' && plan && plan.side === 0) { rem = plan.t - now; at = [plan.x, plan.y, plan.z + .06] }
    else if (phase === 'serve' && toss && toss.server === 0) { rem = TOSS_IDEAL - (now - toss.t0); at = [ball.x, ball.y, ball.z + .06] }
    if (rem !== null && rem < 1.1 && rem > -lateWin()) {
      const far = phase === 'rally' && Math.hypot(P.x - plan.x, P.y - plan.y) > playerReach() + PS.move * Math.max(0, Math.min(rem, plan.t - plan.made - P_REACT));
      const pw = perfectWin(), inP = Math.abs(rem) <= pw;
      const size = .32 * (1 + Math.max(0, rem) * 3.4);
      timing.visible = true; timing.position.set(at[0], at[2], at[1]); timing.scale.set(size, size, 1);
      timing.material.color.set(far ? '#ff5b5b' : inP ? '#c8ff4d' : rem <= EARLY ? '#ffffff' : '#ffffff');
      timing.material.opacity = rem > EARLY ? .45 : 1;
      timingFill.visible = !!buffered || inP; timingFill.position.copy(timing.position); timingFill.scale.set(size * 1.1, size * 1.1, 1);
      timingFill.material.color.set(buffered ? '#c8ff4d' : '#ffffff'); timingFill.material.opacity = buffered ? .5 : .25;
    } else timing.visible = timingFill.visible = false;
    // 瞄准标记
    if (aimTgt) { aimMark.visible = true; aimMark.position.set(aimTgt.x, .02, aimTgt.y); aimMark.scale.setScalar(1 + Math.sin(clock * 10) * .06) }
    else aimMark.visible = false;
    updateFx(dt); updateCrowd(dt);
    // 相机跟随 + 震动
    camFollow.x += (clamp(P.x, -4, 4) * .28 - camFollow.x) * Math.min(1, dt * 3);
    shake = Math.max(0, shake - dt);
    const sk = shake * shake * .6;
    camera.position.set(fit.pos.x + camFollow.x + rnd(-sk, sk), fit.pos.y + rnd(-sk, sk), fit.pos.z);
    camera.lookAt(fit.look.x + camFollow.x, fit.look.y, fit.look.z);
  }
  function updateFx(dt) {
    for (const p of sparks) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue }
      p.vy -= 4 * dt;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const k = p.life / p.max; p.s.scale.setScalar(p.size * (1.4 - k * .4)); p.s.material.opacity = k;
    }
    for (const r of rings) {
      if (r.life <= 0) continue;
      r.life -= dt; if (r.life <= 0) { r.s.visible = false; continue }
      const k = 1 - r.life / .35; r.s.scale.setScalar(.2 + k * 1.6); r.s.material.opacity = 1 - k;
    }
    for (const m of marks) {
      if (m.life <= 0) continue;
      m.life -= dt; if (m.life <= 0) { m.m.visible = false; continue }
      m.m.material.opacity = Math.min(1, m.life / m.max * 2) * .85;
    }
  }
  const cm4 = new T.Matrix4();
  function updateCrowd(dt) {
    if (!crowd) return;
    const active = cheer > .01;
    cheer = Math.max(0, cheer - dt * .6);
    if (!active && !crowd.dirty) return;
    crowd.dirty = active;
    const c = Math.min(1, cheer);
    crowd.base.forEach((b, i) => {
      const y = b.y + Math.max(0, Math.sin(clock * 11 + b.ph)) * .22 * c;
      cm4.makeRotationY(b.ry).setPosition(b.x, y, b.z); crowd.bodies.setMatrixAt(i, cm4); crowd.heads.setMatrixAt(i, cm4);
    });
    crowd.bodies.instanceMatrix.needsUpdate = crowd.heads.instanceMatrix.needsUpdate = true;
  }
  const pv = new T.Vector3();
  function project(x, y, z) { pv.set(x, z, y).project(camera); return { x: (pv.x + 1) / 2 * W, y: (1 - pv.y) / 2 * H, vis: pv.z < 1 } }
  function render() { renderer.render(scene, camera) }
  return { init, buildArena, resize, update, render, setMode, setAim, setPlayerLook, setOpponentLook, onEvent, project, setQuality, get arena() { return arena } };
})();
