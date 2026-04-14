// ===================================================
// BIAYA — Daftar & Tambah Biaya/Pendapatan
// ===================================================

let _biayaTipe = 'biaya'; // default tipe

// ===== INIT BIAYA LIST =====
function initBiayaList() {
  // Set default date range (last 30 days)
  const sampai = new Date();
  const dari = new Date();
  dari.setDate(dari.getDate() - 30);
  
  document.getElementById('biaya-dari').value = dari.toISOString().split('T')[0];
  document.getElementById('biaya-sampai').value = sampai.toISOString().split('T')[0];
  
  filterBiayaByDate();
}

// ===== TOGGLE SEARCH =====
function toggleBiayaSearch() {
  const searchBar = document.getElementById('biaya-search-bar');
  if (searchBar.style.display === 'none') {
    searchBar.style.display = 'flex';
    document.getElementById('biaya-search-input').focus();
  } else {
    searchBar.style.display = 'none';
    document.getElementById('biaya-search-input').value = '';
    filterBiayaByDate();
  }
}

function clearBiayaSearch() {
  document.getElementById('biaya-search-input').value = '';
  filterBiayaByDate();
}

// ===== FILTER BY DATE =====
function filterBiayaByDate() {
  const dari = document.getElementById('biaya-dari')?.value;
  const sampai = document.getElementById('biaya-sampai')?.value;
  const searchQuery = document.getElementById('biaya-search-input')?.value.toLowerCase() || '';
  
  if (!dari || !sampai) return;
  
  const list = DB.get('biaya').filter(b => {
    const tgl = b.tanggal;
    const matchDate = tgl >= dari && tgl <= sampai;
    const matchSearch = !searchQuery || 
      (b.kategori || '').toLowerCase().includes(searchQuery) ||
      (b.keterangan || '').toLowerCase().includes(searchQuery);
    return matchDate && matchSearch;
  }).sort((a, b) => b.createdAt - a.createdAt);
  
  renderBiayaList(list);
}

function filterBiayaList() {
  filterBiayaByDate();
}

// ===== RENDER LIST =====
function renderBiayaList(list) {
  const area = document.getElementById('biaya-list-area');
  if (!area) return;
  
  // Calculate totals
  let totalBiaya = 0;
  let totalPendapatan = 0;
  list.forEach(b => {
    if (b.tipe === 'biaya') totalBiaya += Number(b.nominal || 0);
    else totalPendapatan += Number(b.nominal || 0);
  });
  
  // Update summary cards
  document.getElementById('biaya-total-biaya').textContent = fmt(totalBiaya);
  document.getElementById('biaya-total-pendapatan').textContent = fmt(totalPendapatan);
  
  if (list.length === 0) {
    area.innerHTML = `<div class="pos-empty-state" style="flex-direction:column;gap:14px;padding:40px 20px;">
      <i class="fa-solid fa-receipt" style="font-size:48px;color:#ddd;"></i>
      <p class="pos-empty-title">Data tidak ditemukan</p>
    </div>`;
    return;
  }
  
  area.innerHTML = list.map(b => `
    <div class="mp-item" style="padding:12px 16px;border-bottom:1px solid #f0f0f0;">
      <div class="mp-item-photo" style="width:44px;height:44px;border-radius:8px;background:${b.tipe === 'pendapatan' ? '#f0fdf4' : '#fef5f5'};display:flex;align-items:center;justify-content:center;">
        <i class="fa-solid ${b.tipe === 'pendapatan' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"
           style="color:${b.tipe === 'pendapatan' ? '#16a34a' : 'var(--danger)'};font-size:18px;"></i>
      </div>
      <div class="mp-item-info" style="flex:1;margin-left:12px;">
        <div class="mp-item-nama" style="font-size:14px;font-weight:600;color:var(--text-dark);margin-bottom:2px;">${b.kategori || 'Tanpa Kategori'}</div>
        <div class="mp-item-sub" style="font-size:12px;color:var(--text-light);">${formatTanggal(b.tanggal)}${b.keterangan ? ' · ' + b.keterangan : ''}</div>
        <div class="mp-item-harga" style="font-size:15px;font-weight:700;color:${b.tipe === 'pendapatan' ? '#16a34a' : 'var(--danger)'};margin-top:4px;">
          ${b.tipe === 'pendapatan' ? '+' : '-'}${fmt(b.nominal)}
        </div>
      </div>
      <button class="mp-btn-del" onclick="hapusBiaya('${b.id}')" style="width:36px;height:36px;border-radius:6px;background:#fef5f5;border:none;color:var(--danger);cursor:pointer;">
        <i class="fa-solid fa-trash" style="font-size:14px;"></i>
      </button>
    </div>`).join('');
}

