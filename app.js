/* VESTIR STYLE · camisetas e moletons personalizados para grupos
   Tudo roda no navegador: three.js desenha a peça, canvases 2D viram as estampas. */
(() => {
"use strict";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let toastT;
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2600); }
function h(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else if (k === "style") n.style.cssText = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
  return n;
}
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } } };
function download(url, name) { const a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove(); }

/* =============================== DADOS =============================== */
const FONTS = ["Archivo Black", "Bebas Neue", "Sora", "Caveat", "Space Mono", "Inter"];
const PALETTE = ["#F1E27A", "#F4F4F2", "#1C1B22", "#6D5DF6", "#3C6FD8", "#2BB3A3", "#C8F560", "#FF7A59", "#E8DCC6", "#6B1F35", "#F5B5C8", "#8A8F98", "#0F3D2E", "#D7263D", "#FFB000", "#7B4A2E"];
// tile = tamanho real (em metros) de um quadrado da textura do tecido
const FABRICS = {
  cotton: { name: "Algodão penteado", desc: "Liso e respirável", rough: .9, ns: .55, tile: .035, gen: "twill" },
  knit:   { name: "Malha tricô", desc: "Relevo em V aparente", rough: .93, ns: 1.0, tile: .06, gen: "knit" },
  fleece: { name: "Moletom felpado", desc: "Macio e encorpado", rough: .97, ns: .8, tile: .08, gen: "fleece" },
  pique:  { name: "Piquet", desc: "Textura de colmeia", rough: .9, ns: .85, tile: .045, gen: "pique" },
  nylon:  { name: "Dry fit", desc: "Leve, com brilho suave", rough: .45, ns: .35, tile: .05, gen: "ripstop", clear: .3 },
  velvet: { name: "Plush aveludado", desc: "Toque de veludo", rough: .8, ns: .3, tile: .08, gen: "fleece", sheen: true }
};
// anchors: altura (0 = barra, 1 = topo) onde a arte é centralizada
const MODELS = {
  hoodie: { name: "Moletom com capuz", desc: "Capuz, cordões e punhos canelados", file: "models/moletom.glb", parts: ["body", "rib", "strings"], frontPart: "strings",
    anchors: { front: .5, back: .43, sleeve: .4 }, sleeveRot: 90, box: { body: .46, sleeve: .3 },
    credit: { title: "UnderRated Hoodie", author: "UnderRated", url: "https://sketchfab.com/3d-models/underrated-hoodie-9b898f0b2be344cfa07ba6b3a83708b4" } },
  tshirt: { name: "Camiseta", desc: "Gola canelada, manga curta", file: "models/camiseta.glb", parts: ["front", "back", "sleeves", "collar"], frontPart: "front",
    anchors: { front: .63, back: .6, sleeve: .76 }, sleeveRot: 0, box: { body: .44, sleeve: .16 },
    credit: { title: "T Shirt", author: "funlab117", url: "https://sketchfab.com/3d-models/t-shirt-c1a3e5eb9b5445f4b7d4be82f1127eba" } }
};
const PART_NAMES = { body: "Corpo", rib: "Punhos e barra", strings: "Cordões", front: "Frente", back: "Costas", sleeves: "Mangas", collar: "Gola", detail: "Detalhes" };
const PRINT_PARTS = ["body", "front", "back", "sleeves"];
const partName = (p) => PART_NAMES[p] || p;
const PLACES = { front: "Frente", back: "Costas", sleeveL: "Manga esq.", sleeveR: "Manga dir." };
const BGS = {
  studio:   { name: "Estúdio", stops: ["#FAFAFB", "#E6E6EC"] },
  lilac:    { name: "Lilás", stops: ["#F6F4FF", "#D9D4FF"] },
  sky:      { name: "Céu", stops: ["#EEF6FF", "#BFD9F7"] },
  sunset:   { name: "Pôr do sol", stops: ["#FFF1E6", "#F7B9B0"] },
  mint:     { name: "Menta", stops: ["#F0FFF8", "#BDEBD8"] },
  graphite: { name: "Grafite", stops: ["#3A3A46", "#15151B"] }
};
const blankPrint = () => ({ kind: "none", stamp: null, stxt: "", ink: "#16152B", src: null, size: 240, x: 0, y: 0, rot: 0, white: false, text: "", font: "Archivo Black", tcolor: "#16152B", tsize: 60, arc: false, ty: 0 });
function mono(c, o = {}) { return Object.assign({ body: c, front: c, back: c, sleeves: c, collar: c, rib: c, strings: "#F4F1E4", detail: "#C9CAD1" }, o); }
function design(o) {
  const d = { model: "hoodie", fabric: "fleece", bg: "studio", shadow: true, colors: mono("#F1E27A"), prints: { front: blankPrint(), back: blankPrint(), sleeveL: blankPrint(), sleeveR: blankPrint() } };
  if (o.model) d.model = o.model; if (o.fabric) d.fabric = o.fabric; if (o.bg) d.bg = o.bg; if (o.colors) d.colors = o.colors;
  for (const k in o.prints || {}) Object.assign(d.prints[k], o.prints[k]);
  return d;
}
const LOOKS = [
  { id: "terceirao", name: "Terceirão", sub: "Moletom · turma de escola", view: "three", d: design({ colors: mono("#1F2A44", { rib: "#18213A", strings: "#F4F1E4" }), prints: { back: { kind: "stamp", stamp: "varsity", stxt: "TERCEIRÃO", ink: "#F4F1E4", size: 330, y: 10 }, front: { kind: "stamp", stamp: "vestir", ink: "#F4F1E4", size: 110, x: 75, y: 40 }, sleeveL: { text: "CLASS OF 2026", tsize: 30, tcolor: "#F4F1E4" }, sleeveR: { text: "CLASS OF 2026", tsize: 30, tcolor: "#F4F1E4" } } }) },
  { id: "formandos", name: "Formandos", sub: "Moletom · formatura", view: "front", d: design({ fabric: "velvet", colors: mono("#5E1A2E", { strings: "#E9D7A5" }), prints: { front: { kind: "stamp", stamp: "formandos", stxt: "Formandos", ink: "#E9D7A5", size: 260, y: 10 } } }) },
  { id: "time", name: "Time", sub: "Camiseta · futebol e esportes", view: "front", d: design({ model: "tshirt", fabric: "nylon", colors: mono("#F4F4F2", { collar: "#1F2A44", sleeves: "#1F2A44" }), prints: { front: { kind: "stamp", stamp: "escudo", stxt: "UNIDOS FC", ink: "#1F2A44", size: 170, y: 10 }, back: { text: "10", font: "Archivo Black", tcolor: "#1F2A44", tsize: 160, ty: -20 } } }) },
  { id: "classic", name: "Vestir Classic", sub: "Moletom · coleção da marca", view: "three", d: design({ colors: mono("#F1E27A", { rib: "#E9D86A" }), prints: { back: { kind: "stamp", stamp: "selo", size: 360, y: 0 }, sleeveL: { text: "VESTIR STYLE", tsize: 30 }, sleeveR: { text: "VESTIR STYLE", tsize: 30 } } }) },
  { id: "familia", name: "Família", sub: "Camiseta · encontros e viagens", view: "front", d: design({ model: "tshirt", fabric: "cotton", colors: mono("#E8DCC6", { collar: "#DCCDB2" }), prints: { front: { kind: "stamp", stamp: "onda", ink: "#6B4E31", size: 230, y: 0 } } }) },
  { id: "drop", name: "New Drop", sub: "Camiseta · coleção da marca", view: "three", d: design({ model: "tshirt", fabric: "cotton", colors: mono("#C8F560", { collar: "#16152B", sleeves: "#16152B" }), prints: { back: { kind: "stamp", stamp: "estrela", ink: "#16152B", size: 300, y: 0 } } }) }
];

