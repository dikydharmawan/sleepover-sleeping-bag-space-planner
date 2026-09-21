/* ===== Sleepover Sleeping Bag Space Planner — app.js (Vanilla ES6+) ===== */
"use strict";

/**
 * @typedef {Object} GridResult
 * @property {number} cols     — kolom (sepanjang lebar ruangan)
 * @property {number} rows     — baris (sepanjang panjang ruangan)
 * @property {number} total    — kantung tidur = cols × rows
 * @property {number} bagArea  — luas satu kantung (sq ft)
 * @property {number} usedArea — luas lantai terpakai (sq ft)
 * @property {number} leftover — sisa luas lantai (sq ft)
 * @property {number} area     — luas ruangan (sq ft)
 */
/**
 * @typedef {Object} OrientationComparison
 * @property {GridResult} portrait — hasil Portrait
 * @property {GridResult} landscape — hasil Landscape
 * @property {"portrait"|"landscape"|"draw"} better — muatan terbanyak
 * @property {number} diff — selisih jumlah kantung
 */
/**
 * @typedef {Object} AppState
 * @property {number} roomLength — panjang ruangan (ft)
 * @property {number} roomWidth — lebar ruangan (ft)
 * @property {number} bagWidth — lebar kantung (ft)
 * @property {number} bagLength — panjang kantung (ft)
 * @property {"portrait"|"landscape"} orientation — orientasi aktif
 * @property {"kid"|"adult"|"custom"} preset — preset aktif
 */

const STORAGE_KEY = "sbsp_v1";
const PRESETS = { kid:{bagWidth:2.5,bagLength:5}, adult:{bagWidth:3,bagLength:6} };
const DEFAULT_STATE = { roomLength:12, roomWidth:10, bagWidth:2.5, bagLength:5, orientation:"portrait", preset:"kid" };

/** @type {AppState} */
let state = { ...DEFAULT_STATE };
let overflow = false;

/** @param {string} id @returns {HTMLElement} */
const $ = id => document.getElementById(id);
/** @param {number} v @param {number} [dp=1] @returns {string} */
const fmt = (v, dp=1) => v.toFixed(dp).replace(/\.0+$/,"");
/** @param {number} v @param {number} a @param {number} b @returns {number} */
const clamp = (v, a, b) => Number.isFinite(v) ? Math.min(Math.max(v,a),b) : a;

/** Baca input numerik, netralkan 0/negatif. @param {HTMLInputElement} el @param {number} min @param {number} max @returns {number} */
function read(el, min, max){
  const raw = parseFloat(el.value);
  const v = clamp(Number.isFinite(raw) && raw>0 ? raw : min, min, max);
  el.value = v; return v;
}

/**
 * Hitung grid kantung tidur (fungsi murni): cols=floor(w/bw), rows=floor(l/bl).
 * @param {number} roomW @param {number} roomL @param {number} bagW @param {number} bagL
 * @returns {GridResult}
 */
function calcGrid(roomW, roomL, bagW, bagL){
  roomW=Math.max(1e-6,roomW); roomL=Math.max(1e-6,roomL);
  bagW=Math.max(1e-6,bagW); bagL=Math.max(1e-6,bagL);
  const cols=Math.max(0,Math.floor(roomW/bagW));
  const rows=Math.max(0,Math.floor(roomL/bagL));
  const total=cols*rows, bagArea=bagW*bagL, area=roomW*roomL;
  return { cols, rows, total, bagArea, usedArea:total*bagArea, leftover:area-total*bagArea, area };
}

/**
 * Dimensi kantung menghadap ruangan sesuai orientasi.
 * @param {AppState} s @returns {{fw:number,fl:number}}
 */
const facing = s => s.orientation==="portrait" ? {fw:s.bagWidth,fl:s.bagLength} : {fw:s.bagLength,fl:s.bagWidth};

/** Bandingkan kapasitas kedua orientasi. @returns {OrientationComparison} */
function compare(roomW, roomL, bagWidth, bagLength){
  const portrait = calcGrid(roomW, roomL, bagWidth, bagLength);
  const landscape = calcGrid(roomW, roomL, bagLength, bagWidth);
  const diff = Math.abs(portrait.total - landscape.total);
  const better = portrait.total>landscape.total ? "portrait" : landscape.total>portrait.total ? "landscape" : "draw";
  return { portrait, landscape, better, diff };
}

