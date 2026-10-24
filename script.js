/* 티커 브레이커 — 방구석월가 | 미국주식 결을 읽다
   정적 웹앱: 서버·로그인·저장 없음 (기록은 저장되지 않습니다) */
(function () {
"use strict";

/* ---------- 설정 ---------- */
const W = 360, H = 560, COLS = 6, BW = 52, BH = 28, GAP = 4;
const OX = (W - COLS * BW - (COLS - 1) * GAP) / 2, OY = 26;
const PAD_W = 90, PAD_H = 19.5;              // 패들 크기(논리 좌표). 키우면 쉬워지고 줄이면 어려워집니다.
const NAVY = "#101E34", GOLD = "#DCAF61", OFFW = "#F5F2E9", UPC = "#20C997", DNC = "#FF6572";
const SANS = '"Pretendard","SF Pro Display","Helvetica Neue",Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const MAXB = 6, DROP = .28, ITEMS = ["X2", "+1", "-1", "SP+", "SP-"];   // 최대 공 개수 · 아이템 드롭 확률 · 종류
const PAD_MIN = 54, PAD_MAX = 150, SPD_MIN = .44, SPD_MAX = 2.25;      // 패들 폭 한계 · 속도 배율 한계
const IT = {                                                           // 아이템 색상
  "X2":  { c: ["#F7E3AE", "#DCAF61"], g: "#DCAF61" },
  "+1":  { c: ["#5BE6BF", "#20C997"], g: "#20C997" },
  "-1":  { c: ["#FF9AA2", "#FF6572"], g: "#FF6572" },
  "SP+": { c: ["#FFC17A", "#FF9F43"], g: "#FF9F43" },
  "SP-": { c: ["#9CCFFF", "#5AB0FF"], g: "#5AB0FF" }
};
const TICKERS = "AAPL MSFT NVDA GOOGL AMZN META TSLA AVGO BRK.B LLY V JPM WMT XOM UNH MA COST ORCL NFLX HD PG JNJ KO PEP AMD CRM ADBE DIS NKE SBUX PLTR UBER ABNB COIN SOFI RIVN F T INTC PFE BAC PYPL".split(" ");
const BIG = new Set("AAPL MSFT NVDA GOOGL AMZN META TSLA AVGO".split(" "));

/* ---------- 상태 ---------- */
const $ = id => document.getElementById(id);
const cv = $("c"), ctx = cv.getContext("2d", { alpha: false }), ov = $("ov"), wrap = $("wrap");
let sc = 1, state = "title", stateAt = 0, level = 1, score = 0, lives = 3, broken = 0, speed = 4.2, best = 0;
let bricks = [], floats = [], tape = [], parts = [], items = [], balls = [], spd = 1;
let padSprite = null;
let bgIdx = 1, bgPrev = 1, bgFade = 1;          // 현재/이전 배경 번호, 전환 진행도(0→1)
const bgImgs = {}, bgCan = {}, bgBl = {};
const pad = { x: W / 2, y: H - 42, w: PAD_W, h: PAD_H };
const keys = {};

/* 배경: 1라운드 월스트리트 야경, 2라운드부터 뉴욕증권거래소 실내 (dark: 전체 어둡게, lane: 패들·공이 움직이는 아래쪽 추가로 어둡게) */
const BGDEF = { 1: { src: "bg.jpg", dark: .22, lane: .5 }, 2: { src: "bg2.jpg", dark: .55, lane: .7 } };
Object.keys(BGDEF).forEach(k => { const im = new Image(); im.onload = () => { bgImgs[k] = im; makeBg(); }; im.src = BGDEF[k].src; });
function setBg(i) { if (i === bgIdx) return; bgPrev = bgIdx; bgIdx = i; bgFade = 0; }

/* ---------- 화면 크기 ---------- */
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  sc = Math.min(w / W, h / H);
  const d = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = W * sc + "px"; cv.style.height = H * sc + "px";
  cv.width = Math.round(W * sc * d); cv.height = Math.round(H * sc * d);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  ov.style.width = cv.style.width; ov.style.height = cv.style.height; ov.style.setProperty("--s", sc);
  makeBg(); makePad();
}
window.addEventListener("resize", resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

/* ---------- 배경 (사진 + 유리 블록용 흐림 사본) ---------- */
function makeBg() {
  if (!cv.width) return;
  const k = cv.width / W;
  for (const id in BGDEF) {
    const D = BGDEF[id], c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height;
    const g = c.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = "#0a1230"; g.fillRect(0, 0, W, H);
    if (bgImgs[id]) g.drawImage(bgImgs[id], 0, 0, W, H);
    g.fillStyle = "rgba(6,10,18," + D.dark + ")"; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 440, 0, H);
    gr.addColorStop(0, "rgba(5,8,14,0)"); gr.addColorStop(1, "rgba(5,8,14," + D.lane + ")");
    g.fillStyle = gr; g.fillRect(0, 440, W, H - 440);
    const bl = document.createElement("canvas"); bl.width = Math.ceil(W / 8); bl.height = Math.ceil(H / 8);
    bl.getContext("2d").drawImage(c, 0, 0, bl.width, bl.height);
    bgCan[id] = c; bgBl[id] = bl;
  }
}

/* ---------- 골드 메탈 패들 (한 번만 그려 두고 재사용) ---------- */
function makePad() {
  if (!cv.width) return;
  const m = 14, k = cv.width / W, x = m, y = m, w = pad.w, h = pad.h, r = h / 2;
  padSprite = document.createElement("canvas");
  padSprite.width = Math.ceil((w + 2 * m) * k); padSprite.height = Math.ceil((h + 2 * m) * k);
  const g = padSprite.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
  const rr = (a, b, c, d, e) => { g.beginPath(); g.roundRect(a, b, c, d, e); };

  // 배경과 분리되는 은은한 금빛 외곽 + 아래 그림자
  g.save(); g.shadowColor = "rgba(255,214,130,.55)"; g.shadowBlur = 10; rr(x, y, w, h, r); g.fillStyle = "#8a6422"; g.fill(); g.restore();
  g.save(); g.shadowColor = "rgba(0,0,0,.65)"; g.shadowBlur = 8; g.shadowOffsetY = 4; rr(x, y, w, h, r); g.fillStyle = "#6f511b"; g.fill(); g.restore();

  // 금속 본체
  let gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, "#FFF1C2"); gr.addColorStop(.2, "#F0CF82"); gr.addColorStop(.48, GOLD); gr.addColorStop(.74, "#B98B3F"); gr.addColorStop(1, "#8A6422");
  rr(x, y, w, h, r); g.fillStyle = gr; g.fill();

  g.save(); rr(x, y, w, h, r); g.clip();
  gr = g.createLinearGradient(0, y, 0, y + h * .5);                       // 위쪽 밝은 하이라이트
  gr.addColorStop(0, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,.05)");
  g.fillStyle = gr; g.fillRect(x, y, w, h * .5);
  gr = g.createLinearGradient(x, 0, x + w, 0);                            // 금속 광택 띠
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(.22, "rgba(255,255,255,.28)"); gr.addColorStop(.38, "rgba(255,255,255,0)");
  gr.addColorStop(.74, "rgba(255,255,255,.18)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  gr = g.createLinearGradient(0, y + h * .62, 0, y + h);                  // 아래쪽 음영
  gr.addColorStop(0, "rgba(60,36,6,0)"); gr.addColorStop(1, "rgba(60,36,6,.5)");
  g.fillStyle = gr; g.fillRect(x, y + h * .62, w, h * .38);
  g.fillStyle = "rgba(255,255,255,.75)"; g.fillRect(x + r, y + 1.2, w - 2 * r, 1.5);   // 윗면 모서리 빛
  g.restore();
  rr(x + 1, y + 1, w - 2, h - 2, r - 1); g.strokeStyle = "rgba(255,236,170,.35)"; g.lineWidth = 1; g.stroke();
  rr(x + .5, y + .5, w - 1, h - 1, r); g.strokeStyle = "rgba(46,28,4,.9)"; g.lineWidth = 1; g.stroke();

  // WALL STREET 명판 (밝게 오목한 판 + 진한 갈색 각인 글자)
  const px = x + 8, pw = w - 16, py = y + 3.5, ph = h - 7;
  rr(px, py, pw, ph, ph / 2); g.fillStyle = "rgba(255,242,196,.42)"; g.fill();
  rr(px + .5, py + .5, pw - 1, ph - 1, ph / 2); g.strokeStyle = "rgba(90,58,8,.45)"; g.lineWidth = 1; g.stroke();
  const txt = "WALL STREET", maxW = pw - 8;
  let fs = 12, sp = .5, tot = 0, ws = [];
  for (;;) {
    g.font = "900 " + fs + "px " + SANS;
    ws = [...txt].map(c => g.measureText(c).width);
    tot = ws.reduce((a, b) => a + b, 0) + sp * (txt.length - 1);
    if (tot <= maxW || fs <= 6) break;
    fs -= .25;
  }
  g.textAlign = "left"; g.textBaseline = "middle";
  const cy = y + h / 2 + .5;
  [["rgba(255,250,225,.95)", .9], ["#2a1802", 0]].forEach(([col, dy]) => {   // 아래 흰 번짐 → 위 진한 글자
    let cx = x + w / 2 - tot / 2; g.fillStyle = col;
    [...txt].forEach((c, i) => { g.fillText(c, cx, cy + dy); cx += ws[i] + sp; });
  });
}

/* ---------- 게임 진행 (기존 로직 유지) ---------- */
function build() {
  const list = TICKERS.slice();
  if (level > 1) list.sort(() => Math.random() - .5);
  bricks = list.map((t, i) => {
    const up = Math.random() < .55, p = (Math.random() * 3 + .1).toFixed(1), hp = BIG.has(t) ? 2 : 1;
    return { t, up, pct: (up ? "+" : "-") + p + "%", hp, max: hp, alive: true,
             x: OX + (i % COLS) * (BW + GAP), y: OY + Math.floor(i / COLS) * (BH + GAP) };
  });
}
const speedNow = () => (speed + broken * .02) * spd;
function mkBall() { return { x: pad.x, y: pad.y - pad.h / 2 - 11, vx: 0, vy: 0, r: 10, trail: [], dead: false }; }
function resetBall() {
  state = "ready"; spd = 1; items = [];
  if (pad.w !== PAD_W) { pad.w = PAD_W; makePad(); }
  balls = [mkBall()];
}
function newGame() { setBg(1); level = 1; score = 0; lives = 3; broken = 0; tape = []; build(); speed = 4.2; resetBall(); resetCo(); ui(); }
function nextLevel() { level++; setBg(level >= 2 ? 2 : 1); speed = Math.min(8, 4.2 + .5 * (level - 1)); broken = 0; build(); resetBall(); ui(); }
function launch() {
  const b = balls[0], a = Math.random() * .6 - .3, sp = speedNow();
  b.vx = sp * Math.sin(a); b.vy = -sp * Math.cos(a);
  state = "play"; ov.style.display = "none";
}
function ui() {
  $("sc").textContent = "$" + score.toLocaleString("en-US");
  $("lv").textContent = "라운드 " + level;
  $("li").innerHTML = [0, 1, 2].map(i => `<i style="opacity:${i < lives ? 1 : .2}">🐂</i>`).join("");
  $("tape").innerHTML = tape.length
    ? tape.slice(0, 8).map(x => `<span class="${x.up ? "u" : "d"}">${x.t} ${x.pct}</span>`).join("")
    : "벽돌을 깨면 체결 내역이 표시됩니다";
}
function show(h, p, btn, small, bad) {
  ov.innerHTML = `<h1${bad ? ' class="bad"' : ""}>${h}</h1><p>${p}</p><div class="btn">${btn}</div>` + (small ? `<small>${small}</small>` : "");
  ov.style.display = "flex"; stateAt = performance.now();
}
function tap() {
  if ((state === "over" || state === "clear") && performance.now() - stateAt < 700) return;  // 실수 터치 방지
  if (state === "title" || state === "over") { newGame(); launch(); }
  else if (state === "clear") { nextLevel(); launch(); }
  else if (state === "ready") launch();
}
function norm(b) {
  const sp = speedNow(), m = Math.hypot(b.vx, b.vy) || 1;
  b.vx *= sp / m; b.vy *= sp / m;
  const min = sp * .28;
  if (Math.abs(b.vy) < min) { b.vy = (b.vy < 0 ? -1 : 1) * min; const k = Math.sqrt(sp * sp - min * min); b.vx = (b.vx < 0 ? -1 : 1) * k; }
}
function burst(x, y, c, n, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = sp * (.4 + Math.random() * .8);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, l: 1, m: 14 + Math.random() * 10 });
  }
}
function hit(b, bl) {
  b.hp--; burst(bl.x, bl.y, GOLD, 4, 1.7); showCo(b);
  if (b.hp <= 0) {
    burst(b.x + BW / 2, b.y + BH / 2, b.up ? UPC : DNC, 12, 2.8);
    b.alive = false; broken++;
    const g = 100 * level; score += g;
    floats.push({ x: b.x + BW / 2, y: b.y, t: "+" + g, a: 1, c: b.up ? UPC : DNC });
    tape.unshift({ t: b.t, pct: b.pct, up: b.up });
    if (Math.random() < DROP) items.push({ t: ITEMS[Math.floor(Math.random() * ITEMS.length)], x: b.x + BW / 2, y: b.y + BH / 2 });
    if (!bricks.some(k => k.alive)) {
      const bonus = lives * 500; score += bonus; state = "clear"; items = [];
      if (score > best) best = score;
      show("라운드 " + level + " 클리어", "잔여 목숨 보너스 +$" + bonus.toLocaleString("en-US"), "다음 라운드");
    }
  }
  ui();
}