/* estado */
let S;
const UI = { tool: "editar", place: "back", part: "body", res: 2400, transparent: false };
const imgCache = new Map(); // src -> HTMLImageElement
function loadState() {
  try {
    const m = location.hash.match(/^#d=(.+)$/);
    if (m) { const d = JSON.parse(decodeURIComponent(escape(atob(m[1])))); history.replaceState(null, "", location.pathname); return sanitize(d); }
  } catch {}
  try { const raw = ls.get("vestir-design"); if (raw) return sanitize(JSON.parse(raw)); } catch {}
  return structuredClone(LOOKS[0].d);
}
function sanitize(d) {
  const base = design({});
  if (!d || typeof d !== "object") return base;
  if (MODELS[d.model]) base.model = d.model;
  if (FABRICS[d.fabric]) base.fabric = d.fabric;
  if (BGS[d.bg]) base.bg = d.bg;
  base.shadow = d.shadow !== false;
  for (const k in base.colors) if (typeof d.colors?.[k] === "string" && /^#[0-9a-f]{6}$/i.test(d.colors[k])) base.colors[k] = d.colors[k];
  for (const k in base.prints) {
    const p = d.prints?.[k]; if (!p) continue;
    const b = base.prints[k];
    for (const f in b) if (p[f] != null && typeof p[f] === typeof b[f]) b[f] = p[f];
    if (typeof p.src === "string" && p.src.startsWith("data:image/")) b.src = p.src;
    if (typeof p.stamp === "string") b.stamp = p.stamp;
    if (!["none", "stamp", "image"].includes(b.kind)) b.kind = "none";
    if (b.kind === "image" && !b.src) b.kind = "none";
  }
  return base;
}
let saveT;
function persist() {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    if (!ls.set("vestir-design", JSON.stringify(S))) {
      const lite = structuredClone(S); for (const k in lite.prints) if (lite.prints[k].kind === "image") { lite.prints[k].kind = "none"; lite.prints[k].src = null; }
      ls.set("vestir-design", JSON.stringify(lite));
    }
  }, 500);
}

/* =========================== TEXTURAS DE TECIDO =========================== */
const N = 256;
function valueNoise(freq, seed) {
  let s = seed * 9973 + 1; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = Array.from({ length: freq * freq }, rnd);
  const at = (x, y) => g[((y % freq + freq) % freq) * freq + ((x % freq + freq) % freq)];
  const out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const fx = x / N * freq, fy = y / N * freq, ix = Math.floor(fx), iy = Math.floor(fy);
    let tx = fx - ix, ty = fy - iy; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    out[y * N + x] = lerp(lerp(at(ix, iy), at(ix + 1, iy), tx), lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx), ty);
  }
  return out;
}
const HEIGHTS = {
  knit() { const n = valueNoise(64, 3), o = new Float32Array(N * N); const cw = 16, ch = 16;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const lx = (x % cw) / cw, ly = (y % ch) / ch, side = lx < .5 ? lx * 2 : (1 - lx) * 2;
      const v = .5 + .5 * Math.cos((ly + (1 - side) * .55) * Math.PI * 2);
      const edge = Math.pow(Math.sin(Math.PI * ((lx * 2) % 1)), .5);
      o[y * N + x] = v * edge * .85 + n[y * N + x] * .15;
    } return o; },
  fleece() { const a = valueNoise(64, 7), b = valueNoise(128, 11), c = valueNoise(16, 5), o = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) o[i] = a[i] * .45 + b[i] * .4 + c[i] * .15; return o; },
  twill() { const n = valueNoise(128, 13), o = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o[y * N + x] = (.5 + .5 * Math.sin((x + y) / N * Math.PI * 2 * 32)) * .7 + n[y * N + x] * .3; return o; },
  pique() { const n = valueNoise(64, 17), o = new Float32Array(N * N), c = 16;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const row = Math.floor(y / c), ox = row % 2 ? c / 2 : 0, lx = ((x + ox) % c) / c - .5, ly = (y % c) / c - .5;
      const d = Math.sqrt(lx * lx + ly * ly) * 2; o[y * N + x] = (1 - clamp(d, 0, 1)) ** 1.5 * .85 + n[y * N + x] * .15;
    } return o; },
  ripstop() { const n = valueNoise(128, 19), o = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const grid = (x % 32 < 2 || y % 32 < 2) ? 1 : 0, weave = .5 + .25 * Math.sin(x / N * Math.PI * 2 * 64) * Math.sin(y / N * Math.PI * 2 * 64);
      o[y * N + x] = grid * .6 + weave * .3 + n[y * N + x] * .1;
    } return o; },
  rib() { const n = valueNoise(64, 23), o = new Float32Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const s = .5 + .5 * Math.sin(x / N * Math.PI * 2 * 16); o[y * N + x] = Math.pow(s, .6) * .9 + n[y * N + x] * .1; } return o; }
};
const heightCache = {};
function heights(gen) { return heightCache[gen] || (heightCache[gen] = HEIGHTS[gen]()); }
const normalCanvasCache = {};
function normalCanvas(gen) {
  if (normalCanvasCache[gen]) return normalCanvasCache[gen];
  const hm = heights(gen), c = document.createElement("canvas"); c.width = c.height = N;
  const ctx = c.getContext("2d"), img = ctx.createImageData(N, N), k = 3.2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const l = hm[y * N + (x - 1 + N) % N], r = hm[y * N + (x + 1) % N], u = hm[((y - 1 + N) % N) * N + x], d = hm[((y + 1) % N) * N + x];
    let nx = (l - r) * k, ny = (d - u) * k, nz = 1; const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
    const i = (y * N + x) * 4; img.data[i] = (nx * .5 + .5) * 255; img.data[i + 1] = (ny * .5 + .5) * 255; img.data[i + 2] = (nz * .5 + .5) * 255; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return (normalCanvasCache[gen] = c);
}
function swatchURL(gen, color, size = 160) {
  const hm = heights(gen), c = document.createElement("canvas"); c.width = c.height = size;
  const ctx = c.getContext("2d"), img = ctx.createImageData(size, size), col = new THREE.Color(color);
  const sc = N / size * .5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.floor(x * sc) % N, sy = Math.floor(y * sc) % N;
    const l = hm[sy * N + (sx + N - 1) % N], r = hm[sy * N + (sx + 1) % N], u = hm[((sy + N - 1) % N) * N + sx], d = hm[((sy + 1) % N) * N + sx];
    const shade = clamp(.82 + (l - r) * 1.6 + (u - d) * 1.6 + (hm[sy * N + sx] - .5) * .25, .45, 1.2);
    const i = (y * size + x) * 4; img.data[i] = clamp(col.r * 255 * shade, 0, 255); img.data[i + 1] = clamp(col.g * 255 * shade, 0, 255); img.data[i + 2] = clamp(col.b * 255 * shade, 0, 255); img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c.toDataURL();
}

