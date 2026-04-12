// ===================================================
// PRODUK — Master Produk, Tambah/Edit, Kategori
// ===================================================

function getProducts() { return DB.get('products'); }
function saveProducts(list) { DB.set('products', list); }

function getKategori() {
  const saved = DB.get('kategori');
  if (saved.length === 0) {
    const defaults = ['Makanan', 'Minuman', 'Snack', 'Lainnya'];
    DB.set('kategori', defaults);
    return defaults;
  }
  return saved;
}
function saveKategori(list) { DB.set('kategori', list); }

// ===== MASTER PRODUK =====
function renderMasterProduk() {
  const list = getProducts();
  const container = document.getElementById('master-produk-list');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = emptyState('fa-cube', 'Belum ada produk', 'Tap + untuk menambah produk');
    return;
  }
  container.innerHTML = list.map(p => `
    <div class="mp-item">
      <div class="mp-item-photo">
        ${p.foto ? `<img src="${p.foto}" alt="${p.nama}" />` : `<i class="fa-solid fa-cube"></i>`}
      </div>
      <div class="mp-item-info">
        <div class="mp-item-nama">${p.nama}</div>
        <div class="mp-item-sub">${p.kategori || '-'} · Stok: ${p.stok ?? p.stokAwal ?? 0} ${p.unit || 'Pcs'}</div>
        <div class="mp-item-harga">${fmt(p.hargaJual)}</div>
      </div>
      <div class="mp-item-actions">
        <button class="mp-btn-edit" onclick="switchScreen('tambah-produk', {id:'${p.id}'})">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="mp-btn-del" onclick="hapusProduk('${p.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function filterMasterProduk(query) {
  const list = getProducts();
  const container = document.getElementById('master-produk-list');
  if (!container) return;
  const filtered = query
    ? list.filter(p => p.nama.toLowerCase().includes(query.toLowerCase()) ||
        (p.kode || '').toLowerCase().includes(query.toLowerCase()))
    : list;
  if (filtered.length === 0) {
    container.innerHTML = emptyState('fa-cube',
      query ? 'Tidak ditemukan' : 'Belum ada produk',
      query ? `"${query}" tidak ditemukan` : 'Tap + untuk menambah produk');
    return;
  }
  container.innerHTML = filtered.map(p => `
    <div class="mp-item">
      <div class="mp-item-photo">
        ${p.foto ? `<img src="${p.foto}" alt="${p.nama}" />` : `<i class="fa-solid fa-cube"></i>`}
      </div>
      <div class="mp-item-info">
        <div class="mp-item-nama">${p.nama}</div>
        <div class="mp-item-sub">${p.kategori || '-'} · Stok: ${p.stok ?? p.stokAwal ?? 0} ${p.unit || 'Pcs'}</div>
        <div class="mp-item-harga">${fmt(p.hargaJual)}</div>
      </div>
      <div class="mp-item-actions">
        <button class="mp-btn-edit" onclick="switchScreen('tambah-produk', {id:'${p.id}'})">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button class="mp-btn-del" onclick="hapusProduk('${p.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </div>
    </div>`).join('');
}

function hapusProduk(id) {
  if (!confirm('Hapus produk ini?')) return;
  saveProducts(getProducts().filter(p => p.id !== id));
  autoSync('produk', 'delete', null, id);
  renderMasterProduk();
  showToast('Produk dihapus');
}

// ===== TAMBAH / EDIT PRODUK =====
let editProductId = null;
let productPhotoData = null;

function initTambahProduk(params = {}) {
  editProductId = params.id || null;
  productPhotoData = null;
  varianList = [];
  grosirList = [];
  const form = document.getElementById('formTambahProduk');
  if (form) form.reset();
  const preview = document.getElementById('tp-photo-preview');
  const iconWrap = document.getElementById('tp-photo-icon-wrap');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (iconWrap) iconWrap.style.display = 'flex';
  const title = document.getElementById('tp-topbar-title');
  if (title) title.textContent = editProductId ? 'Edit Produk' : 'Tambah Produk';
  populateKategoriSelect('tp-select-kategori');
  const toggle = document.getElementById('togglePantauStok');
  if (toggle) { toggle.checked = true; toggleStokFields(); }
  // Reset varian/grosir forms
  const varianForm = document.getElementById('varian-form');
  const grosirForm = document.getElementById('grosir-form');
  if (varianForm) varianForm.style.display = 'none';
  if (grosirForm) grosirForm.style.display = 'none';
  const varianIcon = document.getElementById('varian-btn-icon');
  const grosirIcon = document.getElementById('grosir-btn-icon');
  if (varianIcon) varianIcon.className = 'fa-solid fa-plus';
  if (grosirIcon) grosirIcon.className = 'fa-solid fa-plus';
  if (editProductId) {
    const p = getProducts().find(x => x.id === editProductId);
    if (p) fillTambahProdukForm(p);
  }
}

function populateKategoriSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cats = getKategori();
  const current = sel.value;
  sel.innerHTML = '<option value="">Pilih</option>' +
    cats.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
}

function fillTambahProdukForm(p) {
  setVal('tp-nama', p.nama || '');
  setVal('tp-varian', p.varian || '');
  setVal('tp-harga-beli', p.hargaBeli || 0);
  setVal('tp-harga-jual', p.hargaJual || 0);
  setVal('tp-diskon-pct', p.diskonPct || 0);
  setVal('tp-diskon-rp', p.diskonRp || 0);
  setVal('tp-kode', p.kode || '');
  setVal('tp-unit', p.unit || 'Pcs');
  setVal('tp-barcode', p.barcode || '');
  setVal('tp-keterangan', p.keterangan || '');
  setVal('tp-stok-minimal', p.stokMinimal || 0);
  setVal('tp-stok-awal', p.stokAwal || 0);
  setVal('tp-total-modal', p.totalModal || 0);
  const katSel = document.getElementById('tp-select-kategori');
  if (katSel && p.kategori) katSel.value = p.kategori;
  const tipeSel = document.getElementById('tp-select-tipe-modal');
  if (tipeSel && p.tipeModal) tipeSel.value = p.tipeModal;
  const toggle = document.getElementById('togglePantauStok');
  if (toggle) { toggle.checked = p.pantauStok !== false; toggleStokFields(); }
  if (p.foto) {
    productPhotoData = p.foto;
    const img = document.getElementById('tp-photo-preview');
    if (img) { img.src = p.foto; img.style.display = 'block'; }
    const wrap = document.getElementById('tp-photo-icon-wrap');
    if (wrap) wrap.style.display = 'none';
  }
  // Load varian & grosir
  if (p.varians && p.varians.length > 0) {
    varianList = [...p.varians];
    const varianForm = document.getElementById('varian-form');
    if (varianForm) varianForm.style.display = '';
    const varianIcon = document.getElementById('varian-btn-icon');
    if (varianIcon) varianIcon.className = 'fa-solid fa-minus';
    renderVarianList();
  }
  if (p.grosirs && p.grosirs.length > 0) {
    grosirList = [...p.grosirs];
    const grosirForm = document.getElementById('grosir-form');
    if (grosirForm) grosirForm.style.display = '';
    const grosirIcon = document.getElementById('grosir-btn-icon');
    if (grosirIcon) grosirIcon.className = 'fa-solid fa-minus';
    renderGrosirList();
  }
}

function simpanProduk() {
  const nama = (document.getElementById('tp-nama') || {}).value?.trim();
  if (!nama) { showToast('Nama produk wajib diisi!'); return; }
  const hargaBeli = parseFloat(document.getElementById('tp-harga-beli').value) || 0;
  const stokAwal  = parseFloat(document.getElementById('tp-stok-awal').value) || 0;
  const produk = {
    id: editProductId || 'p_' + Date.now(),
    nama,
    kategori: document.getElementById('tp-select-kategori').value,
    varian: document.getElementById('tp-varian').value.trim(),
    hargaBeli,
    hargaJual: parseFloat(document.getElementById('tp-harga-jual').value) || 0,
    diskonPct: parseFloat(document.getElementById('tp-diskon-pct').value) || 0,
    diskonRp: parseFloat(document.getElementById('tp-diskon-rp').value) || 0,
    kode: document.getElementById('tp-kode').value.trim(),
    unit: document.getElementById('tp-unit').value.trim() || 'Pcs',
    barcode: document.getElementById('tp-barcode').value.trim(),
    keterangan: document.getElementById('tp-keterangan').value.trim(),
    tipeModal: document.getElementById('tp-select-tipe-modal').value,
    pantauStok: document.getElementById('togglePantauStok').checked,
    stokMinimal: parseFloat(document.getElementById('tp-stok-minimal').value) || 0,
    stokAwal,
    totalModal: hargaBeli * stokAwal,
    stok: stokAwal,
    foto: productPhotoData || null,
    varians: getVarianData(),
    grosirs: getGrosirData(),
    createdAt: editProductId ? undefined : Date.now(),
    updatedAt: Date.now(),
  };
  const products = getProducts();
  if (editProductId) {
    const idx = products.findIndex(x => x.id === editProductId);
    if (idx !== -1) { produk.createdAt = products[idx].createdAt; products[idx] = produk; }
  } else {
    products.push(produk);
  }
  saveProducts(products);
  autoSync('produk', editProductId ? 'update' : 'create', produk, produk.id);
  showToast(editProductId ? 'Produk diperbarui!' : 'Produk disimpan!');
  switchScreen('master-produk');
}

function toggleStokFields() {
  const checked = document.getElementById('togglePantauStok').checked;
  const stokMinimal = document.getElementById('tp-stok-minimal');
  const stokAwalRow = document.getElementById('stokAwalRow');
  if (stokMinimal) { stokMinimal.disabled = !checked; stokMinimal.style.opacity = checked ? '1' : '0.4'; }
  if (stokAwalRow) {
    stokAwalRow.style.opacity = checked ? '1' : '0.4';
    stokAwalRow.querySelectorAll('input').forEach(i => i.disabled = !checked);
  }
}

function tambahKategoriCepat() {
  const nama = prompt('Nama kategori baru:');
  if (!nama?.trim()) return;
  const list = getKategori();
  if (list.includes(nama.trim())) { showToast('Kategori sudah ada'); return; }
  list.push(nama.trim());
  saveKategori(list);
  autoSync('kategori', 'create', { id: 'kat_'+Date.now(), nama: nama.trim() });
  populateKategoriSelect('tp-select-kategori');
  document.getElementById('tp-select-kategori').value = nama.trim();
  showToast(`Kategori "${nama.trim()}" ditambahkan`);
}

// ===== VARIAN HARGA =====
let varianList = [];

function toggleVarianForm() {
  const form = document.getElementById('varian-form');
  const icon = document.getElementById('varian-btn-icon');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : '';
  if (icon) icon.className = isOpen ? 'fa-solid fa-plus' : 'fa-solid fa-minus';
  if (!isOpen && varianList.length === 0) tambahBarisVarian();
}

function tambahBarisVarian() {
  varianList.push({ nama: '', hargaJual: 0, stok: 0 });
  renderVarianList();
}

function hapusBarisVarian(idx) {
  varianList.splice(idx, 1);
  renderVarianList();
}

function renderVarianList() {
  const container = document.getElementById('varian-list');
  if (!container) return;
  if (varianList.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-light);padding:8px 0;">Belum ada varian. Tap Tambah.</p>';
    return;
  }
  container.innerHTML = varianList.map((v, i) => `
    <div class="tp-sub-row">
      <input type="text" class="tp-sub-input" placeholder="Nama varian..." value="${v.nama}"
        oninput="varianList[${i}].nama=this.value" />
      <input type="number" class="tp-sub-input" placeholder="Harga jual" value="${v.hargaJual || ''}"
        oninput="varianList[${i}].hargaJual=parseFloat(this.value)||0" />
      <input type="number" class="tp-sub-input" placeholder="Stok" value="${v.stok || ''}"
        oninput="varianList[${i}].stok=parseFloat(this.value)||0" style="width:60px;" />
      <button type="button" class="tp-sub-del-btn" onclick="hapusBarisVarian(${i})">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');
}

