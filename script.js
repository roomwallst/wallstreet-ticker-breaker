/* 티커 브레이커 — 방구석월가 | 미국주식 결을 읽다
   정적 웹앱: 서버·로그인·저장 없음 (기록은 저장되지 않습니다) */
(function () {
"use strict";

/* ---------- 설정 ---------- */
const W = 360, H = 560, COLS = 6, BW = 52, BH = 28, GAP = 4;
const OX = (W - COLS * BW - (COLS - 1) * GAP) / 2, OY = 26;
const PAD_W = 90, PAD_H = 19.5;               // 패들 크기(논리 좌표). 키우면 쉬워지고 줄이면 어려워집니다.
const NAVY = "#101E34", GOLD = "#DCAF61", OFFW = "#F5F2E9", UPC = "#20C997", DNC = "#FF6572";
const SANS = '"Pretendard","SF Pro Display","Helvetica Neue",Arial,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const TICKERS = "AAPL MSFT NVDA GOOGL AMZN META TSLA AVGO BRK.B LLY V JPM WMT XOM UNH MA COST ORCL NFLX HD PG JNJ KO PEP AMD CRM ADBE DIS NKE SBUX PLTR UBER ABNB COIN SOFI RIVN F T INTC PFE BAC PYPL".split(" ");
const BIG = new Set("AAPL MSFT NVDA GOOGL AMZN META TSLA AVGO".split(" "));

/* ---------- 상태 ---------- */
const $ = id => document.getElementById(id);
const cv = $("c"), ctx = cv.getContext("2d", { alpha: false }), ov = $("ov"), wrap = $("wrap");
let sc = 1, state = "title", stateAt = 0, level = 1, score = 0, lives = 3, broken = 0, speed = 4.2, best = 0;
let bricks = [], floats = [], tape = [], parts = [], trail = [];
let bg = null, bgBlur = null, padSprite = null, bgReady = false;
const pad = { x: W / 2, y: H - 42, w: PAD_W, h: PAD_H };
const ball = { x: W / 2, y: 0, vx: 0, vy: 0, r: 10 };
const keys = {};

const bgImg = new Image();
bgImg.onload = () => { bgReady = true; makeBg(); };
bgImg.src = "bg.jpg";

/* ---------- 화면 크기 ---------- */
function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  sc = Math.min(w / W, h / H);
  const d = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = W * sc + "px"; cv.style.height = H * sc + "px";
  cv.width = Math.round(W * sc * d); cv.height = Math.round(H * sc * d);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  ov.style.width = cv.style.width; ov.style.height = cv.style.height;
  makeBg(); makePad();
}
window.addEventListener("resize", resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);

/* ---------- 배경 (월스트리트 야경 사진 + 유리 블록용 흐림 사본) ---------- */
function makeBg() {
  if (!cv.width) return;
  const k = cv.width / W;
  bg = document.createElement("canvas"); bg.width = cv.width; bg.height = cv.height;
  const g = bg.getContext("2d"); g.setTransform(k, 0, 0, k, 0, 0);
  g.fillStyle = "#0a1230"; g.fillRect(0, 0, W, H);
  if (bgReady) g.drawImage(bgImg, 0, 0, W, H);
  g.fillStyle = "rgba(6,10,18,.22)"; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 440, 0, H);
  gr.addColorStop(0, "rgba(5,8,14,0)"); gr.addColorStop(1, "rgba(5,8,14,.5)");
  g.fillStyle = gr; g.fillRect(0, 440, W, H - 440);
  bgBlur = document.createElement("canvas");
  bgBlur.width = Math.ceil(W / 8); bgBlur.height = Math.ceil(H / 8);
  bgBlur.getContext("2d").drawImage(bg, 0, 0, bgBlur.width, bgBlur.height);
}

