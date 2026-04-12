// ===================================================
// LAPORAN — Semua fungsi render laporan
// ===================================================

// _lastTrx is defined in pos.js — accessible globally

// ===== HELPER: FILTER TANGGAL =====
function laporanInRange(tglStr, filter) {
  const d = new Date(tglStr);
  const now = new Date();
  if (filter === 'hari') return d.toDateString() === now.toDateString();
  if (filter === 'minggu') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (filter === 'bulan') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (filter === 'tahun') return d.getFullYear() === now.getFullYear();
  return true; // semua
}

function fmtTgl(tglStr) {
  return new Date(tglStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTglWaktu(tglStr) {
  return new Date(tglStr).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ===== KARTU RINGKASAN =====
function summaryCard(items) {
  return `<div class="laporan-summary-grid">${items.map(i => `
    <div class="laporan-summary-item">
      <div class="laporan-summary-label">${i.label}</div>
      <div class="laporan-summary-value" style="color:${i.color || 'var(--text-dark)'};">${i.value}</div>
    </div>`).join('')}</div>`;
}

// ===== TABEL LAPORAN =====
function laporanTable(headers, rows, emptyMsg = 'Tidak ada data') {
  if (rows.length === 0) {
    return `<div class="pos-empty-state" style="padding:40px 20px;">
      <i class="fa-solid fa-inbox" style="font-size:40px;color:#ddd;margin-bottom:8px;"></i>
      <p class="pos-empty-title">${emptyMsg}</p>
    </div>`;
  }
  return `<div class="laporan-table-wrap">
    <table class="laporan-table">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  </div>`;
}

// ===================================================
// 1. LAPORAN PENJUALAN — dengan CRUD (hapus transaksi)
// ===================================================
function renderLaporanPenjualan() {
  const filter = document.getElementById('lp-filter')?.value || 'bulan';
  const body = document.getElementById('laporan-penjualan-body');
  if (!body) return;

  const trxList = DB.get('transaksi').filter(t => laporanInRange(t.tanggal, filter));
  const lunas = trxList.filter(t => t.metodePembayaran !== 'Piutang');
  const piutang = trxList.filter(t => t.metodePembayaran === 'Piutang');
  const totalPenjualan = trxList.reduce((s, t) => s + t.total, 0);
  const totalLunas = lunas.reduce((s, t) => s + t.total, 0);
  const totalPiutang = piutang.reduce((s, t) => s + t.total, 0);

  if (trxList.length === 0) {
    body.innerHTML = summaryCard([
      { label: 'Total Invoice', value: 0 },
      { label: 'Total Penjualan', value: fmt(0), color: '#2ecc71' },
    ]) + `<div class="pos-empty-state"><p class="pos-empty-title">Belum ada transaksi</p></div>`;
    return;
  }

  const rows = trxList
    .sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal))
    .map(t => {
      const tgl = fmtTglWaktu(t.tanggal);
      const statusColor = t.metodePembayaran === 'Piutang' ? 'var(--danger)' : '#2ecc71';
      const statusLabel = t.metodePembayaran === 'Piutang' ? 'Piutang' : 'Lunas';
      return `
      <div class="crud-item" style="margin-bottom:8px;">
        <div class="crud-item-avatar" style="background:${t.metodePembayaran === 'Piutang' ? '#fff8e1' : '#e8f8f0'};">
          <i class="fa-solid fa-receipt" style="color:${statusColor};font-size:16px;"></i>
        </div>
        <div class="crud-item-info">
          <div class="crud-item-nama">${t.pelanggan || 'Umum'} · ${t.items.length} item</div>
          <div class="crud-item-sub">
            <span>${tgl}</span>
            <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:2px;">${fmt(t.total)}</div>
        </div>
        <div class="crud-item-actions">
          <button class="crud-btn-edit" onclick="lihatDetailTransaksi('${t.id}')">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="crud-btn-del" onclick="hapusTransaksi('${t.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>`;
    }).join('');

  body.innerHTML = summaryCard([
    { label: 'Total Invoice', value: trxList.length, color: 'var(--text-dark)' },
    { label: 'Total Penjualan', value: fmt(totalPenjualan), color: '#2ecc71' },
    { label: 'Lunas', value: fmt(totalLunas), color: '#2ecc71' },
    { label: 'Piutang', value: fmt(totalPiutang), color: 'var(--danger)' },
  ]) + `<div style="margin-top:4px;">${rows}</div>`;
}

function hapusTransaksi(id) {
  const trx = DB.get('transaksi').find(t => t.id === id);
  if (!trx) return;
  const tgl = new Date(trx.tanggal).toLocaleDateString('id-ID');
  if (!confirm(`Hapus transaksi ${tgl} - ${fmt(trx.total)}?`)) return;
  DB.set('transaksi', DB.get('transaksi').filter(t => t.id !== id));
  autoSync('transaksi', 'delete', null, id);
  renderLaporanPenjualan();
  showToast('Transaksi dihapus');
}

function lihatDetailTransaksi(id) {
  const trx = DB.get('transaksi').find(t => t.id === id);
  if (!trx) return;
  // Re-render struk for this transaction
  _lastTrx = trx;
  switchScreen('struk').then(() => renderStruk(trx));
}

// ===================================================
// 2. PRODUK TERJUAL
// ===================================================
function renderLaporanProdukTerjual() {
  const filter = document.getElementById('lpt-filter')?.value || 'bulan';
  const body = document.getElementById('laporan-produk-terjual-body');
  if (!body) return;

  const trxList = DB.get('transaksi').filter(t => laporanInRange(t.tanggal, filter));

  // Aggregate per produk
  const produkMap = {};
  trxList.forEach(t => {
    t.items.forEach(item => {
      if (!produkMap[item.nama]) produkMap[item.nama] = { qty: 0, total: 0 };
      produkMap[item.nama].qty += item.qty;
      produkMap[item.nama].total += item.qty * item.harga;
    });
  });

  const sorted = Object.entries(produkMap).sort((a, b) => b[1].qty - a[1].qty);
  const totalQty = sorted.reduce((s, [, v]) => s + v.qty, 0);
  const totalNominal = sorted.reduce((s, [, v]) => s + v.total, 0);

  const rows = sorted.map(([nama, v]) => [
    nama,
    v.qty,
    fmt(v.total),
    `<span style="font-size:11px;color:var(--text-light);">${totalNominal > 0 ? ((v.total / totalNominal) * 100).toFixed(1) + '%' : '0%'}</span>`
  ]);

  body.innerHTML = summaryCard([
    { label: 'Jenis Produk', value: sorted.length },
    { label: 'Total Qty Terjual', value: totalQty },
    { label: 'Total Nominal', value: fmt(totalNominal), color: '#2ecc71' },
  ]) + laporanTable(
    ['Produk', 'Qty', 'Nominal', 'Porsi'],
    rows,
    'Belum ada produk terjual'
  );
}

// ===================================================
// 3. PIUTANG PELANGGAN
// ===================================================
function renderLaporanPiutang() {
  const body = document.getElementById('laporan-piutang-body');
  if (!body) return;

  const query = document.getElementById('piutang-search')?.value.toLowerCase() || '';
  const trxList = DB.get('transaksi').filter(t => t.metodePembayaran === 'Piutang' && !t.lunas);

  // Group by pelanggan (atau per invoice jika tidak ada pelanggan)
  const grouped = {};
  trxList.forEach(t => {
    const key = t.pelanggan || 'Umum';
    if (!grouped[key]) grouped[key] = { invoices: 0, total: 0 };
    grouped[key].invoices++;
    grouped[key].total += t.total;
  });

  let entries = Object.entries(grouped);
  if (query) entries = entries.filter(([k]) => k.toLowerCase().includes(query));

  if (entries.length === 0) {
    body.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:40px 0;font-size:14px;">Data tidak ditemukan</p>`;
    return;
  }

  body.innerHTML = entries.map(([nama, v], i) => `
    <div class="laporan-row-item" onclick="showToast('${nama}: ${v.invoices} invoice')">
      <span class="laporan-col-no">${i + 1}</span>
      <span class="laporan-col-main">${nama}</span>
      <span class="laporan-col-mid">${v.invoices}</span>
      <span class="laporan-col-right" style="color:var(--danger);font-weight:600;">${fmt(v.total)}</span>
    </div>`).join('');
}

function lunaskanPiutangLaporan(id) {
  const list = DB.get('transaksi');
  const idx = list.findIndex(t => t.id === id);
  if (idx !== -1) { list[idx].lunas = true; DB.set('transaksi', list); autoSync('transaksi', 'update', list[idx], id); }
  renderLaporanPiutang();
  showToast('Piutang dilunasi!');
}

// ===================================================
// 4. LAPORAN PEMBELIAN
// ===================================================
function renderLaporanPembelian() {
  const filter = document.getElementById('lpb-filter')?.value || 'bulan';
  const body = document.getElementById('laporan-pembelian-body');
  if (!body) return;

  const list = DB.get('pembelian').filter(b => laporanInRange(b.tanggal, filter));
  const totalBeli = list.reduce((s, b) => s + b.total, 0);
  const lunas = list.filter(b => b.status === 'lunas');
  const hutang = list.filter(b => b.status === 'hutang');

  const rows = list
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(b => [
      fmtTgl(b.tanggal),
      b.produkNama || '-',
      b.jumlah + ' ' + (b.unit || 'Pcs'),
      fmt(b.harga || 0),
      fmt(b.total),
      `<span style="color:${b.status === 'lunas' ? '#2ecc71' : 'var(--danger)'};font-weight:600;">${b.status === 'lunas' ? 'Lunas' : 'Hutang'}</span>`
    ]);

  body.innerHTML = summaryCard([
    { label: 'Total Transaksi', value: list.length },
    { label: 'Total Pembelian', value: fmt(totalBeli), color: 'var(--danger)' },
    { label: 'Lunas', value: lunas.length, color: '#2ecc71' },
    { label: 'Hutang', value: hutang.length, color: 'var(--danger)' },
  ]) + laporanTable(
    ['Tanggal', 'Produk', 'Qty', 'Harga', 'Total', 'Status'],
    rows,
    'Belum ada data pembelian'
  );
}

// ===================================================
// 5. HUTANG SUPPLIER
// ===================================================
function renderLaporanHutangSupplier() {
  const body = document.getElementById('laporan-hutang-body');
  if (!body) return;

  const query = document.getElementById('hutang-search')?.value.toLowerCase() || '';
  const hutangList = DB.get('pembelian').filter(b => b.status === 'hutang');

  // Group by supplier
  const grouped = {};
  hutangList.forEach(b => {
    const key = b.supplierNama || b.supplierId || 'Tanpa Supplier';
    if (!grouped[key]) grouped[key] = { invoices: 0, total: 0 };
    grouped[key].invoices++;
    grouped[key].total += b.total;
  });

  let entries = Object.entries(grouped);
  if (query) entries = entries.filter(([k]) => k.toLowerCase().includes(query));

  if (entries.length === 0) {
    body.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:40px 0;font-size:14px;">Data tidak ditemukan</p>`;
    return;
  }

  body.innerHTML = entries.map(([nama, v], i) => `
    <div class="laporan-row-item" onclick="showToast('${nama}: ${v.invoices} invoice')">
      <span class="laporan-col-no">${i + 1}</span>
      <span class="laporan-col-main">${nama}</span>
      <span class="laporan-col-mid">${v.invoices}</span>
      <span class="laporan-col-right" style="color:var(--danger);font-weight:600;">${fmt(v.total)}</span>
    </div>`).join('');
}

function bayarHutangLaporan(id) {
  const list = DB.get('pembelian');
  const idx = list.findIndex(b => b.id === id);
  if (idx !== -1) { list[idx].status = 'lunas'; DB.set('pembelian', list); autoSync('pembelian', 'update', list[idx], id); }
  renderLaporanHutangSupplier();
  showToast('Hutang dilunasi!');
}

// ===================================================
// 6. PERSEDIAAN STOK
// ===================================================
function renderLaporanPersediaan() {
  const query = document.getElementById('lpers-search')?.value.toLowerCase() || '';
  const body = document.getElementById('laporan-persediaan-body');
  if (!body) return;

  let products = getProducts();
  if (query) products = products.filter(p => p.nama.toLowerCase().includes(query));

  const totalNilai = products.reduce((s, p) => s + (p.stok ?? 0) * (p.hargaBeli || 0), 0);
  const stokHabis = products.filter(p => (p.stok ?? 0) <= 0).length;
  const stokMinimal = products.filter(p => (p.stok ?? 0) > 0 && (p.stok ?? 0) <= (p.stokMinimal || 0)).length;

  const rows = products
    .sort((a, b) => (a.stok ?? 0) - (b.stok ?? 0))
    .map(p => {
      const stok = p.stok ?? p.stokAwal ?? 0;
      const min = p.stokMinimal || 0;
      let stokColor = 'var(--text-dark)';
      if (stok <= 0) stokColor = 'var(--danger)';
      else if (stok <= min) stokColor = '#f39c12';
      return [
        p.nama,
        p.kategori || '-',
        `<span style="font-weight:700;color:${stokColor};">${stok}</span> ${p.unit || 'Pcs'}`,
        min > 0 ? min : '-',
        fmt(p.hargaBeli || 0),
        fmt(stok * (p.hargaBeli || 0))
      ];
    });

  body.innerHTML = summaryCard([
    { label: 'Total Produk', value: products.length },
    { label: 'Stok Habis', value: stokHabis, color: stokHabis > 0 ? 'var(--danger)' : '#2ecc71' },
    { label: 'Stok Minim', value: stokMinimal, color: stokMinimal > 0 ? '#f39c12' : '#2ecc71' },
    { label: 'Nilai Stok', value: fmt(totalNilai), color: 'var(--primary)' },
  ]) + laporanTable(
    ['Produk', 'Kategori', 'Stok', 'Min', 'H.Beli', 'Nilai'],
    rows,
    'Belum ada produk'
  );
}

// ===================================================
// 7. MUTASI STOK
// ===================================================
function initMutasiDates() {
  const today = new Date().toISOString().split('T')[0];
  const dariEl = document.getElementById('mutasi-dari');
  const sampaiEl = document.getElementById('mutasi-sampai');
  if (dariEl && !dariEl.value) dariEl.value = today;
  if (sampaiEl && !sampaiEl.value) sampaiEl.value = today;
}

function toggleMutasiSearch() {
  const bar = document.getElementById('mutasi-search-bar');
  if (bar) bar.style.display = bar.style.display === 'none' ? '' : 'none';
}

function renderLaporanMutasiStok() {
  const body = document.getElementById('laporan-mutasi-body');
  if (!body) return;

  const dari = document.getElementById('mutasi-dari')?.value;
  const sampai = document.getElementById('mutasi-sampai')?.value;
  const query = document.getElementById('mutasi-search')?.value.toLowerCase() || '';

  let list = DB.get('mutasi');

  // Filter by date range
  if (dari) list = list.filter(m => m.tanggal >= dari);
  if (sampai) list = list.filter(m => m.tanggal <= sampai + 'T23:59:59');
  if (query) list = list.filter(m => (m.produkNama || '').toLowerCase().includes(query));

  list = list.sort((a, b) => b.createdAt - a.createdAt);

  if (list.length === 0) {
    body.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:40px 0;font-size:14px;">Data tidak ditemukan</p>`;
    return;
  }

  const tipeColor = { masuk: '#2ecc71', keluar: 'var(--danger)', koreksi: '#f39c12' };
  const tipeLabel = { masuk: '+ Masuk', keluar: '- Keluar', koreksi: '~ Koreksi' };

  body.innerHTML = list.map(m => `
    <div class="laporan-mutasi-item">
      <div class="laporan-mutasi-left">
        <div class="laporan-mutasi-nama">${m.produkNama || '-'}</div>
        <div class="laporan-mutasi-tgl">${fmtTgl(m.tanggal)}${m.keterangan ? ' · ' + m.keterangan : ''}</div>
      </div>
      <div class="laporan-mutasi-right">
        <span class="laporan-mutasi-tipe" style="color:${tipeColor[m.tipe] || '#999'};">${tipeLabel[m.tipe] || m.tipe}</span>
        <span class="laporan-mutasi-qty" style="color:${tipeColor[m.tipe] || '#999'};">${m.tipe === 'masuk' ? '+' : m.tipe === 'keluar' ? '-' : ''}${m.jumlah}</span>
      </div>
    </div>`).join('');
}

// ===================================================
// 8. LABA RUGI
// ===================================================
function renderLaporanLabaRugi() {
  const filter = document.getElementById('llr-filter')?.value || 'bulan';
  const body = document.getElementById('laporan-labarugi-body');
  if (!body) return;

  const trxList = DB.get('transaksi').filter(t => laporanInRange(t.tanggal, filter));
  const pembelianList = DB.get('pembelian').filter(b => laporanInRange(b.tanggal, filter));
  const biayaList = DB.get('biaya').filter(b => laporanInRange(b.tanggal, filter));

  const pendapatanPenjualan = trxList.reduce((s, t) => s + t.total, 0);
  const hppPenjualan = trxList.reduce((s, t) =>
    s + t.items.reduce((ss, item) => ss + (item.hargaBeli || 0) * item.qty, 0), 0);
  const labaKotor = pendapatanPenjualan - hppPenjualan;

  const totalBiaya = biayaList.filter(b => b.tipe === 'biaya').reduce((s, b) => s + b.nominal, 0);
  const pendapatanLain = biayaList.filter(b => b.tipe === 'pendapatan').reduce((s, b) => s + b.nominal, 0);
  const labaBersih = labaKotor - totalBiaya + pendapatanLain;

  body.innerHTML = `
    <div class="laporan-lr-section">
      <div class="laporan-lr-title" style="color:#2ecc71;">Pendapatan</div>
      <div class="laporan-lr-row"><span>Penjualan</span><span>${fmt(pendapatanPenjualan)}</span></div>
      <div class="laporan-lr-row"><span>Pendapatan Lain</span><span>${fmt(pendapatanLain)}</span></div>
      <div class="laporan-lr-row laporan-lr-subtotal"><span>Total Pendapatan</span><span style="color:#2ecc71;">${fmt(pendapatanPenjualan + pendapatanLain)}</span></div>
    </div>
    <div class="laporan-lr-section">
      <div class="laporan-lr-title" style="color:var(--danger);">Beban / Pengeluaran</div>
      <div class="laporan-lr-row"><span>HPP (Harga Pokok)</span><span>${fmt(hppPenjualan)}</span></div>
      <div class="laporan-lr-row"><span>Biaya Operasional</span><span>${fmt(totalBiaya)}</span></div>
      <div class="laporan-lr-row laporan-lr-subtotal"><span>Total Beban</span><span style="color:var(--danger);">${fmt(hppPenjualan + totalBiaya)}</span></div>
    </div>
    <div class="laporan-lr-section laporan-lr-total">
      <div class="laporan-lr-row"><span>Laba Kotor</span><span style="color:${labaKotor >= 0 ? '#2ecc71' : 'var(--danger)'};">${fmt(labaKotor)}</span></div>
      <div class="laporan-lr-row laporan-lr-bersih">
        <span>Laba Bersih</span>
        <span style="color:${labaBersih >= 0 ? '#2ecc71' : 'var(--danger)'};">${fmt(labaBersih)}</span>
      </div>
    </div>`;
}

// ===================================================
// 9. ARUS KAS
// ===================================================
function renderLaporanArusKas() {
  const filter = document.getElementById('lak-filter')?.value || 'bulan';
  const body = document.getElementById('laporan-arkas-body');
  if (!body) return;

  const trxList = DB.get('transaksi').filter(t => laporanInRange(t.tanggal, filter));
  const pembelianList = DB.get('pembelian').filter(b => laporanInRange(b.tanggal, filter) && b.status === 'lunas');
  const biayaList = DB.get('biaya').filter(b => laporanInRange(b.tanggal, filter));

  const kasmasuk = trxList.filter(t => t.metodePembayaran !== 'Piutang').reduce((s, t) => s + t.total, 0);
  const pendapatanLain = biayaList.filter(b => b.tipe === 'pendapatan').reduce((s, b) => s + b.nominal, 0);
  const kaskeluar = pembelianList.reduce((s, b) => s + b.total, 0);
  const biayaKeluar = biayaList.filter(b => b.tipe === 'biaya').reduce((s, b) => s + b.nominal, 0);
  const netKas = (kasmasuk + pendapatanLain) - (kaskeluar + biayaKeluar);

  // Build timeline
  const allEvents = [
    ...trxList.filter(t => t.metodePembayaran !== 'Piutang').map(t => ({
      tgl: t.tanggal, label: 'Penjualan ' + t.id.replace('trx_', '#'),
      nominal: t.total, tipe: 'masuk'
    })),
    ...biayaList.filter(b => b.tipe === 'pendapatan').map(b => ({
      tgl: b.tanggal, label: b.kategori || 'Pendapatan Lain',
      nominal: b.nominal, tipe: 'masuk'
    })),
    ...pembelianList.map(b => ({
      tgl: b.tanggal, label: 'Pembelian ' + (b.produkNama || ''),
      nominal: b.total, tipe: 'keluar'
    })),
    ...biayaList.filter(b => b.tipe === 'biaya').map(b => ({
      tgl: b.tanggal, label: b.kategori || 'Biaya',
      nominal: b.nominal, tipe: 'keluar'
    })),
  ].sort((a, b) => new Date(b.tgl) - new Date(a.tgl));

  const rows = allEvents.map(e => [
    fmtTgl(e.tgl),
    e.label,
    e.tipe === 'masuk'
      ? `<span style="color:#2ecc71;font-weight:600;">+${fmt(e.nominal)}</span>`
      : `<span style="color:var(--danger);font-weight:600;">-${fmt(e.nominal)}</span>`
  ]);

  body.innerHTML = summaryCard([
    { label: 'Kas Masuk', value: fmt(kasmasuk + pendapatanLain), color: '#2ecc71' },
    { label: 'Kas Keluar', value: fmt(kaskeluar + biayaKeluar), color: 'var(--danger)' },
    { label: 'Net Kas', value: fmt(netKas), color: netKas >= 0 ? '#2ecc71' : 'var(--danger)' },
  ]) + laporanTable(['Tanggal', 'Keterangan', 'Nominal'], rows, 'Belum ada transaksi kas');
}

// ===================================================
// 10. BIAYA & PENDAPATAN LAIN
// ===================================================
function renderLaporanBiaya() {
  const filter = document.getElementById('lbp-filter')?.value || 'bulan';
  const body = document.getElementById('laporan-biaya-body');
  if (!body) return;

  const list = DB.get('biaya').filter(b => laporanInRange(b.tanggal, filter));
  const totalBiaya = list.filter(b => b.tipe === 'biaya').reduce((s, b) => s + b.nominal, 0);
  const totalPendapatan = list.filter(b => b.tipe === 'pendapatan').reduce((s, b) => s + b.nominal, 0);

  const rows = list
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(b => [
      fmtTgl(b.tanggal),
      b.kategori || '-',
      b.keterangan || '-',
      b.tipe === 'pendapatan'
        ? `<span style="color:#2ecc71;font-weight:600;">+${fmt(b.nominal)}</span>`
        : `<span style="color:var(--danger);font-weight:600;">-${fmt(b.nominal)}</span>`,
      b.tipe === 'pendapatan'
        ? '<span style="color:#2ecc71;">Pendapatan</span>'
        : '<span style="color:var(--danger);">Biaya</span>'
    ]);

  body.innerHTML = summaryCard([
    { label: 'Total Biaya', value: fmt(totalBiaya), color: 'var(--danger)' },
    { label: 'Pendapatan Lain', value: fmt(totalPendapatan), color: '#2ecc71' },
    { label: 'Selisih', value: fmt(totalPendapatan - totalBiaya), color: totalPendapatan >= totalBiaya ? '#2ecc71' : 'var(--danger)' },
  ]) + laporanTable(
    ['Tanggal', 'Kategori', 'Keterangan', 'Nominal', 'Tipe'],
    rows,
    'Belum ada data biaya/pendapatan'
  );
}

// ===================================================
// 11. OMSET SALES
// ===================================================
function initOmsetDates() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const dariEl = document.getElementById('omset-dari');
  const sampaiEl = document.getElementById('omset-sampai');
  if (dariEl && !dariEl.value) dariEl.value = firstDay;
  if (sampaiEl && !sampaiEl.value) sampaiEl.value = today;
}