/* TOAST */
/** Notifikasi toast ringan setiap aksi. @param {string} msg @param {string} [icon="✨"] */
function toast(msg, icon="✨"){
  const box = $("toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = `${icon} ${msg}`;
  box.appendChild(el);
  setTimeout(() => el.classList.add("hide"), 2200);
  setTimeout(() => el.remove(), 2600);
}

/* PARTICLES */
/** Partikel bergerak (kunang-kunang hangat) di canvas latar. */
function startParticles(){
  const cv = $("fx");
  if (!cv || !cv.getContext) return;
  const cx = cv.getContext("2d");
  const COLORS = ["255,180,90","255,140,60","255,215,150","250,120,80"];
  let w = 0, h = 0, parts = [];
  const resize = () => { w = cv.width = innerWidth; h = cv.height = innerHeight; };
  const spawn = i => { parts[i] = { x:Math.random()*w, y:Math.random()*h, r:.8+Math.random()*2.2, vy:.15+Math.random()*.45, vx:-.15+Math.random()*.5, s:.4+Math.random()*.6, p:Math.random()*6.28, c:COLORS[Math.random()*COLORS.length|0] }; };
  const step = () => {
    cx.clearRect(0, 0, w, h);
    for (let i = 0; i < parts.length; i++){
      const d = parts[i];
      d.p += .015 * d.s; d.y -= d.vy; d.x += d.vx + Math.sin(d.p) * .25;
      if (d.y < -8 || d.x < -8 || d.x > w + 8) spawn(i);
      cx.fillStyle = `rgba(${d.c},${.22 + .35 * Math.abs(Math.sin(d.p))})`;
      cx.beginPath(); cx.arc(d.x, d.y, d.r, 0, 6.2832); cx.fill();
    }
    requestAnimationFrame(step);
  };
  resize();
  const n = Math.min(42, 14 + (innerWidth / 22 | 0));
  parts = new Array(n);
  for (let i = 0; i < n; i++) spawn(i);
  step();
  addEventListener("resize", resize);
}

/* RENDER */
/** Animasi pop. @param {HTMLElement} el */
function pop(el){ el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }

/** Render kartu statistik. @param {GridResult} r @param {AppState} s */
function renderStats(r, s){
  pop($("statMax")); pop($("statDims")); pop($("statLeftover"));
  $("statMax").textContent = r.total;
  $("statDims").textContent = `${r.cols} × ${r.rows}`;
  $("statLeftover").textContent = `${fmt(r.leftover, 2)} sq ft`;
  $("statOrientation").textContent = s.orientation==="portrait" ? "Portrait" : "Landscape";
}

/** Render perbandingan + rekomendasi. @param {OrientationComparison} cmp */
function renderCompare(cmp){
  $("cmpPortrait").textContent = cmp.portrait.total;
  $("cmpLandscape").textContent = cmp.landscape.total;
  $("compareBox").children[0].classList.toggle("win", cmp.better==="portrait");
  $("compareBox").children[1].classList.toggle("win", cmp.better==="landscape");
  $("cmpMsg").textContent = cmp.better==="draw"
    ? "Kedua orientasi sama-sama pas — pilih sesuai selera! 🎯"
    : `Rekomendasi: orientasi ${cmp.better==="portrait"?"Portrait":"Landscape"} menampung ${cmp.diff} kantung lebih banyak.`;
}

/** Visualisasi top-down proporsional, tiap kantung bernomor. @param {GridResult} r @param {number} fw @param {number} fl @param {AppState} s */
function renderCanvas(r, fw, fl, s){
  const wrap = $("canvasWrap"), canvas = $("canvas");
  const PAD = 48;
  canvas.innerHTML = ""; canvas.style.width = canvas.style.height = "";
  if (r.total === 0) return;
  const scale = Math.min(Math.max(140, wrap.clientWidth - PAD) / s.roomWidth,
                         Math.max(180, wrap.clientHeight - PAD) / s.roomLength);
  canvas.style.width = `${s.roomWidth * scale}px`;
  canvas.style.height = `${s.roomLength * scale}px`;
  const grid = document.createElement("div");
  grid.className = "bag-grid";
  grid.style.width = `${r.cols * fw * scale}px`;
  grid.style.height = `${r.rows * fl * scale}px`;
  grid.style.gridTemplateColumns = `repeat(${r.cols}, ${fw * scale}px)`;
  grid.style.gridAutoRows = `${fl * scale}px`;
  const fs = Math.max(8, Math.min(16, Math.min(fw, fl) * scale * 0.38));
  for (let i = 0; i < r.total; i++){
    const cell = document.createElement("div");
    cell.className = "bag-cell"; cell.textContent = i + 1; cell.style.fontSize = `${fs}px`;
    grid.appendChild(cell);
  }
  canvas.appendChild(grid);
}

/** Sinkronkan kontrol UI dengan state. @param {AppState} s */
function syncControls(s){
  $("roomLength").value = s.roomLength; $("roomWidth").value = s.roomWidth;
  $("bagWidth").value = s.bagWidth; $("bagLength").value = s.bagLength;
  document.querySelectorAll("#presetSeg .seg-btn").forEach(b =>
    { const on = b.dataset.preset === s.preset; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
  document.querySelectorAll("#orientSeg .seg-btn").forEach(b =>
    { const on = b.dataset.orient === s.orientation; b.classList.toggle("active", on); b.setAttribute("aria-pressed", String(on)); });
}

/* PERSISTENCE */
/** @param {AppState} s */
function saveState(s){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) {} }
/** @returns {AppState} */
function loadState(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const s = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    s.orientation = s.orientation === "landscape" ? "landscape" : "portrait";
    s.preset = ["kid","adult","custom"].includes(s.preset) ? s.preset : "kid";
    for (const k of ["roomLength","roomWidth","bagWidth","bagLength"])
      s[k] = clamp(Number(s[k]) || DEFAULT_STATE[k], 0.5, 500);
    return s;
  } catch (e) { return { ...DEFAULT_STATE }; }
}

/* MAIN UPDATE */
function updateAll(){
  state.roomLength = read($("roomLength"), 1, 500);
  state.roomWidth  = read($("roomWidth"),  1, 500);
  state.bagWidth   = read($("bagWidth"),  0.5, 50);
  state.bagLength  = read($("bagLength"), 0.5, 50);

  const { fw, fl } = facing(state);
  const result = calcGrid(state.roomWidth, state.roomLength, fw, fl);
  const cmp = compare(state.roomWidth, state.roomLength, state.bagWidth, state.bagLength);

  const isOverflow = result.total === 0;
  $("notice").classList.toggle("hidden", !isOverflow);
  if (isOverflow && !overflow) toast("Kantung tidak muat di ruangan!", "⚠️");
  overflow = isOverflow;

  renderStats(result, state);
  renderCompare(cmp);
  renderCanvas(result, fw, fl, state);
  saveState(state);
}

/* EVENTS */
function bindEvents(){
  const dims = {
    roomLength: ["Panjang ruangan", "📏"],
    roomWidth:  ["Lebar ruangan",   "📏"],
    bagWidth:   ["Lebar kantung",   "🎒"],
    bagLength:  ["Panjang kantung", "🎒"],
  };
  for (const id of Object.keys(dims)){
    $(id).addEventListener("input", () => {
      const custom = $('button[data-preset="custom"]');
      custom.classList.add("active"); custom.setAttribute("aria-pressed", "true");
      document.querySelectorAll("#presetSeg .seg-btn").forEach(b =>
        b.dataset.preset !== "custom" && b.classList.remove("active"));
      state.preset = "custom"; updateAll();
    });
    $(id).addEventListener("change", () =>
      toast(`${dims[id][0]} → ${$(id).value} ft`, dims[id][1]));
  }

  document.querySelectorAll("#presetSeg .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.preset = btn.dataset.preset;
      if (PRESETS[state.preset]){ state.bagWidth = PRESETS[state.preset].bagWidth; state.bagLength = PRESETS[state.preset].bagLength; }
      syncControls(state); updateAll();
      toast(`Preset → ${ {kid:"Standard Kid", adult:"Adult", custom:"Custom"}[state.preset] }`, "🎒");
    });
  });

  document.querySelectorAll("#orientSeg .seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      state.orientation = btn.dataset.orient;
      syncControls(state); updateAll();
      toast(`Orientasi → ${state.orientation==="portrait"?"📐 Portrait":"🔄 Landscape"}`, "🔄");
    });
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset semua pengaturan ke default?")) return;
    state = { ...DEFAULT_STATE };
    syncControls(state); saveState(state); updateAll();
    toast("Semua direset ke default", "↺");
  });

  window.addEventListener("resize", () => {
    const { fw, fl } = facing(state);
    renderCanvas(calcGrid(state.roomWidth, state.roomLength, fw, fl), fw, fl, state);
  });
}