/* ---------- 골드 메탈 패들 (한 번만 그려 두고 재사용) ---------- */
function makePad() {
  if (!cv.width) return;
  const m = 14, k = cv.width / W, x = m, y = m, w = PAD_W, h = PAD_H, r = h / 2;
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
function resetBall() { state = "ready"; ball.vx = ball.vy = 0; }
function newGame() { level = 1; score = 0; lives = 3; broken = 0; tape = []; build(); speed = 4.2; resetBall(); resetCo(); ui(); }
function nextLevel() { level++; speed = Math.min(8, 4.2 + .45 * (level - 1)); broken = 0; build(); resetBall(); ui(); }
function launch() {
  const a = Math.random() * .6 - .3;
  ball.vx = speed * Math.sin(a); ball.vy = -speed * Math.cos(a);
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
function norm() {
  const sp = Math.min(8.8, speed + broken * .02), m = Math.hypot(ball.vx, ball.vy) || 1;
  ball.vx *= sp / m; ball.vy *= sp / m;
  const min = sp * .28;
  if (Math.abs(ball.vy) < min) { ball.vy = (ball.vy < 0 ? -1 : 1) * min; const k = Math.sqrt(sp * sp - min * min); ball.vx = (ball.vx < 0 ? -1 : 1) * k; }
}
function burst(x, y, c, n, sp) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, v = sp * (.4 + Math.random() * .8);
    parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, l: 1, m: 14 + Math.random() * 10 });
  }
}
function hit(b) {
  b.hp--; burst(ball.x, ball.y, GOLD, 4, 1.7); showCo(b);
  if (b.hp <= 0) {
    burst(b.x + BW / 2, b.y + BH / 2, b.up ? UPC : DNC, 12, 2.8);
    b.alive = false; broken++;
    const g = 100 * level; score += g;
    floats.push({ x: b.x + BW / 2, y: b.y, t: "+" + g, a: 1, c: b.up ? UPC : DNC });
    tape.unshift({ t: b.t, pct: b.pct, up: b.up });
    if (!bricks.some(k => k.alive)) {
      const bonus = lives * 500; score += bonus; state = "clear";
      if (score > best) best = score;
      show("라운드 " + level + " 클리어", "잔여 목숨 보너스 +$" + bonus.toLocaleString("en-US"), "다음 라운드");
    }
  }
  ui();
}
function step(dt) {
  const dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (dir) pad.x += dir * 7 * dt;
  pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, pad.x));
  if (state === "ready") { trail.length = 0; ball.x = pad.x; ball.y = pad.y - pad.h / 2 - ball.r - 1; return; }
  if (state !== "play") { trail.length = 0; return; }
  ball.x += ball.vx * dt; ball.y += ball.vy * dt;
  trail.push({ x: ball.x, y: ball.y }); if (trail.length > 9) trail.shift();
  if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
  if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
  if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
  if (ball.vy > 0 && ball.y + ball.r >= pad.y - pad.h / 2 && ball.y - ball.r <= pad.y + pad.h / 2 && Math.abs(ball.x - pad.x) <= pad.w / 2 + ball.r) {
    const t = Math.max(-1, Math.min(1, (ball.x - pad.x) / (pad.w / 2))), a = t * 1.05, sp = Math.min(8.8, speed + broken * .02);
    ball.vx = sp * Math.sin(a); ball.vy = -sp * Math.cos(a); ball.y = pad.y - pad.h / 2 - ball.r;
  }
  for (const b of bricks) {
    if (!b.alive) continue;
    const cx = Math.max(b.x, Math.min(ball.x, b.x + BW)), cy = Math.max(b.y, Math.min(ball.y, b.y + BH));
    const dx = ball.x - cx, dy = ball.y - cy;
    if (dx * dx + dy * dy < ball.r * ball.r) {
      if (dx === 0 && dy === 0) ball.vy = -ball.vy;
      else if (Math.abs(dx) > Math.abs(dy)) ball.vx = dx > 0 ? Math.abs(ball.vx) : -Math.abs(ball.vx);
      else ball.vy = dy > 0 ? Math.abs(ball.vy) : -Math.abs(ball.vy);
      hit(b); norm(); break;
    }
  }
  if (ball.y > H + ball.r && state === "play") {
    lives--; ui();
    if (lives <= 0) {
      state = "over"; if (score > best) best = score;
      show("게임 오버", "최종 $" + score.toLocaleString("en-US") + "<br>이번 접속 최고 $" + best.toLocaleString("en-US"), "다시 시작", "", true);
    } else resetBall();
  }
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
const PLACEHOLDER = "벽돌을 맞추면 기업 정보가 표시됩니다";
function showCo(b) {
  const lg = $("lg");
  lg.className = "";
  lg.dataset.len = b.t.length;
  lg.textContent = b.t;
  $("cn").textContent = NAMES[b.t] || b.t;
  $("cs").textContent = b.t;
  const p = $("cp"); p.textContent = b.pct; p.style.color = b.up ? UPC : DNC;
  const co = $("co"); co.classList.remove("flash"); void co.offsetWidth; co.classList.add("flash");
}
function resetCo() {
  const lg = $("lg"); lg.className = ""; lg.dataset.len = 1; lg.textContent = "$";
  $("cn").textContent = PLACEHOLDER; $("cs").textContent = ""; $("cp").textContent = "";
}