function renderLaporanOmsetSales() {
  const body = document.getElementById('laporan-omset-body');
  if (!body) return;

  const dari = document.getElementById('omset-dari')?.value;
  const sampai = document.getElementById('omset-sampai')?.value;

  let trxList = DB.get('transaksi');
  if (dari) trxList = trxList.filter(t => t.tanggal >= dari);
  if (sampai) trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');

  // Group by sales
  const salesMap = {};
  trxList.forEach(t => {
    const sid = t.salesId || 'no-sales';
    const sname = t.sales || 'Tanpa Sales';
    if (!salesMap[sid]) salesMap[sid] = { salesId: sid, salesNama: sname, totalTransaksi: 0, totalOmset: 0, totalLaba: 0 };
    salesMap[sid].totalTransaksi++;
    salesMap[sid].totalOmset += t.total;
    t.items.forEach(item => {
      salesMap[sid].totalLaba += (item.harga - (item.hargaBeli || 0)) * item.qty;
    });
  });

  const sorted = Object.values(salesMap).sort((a, b) => b.totalOmset - a.totalOmset);
  const totalOmset = sorted.reduce((s, v) => s + v.totalOmset, 0);
  const totalLaba = sorted.reduce((s, v) => s + v.totalLaba, 0);

  const rows = sorted.map(s => [
    s.salesNama,
    s.totalTransaksi,
    fmt(s.totalOmset),
    fmt(s.totalLaba),
    `<span style="font-size:11px;color:var(--text-light);">${totalOmset > 0 ? ((s.totalOmset / totalOmset) * 100).toFixed(1) + '%' : '0%'}</span>`
  ]);

  body.innerHTML = summaryCard([
    { label: 'Total Sales', value: sorted.length },
    { label: 'Total Omset', value: fmt(totalOmset), color: '#2ecc71' },
    { label: 'Total Laba', value: fmt(totalLaba), color: 'var(--primary)' },
  ]) + laporanTable(
    ['Sales', 'Transaksi', 'Omset', 'Laba', 'Kontribusi'],
    rows,
    'Belum ada data omset sales'
  );
}

