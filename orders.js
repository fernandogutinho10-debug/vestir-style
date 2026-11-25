/* VESTIR STYLE · pedidos em grupo (turmas, times, famílias)
   Firebase (Firestore + login anônimo) ou modo demonstração (localStorage). */
(() => {
"use strict";
const CFG = window.VS_CONFIG || { firebaseConfig: {}, defaults: { prices: { tshirt: 69.9, hoodie: 169.9 } } };
const DEMO = !CFG.firebaseConfig.apiKey;
const $ = (s, r = document) => r.querySelector(s);
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
const toast = (m) => window.VS ? window.VS.toast(m) : alert(m);
const money = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
async function copy(text, ok) {
  try { await navigator.clipboard.writeText(text); toast(ok); }
  catch { const t = h("textarea", { style: "position:fixed;opacity:0" }); t.value = text; document.body.append(t); t.select(); try { document.execCommand("copy"); toast(ok); } catch { toast("Selecione e copie manualmente"); } t.remove(); }
}
const SIZES = ["PP", "P", "M", "G", "GG", "XG"];
const MEASURES = {
  tshirt: { PP: "47 × 67", P: "50 × 70", M: "53 × 72", G: "56 × 74", GG: "59 × 76", XG: "62 × 78" },
  hoodie: { PP: "51 × 64", P: "54 × 66", M: "57 × 68", G: "60 × 70", GG: "63 × 72", XG: "66 × 74" }
};
const STATUS = { aberto: ["Aberto", "p-ok"], fechado: ["Fechado", "p-warn"], producao: ["Em produção", "p-violet"], entregue: ["Entregue", "p-mute"] };
const modelName = (m) => (window.VS?.MODELS[m]?.name) || (m === "tshirt" ? "Camiseta" : "Moletom com capuz");
const pal = ["#6D5DF6", "#1F2A44", "#C7871A", "#2BB3A3", "#D7263D", "#3C6FD8", "#7B4A2E"];
const colorFor = (s) => { let x = 0; for (const c of String(s)) x = (x * 31 + c.charCodeAt(0)) >>> 0; return pal[x % pal.length]; };
const initials = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/* ============================ banco de dados ============================ */
let store = null;
async function firebaseStore() {
  const b = "https://www.gstatic.com/firebasejs/10.12.2/";
  const [{ initializeApp }, fs, au] = await Promise.all([import(b + "firebase-app.js"), import(b + "firebase-firestore.js"), import(b + "firebase-auth.js")]);
  const app = initializeApp(CFG.firebaseConfig, "vestir");
  const db = fs.getFirestore(app), auth = au.getAuth(app);
  const ref = (p) => fs.doc(db, ...p.split("/")), col = (p) => fs.collection(db, ...p.split("/"));
  const st = {
    uid: null, email: null,
    onAuth(cb) { au.onAuthStateChanged(auth, (u) => { if (!u) { au.signInAnonymously(auth).catch((e) => { console.error(e); cb(null); }); return; } st.uid = u.uid; st.email = u.email || null; cb(u); }); },
    isAdmin: () => !!st.email && !!CFG.ADMIN_EMAIL && st.email.toLowerCase() === CFG.ADMIN_EMAIL.toLowerCase(),
    onDoc: (p, cb, err) => fs.onSnapshot(ref(p), (s) => cb(s.exists() ? s.data() : null), err || console.error),
    onCol: (p, cb, err) => fs.onSnapshot(col(p), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), err || console.error),
    get: async (p) => { const s = await fs.getDoc(ref(p)); return s.exists() ? s.data() : null; },
    list: async (p) => (await fs.getDocs(col(p))).docs.map((d) => ({ id: d.id, ...d.data() })),
    set: (p, d) => fs.setDoc(ref(p), d), update: (p, d) => fs.updateDoc(ref(p), d), del: (p) => fs.deleteDoc(ref(p)),
    login: (e, p) => au.signInWithEmailAndPassword(auth, e, p), logout: () => au.signOut(auth)
  };
  return st;
}
function demoStore() {
  let data = {}; try { data = JSON.parse(ls.get("vestir-demo")) || {}; } catch {}
  let uid = ls.get("vestir-demo-uid"); if (!uid) { uid = "demo-" + Math.random().toString(36).slice(2, 10); ls.set("vestir-demo-uid", uid); }
  const L = new Set(), save = () => { ls.set("vestir-demo", JSON.stringify(data)); L.forEach((f) => f()); };
  const split = (p) => { const a = p.split("/"); return [a.slice(0, -1).join("/"), a.at(-1)]; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  let authCb = null;
  const st = {
    uid, email: ls.get("vestir-demo-admin") ? "admin@demo" : null, demo: true,
    onAuth(cb) { authCb = cb; setTimeout(() => cb({ uid }), 0); },
    isAdmin: () => !!st.email,
    onDoc(p, cb) { const [c, id] = split(p); const f = () => cb(data[c]?.[id] ? clone(data[c][id]) : null); L.add(f); f(); return () => L.delete(f); },
    onCol(p, cb) { const f = () => cb(Object.entries(data[p] || {}).map(([id, v]) => ({ id, ...clone(v) }))); L.add(f); f(); return () => L.delete(f); },
    async get(p) { const [c, id] = split(p); return data[c]?.[id] ? clone(data[c][id]) : null; },
    async list(p) { return Object.entries(data[p] || {}).map(([id, v]) => ({ id, ...clone(v) })); },
    async set(p, d) { const [c, id] = split(p); (data[c] ??= {})[id] = clone(d); save(); },
    async update(p, d) { const [c, id] = split(p); if (!data[c]?.[id]) throw { code: "not-found" }; Object.assign(data[c][id], clone(d)); save(); },
    async del(p) { const [c, id] = split(p); if (data[c]) delete data[c][id]; save(); },
    async login(e, p) { if (!e || !p) throw { code: "auth/invalid-credential" }; st.email = "admin@demo"; ls.set("vestir-demo-admin", "1"); authCb?.({ uid }); },
    async logout() { st.email = null; ls.set("vestir-demo-admin", ""); authCb?.({ uid }); }
  };
  try { st.storageSize = () => (ls.get("vestir-demo") || "").length; } catch {}
  return st;
}
function fail(e) {
  console.error(e);
  const c = e && e.code;
  if (c === "permission-denied") toast("Sem permissão para isso.");
  else if (c === "unavailable") toast("Sem internet. Tente de novo.");
  else toast("Não deu certo. Tente de novo.");
}

/* ============================ estado ============================ */
const O = { prices: null, admin: false, order: null, orderId: null, members: [], confirms: new Map(), unsub: [], orders: [], adminUnsub: [] };
const prices = () => O.prices || { tshirt: CFG.defaults.prices.tshirt, hoodie: CFG.defaults.prices.hoodie, pixKey: CFG.defaults.pixKey, pixName: CFG.defaults.pixName, minQty: CFG.defaults.minQty, whatsapp: CFG.defaults.whatsapp };

/* ============================ rotas ============================ */
function route() {
  const hsh = location.hash.slice(1);
  const m = hsh.match(/^pedido-([a-z0-9]{5,12})$/);
  const view = m ? "order" : hsh === "admin" ? "admin" : "main";
  $("#mainView").hidden = view !== "main"; $("#orderView").hidden = view !== "order"; $("#adminView").hidden = view !== "admin";
  document.body.dataset.view = view;
  if (view === "order") openOrder(m[1]); else closeOrder();
  if (view === "admin") renderAdmin();
  if (view !== "main") scrollTo({ top: 0 });
}
addEventListener("hashchange", route);

/* ============================ preços na vitrine ============================ */
function renderPrices() {
  const p = prices(), box = $("#priceCards"); if (!box) return;
  box.textContent = "";
  for (const [id, name, desc, feat] of [["tshirt", "Camiseta", "Ideal para times, famílias e eventos", ["Malha de algodão", "Estampa frente e costas", "Nome e número nas costas"]], ["hoodie", "Moletom com capuz", "O preferido das turmas de formatura", ["Moletom felpado", "Estampa frente, costas e mangas", "Capuz, cordões e punhos canelados"]]]) {
    box.append(h("div", { class: "price-card" + (id === "hoodie" ? " featured" : "") },
      id === "hoodie" ? h("span", { class: "tag", text: "Mais pedido" }) : null,
      h("b", { class: "pc-name", text: name }), h("span", { class: "muted", text: desc }),
      h("div", { class: "pc-price" }, h("small", { text: "a partir de" }), h("strong", { text: money(p[id]) }), h("small", { text: "por peça" })),
      h("ul", {}, feat.map((f) => h("li", { text: f }))),
      h("a", { class: "btn " + (id === "hoodie" ? "btn-violet" : "btn-primary"), href: "#estudio", onclick: () => window.VS?.setDesign({ ...window.VS.getDesign(), model: id }) }, "Montar o meu")));
  }
  const min = $("#minQtyTxt"); if (min) min.textContent = p.minQty || 10;
}

/* ============================ criar pedido ============================ */
function openCreate() {
  const d = window.VS.getDesign(), p = prices();
  const dlg = $("#orderModal"), body = $("#orderModalBody"); body.textContent = "";
  const today = new Date(); today.setDate(today.getDate() + 10);
  const f = h("form", { class: "modal-form" },
    h("div", { class: "modal-sum" }, h("img", { id: "omPrev", alt: "Prévia da peça" }), h("div", {}, h("b", { text: modelName(d.model) }), h("span", { class: "muted", text: money(p[d.model]) + " por peça" }), h("small", { class: "muted", text: "Cada pessoa paga a própria peça por PIX." }))),
    h("label", { class: "field" }, "Nome do grupo", h("input", { class: "input", name: "title", required: true, maxlength: "60", placeholder: "Ex.: Terceirão 2026 · Colégio Central" })),
    h("div", { class: "two" },
      h("label", { class: "field" }, "Seu nome (responsável)", h("input", { class: "input", name: "leader", required: true, maxlength: "50", autocomplete: "name" })),
      h("label", { class: "field" }, "Seu WhatsApp (opcional)", h("input", { class: "input", name: "phone", maxlength: "20", inputmode: "tel", placeholder: "(00) 00000-0000" }))),
    h("label", { class: "field" }, "Data para fechar o pedido", h("input", { class: "input", type: "date", name: "deadline", required: true, value: today.toISOString().slice(0, 10) })),
    h("button", { class: "btn btn-violet btn-block", type: "submit" }, "Criar pedido e gerar link"),
    h("p", { class: "muted", style: "font-size:.8rem", text: "Depois de criado, a arte fica travada para todos verem a mesma peça. Você pode criar outro pedido se mudar o design." }));
  body.append(f);
  dlg.hidden = false; document.body.style.overflow = "hidden";
  window.VS.snapshot("front", 360).then((u) => { const i = $("#omPrev"); if (i) i.src = u; });
  f.querySelector("[name=title]").focus();
  f.onsubmit = async (e) => {
    e.preventDefault(); const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Gerando fotos da peça…";
    try {
      const fd = new FormData(f), design = await compactDesign(window.VS.getDesign());
      const front = await window.VS.snapshot("front", 640), back = await window.VS.snapshot("back", 640);
      btn.textContent = "Salvando…";
      const id = Math.random().toString(36).slice(2, 9);
      const doc = { title: String(fd.get("title")).trim().slice(0, 60), leader: String(fd.get("leader")).trim().slice(0, 50), phone: String(fd.get("phone") || "").trim().slice(0, 20),
        deadline: String(fd.get("deadline")), model: design.model, price: Number(prices()[design.model]), design: JSON.stringify(design), front, back,
        status: "aberto", ownerUid: store.uid, createdAt: Date.now() };
      if (JSON.stringify(doc).length > 950000) throw { code: "too-big" };
      await store.set("orders/" + id, doc);
      ls.set("vestir-my-orders", JSON.stringify([id, ...JSON.parse(ls.get("vestir-my-orders") || "[]")].slice(0, 20)));
      closeModal(); location.hash = "pedido-" + id; toast("Pedido criado! Agora mande o link para o grupo.");
    } catch (err) {
      btn.disabled = false; btn.textContent = "Criar pedido e gerar link";
      if (err?.code === "too-big") toast("As imagens enviadas estão pesadas demais. Use imagens menores.");
      else if (err?.code === "permission-denied") toast("A loja ainda não definiu os preços. Tente mais tarde.");
      else fail(err);
    }
  };
}
function closeModal() { $("#orderModal").hidden = true; document.body.style.overflow = ""; }
async function compactDesign(d) {
  for (const k in d.prints) {
    const p = d.prints[k]; if (p.kind !== "image" || !p.src) continue;
    p.src = await new Promise((res) => { const im = new Image(); im.onload = () => { const m = 640, k2 = Math.min(1, m / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.round(im.naturalWidth * k2); c.height = Math.round(im.naturalHeight * k2); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL("image/png")); }; im.onerror = () => res(null); im.src = p.src; });
    if (!p.src) p.kind = "none";
  }
  return d;
}

/* ============================ página do pedido ============================ */
function closeOrder() { O.unsub.forEach((u) => u && u()); O.unsub = []; O.order = null; O.orderId = null; }
function openOrder(id) {
  if (O.orderId === id) return renderOrder();
  closeOrder(); O.orderId = id; O.members = []; O.confirms = new Map(); O.loaded = false;
  renderOrder();
  if (!store) return;
  O.unsub.push(store.onDoc("orders/" + id, (d) => { O.order = d; O.loaded = true; renderOrder(); }, (e) => { console.error(e); O.loaded = true; renderOrder(); }));
  O.unsub.push(store.onCol(`orders/${id}/members`, (a) => { O.members = a; renderOrder(); }));
  O.unsub.push(store.onCol(`orders/${id}/confirm`, (a) => { O.confirms = new Map(a.map((x) => [x.id, x])); renderOrder(); }));
}
const orderLink = (id) => location.origin + location.pathname + "#pedido-" + id;
function memberState(m) { if (!m) return "none"; if (O.confirms.get(m.id)?.ok) return "ok"; return m.paid ? "paid" : "unpaid"; }
let draft = { size: "M", qty: 1 };
function renderOrder() {
  const v = $("#orderView"); if (v.hidden) return;
  const keepId = document.activeElement?.id, keepVal = document.activeElement?.value;
  v.textContent = "";
  const wrap = h("div", { class: "wrap order" }); v.append(wrap);
  wrap.append(h("a", { class: "back-link", href: "#estudio" }, "‹ Voltar ao estúdio"));
  if (!O.loaded) { wrap.append(h("div", { class: "empty", text: "Carregando pedido…" })); return; }
  const o = O.order;
  if (!o) { wrap.append(h("div", { class: "empty" }, h("b", { text: "Pedido não encontrado." }), h("p", { class: "muted", text: "Confira se o link está completo." }))); return; }
  const id = O.orderId, mine = O.members.find((m) => m.id === store.uid), st = memberState(mine), open = o.status === "aberto";
  const conf = O.members.filter((m) => O.confirms.get(m.id)?.ok), pieces = O.members.reduce((s, m) => s + (Number(m.qty) || 1), 0);
  const [stTxt, stCls] = STATUS[o.status] || STATUS.aberto;
  const deadline = o.deadline ? new Date(o.deadline + "T12:00:00").toLocaleDateString("pt-BR", { day: "numeric", month: "long" }) : "—";

  // topo: fotos + informações
  let side = "front";
  const img = h("img", { class: "o-img", src: o.front, alt: "Foto da peça: frente" });
  const tabs = h("div", { class: "chips" }, [["front", "Frente"], ["back", "Costas"]].map(([k, t]) => h("button", { class: "chip", type: "button", "aria-pressed": String(k === side), onclick: (e) => { side = k; img.src = o[k]; img.alt = "Foto da peça: " + t.toLowerCase(); [...tabs.children].forEach((c) => c.setAttribute("aria-pressed", String(c === e.currentTarget))); } }, t)));
  wrap.append(h("div", { class: "o-head" },
    h("div", { class: "o-gal" }, img, h("div", { class: "o-gal-bar" }, tabs, h("button", { class: "btn btn-sm btn-ghost", type: "button", onclick: async () => { try { await window.VS.setDesign(JSON.parse(o.design), "three"); location.hash = "estudio"; toast("Gire a peça para ver todos os lados"); } catch { toast("Não consegui abrir em 3D."); } } }, "↻ Girar em 3D"))),
    h("div", { class: "o-info" },
      h("span", { class: "pill " + stCls, text: stTxt }),
      h("h1", { text: o.title }),
      h("p", { class: "muted" }, modelName(o.model), " · organizado por ", h("b", { text: o.leader || "—" })),
      h("div", { class: "o-facts" },
        h("div", {}, h("small", { text: "Preço por peça" }), h("b", { text: money(o.price) })),
        h("div", {}, h("small", { text: "Fecha em" }), h("b", { text: deadline })),
        h("div", {}, h("small", { text: "Peças no pedido" }), h("b", { text: String(pieces) }))),
      h("div", { class: "o-share" },
        h("button", { class: "btn btn-wa", type: "button", onclick: () => { const t = `👕 ${o.title}\nEntre no pedido, escolha seu tamanho e pague por PIX: ${orderLink(id)}`; window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank", "noopener"); } }, "Mandar no WhatsApp"),
        h("button", { class: "btn btn-ghost", type: "button", onclick: () => copy(orderLink(id), "Link do pedido copiado") }, "Copiar link")))));

  // minha participação
  const me = h("div", { class: "card o-me" });
  const p = prices(), pix = p.pixKey;
  if (st === "none") {
    if (!open) me.append(h("b", { text: "Este pedido já foi fechado." }), h("p", { class: "muted", text: "Fale com o responsável se ainda quiser uma peça." }));
    else {
      const name = h("input", { class: "input", id: "mName", maxlength: "50", placeholder: "Nome e sobrenome", autocomplete: "name", value: ls.get("vestir-name") || "" });
      const bname = h("input", { class: "input", id: "mBack", maxlength: "14", placeholder: "Opcional" });
      const num = h("input", { class: "input", id: "mNum", maxlength: "3", inputmode: "numeric", placeholder: "Opcional" });
      const total = h("b", { class: "o-total" });
      const upd = () => total.textContent = money(o.price * draft.qty);
      const sizes = h("div", { class: "size-grid", role: "radiogroup", "aria-label": "Tamanho" }, SIZES.map((s) => h("button", { type: "button", class: "size", role: "radio", "aria-checked": String(draft.size === s), onclick: (e) => { draft.size = s; [...sizes.children].forEach((c) => c.setAttribute("aria-checked", String(c === e.currentTarget))); } }, h("b", { text: s }), h("small", { text: (MEASURES[o.model] || MEASURES.tshirt)[s] }))));
      const qty = h("div", { class: "qty" }, h("button", { type: "button", "aria-label": "Menos", onclick: () => { draft.qty = Math.max(1, draft.qty - 1); qv.textContent = draft.qty; upd(); } }, "−"), h("span", { id: "qv", text: String(draft.qty) }), h("button", { type: "button", "aria-label": "Mais", onclick: () => { draft.qty = Math.min(5, draft.qty + 1); qv.textContent = draft.qty; upd(); } }, "+"));
      const qv = qty.querySelector("span");
      const btn = h("button", { class: "btn btn-violet btn-block btn-lg", type: "submit" }, "Entrar no pedido e pagar");
      const form = h("form", { class: "o-form" },
        h("h2", { text: "Quero a minha" }),
        h("label", { class: "field" }, "Seu nome", name),
        h("div", { class: "field" }, h("span", {}, "Tamanho ", h("small", { class: "muted", text: "(largura × comprimento em cm, aproximado)" })), sizes),
        h("div", { class: "two" }, h("label", { class: "field" }, "Nome nas costas", bname), h("label", { class: "field" }, "Número", num)),
        h("div", { class: "row-between" }, h("div", { class: "field" }, "Quantidade", qty), h("div", { style: "text-align:right" }, h("small", { class: "muted", text: "Total" }), total)),
        btn);
      upd();
      form.onsubmit = async (e) => {
        e.preventDefault(); const nm = name.value.trim(); if (nm.length < 2) { name.focus(); return toast("Digite seu nome"); }
        btn.disabled = true; ls.set("vestir-name", nm);
        try { await store.set(`orders/${id}/members/${store.uid}`, { name: nm.slice(0, 50), size: draft.size, backName: bname.value.trim().slice(0, 14), number: num.value.replace(/\D/g, "").slice(0, 3), qty: draft.qty, paid: false, createdAt: Date.now() }); }
        catch (err) { btn.disabled = false; fail(err); }
      };
      me.append(form);
    }
  } else {
    const tot = o.price * (Number(mine.qty) || 1);
    me.append(h("div", { class: "o-mine" }, h("span", { class: "avatar", style: "background:" + colorFor(mine.id), text: initials(mine.name) }),
      h("div", {}, h("b", { text: mine.name }), h("small", { class: "muted", text: `Tamanho ${mine.size}${mine.backName ? " · " + mine.backName : ""}${mine.number ? " · nº " + mine.number : ""} · ${mine.qty} peça(s)` }))));
    if (st === "unpaid") {
      me.append(h("h2", { text: "Falta o PIX" }),
        h("div", { class: "pix" }, h("small", { text: "Valor" }), h("strong", { class: "pix-amt", text: money(tot) }),
          pix ? [h("small", { text: "Chave PIX" + (p.pixName ? " · " + p.pixName : "") }), h("code", { text: pix }), h("button", { class: "btn btn-primary btn-block", type: "button", onclick: () => copy(pix, "Chave PIX copiada") }, "Copiar chave PIX")] : h("p", { class: "muted", text: "A chave PIX ainda não foi cadastrada pela loja." })),
        h("button", { class: "btn btn-violet btn-block btn-lg", type: "button", disabled: !pix || null, onclick: async (e) => { e.currentTarget.disabled = true; try { await store.update(`orders/${id}/members/${store.uid}`, { paid: true, paidAt: Date.now() }); toast("Avisamos a loja!"); } catch (err) { fail(err); } } }, "Já fiz o PIX"));
    } else if (st === "paid") me.append(h("div", { class: "o-status" }, h("span", { text: "⏳" }), h("div", {}, h("b", { text: "PIX em conferência" }), h("p", { class: "muted", text: "Assim que a Vestir Style conferir, sua peça fica confirmada aqui." }))));
    else me.append(h("div", { class: "o-status ok" }, h("span", { text: "✓" }), h("div", {}, h("b", { text: "Sua peça está confirmada!" }), h("p", { class: "muted", text: "Agora é só esperar o pedido fechar e ir para produção." }))));
    if (open && st !== "ok") me.append(h("button", { class: "link", type: "button", onclick: async (e) => { const b = e.currentTarget; if (b.dataset.a !== "1") { b.dataset.a = "1"; b.textContent = "Clique de novo para sair do pedido"; return; } try { await store.del(`orders/${id}/members/${store.uid}`); } catch (err) { fail(err); } } }, "Sair do pedido / mudar tamanho"));
  }

  // lista
  const counts = Object.fromEntries(SIZES.map((s) => [s, 0])); O.members.forEach((m) => counts[m.size] = (counts[m.size] || 0) + (Number(m.qty) || 1));
  const list = h("ul", { class: "list" });
  const sorted = [...O.members].sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
  if (!sorted.length) list.append(h("li", { class: "empty", text: "Ninguém entrou ainda. Mande o link no grupo!" }));
  for (const m of sorted) {
    const s = memberState(m);
    const pill = s === "ok" ? h("span", { class: "pill p-ok", text: "Pago" }) : s === "paid" ? h("span", { class: "pill p-warn", text: "PIX informado" }) : h("span", { class: "pill p-mute", text: "Falta pagar" });
    const acts = h("div", { class: "acts" }, pill);
    if (O.admin) acts.append(s === "ok" ? h("button", { class: "btn btn-sm btn-ghost", type: "button", onclick: () => store.del(`orders/${id}/confirm/${m.id}`).catch(fail) }, "Desfazer") : h("button", { class: "btn btn-sm btn-primary", type: "button", onclick: () => store.set(`orders/${id}/confirm/${m.id}`, { ok: true, at: Date.now() }).then(() => toast("Pagamento confirmado")).catch(fail) }, "Confirmar"));
    list.append(h("li", { class: "li" }, h("span", { class: "avatar", style: "background:" + colorFor(m.id), text: initials(m.name) }),
      h("span", { class: "nm" }, m.name + (m.id === store.uid ? " (você)" : ""), h("small", { text: `${m.size} · ${m.qty} peça(s)${m.backName ? " · " + m.backName : ""}${m.number ? " · nº " + m.number : ""}` })), acts));
  }
  wrap.append(h("div", { class: "o-grid" }, me, h("div", { class: "card" },
    h("div", { class: "row-between" }, h("h2", { text: "Quem já entrou" }), h("span", { class: "pill p-mute", text: `${conf.length}/${O.members.length} pagos` })),
    h("div", { class: "size-sum" }, SIZES.map((s) => h("div", {}, h("small", { text: s }), h("b", { text: String(counts[s] || 0) })))),
    list,
    O.admin ? h("div", { class: "admin-tools" },
      h("label", { class: "field" }, "Situação do pedido", (() => { const sel = h("select", { class: "input" }, Object.entries(STATUS).map(([k, [t]]) => h("option", { value: k, text: t, selected: o.status === k || null }))); sel.onchange = () => store.update("orders/" + id, { status: sel.value }).then(() => toast("Situação atualizada")).catch(fail); return sel; })()),
      h("div", { class: "two" }, h("button", { class: "btn btn-ghost", type: "button", onclick: () => copy(productionText(o, O.members), "Lista copiada para a estamparia") }, "Copiar lista"), h("button", { class: "btn btn-ghost", type: "button", onclick: () => downloadCSV(o, O.members) }, "Baixar planilha"))) : null)));
  if (keepId && $("#" + keepId)) { const n = $("#" + keepId); if (keepVal != null && n.value !== keepVal) n.value = keepVal; n.focus(); }
}
function productionText(o, ms) {
  const counts = {}; ms.forEach((m) => counts[m.size] = (counts[m.size] || 0) + (Number(m.qty) || 1));
  return `PEDIDO: ${o.title}\nPeça: ${modelName(o.model)}\nTotal: ${ms.reduce((s, m) => s + (Number(m.qty) || 1), 0)} peças\n\nTAMANHOS\n${SIZES.filter((s) => counts[s]).map((s) => `${s}: ${counts[s]}`).join("\n")}\n\nNOMES NAS COSTAS\n${ms.filter((m) => m.backName || m.number).map((m) => `${m.size} · ${m.backName || "-"} ${m.number ? "nº " + m.number : ""}`).join("\n") || "(nenhum)"}`;
}
function downloadCSV(o, ms) {
  const rows = [["Nome", "Tamanho", "Quantidade", "Nome nas costas", "Número", "Pago"], ...ms.map((m) => [m.name, m.size, m.qty, m.backName || "", m.number || "", O.confirms.get(m.id)?.ok ? "sim" : m.paid ? "informado" : "não"])];
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const a = h("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `pedido-${o.title.replace(/[^\w]+/g, "-").toLowerCase()}.csv` }); document.body.append(a); a.click(); a.remove();
}

/* ============================ painel da loja ============================ */
let calc = null;
function renderAdmin() {
  const v = $("#adminView"); if (v.hidden) return;
  v.textContent = ""; const wrap = h("div", { class: "wrap order" }); v.append(wrap);
  wrap.append(h("a", { class: "back-link", href: "#inicio" }, "‹ Voltar ao site"));
  if (!O.admin) {
    const em = h("input", { class: "input", id: "aEmail", type: "email", autocomplete: "username" }), pw = h("input", { class: "input", id: "aPass", type: "password", autocomplete: "current-password" });
    const btn = h("button", { class: "btn btn-violet btn-block", type: "submit" }, "Entrar");
    const f = h("form", { class: "card", style: "max-width:440px" }, h("h1", { text: "Painel da Vestir Style" }),
      h("p", { class: "muted", text: DEMO ? "Modo demonstração: qualquer e-mail e senha funcionam." : "Use o mesmo e-mail e senha do Firebase (os mesmos da festa)." }),
      h("label", { class: "field" }, "E-mail", em), h("label", { class: "field" }, "Senha", pw), btn);
    f.onsubmit = async (e) => { e.preventDefault(); btn.disabled = true; try { await store.login(em.value.trim(), pw.value); } catch (err) { console.error(err); toast("E-mail ou senha incorretos"); btn.disabled = false; } };
    wrap.append(f); return;
  }
  const p = prices();
  const totalPaid = O.orders.reduce((s, o) => s + (o._paidValue || 0), 0), totalPieces = O.orders.reduce((s, o) => s + (o._pieces || 0), 0);
  wrap.append(h("div", { class: "row-between" }, h("h1", { text: "Painel da Vestir Style" }), h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => store.logout().then(() => { location.hash = "inicio"; }) }, "Sair")),
    h("div", { class: "kpis" }, h("div", {}, h("small", { text: "Pedidos" }), h("b", { text: String(O.orders.length) })), h("div", {}, h("small", { text: "Peças" }), h("b", { text: String(totalPieces) })), h("div", {}, h("small", { text: "Recebido (confirmado)" }), h("b", { text: money(totalPaid) }))));

  // pedidos
  const list = h("div", { class: "orders" });
  if (!O.orders.length) list.append(h("div", { class: "empty", text: "Nenhum pedido ainda. Divulgue o site!" }));
  for (const o of [...O.orders].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))) {
    const [t, c] = STATUS[o.status] || STATUS.aberto;
    list.append(h("a", { class: "order-row", href: "#pedido-" + o.id }, h("img", { src: o.front, alt: "" }),
      h("div", { class: "grow" }, h("b", { text: o.title }), h("small", { class: "muted", text: `${modelName(o.model)} · ${o.leader || "—"} · ${o._pieces ?? "…"} peças · ${o._paid ?? "…"} pagos` })),
      h("span", { class: "pill " + c, text: t })));
  }
  // preços e PIX
  const inp = (k, label, type = "text", step) => { const i = h("input", { class: "input", type, step, id: "cfg-" + k, value: p[k] ?? "" }); return h("label", { class: "field" }, label, i); };
  const cfgForm = h("form", { class: "card" }, h("h2", { text: "Preços e PIX" }),
    h("div", { class: "two" }, inp("tshirt", "Preço da camiseta (R$)", "number", ".01"), inp("hoodie", "Preço do moletom (R$)", "number", ".01")),
    h("div", { class: "two" }, inp("pixKey", "Chave PIX"), inp("pixName", "Nome de quem recebe")),
    h("div", { class: "two" }, inp("minQty", "Pedido mínimo (peças)", "number", "1"), inp("whatsapp", "Seu WhatsApp (aparece no site)")),
    h("button", { class: "btn btn-violet", type: "submit" }, "Salvar"));
  cfgForm.onsubmit = async (e) => {
    e.preventDefault(); const g = (k) => cfgForm.querySelector("#cfg-" + k).value.trim();
    const d = { tshirt: Number(g("tshirt")) || 0, hoodie: Number(g("hoodie")) || 0, pixKey: g("pixKey"), pixName: g("pixName"), minQty: Number(g("minQty")) || 1, whatsapp: g("whatsapp") };
    try { await store.set("vs_config/prices", d); toast("Preços salvos. Pedidos novos usam estes valores."); } catch (err) { fail(err); }
  };
  wrap.append(h("div", { class: "o-grid" }, h("div", { class: "card" }, h("h2", { text: "Pedidos" }), list), cfgForm), calculator());
}
function calculator() {
  calc ||= JSON.parse(ls.get("vestir-calc") || "null") || { model: "tshirt", blank: { tshirt: 18, hoodie: 55 }, front: 8, back: 14, extra: 2, fee: 0, qty: 20, price: null };
  const p = prices(), out = h("div", { class: "calc-out" });
  const num = (label, val, on, step = "0.5") => { const i = h("input", { class: "input", type: "number", step, min: "0", value: val }); i.addEventListener("input", () => { on(Number(i.value) || 0); paint(); }); return h("label", { class: "field" }, label, i); };
  const priceNow = () => calc.price ?? p[calc.model];
  function paint() {
    ls.set("vestir-calc", JSON.stringify(calc));
    const cost = calc.blank[calc.model] + calc.front + calc.back + calc.extra, pr = priceNow(), fee = pr * calc.fee / 100, profit = pr - cost - fee, margin = pr ? profit / pr * 100 : 0;
    out.textContent = "";
    out.append(h("div", {}, h("small", { text: "Custo por peça" }), h("b", { text: money(cost + fee) })), h("div", {}, h("small", { text: "Lucro por peça" }), h("b", { class: profit < 0 ? "neg" : "", text: money(profit) })),
      h("div", {}, h("small", { text: "Margem" }), h("b", { text: margin.toFixed(0) + "%" })), h("div", { class: "big" }, h("small", { text: `Lucro num pedido de ${calc.qty} peças` }), h("b", { class: profit < 0 ? "neg" : "", text: money(profit * calc.qty) })),
      h("p", { class: "muted", style: "grid-column:1/-1;font-size:.84rem", text: margin < 30 ? "Margem baixa: suba o preço ou negocie a estampa." : margin > 60 ? "Margem alta: dá para dar desconto para pedidos grandes." : "Margem saudável para pedidos em grupo." }));
  }
  const seg = h("div", { class: "chips" }, [["tshirt", "Camiseta"], ["hoodie", "Moletom"]].map(([k, t]) => h("button", { class: "chip", type: "button", "aria-pressed": String(calc.model === k), onclick: () => { calc.model = k; calc.price = null; renderAdmin(); } }, t)));
  const card = h("div", { class: "card" }, h("h2", { text: "Calculadora de lucro" }), h("p", { class: "muted", text: "Os valores iniciais são estimativas comuns no Brasil. Troque pelos preços que a sua estamparia passar." }), seg,
    h("div", { class: "calc-grid" },
      num("Peça lisa (R$)", calc.blank[calc.model], (v) => calc.blank[calc.model] = v),
      num("Estampa frente (R$)", calc.front, (v) => calc.front = v),
      num("Estampa costas (R$)", calc.back, (v) => calc.back = v),
      num("Embalagem e frete por peça (R$)", calc.extra, (v) => calc.extra = v),
      num("Taxas (% do preço)", calc.fee, (v) => calc.fee = v, "0.1"),
      num("Preço de venda (R$)", priceNow(), (v) => calc.price = v),
      num("Peças no pedido", calc.qty, (v) => calc.qty = v, "1")), out);
  paint(); return card;
}
function watchAdmin() {
  O.adminUnsub.forEach((u) => u && u()); O.adminUnsub = [];
  if (!O.admin) return;
  O.adminUnsub.push(store.onCol("orders", async (a) => {
    O.orders = a; renderAdmin();
    for (const o of a) {
      try {
        const [ms, cs] = await Promise.all([store.list(`orders/${o.id}/members`), store.list(`orders/${o.id}/confirm`)]);
        const ok = new Set(cs.filter((c) => c.ok).map((c) => c.id));
        o._pieces = ms.reduce((s, m) => s + (Number(m.qty) || 1), 0); o._paid = ms.filter((m) => ok.has(m.id)).length;
        o._paidValue = ms.filter((m) => ok.has(m.id)).reduce((s, m) => s + (Number(m.qty) || 1) * (o.price || 0), 0);
      } catch {}
    }
    renderAdmin();
  }));
}

/* ============================ início ============================ */
async function start() {
  $("#newOrderBtn")?.addEventListener("click", () => openCreate());
  $("#newOrderBtn2")?.addEventListener("click", () => { location.hash = "estudio"; setTimeout(openCreate, 400); });
  $("#orderModal")?.addEventListener("click", (e) => { if (e.target.id === "orderModal" || e.target.closest("[data-close]")) closeModal(); });
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#orderModal").hidden) closeModal(); });
  renderPrices(); route();
  try { store = DEMO ? demoStore() : await firebaseStore(); }
  catch (e) { console.error(e); toast("Pedidos indisponíveis agora (sem conexão)."); return; }
  if (DEMO) document.body.classList.add("is-demo");
  let first = true;
  store.onAuth((u) => {
    O.admin = store.isAdmin();
    if (first && u) { first = false; store.onDoc("vs_config/prices", (d) => { O.prices = d ? Object.assign({}, prices(), d) : null; renderPrices(); renderOrder(); }); }
    watchAdmin(); route();
  });
}
start();
})();
