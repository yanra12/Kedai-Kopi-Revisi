/* Kualitatif Coffee — script.js
   Menu, pencarian, keranjang, dan pesanan lewat WhatsApp. Tanpa library. */
(() => {
  "use strict";

  const CFG = Object.assign(
    { shopName: "Kualitatif Coffee", whatsappNumber: "", displayNumber: "", maxQty: 20 },
    window.KUALITATIF_CONFIG || {}
  );
  const PRODUCTS = Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [];
  const CATEGORIES = Array.isArray(window.MENU_CATEGORIES) ? window.MENU_CATEGORIES : [];
  const BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
  const CAT_LABEL = new Map(CATEGORIES.map((c) => [c.id, c.label]));

  const CART_KEY = "kualitatif-cart-v1";
  const NAME_KEY = "kualitatif-name-v1";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const rupiah = (n) => "Rp " + Number(n).toLocaleString("id-ID");
  const norm = (s) =>
    String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  /* ---------- Storage (aman jika diblokir browser) ---------- */
  const store = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (_) {
        /* abaikan */
      }
    },
  };

  /* ---------- Elemen ---------- */
  const el = {
    header: $(".site-header"),
    nav: $("#site-nav"),
    navToggle: $("#nav-toggle"),
    searchToggle: $("#search-toggle"),
    searchPanel: $("#search-panel"),
    searchForm: $("#search-form"),
    searchInput: $("#menu-search"),
    searchClear: $("#search-clear"),
    searchStatus: $("#search-status"),
    filters: $("#filters"),
    menuGrid: $("#menu-grid"),
    menuStatus: $("#menu-status"),
    menuEmpty: $("#menu-empty"),
    menuReset: $("#menu-reset"),
    cartToggle: $("#cart-toggle"),
    cartCount: $("#cart-count"),
    drawer: $("#cart-drawer"),
    cartClose: $("#cart-close"),
    cartEmpty: $("#cart-empty"),
    cartToMenu: $("#cart-to-menu"),
    cartList: $("#cart-list"),
    cartTotal: $("#cart-total"),
    cartClear: $("#cart-clear"),
    checkoutForm: $("#checkout-form"),
    oName: $("#o-name"),
    oNotes: $("#o-notes"),
    contactForm: $("#contact-form"),
    contactStatus: $("#contact-status"),
    toast: $("#toast"),
    live: $("#live"),
  };

  /* ---------- State ---------- */
  const state = { category: "semua", query: "" };
  const selectedTemp = new Map(); // id -> suhu terpilih pada kartu menu
  let cart = [];

  /* ---------- Utilitas UI ---------- */
  function announce(message) {
    if (!el.live) return;
    el.live.textContent = "";
    window.setTimeout(() => {
      el.live.textContent = message;
    }, 40);
  }

  let toastTimer;
  function toast(message) {
    const t = el.toast;
    if (!t) return;
    window.clearTimeout(toastTimer);
    t.textContent = message;
    if (typeof t.showPopover === "function") {
      try {
        if (!t.matches(":popover-open")) t.showPopover();
      } catch (_) {
        /* abaikan */
      }
    } else {
      t.classList.add("fallback-show");
    }
    toastTimer = window.setTimeout(hideToast, 2600);
  }
  function hideToast() {
    const t = el.toast;
    if (!t) return;
    if (typeof t.hidePopover === "function") {
      try {
        if (t.matches(":popover-open")) t.hidePopover();
      } catch (_) {
        /* abaikan */
      }
    }
    t.classList.remove("fallback-show");
  }

  function scrollToMenu() {
    const menu = $("#menu");
    if (menu) menu.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- WhatsApp ---------- */
  // Ubah nomor ke format internasional: 0812... atau 812... menjadi 62812...
  function waNumber() {
    let n = String(CFG.whatsappNumber || "").replace(/\D/g, "");
    if (n.startsWith("00")) n = n.slice(2);
    if (n.startsWith("0")) n = "62" + n.slice(1);
    else if (n.startsWith("8")) n = "62" + n;
    return n;
  }

  const isMobile = () =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia("(pointer: coarse)").matches;

  // Ponsel: buka aplikasi WhatsApp langsung. Desktop: buka WhatsApp Web
  // langsung ke chat (wa.me hanya menampilkan halaman perantara).
  function waUrl(text) {
    const number = waNumber();
    const q = "text=" + encodeURIComponent(text);
    if (isMobile()) {
      return "https://api.whatsapp.com/send?" + (number ? "phone=" + number + "&" : "") + q;
    }
    return "https://web.whatsapp.com/send?" + (number ? "phone=" + number + "&" : "") + q;
  }

  function openWhatsApp(text) {
    const a = document.createElement("a");
    a.href = waUrl(text);
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function setupWaLinks() {
    const greeting = "Halo " + CFG.shopName + ", saya ingin bertanya.";
    $$("[data-wa-link]").forEach((a) => {
      a.href = waUrl(greeting);
    });
    $$("[data-wa-display]").forEach((node) => {
      node.textContent = CFG.displayNumber || "Chat lewat WhatsApp";
    });
    if (!waNumber()) {
      console.warn(
        "[Kualitatif] Nomor WhatsApp belum diisi. Atur whatsappNumber di js/config.js."
      );
    }
  }

  /* ---------- Menu ---------- */
  function visibleProducts() {
    const q = norm(state.query);
    return PRODUCTS.filter((p) => {
      if (state.category !== "semua" && p.category !== state.category) return false;
      if (!q) return true;
      const haystack = norm([p.name, p.desc, CAT_LABEL.get(p.category) || ""].join(" "));
      return haystack.includes(q);
    });
  }

  function renderFilters() {
    el.filters.textContent = "";
    const all = [{ id: "semua", label: "Semua" }, ...CATEGORIES];
    all.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "filter-btn";
      b.dataset.cat = c.id;
      b.textContent = c.label;
      b.setAttribute("aria-pressed", String(state.category === c.id));
      el.filters.appendChild(b);
    });
  }

  function syncFilterButtons() {
    $$(".filter-btn", el.filters).forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.cat === state.category))
    );
  }

  function itemNode(p) {
    const temps = Array.isArray(p.temps) ? p.temps : [];
    if (temps.length && !selectedTemp.has(p.id)) selectedTemp.set(p.id, temps[0]);

    const li = document.createElement("li");
    li.className = "menu-item";
    li.dataset.id = p.id;

    const name = document.createElement("h4");
    name.className = "menu-item-name";
    name.style.fontFamily = "var(--serif)";
    name.style.fontWeight = "560";
    name.textContent = p.name;
    if (p.tag) {
      const tag = document.createElement("span");
      tag.className = "menu-tag";
      tag.textContent = p.tag;
      name.appendChild(tag);
    }

    const price = document.createElement("p");
    price.className = "menu-item-price";
    price.textContent = rupiah(p.price);

    const desc = document.createElement("p");
    desc.className = "menu-item-desc";
    desc.textContent = p.desc;

    const actions = document.createElement("div");
    actions.className = "menu-item-actions";

    if (temps.length > 1) {
      const group = document.createElement("div");
      group.className = "temp-switch";
      group.setAttribute("role", "group");
      group.setAttribute("aria-label", "Suhu untuk " + p.name);
      temps.forEach((t) => {
        const b = document.createElement("button");
        b.type = "button";
        b.dataset.temp = t;
        b.textContent = t;
        b.setAttribute("aria-pressed", String(selectedTemp.get(p.id) === t));
        group.appendChild(b);
      });
      actions.appendChild(group);
    } else if (temps.length === 1) {
      const note = document.createElement("span");
      note.className = "form-note";
      note.style.margin = "0";
      note.textContent = "Hanya " + temps[0].toLowerCase();
      actions.appendChild(note);
    } else {
      actions.appendChild(document.createElement("span"));
    }

    const add = document.createElement("button");
    add.type = "button";
    add.className = "add-btn";
    add.dataset.action = "add";
    add.setAttribute("aria-label", "Tambah " + p.name + " ke keranjang");
    add.innerHTML =
      '<svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg><span>Tambah</span>';
    actions.appendChild(add);

    li.append(name, price, desc, actions);

    // Foto menu: otomatis memakai p.image, atau img/menu/<id>.jpg jika ada.
    // Tanpa file foto, tampilan teks biasa tetap dipakai.
    const src = p.image || "img/menu/" + p.id + ".jpg";
    const probe = new Image();
    probe.onload = () => {
      const img = document.createElement("img");
      img.className = "menu-item-photo";
      img.src = src;
      img.alt = p.name;
      img.width = 96;
      img.height = 96;
      img.loading = "lazy";
      li.classList.add("has-photo");
      li.prepend(img);
    };
    probe.src = src;
    return li;
  }

  function renderMenu() {
    const list = visibleProducts();
    el.menuGrid.textContent = "";

    if (state.category === "semua") {
      CATEGORIES.forEach((c) => {
        const group = list.filter((p) => p.category === c.id);
        if (!group.length) return;
        const head = document.createElement("li");
        head.className = "menu-group-title";
        const h3 = document.createElement("h3");
        h3.style.cssText = "font:inherit;letter-spacing:inherit;";
        h3.textContent = c.label;
        head.appendChild(h3);
        el.menuGrid.appendChild(head);
        group.forEach((p) => el.menuGrid.appendChild(itemNode(p)));
      });
    } else {
      list.forEach((p) => el.menuGrid.appendChild(itemNode(p)));
    }

    const empty = list.length === 0;
    el.menuEmpty.hidden = !empty;
    el.menuGrid.hidden = empty;

    const q = state.query.trim();
    let status = "";
    if (empty) status = "Tidak ada menu yang cocok.";
    else if (q) status = list.length + ' menu cocok dengan "' + q + '".';
    else if (state.category !== "semua")
      status = "Menampilkan " + list.length + " menu " + (CAT_LABEL.get(state.category) || "").toLowerCase() + ".";
    el.menuStatus.textContent = status;

    if (el.searchStatus) {
      el.searchStatus.textContent = q
        ? empty
          ? "Tidak ada menu yang cocok."
          : list.length + " menu cocok."
        : "";
    }
  }

  function resetMenuFilters() {
    state.category = "semua";
    state.query = "";
    el.searchInput.value = "";
    el.searchClear.hidden = true;
    syncFilterButtons();
    renderMenu();
  }

  /* ---------- Pencarian ---------- */
  let searchScrolled = false;

  function openSearch() {
    closeNav();
    el.searchPanel.hidden = false;
    el.searchToggle.setAttribute("aria-expanded", "true");
    el.searchInput.focus();
  }
  function closeSearch(returnFocus) {
    el.searchPanel.hidden = true;
    el.searchToggle.setAttribute("aria-expanded", "false");
    searchScrolled = false;
    if (state.query) {
      state.query = "";
      el.searchInput.value = "";
      el.searchClear.hidden = true;
      renderMenu();
    }
    if (returnFocus) el.searchToggle.focus();
  }

  function menuOffscreen() {
    const m = $("#menu");
    if (!m) return false;
    const r = m.getBoundingClientRect();
    return r.top > window.innerHeight * 0.6 || r.bottom < 0;
  }

  /* ---------- Navigasi mobile ---------- */
  function openNav() {
    el.nav.classList.add("is-open");
    el.navToggle.setAttribute("aria-expanded", "true");
    el.navToggle.setAttribute("aria-label", "Tutup menu navigasi");
  }
  function closeNav() {
    el.nav.classList.remove("is-open");
    el.navToggle.setAttribute("aria-expanded", "false");
    el.navToggle.setAttribute("aria-label", "Buka menu navigasi");
  }

  /* ---------- Keranjang ---------- */
  const cartKey = (item) => item.id + "|" + (item.temp || "");

  function loadCart() {
    try {
      const raw = store.get(CART_KEY);
      const data = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(data)) return [];
      const merged = new Map();
      data.forEach((it) => {
        const p = it && BY_ID.get(it.id);
        if (!p) return;
        const qty = Math.floor(Number(it.qty));
        if (!(qty >= 1)) return;
        const temps = p.temps || [];
        const temp = temps.length ? (temps.includes(it.temp) ? it.temp : temps[0]) : "";
        const item = { id: p.id, temp, qty: Math.min(qty, CFG.maxQty) };
        const k = cartKey(item);
        if (merged.has(k)) merged.get(k).qty = Math.min(merged.get(k).qty + item.qty, CFG.maxQty);
        else merged.set(k, item);
      });
      return Array.from(merged.values());
    } catch (_) {
      return [];
    }
  }
  function saveCart() {
    store.set(CART_KEY, JSON.stringify(cart));
  }

  const cartCount = () => cart.reduce((n, it) => n + it.qty, 0);
  const cartTotal = () => cart.reduce((n, it) => n + it.qty * BY_ID.get(it.id).price, 0);

  function addToCart(id, temp) {
    const p = BY_ID.get(id);
    if (!p) return;
    const t = (p.temps || []).length ? temp || p.temps[0] : "";
    const key = id + "|" + t;
    const found = cart.find((it) => cartKey(it) === key);
    if (found) {
      if (found.qty >= CFG.maxQty) {
        toast("Maksimal " + CFG.maxQty + " untuk satu menu");
        return;
      }
      found.qty += 1;
    } else {
      cart.push({ id, temp: t, qty: 1 });
    }
    saveCart();
    renderCart();
    bumpBadge();
    const label = p.name + (t ? " (" + t.toLowerCase() + ")" : "");
    toast(label + " masuk keranjang");
    announce(label + " ditambahkan. Keranjang berisi " + cartCount() + " item.");
  }

  function changeQty(key, delta) {
    const item = cart.find((it) => cartKey(it) === key);
    if (!item) return;
    const next = item.qty + delta;
    if (next > CFG.maxQty) {
      toast("Maksimal " + CFG.maxQty + " untuk satu menu");
      return;
    }
    if (next < 1) {
      removeItem(key);
      return;
    }
    item.qty = next;
    saveCart();
    renderCart(key, delta > 0 ? "inc" : "dec");
  }

  function removeItem(key) {
    const idx = cart.findIndex((it) => cartKey(it) === key);
    if (idx === -1) return;
    const name = BY_ID.get(cart[idx].id).name;
    cart.splice(idx, 1);
    saveCart();
    const nextKey = cart[Math.min(idx, cart.length - 1)];
    renderCart(nextKey ? cartKey(nextKey) : null, "remove");
    announce(name + " dihapus dari keranjang.");
  }

  function clearCart() {
    cart = [];
    saveCart();
    renderCart();
    announce("Keranjang dikosongkan.");
    el.cartToMenu.focus();
  }

  function bumpBadge() {
    el.cartCount.classList.remove("bump");
    void el.cartCount.offsetWidth;
    el.cartCount.classList.add("bump");
  }

  function renderCart(focusKey, focusAction) {
    const count = cartCount();
    el.cartCount.hidden = count === 0;
    el.cartCount.textContent = String(count);
    el.cartToggle.setAttribute(
      "aria-label",
      "Buka keranjang, " + count + " item"
    );

    const empty = cart.length === 0;
    el.cartEmpty.hidden = !empty;
    el.cartList.hidden = empty;
    el.checkoutForm.hidden = empty;

    el.cartList.textContent = "";
    cart.forEach((it) => {
      const p = BY_ID.get(it.id);
      const key = cartKey(it);
      const li = document.createElement("li");
      li.className = "cart-item";
      li.dataset.key = key;

      const name = document.createElement("p");
      name.className = "cart-item-name";
      name.textContent = p.name;

      const total = document.createElement("p");
      total.className = "cart-item-total";
      total.textContent = rupiah(p.price * it.qty);

      const meta = document.createElement("p");
      meta.className = "cart-item-meta";
      meta.textContent = (it.temp ? it.temp + " · " : "") + rupiah(p.price);

      const controls = document.createElement("div");
      controls.className = "cart-item-controls";

      const qty = document.createElement("div");
      qty.className = "qty";
      qty.setAttribute("role", "group");
      qty.setAttribute("aria-label", "Jumlah " + p.name);
      qty.innerHTML =
        '<button type="button" data-action="dec" aria-label="Kurangi ' +
        escapeAttr(p.name) +
        '"><svg class="icon" aria-hidden="true"><use href="#i-minus"></use></svg></button>' +
        '<output aria-live="off">' +
        it.qty +
        '</output>' +
        '<button type="button" data-action="inc" aria-label="Tambah ' +
        escapeAttr(p.name) +
        '"><svg class="icon" aria-hidden="true"><use href="#i-plus"></use></svg></button>';

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "cart-remove";
      remove.dataset.action = "remove";
      remove.setAttribute("aria-label", "Hapus " + p.name + " dari keranjang");
      remove.innerHTML =
        '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>Hapus';

      controls.append(qty, remove);
      li.append(name, total, meta, controls);
      el.cartList.appendChild(li);
    });

    el.cartTotal.textContent = rupiah(cartTotal());

    if (focusAction && el.drawer.open) {
      let target = null;
      if (focusKey) {
        const row = $$(".cart-item", el.cartList).find((r) => r.dataset.key === focusKey);
        if (row) {
          const act = focusAction === "remove" ? "remove" : focusAction;
          target = $('[data-action="' + act + '"]', row);
        }
      }
      (target || (empty ? el.cartToMenu : el.cartClose)).focus();
    }
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  /* ---------- Drawer ---------- */
  function openCart() {
    closeNav();
    hideToast();
    if (typeof el.drawer.showModal === "function") {
      if (!el.drawer.open) el.drawer.showModal();
    } else {
      el.drawer.setAttribute("open", "");
    }
    document.body.classList.add("no-scroll");
  }
  function closeCart() {
    if (el.drawer.open) el.drawer.close();
  }

  /* ---------- Validasi ---------- */
  function setError(input, message) {
    const err = $("#" + input.id + "-error");
    if (message) {
      input.setAttribute("aria-invalid", "true");
      if (err) {
        err.textContent = message;
        err.hidden = false;
      }
    } else {
      input.removeAttribute("aria-invalid");
      if (err) {
        err.textContent = "";
        err.hidden = true;
      }
    }
    return !message;
  }

  const checks = {
    name(v) {
      return v.trim().length >= 2 ? "" : "Isi namamu, minimal 2 huruf.";
    },
    message(v) {
      return v.trim().length >= 5 ? "" : "Tulis pesanmu, minimal 5 karakter.";
    },
    email(v) {
      if (!v.trim()) return "";
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
        ? ""
        : "Format email belum benar. Contoh: nama@email.com";
    },
    phone(v) {
      if (!v.trim()) return "";
      const digits = v.replace(/\D/g, "");
      return /^[+\d\s\-()]+$/.test(v.trim()) && digits.length >= 8 && digits.length <= 15
        ? ""
        : "Nomor HP belum benar. Gunakan 8 sampai 15 angka.";
    },
  };

  function validate(pairs) {
    let firstBad = null;
    pairs.forEach(([input, rule]) => {
      const ok = setError(input, checks[rule](input.value));
      if (!ok && !firstBad) firstBad = input;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /* ---------- Pesan WhatsApp ---------- */
  function buildOrderMessage(name, notes) {
    const lines = ["Halo " + CFG.shopName + ", saya mau pesan:", ""];
    cart.forEach((it, i) => {
      const p = BY_ID.get(it.id);
      const label = p.name + (it.temp ? " (" + it.temp + ")" : "");
      lines.push(i + 1 + ". " + label + " x" + it.qty + " = " + rupiah(p.price * it.qty));
    });
    lines.push("", "Total: " + rupiah(cartTotal()), "", "Nama: " + name.trim());
    if (notes.trim()) lines.push("Catatan: " + notes.trim());
    return lines.join("\n");
  }

  function buildContactMessage(f) {
    const lines = ["Halo " + CFG.shopName + ",", "", f.message.trim(), "", "Nama: " + f.name.trim()];
    if (f.email.trim()) lines.push("Email: " + f.email.trim());
    if (f.phone.trim()) lines.push("No. HP: " + f.phone.trim());
    return lines.join("\n");
  }

  /* ---------- Event ---------- */
  function bindEvents() {
    // Filter kategori
    el.filters.addEventListener("click", (e) => {
      const b = e.target.closest(".filter-btn");
      if (!b) return;
      state.category = b.dataset.cat;
      syncFilterButtons();
      renderMenu();
      announce(el.menuStatus.textContent || "Menampilkan semua menu.");
    });

    // Kartu menu
    el.menuGrid.addEventListener("click", (e) => {
      const li = e.target.closest(".menu-item");
      if (!li) return;
      const id = li.dataset.id;
      const tempBtn = e.target.closest(".temp-switch button");
      if (tempBtn) {
        selectedTemp.set(id, tempBtn.dataset.temp);
        $$(".temp-switch button", li).forEach((b) =>
          b.setAttribute("aria-pressed", String(b === tempBtn))
        );
        return;
      }
      const add = e.target.closest(".add-btn");
      if (add) {
        addToCart(id, selectedTemp.get(id));
        const label = $("span", add);
        add.classList.add("is-added");
        label.textContent = "Ditambah";
        window.setTimeout(() => {
          add.classList.remove("is-added");
          label.textContent = "Tambah";
        }, 900);
      }
    });

    el.menuReset.addEventListener("click", () => {
      resetMenuFilters();
      announce("Menampilkan semua menu.");
    });

    // Pencarian
    el.searchToggle.addEventListener("click", () => {
      if (el.searchPanel.hidden) openSearch();
      else closeSearch(true);
    });
    el.searchInput.addEventListener("input", () => {
      state.query = el.searchInput.value;
      el.searchClear.hidden = !state.query;
      renderMenu();
      if (state.query && !searchScrolled && menuOffscreen()) {
        searchScrolled = true;
        scrollToMenu();
      }
    });
    el.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      el.searchInput.blur();
      scrollToMenu();
    });
    el.searchClear.addEventListener("click", () => {
      state.query = "";
      el.searchInput.value = "";
      el.searchClear.hidden = true;
      renderMenu();
      el.searchInput.focus();
    });

    // Navigasi mobile
    el.navToggle.addEventListener("click", () => {
      if (el.nav.classList.contains("is-open")) closeNav();
      else {
        if (!el.searchPanel.hidden) closeSearch(false);
        openNav();
      }
    });
    el.nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) closeNav();
    });
    document.addEventListener("click", (e) => {
      if (
        el.nav.classList.contains("is-open") &&
        !e.target.closest("#site-nav") &&
        !e.target.closest("#nav-toggle")
      )
        closeNav();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || el.drawer.open) return;
      if (el.nav.classList.contains("is-open")) {
        closeNav();
        el.navToggle.focus();
      } else if (!el.searchPanel.hidden) {
        closeSearch(true);
      }
    });
    window.matchMedia("(min-width: 761px)").addEventListener("change", (m) => {
      if (m.matches) closeNav();
    });

    // Header
    const onScroll = () => el.header.classList.toggle("is-scrolled", window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // Drawer
    el.cartToggle.addEventListener("click", openCart);
    el.cartClose.addEventListener("click", closeCart);
    el.drawer.addEventListener("click", (e) => {
      if (e.target === el.drawer) closeCart();
    });
    el.drawer.addEventListener("close", () => {
      document.body.classList.remove("no-scroll");
    });
    el.cartToMenu.addEventListener("click", () => {
      closeCart();
      scrollToMenu();
    });
    el.cartClear.addEventListener("click", clearCart);

    el.cartList.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const row = btn.closest(".cart-item");
      const key = row.dataset.key;
      const action = btn.dataset.action;
      if (action === "inc") changeQty(key, 1);
      else if (action === "dec") changeQty(key, -1);
      else if (action === "remove") removeItem(key);
    });

    // Checkout
    el.oName.addEventListener("input", () => {
      if (el.oName.hasAttribute("aria-invalid")) setError(el.oName, checks.name(el.oName.value));
    });
    el.checkoutForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!cart.length) return;
      if (!validate([[el.oName, "name"]])) return;
      store.set(NAME_KEY, el.oName.value.trim());
      openWhatsApp(buildOrderMessage(el.oName.value, el.oNotes.value));
      toast("WhatsApp dibuka. Kirim pesannya di sana.");
      announce("WhatsApp dibuka. Pesananmu belum terkirim sampai kamu menekan kirim di sana.");
    });

    // Kontak
    const contactFields = {
      name: $("#c-name"),
      email: $("#c-email"),
      phone: $("#c-phone"),
      message: $("#c-message"),
    };
    Object.entries(contactFields).forEach(([rule, input]) => {
      input.addEventListener("input", () => {
        if (input.hasAttribute("aria-invalid")) setError(input, checks[rule](input.value));
        el.contactStatus.textContent = "";
      });
    });
    el.contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = validate([
        [contactFields.name, "name"],
        [contactFields.email, "email"],
        [contactFields.phone, "phone"],
        [contactFields.message, "message"],
      ]);
      if (!ok) {
        el.contactStatus.textContent = "";
        return;
      }
      const values = {
        name: contactFields.name.value,
        email: contactFields.email.value,
        phone: contactFields.phone.value,
        message: contactFields.message.value,
      };
      store.set(NAME_KEY, values.name.trim());
      openWhatsApp(buildContactMessage(values));
      el.contactStatus.textContent =
        "WhatsApp dibuka dengan pesanmu. Tekan kirim di sana untuk menyelesaikannya.";
      el.contactForm.reset();
    });

    // Sinkron antar tab
    window.addEventListener("storage", (e) => {
      if (e.key === CART_KEY) {
        cart = loadCart();
        renderCart();
      }
    });
  }

  /* ---------- Section aktif di navigasi ---------- */
  function observeSections() {
    if (!("IntersectionObserver" in window)) return;
    const links = new Map($$("[data-nav]").map((a) => [a.dataset.nav, a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          links.forEach((a, id) => {
            const on = id === en.target.id;
            a.classList.toggle("is-active", on);
            if (on) a.setAttribute("aria-current", "location");
            else a.removeAttribute("aria-current");
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    ["home", "about", "menu", "contact"].forEach((id) => {
      const s = document.getElementById(id);
      if (s) io.observe(s);
    });
  }

  /* ---------- Mulai ---------- */
  function init() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());

    cart = loadCart();
    setupWaLinks();
    renderFilters();
    renderMenu();
    renderCart();
    bindEvents();
    observeSections();

    const savedName = store.get(NAME_KEY);
    if (savedName) {
      el.oName.value = savedName;
      const cName = $("#c-name");
      if (cName) cName.value = savedName;
    }
  }

  init();
})();
