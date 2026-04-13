// ===================================================
// POS — Product list, Cart, Checkout, Struk
// ===================================================

let posActiveCat = 'semua';
let cart = [];
let selectedPayMethod = 'Tunai';
let _lastTrx = null;
let posViewMode = 'list'; // 'list' or 'grid'

// ===== PRODUK LIST =====
function togglePosView() {
  posViewMode = posViewMode === 'list' ? 'grid' : 'list';
  const icon = document.getElementById('pos-view-icon');
  if (icon) {
    icon.className = posViewMode === 'list' ? 'fa-solid fa-th' : 'fa-solid fa-list';
  }
  renderPosProducts(document.getElementById('posSearchInput')?.value.trim() || '');
}

function renderPosProducts(query = '') {
  const area = document.getElementById('posProductArea');
  if (!area) return;
  let filtered = getProducts();
  if (posActiveCat !== 'semua') {
    filtered = filtered.filter(p => (p.kategori || '').toLowerCase() === posActiveCat.toLowerCase());
  }
  if (query) {
    const q = query.toLowerCase();
    filtered = filtered.filter(p =>
      p.nama.toLowerCase().includes(q) ||
      (p.barcode || '').includes(q) ||
      (p.kode || '').toLowerCase().includes(q));
  }
  if (filtered.length === 0) {
    area.innerHTML = emptyState('fa-cube', 'Data tidak ditemukan',
      query ? `"${query}" tidak ditemukan` : 'Belum ada produk');
    return;
  }

  if (posViewMode === 'grid') {
    area.innerHTML = `<div class="pos-product-grid">${filtered.map(p => `
      <div class="pos-product-card" onclick="addToCart('${p.id}')">
        <div class="pos-card-photo">
          ${p.foto ? `<img src="${p.foto}" alt="${p.nama}" />` : `<i class="fa-solid fa-cube"></i>`}
        </div>
        <div class="pos-card-nama">${p.nama}</div>
        <div class="pos-card-stok">Stok: ${p.stok ?? p.stokAwal ?? 0}</div>
        <div class="pos-card-harga">${fmt(p.hargaJual)}</div>
      </div>`).join('')}</div>`;
  } else {
    area.innerHTML = filtered.map(p => `
      <div class="pos-product-item" onclick="addToCart('${p.id}')">
        <div class="pos-product-photo">
          ${p.foto ? `<img src="${p.foto}" alt="${p.nama}" />` : `<i class="fa-solid fa-cube"></i>`}
        </div>
        <div class="pos-product-info">
          <div class="pos-product-nama">${p.nama}</div>
          <div class="pos-product-stok">Stok: ${p.stok ?? p.stokAwal ?? 0}</div>
        </div>
        <div class="pos-product-harga">${fmt(p.hargaJual)}</div>
      </div>`).join('');
  }
}

