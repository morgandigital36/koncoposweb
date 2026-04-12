// ===================================================
// PENGATURAN — CRUD lengkap semua master data
// ===================================================

// ===== OUTLET =====
function initOutlet() {
  const data = DB.getObj('outlet');
  setVal('outlet-nama', data.nama || '');
  setVal('outlet-alamat', data.alamat || '');
  setVal('outlet-telp', data.telp || '');
  setVal('outlet-email', data.email || '');
  setVal('outlet-catatan', data.catatan || '');
}
function simpanOutlet() {
  const data = {
    nama:    document.getElementById('outlet-nama')?.value.trim()    || '',
    alamat:  document.getElementById('outlet-alamat')?.value.trim()  || '',
    telp:    document.getElementById('outlet-telp')?.value.trim()    || '',
    email:   document.getElementById('outlet-email')?.value.trim()   || '',
    catatan: document.getElementById('outlet-catatan')?.value.trim() || '',
  };
  DB.setObj('outlet', data);
  // Sync outlet sebagai key-value pairs
  Object.entries(data).forEach(([k, v]) => autoSync('outlet', 'upsert', { key: k, value: v }, k));
  showToast('Data outlet disimpan!');
  switchScreen('pengaturan');
}

// ===== AKUN =====
function initAkun() {
  const data = DB.getObj('akun');
  setVal('akun-nama',     data.nama     || '');
  setVal('akun-username', data.username || '');
  setVal('akun-email',    data.email    || '');
  setVal('akun-telp',     data.telp     || '');
}
function simpanAkun() {
  const data = {
    nama:     document.getElementById('akun-nama')?.value.trim()     || '',
    username: document.getElementById('akun-username')?.value.trim() || '',
    email:    document.getElementById('akun-email')?.value.trim()    || '',
    telp:     document.getElementById('akun-telp')?.value.trim()     || '',
  };
  DB.setObj('akun', data);
  // Sync profil ke GAS (updateProfile endpoint)
  gasRequest({ body: { action: 'updateProfile', data } }).catch(() => {});
  showToast('Data akun disimpan!');
  switchScreen('pengaturan');
}

// ===== GANTI PASSWORD =====
function gantiPassword() {
  const baru       = document.getElementById('pw-baru')?.value       || '';
  const konfirmasi = document.getElementById('pw-konfirmasi')?.value || '';
  if (!baru)               { showToast('Password baru tidak boleh kosong'); return; }
  if (baru !== konfirmasi) { showToast('Konfirmasi password tidak cocok');  return; }
  if (baru.length < 4)     { showToast('Password minimal 4 karakter');     return; }
  DB.setObj('auth', { password: baru });
  // Sync password ke GAS
  gasRequest({ body: { action: 'updateProfile', data: { password: baru } } }).catch(() => {});
  showToast('Password berhasil diubah!');
  setVal('pw-lama', ''); setVal('pw-baru', ''); setVal('pw-konfirmasi', '');
  switchScreen('pengaturan');
}

// ===================================================
// ===== GENERIC KONTAK CRUD =====
// (supplier, pelanggan, sales, kurir, kasir)
// ===================================================

const KONTAK_LABELS = {
  supplier: 'Supplier', pelanggan: 'Pelanggan',
  sales: 'Sales', kurir: 'Kurir', kasir: 'Kasir',
};

const KONTAK_ICONS = {
  supplier: 'fa-truck-field', pelanggan: 'fa-user',
  sales: 'fa-user-tie', kurir: 'fa-motorcycle', kasir: 'fa-cash-register',
};

let _editKontakId   = null;
let _editKontakType = null;

