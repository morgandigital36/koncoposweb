// ===================================================
// BIAYA — Daftar & Tambah Biaya/Pendapatan
// ===================================================

function renderBiayaList() {
  const list = DB.get('biaya').sort((a, b) => b.createdAt - a.createdAt);
  const area = document.getElementById('biaya-list-area');
  if (!area) return;
  if (list.length === 0) {
    area.innerHTML = `<div class="pos-empty-state" style="flex-direction:column;gap:14px;">
      <i class="fa-solid fa-receipt" style="font-size:48px;color:#ddd;"></i>
      <p class="pos-empty-title">Belum ada data biaya</p>
      <button class="btn-simpan" onclick="switchScreen('tambah-biaya')" style="margin-top:8px;">Tambah Biaya</button>
    </div>`;
    return;
  }
  area.innerHTML = list.map(b => `
    <div class="mp-item">
      <div class="mp-item-photo" style="background:${b.tipe === 'pendapatan' ? '#e8f8f0' : '#fde8e8'};">
        <i class="fa-solid ${b.tipe === 'pendapatan' ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}"
           style="color:${b.tipe === 'pendapatan' ? '#2ecc71' : 'var(--danger)'};font-size:18px;"></i>
      </div>
      <div class="mp-item-info">
        <div class="mp-item-nama">${b.kategori || 'Tanpa Kategori'}</div>
        <div class="mp-item-sub">${b.tanggal}${b.keterangan ? ' · ' + b.keterangan : ''}</div>
        <div class="mp-item-harga" style="color:${b.tipe === 'pendapatan' ? '#2ecc71' : 'var(--danger)'};">
          ${b.tipe === 'pendapatan' ? '+' : '-'}${fmt(b.nominal)}
        </div>
      </div>
      <button class="mp-btn-del" onclick="hapusBiaya('${b.id}')">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');
}

function hapusBiaya(id) {
  if (!confirm('Hapus data biaya ini?')) return;
  DB.set('biaya', DB.get('biaya').filter(b => b.id !== id));
  autoSync('biaya', 'delete', null, id);
  renderBiayaList();
  showToast('Data dihapus');
}

function initTambahBiaya() {
  const today = new Date().toISOString().split('T')[0];
  setVal('biaya-tanggal', today);
  setVal('biaya-nominal', '');
  setVal('biaya-keterangan', '');
  const katEl = document.getElementById('biaya-kategori');
  if (katEl) katEl.value = '';
  const tipeEl = document.getElementById('biaya-tipe');
  if (tipeEl) tipeEl.value = 'biaya';
}

function simpanBiaya() {
  const nominal = parseFloat(document.getElementById('biaya-nominal')?.value) || 0;
  if (nominal <= 0) { showToast('Nominal harus lebih dari 0'); return; }
  const biaya = {
    id: 'b_' + Date.now(),
    tanggal: document.getElementById('biaya-tanggal')?.value || new Date().toISOString().split('T')[0],
    kategori: document.getElementById('biaya-kategori')?.value || '',
    nominal,
    tipe: document.getElementById('biaya-tipe')?.value || 'biaya',
    keterangan: document.getElementById('biaya-keterangan')?.value.trim() || '',
    createdAt: Date.now(),
  };
  const list = DB.get('biaya');
  list.push(biaya);
  DB.set('biaya', list);
  autoSync('biaya', 'create', biaya);
  showToast('Biaya disimpan!');
  switchScreen('biaya');
}

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  const { name } = e.detail;
  if (name === 'biaya') renderBiayaList();
  if (name === 'tambah-biaya') initTambahBiaya();
});