/* ---------- 아이템 ---------- */
function setPadW(w) { const nw = Math.max(PAD_MIN, Math.min(PAD_MAX, w)); if (Math.abs(nw - pad.w) < .01) return false; pad.w = nw; makePad(); return true; }
function setSpd(v) { const n = Math.max(SPD_MIN, Math.min(SPD_MAX, v)); if (Math.abs(n - spd) < .001) return false; spd = n; balls.forEach(norm); return true; }
function applyItem(t) {
  let msg = "";
  if (t === "X2") {
    if (balls.length >= MAXB) msg = "공 최대 개수";
    else {
      const add = [];
      for (const b of balls) {
        if (balls.length + add.length >= MAXB) break;
        const f = Math.atan2(b.vy, b.vx), c = { ...b, trail: [], dead: false };
        b.vx = Math.cos(f - .35); b.vy = Math.sin(f - .35);
        c.vx = Math.cos(f + .35); c.vy = Math.sin(f + .35);
        norm(b); norm(c); add.push(c);
      }
      balls.push(...add); msg = "공 분열 ×2";
    }
  } else if (t === "+1") msg = setPadW(pad.w * 1.1) ? "패들 +10%" : "패들 최대";
  else if (t === "-1") msg = setPadW(pad.w * .9) ? "패들 -10%" : "패들 최소";
  else if (t === "SP+") msg = setSpd(spd * 1.5) ? "속도 ×1.5" : "속도 최대";
  else if (t === "SP-") msg = setSpd(spd / 1.5) ? "속도 ÷1.5" : "속도 최소";
  floats.push({ x: Math.max(46, Math.min(W - 46, pad.x)), y: pad.y - 30, t: msg, a: 1.4, c: IT[t].g });
}