// ---- Render list ----
function renderKontakList(type) {
  const list = DB.get(type);
  const container = document.getElementById(type + '-list');
  const countEl   = document.getElementById(type + '-count');
  if (!container) return;

  if (countEl) countEl.textContent = list.length + ' data';

  if (list.length === 0) {
    container.innerHTML = `<div class="pos-empty-state">
      <i class="fa-solid ${KONTAK_ICONS[type] || 'fa-user'}" style="font-size:52px;color:#ddd;margin-bottom:12px;"></i>
      <p class="pos-empty-title">Belum ada ${KONTAK_LABELS[type] || type}</p>
      <p class="pos-empty-sub">Tap tombol + untuk menambah</p>
    </div>`;
    return;
  }

  container.innerHTML = list.map(k => `
    <div class="crud-item" onclick="openFormKontakEdit('${type}','${k.id}')">
      <div class="crud-item-avatar">
        <i class="fa-solid ${KONTAK_ICONS[type] || 'fa-user'}"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${k.nama}</div>
        <div class="crud-item-sub">
          ${k.telp ? `<span><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${k.telp}</span>` : ''}
          ${k.email ? `<span><i class="fa-solid fa-envelope" style="font-size:10px;"></i> ${k.email}</span>` : ''}
          ${k.alamat ? `<span><i class="fa-solid fa-location-dot" style="font-size:10px;"></i> ${k.alamat}</span>` : ''}
          ${k.ket ? `<span style="color:var(--text-light);">${k.ket}</span>` : ''}
        </div>
      </div>
      <div class="crud-item-actions" onclick="event.stopPropagation()">
        <button class="crud-btn-edit" onclick="openFormKontakEdit('${type}','${k.id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="crud-btn-del" onclick="hapusKontak('${type}','${k.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

// ---- Filter/search ----
function filterKontak(type) {
  const query = document.getElementById(type + '-search')?.value.toLowerCase() || '';
  const list  = DB.get(type);
  const container = document.getElementById(type + '-list');
  if (!container) return;

  const filtered = query
    ? list.filter(k =>
        k.nama.toLowerCase().includes(query) ||
        (k.telp || '').includes(query) ||
        (k.email || '').toLowerCase().includes(query))
    : list;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="pos-empty-state">
      <p class="pos-empty-title">Tidak ditemukan</p>
      <p class="pos-empty-sub">"${query}" tidak ada dalam daftar</p>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(k => `
    <div class="crud-item" onclick="openFormKontakEdit('${type}','${k.id}')">
      <div class="crud-item-avatar">
        <i class="fa-solid ${KONTAK_ICONS[type] || 'fa-user'}"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${k.nama}</div>
        <div class="crud-item-sub">
          ${k.telp ? `<span><i class="fa-solid fa-phone" style="font-size:10px;"></i> ${k.telp}</span>` : ''}
          ${k.email ? `<span><i class="fa-solid fa-envelope" style="font-size:10px;"></i> ${k.email}</span>` : ''}
          ${k.alamat ? `<span><i class="fa-solid fa-location-dot" style="font-size:10px;"></i> ${k.alamat}</span>` : ''}
        </div>
      </div>
      <div class="crud-item-actions" onclick="event.stopPropagation()">
        <button class="crud-btn-edit" onclick="openFormKontakEdit('${type}','${k.id}')">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="crud-btn-del" onclick="hapusKontak('${type}','${k.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

// ---- Open form (create) ----
function openFormKontak(type) {
  _editKontakType = type;
  _editKontakId   = null;
  const title = document.getElementById(`form-${type}-title`);
  if (title) title.textContent = `Tambah ${KONTAK_LABELS[type] || type}`;
  // Clear fields
  ['nama','telp','email','alamat','ket'].forEach(f => setVal(`form-${type}-${f}`, ''));
  const modal = document.getElementById(`modal-kontak-${type}`);
  if (modal) modal.style.display = 'flex';
}

// ---- Open form (edit) ----
function openFormKontakEdit(type, id) {
  _editKontakType = type;
  _editKontakId   = id;
  const k = DB.get(type).find(x => x.id === id);
  if (!k) return;
  const title = document.getElementById(`form-${type}-title`);
  if (title) title.textContent = `Edit ${KONTAK_LABELS[type] || type}`;
  setVal(`form-${type}-nama`,   k.nama   || '');
  setVal(`form-${type}-telp`,   k.telp   || '');
  setVal(`form-${type}-email`,  k.email  || '');
  setVal(`form-${type}-alamat`, k.alamat || '');
  setVal(`form-${type}-ket`,    k.ket    || '');
  const modal = document.getElementById(`modal-kontak-${type}`);
  if (modal) modal.style.display = 'flex';
}

// ---- Close form ----
function tutupFormKontak(type) {
  const modal = document.getElementById(`modal-kontak-${type}`);
  if (modal) modal.style.display = 'none';
}

// ---- Save ----
function simpanFormKontak(type) {
  const nama = document.getElementById(`form-${type}-nama`)?.value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong'); return; }

  const kontak = {
    id:     _editKontakId || 'k_' + Date.now(),
    nama,
    telp:   document.getElementById(`form-${type}-telp`)?.value.trim()   || '',
    email:  document.getElementById(`form-${type}-email`)?.value.trim()  || '',
    alamat: document.getElementById(`form-${type}-alamat`)?.value.trim() || '',
    ket:    document.getElementById(`form-${type}-ket`)?.value.trim()    || '',
    createdAt: _editKontakId ? undefined : Date.now(),
    updatedAt: Date.now(),
  };

  const list = DB.get(type);
  if (_editKontakId) {
    const idx = list.findIndex(x => x.id === _editKontakId);
    if (idx !== -1) { kontak.createdAt = list[idx].createdAt; list[idx] = kontak; }
  } else {
    list.push(kontak);
  }
  DB.set(type, list);
  tutupFormKontak(type);
  renderKontakList(type);
  autoSync(type, _editKontakId ? 'update' : 'create', kontak, kontak.id);
  showToast(_editKontakId ? 'Data diperbarui!' : 'Data disimpan!');
}

// ---- Delete ----
function hapusKontak(type, id) {
  const k = DB.get(type).find(x => x.id === id);
  if (!k) return;
  if (!confirm(`Hapus "${k.nama}"?`)) return;
  DB.set(type, DB.get(type).filter(x => x.id !== id));
  autoSync(type, 'delete', null, id);
  renderKontakList(type);
  showToast('Data dihapus');
}

// Legacy aliases (used by keranjang modal pickers)
function openFormSupplier()  { openFormKontak('supplier');  }
function openFormPelanggan() { openFormKontak('pelanggan'); }
function openFormSales()     { openFormKontak('sales');     }
function openFormKurir()     { openFormKontak('kurir');     }
function openFormKasir()     { switchScreen('tambah-kasir'); }

function simpanKasirBaru() {
  const nama = document.getElementById('kasir-nama')?.value.trim();
  const telp = document.getElementById('kasir-telp')?.value.trim();
  const email = document.getElementById('kasir-email')?.value.trim();
  const username = document.getElementById('kasir-username')?.value.trim();
  const password = document.getElementById('kasir-password')?.value;
  const passwordConfirm = document.getElementById('kasir-password-confirm')?.value;
  
  if (!nama) { showToast('Nama wajib diisi'); return; }
  if (!username) { showToast('Username wajib diisi'); return; }
  if (password && password !== passwordConfirm) { showToast('Password tidak cocok'); return; }
  if (password && password.length < 6) { showToast('Password minimal 6 karakter'); return; }
  
  // Collect permissions
  const permissions = {
    ubahPOS: document.getElementById('perm-ubah-pos')?.checked || false,
    ubahHarga: document.getElementById('perm-ubah-harga')?.checked || false,
    ubahDiskon: document.getElementById('perm-ubah-diskon')?.checked || false,
    printDraft: document.getElementById('perm-print-draft')?.checked || false,
    master: document.getElementById('perm-master')?.checked || false,
    ubahTanggal: document.getElementById('perm-ubah-tanggal')?.checked || false,
    biaya: document.getElementById('perm-biaya')?.checked || false,
    ubahBiaya: document.getElementById('perm-ubah-biaya')?.checked || false,
    pembelian: document.getElementById('perm-pembelian')?.checked || false,
    printPembelian: document.getElementById('perm-print-pembelian')?.checked || false,
    laporan: document.getElementById('perm-laporan')?.checked || false,
    riwayat: document.getElementById('perm-riwayat')?.checked || false,
    rekapan: document.getElementById('perm-rekapan')?.checked || false,
    tambahProduk: document.getElementById('perm-tambah-produk')?.checked || false,
  };
  
  const kasir = {
    id: 'kasir_' + Date.now(),
    nama,
    telp,
    email,
    username,
    password: password || '',
    permissions,
    createdAt: Date.now(),
  };
  
  const list = DB.get('kasir');
  list.push(kasir);
  DB.set('kasir', list);
  autoSync('kasir', 'create', kasir);
  showToast('Kasir berhasil ditambahkan!');
  switchScreen('kasir');
}

// Legacy modal-kontak (global modal in index.html) — keep for keranjang picker
function tutupModalKontak() {
  const modal = document.getElementById('modal-kontak');
  if (modal) modal.style.display = 'none';
}
function simpanKontak() {
  const type = _editKontakType;
  if (!type) return;
  simpanFormKontak(type);
  tutupModalKontak();
}

// ===================================================
// ===== JENIS PENJUALAN CRUD =====
// ===================================================
let _editJenisIdx = null;

function _getJenisList() {
  const saved = DB.get('jenisPenjualan');
  return saved.length ? saved : ['Reguler', 'Grosir', 'Online'];
}

function renderJenisPenjualan() {
  const list = _getJenisList();
  const container = document.getElementById('jenis-penjualan-list');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = `<div class="pos-empty-state"><p class="pos-empty-title">Belum ada jenis penjualan</p></div>`;
    return;
  }
  container.innerHTML = list.map((k, i) => `
    <div class="crud-item">
      <div class="crud-item-avatar" style="background:var(--primary-light);">
        <i class="fa-solid fa-list-ul" style="color:var(--primary);"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${k}</div>
      </div>
      <div class="crud-item-actions">
        <button class="crud-btn-edit" onclick="bukaFormJenisPenjualan(${i})">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="crud-btn-del" onclick="hapusJenisPenjualan(${i})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function bukaFormJenisPenjualan(idx = null) {
  _editJenisIdx = idx;
  const list  = _getJenisList();
  const title = document.getElementById('form-jenis-title');
  if (title) title.textContent = idx !== null ? 'Edit Jenis Penjualan' : 'Tambah Jenis Penjualan';
  setVal('form-jenis-nama', idx !== null ? list[idx] : '');
  const modal = document.getElementById('modal-jenis-penjualan-form');
  if (modal) modal.style.display = 'flex';
}

function tutupFormJenisPenjualan() {
  const modal = document.getElementById('modal-jenis-penjualan-form');
  if (modal) modal.style.display = 'none';
}

function simpanJenisPenjualan() {
  const nama = document.getElementById('form-jenis-nama')?.value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong'); return; }
  const list = _getJenisList();
  const id = 'jp_' + (_editJenisIdx !== null ? _editJenisIdx : Date.now());
  if (_editJenisIdx !== null) list[_editJenisIdx] = nama;
  else list.push(nama);
  DB.set('jenisPenjualan', list);
  autoSync('jenisPenjualan', 'upsert', { id, nama });
  tutupFormJenisPenjualan();
  renderJenisPenjualan();
  showToast(_editJenisIdx !== null ? 'Diperbarui!' : 'Ditambahkan!');
}

function hapusJenisPenjualan(idx) {
  const list = _getJenisList();
  if (!confirm(`Hapus "${list[idx]}"?`)) return;
  const id = 'jp_' + idx;
  list.splice(idx, 1);
  DB.set('jenisPenjualan', list);
  autoSync('jenisPenjualan', 'delete', null, id);
  renderJenisPenjualan();
  showToast('Dihapus');
}

// ===================================================
// ===== METODE PEMBAYARAN CRUD =====
// ===================================================
let _editMetodeIdx = null;

function _getMetodeList() {
  const saved = DB.get('metodePembayaran');
  return saved.length ? saved : ['Tunai', 'Transfer', 'QRIS', 'Piutang'];
}

function renderMetodePembayaran() {
  const list = _getMetodeList();
  const container = document.getElementById('metode-pembayaran-list');
  if (!container) return;
  const icons = { Tunai: 'fa-money-bill-wave', Transfer: 'fa-building-columns', QRIS: 'fa-qrcode', Piutang: 'fa-file-invoice-dollar' };
  container.innerHTML = list.map((k, i) => `
    <div class="crud-item">
      <div class="crud-item-avatar" style="background:#e8f4fd;">
        <i class="fa-solid ${icons[k] || 'fa-credit-card'}" style="color:#3498db;"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${k}</div>
      </div>
      <div class="crud-item-actions">
        <button class="crud-btn-edit" onclick="bukaFormMetodePembayaran(${i})">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="crud-btn-del" onclick="hapusMetodePembayaran(${i})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function bukaFormMetodePembayaran(idx = null) {
  _editMetodeIdx = idx;
  const list  = _getMetodeList();
  const title = document.getElementById('form-metode-title');
  if (title) title.textContent = idx !== null ? 'Edit Metode Pembayaran' : 'Tambah Metode Pembayaran';
  setVal('form-metode-nama', idx !== null ? list[idx] : '');
  const modal = document.getElementById('modal-metode-form');
  if (modal) modal.style.display = 'flex';
}

function tutupFormMetodePembayaran() {
  const modal = document.getElementById('modal-metode-form');
  if (modal) modal.style.display = 'none';
}

function simpanMetodePembayaran() {
  const nama = document.getElementById('form-metode-nama')?.value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong'); return; }
  const list = _getMetodeList();
  const id = 'mp_' + (_editMetodeIdx !== null ? _editMetodeIdx : Date.now());
  if (_editMetodeIdx !== null) list[_editMetodeIdx] = nama;
  else list.push(nama);
  DB.set('metodePembayaran', list);
  autoSync('metodePembayaran', 'upsert', { id, nama });
  tutupFormMetodePembayaran();
  renderMetodePembayaran();
  showToast(_editMetodeIdx !== null ? 'Diperbarui!' : 'Ditambahkan!');
}

function hapusMetodePembayaran(idx) {
  const list = _getMetodeList();
  if (!confirm(`Hapus "${list[idx]}"?`)) return;
  const id = 'mp_' + idx;
  list.splice(idx, 1);
  DB.set('metodePembayaran', list);
  autoSync('metodePembayaran', 'delete', null, id);
  renderMetodePembayaran();
  showToast('Dihapus');
}

// ===================================================
// ===== KATEGORI BIAYA CRUD =====
// ===================================================
let _editKatBiayaIdx = null;

function getKategoriBiaya() {
  const saved = DB.get('kategoriBiaya');
  if (saved.length === 0) {
    const defaults = ['Operasional', 'Gaji', 'Listrik/Air', 'Sewa', 'Lainnya'];
    DB.set('kategoriBiaya', defaults);
    return defaults;
  }
  return saved;
}

function renderKategoriBiaya() {
  const list = getKategoriBiaya();
  const container = document.getElementById('kat-biaya-list');
  if (!container) return;
  container.innerHTML = list.map((k, i) => `
    <div class="crud-item">
      <div class="crud-item-avatar" style="background:#fde8e8;">
        <i class="fa-solid fa-receipt" style="color:var(--danger);"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${k}</div>
      </div>
      <div class="crud-item-actions">
        <button class="crud-btn-edit" onclick="bukaFormKategoriBiaya(${i})">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="crud-btn-del" onclick="hapusKategoriBiayaItem(${i})">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function bukaFormKategoriBiaya(idx = null) {
  _editKatBiayaIdx = idx;
  const list  = getKategoriBiaya();
  const title = document.getElementById('form-kat-biaya-title');
  if (title) title.textContent = idx !== null ? 'Edit Kategori' : 'Tambah Kategori';
  setVal('form-kat-biaya-nama', idx !== null ? list[idx] : '');
  const modal = document.getElementById('modal-kat-biaya-form');
  if (modal) modal.style.display = 'flex';
}

function tutupFormKategoriBiaya() {
  const modal = document.getElementById('modal-kat-biaya-form');
  if (modal) modal.style.display = 'none';
}

function simpanKategoriBiaya() {
  const nama = document.getElementById('form-kat-biaya-nama')?.value.trim();
  if (!nama) { showToast('Nama tidak boleh kosong'); return; }
  const list = getKategoriBiaya();
  const id = 'kb_' + (_editKatBiayaIdx !== null ? _editKatBiayaIdx : Date.now());
  if (_editKatBiayaIdx !== null) list[_editKatBiayaIdx] = nama;
  else {
    if (list.includes(nama)) { showToast('Kategori sudah ada'); return; }
    list.push(nama);
  }
  DB.set('kategoriBiaya', list);
  autoSync('kategoriBiaya', 'upsert', { id, nama });
  tutupFormKategoriBiaya();
  renderKategoriBiaya();
  showToast(_editKatBiayaIdx !== null ? 'Diperbarui!' : 'Ditambahkan!');
}

function hapusKategoriBiayaItem(idx) {
  const list = getKategoriBiaya();
  if (!confirm(`Hapus "${list[idx]}"?`)) return;
  const id = 'kb_' + idx;
  list.splice(idx, 1);
  DB.set('kategoriBiaya', list);
  autoSync('kategoriBiaya', 'delete', null, id);
  renderKategoriBiaya();
  showToast('Dihapus');
}

// ===== HAPUS DATA =====
function konfirmasiHapusData() {
  if (!confirm('PERINGATAN: Semua data akan dihapus permanen. Lanjutkan?')) return;
  if (!confirm('Yakin ingin menghapus semua data?')) return;
  localStorage.clear();
  showToast('Semua data telah dihapus');
  location.reload();
}

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  const { name } = e.detail;
  if (name === 'outlet')              initOutlet();
  if (name === 'akun')                initAkun();
  if (name === 'kategori-biaya')      renderKategoriBiaya();
  if (name === 'supplier')            renderKontakList('supplier');
  if (name === 'pelanggan')           renderKontakList('pelanggan');
  if (name === 'sales')               renderKontakList('sales');
  if (name === 'kurir')               renderKontakList('kurir');
  if (name === 'kasir')               renderKontakList('kasir');
  if (name === 'jenis-penjualan')     renderJenisPenjualan();
  if (name === 'metode-pembayaran')   renderMetodePembayaran();
  if (name === 'pengaturan-printer')  initPengaturanPrinter();
});