function exportOmsetPDF() {
  exportOmsetPDF(); // Call from pdf-export.js
}

function exportOmsetExcel() {
  const dari = document.getElementById('omset-dari')?.value || '';
  const sampai = document.getElementById('omset-sampai')?.value || '';
  let trxList = DB.get('transaksi');
  if (dari) trxList = trxList.filter(t => t.tanggal >= dari);
  if (sampai) trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');

  const salesMap = {};
  trxList.forEach(t => {
    const sid = t.salesId || 'no-sales';
    const sname = t.sales || 'Tanpa Sales';
    if (!salesMap[sid]) salesMap[sid] = { salesNama: sname, totalTransaksi: 0, totalOmset: 0, totalLaba: 0 };
    salesMap[sid].totalTransaksi++;
    salesMap[sid].totalOmset += t.total;
    t.items.forEach(item => {
      salesMap[sid].totalLaba += (item.harga - (item.hargaBeli || 0)) * item.qty;
    });
  });

  const data = Object.values(salesMap);
  const csv = 'Sales,Transaksi,Omset,Laba\n' + data.map(s => `${s.salesNama},${s.totalTransaksi},${s.totalOmset},${s.totalLaba}`).join('\n');
  downloadCSV(csv, 'laporan-omset-sales.csv');
}