/* ---------- 공 이동 (물리·충돌은 기존과 동일, 큰 속도에서 뚫고 지나가지 않도록 잘게 나눠 이동) ---------- */
function moveBall(b, dt) {
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
  if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
  if (b.vy > 0 && b.y + b.r >= pad.y - pad.h / 2 && b.y - b.r <= pad.y + pad.h / 2 && Math.abs(b.x - pad.x) <= pad.w / 2 + b.r) {
    const t = (b.x - pad.x) / (pad.w / 2), a = t * 1.05, sp = speedNow();
    b.vx = sp * Math.sin(a); b.vy = -sp * Math.cos(a); b.y = pad.y - pad.h / 2 - b.r;
  }
  for (const k of bricks) {
    if (!k.alive) continue;
    const cx = Math.max(k.x, Math.min(b.x, k.x + BW)), cy = Math.max(k.y, Math.min(b.y, k.y + BH));
    const dx = b.x - cx, dy = b.y - cy;
    if (dx * dx + dy * dy < b.r * b.r) {
      if (dx === 0 && dy === 0) b.vy = -b.vy;
      else if (Math.abs(dx) > Math.abs(dy)) b.vx = dx > 0 ? Math.abs(b.vx) : -Math.abs(b.vx);
      else b.vy = dy > 0 ? Math.abs(b.vy) : -Math.abs(b.vy);
      hit(k, b); norm(b); break;
    }
  }
  if (b.y > H + b.r) b.dead = true;
}
function loseLife() {
  lives--; ui();
  if (lives <= 0) {
    state = "over"; if (score > best) best = score;
    show("게임 오버", "최종 $" + score.toLocaleString("en-US") + "<br>이번 접속 최고 $" + best.toLocaleString("en-US"), "다시 시작", "", true);
  } else resetBall();
}
function step(dt) {
  const dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (dir) pad.x += dir * 7 * dt;
  pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, pad.x));
  if (state === "ready") { const b = balls[0]; b.trail.length = 0; b.x = pad.x; b.y = pad.y - pad.h / 2 - b.r - 1; return; }
  if (state !== "play") { balls.forEach(b => b.trail.length = 0); return; }
  for (const b of balls) {
    const n = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6)), d = dt / n;
    for (let k = 0; k < n && !b.dead && state === "play"; k++) moveBall(b, d);
    if (!b.dead) { b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 9) b.trail.shift(); }
  }
  balls = balls.filter(b => !b.dead);
  for (const it of items) {
    it.y += 1.9 * dt;
    if (Math.abs(it.x - pad.x) <= pad.w / 2 + 20 && it.y + 10 >= pad.y - pad.h / 2 && it.y - 10 <= pad.y + pad.h / 2) { it.done = true; applyItem(it.t); }
    else if (it.y > H + 20) it.done = true;
  }
  items = items.filter(i => !i.done);
  if (state === "play" && balls.length === 0) loseLife();
}

