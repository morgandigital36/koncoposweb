// ============================================================
// SYNC v2 — Sinkronisasi LocalStorage ↔ Google Sheets
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzmFfqFNOa-hGqfJzDKSjAsPG9yDWqL5dz3j6XMeABd5TWPnDAAxcE4fuygjZJSsrbSgg/exec';

// ===== STATE =====
let _syncStatus  = 'idle';
let _lastSync    = null;
let _isSyncing   = false;
let _pendingSync = {};
let _autoSyncTimer = null;

// ============================================================
// CORE REQUEST — inject token otomatis
// ============================================================
async function gasRequest(params) {
  const url = GAS_URL || DB.getObj('gasConfig').url || '';
  if (!url) throw new Error('GAS_URL belum diisi');

  const token = (typeof getToken === 'function') ? getToken() : null;
  if (!params.body)  params.body  = {};
  if (!params.query) params.query = {};

  if (token) {
    if (Object.keys(params.body).length  > 0 && !params.body.token)  params.body.token  = token;
    if (Object.keys(params.query).length > 0 && !params.query.token) params.query.token = token;
  }

  const isPost = Object.keys(params.body).length > 0;

  if (isPost) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(params.body),
      redirect: 'follow',
    });
    return JSON.parse(await res.text());
  } else {
    const qs = new URLSearchParams(params.query).toString();
    const res = await fetch(url + (qs ? '?' + qs : ''), { redirect: 'follow' });
    return JSON.parse(await res.text());
  }
}

// ============================================================
// PING
// ============================================================
async function pingGAS() {
  try {
    const r = await gasRequest({ query: { action: 'ping' } });
    return { ok: r.status === 'ok', time: r.time };
  } catch (e) { return { ok: false, error: e.message }; }
}

// ============================================================
// SETUP
// ============================================================
async function setupGoogleSheet() {
  showSyncToast('Menyiapkan Google Sheet...', 0);
  try {
    const r = await gasRequest({ query: { action: 'setup' } });
    if (r.error) throw new Error(r.error);
    showSyncToast(`✓ Setup selesai! ${r.created?.length || 0} sheet dibuat.`);
    return r;
  } catch (e) {
    showSyncToast('✗ Setup gagal: ' + e.message, 3000, true);
    throw e;
  }
}

// ============================================================
// AUTO SYNC ENGINE — debounced, background
// ============================================================

// Daftar sheet yang perlu trigger generate laporan setelah sync
const LAPORAN_TRIGGER_SHEETS = new Set([
  'transaksi', 'pembelian', 'mutasi', 'biaya', 'produk'
]);

let _needGenerateLaporan = false;

function autoSync(sheetKey, action, data, id) {
  if (!GAS_URL) return;
  if (!_pendingSync[sheetKey]) _pendingSync[sheetKey] = [];
  _pendingSync[sheetKey].push({ action, data, id });

  // Tandai perlu generate laporan
  if (LAPORAN_TRIGGER_SHEETS.has(sheetKey)) _needGenerateLaporan = true;

  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(_flushSync, 1500);
  _setSyncStatus('syncing');
}