// ===================================================
// 12. INVOICE PELANGGAN
// ===================================================
function initInvoicePelangganDates() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const dariEl = document.getElementById('inv-pel-dari');
  const sampaiEl = document.getElementById('inv-pel-sampai');
  if (dariEl && !dariEl.value) dariEl.value = firstDay;
  if (sampaiEl && !sampaiEl.value) sampaiEl.value = today;
}

function renderLaporanInvoicePelanggan() {
  const body = document.getElementById('laporan-invoice-pelanggan-body');
  if (!body) return;

  const dari = document.getElementById('inv-pel-dari')?.value;
  const sampai = document.getElementById('inv-pel-sampai')?.value;
  const query = document.getElementById('inv-pel-search')?.value.toLowerCase() || '';

  let list = DB.get('transaksi');
  if (dari) list = list.filter(t => t.tanggal >= dari);
  if (sampai) list = list.filter(t => t.tanggal <= sampai + 'T23:59:59');
  if (query) list = list.filter(t => (t.pelanggan || 'umum').toLowerCase().includes(query));

  list = list.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));

  if (list.length === 0) {
    body.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:40px 0;font-size:14px;">Data tidak ditemukan</p>`;
    return;
  }

  const totalOmset = list.reduce((s, t) => s + t.total, 0);
  const lunas = list.filter(t => t.metodePembayaran !== 'Piutang').length;
  const piutang = list.filter(t => t.metodePembayaran === 'Piutang' && !t.lunas).length;

  body.innerHTML = summaryCard([
    { label: 'Total Invoice', value: list.length },
    { label: 'Total Omset', value: fmt(totalOmset), color: '#2ecc71' },
    { label: 'Lunas', value: lunas, color: '#2ecc71' },
    { label: 'Piutang', value: piutang, color: 'var(--danger)' },
  ]) + list.map(t => {
    const statusColor = t.metodePembayaran === 'Piutang' && !t.lunas ? 'var(--danger)' : '#2ecc71';
    const statusLabel = t.metodePembayaran === 'Piutang' && !t.lunas ? 'Piutang' : 'Lunas';
    return `
    <div class="crud-item" style="margin-bottom:8px;">
      <div class="crud-item-avatar" style="background:${statusColor === 'var(--danger)' ? '#fff8e1' : '#e8f8f0'};">
        <i class="fa-solid fa-file-invoice" style="color:${statusColor};font-size:16px;"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${t.pelanggan || 'Umum'} · ${t.items.length} item</div>
        <div class="crud-item-sub">
          <span>${fmtTglWaktu(t.tanggal)}</span>
          <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:2px;">${fmt(t.total)}</div>
      </div>
    </div>`;
  }).join('');
}

