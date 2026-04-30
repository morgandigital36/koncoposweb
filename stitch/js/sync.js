// ============================================================
// SYNC v2 - Sinkronisasi LocalStorage <-> Google Sheets
// ============================================================

const GAS_URL = 'https://script.google.com/macros/s/AKfycbwXxYKfCa4DsB6T4SRZnTun4JXF7uMEewpEkeINh6dxVnZPK9mJbP8yU4NHNHRW6Mh8/exec';

// ===== STATE =====
let _syncStatus  = 'idle';
let _lastSync    = null;
let _isSyncing   = false;
let _pendingSync = {};
let _autoSyncTimer = null;
let _editingGasUrlId = '';

function createGasConfigId() {
  return 'gas-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function normalizeGasConfig(rawConfig) {
  const config = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {};
  const rawUrls = Array.isArray(config.urls) ? config.urls : [];
  const legacyUrl = typeof config.url === 'string' ? config.url.trim() : '';
  const urls = rawUrls
    .map((item, index) => {
      const entry = (item && typeof item === 'object') ? item : {};
      const url = typeof entry.url === 'string' ? entry.url.trim() : '';
      if (!url) return null;
      return {
        id: entry.id || `${createGasConfigId()}-${index}`,
        name: (typeof entry.name === 'string' && entry.name.trim()) ? entry.name.trim() : `URL ${index + 1}`,
        url,
      };
    })
    .filter(Boolean);

  if (!urls.length && legacyUrl) {
    urls.push({
      id: 'default',
      name: (typeof config.name === 'string' && config.name.trim()) ? config.name.trim() : 'Default',
      url: legacyUrl,
    });
  }

  const activeId = urls.some(item => item.id === config.activeId)
    ? config.activeId
    : (urls[0]?.id || '');
  const activeItem = urls.find(item => item.id === activeId) || null;

  return {
    urls,
    activeId,
    url: activeItem?.url || legacyUrl || '',
  };
}

function getGasConfig() {
  return normalizeGasConfig(DB.getObj('gasConfig'));
}

function saveGasConfig(config) {
  const normalized = normalizeGasConfig(config);
  DB.setObj('gasConfig', normalized);
  return normalized;
}

function getActiveGasConfigItem() {
  const config = getGasConfig();
  return config.urls.find(item => item.id === config.activeId) || null;
}

function getGasWorkspaceLabel(item) {
  return item?.id ? `dbns::${item.id}` : 'default';
}

function getConfiguredGasUrl() {
  return getActiveGasConfigItem()?.url || GAS_URL || '';
}

function hasGasConfig() {
  return !!getActiveGasConfigItem()?.url || !!GAS_URL;
}

function normalizeMasterData(list) {
  return Array.isArray(list) ? list.map(item => typeof item === 'string' ? { id: '', nama: item } : item) : [];
}

function normalizePulledCollection(localKey, value) {
  const prefixes = {
    kategori: 'kat',
    jenisPenjualan: 'jp',
    metodePembayaran: 'mp',
    kategoriBiaya: 'kb',
  };
  const prefix = prefixes[localKey];
  if (!prefix) return Array.isArray(value) ? value : [];
  return normalizeNamedCollection(value, prefix);
}