/* =============================== ESTAMPAS =============================== */
function arcText(ctx, text, R, font, top) {
  ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  const ws = [...text].map((ch) => ctx.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) / R;
  let a = top ? -Math.PI / 2 - total / 2 : Math.PI / 2 + total / 2;
  [...text].forEach((ch, i) => {
    const da = ws[i] / R, mid = top ? a + da / 2 : a - da / 2;
    ctx.save(); ctx.translate(Math.cos(mid) * R, Math.sin(mid) * R); ctx.rotate(top ? mid + Math.PI / 2 : mid - Math.PI / 2); ctx.fillText(ch, 0, 0); ctx.restore();
    a = top ? a + da : a - da;
  });
}
function star(ctx, cx, cy, r1, r2, n = 5) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / n; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  ctx.closePath();
}
function fitFont(ctx, text, weightFamily, maxPx, maxW) { let px = maxPx; ctx.font = `${px}px ${weightFamily}`; const w = ctx.measureText(text).width; if (w > maxW) px = Math.floor(px * maxW / w); ctx.font = `${px}px ${weightFamily}`; return px; }
function shieldPath(ctx, w, hh) { ctx.beginPath(); ctx.moveTo(-w, -hh); ctx.lineTo(w, -hh); ctx.lineTo(w, hh * .1); ctx.quadraticCurveTo(w * .9, hh * .75, 0, hh * 1.1); ctx.quadraticCurveTo(-w * .9, hh * .75, -w, hh * .1); ctx.closePath(); }
const STAMPS = {
  vestir: { name: "Vestir Style", draw(ctx, ink) {
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, -150, 150, 0, Math.PI * 2); ctx.stroke();
    ctx.font = '190px "Archivo Black"'; ctx.fillText("V", 0, -140);
    ctx.lineWidth = 10; star(ctx, -250, -150, 30, 13); ctx.fill(); star(ctx, 250, -150, 30, 13); ctx.fill();
    ctx.font = '170px "Archivo Black"'; ctx.fillText("VESTIR", 0, 120);
    ctx.font = '600 88px "Sora"'; ctx.fillText("S  T  Y  L  E", 0, 250);
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(-360, 330); ctx.lineTo(-120, 330); ctx.moveTo(120, 330); ctx.lineTo(360, 330); ctx.stroke();
    ctx.font = '600 44px "Sora"'; ctx.fillText("EST. 2026", 0, 332);
  } },
  varsity: { name: "Turma (college)", custom: "TERCEIRÃO", draw(ctx, ink, txt) {
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const t = (txt || "TERCEIRÃO").toUpperCase().slice(0, 16);
    const px = Math.max(58, Math.min(112, Math.floor(1150 / Math.max(t.length, 6))));
    ctx.save(); ctx.translate(0, 90); arcText(ctx, t, 380, `${px}px "Archivo Black"`, true); ctx.restore();
    ctx.font = '320px "Archivo Black"'; ctx.lineWidth = 16; ctx.lineJoin = "round";
    ctx.strokeText("26", 0, 150); ctx.fillText("26", 0, 150);
    ctx.font = '600 60px "Sora"'; ctx.fillText("CLASS OF 2026", 0, 370);
    ctx.lineWidth = 10; star(ctx, -330, 150, 40, 17); ctx.fill(); star(ctx, 330, 150, 40, 17); ctx.fill();
  } },
  escudo: { name: "Escudo (time)", custom: "UNIDOS FC", draw(ctx, ink, txt) {
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineWidth = 26; ctx.lineJoin = "round"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    shieldPath(ctx, 330, 360); ctx.stroke();
    ctx.lineWidth = 10; shieldPath(ctx, 290, 320); ctx.stroke();
    for (let i = -1; i <= 1; i++) { star(ctx, i * 110, -230, 40, 17); ctx.fill(); }
    const t = (txt || "UNIDOS FC").toUpperCase().slice(0, 14);
    ctx.fillRect(-420, -110, 840, 170);
    ctx.save(); ctx.globalCompositeOperation = "destination-out"; fitFont(ctx, t, '"Archivo Black"', 120, 760); ctx.fillText(t, 0, -22); ctx.restore();
    ctx.font = '600 70px "Sora"'; ctx.fillText("DESDE 2026", 0, 160);
  } },
  formandos: { name: "Formandos", custom: "Formandos", draw(ctx, ink, txt) {
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const t = txt || "Formandos"; fitFont(ctx, t, '"Caveat"', 300, 900); ctx.fillText(t, 0, -40);
    ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-380, 110); ctx.bezierCurveTo(-120, 70, 120, 150, 380, 100); ctx.stroke();
    ctx.font = '220px "Archivo Black"'; ctx.fillText("2026", 0, 260);
    ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(0, -330); ctx.lineTo(-90, -290); ctx.lineTo(0, -250); ctx.lineTo(90, -290); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-50, -270); ctx.lineTo(-50, -225); ctx.quadraticCurveTo(0, -205, 50, -225); ctx.lineTo(50, -270); ctx.fill();
    ctx.beginPath(); ctx.moveTo(80, -285); ctx.lineTo(80, -215); ctx.stroke();
  } },
  selo: { name: "Selo", draw(ctx, ink) {
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 12; ctx.lineJoin = "round";
    for (let k = 0; k < 4; k++) { ctx.save(); ctx.rotate(k * Math.PI / 2); ctx.beginPath();
      const s = 205, o = 8; ctx.moveTo(o, o); ctx.lineTo(o + s - 100, o); ctx.arc(o + s - 100, o + 100, 100, -Math.PI / 2, 0); ctx.lineTo(o + s, o + s - 100); ctx.arc(o + s - 100, o + s - 100, 100, 0, Math.PI / 2); ctx.lineTo(o + 100, o + s); ctx.arc(o + 100, o + s - 100, 100, Math.PI / 2, Math.PI); ctx.closePath(); ctx.stroke(); ctx.restore(); }
    arcText(ctx, "VESTIR STYLE", 368, '96px "Archivo Black"', true);
    arcText(ctx, "SUA TURMA · SEU ESTILO", 352, '44px "Archivo Black"', false);
    ctx.lineWidth = 8; star(ctx, -392, 40, 46, 20); ctx.stroke(); star(ctx, 392, 40, 46, 20); ctx.stroke();
  } },
  raio: { name: "Raio", draw(ctx, ink) {
    ctx.fillStyle = ink; ctx.beginPath(); [[60, -440], [-250, 60], [-30, 60], [-110, 440], [250, -80], [30, -80], [140, -440]].forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(0, 0, 470, 0, Math.PI * 2); ctx.setLineDash([30, 26]); ctx.stroke(); ctx.setLineDash([]);
  } },
  onda: { name: "Onda", draw(ctx, ink) {
    ctx.strokeStyle = ink; ctx.lineWidth = 34; ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let x = -380; x <= 380; x += 8) ctx.lineTo(x, -260 + k * 95 + Math.sin(x / 70) * 34); ctx.stroke(); }
    ctx.fillStyle = ink; ctx.font = '150px "Archivo Black"'; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("GOOD", 0, 150); ctx.fillText("VIBES", 0, 300);
  } },
  smile: { name: "Sorriso", draw(ctx, ink) {
    ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 46; ctx.lineCap = "round";
    ctx.beginPath(); ctx.arc(0, 0, 400, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-135, -95, 42, 80, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(135, -95, 42, 80, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 40, 210, .18 * Math.PI, .82 * Math.PI); ctx.stroke();
  } },
  estrela: { name: "Estrela", draw(ctx, ink) {
    ctx.fillStyle = ink; star(ctx, 0, 0, 470, 370, 18); ctx.fill();
    ctx.globalCompositeOperation = "destination-out"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = '170px "Archivo Black"'; ctx.fillText("NEW", 0, -70); ctx.font = '120px "Archivo Black"'; ctx.fillText("DROP", 0, 90);
    ctx.globalCompositeOperation = "source-over";
  } }
};
const stampCache = new Map();
function stampCanvas(id, ink, txt) {
  const key = id + ink + (STAMPS[id].custom ? "|" + (txt || "") : ""); if (stampCache.has(key)) return stampCache.get(key);
  if (stampCache.size > 60) stampCache.clear();
  const c = document.createElement("canvas"); c.width = c.height = 1024; const ctx = c.getContext("2d");
  ctx.translate(512, 512); STAMPS[id].draw(ctx, ink, txt); stampCache.set(key, c); return c;
}

/* ============================== CENA 3D ============================== */
const canvas = $("#gl"), stage = $("#stage");
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true }); }
catch (e) { $("#loading").innerHTML = "<div style='max-width:36ch;text-align:center'>Seu navegador não conseguiu abrir o 3D. Tente no Chrome atualizado ou ative a aceleração de hardware.</div>"; return; }
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), .04).texture;
const camera = new THREE.PerspectiveCamera(28, 1, .1, 60);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = .08; controls.enablePan = false;
controls.minDistance = 2.2; controls.maxDistance = 7.5; controls.minPolarAngle = .35; controls.maxPolarAngle = 1.95;
controls.target.set(0, .08, 0); controls.autoRotateSpeed = 2.2;
const key = new THREE.DirectionalLight(0xffffff, .75); key.position.set(2.2, 3.2, 3.4); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.2, bottom: -1.2, near: .5, far: 10 }); key.shadow.bias = -.0004; key.shadow.normalBias = .015; key.shadow.radius = 4; scene.add(key);
const rim = new THREE.DirectionalLight(0xdcd8ff, .45); rim.position.set(-3, 2, -3.5); scene.add(rim);
scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d6e8, .15));
const garment = new THREE.Group(); scene.add(garment);

/* sombra de contato */
const shadowTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, "rgba(20,18,50,.55)"); g.addColorStop(.55, "rgba(20,18,50,.18)"); g.addColorStop(1, "rgba(20,18,50,0)"); x.fillStyle = g; x.fillRect(0, 0, 256, 256); return new THREE.CanvasTexture(c); })();
const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = -.9; scene.add(shadowMesh);

/* fundos */
const bgTexCache = {};
function bgTexture(id) {
  if (bgTexCache[id]) return bgTexCache[id];
  const c = document.createElement("canvas"); c.width = c.height = 512; const x = c.getContext("2d"), [a, b] = BGS[id].stops;
  const g = x.createRadialGradient(256, 210, 20, 256, 256, 420); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (bgTexCache[id] = t);
}
function applyBg() {
  const id = S.bg === "transparent" ? "studio" : S.bg;
  scene.background = bgTexture(id);
  stage.style.background = `radial-gradient(circle at 50% 40%, ${BGS[id].stops[0]}, ${BGS[id].stops[1]})`;
  shadowMesh.visible = S.shadow;
  const dark = id === "graphite"; key.intensity = dark ? .95 : .75;
}