async function _flushSync() {
  if (!GAS_URL || _isSyncing) return;
  const pending = { ..._pendingSync };
  _pendingSync = {};
  _isSyncing = true;

  const failed = {};

  try {
    for (const [sheetKey, ops] of Object.entries(pending)) {
      for (const op of ops) {
        try {
          if (op.action === 'create' || op.action === 'upsert') {
            await gasRequest({ body: { action: 'upsert', sheet: sheetKey, data: op.data } });
          } else if (op.action === 'update') {
            await gasRequest({ body: { action: 'update', sheet: sheetKey, id: op.id, data: op.data } });
          } else if (op.action === 'delete') {
            await gasRequest({ body: { action: 'delete', sheet: sheetKey, id: op.id } });
          }
        } catch (e) {
          if (!failed[sheetKey]) failed[sheetKey] = [];
          failed[sheetKey].push(op);
        }
      }
    }

    // Generate laporan di GAS jika ada perubahan data relevan
    if (_needGenerateLaporan) {
      _needGenerateLaporan = false;
      try {
        await gasRequest({ body: { action: 'generateLaporan' } });
      } catch (e) { /* silent — laporan bisa di-generate manual */ }
    }

    _lastSync = new Date();
    DB.setObj('lastSync', { time: _lastSync.toISOString(), status: 'ok' });
    _setSyncStatus('ok');
  } catch (e) {
    _setSyncStatus('error');
  } finally {
    _isSyncing = false;
    // Retry failed ops
    if (Object.keys(failed).length > 0) {
      Object.assign(_pendingSync, failed);
      _autoSyncTimer = setTimeout(_flushSync, 5000);
    }
  }
}

function _setSyncStatus(s) {
  _syncStatus = s;
  updateSyncIndicator();
}

// ============================================================
// PUSH ALL — kirim semua data lokal ke GAS sekaligus
// ============================================================
async function pushAllToSheet() {
  if (!GAS_URL) { showSyncToast('GAS_URL belum diisi!', 3000, true); return; }
  if (_isSyncing) { showSyncToast('Sync sedang berjalan...'); return; }

  _isSyncing = true;
  _setSyncStatus('syncing');
  showSyncToast('Mengirim semua data ke Google Sheet...', 0);

  try {
    const result = await gasRequest({
      body: {
        action: 'pushAll',
        data: {
          produk:          DB.get('products'),      // GAS key: produk
          kategori:        DB.get('kategori'),
          transaksi:       DB.get('transaksi'),
          pembelian:       DB.get('pembelian'),
          mutasi:          DB.get('mutasi'),
          biaya:           DB.get('biaya'),
          pelanggan:       DB.get('pelanggan'),
          supplier:        DB.get('supplier'),
          sales:           DB.get('sales'),
          kurir:           DB.get('kurir'),
          kasir:           DB.get('kasir'),
          jenisPenjualan:  DB.get('jenisPenjualan'),
          metodePembayaran:DB.get('metodePembayaran'),
          kategoriBiaya:   DB.get('kategoriBiaya'),
          outlet:          DB.getObj('outlet'),
        }
      }
    });

    if (result.error) throw new Error(result.error);

    _lastSync = new Date();
    DB.setObj('lastSync', { time: _lastSync.toISOString(), status: 'ok' });
    _setSyncStatus('ok');
    showSyncToast('✓ Semua data berhasil disinkronkan!');
    return result;
  } catch (e) {
    _setSyncStatus('error');
    showSyncToast('✗ Push gagal: ' + e.message, 4000, true);
    throw e;
  } finally {
    _isSyncing = false;
  }
}

// ============================================================
// PULL ALL — ambil semua data dari GAS ke lokal
// ============================================================
async function pullAllFromSheet() {
  if (!GAS_URL) { showSyncToast('GAS_URL belum diisi!', 3000, true); return; }
  if (_isSyncing) { showSyncToast('Sync sedang berjalan...'); return; }

  _isSyncing = true;
  _setSyncStatus('syncing');
  showSyncToast('Mengambil data dari Google Sheet...', 0);

  try {
    const result = await gasRequest({ query: { action: 'pullAll' } });
    if (result.error) throw new Error(result.error);

    const data = result.data || {};
    // GAS returns 'produk' key, we store locally as 'products'
    const map = {
      produk:          'products',
      kategori:        'kategori',
      transaksi:       'transaksi',
      pembelian:       'pembelian',
      mutasi:          'mutasi',
      biaya:           'biaya',
      pelanggan:       'pelanggan',
      supplier:        'supplier',
      sales:           'sales',
      kurir:           'kurir',
      kasir:           'kasir',
      jenisPenjualan:  'jenisPenjualan',
      metodePembayaran:'metodePembayaran',
      kategoriBiaya:   'kategoriBiaya',
    };
    Object.entries(map).forEach(([gasKey, localKey]) => {
      if (data[gasKey] !== undefined) DB.set(localKey, data[gasKey]);
    });
    if (data.outlet) DB.setObj('outlet', data.outlet);

    _lastSync = new Date();
    DB.setObj('lastSync', { time: _lastSync.toISOString(), status: 'ok' });
    _setSyncStatus('ok');
    showSyncToast('✓ Data berhasil diambil dari Sheet!');

    // Refresh halaman aktif
    const hash = location.hash.replace('#', '');
    if (hash) switchScreen(hash);

    return result;
  } catch (e) {
    _setSyncStatus('error');
    showSyncToast('✗ Pull gagal: ' + e.message, 4000, true);
    throw e;
  } finally {
    _isSyncing = false;
  }
}