/* TESTS */
function runAutomatedTests(){
  const ok = [];
  const t = (n, c) => { ok.push(c); console.assert(c, `[SPACEPLAN] ${n}`); };
  const p = calcGrid(10, 10, 2.5, 5);
  t("10x10 + bag 2.5x5: cols=4,rows=2", p.cols === 4 && p.rows === 2);
  t("Total=8, leftover=0", p.total === 8 && p.leftover === 0);
  t("Rotated: total=8", calcGrid(10, 10, 5, 2.5).total === 8);
  const c1 = compare(10, 8, 2.5, 5);
  t("Portrait 10x8 → 4", c1.portrait.total === 4);
  t("Landscape 10x8 → 6", c1.landscape.total === 6);
  t("Rekomendasi landscape, diff=2", c1.better === "landscape" && c1.diff === 2);
  t("9x9 adult → draw", compare(9, 9, 3, 6).better === "draw");
  t("Huge bag → leftover=0", calcGrid(10, 10, 10, 10).leftover === 0);
  t("Overflow → 0 bags", calcGrid(3, 3, 5, 2.5).total === 0);
  t("clamp guards negatives", clamp(Number("-5") || 1, 1, 500) === 1);
  const pass = ok.filter(Boolean).length;
  console.log(`[SPACEPLAN] ${pass}/${ok.length} unit test LULUS`);
  $("testSummary").textContent = `🛠 ${pass}/${ok.length} unit test LULUS`;
  return pass === ok.length;
}

/* INIT */
function init(){
  state = loadState();
  syncControls(state);
  bindEvents();
  updateAll();
  startParticles();
  runAutomatedTests();
  toast("Selamat datang di perencana sleepover!", "🏕️");
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();

/* Ekspos untuk debugging di console browser. */
window.SpacePlanner = { calcGrid, compare, runAutomatedTests, getState: () => ({ ...state }) };