/* ----- modelos reais (.glb) ----- */
const gltfLoader = new THREE.GLTFLoader();
const modelCache = {};
function denorm(arr) {
  if (arr instanceof Int16Array) return (v) => Math.max(v / 32767, -1);
  if (arr instanceof Uint16Array) return (v) => v / 65535;
  if (arr instanceof Int8Array) return (v) => Math.max(v / 127, -1);
  if (arr instanceof Uint8Array) return (v) => v / 255;
  return (v) => v;
}
function toFloat(attr) {
  const arr = attr.isInterleavedBufferAttribute ? attr.data.array : attr.array, f = attr.normalized ? denorm(arr) : (v) => v;
  const n = attr.count, sz = attr.itemSize, out = new Float32Array(n * sz), g = ["getX", "getY", "getZ", "getW"];
  for (let i = 0; i < n; i++) for (let k = 0; k < sz; k++) out[i * sz + k] = f(attr[g[k]](i));
  return new THREE.BufferAttribute(out, sz);
}
function setLoading(t) { const el = $("#loadTxt"); if (el) el.textContent = t; }
function loadModel(id) {
  if (modelCache[id]) return modelCache[id];
  return (modelCache[id] = new Promise((resolve, reject) => {
    gltfLoader.load(MODELS[id].file, (gltf) => {
      gltf.scene.updateMatrixWorld(true);
      const items = [];
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const nm = (o.name + " " + (o.parent ? o.parent.name : "")).match(/(body|rib|strings|detail|front|back|sleeves|collar)/);
        const g = new THREE.BufferGeometry(), a = o.geometry.attributes;
        g.setAttribute("position", toFloat(a.position)); if (a.normal) g.setAttribute("normal", toFloat(a.normal)); if (a.uv) g.setAttribute("uv", toFloat(a.uv));
        if (o.geometry.index) g.setIndex(new THREE.BufferAttribute(Uint32Array.from(o.geometry.index.array), 1));
        g.applyMatrix4(o.matrixWorld); if (!a.normal) g.computeVertexNormals();
        items.push({ part: nm ? nm[1] : "body", geo: g });
        o.geometry.dispose();
      });
      // gira para a frente da peça ficar virada para a câmera (+z)
      const boxOf = (list) => { const b = new THREE.Box3(); list.forEach((it) => { it.geo.computeBoundingBox(); b.union(it.geo.boundingBox); }); return b; };
      const all = boxOf(items), c = all.getCenter(new THREE.Vector3());
      const fc = boxOf(items.filter((it) => it.part === MODELS[id].frontPart)).getCenter(new THREE.Vector3());
      const yaw = Math.atan2(fc.x - c.x, fc.z - c.z);
      const m = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z).premultiply(new THREE.Matrix4().makeRotationY(-yaw));
      items.forEach((it) => it.geo.applyMatrix4(m));
      const b2 = boxOf(items), H = b2.max.y - b2.min.y, s = 1.5 / H;
      const c2 = b2.getCenter(new THREE.Vector3());
      const m2 = new THREE.Matrix4().makeTranslation(-c2.x, -b2.min.y, -c2.z).premultiply(new THREE.Matrix4().makeScale(s, s, s)).premultiply(new THREE.Matrix4().makeTranslation(0, -.8, 0));
      items.forEach((it) => { it.geo.applyMatrix4(m2); it.geo.computeBoundingBox(); it.geo.computeBoundingSphere(); });
      // quantos "uv" existem por metro real (para a trama do tecido ter o tamanho certo)
      items.forEach((it) => {
        const uv = it.geo.attributes.uv; if (!uv) { it.uvpm = 10; return; }
        let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
        for (let i = 0; i < uv.count; i += 7) { const u = uv.getX(i), v = uv.getY(i); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
        const sz = it.geo.boundingBox.getSize(new THREE.Vector3()), worldSpan = Math.max(sz.x, sz.y, sz.z) / s;
        it.uvpm = Math.max(u1 - u0, v1 - v0) / Math.max(worldSpan, .01);
      });
      resolve({ id, items, s, box: boxOf(items), decals: null });
    }, (e) => { if (e.total) setLoading(`Carregando ${MODELS[id].name.toLowerCase()}… ${Math.round(e.loaded / e.total * 100)}%`); }, reject);
  }));
}

