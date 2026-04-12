// ===================================================
// CORE — DB, Router, Toast, Clock
// ===================================================

// ===== STORAGE =====
const DB = {
  get:    (key) => JSON.parse(localStorage.getItem(key) || '[]'),
  set:    (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  getObj: (key) => JSON.parse(localStorage.getItem(key) || '{}'),
  setObj: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

// ===== ROUTER =====
const BOTTOM_NAV_SCREENS = ['pos', 'biaya', 'beranda', 'laporan', 'pengaturan'];

// Map sub-screens back to their parent nav tab
const NAV_PARENT = {
  'pos': 'pos', 'pos-settings': 'pos',
  'keranjang': 'pos', 'checkout': 'pos', 'struk': 'pos',
  'tambah-produk': 'pengaturan', 'master-produk': 'pengaturan',
  'kategori-produk': 'pengaturan', 'outlet': 'pengaturan',
  'akun': 'pengaturan', 'ganti-password': 'pengaturan',
  'kategori-biaya': 'pengaturan', 'supplier': 'pengaturan',
  'pelanggan': 'pengaturan', 'sales': 'pengaturan',
  'kurir': 'pengaturan', 'kasir': 'pengaturan',
  'jenis-penjualan': 'pengaturan', 'metode-pembayaran': 'pengaturan',
  'pengaturan-printer': 'pengaturan', 'tentang': 'pengaturan',
  'sync-settings': 'pengaturan',
  'biaya': 'biaya', 'tambah-biaya': 'biaya',
  'beranda': 'beranda',
  'pembelian': 'beranda', 'tambah-pembelian': 'beranda',
  'mutasi-stok': 'beranda', 'tambah-mutasi': 'beranda',
  'bayar-supplier': 'beranda', 'pelanggan-bayar': 'beranda',
  'rekapan': 'beranda',
  'laporan': 'laporan',
  'laporan-penjualan': 'laporan', 'laporan-produk-terjual': 'laporan',
  'laporan-piutang': 'laporan', 'laporan-pembelian': 'laporan',
  'laporan-hutang-supplier': 'laporan', 'laporan-persediaan': 'laporan',
  'laporan-mutasi-stok': 'laporan', 'laporan-laba-rugi': 'laporan',
  'laporan-arus-kas': 'laporan', 'laporan-biaya': 'laporan',
  'laporan-omset-sales': 'laporan', 'laporan-invoice-pelanggan': 'laporan',
  'laporan-invoice-supplier': 'laporan', 'laporan-jatuh-tempo': 'laporan',
  'pengaturan': 'pengaturan',
  'tambah-kasir': 'pengaturan',
  // Auth screens — no nav parent
  'login': null, 'register': null,
};

// Semua halaman selalu reload HTML terbaru (no cache)
const NO_CACHE_PAGES = new Set(['*']); // wildcard — semua halaman

const _loadedPages = {};

async function switchScreen(name, params = {}) {
  // Always remove and re-fetch — ensures latest HTML is always used
  const old = document.getElementById('screen-' + name);
  if (old) old.remove();
  delete _loadedPages[name];

  try {
    const res = await fetch(`pages/${name}.html?v=` + Date.now());
    if (!res.ok) throw new Error('not found');
    const html = await res.text();
    const div = document.createElement('div');
    div.id = 'screen-' + name;
    div.className = 'screen';
    div.innerHTML = html;
    document.getElementById('app').appendChild(div);
    _loadedPages[name] = true;
  } catch (e) {
    console.warn('Page not found:', name);
    showToast('Halaman tidak ditemukan: ' + name);
    return;
  }

  // Hide all screens
  document.querySelectorAll('#app .screen').forEach(s => s.classList.remove('active'));

  // Show target screen
  const target = document.getElementById('screen-' + name);
  if (!target) return;
  target.classList.add('active');

  // Update bottom nav active state
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const parentNav = NAV_PARENT[name] || name;
  const navEl = document.getElementById('nav-' + parentNav);
  if (navEl) navEl.classList.add('active');

  // Always keep bottom nav visible — just dim it on sub-screens
  const bottomNav = document.querySelector('.bottom-nav');
  if (bottomNav) {
    const isRoot = BOTTOM_NAV_SCREENS.includes(name);
    const isAuth = name === 'login' || name === 'register';
    bottomNav.style.display = isAuth ? 'none' : '';
    bottomNav.style.opacity = isRoot ? '1' : '0.85';
  }

  // Push to history
  history.pushState({ screen: name, params }, '', '#' + name);

  // Dispatch init event for the screen
  const event = new CustomEvent('screenInit', { detail: { name, params } });
  document.dispatchEvent(event);
}

// Handle browser back button
window.addEventListener('popstate', (e) => {
  if (e.state && e.state.screen) {
    switchScreen(e.state.screen, e.state.params || {});
  }
});

// ===== TOAST =====
let _toastTimer = null;
function showToast(msg, duration = 2000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const el = document.querySelector('.time');
  if (el) el.textContent = h + ':' + m;
}

// ===== SHARED HELPERS =====
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function fmt(v) {
  return 'Rp' + Number(v).toLocaleString('id-ID');
}

function emptyState(icon, title, sub = '') {
  return `<div class="pos-empty-state">
    <i class="fa-solid ${icon}" style="font-size:48px;color:#ddd;margin-bottom:8px;"></i>
    <p class="pos-empty-title">${title}</p>
    ${sub ? `<p class="pos-empty-sub">${sub}</p>` : ''}
  </div>`;
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 10000);
  // Cek auth session, lalu arahkan ke login atau beranda
  initAuth();
});