function filterCategory(el, cat) {
  document.querySelectorAll('.pos-cat-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  posActiveCat = cat;
  renderPosProducts(document.getElementById('posSearchInput')?.value.trim() || '');
}

function filterPosProducts() {
  renderPosProducts(document.getElementById('posSearchInput')?.value.trim() || '');
}

// ===== CART =====
function addToCart(productId) {
  const p = getProducts().find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(c => c.id === productId);
  if (existing) { existing.qty++; }
  else { cart.push({ id: productId, nama: p.nama, harga: p.hargaJual, hargaBeli: p.hargaBeli || 0, qty: 1, unit: p.unit || 'Pcs' }); }
  updateCartBar();
  showToast(p.nama + ' ditambahkan');
}

function updateCartBar() {
  const totalItems = cart.reduce((s, c) => s + c.qty, 0);
  const totalHarga = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotal');
  if (countEl) countEl.textContent = totalItems + ' Items';
  if (totalEl) totalEl.textContent = fmt(totalHarga);
}

function clearCart() {
  if (cart.length === 0) return;
  if (!confirm('Kosongkan keranjang?')) return;
  cart = [];
  updateCartBar();
  renderCartScreen();
  showToast('Keranjang dikosongkan');
}

function changeQty(productId, delta) {
  const idx = cart.findIndex(c => c.id === productId);
  if (idx === -1) return;
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartBar();
  renderCartScreen();
}

function renderCartScreen() {
  const container = document.getElementById('cart-list');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<div class="pos-empty-state">
      <i class="fa-solid fa-cart-shopping" style="font-size:48px;color:#ddd;margin-bottom:8px;"></i>
      <p class="pos-empty-title">Keranjang kosong</p>
      <p class="pos-empty-sub">Tambah produk dari POS</p>
    </div>`;
    updateCartSummary();
    return;
  }

  container.innerHTML = `
    <p style="font-size:12px;color:var(--primary);font-weight:600;margin-bottom:6px;">*Klik produk untuk edit.</p>
    <div class="cart-header-row">
      <span>Produk</span><span>Subtotal</span>
    </div>
    ${cart.map(c => `
    <div class="cart-item" onclick="editCartItem('${c.id}')">
      <div class="cart-item-qty-col">
        <button class="cart-qty-btn-sm" onclick="event.stopPropagation();changeQty('${c.id}',1)">
          <i class="fa-solid fa-chevron-up"></i>
        </button>
        <div class="cart-item-photo">
          <span>${c.nama.substring(0,2).toUpperCase()}</span>
        </div>
        <button class="cart-qty-btn-sm" onclick="event.stopPropagation();changeQty('${c.id}',-1)">
          <i class="fa-solid fa-chevron-down"></i>
        </button>
      </div>
      <div class="cart-item-info">
        <div class="cart-item-nama">${c.nama}</div>
        <div class="cart-item-harga">${c.qty} ${c.unit} x ${fmt(c.harga)}</div>
        <div class="cart-item-modal">Modal: <span style="color:var(--primary);">${fmt(c.hargaBeli||0)}</span>, Laba: <span style="color:var(--primary);">${fmt((c.harga-(c.hargaBeli||0))*c.qty)}</span></div>
        <div class="cart-item-copy" onclick="event.stopPropagation();copyCartItem('${c.id}')">
          <i class="fa-regular fa-copy"></i> Copy...
        </div>
      </div>
      <div class="cart-item-subtotal">${fmt(c.qty * c.harga)}</div>
    </div>`).join('')}`;

  updateCartSummary();
}

function editCartItem(id) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  const val = prompt(`Edit qty "${item.nama}":`, item.qty);
  if (val === null) return;
  const qty = parseInt(val);
  if (isNaN(qty) || qty < 0) { showToast('Qty tidak valid'); return; }
  if (qty === 0) cart = cart.filter(c => c.id !== id);
  else item.qty = qty;
  updateCartBar();
  renderCartScreen();
}

function copyCartItem(id) {
  const item = cart.find(c => c.id === id);
  if (!item) return;
  cart.push({ ...item, id: item.id + '_' + Date.now() });
  updateCartBar();
  renderCartScreen();
  showToast('Item disalin');
}

function updateCartSummary() {
  const subtotal = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const totalModal = cart.reduce((s, c) => s + (c.hargaBeli||0) * c.qty, 0);
  const totalLaba = subtotal - totalModal;
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const isEmpty = cart.length === 0;

  // Topbar total
  const topbarTotal = document.getElementById('cart-topbar-total');
  if (topbarTotal) topbarTotal.textContent = fmt(subtotal);

  // Summary block
  const summary = document.getElementById('cart-price-summary');
  if (summary) {
    summary.style.display = isEmpty ? 'none' : '';
    if (!isEmpty) {
      summary.innerHTML = `
        <div class="cart-summary-block">
          <div class="cart-price-row">
            <span>${count} Items</span>
            <span>${fmt(subtotal)}</span>
          </div>
          <div class="cart-price-row">
            <span><i class="fa-solid fa-tag" style="font-size:11px;margin-right:4px;color:var(--text-light);"></i>Diskon 0.00%</span>
            <span style="color:var(--danger);">-Rp0</span>
          </div>
          <div class="cart-price-row" style="margin-top:4px;">
            <span></span>
            <span style="font-weight:700;font-size:14px;">${fmt(subtotal)}</span>
          </div>
          <div class="cart-price-row" style="color:var(--text-mid);font-size:13px;">
            <span><i class="fa-solid fa-receipt" style="margin-right:6px;"></i>Pajak</span>
            <span>Rp0</span>
          </div>
          <div class="cart-price-row" style="color:var(--text-mid);font-size:13px;">
            <span><i class="fa-solid fa-truck" style="margin-right:6px;"></i>Ongkos Kirim</span>
            <span>Rp0</span>
          </div>
          <div class="cart-price-row cart-price-total">
            <span>Total</span>
            <span>${fmt(subtotal)}</span>
          </div>
          <button class="cart-clear-btn" onclick="clearCart()">
            <i class="fa-solid fa-trash-can"></i> Kosongkan keranjang
          </button>
        </div>`;
    }
  }

  // Modal & Laba
  const modalLaba = document.getElementById('cart-modal-laba');
  if (modalLaba) {
    modalLaba.style.display = isEmpty ? 'none' : '';
    if (!isEmpty) {
      const tmEl = document.getElementById('cart-total-modal');
      const tlEl = document.getElementById('cart-total-laba');
      if (tmEl) tmEl.textContent = fmt(totalModal);
      if (tlEl) tlEl.textContent = fmt(totalLaba);
    }
  }

  // Form & footer
  const formSection = document.getElementById('cart-form-section');
  const footer = document.getElementById('cart-footer');
  if (formSection) formSection.style.display = isEmpty ? 'none' : '';
  if (footer) footer.style.display = isEmpty ? 'none' : '';
}

// ===== MODAL BAYAR =====
function bukaModalBayar() {
  if (cart.length === 0) { showToast('Keranjang kosong!'); return; }
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const el = document.getElementById('bayar-total-amount');
  if (el) el.textContent = fmt(total);
  const uangEl = document.getElementById('bayar-uang');
  if (uangEl) uangEl.value = '';
  const kemEl = document.getElementById('bayar-kembalian');
  if (kemEl) kemEl.textContent = 'Rp0';
  const tunaiSection = document.getElementById('bayar-tunai-section');
  if (tunaiSection) tunaiSection.style.display = '';
  selectedPayMethod = 'Tunai';
  document.querySelectorAll('.bayar-method-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
  const modal = document.getElementById('modal-bayar');
  if (modal) modal.style.display = 'flex';
}

function tutupModalBayar() {
  const modal = document.getElementById('modal-bayar');
  if (modal) modal.style.display = 'none';
}

function focusKeterangan() {
  document.getElementById('cart-keterangan')?.focus();
}

// ===== FORM TRANSAKSI — STATE =====
const cartForm = {
  tglTransaksi: '',
  tglJthTempo: '',
  pelangganId: null,
  pelangganNama: '',
  noMeja: '',
  jenisPenjualan: '',
  salesId: null,
  salesNama: '',
};

function resetCartForm() {
  const today = new Date().toISOString().split('T')[0];
  cartForm.tglTransaksi = today;
  cartForm.tglJthTempo = '';
  cartForm.pelangganId = null;
  cartForm.pelangganNama = '';
  cartForm.noMeja = '';
  cartForm.jenisPenjualan = '';
  cartForm.salesId = null;
  cartForm.salesNama = '';
  _updateCartFormLabels();
}

function _updateCartFormLabels() {
  const fmtTgl = (s) => s ? s.split('-').reverse().join('/') : null;
  const el = id => document.getElementById(id);
  if (el('label-tgl-transaksi')) {
    el('label-tgl-transaksi').textContent = fmtTgl(cartForm.tglTransaksi) || 'Tgl Transaksi';
    el('label-tgl-transaksi').style.color = cartForm.tglTransaksi ? 'var(--text-dark)' : '';
  }
  if (el('label-tgl-jth-tempo')) {
    el('label-tgl-jth-tempo').textContent = fmtTgl(cartForm.tglJthTempo) || 'Tgl Jth Tempo';
    el('label-tgl-jth-tempo').style.color = cartForm.tglJthTempo ? 'var(--text-dark)' : '';
  }
  if (el('label-pelanggan')) {
    el('label-pelanggan').textContent = cartForm.pelangganNama || 'Pelanggan';
    el('label-pelanggan').style.color = cartForm.pelangganNama ? 'var(--text-dark)' : '';
  }
  if (el('label-no-meja')) {
    el('label-no-meja').textContent = cartForm.noMeja ? 'Meja ' + cartForm.noMeja : 'No. Meja';
    el('label-no-meja').style.color = cartForm.noMeja ? 'var(--text-dark)' : '';
  }
  if (el('label-jenis-penjualan')) {
    el('label-jenis-penjualan').textContent = cartForm.jenisPenjualan || 'Jenis Penjualan';
    el('label-jenis-penjualan').style.color = cartForm.jenisPenjualan ? 'var(--text-dark)' : '';
  }
  if (el('label-sales')) {
    el('label-sales').textContent = cartForm.salesNama || 'Sales';
    el('label-sales').style.color = cartForm.salesNama ? 'var(--text-dark)' : '';
  }
}

// ===== TANGGAL PICKER =====
let _tglTarget = '';
function bukaPickerTanggal(target) {
  _tglTarget = target;
  const modal = document.getElementById('modal-tgl-picker');
  const title = document.getElementById('modal-tgl-title');
  const input = document.getElementById('input-tgl-picker');
  if (title) title.textContent = target === 'tgl-transaksi' ? 'Tanggal Transaksi' : 'Tanggal Jatuh Tempo';
  if (input) input.value = target === 'tgl-transaksi' ? cartForm.tglTransaksi : cartForm.tglJthTempo;
  if (modal) modal.style.display = 'flex';
}
function tutupModalTgl() {
  const modal = document.getElementById('modal-tgl-picker');
  if (modal) modal.style.display = 'none';
}
function pilihTanggal() {
  const val = document.getElementById('input-tgl-picker')?.value;
  if (!val) { tutupModalTgl(); return; }
  if (_tglTarget === 'tgl-transaksi') cartForm.tglTransaksi = val;
  else cartForm.tglJthTempo = val;
  _updateCartFormLabels();
  tutupModalTgl();
}

// ===== PELANGGAN PICKER =====
function bukaPickerPelanggan() {
  const modal = document.getElementById('modal-pilih-pelanggan');
  if (modal) modal.style.display = 'flex';
  const searchEl = document.getElementById('search-pelanggan-modal');
  if (searchEl) searchEl.value = '';
  renderPelangganModal();
}
function tutupModalPelanggan() {
  const modal = document.getElementById('modal-pilih-pelanggan');
  if (modal) modal.style.display = 'none';
}
function renderPelangganModal() {
  const query = document.getElementById('search-pelanggan-modal')?.value.toLowerCase() || '';
  const list = DB.get('pelanggan').filter(p => !query || p.nama.toLowerCase().includes(query));
  const container = document.getElementById('pelanggan-modal-list');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:16px;font-size:13px;">Belum ada pelanggan. Tambah di Pengaturan → Pelanggan.</p>`;
    return;
  }
  container.innerHTML = list.map(p => `
    <div class="modal-option-btn" onclick="pilihPelanggan('${p.id}','${p.nama}')">
      <i class="fa-solid fa-user"></i> ${p.nama}
      ${p.telp ? `<span style="font-size:11px;color:var(--text-light);margin-left:auto;">${p.telp}</span>` : ''}
    </div>`).join('');
}
function pilihPelanggan(id, nama) {
  cartForm.pelangganId = id;
  cartForm.pelangganNama = nama;
  _updateCartFormLabels();
  tutupModalPelanggan();
}