function getVarianData() { return [...varianList]; }

// ===== HARGA GROSIR =====
let grosirList = [];

function toggleGrosirForm() {
  const form = document.getElementById('grosir-form');
  const icon = document.getElementById('grosir-btn-icon');
  if (!form) return;
  const isOpen = form.style.display !== 'none';
  form.style.display = isOpen ? 'none' : '';
  if (icon) icon.className = isOpen ? 'fa-solid fa-plus' : 'fa-solid fa-minus';
  if (!isOpen && grosirList.length === 0) tambahBarisGrosir();
}

function tambahBarisGrosir() {
  grosirList.push({ minQty: 1, hargaJual: 0 });
  renderGrosirList();
}

function hapusBarisGrosir(idx) {
  grosirList.splice(idx, 1);
  renderGrosirList();
}

function renderGrosirList() {
  const container = document.getElementById('grosir-list');
  if (!container) return;
  if (grosirList.length === 0) {
    container.innerHTML = '<p style="font-size:12px;color:var(--text-light);padding:8px 0;">Belum ada harga grosir. Tap Tambah.</p>';
    return;
  }
  container.innerHTML = grosirList.map((g, i) => `
    <div class="tp-sub-row">
      <input type="number" class="tp-sub-input" placeholder="Min qty" value="${g.minQty || ''}"
        oninput="grosirList[${i}].minQty=parseFloat(this.value)||0" style="flex:2;" />
      <input type="number" class="tp-sub-input" placeholder="Harga jual" value="${g.hargaJual || ''}"
        oninput="grosirList[${i}].hargaJual=parseFloat(this.value)||0" style="flex:3;" />
      <button type="button" class="tp-sub-del-btn" onclick="hapusBarisGrosir(${i})">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>`).join('');
}