const NAMES = {
  AAPL:"Apple Inc.", MSFT:"Microsoft Corporation", NVDA:"NVIDIA Corporation", GOOGL:"Alphabet Inc.", AMZN:"Amazon.com, Inc.",
  META:"Meta Platforms, Inc.", TSLA:"Tesla, Inc.", AVGO:"Broadcom Inc.", "BRK.B":"Berkshire Hathaway Inc.", LLY:"Eli Lilly and Company",
  V:"Visa Inc.", JPM:"JPMorgan Chase & Co.", WMT:"Walmart Inc.", XOM:"Exxon Mobil Corporation", UNH:"UnitedHealth Group Incorporated",
  MA:"Mastercard Incorporated", COST:"Costco Wholesale Corporation", ORCL:"Oracle Corporation", NFLX:"Netflix, Inc.", HD:"The Home Depot, Inc.",
  PG:"The Procter & Gamble Company", JNJ:"Johnson & Johnson", KO:"The Coca-Cola Company", PEP:"PepsiCo, Inc.", AMD:"Advanced Micro Devices, Inc.",
  CRM:"Salesforce, Inc.", ADBE:"Adobe Inc.", DIS:"The Walt Disney Company", NKE:"NIKE, Inc.", SBUX:"Starbucks Corporation",
  PLTR:"Palantir Technologies Inc.", UBER:"Uber Technologies, Inc.", ABNB:"Airbnb, Inc.", COIN:"Coinbase Global, Inc.", SOFI:"SoFi Technologies, Inc.",
  RIVN:"Rivian Automotive, Inc.", F:"Ford Motor Company", T:"AT&T Inc.", INTC:"Intel Corporation", PFE:"Pfizer Inc.",
  BAC:"Bank of America Corporation", PYPL:"PayPal Holdings, Inc."
};
/* 회사 정보 패널: logos/티커.png 파일이 있으면 실제 로고, 없으면 티커 모노그램을 보여줍니다 */
const logoCache = {}; let curLogo = "";
const PLACEHOLDER = "벽돌을 맞추면 기업 정보가 표시됩니다";
function setLogo(t) {
  curLogo = t;
  const lg = $("lg"); lg.className = ""; lg.dataset.len = t.length; lg.textContent = t;
  const apply = im => { if (curLogo !== t) return; lg.className = "img"; lg.textContent = ""; lg.appendChild(im.cloneNode()); };
  const c = logoCache[t];
  if (c === 0) return;
  if (c) { apply(c); return; }
  const im = new Image(); im.alt = "";
  im.onload = () => { logoCache[t] = im; apply(im); };
  im.onerror = () => { logoCache[t] = 0; };
  im.src = "logos/" + encodeURIComponent(t) + ".png";
}
function showCo(b) {
  $("cn").textContent = NAMES[b.t] || b.t; $("cs").textContent = b.t;
  const p = $("cp"); p.textContent = b.pct; p.style.color = b.up ? UPC : DNC;
  setLogo(b.t);
  const co = $("co"); co.classList.remove("flash"); void co.offsetWidth; co.classList.add("flash");
}
function resetCo() {
  curLogo = ""; const lg = $("lg"); lg.className = ""; lg.dataset.len = 1; lg.textContent = "$";
  $("cn").textContent = PLACEHOLDER; $("cs").textContent = ""; $("cp").textContent = "";
}