// ===== NO MEJA =====
function bukaInputNoMeja() {
  const modal = document.getElementById('modal-no-meja');
  const input = document.getElementById('input-no-meja');
  if (input) input.value = cartForm.noMeja;
  if (modal) modal.style.display = 'flex';
  setTimeout(() => input?.focus(), 100);
}
function tutupModalMeja() {
  const modal = document.getElementById('modal-no-meja');
  if (modal) modal.style.display = 'none';
}
function simpanNoMeja() {
  cartForm.noMeja = document.getElementById('input-no-meja')?.value.trim() || '';
  _updateCartFormLabels();
  tutupModalMeja();
}

// ===== JENIS PENJUALAN =====
function bukaPickerJenisPenjualan() {
  const modal = document.getElementById('modal-jenis-penjualan');
  if (modal) modal.style.display = 'flex';
  const defaults = ['Reguler', 'Grosir', 'Online'];
  const list = DB.get('jenisPenjualan').length ? DB.get('jenisPenjualan') : defaults;
  const container = document.getElementById('jenis-penjualan-modal-list');
  if (!container) return;
  container.innerHTML = list.map(j => `
    <div class="modal-option-btn" onclick="pilihJenisPenjualan('${j}')">
      <i class="fa-solid fa-list-ul"></i> ${j}
    </div>`).join('');
}
function tutupModalJenis() {
  const modal = document.getElementById('modal-jenis-penjualan');
  if (modal) modal.style.display = 'none';
}
function pilihJenisPenjualan(jenis) {
  cartForm.jenisPenjualan = jenis;
  _updateCartFormLabels();
  tutupModalJenis();
}