function getGrosirData() { return [...grosirList]; }

// ===== KATEGORI PRODUK =====
function renderKategoriProduk() {
  const list = getKategori();
  const container = document.getElementById('kategori-list');
  if (!container) return;
  if (list.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:20px;">Belum ada kategori</p>';
    return;
  }
  container.innerHTML = list.map((k, i) => `
    <div class="list-item">
      <span>${k}</span>
      <div style="display:flex;gap:10px;align-items:center;">
        <i class="fa-solid fa-pen" style="color:var(--text-mid);cursor:pointer;" onclick="editKategori(${i})"></i>
        <i class="fa-solid fa-trash" style="color:var(--danger);cursor:pointer;" onclick="hapusKategori(${i})"></i>
      </div>
    </div>`).join('');
}

function tambahKategori() {
  const input = document.getElementById('input-kategori-baru');
  const nama = input.value.trim();
  if (!nama) { showToast('Nama kategori kosong'); return; }
  const list = getKategori();
  if (list.includes(nama)) { showToast('Kategori sudah ada'); return; }
  list.push(nama);
  saveKategori(list);
  autoSync('kategori', 'create', { id: 'kat_'+Date.now(), nama });
  input.value = '';
  renderKategoriProduk();
  showToast('Kategori ditambahkan');
}