// ============================================================
// GENERATE LAPORAN MANUAL
// ============================================================
async function generateLaporanGAS() {
  showSyncToast('Generating laporan...', 0);
  try {
    const r = await gasRequest({ body: { action: 'generateLaporan' } });
    if (r.error) throw new Error(r.error);
    showSyncToast('✓ Laporan berhasil diperbarui!');
    return r;
  } catch (e) {
    showSyncToast('✗ Gagal: ' + e.message, 3000, true);
    throw e;
  }
}

// ============================================================
// UI HELPERS
// ============================================================
function showSyncToast(msg, duration = 2500, isError = false) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.background = isError ? 'rgba(231,76,60,0.9)' : 'rgba(0,0,0,0.75)';
  toast.classList.add('show');
  if (duration > 0) setTimeout(() => { toast.classList.remove('show'); toast.style.background = ''; }, duration);
}

function updateSyncIndicator() {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  const icons  = { idle:'☁', syncing:'↻', ok:'✓', error:'✗' };
  const colors = { idle:'#aaa', syncing:'#f39c12', ok:'#2ecc71', error:'#e74c3c' };
  el.textContent = icons[_syncStatus] || '☁';
  el.style.color = colors[_syncStatus] || '#aaa';
  el.title = _lastSync ? 'Sync: ' + _lastSync.toLocaleString('id-ID') : 'Belum sync';
}

function initSyncSettings() {
  const urlEl     = document.getElementById('sync-gas-url');
  const statusEl  = document.getElementById('sync-status-text');
  const lastSyncEl= document.getElementById('sync-last-time');
  if (urlEl) urlEl.value = GAS_URL || '';
  const ls = DB.getObj('lastSync');
  if (lastSyncEl && ls.time) lastSyncEl.textContent = new Date(ls.time).toLocaleString('id-ID');
  if (statusEl) {
    statusEl.textContent = GAS_URL ? 'Terkonfigurasi ✓' : 'Belum dikonfigurasi';
    statusEl.style.color = GAS_URL ? '#2ecc71' : '#f39c12';
  }
}

async function testKoneksiGAS() {
  showSyncToast('Mengecek koneksi...', 0);
  const r = await pingGAS();
  if (r.ok) showSyncToast('✓ Koneksi OK! ' + r.time);
  else showSyncToast('✗ Gagal: ' + r.error, 4000, true);
}

function simpanGASUrl() {
  const url = document.getElementById('sync-gas-url')?.value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    showSyncToast('URL tidak valid', 2000, true); return;
  }
  DB.setObj('gasConfig', { url });
  showSyncToast('✓ URL disimpan!');
  initSyncSettings();
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const ls = DB.getObj('lastSync');
  if (ls.time) { _lastSync = new Date(ls.time); _syncStatus = ls.status || 'idle'; }
  updateSyncIndicator();
});

document.addEventListener('screenInit', (e) => {
  if (e.detail.name === 'sync-settings') initSyncSettings();
});