// ===== SALES PICKER =====
function bukaPickerSales() {
  const modal = document.getElementById('modal-pilih-sales');
  if (modal) modal.style.display = 'flex';
  const list = DB.get('sales');
  const container = document.getElementById('sales-modal-list');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:16px;font-size:13px;">Belum ada sales. Tambah di Pengaturan → Sales.</p>`;
    return;
  }
  container.innerHTML = list.map(s => `
    <div class="modal-option-btn" onclick="pilihSales('${s.id}','${s.nama}')">
      <i class="fa-regular fa-circle-user"></i> ${s.nama}
    </div>`).join('');
}
function tutupModalSales() {
  const modal = document.getElementById('modal-pilih-sales');
  if (modal) modal.style.display = 'none';
}
function pilihSales(id, nama) {
  cartForm.salesId = id;
  cartForm.salesNama = nama;
  _updateCartFormLabels();
  tutupModalSales();
}

// ===== CHECKOUT =====
function initCheckout() {
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const el = document.getElementById('checkout-total-amount');
  if (el) el.textContent = fmt(total);
  selectedPayMethod = 'Tunai';
}

function selectPayMethod(el, method) {
  // Works for both old checkout-method-btn and new bayar-method-btn
  const parent = el.closest('.bayar-method-grid, .checkout-method-grid');
  if (parent) parent.querySelectorAll('[class*="method-btn"]').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedPayMethod = method;
  // Toggle tunai section (both modal and old checkout)
  const tunaiModal = document.getElementById('bayar-tunai-section');
  const tunaiOld = document.getElementById('checkout-tunai-section');
  if (tunaiModal) tunaiModal.style.display = method === 'Tunai' ? '' : 'none';
  if (tunaiOld) tunaiOld.style.display = method === 'Tunai' ? '' : 'none';
}