function hapusKategori(idx) {
  const list = getKategori();
  const nama = list[idx];
  list.splice(idx, 1);
  saveKategori(list);
  autoSync('kategori', 'delete', null, 'kat_'+nama);
  renderKategoriProduk();
  showToast('Kategori dihapus');
}

function editKategori(idx) {
  const list = getKategori();
  const nama = prompt('Edit kategori:', list[idx]);
  if (!nama?.trim()) return;
  list[idx] = nama.trim();
  saveKategori(list);
  autoSync('kategori', 'upsert', { id: 'kat_'+idx, nama: nama.trim() });
  renderKategoriProduk();
  showToast('Kategori diperbarui');
}

// ===== FOTO PRODUK =====
let cameraStream = null;

function openPhotoOptions() {
  const modal = document.getElementById('modal-foto');
  if (modal) modal.style.display = 'flex';
}
function closePhotoModal() {
  const modal = document.getElementById('modal-foto');
  if (modal) modal.style.display = 'none';
}
function pilihDariGaleri() {
  closePhotoModal();
  document.getElementById('input-foto-file').click();
}
function handleFotoFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    productPhotoData = e.target.result;
    const img = document.getElementById('tp-photo-preview');
    if (img) { img.src = productPhotoData; img.style.display = 'block'; }
    const wrap = document.getElementById('tp-photo-icon-wrap');
    if (wrap) wrap.style.display = 'none';
  };
  reader.readAsDataURL(file);
}
function bukaKamera() {
  closePhotoModal();
  const modal = document.getElementById('modal-kamera');
  if (modal) modal.style.display = 'flex';
  startCamera('video-kamera');
}
async function startCamera(videoId) {
  const video = document.getElementById(videoId);
  if (!video) return;
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = cameraStream;
    video.play();
  } catch (e) {
    showToast('Kamera tidak dapat diakses: ' + e.message);
    tutupKamera();
  }
}
function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
}
function tutupKamera() {
  stopCamera();
  const modal = document.getElementById('modal-kamera');
  if (modal) modal.style.display = 'none';
}
function ambilFoto() {
  const video = document.getElementById('video-kamera');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 320;
  canvas.height = video.videoHeight || 240;
  canvas.getContext('2d').drawImage(video, 0, 0);
  productPhotoData = canvas.toDataURL('image/jpeg', 0.8);
  const img = document.getElementById('tp-photo-preview');
  if (img) { img.src = productPhotoData; img.style.display = 'block'; }
  const wrap = document.getElementById('tp-photo-icon-wrap');
  if (wrap) wrap.style.display = 'none';
  tutupKamera();
  showToast('Foto diambil');
}