function exportInvoicePelangganPDF() {
  exportInvoicePelangganPDF(); // Call from pdf-export.js
}

function exportInvoicePelangganExcel() {
  const dari = document.getElementById('inv-pel-dari')?.value || '';
  const sampai = document.getElementById('inv-pel-sampai')?.value || '';
  let list = DB.get('transaksi');
  if (dari) list = list.filter(t => t.tanggal >= dari);
  if (sampai) list = list.filter(t => t.tanggal <= sampai + 'T23:59:59');

  const csv = 'Tanggal,Invoice,Pelanggan,Total,Metode,Status\n' + list.map(t => {
    const status = t.metodePembayaran === 'Piutang' && !t.lunas ? 'Piutang' : 'Lunas';
    return `${t.tanggal},${t.id},${t.pelanggan || 'Umum'},${t.total},${t.metodePembayaran},${status}`;
  }).join('\n');
  downloadCSV(csv, 'laporan-invoice-pelanggan.csv');
}

// ===================================================
// 13. INVOICE SUPPLIER
// ===================================================
function initInvoiceSupplierDates() {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  const dariEl = document.getElementById('inv-sup-dari');
  const sampaiEl = document.getElementById('inv-sup-sampai');
  if (dariEl && !dariEl.value) dariEl.value = firstDay;
  if (sampaiEl && !sampaiEl.value) sampaiEl.value = today;
}