function setNominalCepat(val, pas = false) {
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  // Try modal input first, fallback to old checkout input
  const input = document.getElementById('bayar-uang') || document.getElementById('checkout-bayar');
  if (!input) return;
  input.value = pas ? total : val;
  hitungKembalian();
}

function hitungKembalian() {
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const input = document.getElementById('bayar-uang') || document.getElementById('checkout-bayar');
  const bayar = parseFloat(input?.value) || 0;
  const kembalian = bayar - total;
  const el = document.getElementById('bayar-kembalian') || document.getElementById('checkout-kembalian');
  if (el) {
    el.textContent = fmt(Math.max(0, kembalian));
    el.style.color = kembalian < 0 ? 'var(--danger)' : 'var(--primary)';
  }
}

function prosesCheckout() {
  if (cart.length === 0) { showToast('Keranjang kosong!'); return; }
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  if (selectedPayMethod === 'Tunai') {
    const input = document.getElementById('bayar-uang') || document.getElementById('checkout-bayar');
    const bayar = parseFloat(input?.value) || 0;
    if (bayar < total) { showToast('Uang kurang!'); return; }
  }
  _simpanTransaksi(selectedPayMethod);
}

function prosesCheckoutPiutang() {
  if (cart.length === 0) { showToast('Keranjang kosong!'); return; }
  _simpanTransaksi('Piutang');
}