/* ----- materiais ----- */
const normalTexCache = {};
function normalTex(gen, rep) {
  const r = Math.max(.05, Math.round(rep * 20) / 20), k = gen + r; if (normalTexCache[k]) return normalTexCache[k];
  const t = new THREE.CanvasTexture(normalCanvas(gen)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(r, r); t.anisotropy = MAX_ANISO;
  return (normalTexCache[k] = t);
}
function srgb(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }
function fabricMaterial(color, uvpm) {
  const f = FABRICS[S.fabric];
  const m = f.sheen ? new THREE.MeshPhysicalMaterial({ roughness: f.rough, sheen: new THREE.Color(.5, .5, .55) })
    : f.clear ? new THREE.MeshPhysicalMaterial({ roughness: f.rough, clearcoat: f.clear, clearcoatRoughness: .55 })
    : new THREE.MeshStandardMaterial({ roughness: f.rough });
  m.color = srgb(color); m.normalMap = normalTex(f.gen, 1 / (f.tile * uvpm)); m.normalScale.set(f.ns, f.ns); m.side = THREE.DoubleSide; m.envMapIntensity = .75;
  return m;
}
function ribMaterial(color, uvpm) {
  const m = new THREE.MeshStandardMaterial({ color: srgb(color), roughness: .95, side: THREE.DoubleSide, envMapIntensity: .75 });
  m.normalMap = normalTex("rib", 1 / (.03 * uvpm)); m.normalScale.set(1.2, 1.2); return m;
}
function materialFor(it) {
  const c = S.colors[it.part] || "#ffffff";
  if (it.part === "strings") return new THREE.MeshStandardMaterial({ color: srgb(c), roughness: .85, side: THREE.DoubleSide });
  if (it.part === "detail") return new THREE.MeshStandardMaterial({ color: srgb(c), roughness: .35, metalness: .85, side: THREE.DoubleSide });
  if (it.part === "rib" || it.part === "collar") return ribMaterial(c, it.uvpm);
  return fabricMaterial(c, it.uvpm);
}

/* ----- estampas: um canvas por lugar, projetado na superfície (acompanha as dobras) ----- */
const DECAL_KEYS = ["front", "back", "sleeveL", "sleeveR"], DC = 1024;
const printCanvases = {}, printTex = {};
for (const k of DECAL_KEYS) {
  const c = document.createElement("canvas"); c.width = c.height = DC; printCanvases[k] = c;
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = MAX_ANISO; printTex[k] = t;
}
function facing(geo, dir, min = .12) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv; if (!p || !p.count) return null;
  const P = [], Nn = [], U = [], a = new THREE.Vector3(), back = dir.clone().negate();
  for (let i = 0; i < p.count; i += 3) {
    a.set(0, 0, 0); for (let j = 0; j < 3; j++) a.add(new THREE.Vector3(n.getX(i + j), n.getY(i + j), n.getZ(i + j)));
    if (a.normalize().dot(back) < min) continue;
    for (let j = 0; j < 3; j++) { P.push(p.getX(i + j), p.getY(i + j), p.getZ(i + j)); Nn.push(n.getX(i + j), n.getY(i + j), n.getZ(i + j)); U.push(uv.getX(i + j), uv.getY(i + j)); }
  }
  geo.dispose(); if (!P.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(Nn, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  return g;
}
function computeDecals(M) {
  const cfg = MODELS[M.id], a = cfg.anchors, b = M.box, H = b.max.y - b.min.y, y = (f) => b.min.y + f * H, cz = (b.min.z + b.max.z) / 2;
  const targets = M.items.filter((it) => PRINT_PARTS.includes(it.part)).map((it) => new THREE.Mesh(it.geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  targets.forEach((t) => t.updateMatrixWorld());
  const rc = new THREE.Raycaster(), out = {};
  const spec = {
    front: [[0, y(a.front), 5], [0, 0, -1], [0, 0, 0], cfg.box.body, .16],
    back: [[0, y(a.back), -5], [0, 0, 1], [0, Math.PI, 0], cfg.box.body, .16],
    sleeveR: [[5, y(a.sleeve), cz], [-1, 0, 0], [0, Math.PI / 2, 0], cfg.box.sleeve, .07],
    sleeveL: [[-5, y(a.sleeve), cz], [1, 0, 0], [0, -Math.PI / 2, 0], cfg.box.sleeve, .07]
  };
  for (const k in spec) {
    const [o, d, e, B, depth] = spec[k], dir = new THREE.Vector3(...d);
    rc.set(new THREE.Vector3(...o), dir);
    const hit = rc.intersectObjects(targets)[0]; if (!hit) continue;
    // projeta em todas as camadas de tecido e guarda só o que está virado para fora
    const geos = targets.map((t) => facing(new THREE.DecalGeometry(t, hit.point, new THREE.Euler(...e), new THREE.Vector3(B * M.s, B * M.s, depth * M.s)), dir, k.startsWith("sleeve") ? .42 : .12)).filter(Boolean);
    if (geos.length) out[k] = geos;
  }
  return out;
}

let G = null;
const meshesByPart = {}, decalMeshes = {};
function disposeGarment() {
  garment.traverse((o) => { if (o.isMesh && o.material && !o.userData.keepMat) o.material.dispose(); if (o.userData.mat) o.userData.mat.dispose(); });
  garment.clear(); for (const k in meshesByPart) delete meshesByPart[k]; for (const k in decalMeshes) delete decalMeshes[k];
}
let buildSeq = 0;
async function buildGarment() {
  const id = S.model, seq = ++buildSeq;
  let M;
  try { M = await loadModel(id); } catch (e) { console.error(e); setLoading("Não consegui carregar o modelo 3D. Recarregue a página."); return; }
  if (seq !== buildSeq) return;
  if (!M.decals) M.decals = computeDecals(M);
  disposeGarment(); G = M;
  for (const it of M.items) {
    const mesh = new THREE.Mesh(it.geo, materialFor(it)); mesh.castShadow = mesh.receiveShadow = true;
    (meshesByPart[it.part] ||= []).push(mesh); garment.add(mesh);
  }
  for (const k of DECAL_KEYS) {
    if (!M.decals[k]) continue;
    const mat = new THREE.MeshStandardMaterial({ map: printTex[k], transparent: true, roughness: .78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6, envMapIntensity: .6 });
    const grp = new THREE.Group();
    for (const g of M.decals[k]) { const dm = new THREE.Mesh(g, mat); dm.receiveShadow = true; dm.renderOrder = 2; dm.userData.keepMat = true; grp.add(dm); }
    grp.userData.mat = mat; decalMeshes[k] = grp; garment.add(grp);
  }
  drawPrints();
  if (first) { first = false; requestAnimationFrame(() => { $("#loading").style.opacity = 0; setTimeout(() => $("#loading").hidden = true, 400); }); }
}
function shade(hex, k) { const c = new THREE.Color(hex); c.multiplyScalar(1 - k); return "#" + c.getHexString(); }
function recolor() { for (const part in meshesByPart) for (const m of meshesByPart[part]) if (S.colors[part]) m.material.color.copy(srgb(S.colors[part])); }
const mainColor = () => S.colors[MODELS[S.model].parts[0]];

/* ----- desenho das estampas ----- */
const processed = new Map(); // src -> canvas sem fundo branco
function getImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const im = new Image(); im.onload = () => { drawPrints(); renderPanelSoon(); }; im.src = src; imgCache.set(src, im); return im;
}
function whiteless(src) {
  if (processed.has(src)) return processed.get(src);
  const im = getImage(src); if (!im.complete || !im.naturalWidth) return null;
  const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext("2d"); x.drawImage(im, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height), a = d.data;
  for (let i = 0; i < a.length; i += 4) { const m = Math.min(a[i], a[i + 1], a[i + 2]); if (m > 200) a[i + 3] = a[i + 3] * clamp((245 - m) / 45, 0, 1); }
  x.putImageData(d, 0, 0); processed.set(src, c); return c;
}
function artSource(p) {
  if (p.kind === "stamp" && STAMPS[p.stamp]) return stampCanvas(p.stamp, p.ink, p.stxt || STAMPS[p.stamp].custom);
  if (p.kind === "image" && p.src) { if (p.white) return whiteless(p.src); const im = getImage(p.src); return im.complete && im.naturalWidth ? im : null; }
  return null;
}
function paint(ctx, p, cx, cy, kx, ky, maxW) {
  ctx.save(); ctx.translate(cx + p.x * kx, cy - p.y * ky); ctx.scale(kx, ky); ctx.rotate(p.rot * Math.PI / 180);
  const src = artSource(p);
  if (src) { const w = p.size, sw = src.naturalWidth || src.width, sh = src.naturalHeight || src.height, hh = w * sh / sw; ctx.drawImage(src, -w / 2, -hh / 2, w, hh); }
  if (p.text) {
    ctx.fillStyle = p.tcolor; const font = `${p.font === "Sora" || p.font === "Inter" ? "800 " : ""}${p.tsize}px "${p.font}"`;
    if (p.arc) { ctx.save(); ctx.translate(0, -p.ty + p.tsize * 3.2); arcText(ctx, p.text, p.tsize * 3.2, font, true); ctx.restore(); }
    else {
      ctx.font = font; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const w = ctx.measureText(p.text).width, k = maxW && w > maxW ? maxW / w : 1; // texto grande demais: encolhe para caber
      ctx.save(); ctx.scale(k, k); ctx.fillText(p.text, 0, -p.ty / k); ctx.restore();
    }
  }
  ctx.restore();
}
function drawPrints() {
  const cfg = MODELS[S.model];
  for (const k of DECAL_KEYS) {
    const c = printCanvases[k].getContext("2d"); c.clearRect(0, 0, DC, DC);
    const p = S.prints[k], sleeve = k.startsWith("sleeve"), B = (sleeve ? cfg.box.sleeve : cfg.box.body) * 1000, kk = DC / B;
    const has = p.kind !== "none" || !!p.text;
    if (decalMeshes[k]) decalMeshes[k].visible = has;
    if (!has) { printTex[k].needsUpdate = true; continue; }
    c.save(); c.translate(DC / 2, DC / 2);
    if (sleeve && cfg.sleeveRot) c.rotate((k === "sleeveR" ? 1 : -1) * cfg.sleeveRot * Math.PI / 180);
    paint(c, p, 0, 0, kk, kk, B * .94); c.restore();
    printTex[k].needsUpdate = true;
  }
}

/* ----- câmera ----- */
const VIEWS = { front: 0, back: Math.PI, side: Math.PI / 2, three: Math.PI * .8 };
let tween = null;
function goView(name, instant) {
  const az = VIEWS[name] ?? 0, dist = 4.1, pol = 1.45;
  const sph = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
  let from = sph.theta, to = az; while (to - from > Math.PI) to -= Math.PI * 2; while (to - from < -Math.PI) to += Math.PI * 2;
  const s0 = { t: from, p: sph.phi, r: sph.radius }, s1 = { t: to, p: pol, r: dist };
  if (instant || reduced) { setSph(s1); return; }
  tween = { s0, s1, start: performance.now(), dur: 750 };
  setAuto(false);
}
function setSph({ t, p, r }) { camera.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(r, p, t)); camera.lookAt(controls.target); }
function setAuto(on) { controls.autoRotate = on; $("#autoBtn").setAttribute("aria-pressed", String(on)); }
$$("[data-view]").forEach((b) => b.addEventListener("click", () => goView(b.dataset.view)));
$("#autoBtn").addEventListener("click", () => setAuto(!controls.autoRotate));

/* ----- render ----- */
function resize() {
  const r = stage.getBoundingClientRect(); if (!r.width) return;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.fov = camera.aspect < .85 ? 34 : 28; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
let visible = true, recording = null;
new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(stage);
let first = true;
function loop(now) {
  requestAnimationFrame(loop);
  if ((!visible && !recording) || galleryBusy) return;
  if (tween) {
    const t = clamp((now - tween.start) / tween.dur, 0, 1), e = 1 - Math.pow(1 - t, 3);
    setSph({ t: lerp(tween.s0.t, tween.s1.t, e), p: lerp(tween.s0.p, tween.s1.p, e), r: lerp(tween.s0.r, tween.s1.r, e) });
    if (t >= 1) tween = null;
  }
  if (recording) { const t = clamp((now - recording.start) / recording.dur, 0, 1); garment.rotation.y = t * Math.PI * 2; if (t >= 1) recording.finish(); }
  controls.update();
  renderer.render(scene, camera);

}

/* ----- salvar imagem ----- */
function renderStill(w, hgt, transparent, cam = camera, type = "image/png") {
  const prevBg = scene.background, pr = renderer.getPixelRatio(), size = renderer.getSize(new THREE.Vector2()), asp = camera.aspect;
  if (transparent) scene.background = null;
  renderer.setPixelRatio(1); renderer.setSize(w, hgt, false); cam.aspect = w / hgt; cam.updateProjectionMatrix();
  renderer.render(scene, cam); const url = renderer.domElement.toDataURL(type, .82);
  scene.background = prevBg; renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = asp; camera.updateProjectionMatrix();
  return url;
}
$("#saveBtn").addEventListener("click", (e) => { e.stopPropagation(); $("#savePop").hidden = !$("#savePop").hidden; });
document.addEventListener("click", (e) => { if (!$("#savePop").hidden && !e.target.closest(".save-wrap")) $("#savePop").hidden = true; });
$$("#resChips .chip").forEach((c) => c.addEventListener("click", () => { UI.res = +c.dataset.res; $$("#resChips .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c))); }));
$("#doSave").addEventListener("click", () => {
  const r = stage.getBoundingClientRect(), w = UI.res, hgt = Math.round(w * r.height / r.width);
  try { const url = renderStill(w, hgt, $("#transpChk").checked); download(url, `vestir-style-${S.model}-${Date.now().toString(36)}.png`); toast("Imagem salva na pasta Downloads"); $("#savePop").hidden = true; }
  catch (err) { console.error(err); toast("Não deu para gerar nesse tamanho. Tente o HD."); }
});

/* ----- vídeo 360° ----- */
function recordVideo(sec) {
  if (!window.MediaRecorder || !canvas.captureStream) { toast("Seu navegador não grava vídeo. Use o Chrome no computador."); return; }
  const types = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm"];
  const mime = types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  const stream = canvas.captureStream(30), rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10e6 } : undefined), chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.onstop = () => {
    const blob = new Blob(chunks, { type: mime || "video/webm" }), ext = (mime || "webm").includes("mp4") ? "mp4" : "webm";
    download(URL.createObjectURL(blob), `vestir-style-360.${ext}`); toast(`Vídeo salvo (.${ext}) na pasta Downloads`);
    $("#rec").hidden = true; renderPanel();
  };
  const wasAuto = controls.autoRotate; setAuto(false); controls.enabled = false;
  $("#rec").hidden = false; rec.start(200);
  recording = { start: performance.now(), dur: sec * 1000, finish() { recording = null; garment.rotation.y = 0; controls.enabled = true; setAuto(wasAuto); rec.stop(); } };
  renderPanel();
}

/* =============================== PAINEL =============================== */
const ICONS = {
  chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>',
  up: '<svg viewBox="0 0 72 72" fill="none"><rect x="8" y="14" width="46" height="46" rx="12" stroke="#fff" stroke-width="5"/><circle cx="23" cy="29" r="5" fill="#fff"/><path d="M12 54l14-14 10 10 6-6 12 12" stroke="#fff" stroke-width="5" stroke-linejoin="round"/><circle cx="54" cy="16" r="13" fill="#fff"/><path d="M54 10v12M48 16h12" stroke="#A99BF7" stroke-width="4" stroke-linecap="round"/></svg>',
  hoodie: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M22 14c2-6 18-6 20 0l10 6 6 22-8 2-3-12v26H17V32l-3 12-8-2 6-22z"/><path d="M24 15c2 6 14 6 16 0M28 20v8M36 20v8M22 44h20l-3-6H25z"/></svg>',
  crew: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M24 10c3 4 13 4 16 0l12 8 6 24-8 2-3-12v26H17V32l-3 12-8-2 6-24z"/><path d="M17 54h30"/></svg>',
  tshirt: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M24 10c3 4 13 4 16 0l14 8-5 10-6-3v31H21V25l-6 3-5-10z"/></svg>'
};
const svg = (s) => { const d = h("span", { style: "display:contents" }); d.innerHTML = s; return d.firstChild; };
let panelT;
function renderPanelSoon() { clearTimeout(panelT); panelT = setTimeout(renderPanel, 60); }
function setTool(t) { UI.tool = t; $$(".tool").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tool === t))); renderPanel(); }
$$(".tool").forEach((b) => b.addEventListener("click", () => { setTool(b.dataset.tool); if (innerWidth <= 1100) $("#panel").scrollIntoView({ behavior: "smooth", block: "start" }); }));
function changed(rebuild) { if (rebuild) buildGarment(); else drawPrints(); persist(); }

function slider(label, val, min, max, step, onInput, fmt = (v) => v) {
  const id = "s" + Math.random().toString(36).slice(2, 7);
  const out = h("output", { for: id, text: fmt(val) }), inp = h("input", { type: "range", id, min, max, step, value: val, "aria-label": label });
  inp.addEventListener("input", () => { out.textContent = fmt(+inp.value); onInput(+inp.value); });
  return h("label", { class: "slider", for: id }, h("span", { text: label }), inp, out);
}
function toggle(label, checked, on) { const i = h("input", { type: "checkbox" }); i.checked = checked; i.addEventListener("change", () => on(i.checked)); return h("label", { class: "toggle" }, label, i); }
function row(lbl, val, onclick) { const b = h("button", { class: "row", type: "button", onclick }, h("div", {}, h("span", { text: lbl }), h("b", { text: val }))); b.append(svg(ICONS.chev)); return b; }
function backTo(t, txt) { return h("button", { class: "back-link", type: "button", onclick: () => setTool(t) }, "‹ ", txt); }

function pickFile(place) {
  const inp = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/svg+xml" });
  inp.onchange = () => inp.files[0] && readFile(inp.files[0], place); inp.click();
}
function readFile(file, place) {
  if (!file.type.startsWith("image/")) return toast("Envie uma imagem (PNG, JPG, WEBP ou SVG).");
  if (file.size > 15e6) return toast("Imagem muito grande. Use até 15 MB.");
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      const m = 1600, k = Math.min(1, m / Math.max(im.naturalWidth || m, im.naturalHeight || m));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round((im.naturalWidth || m) * k)); c.height = Math.max(1, Math.round((im.naturalHeight || m) * k));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      const src = c.toDataURL("image/png"), p = S.prints[place];
      Object.assign(p, { kind: "image", src, stamp: null, size: place.startsWith("sleeve") ? Math.round(MODELS[S.model].box.sleeve * 600) : place === "back" ? 320 : 220, x: 0, y: 0, rot: 0 });
      UI.place = place; getImage(src); changed(); renderPanel();
      goView(place === "back" ? "back" : place === "front" ? "front" : "side"); toast("Arte aplicada em " + PLACES[place]);
    };
    im.onerror = () => toast("Não consegui abrir essa imagem.");
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}