function renderLaporanInvoiceSupplier() {
  const body = document.getElementById('laporan-invoice-supplier-body');
  if (!body) return;

  const dari = document.getElementById('inv-sup-dari')?.value;
  const sampai = document.getElementById('inv-sup-sampai')?.value;
  const query = document.getElementById('inv-sup-search')?.value.toLowerCase() || '';

  let list = DB.get('pembelian');
  if (dari) list = list.filter(b => b.tanggal >= dari);
  if (sampai) list = list.filter(b => b.tanggal <= sampai + 'T23:59:59');
  if (query) list = list.filter(b => (b.supplierNama || '').toLowerCase().includes(query));

  list = list.sort((a, b) => b.createdAt - a.createdAt);

  if (list.length === 0) {
    body.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:40px 0;font-size:14px;">Data tidak ditemukan</p>`;
    return;
  }

  const totalBeli = list.reduce((s, b) => s + b.total, 0);
  const lunas = list.filter(b => b.status === 'lunas').length;
  const hutang = list.filter(b => b.status === 'hutang').length;

  body.innerHTML = summaryCard([
    { label: 'Total Invoice', value: list.length },
    { label: 'Total Pembelian', value: fmt(totalBeli), color: 'var(--danger)' },
    { label: 'Lunas', value: lunas, color: '#2ecc71' },
    { label: 'Hutang', value: hutang, color: 'var(--danger)' },
  ]) + list.map(b => {
    const statusColor = b.status === 'hutang' ? 'var(--danger)' : '#2ecc71';
    const statusLabel = b.status === 'hutang' ? 'Hutang' : 'Lunas';
    return `
    <div class="crud-item" style="margin-bottom:8px;">
      <div class="crud-item-avatar" style="background:${statusColor === 'var(--danger)' ? '#fde8e8' : '#e8f8f0'};">
        <i class="fa-solid fa-file-contract" style="color:${statusColor};font-size:16px;"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${b.supplierNama || 'Tanpa Supplier'} · ${b.produkNama}</div>
        <div class="crud-item-sub">
          <span>${fmtTgl(b.tanggal)}</span>
          <span>${b.jumlah} ${b.unit || 'Pcs'}</span>
          <span style="color:${statusColor};font-weight:600;">${statusLabel}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--danger);margin-top:2px;">${fmt(b.total)}</div>
      </div>
    </div>`;
  }).join('');
}

