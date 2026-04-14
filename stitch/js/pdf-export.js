// ===================================================
// PDF EXPORT HELPER — jsPDF
// ===================================================

// Get jsPDF from global
const { jsPDF } = window.jspdf;

// ===== HELPER: Format Rupiah untuk PDF =====
function pdfFmt(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

// ===== HELPER: Format Tanggal untuk PDF =====
function pdfFmtTgl(tglStr) {
  return new Date(tglStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ===== PDF HEADER =====
function addPDFHeader(doc, title) {
  const outlet = DB.getObj('outlet');
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Logo/Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(outlet.nama || 'Koncowrb', 14, 15);
  
  // Report Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 14, 23);
  
  // Date
  doc.setFontSize(9);
  doc.setTextColor(100);
  const today = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text('Dicetak: ' + today, pageWidth - 14, 15, { align: 'right' });
  
  // Line
  doc.setDrawColor(200);
  doc.line(14, 27, pageWidth - 14, 27);
  
  doc.setTextColor(0);
  return 32; // Return Y position after header
}

// ===== PDF FOOTER =====
function addPDFFooter(doc) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text('Powered by Koncowrb POS', pageWidth / 2, pageHeight - 10, { align: 'center' });
}

// ===================================================
// 1. EXPORT OMSET SALES PDF
// ===================================================
function exportOmsetPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Omset Sales');
  
  const dari = document.getElementById('omset-dari')?.value || '';
  const sampai = document.getElementById('omset-sampai')?.value || '';
  
  // Period info
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  // Get data
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
  
  const data = Object.values(salesMap).sort((a, b) => b.totalOmset - a.totalOmset);
  const totalOmset = data.reduce((s, v) => s + v.totalOmset, 0);
  const totalLaba = data.reduce((s, v) => s + v.totalLaba, 0);
  
  // Table
  const tableData = data.map((s, i) => [
    i + 1,
    s.salesNama,
    s.totalTransaksi,
    pdfFmt(s.totalOmset),
    pdfFmt(s.totalLaba),
    totalOmset > 0 ? ((s.totalOmset / totalOmset) * 100).toFixed(1) + '%' : '0%'
  ]);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Sales', 'Transaksi', 'Omset', 'Laba', 'Kontribusi']],
    body: tableData,
    foot: [['', 'TOTAL', data.reduce((s, v) => s + v.totalTransaksi, 0), pdfFmt(totalOmset), pdfFmt(totalLaba), '100%']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'center' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-omset-sales.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 2. EXPORT INVOICE PELANGGAN PDF
// ===================================================
function exportInvoicePelangganPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Invoice Pelanggan');
  
  const dari = document.getElementById('inv-pel-dari')?.value || '';
  const sampai = document.getElementById('inv-pel-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let list = DB.get('transaksi');
  if (dari) list = list.filter(t => t.tanggal >= dari);
  if (sampai) list = list.filter(t => t.tanggal <= sampai + 'T23:59:59');
  list = list.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  
  const tableData = list.map((t, i) => {
    const status = t.metodePembayaran === 'Piutang' && !t.lunas ? 'Piutang' : 'Lunas';
    return [
      i + 1,
      pdfFmtTgl(t.tanggal),
      t.pelanggan || 'Umum',
      t.items.length + ' item',
      pdfFmt(t.total),
      status
    ];
  });
  
  const totalOmset = list.reduce((s, t) => s + t.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Pelanggan', 'Items', 'Total', 'Status']],
    body: tableData,
    foot: [['', '', '', 'TOTAL', pdfFmt(totalOmset), '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'center' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-invoice-pelanggan.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 3. EXPORT INVOICE SUPPLIER PDF
// ===================================================
function exportInvoiceSupplierPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Invoice Supplier');
  
  const dari = document.getElementById('inv-sup-dari')?.value || '';
  const sampai = document.getElementById('inv-sup-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let list = DB.get('pembelian');
  if (dari) list = list.filter(b => b.tanggal >= dari);
  if (sampai) list = list.filter(b => b.tanggal <= sampai + 'T23:59:59');
  list = list.sort((a, b) => b.createdAt - a.createdAt);
  
  const tableData = list.map((b, i) => [
    i + 1,
    pdfFmtTgl(b.tanggal),
    b.supplierNama || '-',
    b.produkNama,
    b.jumlah + ' ' + (b.unit || 'Pcs'),
    pdfFmt(b.total),
    b.status === 'hutang' ? 'Hutang' : 'Lunas'
  ]);
  
  const totalBeli = list.reduce((s, b) => s + b.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Supplier', 'Produk', 'Qty', 'Total', 'Status']],
    body: tableData,
    foot: [['', '', '', '', 'TOTAL', pdfFmt(totalBeli), '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'center' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-invoice-supplier.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 4. EXPORT JATUH TEMPO PDF
// ===================================================
function exportJatuhTempoPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Jatuh Tempo');
  
  const filterStatus = document.getElementById('jt-filter')?.value || 'semua';
  const filterTipe = document.getElementById('jt-tipe')?.value || 'semua';
  
  doc.setFontSize(10);
  doc.text(`Filter: ${filterTipe === 'semua' ? 'Semua' : filterTipe.charAt(0).toUpperCase() + filterTipe.slice(1)} | Status: ${filterStatus === 'semua' ? 'Semua' : filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)}`, 14, yPos);
  yPos += 8;
  
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
  filtered = filtered.sort((a, b) => new Date(a.tglJthTempo) - new Date(b.tglJthTempo));
  
  const tableData = filtered.map((i, idx) => {
    const statusLabel = i.status === 'terlambat' ? 'Terlambat' : i.status === 'segera' ? 'Segera' : 'Normal';
    const diffLabel = i.diff >= 0 ? i.diff + ' hari lagi' : Math.abs(i.diff) + ' hari lewat';
    return [
      idx + 1,
      i.tipe,
      i.pihak,
      pdfFmt(i.total),
      pdfFmtTgl(i.tglJthTempo),
      diffLabel,
      statusLabel
    ];
  });
  
  const totalNominal = filtered.reduce((s, i) => s + i.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tipe', 'Pihak', 'Total', 'Jatuh Tempo', 'Selisih', 'Status']],
    body: tableData,
    foot: [['', '', 'TOTAL', pdfFmt(totalNominal), '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { halign: 'center' },
      3: { halign: 'right' },
      5: { halign: 'center' },
      6: { halign: 'center' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-jatuh-tempo.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 5. EXPORT PENJUALAN PDF
// ===================================================
function exportPenjualanPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Penjualan');
  
  const dari = document.getElementById('lp-dari')?.value || '';
  const sampai = document.getElementById('lp-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let trxList = DB.get('transaksi');
  trxList = trxList.filter(t => !t.isDraft);
  if (dari) trxList = trxList.filter(t => t.tanggal >= dari);
  if (sampai) trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');
  trxList = trxList.sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
  
  const tableData = trxList.map((t, i) => {
    const status = t.metodePembayaran === 'Piutang' ? 'Piutang' : 'Lunas';
    return [
      i + 1,
      pdfFmtTgl(t.tanggal),
      t.pelanggan || 'Umum',
      t.items.length + ' item',
      pdfFmt(t.total),
      status
    ];
  });
  
  const totalPenjualan = trxList.reduce((s, t) => s + t.total, 0);
  const lunas = trxList.filter(t => t.metodePembayaran !== 'Piutang');
  const totalLunas = lunas.reduce((s, t) => s + t.total, 0);
  const piutang = trxList.filter(t => t.metodePembayaran === 'Piutang');
  const totalPiutang = piutang.reduce((s, t) => s + t.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Pelanggan', 'Items', 'Total', 'Status']],
    body: tableData,
    foot: [['', '', '', 'TOTAL', pdfFmt(totalPenjualan), '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'center' }
    }
  });
  
  // Summary
  yPos = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Invoice: ${trxList.length}`, 14, yPos + 6);
  doc.text(`Lunas: ${pdfFmt(totalLunas)}`, 14, yPos + 12);
  doc.text(`Piutang: ${pdfFmt(totalPiutang)}`, 14, yPos + 18);
  
  addPDFFooter(doc);
  doc.save('laporan-penjualan.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 6. EXPORT PRODUK TERJUAL PDF
// ===================================================
function exportProdukTerjualPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Produk Terjual');
  
  const dari = document.getElementById('lpt-dari')?.value || '';
  const sampai = document.getElementById('lpt-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let trxList = DB.get('transaksi');
  trxList = trxList.filter(t => !t.isDraft);
  if (dari) trxList = trxList.filter(t => t.tanggal >= dari);
  if (sampai) trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');
  
  const produkMap = {};
  trxList.forEach(t => {
    t.items.forEach(item => {
      if (!produkMap[item.id]) {
        produkMap[item.id] = { nama: item.nama, qty: 0, total: 0, laba: 0 };
      }
      produkMap[item.id].qty += item.qty;
      produkMap[item.id].total += item.qty * item.harga;
      produkMap[item.id].laba += (item.harga - (item.hargaBeli || 0)) * item.qty;
    });
  });
  
  const data = Object.values(produkMap).sort((a, b) => b.qty - a.qty);
  
  const tableData = data.map((p, i) => [
    i + 1,
    p.nama,
    p.qty,
    pdfFmt(p.total),
    pdfFmt(p.laba)
  ]);
  
  const totalQty = data.reduce((s, p) => s + p.qty, 0);
  const totalOmset = data.reduce((s, p) => s + p.total, 0);
  const totalLaba = data.reduce((s, p) => s + p.laba, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Produk', 'Qty Terjual', 'Total Omset', 'Total Laba']],
    body: tableData,
    foot: [['', 'TOTAL', totalQty, pdfFmt(totalOmset), pdfFmt(totalLaba)]],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'right' },
      4: { halign: 'right' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-produk-terjual.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 7. EXPORT PIUTANG PDF
// ===================================================
function exportPiutangPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Piutang Pelanggan');
  
  const trxList = DB.get('transaksi').filter(t => t.metodePembayaran === 'Piutang' && !t.lunas);
  
  const tableData = trxList.map((t, i) => [
    i + 1,
    pdfFmtTgl(t.tanggal),
    t.pelanggan || 'Umum',
    pdfFmt(t.total),
    t.tglJthTempo ? pdfFmtTgl(t.tglJthTempo) : '-'
  ]);
  
  const totalPiutang = trxList.reduce((s, t) => s + t.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Pelanggan', 'Total', 'Jatuh Tempo']],
    body: tableData,
    foot: [['', '', 'TOTAL', pdfFmt(totalPiutang), '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'right' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-piutang.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 8. EXPORT PEMBELIAN PDF
// ===================================================
function exportPembelianPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Pembelian');
  
  const dari = document.getElementById('lpb-dari')?.value || '';
  const sampai = document.getElementById('lpb-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let list = DB.get('pembelian');
  if (dari) list = list.filter(b => b.tanggal >= dari);
  if (sampai) list = list.filter(b => b.tanggal <= sampai + 'T23:59:59');
  list = list.sort((a, b) => b.createdAt - a.createdAt);
  
  const tableData = list.map((b, i) => [
    i + 1,
    pdfFmtTgl(b.tanggal),
    b.supplierNama || '-',
    b.produkNama,
    b.jumlah + ' ' + (b.unit || 'Pcs'),
    pdfFmt(b.total),
    b.status === 'hutang' ? 'Hutang' : 'Lunas'
  ]);
  
  const totalBeli = list.reduce((s, b) => s + b.total, 0);
  const lunas = list.filter(b => b.status === 'lunas');
  const totalLunas = lunas.reduce((s, b) => s + b.total, 0);
  const hutang = list.filter(b => b.status === 'hutang');
  const totalHutang = hutang.reduce((s, b) => s + b.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Supplier', 'Produk', 'Qty', 'Total', 'Status']],
    body: tableData,
    foot: [['', '', '', '', 'TOTAL', pdfFmt(totalBeli), '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'center' }
    }
  });
  
  // Summary
  yPos = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan:', 14, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Transaksi: ${list.length}`, 14, yPos + 6);
  doc.text(`Lunas: ${pdfFmt(totalLunas)}`, 14, yPos + 12);
  doc.text(`Hutang: ${pdfFmt(totalHutang)}`, 14, yPos + 18);
  
  addPDFFooter(doc);
  doc.save('laporan-pembelian.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 9. EXPORT HUTANG SUPPLIER PDF
// ===================================================
function exportHutangPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Hutang Supplier');
  
  const hutangList = DB.get('pembelian').filter(b => b.status === 'hutang');
  
  const tableData = hutangList.map((b, i) => [
    i + 1,
    pdfFmtTgl(b.tanggal),
    b.supplierNama || '-',
    b.produkNama,
    pdfFmt(b.total),
    b.tglJthTempo ? pdfFmtTgl(b.tglJthTempo) : '-'
  ]);
  
  const totalHutang = hutangList.reduce((s, b) => s + b.total, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Supplier', 'Produk', 'Total', 'Jatuh Tempo']],
    body: tableData,
    foot: [['', '', '', 'TOTAL', pdfFmt(totalHutang), '']],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { halign: 'right' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-hutang-supplier.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 10. EXPORT PERSEDIAAN PDF
// ===================================================
function exportPersediaanPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Persediaan Stok');
  
  const products = getProducts();
  
  const tableData = products.map((p, i) => [
    i + 1,
    p.nama,
    p.kategori || '-',
    p.stok ?? p.stokAwal ?? 0,
    p.stokMinimal || 0,
    pdfFmt(p.hargaBeli || 0),
    pdfFmt((p.stok ?? p.stokAwal ?? 0) * (p.hargaBeli || 0))
  ]);
  
  const totalNilai = products.reduce((s, p) => s + (p.stok ?? p.stokAwal ?? 0) * (p.hargaBeli || 0), 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Produk', 'Kategori', 'Stok', 'Min', 'Harga Beli', 'Nilai Stok']],
    body: tableData,
    foot: [['', '', '', '', '', 'TOTAL', pdfFmt(totalNilai)]],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'right' },
      6: { halign: 'right' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-persediaan.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 11. EXPORT LABA RUGI PDF
// ===================================================
function exportLabaRugiPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Laba Rugi');
  
  const dari = document.getElementById('llr-dari')?.value || '';
  const sampai = document.getElementById('llr-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 10;
  
  let trxList = DB.get('transaksi');
  trxList = trxList.filter(t => !t.isDraft);
  let biayaList = DB.get('biaya');
  
  if (dari) {
    trxList = trxList.filter(t => t.tanggal >= dari);
    biayaList = biayaList.filter(b => b.tanggal >= dari);
  }
  if (sampai) {
    trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');
    biayaList = biayaList.filter(b => b.tanggal <= sampai + 'T23:59:59');
  }
  
  const pendapatan = trxList.reduce((s, t) => s + t.total, 0);
  let hpp = 0;
  trxList.forEach(t => {
    t.items.forEach(item => {
      hpp += (item.hargaBeli || 0) * item.qty;
    });
  });
  const labaKotor = pendapatan - hpp;
  const biayaOperasional = biayaList.reduce((s, b) => s + b.nominal, 0);
  const labaBersih = labaKotor - biayaOperasional;
  
  // Create table data
  const tableData = [
    ['Pendapatan', pdfFmt(pendapatan)],
    ['HPP (Harga Pokok Penjualan)', pdfFmt(hpp)],
    ['Laba Kotor', pdfFmt(labaKotor)],
    ['Biaya Operasional', pdfFmt(biayaOperasional)],
    ['Laba Bersih', pdfFmt(labaBersih)]
  ];
  
  doc.autoTable({
    startY: yPos,
    body: tableData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'right', cellWidth: 60 }
    },
    didParseCell: function(data) {
      if (data.row.index === 4) { // Laba Bersih row
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 11;
      }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-laba-rugi.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 12. EXPORT ARUS KAS PDF
// ===================================================
function exportArusKasPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Arus Kas');
  
  const dari = document.getElementById('lak-dari')?.value || '';
  const sampai = document.getElementById('lak-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let trxList = DB.get('transaksi');
  trxList = trxList.filter(t => !t.isDraft);
  let pembelianList = DB.get('pembelian').filter(b => b.status === 'lunas');
  let biayaList = DB.get('biaya');
  
  if (dari) {
    trxList = trxList.filter(t => t.tanggal >= dari);
    pembelianList = pembelianList.filter(b => b.tanggal >= dari);
    biayaList = biayaList.filter(b => b.tanggal >= dari);
  }
  if (sampai) {
    trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');
    pembelianList = pembelianList.filter(b => b.tanggal <= sampai + 'T23:59:59');
    biayaList = biayaList.filter(b => b.tanggal <= sampai + 'T23:59:59');
  }
  
  const kasmasuk = trxList.filter(t => t.metodePembayaran !== 'Piutang').reduce((s, t) => s + t.total, 0);
  const kaskeluar = pembelianList.reduce((s, b) => s + b.total, 0);
  const biayaKeluar = biayaList.reduce((s, b) => s + b.nominal, 0);
  const netKas = kasmasuk - kaskeluar - biayaKeluar;
  
  const tableData = [
    ['Kas Masuk (Penjualan Tunai)', pdfFmt(kasmasuk)],
    ['Kas Keluar (Pembelian)', pdfFmt(kaskeluar)],
    ['Kas Keluar (Biaya)', pdfFmt(biayaKeluar)],
    ['Net Arus Kas', pdfFmt(netKas)]
  ];
  
  doc.autoTable({
    startY: yPos,
    body: tableData,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { halign: 'right', cellWidth: 60 }
    },
    didParseCell: function(data) {
      if (data.row.index === 3) { // Net Arus Kas row
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 11;
      }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-arus-kas.pdf');
  showToast('PDF berhasil diunduh!');
}

// ===================================================
// 13. EXPORT BIAYA PDF
// ===================================================
function exportBiayaPDF() {
  const doc = new jsPDF();
  let yPos = addPDFHeader(doc, 'Laporan Biaya');
  
  const dari = document.getElementById('lbp-dari')?.value || '';
  const sampai = document.getElementById('lbp-sampai')?.value || '';
  
  doc.setFontSize(10);
  doc.text(`Periode: ${pdfFmtTgl(dari)} - ${pdfFmtTgl(sampai)}`, 14, yPos);
  yPos += 8;
  
  let list = DB.get('biaya');
  if (dari) list = list.filter(b => b.tanggal >= dari);
  if (sampai) list = list.filter(b => b.tanggal <= sampai + 'T23:59:59');
  list = list.sort((a, b) => b.createdAt - a.createdAt);
  
  const tableData = list.map((b, i) => [
    i + 1,
    pdfFmtTgl(b.tanggal),
    b.kategori || '-',
    b.keterangan || '-',
    pdfFmt(b.nominal)
  ]);
  
  const totalBiaya = list.reduce((s, b) => s + b.nominal, 0);
  
  doc.autoTable({
    startY: yPos,
    head: [['No', 'Tanggal', 'Kategori', 'Keterangan', 'Nominal']],
    body: tableData,
    foot: [['', '', '', 'TOTAL', pdfFmt(totalBiaya)]],
    theme: 'grid',
    headStyles: { fillColor: [232, 99, 122], fontSize: 9 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: 'bold', fontSize: 9 },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      4: { halign: 'right' }
    }
  });
  
  addPDFFooter(doc);
  doc.save('laporan-biaya.pdf');
  showToast('PDF berhasil diunduh!');
}