// ============================================================
// CORE REQUEST - inject token otomatis
// ============================================================
async function gasRequest(params, customUrl = '') {
  const url = (customUrl || getConfiguredGasUrl() || '').trim();
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

async function pingGasUrl(customUrl) {
  try {
    const r = await gasRequest({ query: { action: 'ping' } }, customUrl);
    return { ok: r.status === 'ok', time: r.time };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function salinCodeGS() {
  showSyncToast('Mengambil file Code.gs...', 0);
  try {
    const res = await fetch('gas/Code.gs?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error('File Code.gs tidak ditemukan');
    const code = await res.text();
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard browser tidak tersedia');
    }
    await navigator.clipboard.writeText(code);
    showSyncToast('OK Code.gs berhasil disalin!');
  } catch (e) {
    showSyncToast('Gagal salin Code.gs: ' + e.message, 3500, true);
  }
}

// ============================================================
// SETUP
// ============================================================
async function setupGoogleSheet() {
  showSyncToast('Menyiapkan Google Sheet...', 0);
  try {
    const r = await gasRequest({ query: { action: 'setup' } });
    if (r.error) throw new Error(r.error);
    showSyncToast(`OK Setup selesai! ${r.created?.length || 0} sheet dibuat.`);
    return r;
  } catch (e) {
    showSyncToast('Gagal setup: ' + e.message, 3000, true);
    throw e;
  }
}
// ============================================================
// AUTO SYNC ENGINE - debounced, background
// ============================================================

// Daftar sheet yang perlu trigger generate laporan setelah sync
const LAPORAN_TRIGGER_SHEETS = new Set([
  'transaksi', 'pembelian', 'mutasi', 'biaya', 'produk'
]);

let _needGenerateLaporan = false;

function autoSync(sheetKey, action, data, id) {
  if (!hasGasConfig()) return;
  if (!_pendingSync[sheetKey]) _pendingSync[sheetKey] = [];
  _pendingSync[sheetKey].push({ action, data, id });

  // Tandai perlu generate laporan
  if (LAPORAN_TRIGGER_SHEETS.has(sheetKey)) _needGenerateLaporan = true;

  clearTimeout(_autoSyncTimer);
  _autoSyncTimer = setTimeout(_flushSync, 1500);
  _setSyncStatus('syncing');
}

async function _flushSync() {
  if (!hasGasConfig() || _isSyncing) return;
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
    let laporanFailed = false;
    if (_needGenerateLaporan) {
      _needGenerateLaporan = false;
      try {
        await gasRequest({ body: { action: 'generateLaporan' } });
      } catch (e) { /* silent - laporan bisa di-generate manual */ }
    }

    if (Object.keys(failed).length === 0) {
      _lastSync = new Date();
      DB.setObj('lastSync', { time: _lastSync.toISOString(), status: 'ok' });
      _setSyncStatus('ok');
    } else {
      _setSyncStatus('error');
    }
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
// PUSH ALL - kirim semua data lokal ke GAS sekaligus
// ============================================================
async function pushAllToSheet() {
  if (!hasGasConfig()) { showSyncToast('GAS_URL belum diisi!', 3000, true); return; }
  if (_isSyncing) { showSyncToast('Sync sedang berjalan...'); return; }

  _isSyncing = true;
  _setSyncStatus('syncing');
  showSyncToast('Mengirim semua data ke Google Sheet...', 0);

  try {
    const kategoriForGAS = getKategori();
    const jenisPenjualanForGAS = _getJenisList();
    const metodePembayaranForGAS = _getMetodeList();
    const kategoriBiayaForGAS = getKategoriBiaya();
    
    const result = await gasRequest({
      body: {
        action: 'pushAll',
        data: {
          produk:          DB.get('products'),      // GAS key: produk
          kategori:        kategoriForGAS,
          transaksi:       DB.get('transaksi'),
          pembelian:       DB.get('pembelian'),
          mutasi:          DB.get('mutasi'),
          biaya:           DB.get('biaya'),
          pelanggan:       DB.get('pelanggan'),
          supplier:        DB.get('supplier'),
          sales:           DB.get('sales'),
          kurir:           DB.get('kurir'),
          kasir:           DB.get('kasir'),
          jenisPenjualan:  jenisPenjualanForGAS,
          metodePembayaran:metodePembayaranForGAS,
          kategoriBiaya:   kategoriBiayaForGAS,
          outlet:          DB.getObj('outlet'),
        }
      }
    });

    if (result.error) throw new Error(result.error);

    _lastSync = new Date();
    DB.setObj('lastSync', { time: _lastSync.toISOString(), status: 'ok' });
    _setSyncStatus('ok');
    showSyncToast('OK Semua data berhasil disinkronkan!');
    return result;
  } catch (e) {
    _setSyncStatus('error');
    showSyncToast('Gagal push: ' + e.message, 4000, true);
    throw e;
  } finally {
    _isSyncing = false;
  }
}

// ============================================================
// PULL ALL - ambil semua data dari GAS ke lokal
// ============================================================
async function pullAllFromSheet() {
  if (!hasGasConfig()) { showSyncToast('GAS_URL belum diisi!', 3000, true); return; }
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
      if (data[gasKey] !== undefined) {
        let value = normalizePulledCollection(localKey, data[gasKey]);
        DB.set(localKey, value);
      }
    });
    if (data.outlet) DB.setObj('outlet', data.outlet);

    _lastSync = new Date();
    DB.setObj('lastSync', { time: _lastSync.toISOString(), status: 'ok' });
    _setSyncStatus('ok');
    showSyncToast('OK Data berhasil diambil dari Sheet!');

    // Refresh halaman aktif
    const hash = location.hash.replace('#', '');
    if (hash) switchScreen(hash);

    return result;
  } catch (e) {
    _setSyncStatus('error');
    showSyncToast('Gagal pull: ' + e.message, 4000, true);
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
    showSyncToast('OK Laporan berhasil diperbarui!');
    return r;
  } catch (e) {
    showSyncToast('Gagal: ' + e.message, 3000, true);
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
  const icons  = { idle:'\u2601', syncing:'\u21BB', ok:'OK', error:'X' };
  const colors = { idle:'#aaa', syncing:'#f39c12', ok:'#2ecc71', error:'#e74c3c' };
  el.textContent = icons[_syncStatus] || '\u2601';
  el.style.color = colors[_syncStatus] || '#aaa';
  el.title = _lastSync ? 'Sync: ' + _lastSync.toLocaleString('id-ID') : 'Belum sync';
}

function updateSyncIndicatorBig() {
  const el = document.getElementById('sync-indicator-big');
  if (!el) return;
  const icons  = { idle:'\u2601', syncing:'\u21BB', ok:'OK', error:'X' };
  const colors = { idle:'#aaa', syncing:'#f39c12', ok:'#2ecc71', error:'#e74c3c' };
  el.textContent = icons[_syncStatus] || '\u2601';
  el.style.color = colors[_syncStatus] || '#aaa';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateGasSaveButton() {
  const saveBtn = document.getElementById('sync-save-btn');
  if (saveBtn) saveBtn.textContent = _editingGasUrlId ? 'Update URL' : 'Tambah URL';
}

function resetGasUrlForm() {
  _editingGasUrlId = '';
  const nameEl = document.getElementById('sync-gas-name');
  const urlEl = document.getElementById('sync-gas-url');
  if (nameEl) nameEl.value = '';
  if (urlEl) urlEl.value = '';
  updateGasSaveButton();
}

function renderGasUrlList() {
  const listEl = document.getElementById('sync-gas-url-list');
  if (!listEl) return;

  const config = getGasConfig();
  if (!config.urls.length) {
    listEl.innerHTML = '<div class="sync-url-empty">Belum ada URL tersimpan. Tambahkan minimal satu URL untuk mulai sinkronisasi.</div>';
    return;
  }

  listEl.innerHTML = config.urls.map(item => {
    const isActive = item.id === config.activeId;
    return `
      <div class="sync-url-item ${isActive ? 'is-active' : ''}">
        <div class="sync-url-item-head">
          <div class="sync-url-item-title-wrap">
            <div class="sync-url-item-title">${escapeHtml(item.name)}</div>
            ${isActive ? '<span class="sync-url-badge">Aktif</span>' : ''}
          </div>
          <button class="sync-url-action sync-url-delete" type="button" onclick="hapusGASUrl('${item.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
        <div class="sync-url-item-link">${escapeHtml(item.url)}</div>
        <div class="sync-url-item-link">Workspace: <strong>${escapeHtml(getGasWorkspaceLabel(item))}</strong></div>
        <div class="sync-url-item-actions">
          <button class="sync-url-action" type="button" onclick="editGASUrl('${item.id}')">Edit</button>
          <button class="sync-url-action" type="button" onclick="testKoneksiGASTersimpan('${item.id}')">Tes</button>
          ${isActive
            ? '<button class="sync-url-action is-disabled" type="button" disabled>URL Aktif</button>'
            : `<button class="sync-url-action is-primary" type="button" onclick="pilihGASUrlAktif('${item.id}')">Jadikan Aktif</button>`}
        </div>
      </div>
    `;
  }).join('');
}

function pilihGASUrlAktif(id) {
  const config = getGasConfig();
  const target = config.urls.find(item => item.id === id);
  if (!target) return;
  const current = getActiveGasConfigItem();
  if (current?.id === id) return;
  config.activeId = id;
  saveGasConfig(config);
  showSyncToast('OK URL aktif diperbarui. Workspace outlet ikut berpindah.');
  setTimeout(() => location.reload(), 250);
}

function editGASUrl(id) {
  const item = getGasConfig().urls.find(entry => entry.id === id);
  if (!item) return;
  _editingGasUrlId = id;
  const nameEl = document.getElementById('sync-gas-name');
  const urlEl = document.getElementById('sync-gas-url');
  if (nameEl) nameEl.value = item.name || '';
  if (urlEl) urlEl.value = item.url || '';
  updateGasSaveButton();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function hapusGASUrl(id) {
  const config = getGasConfig();
  const target = config.urls.find(item => item.id === id);
  if (!target) return;
  if (!confirm(`Hapus URL "${target.name}"?`)) return;

  config.urls = config.urls.filter(item => item.id !== id);
  if (config.activeId === id) config.activeId = config.urls[0]?.id || '';
  saveGasConfig(config);
  if (_editingGasUrlId === id) resetGasUrlForm();
  showSyncToast('OK URL dihapus');
  initSyncSettings();
}

async function testKoneksiGASTersimpan(id) {
  const item = getGasConfig().urls.find(entry => entry.id === id);
  if (!item) return;
  showSyncToast(`Mengecek ${item.name}...`, 0);
  const r = await pingGasUrl(item.url);
  if (r.ok) showSyncToast(`OK ${item.name} terhubung! ${r.time}`);
  else showSyncToast(`Gagal menghubungkan ${item.name}: ${r.error}`, 4000, true);
}

function initSyncSettings() {
  const nameEl    = document.getElementById('sync-gas-name');
  const urlEl     = document.getElementById('sync-gas-url');
  const statusEl  = document.getElementById('sync-status-text');
  const lastSyncEl= document.getElementById('sync-last-time');
  const workspaceEl = document.getElementById('sync-active-workspace');
  const config    = getGasConfig();
  const active    = getActiveGasConfigItem();
  if (nameEl) nameEl.value = '';
  if (urlEl) urlEl.value = '';
  _editingGasUrlId = '';
  updateGasSaveButton();
  const ls = DB.getObj('lastSync');
  if (lastSyncEl && ls.time) lastSyncEl.textContent = new Date(ls.time).toLocaleString('id-ID');
  if (statusEl) {
    statusEl.textContent = active
      ? `Aktif: ${active.name} (OK)`
      : (config.urls.length ? 'Pilih URL aktif' : 'Belum dikonfigurasi');
    statusEl.style.color = active ? '#2ecc71' : '#f39c12';
  }
  if (workspaceEl) {
    workspaceEl.textContent = `Workspace lokal: ${getGasWorkspaceLabel(active)}`;
  }
  renderGasUrlList();
  updateSyncIndicatorBig();
}

async function testKoneksiGAS() {
  const typedUrl = document.getElementById('sync-gas-url')?.value.trim();
  const activeUrl = getActiveGasConfigItem()?.url || '';
  const targetUrl = typedUrl || activeUrl;
  if (!targetUrl) {
    showSyncToast('Isi atau pilih URL terlebih dahulu', 2500, true);
    return;
  }
  showSyncToast('Mengecek koneksi...', 0);
  const r = await pingGasUrl(targetUrl);
  if (r.ok) showSyncToast('OK Koneksi berhasil! ' + r.time);
  else showSyncToast('Gagal koneksi: ' + r.error, 4000, true);
}

function simpanGASUrl() {
  const name = document.getElementById('sync-gas-name')?.value.trim();
  const url = document.getElementById('sync-gas-url')?.value.trim();
  if (!url || !url.startsWith('https://script.google.com')) {
    showSyncToast('URL tidak valid', 2000, true); return;
  }
  const config = getGasConfig();
  const itemName = name || `URL ${config.urls.length + (_editingGasUrlId ? 0 : 1)}`;
  if (_editingGasUrlId) {
    config.urls = config.urls.map(item => item.id === _editingGasUrlId ? { ...item, name: itemName, url } : item);
    saveGasConfig(config);
    showSyncToast('OK URL diperbarui!');
  } else {
    const newItem = { id: createGasConfigId(), name: itemName, url };
    config.urls.push(newItem);
    if (!config.activeId) config.activeId = newItem.id;
    saveGasConfig(config);
    showSyncToast('OK URL ditambahkan!');
  }
  resetGasUrlForm();
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