function formatTanggal(tgl) {
  const d = new Date(tgl);
  const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

// ===== DELETE =====
function hapusBiaya(id) {
  if (!confirm('Hapus data biaya ini?')) return;
  DB.set('biaya', DB.get('biaya').filter(b => b.id !== id));
  autoSync('biaya', 'delete', null, id);
  filterBiayaByDate();
  showToast('Data dihapus');
}

// ===== INIT TAMBAH BIAYA =====
function initTambahBiaya() {
  _biayaTipe = 'biaya';
  
  // Set default date
  const today = new Date().toISOString().split('T')[0];
  setVal('biaya-tanggal', today);
  setVal('biaya-nominal', '');
  setVal('biaya-keterangan', '');
  
  // Load metode pembayaran
  const metodeList = _getMetodeList();
  const metodeEl = document.getElementById('biaya-metode');
  if (metodeEl) {
    metodeEl.innerHTML = metodeList.map(m => `<option value="${m}">${m}</option>`).join('');
    if (metodeList.length > 0) metodeEl.value = metodeList[0];
  }
  
  // Load kategori biaya
  const katList = getKategoriBiaya();
  const katEl = document.getElementById('biaya-kategori');
  if (katEl) {
    katEl.innerHTML = '<option value="">Pilih Kategori</option>' + 
      katList.map(k => `<option value="${k}">${k}</option>`).join('');
  }
  
  // Set default toggle
  const toggleEl = document.getElementById('biaya-masuk-laba-rugi');
  if (toggleEl) toggleEl.checked = true;
  
  // Update radio button UI
  updateBiayaRadioUI();
}

// ===== SET TIPE (BIAYA / PENDAPATAN) =====
function setBiayaTipe(tipe) {
  _biayaTipe = tipe;
  updateBiayaRadioUI();
}

function updateBiayaRadioUI() {
  const radioBiaya = document.getElementById('radio-biaya');
  const radioPendapatan = document.getElementById('radio-pendapatan');
  
  if (_biayaTipe === 'biaya') {
    radioBiaya?.classList.add('active');
    radioPendapatan?.classList.remove('active');
  } else {
    radioBiaya?.classList.remove('active');
    radioPendapatan?.classList.add('active');
  }
}

// ===== SIMPAN BIAYA =====
function simpanBiaya() {
  const metode = document.getElementById('biaya-metode')?.value;
  const kategori = document.getElementById('biaya-kategori')?.value;
  const nominal = parseFloat(document.getElementById('biaya-nominal')?.value) || 0;
  
  if (!metode) { showToast('Metode pembayaran wajib diisi'); return; }
  if (!kategori) { showToast('Kategori wajib diisi'); return; }
  if (nominal <= 0) { showToast('Nominal harus lebih dari 0'); return; }
  
  const biaya = {
    id: 'b_' + Date.now(),
    tanggal: document.getElementById('biaya-tanggal')?.value || new Date().toISOString().split('T')[0],
    metode,
    kategori,
    nominal,
    tipe: _biayaTipe,
    keterangan: document.getElementById('biaya-keterangan')?.value.trim() || '',
    masukLabaRugi: document.getElementById('biaya-masuk-laba-rugi')?.checked || false,
    createdAt: Date.now(),
  };
  
  const list = DB.get('biaya');
  list.push(biaya);
  DB.set('biaya', list);
  autoSync('biaya', 'create', biaya, biaya.id);
  showToast('Biaya disimpan!');
  switchScreen('biaya');
}

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  const { name } = e.detail;
  if (name === 'biaya') initBiayaList();
  if (name === 'tambah-biaya') initTambahBiaya();
});
