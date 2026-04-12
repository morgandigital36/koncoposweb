// ============================================================
// AUTH — Login, Register, Session Management
// ============================================================

// ===== SESSION STATE =====
let _currentUser  = null;
let _sessionToken = null;

// ============================================================
// INIT — Cek session saat app dibuka
// ============================================================
async function initAuth() {
  const saved = DB.getObj('session');
  if (saved.token && saved.user) {
    _sessionToken = saved.token;
    _currentUser  = saved.user;
    // Verifikasi token ke GAS
    try {
      const result = await authRequest({ query: { action: 'profile' } });
      if (result.error || result.code === 401) {
        _clearSession();
        switchScreen('login');
        return;
      }
      _currentUser = result.user;
      _saveSession(_sessionToken, _currentUser);
      _onLoginSuccess();
    } catch (e) {
      // Offline — pakai session lokal
      _onLoginSuccess();
    }
  } else {
    switchScreen('login');
  }
}

function _onLoginSuccess() {
  // Update outlet dari user data
  const outlet = DB.getObj('outlet');
  if (!outlet.nama && _currentUser?.namaUsaha) {
    DB.setObj('outlet', {
      ...outlet,
      nama: _currentUser.namaUsaha,
      jenisUsaha: _currentUser.jenisUsaha || '',
    });
  }
  // Tampilkan nama usaha di topbar beranda
  const titleEl = document.querySelector('#screen-beranda .topbar-title');
  if (titleEl && _currentUser?.namaUsaha) titleEl.textContent = _currentUser.namaUsaha;

  switchScreen('beranda');
}

// ============================================================
// LOGIN
// ============================================================
async function doLogin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('btn-login');

  if (!email || !password) {
    _showAuthError(errEl, 'Email dan password wajib diisi');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memproses...';
  _hideAuthError(errEl);

  try {
    const result = await gasRequest({
      body: { action: 'login', email, password }
    });

    if (result.error) {
      _showAuthError(errEl, result.error);
      return;
    }

    _sessionToken = result.token;
    _currentUser  = result.user;
    _saveSession(result.token, result.user);

    showToast('✓ ' + result.message);

    // Pull data user dari sheet
    try {
      showToast('Memuat data...', 3000);
      const pullResult = await authRequest({ query: { action: 'pullAll' } });
      if (pullResult.status === 'ok') _applyPulledData(pullResult.data);
    } catch (e) { /* offline, pakai data lokal */ }

    _onLoginSuccess();
  } catch (e) {
    _showAuthError(errEl, 'Koneksi gagal: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-right-to-bracket" style="margin-right:6px;"></i>Masuk';
  }
}

// ============================================================
// REGISTER
// ============================================================
async function doRegister() {
  const nama       = document.getElementById('reg-nama')?.value.trim();
  const namaUsaha  = document.getElementById('reg-usaha')?.value.trim();
  const jenisUsaha = document.getElementById('reg-jenis')?.value;
  const telp       = document.getElementById('reg-telp')?.value.trim();
  const email      = document.getElementById('reg-email')?.value.trim();
  const password   = document.getElementById('reg-password')?.value;
  const konfirmasi = document.getElementById('reg-konfirmasi')?.value;
  const errEl      = document.getElementById('register-error');
  const btn        = document.getElementById('btn-register');

  // Validasi client-side
  if (!nama)       { _showAuthError(errEl, 'Nama lengkap wajib diisi'); return; }
  if (!namaUsaha)  { _showAuthError(errEl, 'Nama usaha wajib diisi'); return; }
  if (!jenisUsaha) { _showAuthError(errEl, 'Pilih jenis usaha'); return; }
  if (!email)      { _showAuthError(errEl, 'Email wajib diisi'); return; }
  if (!password)   { _showAuthError(errEl, 'Password wajib diisi'); return; }
  if (password.length < 6) { _showAuthError(errEl, 'Password minimal 6 karakter'); return; }
  if (password !== konfirmasi) { _showAuthError(errEl, 'Konfirmasi password tidak cocok'); return; }

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mendaftar...';
  _hideAuthError(errEl);

  try {
    const result = await gasRequest({
      body: { action: 'register', namaLengkap: nama, namaUsaha, jenisUsaha, telp, email, password }
    });

    if (result.error) {
      _showAuthError(errEl, result.error);
      return;
    }

    _sessionToken = result.token;
    _currentUser  = result.user;
    _saveSession(result.token, result.user);

    showToast('✓ ' + result.message);
    _onLoginSuccess();
  } catch (e) {
    _showAuthError(errEl, 'Koneksi gagal: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus" style="margin-right:6px;"></i>Daftar Sekarang';
  }
}

// ============================================================
// LOGOUT
// ============================================================
async function doLogout() {
  if (!confirm('Yakin ingin keluar?')) return;
  try {
    await authRequest({ body: { action: 'logout' } });
  } catch (e) { /* ignore */ }
  _clearSession();
  showToast('Berhasil keluar');
  switchScreen('login');
}

// ============================================================
// HELPERS
// ============================================================
function getToken()       { return _sessionToken; }
function getCurrentUser() { return _currentUser; }
function isLoggedIn()     { return !!_sessionToken && !!_currentUser; }

function _saveSession(token, user) {
  DB.setObj('session', { token, user, savedAt: Date.now() });
}

function _clearSession() {
  _sessionToken = null;
  _currentUser  = null;
  DB.setObj('session', {});
  // Hapus semua data lokal
  const keysToKeep = ['gasConfig', 'printer'];
  const allKeys = Object.keys(localStorage);
  allKeys.forEach(k => { if (!keysToKeep.includes(k)) localStorage.removeItem(k); });
}

function _applyPulledData(data) {
  if (!data) return;
  // GAS returns 'produk', stored locally as 'products'
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
}

function _showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function _hideAuthError(el) {
  if (!el) return;
  el.style.display = 'none';
}

function togglePw(inputId, icon) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash auth-pw-toggle';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye auth-pw-toggle';
  }
}

// Helper: request dengan token otomatis
async function authRequest(params) {
  if (!params.body) params.body = {};
  if (!params.query) params.query = {};
  // Inject token jika sudah login
  if (_sessionToken) {
    if (params.body && Object.keys(params.body).length > 0) {
      if (!params.body.token) params.body.token = _sessionToken;
    }
    if (params.query && Object.keys(params.query).length > 0) {
      if (!params.query.token) params.query.token = _sessionToken;
    }
  }
  return gasRequest(params);
}