function panelEditar() {
  const p = S.prints[UI.place];
  const chips = h("div", { class: "chips", role: "group", "aria-label": "Onde aplicar" },
    Object.entries(PLACES).map(([k, n]) => {
      const q = S.prints[k], has = q.kind !== "none" || q.text;
      return h("button", { class: "chip", type: "button", "aria-pressed": String(UI.place === k), onclick: () => { UI.place = k; renderPanel(); goView(k === "back" ? "back" : k === "front" ? "front" : "side"); } }, n, has ? h("span", { class: "dot" }) : null);
    }));
  const src = p.kind !== "none" ? artSource(p) : null;
  const up = h("div", { class: "upload", role: "button", tabindex: "0", "aria-label": "Enviar imagem para " + PLACES[UI.place] });
  if (src) { up.append(h("img", { class: "prev", alt: "", src: src.toDataURL ? src.toDataURL() : src.src }), h("span", { class: "chg", text: "Trocar imagem" })); }
  else { const d = h("div", {}); d.append(svg(ICONS.up)); d.append(h("b", { text: "Envie sua arte" }), h("small", { text: "Clique ou arraste aqui · PNG, JPG, SVG" })); up.append(d); }
  up.onclick = () => pickFile(UI.place);
  up.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pickFile(UI.place); } };
  ["dragenter", "dragover"].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) => up.addEventListener(ev, (e) => { e.preventDefault(); up.classList.remove("drag"); }));
  up.addEventListener("drop", (e) => { const f = e.dataTransfer.files[0]; if (f) readFile(f, UI.place); });

  const sleeve = UI.place.startsWith("sleeve");
  const adj = p.kind !== "none" ? h("div", { class: "card" },
    h("div", { class: "card-h" }, h("b", { text: "Ajustar arte" }), h("button", { class: "btn btn-sm btn-ghost", type: "button", onclick: () => { Object.assign(p, { kind: "none", src: null, stamp: null }); changed(); renderPanel(); } }, "Remover")),
    slider("Tamanho", p.size, 30, sleeve ? 300 : 460, 1, (v) => { p.size = v; changed(); }, (v) => v + " mm"),
    slider(sleeve ? "Lado a lado" : "Horizontal", p.x, -200, 200, 1, (v) => { p.x = v; changed(); }),
    slider("Vertical", p.y, -220, 220, 1, (v) => { p.y = v; changed(); }),
    slider("Rotação", p.rot, -180, 180, 1, (v) => { p.rot = v; changed(); }, (v) => v + "°"),
    p.kind === "image" ? toggle("Remover fundo branco", p.white, (v) => { p.white = v; changed(); renderPanelSoon(); }) : null,
    p.kind === "stamp" && STAMPS[p.stamp]?.custom ? (() => { const i = h("input", { class: "input", id: "stxtIn", maxlength: "16", value: p.stxt || STAMPS[p.stamp].custom, "aria-label": "Texto da estampa" }); i.addEventListener("input", () => { p.stxt = i.value; changed(); }); return h("label", { class: "field" }, "Nome na estampa (turma, time…)", i); })() : null,
    p.kind === "stamp" ? h("div", { class: "field" }, "Cor da estampa", inkPicker(p.ink, (c) => { p.ink = c; changed(); renderPanelSoon(); })) : null) : null;

  const stamps = h("div", { class: "card" }, h("div", { class: "card-h" }, h("b", { text: "Estampas prontas" }), h("span", { class: "sub", text: "clique para aplicar" })),
    h("div", { class: "stamps", style: "grid-template-columns:repeat(3,minmax(0,1fr))" }, Object.entries(STAMPS).map(([id, s]) =>
      h("button", { class: "stamp", type: "button", title: s.name, "aria-label": "Estampa " + s.name, "aria-pressed": String(p.kind === "stamp" && p.stamp === id),
        onclick: () => { Object.assign(p, { kind: "stamp", stamp: id, stxt: "", src: null, size: sleeve ? Math.round(MODELS[S.model].box.sleeve * 600) : UI.place === "back" ? 320 : 220, x: 0, y: 0, rot: 0 }); if (!p.ink || p.ink === "#16152B") p.ink = autoInk(); changed(); renderPanel(); } },
        h("img", { alt: "", src: stampThumb(id) })))));

  const txtInput = h("input", { class: "input", id: "txtIn", maxlength: "40", placeholder: sleeve ? "Ex.: VESTIR STYLE" : "Ex.: NOME DA TURMA", value: p.text });
  txtInput.addEventListener("input", () => { const was = p.text; p.text = txtInput.value; if (!was && p.text && p.kind !== "none" && p.ty === 0) { p.ty = -Math.round(p.size * .62 + p.tsize * .3); renderPanelSoon(); } changed(); });
  const fontSel = h("select", { class: "input", id: "fontSel", "aria-label": "Fonte" }, FONTS.map((f) => h("option", { value: f, text: f, selected: p.font === f || null })));
  fontSel.addEventListener("change", async () => { p.font = fontSel.value; await document.fonts.load(`80px "${p.font}"`).catch(() => {}); changed(); });
  const col = h("input", { type: "color", value: p.tcolor, "aria-label": "Cor do texto" }); col.addEventListener("input", () => { p.tcolor = col.value; changed(); });
  const text = h("div", { class: "card" }, h("b", { text: "Texto" }), txtInput,
    h("div", { class: "two" }, h("label", { class: "field" }, "Fonte", fontSel), h("label", { class: "field" }, "Cor", h("div", { class: "color-row" }, col))),
    slider("Tamanho", p.tsize, 16, 180, 1, (v) => { p.tsize = v; changed(); }, (v) => v + " mm"),
    slider("Posição", p.ty, -300, 300, 1, (v) => { p.ty = v; changed(); }),
    !sleeve ? toggle("Texto em arco", p.arc, (v) => { p.arc = v; changed(); }) : null);

  return [h("div", {}, h("h3", { text: "Personalize sua peça" }), h("p", { class: "sub", text: "Escolha onde aplicar e envie sua arte." })), chips, up, adj, stamps, text,
    row("Tecido", FABRICS[S.fabric].name, () => setTool("modelos")), row("Partes", MODELS[S.model].parts.length + " partes", () => setTool("cores")),
    h("span", { class: "model-id", text: "Modelo nº TR-" + (705000 + Object.keys(MODELS).indexOf(S.model) * 37 + Object.keys(FABRICS).indexOf(S.fabric)) })];
}
function autoInk() { const c = new THREE.Color(mainColor()); return (c.r * .3 + c.g * .59 + c.b * .11) > .5 ? "#16152B" : "#FFFFFF"; }
const thumbCache = {};
function stampThumb(id) { const ink = "#16152B"; return thumbCache[id] || (thumbCache[id] = (() => { const c = document.createElement("canvas"); c.width = c.height = 160; c.getContext("2d").drawImage(stampCanvas(id, ink), 0, 0, 160, 160); return c.toDataURL(); })()); }
function inkPicker(val, on) {
  const wrap = h("div", { class: "swatches" }, ["#16152B", "#FFFFFF", ...PALETTE.slice(3, 9)].map((c) => h("button", { class: "sw", type: "button", style: `background:${c}`, "aria-label": "Cor " + c, "aria-pressed": String(val.toLowerCase() === c.toLowerCase()), onclick: () => on(c) })));
  const pick = h("input", { type: "color", value: val, "aria-label": "Outra cor" }); pick.addEventListener("input", () => on(pick.value));
  return h("div", { style: "display:flex;flex-direction:column;gap:8px" }, wrap, h("div", { class: "color-row" }, pick, h("span", { class: "sub", text: "Outra cor" })));
}

