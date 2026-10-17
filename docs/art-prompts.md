# Tennis Smash 2026：美术图片生成提示词

把生成好的图片按下面的**文件名**上传到 GitHub 仓库的 `art/incoming/` 文件夹，我来裁切、压缩、接进游戏。
（在手机上：打开仓库 → Add file → Upload files，可以一次选很多张。也可以直接在聊天里发给我。）

---

## 0. 先看这几条（决定成品能不能用）

1. **风格要统一**：每条提示词后面都加上下面这段**统一风格词**，不要改。
2. **同一个人要长得一样**：每个球员先生成"半身像 n"，满意后把它当参考图（图生图 / 角色参考 / `--cref`）再生成其他表情和全身图。
3. **背景**：人物、图标、奖杯这些需要抠图的图，要求**纯色背景**。默认用纯绿 `#00B140`；穿绿色或青色衣服的角色（小雨、森林绿球衣）改用纯品红 `#FF00FF`。如果你的工具能直接出**透明背景 PNG**（例如 ChatGPT 生图），就用透明背景。
4. **不要真实球星、不要真实品牌**：别出现 Nike、Adidas、Wilson 之类的标志，也别写真人名字。衣服上只能有简单的几何小图标。
5. **不要文字**：图里不要有任何字（标志页除外），文字我在游戏里加。
6. **尺寸**：每条都标了比例。生成大一点没关系，我会缩小。
7. 推荐工具：ChatGPT 生图、Midjourney、即梦、可灵、豆包都可以。人物用 Midjourney 或即梦效果最好。

### 统一风格词（每条后面都加）

```
semi-realistic stylized 3D render, AAA mobile sports game art like Tennis Clash, Unreal Engine 5, subsurface skin, detailed fabric, crisp rim light, soft cinematic studio lighting, vibrant but natural colors, high detail, sharp focus, no text, no watermark, no logos
```

### 抠图背景词（人物、图标、物品后面再加）

```
isolated on a plain solid chroma green background #00B140, no shadow on background, full subject visible, centered
```
（小雨和绿色衣服换成 `plain solid magenta background #FF00FF`）

---

## 1. 标志、图标、启动页

