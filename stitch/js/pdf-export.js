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