// ===== BARCODE SCANNER =====
let scannerStream = null;
let scannerAnimFrame = null;
let scannerTarget = null;

async function openScanner(target = 'barcode') {
  scannerTarget = target;
  const modal = document.getElementById('modal-scanner');
  if (modal) modal.style.display = 'flex';
  const video = document.getElementById('video-scanner');
  try {
    scannerStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = scannerStream;
    video.play();
    video.onloadedmetadata = () => startScanLoop();
  } catch (e) {
    showToast('Kamera tidak dapat diakses: ' + e.message);
    closeScanner();
  }
}
function closeScanner() {
  if (scannerStream) { scannerStream.getTracks().forEach(t => t.stop()); scannerStream = null; }
  if (scannerAnimFrame) { cancelAnimationFrame(scannerAnimFrame); scannerAnimFrame = null; }
  const modal = document.getElementById('modal-scanner');
  if (modal) modal.style.display = 'none';
}
function startScanLoop() {
  const video = document.getElementById('video-scanner');
  const canvas = document.getElementById('canvas-scanner');
  const ctx = canvas.getContext('2d');
  function tick() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code','ean_13','ean_8','code_128','code_39','upc_a','upc_e'] });
        detector.detect(canvas).then(codes => {
          if (codes.length > 0) onBarcodeDetected(codes[0].rawValue);
        }).catch(() => {});
      }
    }
    scannerAnimFrame = requestAnimationFrame(tick);
  }
  tick();
}
function onBarcodeDetected(value) {
  closeScanner();
  if (scannerTarget === 'barcode') {
    const el = document.getElementById('tp-barcode');
    if (el) el.value = value;
    showToast('Barcode: ' + value);
  } else if (scannerTarget === 'pos-search') {
    const el = document.getElementById('posSearchInput');
    if (el) { el.value = value; filterPosProducts(); }
    showToast('Scan: ' + value);
  }
}
function scannerManualInput() {
  const val = prompt('Masukkan kode barcode/QR secara manual:');
  if (val?.trim()) onBarcodeDetected(val.trim());
}
function openPosCamera() { openScanner('pos-search'); }

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  const { name, params } = e.detail;
  if (name === 'master-produk') renderMasterProduk();
  if (name === 'tambah-produk') initTambahProduk(params);
  if (name === 'kategori-produk') renderKategoriProduk();
});