/* ---------- 그리기 ---------- */
function drawTrail(b) {
  const tr = b.trail, n = tr.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    ctx.globalAlpha = .06 + .34 * t * t; ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(tr[i].x, tr[i].y, b.r * (.3 + .6 * t), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawItem(it) {
  const s = IT[it.t], w = 40, h = 20, x = it.x - w / 2, y = it.y - h / 2;
  ctx.save(); ctx.shadowColor = s.g; ctx.shadowBlur = 10;
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, s.c[0]); g.addColorStop(1, s.c[1]);
  rr(x, y, w, h, 10); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); rr(x, y, w, h, 10); ctx.clip(); ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.fillRect(x, y, w, h * .45); ctx.restore();
  rr(x + .5, y + .5, w - 1, h - 1, 10); ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = NAVY; ctx.font = "900 12px " + SANS; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(it.t, it.x, it.y + .8);
}
function drawPad() {
  if (padSprite) ctx.drawImage(padSprite, pad.x - pad.w / 2 - 14, pad.y - pad.h / 2 - 14, pad.w + 28, pad.h + 28);
}
function drawBall(b) {
  const x = b.x, y = b.y, r = b.r;
  ctx.beginPath(); ctx.arc(x, y, r + 2.5, 0, 7); ctx.fillStyle = "rgba(8,12,22,.75)"; ctx.fill();   // 패들·배경과 분리되는 어두운 테
  ctx.save(); ctx.shadowColor = "rgba(255,200,100,.95)"; ctx.shadowBlur = 12;
  const g = ctx.createRadialGradient(x - r * .35, y - r * .4, 1, x, y, r);
  g.addColorStop(0, "#FFF6CF"); g.addColorStop(.5, "#F2C766"); g.addColorStop(1, "#A8772C");
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.lineWidth = 1.6; ctx.strokeStyle = "#5e3f0c"; ctx.beginPath(); ctx.arc(x, y, r - .8, 0, 7); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = "rgba(255,246,207,.85)"; ctx.beginPath(); ctx.arc(x, y, r - 3.2, 0, 7); ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "900 13px Georgia,serif";
  ctx.fillStyle = "rgba(255,250,222,.9)"; ctx.fillText("$", x + .6, y + 1.8);
  ctx.fillStyle = "#4f3307"; ctx.fillText("$", x, y + 1.1);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function draw() {
  const cur = bgCan[bgIdx] || bgCan[1], prv = bgCan[bgPrev] || bgCan[1];
  if (cur) {
    if (bgFade < 1 && prv) { ctx.drawImage(prv, 0, 0, W, H); ctx.globalAlpha = bgFade; ctx.drawImage(cur, 0, 0, W, H); ctx.globalAlpha = 1; }
    else ctx.drawImage(cur, 0, 0, W, H);
  } else { ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H); }
  const bgBlur = bgBl[bgIdx] || bgBl[1];
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.lineJoin = "round";
  const alive = bricks.filter(b => b.alive);
  if (bgBlur && alive.length) {
    ctx.save(); ctx.beginPath(); for (const b of alive) ctx.roundRect(b.x, b.y, BW, BH, 6); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(bgBlur, 0, 0, W, H); ctx.restore();
  }
  for (const b of alive) {
    const col = b.up ? UPC : DNC, cx = b.x + BW / 2;
    rr(b.x, b.y, BW, BH, 6); ctx.fillStyle = "rgba(16,30,52,.72)"; ctx.fill();
    ctx.save(); rr(b.x, b.y, BW, BH, 6); ctx.clip();
    ctx.fillStyle = "rgba(255,255,255,.08)"; ctx.fillRect(b.x, b.y, BW, BH * .45);
    ctx.fillStyle = b.up ? "rgba(32,201,151,.10)" : "rgba(255,101,114,.10)"; ctx.fillRect(b.x, b.y + BH * .45, BW, BH * .55); ctx.restore();
    rr(b.x + .5, b.y + .5, BW - 1, BH - 1, 6); ctx.strokeStyle = col; ctx.lineWidth = b.hp === 2 ? 2.4 : 1.5; ctx.stroke();
    if (b.hp === 2) { rr(b.x - 1.5, b.y - 1.5, BW + 3, BH + 3, 7.5); ctx.strokeStyle = "rgba(220,175,97,.85)"; ctx.lineWidth = 1; ctx.stroke(); }
    if (!b.fs) { ctx.font = "800 12px " + SANS; b.fs = Math.min(12.5, 12 * (BW - 9) / ctx.measureText(b.t).width); }
    ctx.lineWidth = 2.6; ctx.strokeStyle = "rgba(6,14,28,.75)";
    ctx.font = "800 " + b.fs.toFixed(1) + "px " + SANS; ctx.strokeText(b.t, cx, b.y + 9.5); ctx.fillStyle = "#fff"; ctx.fillText(b.t, cx, b.y + 9.5);
    ctx.font = "700 10px " + SANS; ctx.strokeText(b.pct, cx, b.y + 20.5); ctx.fillStyle = col; ctx.fillText(b.pct, cx, b.y + 20.5);
  }
  for (const p of parts) { ctx.globalAlpha = Math.max(p.l, 0); ctx.fillStyle = p.c; const z = 1.2 + 2 * p.l; ctx.fillRect(p.x - z / 2, p.y - z / 2, z, z); }
  ctx.globalAlpha = 1;
  items.forEach(drawItem);
  balls.forEach(drawTrail); drawPad(); balls.forEach(drawBall);
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "800 13px " + SANS;
  for (const f of floats) { ctx.globalAlpha = Math.min(f.a, 1); ctx.lineWidth = 3; ctx.strokeStyle = "rgba(6,14,28,.8)"; ctx.strokeText(f.t, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); }
  ctx.globalAlpha = 1;
  if (state === "ready" && ov.style.display === "none") {
    ctx.fillStyle = "rgba(245,242,233,.9)"; ctx.font = "700 13px " + SANS;
    ctx.strokeStyle = "rgba(6,14,28,.8)"; ctx.lineWidth = 3; ctx.strokeText("터치하여 발사", W / 2, H - 82); ctx.fillText("터치하여 발사", W / 2, H - 82);
  }
}

