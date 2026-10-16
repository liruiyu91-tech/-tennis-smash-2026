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
    buildBall(); buildFx(); buildExtras();
    rebuild('P', playerLook(), myChar().bh); rebuild('A', QUICK_OPPS[0].look);
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
  // 长发/发带等结构差异需要重建模型
  function rebuild(key, look, bh) {
    const old = models[key];
    if (old) { scene.remove(old.root); disposeTree(old.root) }
    const m = makePlayer(look); m.bh = bh || 'two'; models[key] = m; scene.add(m.root);
    m.aura = new T.Sprite(new T.SpriteMaterial({ map: dotTex, color: 0xffd23f, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending }));
    m.aura.scale.set(2.6, 2.6, 1); m.aura.position.y = 1; m.root.add(m.aura);
    if (key === 'A') m.root.visible = mode !== 'menu';
    return m;
  }
  function setPlayerLook(look, bh) { rebuild('P', look, bh) }
  function setOpponentLook(look, bh) { rebuild('A', look, bh) }

  // ---------- 动作姿态（弧度）----------
  // 模型面朝 +Z，右手在 -X。hipY 转髋、torsoY 转肩（相对髋），两者先后不同步 = 髋肩分离发力
  // rThZ/lThZ 两腿外展（站距）；wrist 手腕前后、wristZ 拍面翻转（拍头滞后 / 收拍翻腕）；turn 整个人转身
  const R0 = { crouch: .1, torsoX: .18, torsoY: 0, hipY: 0, headX: -.1, rThigh: -.35, rKnee: .6, lThigh: -.35, lKnee: .6, rThZ: -.1, lThZ: .1,
    rShX: -.75, rShY: 0, rShZ: -.2, rEl: -1.0, lShX: -.8, lShY: 0, lShZ: .35, lEl: -1.2, wrist: -.2, wristZ: 0, jump: 0, turn: 0 };
  const mk = o => Object.assign({}, R0, o);
  // 站位：后脚承重（引拍）→ 前脚踏出（击球）
  const LOAD_R = { rKnee: .8, rThigh: -.25, lThigh: -.55, lKnee: .5, rThZ: -.16, lThZ: .14 };     // 正手：重心在右脚
  const STEP_L = { lThigh: -.6, lKnee: .45, rThigh: .05, rKnee: .55, rThZ: -.14, lThZ: .12 };     // 正手击球：左脚在前
  const LOAD_L = { lKnee: .8, lThigh: -.25, rThigh: -.55, rKnee: .5, rThZ: -.14, lThZ: .16 };     // 反手：重心在左脚
  const STEP_R = { rThigh: -.6, rKnee: .45, lThigh: .05, lKnee: .55, rThZ: -.12, lThZ: .14 };
  const POSES = {
    READY: R0,
    STAND: mk({ crouch: 0, torsoX: .02, headX: 0, rThigh: 0, rKnee: .05, lThigh: 0, lKnee: .05, rThZ: -.04, lThZ: .04, rShX: -.35, rShZ: -.12, rEl: -.7, lShX: -.05, lShZ: .12, lEl: -.2, wrist: -.3 }),
    WALK: mk({ crouch: .02, torsoX: .06, headX: .05, rShX: -.3, rShZ: -.15, rEl: -.6, lShX: -.1, lShZ: .1, lEl: -.3, wrist: -.4, rThZ: -.04, lThZ: .04 }),
    // —— 正手 ——
    FH_PREP: mk(Object.assign({ crouch: .15, torsoX: .2, hipY: -.55, torsoY: -.75, rShX: .25, rShZ: -.85, rEl: -1.35, wrist: .35, lShX: -1.35, lShZ: .6, lEl: -.15 }, LOAD_R)),
    FH_DROP: mk(Object.assign({ crouch: .18, torsoX: .18, hipY: -.42, torsoY: -.62, rShX: .35, rShZ: -1.05, rEl: -.45, wrist: -.95, wristZ: .5, lShX: -1.25, lShZ: .65, lEl: -.2 }, LOAD_R)),
    FH_HIT: mk(Object.assign({ crouch: .13, torsoX: .16, hipY: .15, torsoY: -.08, rShX: -.55, rShZ: -1.25, rEl: -.2, wrist: -.25, wristZ: .1, lShX: -.75, lShZ: .5, lEl: -1.2 }, STEP_L)),
    FH_WIPER: mk(Object.assign({ crouch: .1, hipY: .42, torsoY: .42, rShX: -1.8, rShZ: -.55, rEl: -1.35, wrist: .3, wristZ: -.65, lShX: -.45, lShZ: .3, lEl: -1.9 }, STEP_L)),
    FH_FOLLOW: mk(Object.assign({ crouch: .08, hipY: .55, torsoY: .65, rShX: -2.4, rShZ: .1, rEl: -1.9, wrist: .4, wristZ: -.5, lShX: -.6, lShZ: .25, lEl: -2.0 }, STEP_L)),
    FH_FLAT_FOL: mk(Object.assign({ crouch: .08, hipY: .5, torsoY: .5, rShX: -1.95, rShZ: -.1, rEl: -1.3, wrist: .1, wristZ: -.3, lShX: -.6, lShZ: .3, lEl: -1.9 }, STEP_L)),
    FH_SL_PREP: mk(Object.assign({ crouch: .14, hipY: -.5, torsoY: -.7, rShX: .1, rShZ: -.9, rEl: -1.65, wrist: .65, wristZ: -.3, lShX: -1.3, lShZ: .6, lEl: -.2 }, LOAD_R)),
    FH_SL_HIT: mk(Object.assign({ crouch: .14, hipY: .05, torsoY: -.1, rShX: -.5, rShZ: -1.15, rEl: -.35, wrist: -.1, wristZ: -.45, lShX: -.9, lShZ: .55, lEl: -.8 }, STEP_L)),
    FH_SL_FOL: mk(Object.assign({ crouch: .12, hipY: .2, torsoY: .25, rShX: -1.15, rShZ: -.6, rEl: -.35, wrist: -.3, wristZ: -.5, lShX: -.5, lShZ: .5, lEl: -.6 }, STEP_L)),
    FH_LOB_FOL: mk(Object.assign({ crouch: .02, torsoX: -.1, hipY: .35, torsoY: .3, rShX: -2.9, rShZ: -.55, rEl: -.45, wrist: .2, wristZ: -.2, lShX: -.5, lShZ: .4, lEl: -1.6, headX: -.4 }, STEP_L)),
    FH_DR_HIT: mk(Object.assign({ crouch: .16, hipY: -.05, torsoY: -.2, rShX: -.45, rShZ: -1.1, rEl: -.5, wrist: -.05, wristZ: -.6, lShX: -1.0, lShZ: .6, lEl: -.6 }, STEP_L)),
    FH_DR_FOL: mk(Object.assign({ crouch: .14, hipY: .05, torsoY: -.05, rShX: -.85, rShZ: -1.0, rEl: -.4, wrist: .1, wristZ: -.7, lShX: -.9, lShZ: .55, lEl: -.7 }, STEP_L)),
    // —— 双手反手：左手一起握拍，收拍在右肩上方 ——
    B2_PREP: mk(Object.assign({ crouch: .15, torsoX: .2, hipY: .55, torsoY: .85, rShX: -.35, rShZ: .7, rEl: -1.05, wrist: .35, lShX: -.2, lShZ: .95, lEl: -1.05 }, LOAD_L)),
    B2_DROP: mk(Object.assign({ crouch: .18, hipY: .45, torsoY: .7, rShX: -.2, rShZ: .8, rEl: -.6, wrist: -.85, wristZ: -.4, lShX: .1, lShZ: 1.0, lEl: -.6 }, LOAD_L)),
    B2_HIT: mk(Object.assign({ crouch: .13, hipY: -.1, torsoY: .05, rShX: -.85, rShZ: .5, rEl: -.25, wrist: -.2, lShX: -.85, lShZ: .95, lEl: -.35 }, STEP_R)),
    B2_WIPER: mk(Object.assign({ crouch: .1, hipY: -.4, torsoY: -.4, rShX: -1.7, rShZ: .2, rEl: -.9, wrist: .3, wristZ: .4, lShX: -1.8, lShZ: .5, lEl: -.9 }, STEP_R)),
    B2_FOL: mk(Object.assign({ crouch: .08, hipY: -.5, torsoY: -.6, rShX: -2.4, rShZ: -.2, rEl: -1.3, wrist: .4, wristZ: .3, lShX: -2.3, lShZ: .2, lEl: -1.4 }, STEP_R)),
    B2_FLAT_FOL: mk(Object.assign({ crouch: .08, hipY: -.45, torsoY: -.45, rShX: -1.9, rShZ: .05, rEl: -.8, wrist: .1, lShX: -1.95, lShZ: .35, lEl: -.85 }, STEP_R)),
    B2_LOB_FOL: mk(Object.assign({ crouch: .02, torsoX: -.1, headX: -.4, hipY: -.3, torsoY: -.3, rShX: -2.85, rShZ: .1, rEl: -.4, wrist: .2, lShX: -2.85, lShZ: .3, lEl: -.45 }, STEP_R)),
    // —— 单手反手：左手扶拍颈引拍，击球后两臂向后打开 ——
    B1_PREP: mk(Object.assign({ crouch: .15, torsoX: .22, hipY: .6, torsoY: 1.0, rShX: -.3, rShZ: .95, rEl: -.6, wrist: .35, lShX: -.6, lShZ: .8, lEl: -1.1 }, LOAD_L)),
    B1_DROP: mk(Object.assign({ crouch: .18, hipY: .55, torsoY: .9, rShX: -.1, rShZ: .95, rEl: -.3, wrist: -.85, wristZ: -.3, lShX: -.4, lShZ: .9, lEl: -1.0 }, LOAD_L)),
    B1_HIT: mk(Object.assign({ crouch: .13, hipY: .1, torsoY: .2, rShX: -.9, rShZ: .35, rEl: -.05, wrist: -.15, lShX: .45, lShZ: 1.2, lEl: -.1 }, STEP_R)),
    B1_FOL: mk(Object.assign({ crouch: .08, hipY: -.1, torsoY: -.15, rShX: -2.2, rShZ: -1.0, rEl: -.1, wrist: .3, lShX: .7, lShZ: 1.3, lEl: -.05 }, STEP_R)),
    B1_LOB_FOL: mk(Object.assign({ crouch: .02, torsoX: -.1, headX: -.4, hipY: -.05, torsoY: -.05, rShX: -2.9, rShZ: -.4, rEl: -.1, wrist: .2, lShX: .7, lShZ: 1.3, lEl: -.05 }, STEP_R)),
    // —— 反手切削（单手、高位引拍、由高到低）——
    BS_PREP: mk(Object.assign({ crouch: .14, hipY: .5, torsoY: .9, rShX: -.65, rShZ: .9, rEl: -1.35, wrist: .7, wristZ: .3, lShX: -.5, lShZ: .8, lEl: -1.05 }, LOAD_L)),
    BS_HIT: mk(Object.assign({ crouch: .15, hipY: .15, torsoY: .25, rShX: -.8, rShZ: .4, rEl: -.2, wrist: -.05, wristZ: .45, lShX: .25, lShZ: 1.1, lEl: -.2 }, STEP_R)),
    BS_FOL: mk(Object.assign({ crouch: .12, hipY: .05, torsoY: .0, rShX: -1.15, rShZ: -.6, rEl: -.2, wrist: -.25, wristZ: .5, lShX: .55, lShZ: 1.2, lEl: -.1 }, STEP_R)),
    BS_DR_HIT: mk(Object.assign({ crouch: .17, hipY: .3, torsoY: .45, rShX: -.65, rShZ: .55, rEl: -.4, wrist: .05, wristZ: .65, lShX: -.1, lShZ: 1.0, lEl: -.4 }, STEP_R)),
    BS_DR_FOL: mk(Object.assign({ crouch: .15, hipY: .2, torsoY: .3, rShX: -.95, rShZ: .25, rEl: -.35, wrist: .15, wristZ: .7, lShX: .1, lShZ: 1.05, lEl: -.3 }, STEP_R)),
    // 大跨步救球（被调动时）
    LF_BACK: mk({ crouch: .34, torsoX: .45, hipY: -.4, torsoY: -.6, rThigh: -1.05, rKnee: 1.25, lThigh: .6, lKnee: .35, rThZ: -.2, lThZ: .2, rShX: .1, rShZ: -1.3, rEl: -.4, lShX: -.9, lShZ: .9, lEl: -.2, wrist: -.5 }),
    LF_HIT: mk({ crouch: .36, torsoX: .5, hipY: -.1, torsoY: -.1, rThigh: -1.05, rKnee: 1.25, lThigh: .6, lKnee: .35, rThZ: -.2, lThZ: .2, rShX: -.55, rShZ: -1.5, rEl: -.05, lShX: -.5, lShZ: 1.1, lEl: -.2, wrist: 0 }),
    LF_FOLLOW: mk({ crouch: .3, torsoX: .45, hipY: .2, torsoY: .3, rThigh: -1.0, rKnee: 1.2, lThigh: .55, lKnee: .4, rThZ: -.2, lThZ: .2, rShX: -1.8, rShZ: -.6, rEl: -1.1, lShX: -.3, lShZ: .9, lEl: -.4, wrist: .2 }),
    LB_BACK: mk({ crouch: .34, torsoX: .45, hipY: .4, torsoY: .6, lThigh: -1.05, lKnee: 1.25, rThigh: .6, rKnee: .35, rThZ: -.2, lThZ: .2, rShX: -.4, rShZ: .9, rEl: -.6, lShX: -.5, lShZ: 1.0, lEl: -.8, wrist: -.5 }),
    LB_HIT: mk({ crouch: .36, torsoX: .5, hipY: .1, torsoY: .1, lThigh: -1.05, lKnee: 1.25, rThigh: .6, rKnee: .35, rThZ: -.2, lThZ: .2, rShX: -.8, rShZ: .8, rEl: -.1, lShX: .2, lShZ: 1.3, lEl: -.2, wrist: 0 }),
    LB_FOLLOW: mk({ crouch: .3, torsoX: .45, hipY: -.2, torsoY: -.3, lThigh: -1.0, lKnee: 1.2, rThigh: .55, rKnee: .4, rThZ: -.2, lThZ: .2, rShX: -1.9, rShZ: .2, rEl: -.8, lShX: .3, lShZ: 1.2, lEl: -.2, wrist: .2 }),
    // 扣杀 / 发球
    SM_BACK: mk({ crouch: .05, torsoY: -.45, hipY: -.3, torsoX: -.15, headX: -.5, rShX: -2.4, rShZ: -.5, rEl: -1.9, lShX: -2.9, lShZ: .15, lEl: -.1, wrist: .3 }),
    SM_HIT: mk({ crouch: 0, torsoY: -.05, hipY: -.05, torsoX: .15, headX: -.4, rShX: -3.0, rShZ: -.25, rEl: -.1, lShX: -1.0, lShZ: .4, lEl: -.5, wrist: 0, jump: .08 }),
    SM_FOLLOW: mk({ torsoY: .45, hipY: .3, torsoX: .45, headX: .1, rShX: -.5, rShZ: .5, rEl: -.4, lShX: -.4, lShZ: .3, lEl: -.6, wrist: -.3, lThigh: -.7, lKnee: .5, rThigh: .2, rKnee: .4 }),
    SERVE_STANCE: mk({ crouch: .02, torsoX: .05, torsoY: -.3, hipY: -.25, headX: 0, rShX: -.3, rShZ: -.3, rEl: -.5, lShX: -.6, lShZ: .1, lEl: -.3, wrist: -.4 }),
    DRIBBLE: mk({ crouch: .1, torsoX: .38, torsoY: -.15, hipY: -.15, headX: .35, rShX: -.35, rShZ: -.3, rEl: -.6, lShX: -.45, lShZ: .15, lEl: -.35, wrist: -.4, rThigh: -.15, rKnee: .3, lThigh: -.3, lKnee: .35 }),
    SERVE_TOSS: mk({ crouch: .18, torsoX: -.1, torsoY: -.55, hipY: -.35, headX: -.6, rShX: .4, rShZ: -.9, rEl: -1.3, lShX: -3.0, lShZ: .2, lEl: 0, wrist: -.3, rKnee: 1.0, lKnee: 1.0, rThigh: -.45, lThigh: -.45 }),
    // 截击：动作短、拍头高、靠前脚推送
    VO_BACK: mk(Object.assign({ crouch: .2, hipY: -.25, torsoY: -.3, rShX: -.75, rShZ: -.95, rEl: -.9, wrist: .2, wristZ: -.2, lShX: -1.1, lShZ: .55, lEl: -.4 }, LOAD_R)),
    VO_HIT: mk(Object.assign({ crouch: .2, hipY: 0, torsoY: 0, rShX: -1.15, rShZ: -.9, rEl: -.45, wrist: .1, wristZ: -.35, lShX: -.9, lShZ: .55, lEl: -.6 }, STEP_L)),
    VB_BACK: mk(Object.assign({ crouch: .2, hipY: .25, torsoY: .35, rShX: -.9, rShZ: .45, rEl: -1.0, wrist: .2, wristZ: .2, lShX: -.7, lShZ: .8, lEl: -1.0 }, LOAD_L)),
    VB_HIT: mk(Object.assign({ crouch: .2, hipY: 0, torsoY: 0, rShX: -1.25, rShZ: .3, rEl: -.45, wrist: .1, wristZ: .35, lShX: -.2, lShZ: 1.0, lEl: -.4 }, STEP_R)),
    // 胯下击球：背对球网，球拍从两腿间挥出
    TW_BACK: mk({ turn: Math.PI, crouch: .28, torsoX: .75, headX: .3, rThigh: -.25, rKnee: .5, lThigh: .25, lKnee: .4, rThZ: -.2, lThZ: .2, rShX: -.6, rShZ: -.05, rEl: -.3, lShX: -.4, lShZ: .5, lEl: -.3, wrist: .4 }),
    TW_HIT: mk({ turn: Math.PI, crouch: .3, torsoX: .8, headX: .4, rThigh: -.25, rKnee: .5, lThigh: .25, lKnee: .4, rThZ: -.22, lThZ: .22, rShX: .9, rShZ: 0, rEl: -.1, lShX: -.6, lShZ: .6, lEl: -.3, wrist: .6 }),
    TW_FOLLOW: mk({ turn: Math.PI, crouch: .22, torsoX: .55, headX: .2, rShX: 1.5, rShZ: .1, rEl: -.1, lShX: -.9, lShZ: .5, lEl: -.3, wrist: .6 }),
    // 庆祝 / 沮丧 / 发动必杀技
    CELEB: mk({ crouch: 0, torsoX: -.1, headX: -.3, rThigh: 0, rKnee: .1, lThigh: 0, lKnee: .1, rShX: -3.0, rShZ: -.35, rEl: -.2, lShX: -3.0, lShZ: .35, lEl: -.2, wrist: 0 }),
    FIST: mk({ crouch: .05, torsoX: .1, headX: -.1, rShX: -1.2, rShZ: -.2, rEl: -2.0, lShX: -.9, lShZ: .25, lEl: -2.2 }),
    RACKET_UP: mk({ crouch: 0, torsoX: -.05, headX: -.35, rThigh: 0, rKnee: .1, lThigh: 0, lKnee: .1, rShX: -3.0, rShZ: -.2, rEl: 0, lShX: -.9, lShZ: .5, lEl: -2.0, wrist: 0 }),
    ROAR: mk({ crouch: .2, torsoX: -.25, headX: -.45, rShX: -.9, rShZ: -.5, rEl: -2.1, lShX: -.9, lShZ: .5, lEl: -2.1, rThZ: -.2, lThZ: .2 }),
    KNEEL: mk({ crouch: .5, torsoX: -.15, headX: -.55, rThigh: .05, rKnee: 1.57, lThigh: .05, lKnee: 1.57, rShX: -3.0, rShZ: -.4, rEl: -.2, lShX: -3.0, lShZ: .4, lEl: -.2, wrist: 0 }),
    TROPHY: mk({ crouch: 0, torsoX: -.1, headX: -.4, rThigh: 0, rKnee: .1, lThigh: 0, lKnee: .1, rShX: -3.05, rShZ: .28, rEl: -.25, lShX: -3.05, lShZ: -.28, lEl: -.25, wrist: 0 }),
    SAD: mk({ crouch: .04, torsoX: .45, headX: .5, rThigh: 0, rKnee: .15, lThigh: 0, lKnee: .15, rShX: -.05, rShZ: -.1, rEl: -.2, lShX: .05, lShZ: .1, lEl: -.1, wrist: -.2 }),
    POWER: mk({ crouch: .22, torsoX: .3, headX: -.2, rShX: -1.1, rShZ: -.4, rEl: -1.7, lShX: -1.1, lShZ: .4, lEl: -1.7, wrist: .3, rThZ: -.22, lThZ: .22 }),
  };
  // 挥拍时间轴：[秒, 姿态]，0 = 击球前 0.07 秒（拍头下沉完成），0.07 = 触球
  // 由 tools/solve-arms.js 逆向运动学求出的手臂角度（拍头位置与朝向精确到几厘米），覆盖上面的手臂初值
  const ARM = {
    READY: {rShX:0.13,rShY:0.08,rShZ:0.31,rEl:-1.42,wrist:-0.92,wristZ:0.32,lShX:-0.27,lShY:0.43,lShZ:-0.95,lEl:-0.69},
    FH_PREP: {rShX:-0.87,rShY:-0.29,rShZ:0.03,rEl:-1.77,wrist:-0.41,wristZ:-0.41},
    FH_DROP: {rShX:-0.79,rShY:-0.04,rShZ:-0.68,rEl:-0.34,wrist:0.83,wristZ:-0.11},
    FH_HIT: {rShX:-2.17,rShY:-1.44,rShZ:-1.55,rEl:-0.99,wrist:-0.38,wristZ:0.21},
    FH_WIPER: {rShX:0.9,rShY:-1.06,rShZ:-0.08,rEl:-1.89,wrist:-1.39,wristZ:-0.53},
    FH_FOLLOW: {rShX:-1.38,rShY:0.88,rShZ:0.47,rEl:-1.78,wrist:0.25,wristZ:0.51,lShX:-0.91,lShY:0.03,lShZ:0.57,lEl:-2.34},
    FH_FLAT_FOL: {rShX:0.11,rShY:0.44,rShZ:-1.52,rEl:-2.07,wrist:-0.2,wristZ:-0.1},
    FH_SL_PREP: {rShX:-0.83,rShY:-0.3,rShZ:0.09,rEl:-2.14,wrist:-0.3,wristZ:-0.39},
    FH_SL_HIT: {rShX:0.28,rShY:0.13,rShZ:-0.92,rEl:-1.46,wrist:1.06,wristZ:-0.64},
    FH_SL_FOL: {rShX:-0.53,rShY:-0.15,rShZ:-0.59,rEl:-0.3,wrist:-0.78,wristZ:0.19},
    FH_LOB_FOL: {rShX:-2.23,rShY:-0.43,rShZ:-0.31,rEl:-1.87,wrist:1.13,wristZ:0.22},
    FH_DR_HIT: {rShX:-0.23,rShY:-0.45,rShZ:-0.06,rEl:-1.21,wrist:-0.07,wristZ:-0.24},
    FH_DR_FOL: {rShX:-2.32,rShY:-1.2,rShZ:-1.61,rEl:0,wrist:-0.07,wristZ:0.93},
    B2_PREP: {rShX:-2.6,rShY:0.72,rShZ:1.24,rEl:-0.08,wrist:-0.76,wristZ:-0.26,lShX:-0.83,lShY:-0.01,lShZ:0.18,lEl:-1.61,hipY:0.63,torsoY:0.84},
    B2_DROP: {rShX:-0.07,rShY:-0.74,rShZ:1.13,rEl:-0.26,wrist:0.21,wristZ:-0.26,lShX:-0.72,lShY:-0.03,lShZ:-0.14,lEl:-0.66,hipY:0.9,torsoY:0.92},
    B2_HIT: {rShX:-0.6,rShY:1.48,rShZ:-0.46,rEl:-0.89,wrist:0.38,wristZ:-0.47,lShX:-0.85,lShY:0.46,lShZ:-0.48,lEl:-0.19,hipY:0.4,torsoY:0.55},
    B2_WIPER: {rShX:-0.5,rShY:-0.01,rShZ:1.24,rEl:-0.11,wrist:-1.67,wristZ:0.42,lShX:0.15,lShY:0.08,lShZ:0.96,lEl:-2.4,hipY:-0.05,torsoY:-0.21},
    B2_FOL: {rShX:-0.73,rShY:0.15,rShZ:1.06,rEl:-2,wrist:-1.3,wristZ:-0.12,lShX:-1.17,lShY:-0.26,lShZ:-1.13,lEl:-1.41,hipY:-0.49,torsoY:-0.59},
    B2_FLAT_FOL: {rShX:-0.24,rShY:-0.03,rShZ:1.3,rEl:-1.03,wrist:-1.7,wristZ:-0.24,lShX:-0.47,lShY:-0.12,lShZ:-0.53,lEl:-1.85,hipY:-0.4,torsoY:-0.46},
    B2_LOB_FOL: {rShX:-3.2,rShY:0.15,rShZ:1.04,rEl:0,wrist:0.32,wristZ:-0.64,lShX:-2.08,lShY:-0.1,lShZ:0.34,lEl:-1.64,hipY:-0.34,torsoY:-0.25},
    B1_PREP: {rShX:-2.7,rShY:0.9,rShZ:1.3,rEl:-0.36,wrist:-0.61,wristZ:-0.42,lShX:-1.16,lShY:0.08,lShZ:0.38,lEl:-1.35,hipY:0.65,torsoY:1.02},
    B1_DROP: {rShX:-0.59,rShY:-0.36,rShZ:0.87,rEl:-0.18,wrist:0.31,wristZ:-0.26,lShX:-0.6,lShY:-0.83,lShZ:0.35,lEl:-0.3,hipY:0.92,torsoY:0.83},
    B1_HIT: {rShX:-0.83,rShY:-0.2,rShZ:0.4,rEl:-0.33,wrist:-0.37,wristZ:0.12,hipY:0.46,torsoY:0.54},
    B1_FOL: {rShX:-1.76,rShY:0.48,rShZ:-0.19,rEl:-2.4,wrist:1.23,wristZ:-0.6,hipY:-0.05,torsoY:-0.14},
    B1_LOB_FOL: {rShX:-1.82,rShY:-0.22,rShZ:0.85,rEl:-0.64,wrist:-0.31,wristZ:-0.32,hipY:-0.05,torsoY:-0.04},
    BS_PREP: {rShX:-1.66,rShY:0.6,rShZ:0.56,rEl:-1.26,wrist:-0.15,wristZ:-0.06,lShX:-1.73,lShY:0.06,lShZ:-0.04,lEl:-1.24,hipY:0.67,torsoY:1.05},
    BS_HIT: {rShX:-0.79,rShY:-0.33,rShZ:0.63,rEl:-0.12,wrist:-0.37,wristZ:0.01,hipY:0.38,torsoY:0.46},
    BS_FOL: {rShX:-0.97,rShY:0.54,rShZ:0.08,rEl:-0.19,wrist:0.88,wristZ:-1.04,hipY:0.47,torsoY:0.45},
    BS_DR_HIT: {rShX:-0.82,rShY:-0.32,rShZ:0.45,rEl:-0.07,wrist:-0.61,wristZ:-0.19,hipY:0.48,torsoY:0.55},
    BS_DR_FOL: {rShX:-0.81,rShY:0.03,rShZ:0.36,rEl:-0.32,wrist:-0.69,wristZ:-0.73,hipY:0.39,torsoY:0.47},
    VO_BACK: {rShX:-2.01,rShY:-1.6,rShZ:-1.7,rEl:-2.4,wrist:-0.56,wristZ:0.8,lShX:-2.49,lShY:-0.05,lShZ:-1.3,lEl:0},
    VO_HIT: {rShX:-0.4,rShY:-0.45,rShZ:-0.42,rEl:-1.51,wrist:-0.44,wristZ:-0.17},
    VB_BACK: {rShX:-1.9,rShY:0.49,rShZ:1.29,rEl:-0.22,wrist:-1.34,wristZ:-0.59,lShX:-0.83,lShY:0.15,lShZ:0.45,lEl:-2,hipY:0.4,torsoY:0.41},
    VB_HIT: {rShX:-2.32,rShY:0.62,rShZ:1.3,rEl:0,wrist:-0.25,wristZ:-1.04,hipY:0.17,torsoY:0.13},
  };
  for (const k in ARM) Object.assign(POSES[k], ARM[k]);
  const TOP = (d, h, w, f) => [[0, d], [.07, h], [.17, w], [.38, f], [.82, 'READY']];
  const CUT = (d, h, f) => [[0, d], [.08, h], [.32, f], [.72, 'READY']];
  const SWINGS = {
    fh_top: TOP('FH_DROP', 'FH_HIT', 'FH_WIPER', 'FH_FOLLOW'), fh_flat: TOP('FH_DROP', 'FH_HIT', 'FH_FLAT_FOL', 'FH_FLAT_FOL'),
    fh_lob: TOP('FH_DROP', 'FH_HIT', 'FH_LOB_FOL', 'FH_LOB_FOL'), fh_slice: CUT('FH_SL_PREP', 'FH_SL_HIT', 'FH_SL_FOL'), fh_drop: CUT('FH_SL_PREP', 'FH_DR_HIT', 'FH_DR_FOL'),
    b2_top: TOP('B2_DROP', 'B2_HIT', 'B2_WIPER', 'B2_FOL'), b2_flat: TOP('B2_DROP', 'B2_HIT', 'B2_FLAT_FOL', 'B2_FLAT_FOL'), b2_lob: TOP('B2_DROP', 'B2_HIT', 'B2_LOB_FOL', 'B2_LOB_FOL'),
    b1_top: TOP('B1_DROP', 'B1_HIT', 'B1_FOL', 'B1_FOL'), b1_lob: TOP('B1_DROP', 'B1_HIT', 'B1_LOB_FOL', 'B1_LOB_FOL'),
    bs_slice: CUT('BS_PREP', 'BS_HIT', 'BS_FOL'), bs_drop: CUT('BS_PREP', 'BS_DR_HIT', 'BS_DR_FOL'),
    lf: [[0, 'LF_BACK'], [.08, 'LF_HIT'], [.34, 'LF_FOLLOW'], [.9, 'READY']], lb: [[0, 'LB_BACK'], [.08, 'LB_HIT'], [.34, 'LB_FOLLOW'], [.9, 'READY']],
    sm: [[0, 'SM_BACK'], [.1, 'SM_HIT'], [.36, 'SM_FOLLOW'], [.8, 'READY']], sj: [[0, 'SM_BACK'], [.12, 'SM_HIT'], [.45, 'SM_FOLLOW'], [.95, 'READY']],
    vo: [[0, 'VO_BACK'], [.07, 'VO_HIT'], [.3, 'VO_HIT'], [.6, 'READY']], vb: [[0, 'VB_BACK'], [.07, 'VB_HIT'], [.3, 'VB_HIT'], [.6, 'READY']],
    tw: [[0, 'TW_BACK'], [.08, 'TW_HIT'], [.35, 'TW_FOLLOW'], [.9, 'READY']],
  };
  // 引拍阶段：先转体引拍（PREP），再拍头下沉（DROP）
  const PREP = { fh_top: ['FH_PREP', 'FH_DROP'], fh_flat: ['FH_PREP', 'FH_DROP'], fh_lob: ['FH_PREP', 'FH_DROP'], fh_slice: ['FH_SL_PREP', 'FH_SL_PREP'], fh_drop: ['FH_SL_PREP', 'FH_SL_PREP'],
    b2_top: ['B2_PREP', 'B2_DROP'], b2_flat: ['B2_PREP', 'B2_DROP'], b2_lob: ['B2_PREP', 'B2_DROP'], b1_top: ['B1_PREP', 'B1_DROP'], b1_lob: ['B1_PREP', 'B1_DROP'],
    bs_slice: ['BS_PREP', 'BS_PREP'], bs_drop: ['BS_PREP', 'BS_PREP'], sm: ['SM_BACK', 'SM_BACK'], vo: ['VO_BACK', 'VO_BACK'], vb: ['VB_BACK', 'VB_BACK'] };
  const STYLE_OF = { topspin: 'top', top: 'top', flat: 'flat', slice: 'slice', lob: 'lob', drop: 'drop', kick: 'top' };
  function strokeKey(fore, bh, style) {
    if (fore) return 'fh_' + style;
    if (style === 'slice' || style === 'drop') return 'bs_' + style;
    if (bh === 'one') return style === 'lob' ? 'b1_lob' : 'b1_top';
    return 'b2_' + (style === 'slice' ? 'top' : style);
  }
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
    if (e.tweener) return 'tw';
    if (e.kind === 'serve' || e.kind === 'smash') return e.jump ? 'sj' : 'sm';
    if (e.kind === 'volley') return e.fore ? 'vo' : 'vb';
    if (e.lunge) return e.fore ? 'lf' : 'lb';
    return strokeKey(e.fore, m.bh, STYLE_OF[e.kind] || STYLE_OF[e.spin] || 'top');
  }
  const tmpPose = Object.assign({}, R0), tmpPose2 = Object.assign({}, R0);
  // rp = true 时为回放：只按记录的位置和挥拍播放，不读实时比赛状态
  function animatePlayer(m, o, side, dt, rp) {
    const a = m.a;
    const nx = o.x, ny = o.y, vx = (nx - a.px) / Math.max(dt, 1e-3), vy = (ny - a.py) / Math.max(dt, 1e-3), sp = Math.hypot(vx, vy);
    const prevSpd = a.spd;
    a.spd += (Math.min(sp, 9) - a.spd) * Math.min(1, dt * 10); a.px = nx; a.py = ny;
    a.vx = (a.vx || 0) + (vx - (a.vx || 0)) * Math.min(1, dt * 8); a.vy = (a.vy || 0) + (vy - (a.vy || 0)) * Math.min(1, dt * 8);
    // 急停时球鞋摩擦声（硬地）
    if (!rp && mode === 'game' && prevSpd > 4.2 && a.spd < 2.4 && clock - (a.sq || 0) > .7) { a.sq = clock; Sfx.squeak() }
    m.root.position.set(nx, 0, ny);
    let target, swT = 0, prepping = false;
    if (a.fixed) target = POSES[a.fixed.pose] || swingPose(a.fixed.key, a.fixed.t, tmpPose);   // 调试：定格某个动作
    else if (mode === 'menu') target = a.emote ? POSES[a.emote.pose] : POSES.STAND;
    else if (a.emote && clock - a.emote.t < a.emote.dur) target = POSES[a.emote.pose];
    else if (a.sw) {
      swT = (clock - a.sw.t0) * (a.sw.rate || 1);
      const ks = SWINGS[a.sw.kind];
      if (swT > ks[ks.length - 1][0]) a.sw = null;
      target = a.sw ? swingPose(a.sw.kind, swT, tmpPose) : POSES.READY;
    } else if (rp || mode === 'intro') target = mode === 'intro' ? POSES.STAND : POSES.READY;
    else if (phase === 'serve' && toss && toss.server === side) {
      const t = now - toss.t0;
      if (t < 0) target = toss.walking && toss.walking[side] ? POSES.WALK : t > -1.0 ? POSES.DRIBBLE : POSES.SERVE_STANCE;
      else target = t < .5 ? blend(tmpPose, POSES.SERVE_STANCE, POSES.SERVE_TOSS, ease(t / .5)) : blend(tmpPose, POSES.SERVE_TOSS, POSES.SM_BACK, ease(clamp((t - .5) / .35, 0, 1)));
    } else if (phase === 'serve' && toss && toss.walking && toss.walking[side]) target = POSES.WALK;
    else if (phase === 'rally' && plan && plan.side === side && plan.t - now < .6) {
      // 引拍：0.6→0.22 秒转体引拍，0.22→0 秒拍头下沉
      const fore = side === 0 ? plan.x >= o.x : plan.x <= o.x, rem = plan.t - now;
      const style = side === 0 ? (U.blossom ? 'drop' : STYLE_OF[shot]) : 'top';
      const key = plan.kind === 'smash' ? 'sm' : plan.kind === 'volley' ? (fore ? 'vo' : 'vb') : strokeKey(fore, m.bh, style);
      const [pp, dp] = PREP[key] || PREP.fh_top;
      target = rem > .22 ? blend(tmpPose, POSES.READY, POSES[pp], ease(clamp((.6 - rem) / .38, 0, 1))) : blend(tmpPose, POSES[pp], POSES[dp], ease(clamp((.22 - rem) / .22, 0, 1)));
      prepping = true;
    } else target = phase === 'over' ? POSES.STAND : phase === 'dead' && a.spd < 3.5 ? POSES.WALK : POSES.READY;
    const k = a.fixed ? 1 : Math.min(1, dt * (a.sw ? 40 : prepping ? 18 : 10));
    const p = a.pose; for (const key in R0) p[key] += (target[key] - p[key]) * k;
    // 跳起扣杀 / 低球下蹲 / 高球抬臂 / 分腿垫步
    let jumpAdd = 0, tuck = 0, low = 0, high = 0, spread = 0;
    if (a.sw && a.sw.jump) { const j = Math.sin(clamp(swT / .45, 0, 1) * Math.PI); jumpAdd = j * .5; tuck = j }
    if (a.sw && a.sw.low) low = Math.sin(clamp(swT / .4, 0, 1) * Math.PI) * .22;
    if (a.sw && a.sw.hz > 1.2 && /^(fh|b1|b2|bs)/.test(a.sw.kind)) high = Math.sin(clamp(swT / .3, 0, 1) * Math.PI) * clamp((a.sw.hz - 1.1) * .7, 0, .7);
    if (a.split && !rp) { const st = clock - a.split; if (st < .32) { jumpAdd += Math.sin(st / .32 * Math.PI) * .09; spread = Math.sin(clamp(st / .32, 0, 1) * Math.PI / 2) * .12 } }
    if (a.emote && a.emote.bounce) jumpAdd += Math.abs(Math.sin((clock - a.emote.t) * 6)) * .18;
    // 跑步：短距离侧滑步面朝球网，长距离冲刺时身体转向跑动方向
    const walking = target === POSES.WALK;
    const run = clamp(a.spd / (walking ? 2.5 : 5), 0, 1) * (mode === 'menu' || mode === 'ceremony' ? 0 : 1);
    a.phase += dt * (walking ? 7 : 6 + a.spd * 1.6);
    const sw = Math.sin(a.phase), cw = Math.cos(a.phase), stride = walking ? .45 : .8;
    const idle = mode === 'menu' ? Math.sin(clock * 2) * .01 : Math.abs(Math.sin(clock * 5)) * .02 * (1 - run);
    const face = side === 0 ? Math.PI : 0;
    let yaw = 0;
    if (!prepping && !a.sw && a.spd > 4 && mode === 'game') {
      const moveYaw = Math.atan2(a.vx, a.vy);
      let rel = moveYaw - face; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      if (Math.abs(rel) < 1.9) yaw = clamp(rel, -1.1, 1.1) * clamp((a.spd - 4) / 2, 0, 1);
    }
    a.yaw = (a.yaw || 0) + (yaw - (a.yaw || 0)) * Math.min(1, dt * 8);
    m.root.rotation.y = face + p.turn + a.yaw;
    m.hips.position.y = .95 - p.crouch - low + idle + Math.abs(cw) * .04 * run + p.jump + jumpAdd;
    m.hips.rotation.y = p.hipY;
    m.torso.rotation.set(p.torsoX + run * (walking ? .02 : .15) + low * .6, p.torsoY, 0);
    // 头部始终看着球（回合中）
    let hy = 0;
    if (mode !== 'menu' && ball.vis && (phase === 'rally' || phase === 'serve' || rp)) {
      const bx = rp ? ballMesh.position.x : ball.x, bz = rp ? ballMesh.position.z : ball.y;
      const ang = Math.atan2(bx - nx, bz - ny) - m.root.rotation.y - p.hipY - p.torsoY;
      hy = clamp(Math.atan2(Math.sin(ang), Math.cos(ang)), -1.1, 1.1);
    }
    m.head.rotation.x = p.headX; m.head.rotation.y += (hy - m.head.rotation.y) * Math.min(1, dt * 10);
    m.legs[0].thigh.rotation.set(p.rThigh + sw * stride * run - tuck * .7 - low * 1.2, 0, p.rThZ - spread);
    m.legs[0].knee.rotation.x = p.rKnee + Math.max(0, -cw) * .9 * run + tuck * 1.2 + low * 1.6;
    m.legs[1].thigh.rotation.set(p.lThigh - sw * stride * run - tuck * .4 - low * 1.2, 0, p.lThZ + spread);
    m.legs[1].knee.rotation.x = p.lKnee + Math.max(0, cw) * .9 * run + tuck * .9 + low * 1.6;
    const armSwing = a.sw || prepping ? 0 : run;
    m.arms.r.sh.rotation.set(p.rShX - high + sw * .25 * armSwing, p.rShY, p.rShZ); m.arms.r.el.rotation.x = p.rEl;
    m.arms.l.sh.rotation.set(p.lShX - sw * .55 * armSwing, p.lShY, p.lShZ); m.arms.l.el.rotation.x = p.lEl;
    m.racket.rotation.set(p.wrist, 0, p.wristZ);
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
  // ---------- 额外道具：彩带、奖杯、跑位标记 ----------
  let confetti = [], trophy, moveMark, punch = 0;
  function buildExtras() {
    const cols = [0xd7f94a, 0xffffff, 0x2f7dff, 0xff5a4f, 0xffc84a, 0xff8fbf];
    for (let i = 0; i < 140; i++) {
      const m = new T.Mesh(new T.PlaneGeometry(.09, .05), new T.MeshBasicMaterial({ color: cols[i % cols.length], side: T.DoubleSide }));
      m.visible = false; scene.add(m); confetti.push({ m, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, life: 0 });
    }
    const gold = new T.MeshPhongMaterial({ color: 0xffc84a, emissive: 0x4a3000, shininess: 90, specular: 0xffffff });
    const pts = [[0, 0], [.13, 0], [.13, .04], [.05, .07], [.04, .2], [.06, .24], [.16, .3], [.18, .48], [.16, .5], [0, .5]].map(p => new T.Vector2(p[0], p[1]));
    trophy = new T.Group();
    trophy.add(new T.Mesh(new T.LatheGeometry(pts, 24), gold));
    for (const s of [-1, 1]) { const h = new T.Mesh(new T.TorusGeometry(.07, .015, 8, 16, Math.PI), gold); h.position.set(s * .18, .4, 0); h.rotation.z = s * -Math.PI / 2; trophy.add(h) }
    trophy.visible = false; scene.add(trophy);
    moveMark = new T.Mesh(new T.RingGeometry(.3, .4, 28), new T.MeshBasicMaterial({ color: 0x6fc3ff, transparent: true, opacity: .8, depthWrite: false }));
    moveMark.rotation.x = -Math.PI / 2; moveMark.visible = false; scene.add(moveMark);
  }
  function confettiBurst(cx, cz, n = 140) {
    for (let i = 0; i < Math.min(n, confetti.length); i++) {
      const c = confetti[i];
      c.m.position.set(cx + rnd(-3, 3), rnd(5, 9), cz + rnd(-3, 3)); c.vx = rnd(-.6, .6); c.vy = rnd(-1.6, -.8); c.vz = rnd(-.6, .6);
      c.rx = rnd(-8, 8); c.ry = rnd(-8, 8); c.life = rnd(4, 7); c.m.visible = true;
    }
  }
  function updateConfetti(dt) {
    for (const c of confetti) {
      if (c.life <= 0) continue;
      c.life -= dt; if (c.life <= 0 || c.m.position.y < 0) { c.m.visible = false; c.life = 0; continue }
      c.m.position.x += (c.vx + Math.sin(clock * 3 + c.rx) * .4) * dt; c.m.position.y += c.vy * dt; c.m.position.z += c.vz * dt;
      c.m.rotation.x += c.rx * dt; c.m.rotation.y += c.ry * dt;
    }
  }

  // ---------- 模式：menu / intro / game / replay / ceremony ----------
  let introT = 0, introCb = null, rp = null, cer = null;
  function setMode(m) {
    mode = m; fitCamera();
    models.A.root.visible = m !== 'menu';
    camera.zoom = 1; camera.updateProjectionMatrix();
    if (m === 'menu') {
      models.P.a.emote = null; ballMesh.visible = ballShadow.visible = false; timing.visible = timingFill.visible = aimMark.visible = false;
      trophy.visible = false; moveMark.visible = false; trail.forEach(s => s.visible = false);
    }
  }
  function playIntro(cb) {
    setMode('intro'); introT = 0; introCb = cb;
    models.P.a.emote = { pose: 'STAND', t: clock, dur: 99 }; models.A.a.emote = { pose: 'STAND', t: clock, dur: 99 };
  }
  function endIntro() {
    if (mode !== 'intro') return;
    models.P.a.emote = models.A.a.emote = null;
    setMode('game'); const cb = introCb; introCb = null; cb && cb();
  }
  // 回放：比赛中持续录制本分的画面，得分后慢动作重播
  const rec = { frames: [], hits: [] };
  function record() {
    if (phase !== 'rally' && phase !== 'dead') return;
    const f = rec.frames; if (f.length > 900) f.shift();
    f.push([now, P.x, P.y, A.x, A.y, ball.x, ball.y, ball.z, ball.vis ? 1 : 0, ball.fire ? 1 : 0]);
  }
  function startReplay(cb) {
    const f = rec.frames; if (f.length < 30) return false;
    const end = f[f.length - 1][0], start = Math.max(f[0][0], end - 3.2);
    rp = { t: start, end, i: 0, rate: .42, side: Math.random() < .5 ? 1 : -1, cb, hits: rec.hits.filter(h => h.t >= start - .1), hi: 0 };
    while (rp.i < f.length - 1 && f[rp.i][0] < start) rp.i++;
    models.P.a.sw = models.A.a.sw = null; models.P.a.emote = models.A.a.emote = null;
    mode = 'replay'; camera.clearViewOffset(); camera.fov = W < H ? 52 : 36; camera.aspect = W / H; camera.updateProjectionMatrix();
    timing.visible = timingFill.visible = aimMark.visible = moveMark.visible = false;
    return true;
  }
  function endReplay() { if (!rp) return; const cb = rp.cb; rp = null; setMode('game'); cb && cb() }
  function updateReplay(dt) {
    const f = rec.frames;
    rp.t += dt * rp.rate;
    while (rp.i < f.length - 2 && f[rp.i + 1][0] <= rp.t) rp.i++;
    const a = f[rp.i], b = f[Math.min(rp.i + 1, f.length - 1)], k = b[0] > a[0] ? clamp((rp.t - a[0]) / (b[0] - a[0]), 0, 1) : 0;
    const L = i => a[i] + (b[i] - a[i]) * k;
    while (rp.hi < rp.hits.length && rp.hits[rp.hi].t - .07 <= rp.t) {
      const h = rp.hits[rp.hi++], m = h.side === 0 ? models.P : models.A;
      m.a.sw = { kind: h.kind, t0: clock, rate: rp.rate, jump: h.jump, low: h.low, hz: h.hz };
    }
    animatePlayer(models.P, { x: L(1), y: L(2) }, 0, dt * rp.rate, true);
    animatePlayer(models.A, { x: L(3), y: L(4) }, 1, dt * rp.rate, true);
    const bx = L(5), by = L(6), bz = L(7);
    ballMesh.visible = ballShadow.visible = a[8] === 1;
    ballMesh.position.set(bx, bz + .06, by); ballShadow.position.set(bx, .01, by);
    trailPts.push([bx, by, bz + .06]); if (trailPts.length > trail.length) trailPts.shift();
    trail.forEach((s, i) => { const p = trailPts[trailPts.length - 1 - i]; s.visible = !!p && i > 0; if (s.visible) { s.position.set(p[0], p[2], p[1]); const q = 1 - i / trail.length; s.scale.setScalar(.2 * q); s.material.opacity = .6 * q; s.material.color.set(a[9] ? '#ff7a2a' : '#eaff6a') } });
    // 电视转播式侧面机位，跟着球走
    const cx = rp.side * (DHW + 5.5), cz = clamp(by * .55, -9, 9) + rp.side * 2;
    camera.position.lerp(new T.Vector3(cx, 2.3, cz + 3), Math.min(1, dt * 3));
    camera.lookAt(bx * .5, Math.min(1.6, bz * .5 + .6), by);
    updateFx(dt * rp.rate); updateCrowd(dt);
    if (rp.t >= rp.end) endReplay();
  }
  // 颁奖 / 赛后：镜头绕着胜者转，彩带落下
  function ceremony(winSide, withTrophy) {
    mode = 'ceremony'; camera.clearViewOffset(); camera.fov = 42; camera.aspect = W / H; camera.updateProjectionMatrix();
    const m = winSide === 0 ? models.P : models.A, l = winSide === 0 ? models.A : models.P;
    cer = { m, t: 0, trophy: withTrophy };
    m.a.sw = l.a.sw = null;
    m.a.emote = { pose: withTrophy ? 'TROPHY' : ['CELEB', 'RACKET_UP', 'KNEEL', 'ROAR'][Math.floor(Math.random() * 4)], t: clock, dur: 99, bounce: true };
    l.a.emote = { pose: 'SAD', t: clock, dur: 99 };
    m.racket.visible = !withTrophy;
    trophy.visible = withTrophy;
    ballMesh.visible = ballShadow.visible = false; timing.visible = timingFill.visible = aimMark.visible = moveMark.visible = false;
    if (winSide === 0) confettiBurst(m.root.position.x, m.root.position.z);
    cheer = 2;
  }
  function endCeremony() { if (cer) { cer.m.racket.visible = true; trophy.visible = false; cer = null } }

  // ---------- 事件 ----------
  function onEvent(type, e) {
    if (type === 'hit') {
      const m = e.side === 0 ? models.P : models.A, kind = swingKind(e, m);
      m.a.sw = { kind, t0: clock - (kind === 'sm' || kind === 'sj' ? .1 : .07), jump: e.jump, low: e.low, hz: e.z };
      (e.side === 0 ? models.A : models.P).a.split = clock + .05;   // 对手出手瞬间：分腿垫步
      rec.hits.push({ t: now, side: e.side, kind, jump: e.jump, low: e.low, hz: e.z });
      const perfect = e.q === 'perfect', hot = e.fire || !!e.ult;
      burst(e.x, e.y, e.z, perfect || hot ? 18 : 8, hot ? '#ff8a2a' : perfect ? '#e6ff5c' : '#ffffff', perfect || hot ? 4 : 2.5, .35, perfect || hot ? .22 : .14);
      ring(e.x, e.y, e.z, hot ? '#ff8a2a' : perfect ? '#e6ff5c' : '#ffffff');
      if (e.kind === 'smash' || e.ult || (e.kmh > 150 && e.side === 0)) shake = .35;
      else if (perfect) shake = .12;
      if (perfect && e.side === 0) punch = .18;
      if (e.lunge && arena.id === 'clay') burst(m.root.position.x, m.root.position.z, .05, 12, arena.dust, 1.4, .7, .4, false);   // 红土滑步扬尘
    } else if (type === 'bounce') {
      mark(e.x, e.y, e.ok);
      burst(e.x, e.y, .05, arena.id === 'clay' ? 10 : 4, arena.dust, 1.1, .6, arena.id === 'clay' ? .35 : .18, false);
    } else if (type === 'point') {
      if (e.train) return;
      const win = e.w === 0 ? models.P : models.A, lose = e.w === 0 ? models.A : models.P;
      const big = e.why === 'ace' || e.rally >= 8 || e.big;
      win.a.emote = { pose: big ? ['ROAR', 'RACKET_UP', 'FIST'][Math.floor(Math.random() * 3)] : 'FIST', t: clock, dur: 1.1, bounce: big };
      lose.a.emote = { pose: 'SAD', t: clock, dur: 1.1 };
      cheer = Math.max(cheer, e.w === 0 ? (big ? 1.5 : 1) : .45);
    } else if (type === 'ult') {
      const m = e.side === 0 ? models.P : models.A;
      m.a.emote = { pose: 'POWER', t: clock, dur: .6 };
      burst(m.root.position.x, m.root.position.z, 1, 24, e.side === 0 ? '#ffd23f' : '#ff5a4f', 3, .6, .3);
      ring(m.root.position.x, m.root.position.z, 1, '#ffd23f'); cheer = Math.max(cheer, .8);
    } else if (type === 'matchStart' || type === 'pointStart') {
      models.P.a.emote = models.A.a.emote = null; rec.frames = []; rec.hits = [];
      if (type === 'matchStart') { models.P.a.px = P.x; models.P.a.py = P.y; models.A.a.px = A.x; models.A.a.py = A.y }
    } else if (type === 'game') cheer = Math.max(cheer, 1.2);
  }
  let aimTgt = null;
  function setAim(t) { aimTgt = t }
  const ray = new T.Raycaster(), groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0), hitV = new T.Vector3();
  function screenToGround(sx, sy) {
    ray.setFromCamera({ x: sx / W * 2 - 1, y: -(sy / H) * 2 + 1 }, camera);
    return ray.ray.intersectPlane(groundPlane, hitV) ? { x: hitV.x, y: hitV.z } : null;
  }

  // ---------- 每帧 ----------
  function updateAuras() {
    const set = (m, c, o) => { m.aura.material.color.set(c); m.aura.material.opacity += (o - m.aura.material.opacity) * .2; m.aura.scale.setScalar(2.4 + Math.sin(clock * 8) * .2) };
    const pU = U.wallT > 0 ? '#ffd23f' : U.flashT > 0 ? '#fff36b' : U.dash ? '#ff8fbf' : (U.meteor || U.volcano || U.eagle) ? '#ff7a2a' : U.phantom ? '#b18cff' : null;
    const frozen = plan && plan.side === 1 && now < plan.made;
    const aU = frozen ? '#7fd3ff' : AU.wallT > 0 ? '#ffd23f' : (AU.meteor || AU.eagle) ? '#ff5a4f' : null;
    set(models.P, pU || '#ffffff', pU && mode === 'game' ? .55 : 0);
    set(models.A, aU || '#ffffff', aU && mode === 'game' ? .6 : 0);
  }
  function update(dt) {
    clock += dt;
    updateConfetti(dt);
    if (mode === 'menu') {
      const m = models.P; animatePlayer(m, { x: 0, y: HL - 4 }, 0, dt); m.root.rotation.y = Math.sin(clock * .4) * .5;
      const r = W < H ? 4.2 : 5.2;
      camera.position.set(Math.sin(clock * .15) * .8 + (W < H ? 0 : -1.4), 1.45, HL - 4 + r);
      camera.lookAt(W < H ? 0 : -1.4 + .9, W < H ? 1.0 : 1.05, HL - 4);
      updateCrowd(dt); updateFx(dt);
      return;
    }
    if (mode === 'replay' && rp) { updateReplay(dt); return }
    if (mode === 'ceremony' && cer) {
      cer.t += dt;
      animatePlayer(models.P, P, 0, dt); animatePlayer(models.A, A, 1, dt);
      const m = cer.m, p = m.root.position, ang = cer.t * .3 + (m === models.P ? Math.PI : 0) + .4, r = (W < H ? 7.2 : 5.6) - Math.min(1, cer.t * .4) * 1.2;
      camera.position.set(p.x + Math.sin(ang) * r, 1.7 + Math.min(1, cer.t * .5) * .4, p.z + Math.cos(ang) * r);
      camera.lookAt(p.x, cer.trophy ? 1.7 : 1.2, p.z);
      if (cer.trophy) { const h = m.torso.getWorldPosition(new T.Vector3()); trophy.position.set(h.x, h.y + .9, h.z); trophy.rotation.y += dt }
      if (cer.m === models.P && Math.random() < dt * 1.2) burst(p.x + rnd(-2, 2), p.z + rnd(-2, 2), rnd(3, 5), 14, ['#ffd23f', '#d7f94a', '#ff8fbf'][Math.floor(Math.random() * 3)], 3, .9, .25);
      updateCrowd(dt); updateFx(dt);
      return;
    }
    if (mode === 'intro') {
      introT += dt;
      const k = clamp(introT / 3.2, 0, 1), e = ease(k);
      animatePlayer(models.P, P, 0, dt); animatePlayer(models.A, A, 1, dt);
      const ang = Math.PI * (1 - e) * .95 + .0001, r = lerp(30, Math.hypot(fit.pos.z, fit.pos.x), e);
      camera.clearViewOffset(); camera.aspect = W / H; camera.fov = W < H ? 60 : 40; camera.updateProjectionMatrix();
      camera.position.set(Math.sin(ang) * r * .6, lerp(20, fit.pos.y, e), Math.cos(ang) * r);
      camera.lookAt(0, lerp(1, fit.look.y, e), lerp(0, fit.look.z, e));
      updateCrowd(dt); updateFx(dt);
      if (introT >= 3.2) endIntro();
      return;
    }
    record();
    animatePlayer(models.P, P, 0, dt); animatePlayer(models.A, A, 1, dt);
    updateAuras();
    // 球
    const show = ball.vis && phase !== 'over';
    ballMesh.visible = ballShadow.visible = show;
    if (show) {
      ballMesh.position.set(ball.x, ball.z + .06, ball.y);
      ballMesh.rotation.x += (ball.wx || 0) * dt * .2; ballMesh.rotation.z -= (ball.wy || 0) * dt * .2; ballMesh.rotation.y += 8 * dt;
      ballShadow.position.set(ball.x, .01, ball.y);
      const sc = 1 + ball.z * .25; ballShadow.scale.set(sc, sc, 1); ballShadow.material.opacity = clamp(.4 - ball.z * .05, .12, .4);
      trailPts.push([ball.x, ball.y, ball.z + .06]); if (trailPts.length > trail.length) trailPts.shift();
      if (ball.fire && phase === 'rally' && Math.random() < .7) burst(ball.x, ball.y, ball.z + .06, 1, Math.random() < .5 ? '#ff5a1f' : '#ffc84a', .6, .35, .22);
    } else trailPts.length = 0;
    const fast = Math.hypot(ball.vx, ball.vy) > 6 && phase === 'rally';
    trail.forEach((s, i) => {
      const p = trailPts[trailPts.length - 1 - i];
      s.visible = !!p && fast && i > 0;
      if (s.visible) { s.position.set(p[0], p[2], p[1]); const k = 1 - i / trail.length; s.scale.setScalar((ball.fire ? .3 : .17) * k); s.material.opacity = .55 * k; s.material.color.set(ball.fire ? '#ff7a2a' : '#eaff6a') }
    });
    // 击球时机光圈
    let rem = null, at = null;
    if (phase === 'rally' && plan && plan.side === 0) { rem = plan.t - now; at = [plan.x, plan.y, plan.z + .06] }
    else if (phase === 'serve' && toss && toss.server === 0) { rem = TOSS_IDEAL - (now - toss.t0); at = [ball.x, ball.y, ball.z + .06] }
    if (rem !== null && rem < 1.1 && rem > -lateWin()) {
      const far = phase === 'rally' && Math.hypot(P.x - plan.x, P.y - plan.y) > playerReach(plan) + moveSpeed() * Math.max(0, Math.min(rem, plan.t - plan.made - P_REACT));
      const pw = perfectWin(), inP = Math.abs(rem) <= pw;
      const size = .32 * (1 + Math.max(0, rem) * 3.4);
      timing.visible = true; timing.position.set(at[0], at[2], at[1]); timing.scale.set(size, size, 1);
      timing.material.color.set(far ? '#ff5b5b' : inP ? '#c8ff4d' : '#ffffff');
      timing.material.opacity = rem > EARLY ? .45 : 1;
      timingFill.visible = !!buffered || inP; timingFill.position.copy(timing.position); timingFill.scale.set(size * 1.1, size * 1.1, 1);
      timingFill.material.color.set(buffered ? '#c8ff4d' : '#ffffff'); timingFill.material.opacity = buffered ? .5 : .25;
    } else timing.visible = timingFill.visible = false;
    // 瞄准 / 跑位标记
    if (aimTgt) { aimMark.visible = true; aimMark.position.set(aimTgt.x, .02, aimTgt.y); aimMark.scale.setScalar(1 + Math.sin(clock * 10) * .06) }
    else aimMark.visible = false;
    moveMark.visible = !!P.manual; if (P.manual) { moveMark.position.set(P.manual.x, .02, P.manual.y); moveMark.scale.setScalar(1 + Math.sin(clock * 8) * .08) }
    updateFx(dt); updateCrowd(dt);
    // 相机跟随 + 震动 + PERFECT 推镜
    camFollow.x += (clamp(P.x, -4, 4) * .28 - camFollow.x) * Math.min(1, dt * 3);
    shake = Math.max(0, shake - dt);
    const sk = shake * shake * .6;
    camera.position.set(fit.pos.x + camFollow.x + rnd(-sk, sk), fit.pos.y + rnd(-sk, sk), fit.pos.z);
    camera.lookAt(fit.look.x + camFollow.x, fit.look.y, fit.look.z);
    if (punch > 0 || camera.zoom !== 1) { punch = Math.max(0, punch - dt); camera.zoom = 1 + Math.sin(punch / .18 * Math.PI) * .06; camera.updateProjectionMatrix() }
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
  // 调试：定格动作 + 自定义机位（用于检查每一帧挥拍姿态）
  let dbgCam = null;
  function debugPose(side, f) { (side === 0 ? models.P : models.A).a.fixed = f }
  function debugCam(c) { dbgCam = c }
  function render() {
    if (dbgCam) { camera.clearViewOffset(); camera.fov = 30; camera.aspect = W / H; camera.updateProjectionMatrix(); camera.position.set(...dbgCam.pos); camera.lookAt(...dbgCam.look) }
    renderer.render(scene, camera);
  }
  return { init, buildArena, resize, update, render, setMode, setAim, setPlayerLook, setOpponentLook, onEvent, project, setQuality, screenToGround,
    playIntro, endIntro, startReplay, endReplay, ceremony, endCeremony, debugPose, debugCam, get mode() { return mode }, get arena() { return arena } };
})();