function simpanDraft() {
  if (cart.length === 0) { showToast('Keranjang kosong!'); return; }
  
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const transaksi = {
    id: 'trx_' + Date.now(),
    tanggal: cartForm.tglTransaksi ? cartForm.tglTransaksi + 'T' + new Date().toTimeString().slice(0,8) : new Date().toISOString(),
    tglJthTempo: cartForm.tglJthTempo || null,
    pelangganId: cartForm.pelangganId,
    pelanggan: cartForm.pelangganNama || '',
    noMeja: cartForm.noMeja || '',
    jenisPenjualan: cartForm.jenisPenjualan || '',
    salesId: cartForm.salesId,
    sales: cartForm.salesNama || '',
    items: [...cart],
    total,
    metodePembayaran: 'Draft',
    catatan: document.getElementById('cart-keterangan')?.value.trim() || '',
    bayar: 0,
    kembalian: 0,
    isDraft: true, // Transaksi draft
    lunas: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  const trxList = DB.get('transaksi');
  trxList.push(transaksi);
  DB.set('transaksi', trxList);
  
  // Auto-sync transaksi ke GAS
  autoSync('transaksi', 'create', transaksi);
  
  // Sync transaksi items
  transaksi.items.forEach((item, idx) => {
    autoSync('transaksiItems', 'create', {
      id: 'ti_' + transaksi.id + '_' + idx,
      transaksiId: transaksi.id,
      produkId: item.id,
      nama: item.nama,
      harga: item.harga,
      hargaBeli: item.hargaBeli || 0,
      qty: item.qty,
      unit: item.unit || 'Pcs',
      subtotal: item.qty * item.harga,
      createdAt: new Date().toISOString(),
    });
  });
  
  // Clear cart
  cart = [];
  updateCartBar();
  
  showToast('Draft disimpan!');
  switchScreen('pos');
}

function _simpanTransaksi(metode) {
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const bayarInput = document.getElementById('bayar-uang') || document.getElementById('checkout-bayar');
  const bayar = metode === 'Tunai' ? (parseFloat(bayarInput?.value) || 0) : total;
  const transaksi = {
    id: 'trx_' + Date.now(),
    tanggal: cartForm.tglTransaksi ? cartForm.tglTransaksi + 'T' + new Date().toTimeString().slice(0,8) : new Date().toISOString(),
    tglJthTempo: cartForm.tglJthTempo || null,
    pelangganId: cartForm.pelangganId,
    pelanggan: cartForm.pelangganNama || '',
    noMeja: cartForm.noMeja || '',
    jenisPenjualan: cartForm.jenisPenjualan || '',
    salesId: cartForm.salesId,
    sales: cartForm.salesNama || '',
    items: [...cart],
    total,
    metodePembayaran: metode,
    catatan: document.getElementById('cart-keterangan')?.value.trim() || '',
    bayar,
    kembalian: bayar - total,
    isDraft: false, // Transaksi selesai, bukan draft
    lunas: metode !== 'Piutang', // Lunas jika bukan piutang
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const trxList = DB.get('transaksi');
  trxList.push(transaksi);
  DB.set('transaksi', trxList);
  // Kurangi stok
  const products = getProducts();
  cart.forEach(c => {
    const p = products.find(x => x.id === c.id);
    if (p && p.pantauStok !== false) p.stok = Math.max(0, (p.stok ?? p.stokAwal ?? 0) - c.qty);
  });
  saveProducts(products);
  tutupModalBayar();
  cart = [];
  updateCartBar();
  // Auto-sync transaksi ke GAS
  autoSync('transaksi', 'create', transaksi);
  // Sync transaksi items
  transaksi.items.forEach((item, idx) => {
    autoSync('transaksiItems', 'create', {
      id: 'ti_' + transaksi.id + '_' + idx,
      transaksiId: transaksi.id,
      produkId: item.id,
      nama: item.nama,
      harga: item.harga,
      hargaBeli: item.hargaBeli || 0,
      qty: item.qty,
      unit: item.unit || 'Pcs',
      subtotal: item.qty * item.harga,
      createdAt: new Date().toISOString(),
    });
  });
  // Auto-sync stok produk yang berubah
  products.forEach(p => autoSync('produk', 'update', p, p.id));
  switchScreen('struk').then(() => renderStruk(transaksi));
}

function renderStruk(trx) {
  // Store for print & share
  _lastTrx = trx;

  // Play kaching sound
  playKachingSound();

  const paper = document.getElementById('struk-paper');
  const kembalianEl = document.getElementById('struk-kembalian-val');
  if (!paper) return;

  // Kembalian header
  if (kembalianEl) kembalianEl.textContent = fmt(trx.kembalian || 0);

  const outlet = DB.getObj('outlet');
  const tgl = new Date(trx.tanggal);
  const tglStr = tgl.toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' })
                 + ' ' + tgl.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  const tglBayarStr = tgl.toLocaleDateString('id-ID', { day:'2-digit', month:'2-digit', year:'numeric' });

  // Invoice number: INV-YYMMDDNNNN
  const invNum = 'INV-' + tgl.getFullYear().toString().slice(2)
    + String(tgl.getMonth()+1).padStart(2,'0')
    + String(tgl.getDate()).padStart(2,'0')
    + String(DB.get('transaksi').length).padStart(4,'0');

  const statusColor = trx.metodePembayaran === 'Piutang' ? 'var(--danger)' : '#2ecc71';
  const statusLabel = trx.metodePembayaran === 'Piutang' ? 'BELUM LUNAS' : 'LUNAS';
  const metodeLabel = 'KAS/' + trx.metodePembayaran.toUpperCase();

  const itemsHtml = trx.items.map((c, i) => `
    <tr class="struk-item-tr">
      <td class="struk-td-no">${i+1}</td>
      <td class="struk-td-nama">
        <div style="font-weight:600;">${c.nama}</div>
        <div style="color:#666;font-size:11px;">${c.qty} x ${fmt(c.harga)}</div>
      </td>
      <td class="struk-td-sub">${fmt(c.qty * c.harga)}</td>
    </tr>`).join('');

  const totalQty = trx.items.reduce((s, c) => s + c.qty, 0);

  paper.innerHTML = `
    <!-- Outlet name -->
    <div class="struk-outlet-name">${outlet.nama || 'Koncowrb'}</div>

    <div class="struk-paper-divider"></div>

    <!-- Meta info -->
    <div class="struk-meta-grid">
      <div>
        <div class="struk-meta-val">${tglStr}</div>
        <div class="struk-meta-val">${invNum}</div>
        <div class="struk-meta-label">Tgl Pembayaran</div>
        <div class="struk-meta-label">Kasir</div>
      </div>
      <div style="text-align:right;">
        <div class="struk-meta-val">${metodeLabel}</div>
        <div class="struk-meta-val" style="color:${statusColor};font-weight:700;">${statusLabel}</div>
        <div class="struk-meta-val">${tglBayarStr}</div>
        <div class="struk-meta-val">${trx.sales || DB.getObj('akun').nama || 'Kasir'}</div>
      </div>
    </div>

    ${trx.pelanggan ? `<div class="struk-meta-label">Pelanggan: <strong>${trx.pelanggan}</strong></div>` : ''}
    ${trx.noMeja ? `<div class="struk-meta-label">Meja: <strong>${trx.noMeja}</strong></div>` : ''}

    <div class="struk-paper-divider"></div>

    <!-- Items table -->
    <table class="struk-table">
      <thead>
        <tr>
          <th class="struk-td-no">No</th>
          <th class="struk-td-nama" style="text-align:left;">Produk</th>
          <th class="struk-td-sub">Subtotal</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="struk-paper-divider"></div>

    <!-- Totals -->
    <div class="struk-total-section">
      <div class="struk-total-row-bold">
        <span>${totalQty} ITEMS</span>
        <span>${fmt(trx.total)}</span>
      </div>
      <div class="struk-total-row">
        <span>Dibayar</span>
        <span>${fmt(trx.bayar || trx.total)}</span>
      </div>
      ${trx.metodePembayaran === 'Tunai' && trx.kembalian > 0 ? `
      <div class="struk-total-row">
        <span>Kembalian</span>
        <span style="color:#2ecc71;font-weight:600;">${fmt(trx.kembalian)}</span>
      </div>` : ''}
      ${trx.catatan ? `<div class="struk-total-row"><span>Ket</span><span>${trx.catatan}</span></div>` : ''}
    </div>

    <div class="struk-paper-divider"></div>

    <!-- Footer -->
    <div class="struk-paper-footer">
      <div>--- Terima Kasih ---</div>
      <div>${outlet.catatan || 'Powered by Kasir Pos'}</div>
    </div>`;
}

// ===== SOUND =====
let _strukSoundEnabled = true;

function playKachingSound() {
  try {
    const audio = document.getElementById('audio-kaching');
    if (audio && _strukSoundEnabled) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  } catch (e) {}
}

function toggleStrukSound() {
  _strukSoundEnabled = !_strukSoundEnabled;
  const icon = document.getElementById('icon-sound');
  if (icon) icon.className = _strukSoundEnabled ? 'fa-solid fa-volume-high' : 'fa-solid fa-volume-xmark';
  showToast(_strukSoundEnabled ? 'Suara aktif' : 'Suara dimatikan');
}

// ===== SHARE =====
function shareStruk() {
  if (!_lastTrx) return;
  const trx = _lastTrx;
  const outlet = DB.getObj('outlet');
  const tgl = new Date(trx.tanggal).toLocaleString('id-ID');
  const items = trx.items.map(c => `• ${c.nama} x${c.qty} = ${fmt(c.qty * c.harga)}`).join('\n');
  const text = `*${outlet.nama || 'Koncowrb'}*\n`
    + `Tanggal: ${tgl}\n`
    + `---\n${items}\n---\n`
    + `*Total: ${fmt(trx.total)}*\n`
    + `Metode: ${trx.metodePembayaran}\n`
    + (trx.metodePembayaran === 'Tunai' ? `Kembalian: ${fmt(trx.kembalian)}\n` : '')
    + `\n${outlet.catatan || 'Terima kasih!'}`;

  if (navigator.share) {
    navigator.share({ title: 'Struk ' + (outlet.nama || 'Koncowrb'), text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => showToast('Teks struk disalin!')).catch(() => showToast('Share tidak didukung'));
  }
}

function shareWhatsapp() {
  if (!_lastTrx) return;
  const trx = _lastTrx;
  const outlet = DB.getObj('outlet');
  const tgl = new Date(trx.tanggal).toLocaleString('id-ID');
  const items = trx.items.map(c => `• ${c.nama} x${c.qty} = ${fmt(c.qty * c.harga)}`).join('%0A');
  const text = encodeURIComponent(
    `*${outlet.nama || 'Koncowrb'}*\n`
    + `Tanggal: ${tgl}\n`
    + `---\n`
  ) + items + encodeURIComponent(
    `\n---\n*Total: ${fmt(trx.total)}*\n`
    + `Metode: ${trx.metodePembayaran}\n`
    + `\n${outlet.catatan || 'Terima kasih!'}`
  );
  window.open('https://wa.me/?text=' + text, '_blank');
}

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  const { name } = e.detail;
  if (name === 'pos') { renderPosProducts(); updateCartBar(); }
  if (name === 'keranjang') { resetCartForm(); renderCartScreen(); }
  if (name === 'checkout') initCheckout();
  if (name === 'log-transaksi') { initLogTransaksi(); renderLogTransaksi(); }
});

// ===================================================
// LOG TRANSAKSI
// ===================================================
let logActiveStatus = 'semua';
let logViewMode = 'list'; // 'list' or 'grid'

function initLogTransaksi() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const dariEl = document.getElementById('log-date-dari');
  const sampaiEl = document.getElementById('log-date-sampai');
  if (dariEl && !dariEl.value) dariEl.value = firstDay;
  if (sampaiEl && !sampaiEl.value) sampaiEl.value = today;
  logActiveStatus = 'semua';
  logViewMode = 'list';
  updateLogViewIcon();
}