/* ---------- QR 코드 (외부 라이브러리 없이 직접 생성: 바이트 모드 · 오류정정 M) ---------- */
const SHARE_URL = "";   // 비워 두면 현재 접속 주소로 QR을 자동 생성합니다. 다른 주소를 쓰려면 여기에 적으세요.
const QR = (function () {
  const ECC = [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
  const BLK = [-1,1,1,2,2,4,4,4,5,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];
  const rawBits = v => { let r = (16 * v + 128) * v + 64; if (v >= 2) { const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if (v >= 7) r -= 36; } return r; };
  const dataCw = v => Math.floor(rawBits(v) / 8) - ECC[v] * BLK[v];
  const mul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  const rsDiv = d => { const r = new Array(d).fill(0); r[d - 1] = 1; let root = 1; for (let i = 0; i < d; i++) { for (let j = 0; j < d; j++) { r[j] = mul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; };
  const rsRem = (data, div) => { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => r[i] ^= mul(c, f)); } return r; };
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0];

  function make(text, forceMask) {
    const bytes = [...new TextEncoder().encode(text)];
    let ver = 1;
    for (; ; ver++) { if (ver > 40) throw new Error("QR: text too long"); if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCw(ver) * 8) break; }
    const bits = [], push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    push(4, 4); push(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
    const cap = dataCw(ver) * 8;
    push(0, Math.min(4, cap - bits.length)); push(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) push(p, 8);
    const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));

    const nb = BLK[ver], el = ECC[ver], raw = Math.floor(rawBits(ver) / 8), ns = nb - raw % nb, sl = Math.floor(raw / nb);
    const div = rsDiv(el), blocks = []; let k = 0;
    for (let i = 0; i < nb; i++) { const dat = data.slice(k, k + sl - el + (i < ns ? 0 : 1)); k += dat.length; const ecc = rsRem(dat, div); if (i < ns) dat.push(0); blocks.push(dat.concat(ecc)); }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) all.push(b[i]); });

    const n = ver * 4 + 17, M = Array.from({ length: n }, () => new Array(n).fill(false)), F = Array.from({ length: n }, () => new Array(n).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy; if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4); } };
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    if (ver > 1) {
      const na = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
      for (let p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    if (ver >= 7) {
      let r = ver; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = n - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit); set(c, a, bit); }
    }
    const fmt = m => {
      const d = m; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, g(i)); set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, g(i));
      for (let i = 0; i < 8; i++) set(n - 1 - i, 8, g(i));
      for (let i = 8; i < 15; i++) set(8, n - 15 + i, g(i));
      set(8, n - 8, true);
    };
    fmt(0);
    let idx = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, y = ((right + 1) & 2) === 0 ? n - 1 - vert : vert;
        if (!F[y][x] && idx < all.length * 8) { M[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) === 1; idx++; }
      }
    }
    const apply = m => { for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {
      let p = 0; const rows = M.map(r => r.map(v => v ? 1 : 0)), lines = [...rows, ...Array.from({ length: n }, (_, x) => rows.map(r => r[x]))];
      for (const l of lines) {
        let run = 1; for (let i = 1; i < n; i++) { if (l[i] === l[i - 1]) run++; else { if (run >= 5) p += run - 2; run = 1; } } if (run >= 5) p += run - 2;
        const s = l.join(""); for (const pat of ["10111010000", "00001011101"]) { let i = -1; while ((i = s.indexOf(pat, i + 1)) >= 0) p += 40; }
      }
      for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const v = rows[y][x]; if (v === rows[y][x + 1] && v === rows[y + 1][x] && v === rows[y + 1][x + 1]) p += 3; }
      let dark = 0; rows.forEach(r => r.forEach(v => dark += v));
      return p + (Math.ceil(Math.abs(dark * 20 - n * n * 10) / (n * n)) - 1) * 10;
    };
    let best = forceMask, bestP = Infinity;
    if (best === undefined) for (let m = 0; m < 8; m++) { apply(m); fmt(m); const p = penalty(); if (p < bestP) { best = m; bestP = p; } apply(m); }
    apply(best); fmt(best);
    return { n, M, ver, mask: best };
  }
  return { make };
})();