| 文件名 | 比例 | 提示词 |
|---|---|---|
| `logo.png` | 2:1 | Game logo text "TENNIS SMASH" with a smaller "2026" badge, bold italic sporty 3D lettering, neon lime yellow (#d7f94a) and white with deep navy outline, a tennis ball streaking with motion trail through the letters, dynamic angle, glossy, isolated on plain solid magenta background #FF00FF（这一张允许有文字） |
| `app-icon.png` | 1:1 | App icon, a glowing neon-lime tennis ball smashing through a deep navy background with speed lines and a sliver of blue tennis court, bold simple shapes readable at small size, rounded-square composition, no text |
| `splash.png` | 9:16 | Mobile game loading screen key art, a heroic young tennis player mid-air smashing a ball, stadium floodlights and a packed crowd behind, blue hard court, lens flare, dramatic low angle, empty space at top third for a logo, no text |
| `splash-land.png` | 16:9 | 同上，横版构图，人物在右侧三分之一，左侧留空放标志 |

---

## 2. 八名可选球员（最重要）

每个球员要 **6 张**：

| 文件名 | 比例 | 用途 |
|---|---|---|
| `<id>-n.png` | 1:1 | 半身像，自然自信（主图，其他图都参考它） |
| `<id>-f.png` | 1:1 | 半身像，专注 / 凶狠（大招、技能按钮用） |
| `<id>-w.png` | 1:1 | 半身像，赢球庆祝（结算用） |
| `<id>-full.png` | 2:3 | 全身站姿，拿着球拍（选人界面） |
| `<id>-action.png` | 2:3 | 全身击球动作（对阵页、加载页） |
| `<id>-ult.png` | 2:1 | 大招特写插画，背景也画（大招动画用） |

半身像统一构图：**头到胸口，脸在画面上半部中间，正面略侧 3/4 视角，看镜头**。

每个人的提示词由三段组成：`[角色描述] + [这张图的描述] + 统一风格词 (+ 抠图背景词)`。

### 每张图的描述（拼在角色描述后面）

- **n**：`head and shoulders portrait, chest up, three-quarter view, looking at camera, confident relaxed smile`
- **f**：`head and shoulders portrait, chest up, intense focused determined expression, slight low angle, dramatic rim light, sweat drops`
- **w**：`head and shoulders portrait, chest up, celebrating victory, shouting with joy, fist raised near face, confetti in the air`
- **full**：`full body standing pose, holding a tennis racket at the side, feet visible, slight three-quarter view, confident stance`
- **action**：`full body dynamic action pose hitting a powerful forehand, ball on the strings, motion blur on racket, feet off the ground slightly`
- **ult**：见每个角色下面单独写的大招描述（这张不抠图，要背景）

### 2.1 阿凯 `kai`，全能新星（初始角色）

角色描述：
```
a 22-year-old East Asian male professional tennis player, 180 cm athletic build, short black textured hair, warm light-tan skin, friendly handsome face, royal blue (#2f6fe0) crew-neck performance tennis shirt with thin white trim, navy shorts, white headband, white wristbands, white tennis shoes, two-handed backhand player
```
大招 `kai-ult.png`：`he smashes a blazing meteor forehand, the ball wrapped in roaring fire with a long flame trail, sparks and embers, stadium at night behind, epic anime-inspired composition, dramatic orange and blue lighting`

### 2.2 小雨 `yu`，切削魔术师（用品红背景）

```
a 20-year-old East Asian female tennis player, 168 cm slim athletic build, long dark-brown hair in a high ponytail, fair skin, clever calm expression, teal (#22b5a5) sleeveless tennis top, white tennis skort, teal headband, white shoes, one-handed backhand slice specialist
```
大招：`she carves a one-handed backhand slice, the ball curving with glowing teal phantom afterimages and swirling ribbons of light, magical elegant composition, dusk sky`

### 2.3 大熊 `bear`，铁壁

```
a 28-year-old big muscular mixed-race male tennis player, 190 cm heavy powerful build, light-brown skin, short dark hair, medium full beard, calm stoic face, brown (#8a5a2b) tennis shirt, dark charcoal shorts, yellow (#ffd23f) headband, white shoes, defensive wall player
```
大招：`he stands firm as a giant translucent golden hexagon shield wall rises in front of him, deflecting tennis balls, impact sparks, heroic low angle`

### 2.4 Leo `leo`，闪电

```
a 23-year-old slim fast European male tennis player, 185 cm lean athletic build, wavy blond hair, fair skin, bright grin, yellow (#ffd23f) tennis shirt, black shorts, black headband, black-and-white shoes, the fastest runner on tour
```
大招：`he sprints across the court leaving a trail of crackling electric blue-yellow lightning and afterimages, sparks under his shoes, extreme motion`

### 2.5 樱 `sakura`，网前之花

```
a 21-year-old Japanese female tennis player, 165 cm petite athletic build, black hair in a neat bun, fair skin, gentle but sharp eyes, pink (#ff8fbf) tennis top, white tennis skort, pink headband, white shoes, net-rushing volley specialist
```
大招：`she leaps to the net for a delicate drop volley as a storm of cherry blossom petals swirls around her, soft pink glow, beautiful spring atmosphere`

### 2.6 Nova `nova`，冰山女王

```
a 24-year-old tall European female tennis player, 178 cm athletic build, long straight platinum-blonde hair, pale skin, cool icy stare, ice blue (#b1e2ff) tennis top, deep navy (#25557c) tennis skort, white headband, white shoes, cold precise baseliner
```
大招：`she hits a shot that freezes the air, jagged ice crystals bursting across the court, frost mist, opponent's side covered in frost, cold blue and white palette`

### 2.7 Rex `rex`，火山

```
a 26-year-old powerful Black male tennis player, 188 cm heavily muscular build, dark-brown skin, curly reddish-brown frizzy hair, fierce grin, red (#e5412f) tennis shirt, black shorts, yellow headband, black shoes, explosive power hitter
```
大招：`he leaps high for a volcanic overhead smash, lava and fire erupting behind him, cracked glowing court, molten sparks, red and black palette`

### 2.8 鹰眼·陈 `chen`，天鹰发球

```
a 27-year-old Chinese male tennis player, 183 cm lean athletic build, short black side-parted hair, light-tan skin, black wayfarer sunglasses, cool composed smirk, crisp white tennis shirt, black shorts, gold (#e8b84a) headband, white shoes, serve specialist
```
大招：`he serves at 230 km/h, a giant spectral golden eagle spreading its wings behind him, the ball piercing the air like a bullet with a shockwave ring`

---

## 3. 对手（12 个巡回赛 + 3 个快速比赛 + 陪练）

每人 **3 张半身像**：`<id>-n.png`（自然）、`<id>-f.png`（专注 / 凶狠）、`<id>-w.png`（庆祝）。构图和第 2 节一样，拼上同样的"每张图的描述"。

| id | 名字 | 角色描述 |
|---|---|---|
| `ajie` | 阿杰（第一个对手，城市公园） | young East Asian male club player, short flat black hair, light skin, eager expression, red (#e0533d) tennis shirt, dark shorts, white headband |
| `mia` | Mia | young mixed-race female, long auburn wavy hair, light skin, freckles, pink (#ff7eb6) top, white skort, pink headband |
| `zhou` | 小周 | young East Asian male, short curly black hair, round glasses, cheeky grin, yellow (#f2c230) shirt, navy shorts |
| `pablo` | Pablo（红土站） | stocky Latino male, short Caesar haircut, light beard, tanned skin, white shirt, terracotta (#c4643a) shorts, terracotta headband |
| `lucia` | Lucía | Latina female, long curly dark-brown hair, tanned skin, teal (#22b5a5) top, white skort, teal headband（品红背景） |
| `mateo` | Mateo | athletic mixed-race male, shoulder-length dreadlocks, brown skin, orange (#ff8a1f) shirt, black shorts, white headband |
| `oliver` | Oliver（草地站） | tall British male, wavy blond hair, fair skin, polite smile, all-white traditional tennis outfit |
| `grace` | Grace | Black female, voluminous afro, dark skin, all-white outfit, purple (#6a2c91) headband |
| `henry` | Henry | European male in his 30s, short side hair, elegant curled moustache, fair skin, all-white outfit, dark green headband |
| `ivan` | Ivan（夜场） | very tall Eastern European male 196 cm, short blond round-cut hair, cold face, all-black outfit, red headband |
| `yingzi` | 樱子 | Japanese female, black bob haircut, fair skin, light pink (#ffb3c7) top, navy skort, white headband |
| `wang` | 雷霆·王（最终 Boss） | imposing Chinese male 188 cm, shaved sides with short top, black wayfarer sunglasses, intimidating confident smile, yellow (#ffd23f) shirt with black trim, black shorts, black headband, aura of a champion |
| `q0` | 路人球友 | ordinary friendly man in his 30s, short brown hair, casual green (#5b8c5a) t-shirt, recreational player（品红背景） |
| `q1` | 俱乐部高手 | fit club-level male player, short dark hair, tan skin, navy (#3c4f9a) polo shirt, white shorts, white headband |
| `q2` | 职业选手 | elite pro male player, wavy light-brown hair, fair skin, sport sunglasses on head, charcoal (#262e33) outfit, lime (#d7f94a) headband |
| `coach` | 陪练 | stocky friendly coach in his 50s, grey cap, light grey beard, grey (#4b5563) polo, whistle around neck, lime headband on wrist |

> 对手的 `-f` 和 `-w` 如果嫌多，**至少要 `-n`**，其他我可以先复用。

---

## 4. 四个赛场

每个赛场 **3 张**：

| 文件名 | 比例 | 用途 |
|---|---|---|
| `arena-<id>.png` | 9:16 | 竖屏菜单 / 对阵背景（不要人） |
| `arena-<id>-land.png` | 16:9 | 横屏版本 |
| `arena-<id>-card.png` | 4:3 | 巡回赛选站卡片 |

赛场描述（再拼上 `wide establishing shot of an empty tennis stadium, no players, eye-level from behind the baseline` + 统一风格词）：

- `city` 城市公园公开赛：`urban public park tennis court, blue hard court with white lines, chain-link fence, modern city skyline with glass towers, bright sunny day, small metal bleachers with a casual crowd`
- `clay` 红土大师赛：`elegant red clay tennis court, terracotta surface with brushed texture, tall green cypress and plane trees, warm Mediterranean afternoon sun, wooden stands, green windscreen banners`
- `grass` 草地锦标赛：`prestigious grass tennis championship, perfectly mowed lawn with light and dark stripes, ivy-covered walls, white and dark green clubhouse, classic English summer day`
- `night` 夜场总决赛：`grand final stadium at night, purple-blue hard court glowing under huge floodlights, packed arena with thousands of fans and phone lights, giant screens, dramatic atmosphere, light haze`

---

## 5. 界面背景与场景插画

| 文件名 | 比例 | 提示词 |
|---|---|---|
| `bg-home.png` | 9:16 | Abstract premium sports game menu background, deep navy to midnight blue gradient, subtle tennis court line geometry in perspective, soft neon lime and electric blue light streaks, bokeh stadium lights, clean space for UI, no people, no text |
| `bg-vs.png` | 16:9 | Versus screen background, split diagonally into a blue half (left) and a red half (right), energy lightning clash in the center, sparks, stadium lights, no people, no text |
| `bg-vs-port.png` | 9:16 | 同上，竖版，上下对分（上蓝下红） |
| `bg-victory.png` | 9:16 | Victory celebration background, golden light rays from above, confetti and streamers falling, stadium crowd silhouette cheering, warm gold and lime palette, no people in focus, no text |
| `bg-defeat.png` | 9:16 | Moody defeat background, empty stadium at dusk, rain drops, cool blue-grey palette, a single tennis ball on the court line, melancholic, no text |
| `bg-ceremony.png` | 9:16 | Trophy ceremony stage on a tennis court, red carpet, podium, spotlights and golden confetti, packed crowd, no people on stage, no text |
| `bg-career.png` | 9:16 | Stylized world tour map, glowing route line connecting four tennis venues (city park, red clay, grass, night stadium) as small 3D dioramas, navy background, no text |
| `bg-shop.png` | 9:16 | Locker room with lockers, tennis rackets, shoes and outfits on display, warm spotlights, premium sports store mood, no people, no text |
| `bg-train.png` | 9:16 | Training court with a ball machine, cones and a basket of tennis balls, morning light, no people, no text |

---

## 6. 大招与技能图标（1:1，抠图）

统一加：`game skill icon, circular badge composition, bold readable silhouette, glowing effect, isolated on plain solid chroma green background #00B140`

| 文件名 | 提示词 |
|---|---|
| `skill-fire.png` | flaming tennis ball, orange and yellow fire |
| `skill-zone.png` | target crosshair with a glowing lime ring and a tennis ball in the center |
| `ult-meteor.png` | blazing meteor tennis ball with a fire trail（阿凯） |
| `ult-phantom.png` | curving tennis ball with teal phantom afterimages（小雨，品红背景） |
| `ult-wall.png` | golden hexagon shield（大熊） |
| `ult-flash.png` | lightning bolt and a sprinting shoe（Leo） |
| `ult-blossom.png` | cherry blossom petals around a tennis ball（樱） |
| `ult-freeze.png` | ice crystal snowflake with a frozen tennis ball（Nova） |
| `ult-volcano.png` | erupting volcano with a tennis ball as lava rock（Rex） |
| `ult-eagle.png` | golden eagle head with a tennis ball（陈） |

---

## 7. 击球按钮图标（1:1，抠图，风格要简洁扁平一点）

统一加：`minimal flat game UI icon, white glyph with subtle lime glow, simple bold shape, isolated on plain solid magenta background #FF00FF`

| 文件名 | 提示词 |
|---|---|
| `shot-topspin.png` | tennis ball with a curved forward arrow arcing over (topspin) |
| `shot-flat.png` | tennis ball with a straight fast arrow and speed lines |
| `shot-slice.png` | tennis ball with a downward curving backspin arrow |
| `shot-angle.png` | tennis ball with a sharp diagonal arrow toward a corner |
| `shot-lob.png` | tennis ball with a high rainbow arc arrow |
| `shot-drop.png` | tennis ball softly dropping just over a net |
| `shot-net.png` | tennis net with a player silhouette rushing forward |
| `serve-flat.png` | serving silhouette with a straight fast arrow |
| `serve-slice.png` | serving silhouette with an arrow curving outward |
| `serve-kick.png` | serving silhouette with a high bouncing arrow |

---

## 8. 物品：装备、货币、奖杯、宝箱（1:1，抠图）

统一加：`game item icon, 3D rendered object, glossy, three-quarter view, soft shadow under object only` + 抠图背景词

| 文件名 | 提示词 |
|---|---|
| `coin.png` | shiny gold coin with an embossed tennis ball |
| `coins-pile.png` | pile of gold coins with embossed tennis balls |
| `gem.png` | faceted lime-green gem crystal |
| `trophy-icon.png` | small golden trophy cup |
| `gear-power.png` | carbon-fiber tennis racket with a glowing red frame accent |
| `gear-control.png` | close-up of racket strings with a glowing blue precision grid |
| `gear-agility.png` | lightweight white tennis shoe with a lime speed accent |
| `gear-stamina.png` | sports wristband with a glowing green energy line |
| `gear-serve.png` | tennis ball on a racket with a speed gauge |
| `chest-common.png` | blue sports kit bag treasure chest, closed |
| `chest-rare.png` | purple premium tennis bag chest with gold trim, glowing |
| `chest-epic.png` | gold-and-black legendary chest overflowing with light |
| `lock.png` | 3D metal padlock |
| `ball.png` | single tennis ball, optic yellow felt, white seam |
| `racket.png` | modern tennis racket, white and navy frame |

### 球衣缩略图（1:1，抠图）

统一：`folded performance tennis shirt and shorts set displayed flat lay, top-down view` + 颜色：

| 文件名 | 颜色 |
|---|---|
| `outfit-fire.png` | red (#e5412f) shirt, dark charcoal shorts, yellow trim |
| `outfit-forest.png` | forest green (#2f9e5b) shirt, white shorts（品红背景） |
| `outfit-sakura.png` | pink (#ff8fbf) shirt, white shorts |
| `outfit-volt.png` | electric purple (#7b4dff) shirt, dark navy shorts, lime trim |
| `outfit-gold.png` | black shirt and shorts with gold trim, luxury |

### 赛事奖杯（1:1，抠图）

| 文件名 | 提示词 |
|---|---|
| `cup-city.png` | modern silver tennis trophy cup with a blue enamel band |
| `cup-clay.png` | ornate silver trophy cup with terracotta red accents |
| `cup-grass.png` | classic gilded silver championship trophy with handles and a lid |
| `cup-night.png` | grand golden trophy with a glowing crystal tennis ball on top |

### 等级徽章（1:1，抠图）

`badge-1.png` 到 `badge-5.png`：`sports rank badge emblem, shield shape with laurel wreath and a tennis ball`，材质依次是 **bronze / silver / gold / platinum / diamond**，越高级越华丽、越发光。

---

## 9. 3D 场景贴图（可选，但对比赛画面提升很大）

这些会贴到比赛里的 3D 球场上。要求：**正上方俯视、平铺无缝（seamless tileable）、没有线条、没有阴影、没有透视**，1:1。

| 文件名 | 提示词 |
|---|---|
| `tex-hard.png` | seamless tileable texture, blue acrylic hard tennis court surface, fine sand grain, subtle wear, top-down, flat even lighting |
| `tex-clay.png` | seamless tileable texture, red clay tennis court surface, fine crushed brick with faint sweep marks, top-down, flat lighting |
| `tex-grass.png` | seamless tileable texture, short mowed grass of a tennis lawn, top-down, flat lighting |
| `tex-night.png` | seamless tileable texture, purple-blue acrylic hard court surface, fine grain, top-down, flat lighting |
| `tex-crowd.png` | seamless horizontal strip of a packed stadium crowd in colorful clothes seen from the court, cheering, 4:1 aspect, no text（看台观众贴图，横向 4:1） |
| `board.png` | stadium advertising board, sleek navy panel with "TENNIS SMASH 2026 · ACE TOUR" in lime italic, 8:1 aspect（允许文字） |
| `sky-<id>.png` | equirectangular 360 panorama sky and surroundings for the arena（对应第 4 节四个赛场描述），2:1，no court in the lower part（可选） |

---

## 10. 优先级（时间不够就按这个顺序做）

1. 8 名球员的 `-n`、`-f`、`-w` 半身像（一共 24 张，提升最大）
2. `logo`、`app-icon`、`splash`
3. 8 名球员的 `-full`
4. 对手的 `-n`（16 张）
5. 4 个赛场背景，加上 `bg-home`、`bg-vs`
6. 大招 `-ult` 插画和技能图标
7. 物品、球衣、奖杯
8. 3D 场景贴图

> 说明：这些图会替换**立绘、界面、背景、图标和球场贴图**。比赛里跑动击球的 3D 球员本身不能直接由图片生成，我会继续把 3D 模型做精细，并让它的配色、发型和这些立绘保持一致。