function panelModelos() {
  return [h("div", {}, h("h3", { text: "Modelo e tecido" }), h("p", { class: "sub", text: "A peça muda na hora, mantendo suas artes." })),
    h("div", { class: "card" }, h("b", { text: "Modelo" }),
      h("div", { class: "opt-grid" }, Object.entries(MODELS).map(([id, m]) =>
        h("button", { class: "opt", type: "button", "aria-pressed": String(S.model === id), onclick: async () => { if (S.model === id) return; S.model = id; toast("Carregando " + MODELS[id].name.toLowerCase() + "…"); await buildGarment(); persist(); renderPanel(); } },
          h("span", { style: "width:42px;height:42px;color:var(--violet)" }, svg(ICONS[id])), h("b", { text: m.name }), h("small", { text: m.desc }))))),
    h("div", { class: "card" }, h("b", { text: "Tecido" }),
      h("div", { class: "opt-grid" }, Object.entries(FABRICS).map(([id, f]) =>
        h("button", { class: "opt", type: "button", "aria-pressed": String(S.fabric === id), onclick: () => { S.fabric = id; changed(true); renderPanel(); } },
          h("span", { class: "sw-img", style: `background-image:url(${swatchURL(f.gen, mainColor(), 120)})` }), h("b", { text: f.name }), h("small", { text: f.desc })))))];
}
function panelCores() {
  const parts = MODELS[S.model].parts; if (!parts.includes(UI.part)) UI.part = "body";
  const cur = S.colors[UI.part];
  const col = h("input", { type: "color", value: cur, "aria-label": "Cor de " + partName(UI.part) });
  const setPart = (c) => { S.colors[UI.part] = c; recolor(); persist(); renderPanelSoon(); };
  col.addEventListener("input", () => { S.colors[UI.part] = col.value; recolor(); persist(); });
  col.addEventListener("change", () => renderPanel());
  return [h("div", {}, h("h3", { text: "Cores das partes" }), h("p", { class: "sub", text: `${parts.length} partes editáveis. Escolha a parte e depois a cor.` })),
    h("div", { class: "card" }, h("b", { text: "Pintar a peça inteira" }),
      h("div", { class: "swatches" }, PALETTE.map((c) => h("button", { class: "sw", type: "button", style: `background:${c}`, "aria-label": "Tudo " + c, onclick: () => {
        parts.forEach((pt) => { if (pt !== "strings") S.colors[pt] = (pt === "rib" || pt === "collar") ? shade(c, .06) : c; }); recolor(); persist(); renderPanel(); toast("Cor aplicada na peça toda"); } })))),
    h("div", { class: "card" }, h("b", { text: "Partes" }),
      h("div", { class: "parts" }, parts.map((pt) => h("button", { class: "part", type: "button", "aria-pressed": String(UI.part === pt), onclick: () => { UI.part = pt; renderPanel(); } },
        h("i", { style: `background:${S.colors[pt]}` }), h("b", { text: partName(pt) })))),
      h("div", { class: "field" }, "Cor de " + partName(UI.part).toLowerCase(),
        h("div", { class: "swatches" }, PALETTE.map((c) => h("button", { class: "sw", type: "button", style: `background:${c}`, "aria-label": c, "aria-pressed": String(cur.toLowerCase() === c.toLowerCase()), onclick: () => setPart(c) }))),
        h("div", { class: "color-row" }, col, h("span", { class: "part", style: "border:0;padding:0;background:none" }, h("small", { text: cur.toUpperCase() })))))];
}
function panelFundo() {
  return [h("div", {}, h("h3", { text: "Fundo" }), h("p", { class: "sub", text: "Muda o cenário da foto e do vídeo." })),
    h("div", { class: "opt-grid" }, Object.entries(BGS).map(([id, b]) => h("button", { class: "opt", type: "button", "aria-pressed": String(S.bg === id), onclick: () => { S.bg = id; applyBg(); persist(); renderPanel(); } },
      h("span", { class: "sw-img", style: `background:radial-gradient(circle at 50% 40%, ${b.stops[0]}, ${b.stops[1]})` }), h("b", { text: b.name })))),
    h("div", { class: "card" }, toggle("Sombra no chão", S.shadow, (v) => { S.shadow = v; applyBg(); persist(); }),
      h("p", { class: "sub", text: "Para fundo transparente, marque a opção em \"Salvar imagem\"." }))];
}
function panelVideo() {
  const busy = !!recording;
  let dur = UI.vdur || 6;
  const chips = h("div", { class: "chips" }, [4, 6, 10].map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String(dur === s), onclick: () => { UI.vdur = s; renderPanel(); } }, s + " segundos")));
  return [h("div", {}, h("h3", { text: "Vídeo 360°" }), h("p", { class: "sub", text: "A peça dá uma volta completa enquanto o estúdio grava. Ótimo para Reels, Status e TikTok." })),
    h("div", { class: "card" }, h("b", { text: "Duração" }), chips,
      h("button", { class: "btn btn-violet", type: "button", disabled: busy || null, onclick: () => recordVideo(dur) }, busy ? "Gravando…" : "● Gravar vídeo 360°"),
      h("p", { class: "sub", text: "O vídeo usa o fundo e o ângulo atuais. No Chrome ele sai em MP4; em outros navegadores, em WEBM." }))];
}
function panelMais() {
  const reset = h("button", { class: "btn btn-ghost", type: "button" }, "Recomeçar do zero");
  reset.onclick = () => { if (reset.dataset.a !== "1") { reset.dataset.a = "1"; reset.textContent = "Clique de novo para confirmar"; setTimeout(() => { reset.dataset.a = ""; reset.textContent = "Recomeçar do zero"; }, 3500); return; }
    S = structuredClone(LOOKS[0].d); applyBg(); changed(true); goView("three"); setTool("editar"); toast("Design reiniciado"); };
  return [h("div", {}, h("h3", { text: "Mais opções" })),
    h("div", { class: "card" }, h("b", { text: "Seu projeto" }), h("p", { class: "sub", text: "Tudo o que você faz fica salvo sozinho neste navegador." }),
      h("button", { class: "btn btn-primary", type: "button", onclick: shareLink }, "Copiar link do design"),
      h("p", { class: "sub", text: "O link leva modelo, tecido, cores, textos e estampas prontas. Imagens enviadas não vão no link." }),
      h("button", { class: "btn btn-ghost", type: "button", onclick: () => { const url = renderStill(1200, 1200, true); download(url, "vestir-style-transparente.png"); } }, "Baixar PNG transparente rápido"), reset),
    h("div", { class: "card" }, h("b", { text: "Atalhos" }),
      h("p", { class: "sub" }, "Arrastar: girar · Rolar/pinça: zoom · Teclas ", h("b", { text: "1 2 3 4" }), ": frente, costas, lado, 3/4 · ", h("b", { text: "R" }), ": girar sozinho"))];
}
async function shareLink() {
  const lite = structuredClone(S); for (const k in lite.prints) if (lite.prints[k].kind === "image") { lite.prints[k].kind = "none"; lite.prints[k].src = null; }
  const url = location.origin + location.pathname + "#d=" + btoa(unescape(encodeURIComponent(JSON.stringify(lite))));
  try { await navigator.clipboard.writeText(url); toast("Link copiado! Cole no WhatsApp."); }
  catch { prompt("Copie o link:", url); }
}
function renderPanel() {
  const panel = $("#panel"), keep = document.activeElement?.id, scroll = panel.scrollTop;
  panel.textContent = "";
  panel.append(...({ editar: panelEditar, modelos: panelModelos, cores: panelCores, fundo: panelFundo, video: panelVideo, mais: panelMais }[UI.tool]()).filter(Boolean));
  panel.scrollTop = scroll; if (keep && $("#" + keep)) $("#" + keep).focus();
}
addEventListener("keydown", (e) => {
  if (e.target.closest("input,select,textarea")) return;
  const m = { 1: "front", 2: "back", 3: "side", 4: "three" }[e.key]; if (m) goView(m);
  if (e.key === "r" || e.key === "R") setAuto(!controls.autoRotate);
});