function exportInvoiceSupplierPDF() {
  exportInvoiceSupplierPDF(); // Call from pdf-export.js
}

function exportInvoiceSupplierExcel() {
  const dari = document.getElementById('inv-sup-dari')?.value || '';
  const sampai = document.getElementById('inv-sup-sampai')?.value || '';
  let list = DB.get('pembelian');
  if (dari) list = list.filter(b => b.tanggal >= dari);
  if (sampai) list = list.filter(b => b.tanggal <= sampai + 'T23:59:59');

  const csv = 'Tanggal,Invoice,Supplier,Produk,Jumlah,Total,Status\n' + list.map(b => {
    return `${b.tanggal},${b.id},${b.supplierNama || '-'},${b.produkNama},${b.jumlah},${b.total},${b.status}`;
  }).join('\n');
  downloadCSV(csv, 'laporan-invoice-supplier.csv');
}

// ===================================================
// 14. JATUH TEMPO
// ===================================================
function renderLaporanJatuhTempo() {
  const body = document.getElementById('laporan-jatuh-tempo-body');
  if (!body) return;

  const filterStatus = document.getElementById('jt-filter')?.value || 'semua';
  const filterTipe = document.getElementById('jt-tipe')?.value || 'semua';

  const trxList = DB.get('transaksi').filter(t => t.metodePembayaran === 'Piutang' && !t.lunas && t.tglJthTempo);
  const beliList = DB.get('pembelian').filter(b => b.status === 'hutang' && b.tglJthTempo);

  const now = new Date();
  const allItems = [];

  trxList.forEach(t => {
    const jt = new Date(t.tglJthTempo);
    const diff = Math.floor((jt - now) / (1000 * 60 * 60 * 24));
    let status = 'normal';
    if (diff < 0) status = 'terlambat';
    else if (diff <= 7) status = 'segera';
    allItems.push({ tipe: 'piutang', tanggal: t.tanggal, pihak: t.pelanggan || 'Umum', total: t.total, tglJthTempo: t.tglJthTempo, diff, status });
  });

  beliList.forEach(b => {
    const jt = new Date(b.tglJthTempo);
    const diff = Math.floor((jt - now) / (1000 * 60 * 60 * 24));
    let status = 'normal';
    if (diff < 0) status = 'terlambat';
    else if (diff <= 7) status = 'segera';
    allItems.push({ tipe: 'hutang', tanggal: b.tanggal, pihak: b.supplierNama || '-', total: b.total, tglJthTempo: b.tglJthTempo, diff, status });
  });

  let filtered = allItems;
  if (filterStatus !== 'semua') filtered = filtered.filter(i => i.status === filterStatus);
  if (filterTipe !== 'semua') filtered = filtered.filter(i => i.tipe === filterTipe);

  filtered = filtered.sort((a, b) => new Date(a.tglJthTempo) - new Date(b.tglJthTempo));

  if (filtered.length === 0) {
    body.innerHTML = `<p style="text-align:center;color:var(--text-light);padding:40px 0;font-size:14px;">Data tidak ditemukan</p>`;
    return;
  }

  const terlambat = filtered.filter(i => i.status === 'terlambat').length;
  const segera = filtered.filter(i => i.status === 'segera').length;
  const totalNominal = filtered.reduce((s, i) => s + i.total, 0);

  body.innerHTML = summaryCard([
    { label: 'Total Item', value: filtered.length },
    { label: 'Terlambat', value: terlambat, color: 'var(--danger)' },
    { label: 'Segera (≤7 hari)', value: segera, color: '#f39c12' },
    { label: 'Total Nominal', value: fmt(totalNominal), color: 'var(--primary)' },
  ]) + filtered.map(i => {
    const statusColor = i.status === 'terlambat' ? 'var(--danger)' : i.status === 'segera' ? '#f39c12' : '#2ecc71';
    const statusLabel = i.status === 'terlambat' ? 'Terlambat' : i.status === 'segera' ? 'Segera' : 'Normal';
    const tipeLabel = i.tipe === 'piutang' ? 'Piutang' : 'Hutang';
    const tipeColor = i.tipe === 'piutang' ? '#e67e22' : '#c0392b';
    return `
    <div class="crud-item" style="margin-bottom:8px;">
      <div class="crud-item-avatar" style="background:${statusColor === 'var(--danger)' ? '#fde8e8' : statusColor === '#f39c12' ? '#fff8e1' : '#e8f8f0'};">
        <i class="fa-solid fa-calendar-xmark" style="color:${statusColor};font-size:16px;"></i>
      </div>
      <div class="crud-item-info">
        <div class="crud-item-nama">${i.pihak} · <span style="color:${tipeColor};font-weight:600;">${tipeLabel}</span></div>
        <div class="crud-item-sub">
          <span>JT: ${fmtTgl(i.tglJthTempo)}</span>
          <span style="color:${statusColor};font-weight:600;">${i.diff >= 0 ? i.diff + ' hari lagi' : Math.abs(i.diff) + ' hari lewat'}</span>
        </div>
        <div style="font-size:13px;font-weight:700;color:var(--primary);margin-top:2px;">${fmt(i.total)}</div>
      </div>
    </div>`;
  }).join('');
}