function shareUrl() {
  if (SHARE_URL) return SHARE_URL;
  if (!/^https?:$/.test(location.protocol)) return "";
  const u = new URL(location.href); u.hash = ""; u.search = ""; return u.toString();
}
function drawQR() {
  const cvq = $("qr"), cap = $("qrcap"); if (!cvq) return;
  const url = shareUrl();
  if (!url) { cvq.parentNode.style.display = "none"; if (cap) cap.textContent = "배포 주소(https://…)로 열면 QR이 자동으로 만들어집니다"; return; }
  const { n, M } = QR.make(url), q = 4, tot = n + 2 * q, ms = 8;
  cvq.width = cvq.height = tot * ms;
  const g = cvq.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cvq.width, cvq.height); g.fillStyle = "#101E34";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (M[y][x]) g.fillRect((x + q) * ms, (y + q) * ms, ms, ms);
}

/* ---------- 루프 · 입력 ---------- */
let last = performance.now();
function loop(n) {
  const dt = Math.min((n - last) / 16.67, 2.5); last = n;
  step(dt);
  if (bgFade < 1) bgFade = Math.min(1, bgFade + dt / 50);
  floats.forEach(f => { f.y -= .6 * dt; f.a -= .018 * dt; });
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .06 * dt; p.l -= dt / p.m; });
  parts = parts.filter(p => p.l > 0); floats = floats.filter(f => f.a > 0);
  draw(); requestAnimationFrame(loop);
}
function px(e) { const r = cv.getBoundingClientRect(); if (!r.width) return; pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, (e.clientX - r.left) / r.width * W)); }
wrap.addEventListener("pointermove", px, { passive: true });
window.addEventListener("pointerdown", e => {
  px(e);
  if (state === "title") { if (e.target.closest && e.target.closest("#startBtn")) tap(); return; }   // 시작 화면에서는 버튼을 눌러야만 시작
  tap();
}, { passive: true });
window.addEventListener("keydown", e => {
  const k = e.key.length > 1 ? e.key : e.key.toLowerCase(); keys[k] = true;
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); }
});
window.addEventListener("keyup", e => { keys[e.key.length > 1 ? e.key : e.key.toLowerCase()] = false; });
document.addEventListener("contextmenu", e => e.preventDefault());

/* ---------- 시작 ---------- */
resize(); build();
balls = [mkBall()];
ui(); drawQR(); requestAnimationFrame(loop);
})();