/* ======================= TECIDOS E GALERIA (vitrine) ======================= */
function renderFabricsShow() {
  const colors = { knit: "#F1E27A", fleece: "#8A8F98", cotton: "#E8DCC6", pique: "#2BB3A3", nylon: "#C8F560", velvet: "#6B1F35" };
  $("#fabricsShow").append(...Object.entries(FABRICS).map(([id, f]) => h("button", { class: "fabric", type: "button", onclick: () => { S.fabric = id; changed(true); setTool("modelos"); $("#estudio").scrollIntoView({ behavior: "smooth" }); toast(f.name + " aplicado"); } },
    h("div", { class: "img", style: `background-image:url(${swatchURL(f.gen, colors[id], 220)})` }), h("div", { class: "t" }, h("b", { text: f.name }), h("small", { text: f.desc })))));
}
let galleryBusy = false;
async function renderGallery() {
  const gal = $("#gallery");
  const cards = LOOKS.map((L) => {
    const img = h("img", { alt: `${L.name}: ${L.sub}` }), card = h("button", { class: "look", type: "button", onclick: () => {
      S = structuredClone(L.d); applyBg(); changed(true); goView(L.view); setTool("editar"); $("#estudio").scrollIntoView({ behavior: "smooth" }); toast("Look " + L.name + " aberto no estúdio"); } },
      h("div", { class: "img" }, img), h("div", { class: "t" }, h("div", {}, h("b", { text: L.name }), h("small", { text: L.sub })), h("span", { class: "go", text: "Editar →" })));
    gal.append(card); return img;
  });
  // renderizador separado: o estúdio continua parado na tela enquanto as fotos são feitas
  let tr;
  try { tr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch { return; }
  tr.outputEncoding = THREE.sRGBEncoding; tr.toneMapping = THREE.NoToneMapping; tr.setSize(720, 720, false);
  const env = new THREE.PMREMGenerator(tr).fromScene(new THREE.RoomEnvironment(), .04).texture;
  const cam = new THREE.PerspectiveCamera(28, 1, .1, 60);
  tr.shadowMap.enabled = true; tr.shadowMap.type = THREE.PCFSoftShadowMap;
  try { await Promise.all(Object.keys(MODELS).map(loadModel)); } catch { return; }
  for (let i = 0; i < LOOKS.length; i++) {
    await new Promise((r) => setTimeout(r, 60));
    while (recording) await new Promise((r) => setTimeout(r, 500));
    galleryBusy = true;
    const cur = S, mainEnv = scene.environment;
    S = structuredClone(LOOKS[i].d); S.bg = "lilac"; applyBg(); await buildGarment();
    cam.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(4.1, 1.45, VIEWS[LOOKS[i].view])); cam.lookAt(controls.target);
    scene.environment = env; tr.render(scene, cam); cards[i].src = tr.domElement.toDataURL("image/jpeg", .9); scene.environment = mainEnv;
    S = cur; applyBg(); await buildGarment(); galleryBusy = false;
  }
  tr.dispose(); tr.forceContextLoss();
}

/* ====================== API para o módulo de pedidos ====================== */
let readyResolve; const ready = new Promise((r) => (readyResolve = r));
window.VS = {
  ready, MODELS, STAMPS, PLACES,
  stampPNG: (id, ink, txt) => stampCanvas(id, ink, txt).toDataURL("image/png"),
  getDesign: () => structuredClone(S),
  async setDesign(d, view) { S = sanitize(d); applyBg(); await buildGarment(); renderPanel(); persist(); if (view) goView(view, true); },
  async snapshot(view, size = 640) {
    await ready; while (galleryBusy) await new Promise((r) => setTimeout(r, 120));
    const cam = camera.clone(); cam.fov = 28;
    cam.position.copy(controls.target).add(new THREE.Vector3().setFromSphericalCoords(4.1, 1.45, VIEWS[view])); cam.lookAt(controls.target);
    const prev = S.bg; return renderStill(size, size, false, cam, "image/jpeg");
  },
  toast
};

/* =============================== INÍCIO =============================== */
async function boot() {
  S = loadState();
  try { await Promise.race([Promise.all(FONTS.map((f) => document.fonts.load(`${f === "Sora" ? "800 " : ""}80px "${f}"`))), new Promise((r) => setTimeout(r, 6000))]); } catch {}
  document.fonts.addEventListener?.("loadingdone", () => { stampCache.clear(); drawPrints(); });
  stampCache.clear();
  applyBg(); resize(); goView("three", true);
  setTool("editar");
  requestAnimationFrame(loop);
  await buildGarment(); readyResolve();
  renderFabricsShow();
  setTimeout(renderGallery, 300);
}
boot();
})();