function exportJatuhTempoPDF() {
  exportJatuhTempoPDF(); // Call from pdf-export.js
}

function exportJatuhTempoExcel() {
  const filterStatus = document.getElementById('jt-filter')?.value || 'semua';
  const filterTipe = document.getElementById('jt-tipe')?.value || 'semua';

  const trxList = DB.get('transaksi').filter(t => t.metodePembayaran === 'Piutang' && !t.lunas && t.tglJthTempo);
  const beliList = DB.get('pembelian').filter(b => b.status === 'hutang' && b.tglJthTempo);

  const now = new Date();
  const allItems = [];

  trxList.forEach(t => {
    const jt = new Date(t.tglJthTempo);
    const diff = Math.floor((jt - now) / (1000 * 60 * 60 * 24));
    let status = 'normal';
    if (diff < 0) status = 'terlambat';
    else if (diff <= 7) status = 'segera';
    allItems.push({ tipe: 'Piutang', pihak: t.pelanggan || 'Umum', total: t.total, tglJthTempo: t.tglJthTempo, diff, status });
  });

  beliList.forEach(b => {
    const jt = new Date(b.tglJthTempo);
    const diff = Math.floor((jt - now) / (1000 * 60 * 60 * 24));
    let status = 'normal';
    if (diff < 0) status = 'terlambat';
    else if (diff <= 7) status = 'segera';
    allItems.push({ tipe: 'Hutang', pihak: b.supplierNama || '-', total: b.total, tglJthTempo: b.tglJthTempo, diff, status });
  });

  let filtered = allItems;
  if (filterStatus !== 'semua') filtered = filtered.filter(i => i.status === filterStatus);
  if (filterTipe !== 'semua') filtered = filtered.filter(i => i.tipe.toLowerCase() === filterTipe);

  const csv = 'Tipe,Pihak,Total,Jatuh Tempo,Selisih Hari,Status\n' + filtered.map(i => {
    return `${i.tipe},${i.pihak},${i.total},${i.tglJthTempo},${i.diff},${i.status}`;
  }).join('\n');
  downloadCSV(csv, 'laporan-jatuh-tempo.csv');
}

// ===== CSV DOWNLOAD HELPER =====
function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  showToast('File Excel berhasil diunduh!');
}

// ===== SCREEN INIT LISTENER =====
document.addEventListener('screenInit', (e) => {
  const { name } = e.detail;
  if (name === 'laporan-penjualan') renderLaporanPenjualan();
  if (name === 'laporan-produk-terjual') renderLaporanProdukTerjual();
  if (name === 'laporan-piutang') renderLaporanPiutang();
  if (name === 'laporan-pembelian') renderLaporanPembelian();
  if (name === 'laporan-hutang-supplier') renderLaporanHutangSupplier();
  if (name === 'laporan-persediaan') renderLaporanPersediaan();
  if (name === 'laporan-mutasi-stok') { initMutasiDates(); renderLaporanMutasiStok(); }
  if (name === 'laporan-laba-rugi') renderLaporanLabaRugi();
  if (name === 'laporan-arus-kas') renderLaporanArusKas();
  if (name === 'laporan-biaya') renderLaporanBiaya();
  if (name === 'laporan-omset-sales') { initOmsetDates(); renderLaporanOmsetSales(); }
  if (name === 'laporan-invoice-pelanggan') { initInvoicePelangganDates(); renderLaporanInvoicePelanggan(); }
  if (name === 'laporan-invoice-supplier') { initInvoiceSupplierDates(); renderLaporanInvoiceSupplier(); }
  if (name === 'laporan-jatuh-tempo') renderLaporanJatuhTempo();
});