/* ---------- 그리기 ---------- */
function drawTrail() {
  const n = trail.length;
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    ctx.globalAlpha = .06 + .34 * t * t; ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(trail[i].x, trail[i].y, ball.r * (.3 + .6 * t), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawPad() {
  if (padSprite) ctx.drawImage(padSprite, pad.x - PAD_W / 2 - 14, pad.y - PAD_H / 2 - 14, PAD_W + 28, PAD_H + 28);
}
function drawBall() {
  const x = ball.x, y = ball.y, r = ball.r;
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
  if (bg) ctx.drawImage(bg, 0, 0, W, H); else { ctx.fillStyle = NAVY; ctx.fillRect(0, 0, W, H); }
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
  drawTrail(); drawPad(); drawBall();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "800 13px " + SANS;
  for (const f of floats) { ctx.globalAlpha = f.a; ctx.lineWidth = 3; ctx.strokeStyle = "rgba(6,14,28,.8)"; ctx.strokeText(f.t, f.x, f.y); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x, f.y); }
  ctx.globalAlpha = 1;
  if (state === "ready" && ov.style.display === "none") {
    ctx.fillStyle = "rgba(245,242,233,.9)"; ctx.font = "700 13px " + SANS;
    ctx.strokeStyle = "rgba(6,14,28,.8)"; ctx.lineWidth = 3; ctx.strokeText("터치하여 발사", W / 2, H - 82); ctx.fillText("터치하여 발사", W / 2, H - 82);
  }
}

/* ---------- 루프 · 입력 ---------- */
let last = performance.now();
function loop(n) {
  const dt = Math.min((n - last) / 16.67, 2.5); last = n;
  // 고속 공이 블록을 통과하지 않도록 프레임마다 충돌 계산을 분할
  const steps = Math.max(1, Math.ceil(dt * Math.min(8.8, speed + broken * .02) / 4));
  for (let i = 0; i < steps; i++) step(dt / steps);
  floats.forEach(f => { f.y -= .6 * dt; f.a -= .018 * dt; });
  parts.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += .06 * dt; p.l -= dt / p.m; });
  parts = parts.filter(p => p.l > 0); floats = floats.filter(f => f.a > 0);
  draw(); requestAnimationFrame(loop);
}
function px(e) {
  const r = cv.getBoundingClientRect();
  if (!r.width) return;
  pad.x = Math.max(pad.w / 2, Math.min(W - pad.w / 2, (e.clientX - r.left) / r.width * W));
}
// 게임 영역에서만 터치를 처리한다. 모바일 드래그 중에도 패들을 조작할 수 있다.
wrap.addEventListener("pointermove", px, { passive: true });
wrap.addEventListener("pointerdown", e => { px(e); tap(); }, { passive: true });
window.addEventListener("keydown", e => {
  const k = e.key.length > 1 ? e.key : e.key.toLowerCase(); keys[k] = true;
  if (e.key === " " || e.key === "Enter") { e.preventDefault(); tap(); }
});
window.addEventListener("keyup", e => { keys[e.key.length > 1 ? e.key : e.key.toLowerCase()] = false; });
document.addEventListener("contextmenu", e => e.preventDefault());

/* ---------- 시작 ---------- */
resize(); build();
ball.x = pad.x; ball.y = pad.y - pad.h / 2 - ball.r - 1;
ui(); requestAnimationFrame(loop);
})();