function filterLogStatus(el, status) {
  document.querySelectorAll('.log-tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  logActiveStatus = status;
  renderLogTransaksi();
}

function toggleLogView() {
  logViewMode = logViewMode === 'list' ? 'grid' : 'list';
  updateLogViewIcon();
  renderLogTransaksi();
}

function updateLogViewIcon() {
  const icon = document.getElementById('log-view-toggle');
  if (icon) {
    icon.className = logViewMode === 'list' ? 'fa-solid fa-th' : 'fa-solid fa-list';
  }
}

function renderLogTransaksi() {
  const body = document.getElementById('log-transaksi-body');
  if (!body) return;

  const dari = document.getElementById('log-date-dari')?.value;
  const sampai = document.getElementById('log-date-sampai')?.value;
  const query = document.getElementById('log-search-input')?.value.toLowerCase() || '';

  let trxList = DB.get('transaksi');

  // Filter by date
  if (dari) trxList = trxList.filter(t => t.tanggal >= dari);
  if (sampai) trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');

  // Filter by status
  if (logActiveStatus === 'piutang') {
    trxList = trxList.filter(t => t.metodePembayaran === 'Piutang' && !t.lunas);
  } else if (logActiveStatus === 'draft') {
    trxList = trxList.filter(t => t.isDraft === true);
  }

  // Filter by search query
  if (query) {
    trxList = trxList.filter(t => 
      (t.pelanggan || 'umum').toLowerCase().includes(query) ||
      t.id.toLowerCase().includes(query) ||
      (t.catatan || '').toLowerCase().includes(query)
    );
  }

  // Sort by date (newest first)
  trxList = trxList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  if (trxList.length === 0) {
    body.innerHTML = `<div class="pos-empty-state">
      <i class="fa-solid fa-receipt" style="font-size:48px;color:#ddd;margin-bottom:8px;"></i>
      <p class="pos-empty-title">Tidak ada transaksi</p>
      <p class="pos-empty-sub">Belum ada data untuk filter ini</p>
    </div>`;
    return;
  }

  if (logViewMode === 'grid') {
    body.innerHTML = `<div class="log-grid">${trxList.map(t => renderLogItemGrid(t)).join('')}</div>`;
  } else {
    body.innerHTML = trxList.map(t => renderLogItemList(t)).join('');
  }
}

function renderLogItemList(t) {
  const tgl = new Date(t.tanggal);
  const tglStr = tgl.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const waktuStr = tgl.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  
  const statusColor = t.isDraft ? '#f39c12' : (t.metodePembayaran === 'Piutang' && !t.lunas) ? 'var(--danger)' : '#2ecc71';
  const statusLabel = t.isDraft ? 'Draft' : (t.metodePembayaran === 'Piutang' && !t.lunas) ? 'Piutang' : 'Lunas';
  const statusBg = t.isDraft ? '#fff8e1' : (t.metodePembayaran === 'Piutang' && !t.lunas) ? '#fde8e8' : '#e8f8f0';

  return `
  <div class="log-item-list">
    <div class="log-item-avatar" style="background:${statusBg};">
      <i class="fa-solid fa-receipt" style="color:${statusColor};font-size:16px;"></i>
    </div>
    <div class="log-item-info" onclick="lihatDetailLog('${t.id}')">
      <div class="log-item-nama">${t.pelanggan || 'Umum'} · ${t.items.length} item</div>
      <div class="log-item-sub">
        <span>${tglStr} ${waktuStr}</span>
        <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
      </div>
      <div class="log-item-total">${fmt(t.total)}</div>
    </div>
    <div class="log-item-actions">
      <button class="log-btn-view" onclick="lihatDetailLog('${t.id}')" title="Lihat Detail">
        <i class="fa-solid fa-eye"></i>
      </button>
      <button class="log-btn-del" onclick="hapusLogTransaksi('${t.id}')" title="Hapus">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
  </div>`;
}

function renderLogItemGrid(t) {
  const tgl = new Date(t.tanggal);
  const tglStr = tgl.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  const waktuStr = tgl.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  
  const statusColor = t.isDraft ? '#f39c12' : (t.metodePembayaran === 'Piutang' && !t.lunas) ? 'var(--danger)' : '#2ecc71';
  const statusLabel = t.isDraft ? 'Draft' : (t.metodePembayaran === 'Piutang' && !t.lunas) ? 'Piutang' : 'Lunas';

  return `
  <div class="log-item-grid" onclick="lihatDetailLog('${t.id}')">
    <div class="log-grid-header">
      <div class="log-grid-status" style="background:${statusColor};">${statusLabel}</div>
      <button class="log-grid-del" onclick="event.stopPropagation();hapusLogTransaksi('${t.id}')">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
    <div class="log-grid-pelanggan">${t.pelanggan || 'Umum'}</div>
    <div class="log-grid-items">${t.items.length} item</div>
    <div class="log-grid-total">${fmt(t.total)}</div>
    <div class="log-grid-date">${tglStr} · ${waktuStr}</div>
  </div>`;
}

function lihatDetailLog(id) {
  const trx = DB.get('transaksi').find(t => t.id === id);
  if (!trx) return;
  _lastTrx = trx;
  switchScreen('struk').then(() => renderStruk(trx));
}

function hapusLogTransaksi(id) {
  const trx = DB.get('transaksi').find(t => t.id === id);
  if (!trx) return;
  
  const tgl = new Date(trx.tanggal).toLocaleDateString('id-ID');
  if (!confirm(`Hapus transaksi ${tgl} - ${fmt(trx.total)}?\n\nPeringatan: Stok produk tidak akan dikembalikan.`)) return;
  
  // Delete transaction
  DB.set('transaksi', DB.get('transaksi').filter(t => t.id !== id));
  
  // Sync delete to GAS
  autoSync('transaksi', 'delete', null, id);
  
  // Re-render
  renderLogTransaksi();
  showToast('Transaksi dihapus');
}
