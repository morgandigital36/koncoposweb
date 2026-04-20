// ===================================================
// PRINTER â€” Bluetooth Thermal Printer via Web Bluetooth API
// ESC/POS commands
// ===================================================

// ===== ESC/POS COMMANDS =====
const ESC = 0x1B;
const GS  = 0x1D;
const CMD = {
  INIT:         [ESC, 0x40],
  ALIGN_LEFT:   [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT:  [ESC, 0x61, 0x02],
  BOLD_ON:      [ESC, 0x45, 0x01],
  BOLD_OFF:     [ESC, 0x45, 0x00],
  DOUBLE_ON:    [GS,  0x21, 0x11],
  DOUBLE_OFF:   [GS,  0x21, 0x00],
  FEED_LINE:    [0x0A],
  FEED_3:       [ESC, 0x64, 0x03],
  CUT:          [GS,  0x56, 0x41, 0x00],
  CASH_DRAWER:  [ESC, 0x70, 0x00, 0x19, 0xFA],
};

// ===== BLUETOOTH STATE =====
let _btDevice = null;
let _btChar   = null;

// Common BT printer service/characteristic UUIDs
const BT_SERVICE_UUID  = '000018f0-0000-1000-8000-00805f9b34fb';
const BT_CHAR_UUID     = '00002af1-0000-1000-8000-00805f9b34fb';
// Fallback: some printers use serial port profile
const BT_SPP_SERVICE   = '00001101-0000-1000-8000-00805f9b34fb';

function getPrinterConfig() {
  return DB.getObj('printer');
}

function getPrinterItemSubtotal(item) {
  if (typeof getCartItemSubtotal === 'function') return getCartItemSubtotal(item);
  return (Number(item.qty) || 0) * (Number(item.harga) || 0);
}

function getPrinterGrossAmount(item) {
  const qty = Number(item.qty) || 0;
  const baseHarga = Number(item.baseHarga ?? item.harga ?? 0) || 0;
  return qty * baseHarga;
}

function getPrinterDiscountAmount(item) {
  const gross = getPrinterGrossAmount(item);
  const rawDiscount = Number(item.diskonRp ?? 0) || 0;
  return Math.max(0, Math.min(gross, rawDiscount));
}

function getPrinterInvoiceNumber(trx) {
  const tgl = new Date(trx.tanggal);
  return 'INV-' + tgl.getFullYear().toString().slice(2)
    + String(tgl.getMonth() + 1).padStart(2, '0')
    + String(tgl.getDate()).padStart(2, '0')
    + String((DB.get('transaksi') || []).length).padStart(4, '0');
}

function setBluetoothStatus(message, color = '', buttonLabel = '', buttonColor = '') {
  const statusEl = document.getElementById('printer-bt-status');
  const btn = document.getElementById('printer-bt-btn');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.style.color = color || 'var(--text-light)';
  }
  if (btn && buttonLabel) {
    btn.innerHTML = buttonLabel;
    btn.style.background = buttonColor;
  }
}

function canUseBluetooth() {
  if (!window.isSecureContext) {
    showToast('Bluetooth hanya bisa dipakai di HTTPS atau localhost.');
    setBluetoothStatus('Buka aplikasi lewat HTTPS untuk izin Bluetooth', 'var(--danger)');
    return false;
  }
  if (!navigator.bluetooth) {
    showToast('Web Bluetooth tidak didukung browser ini. Gunakan Chrome/Edge Android.');
    setBluetoothStatus('Browser ini belum mendukung Web Bluetooth', 'var(--danger)');
    return false;
  }
  return true;
}

async function connectToBluetoothDevice(device) {
  if (!device) throw new Error('Perangkat Bluetooth tidak ditemukan');

  const server = await device.gatt.connect();
  let char;

  try {
    const service = await server.getPrimaryService(BT_SERVICE_UUID);
    char = await service.getCharacteristic(BT_CHAR_UUID);
  } catch {
    const services = await server.getPrimaryServices();
    if (services.length === 0) throw new Error('Tidak ada service printer ditemukan');
    for (const srv of services) {
      const chars = await srv.getCharacteristics();
      char = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
      if (char) break;
    }
    if (!char) throw new Error('Tidak ada characteristic printer yang bisa ditulis');
  }

  _btDevice = device;
  _btChar = char;

  const printerData = getPrinterConfig();
  printerData.btName = device.name || printerData.btName || 'Printer Bluetooth';
  printerData.btId = device.id || printerData.btId || '';
  DB.setObj('printer', printerData);

  const nameEl = document.getElementById('printer-bt-name');
  if (nameEl) nameEl.textContent = printerData.btName;
  setBluetoothStatus('Terhubung', '#2ecc71', '<i class="fa-solid fa-link"></i> Terhubung', '#2ecc71');

  device.addEventListener('gattserverdisconnected', handleBluetoothDisconnect);
  return char;
}

function handleBluetoothDisconnect() {
  _btDevice = null;
  _btChar = null;
  setBluetoothStatus('Printer terputus, tap Scan untuk sambungkan lagi', 'var(--danger)', '<i class="fa-solid fa-bluetooth"></i> Scan');
}

async function restoreBluetoothConnection() {
  if (!canUseBluetooth()) return false;
  if (_btChar && _btDevice?.gatt?.connected) return true;
  if (!navigator.bluetooth.getDevices) return false;

  const printerData = getPrinterConfig();
  const devices = await navigator.bluetooth.getDevices();
  const device = devices.find(d => (printerData.btId && d.id === printerData.btId) || (printerData.btName && d.name === printerData.btName));
  if (!device) return false;
  await connectToBluetoothDevice(device);
  return true;
}

// ===== SCAN & CONNECT =====
async function scanBluetoothPrinter() {
  if (!canUseBluetooth()) return;
  const btn = document.getElementById('printer-bt-btn');
  const nameEl = document.getElementById('printer-bt-name');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scan...'; }
  setBluetoothStatus('Meminta izin Bluetooth...');

  try {
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [BT_SERVICE_UUID] },
        { namePrefix: 'POS' },
        { namePrefix: 'Printer' },
        { namePrefix: 'RPP' },
        { namePrefix: 'MTP' },
        { namePrefix: 'Xprinter' },
        { namePrefix: 'BlueTooth' },
        { namePrefix: 'BT' }
      ],
      optionalServices: [BT_SERVICE_UUID, BT_SPP_SERVICE]
    });

    if (nameEl) nameEl.textContent = device.name || 'Printer Bluetooth';
    setBluetoothStatus('Menghubungkan...');
    await connectToBluetoothDevice(device);
    showToast('Printer terhubung: ' + (device.name || 'Bluetooth'));
  } catch (e) {
    if (e.name === 'NotFoundError') {
      setBluetoothStatus('Belum ada printer dipilih');
    } else if (e.name === 'SecurityError') {
      showToast('Izin Bluetooth ditolak. Izinkan akses perangkat lalu coba lagi.');
      setBluetoothStatus('Izin Bluetooth ditolak', 'var(--danger)');
    } else {
      showToast('Gagal Bluetooth: ' + e.message);
      setBluetoothStatus('Gagal menghubungkan printer Bluetooth', 'var(--danger)');
    }
    return;
  } finally {
    if (btn) btn.disabled = false;
    if (btn && !_btChar) btn.innerHTML = '<i class="fa-solid fa-bluetooth"></i> Scan';
  }
}

// ===== WRITE TO PRINTER =====
async function btWrite(data) {
  if (!_btChar) throw new Error('Printer belum terhubung');
  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if (_btChar.properties.writeWithoutResponse) {
      await _btChar.writeValueWithoutResponse(new Uint8Array(chunk));
    } else {
      await _btChar.writeValue(new Uint8Array(chunk));
    }
    await new Promise(r => setTimeout(r, 20));
  }
}

// ===== TEXT ENCODING (Latin-1 for ESC/POS) =====
function encodeText(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    bytes.push(c < 256 ? c : 0x3F); // '?' for unsupported chars
  }
  return bytes;
}

function line(text) { return [...encodeText(text), 0x0A]; }
function center(text, width) {
  const pad = Math.max(0, Math.floor((width - text.length) / 2));
  return line(' '.repeat(pad) + text);
}
function divider(width, char = '-') { return line(char.repeat(width)); }
function cols(left, right, width) {
  const space = Math.max(1, width - left.length - right.length);
  return line(left + ' '.repeat(space) + right);
}

// ===== BUILD INVOICE BYTES =====
function buildInvoiceBytes(trx) {
  const cfg = getPrinterConfig();
  const outlet = DB.getObj('outlet');
  const width = cfg.ukuran === '58' ? 32 : 42;
  const bytes = [];

  const push = (...cmds) => cmds.forEach(c => bytes.push(...c));

  push(CMD.INIT, CMD.ALIGN_CENTER);

  // Header outlet
  if (outlet.nama) {
    push(CMD.BOLD_ON, CMD.DOUBLE_ON);
    push(center(outlet.nama.toUpperCase(), width));
    push(CMD.DOUBLE_OFF, CMD.BOLD_OFF);
  }
  if (cfg.tampilAlamat === 'ya' && outlet.alamat) {
    push(line(outlet.alamat.substring(0, width)));
  }
  if (outlet.telp) push(line('Telp: ' + outlet.telp));

  push(CMD.ALIGN_LEFT);
  push(divider(width, '='));

  // Invoice info
  const tgl = new Date(trx.tanggal).toLocaleString('id-ID', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  push(line('No: ' + getPrinterInvoiceNumber(trx)));
  if (cfg.tampilTglBayar !== 'tidak') push(line('Tgl: ' + tgl));
  if (trx.pelanggan) push(line('Pelanggan: ' + trx.pelanggan));
  if (trx.noMeja) push(line('Meja: ' + trx.noMeja));
  if (trx.sales) push(line('Sales: ' + trx.sales));
  if (cfg.tampilJenisJual === 'ya' && trx.jenisPenjualan) push(line('Jenis: ' + trx.jenisPenjualan));

  push(divider(width, '-'));

  // Items
  trx.items.forEach(item => {
    const nama = item.nama.substring(0, width - 10);
    const harga = fmt(item.baseHarga || item.harga).replace('Rp', '');
    const subtotal = fmt(getPrinterItemSubtotal(item)).replace('Rp', '');
    const diskon = getPrinterDiscountAmount(item);

    if (cfg.posisiQty === 'belakang') {
      // Nama x Qty
      push(line(nama + ' x' + item.qty));
      push(CMD.ALIGN_RIGHT);
      push(line(subtotal));
      push(CMD.ALIGN_LEFT);
    } else {
      // Qty x Harga = Subtotal
      push(line(nama));
      const qtyLine = `  ${item.qty} x ${harga}`;
      push(cols(qtyLine, subtotal, width));
    }

    if (cfg.tampilSatuan === 'ya') push(line('  Satuan: ' + (item.unit || 'Pcs')));
    if (diskon > 0) push(line('  Diskon: ' + fmt(diskon).replace('Rp', 'Rp ')));
    if (item.keterangan) push(line('  Ket: ' + item.keterangan.substring(0, width - 2)));
  });

  push(divider(width, '-'));

  // Totals
  push(CMD.BOLD_ON);
  push(cols('TOTAL', fmt(trx.total).replace('Rp', 'Rp '), width));
  push(CMD.BOLD_OFF);

  if (trx.metodePembayaran === 'Tunai') {
    push(cols('Bayar', fmt(trx.bayar).replace('Rp', 'Rp '), width));
    push(cols('Kembali', fmt(trx.kembalian).replace('Rp', 'Rp '), width));
  }
  push(line('Metode: ' + trx.metodePembayaran));

  if (trx.catatan) {
    push(divider(width, '-'));
    push(line('Ket: ' + trx.catatan));
  }

  push(divider(width, '='));

  // Footer
  push(CMD.ALIGN_CENTER);
  if (cfg.tampilHemat === 'ya') {
    const hemat = trx.items.reduce((s, i) => s + getPrinterDiscountAmount(i), 0);
    if (hemat > 0) push(line('Anda hemat ' + fmt(hemat)));
  }
  if (outlet.catatan) push(line(outlet.catatan.substring(0, width)));
  push(line('Terima kasih!'));
  push(CMD.ALIGN_LEFT);

  // Cut & cash drawer
  push(CMD.FEED_3);
  if (cfg.autoCut === 'ya') push(CMD.CUT);
  if (cfg.cashDrawer === 'ya') push(CMD.CASH_DRAWER);

  return bytes;
}

// ===== CETAK STRUK =====
let _lastTrx = null;

async function cetakStruk() {
  if (!_lastTrx) { showToast('Tidak ada data transaksi'); return; }

  const cfg = getPrinterConfig();
  const btn = document.getElementById('struk-btn-print');

  // Check if BT connected
  if (!_btChar || !_btDevice?.gatt?.connected) {
    try {
      showToast('Mengecek koneksi printer...');
      await restoreBluetoothConnection();
    } catch (e) {
      _btChar = null;
    }

    if (!_btChar) {
      if (confirm('Printer Bluetooth belum terhubung.\n\nCetak via browser (PDF/Print)?')) {
        cetakViaBrowser(_lastTrx);
      } else {
        showToast('Hubungkan printer di Pengaturan > Printer');
      }
      return;
    }
  }

  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mencetak...'; }

  try {
    const bytes = buildInvoiceBytes(_lastTrx);
    await btWrite(bytes);
    showToast('Struk berhasil dicetak!');
  } catch (e) {
    showToast('Gagal cetak: ' + e.message);
    if (confirm('Gagal cetak Bluetooth.\nCetak via browser?')) {
      cetakViaBrowser(_lastTrx);
    }
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-print"></i> Cetak Struk'; }
  }
}

// ===== FALLBACK: BROWSER PRINT =====
function cetakViaBrowser(trx) {
  const cfg = getPrinterConfig();
  const outlet = DB.getObj('outlet');
  const width = cfg.ukuran === '58' ? '58mm' : '80mm';
  const tgl = new Date(trx.tanggal).toLocaleString('id-ID');
  const invoiceNo = getPrinterInvoiceNumber(trx);

  const itemsHtml = trx.items.map(item => `
    <tr>
      <td>${item.nama}</td>
      <td style="text-align:center;">${item.qty}</td>
      <td style="text-align:right;">${fmt(item.baseHarga || item.harga)}</td>
      <td style="text-align:right;">${fmt(getPrinterItemSubtotal(item))}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Struk - ${trx.id}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: ${width}; padding: 4px; }
  h2 { text-align:center; font-size:13px; margin-bottom:2px; }
  .center { text-align:center; }
  .divider { border-top: 1px dashed #000; margin: 4px 0; }
  table { width:100%; border-collapse:collapse; }
  td { padding: 1px 2px; }
  .total-row td { font-weight:bold; border-top:1px solid #000; }
  @media print { @page { margin:0; size: ${width} auto; } }
</style>
</head><body>
  ${outlet.nama ? `<h2>${outlet.nama}</h2>` : ''}
  ${outlet.alamat && cfg.tampilAlamat === 'ya' ? `<p class="center">${outlet.alamat}</p>` : ''}
  ${outlet.telp ? `<p class="center">Telp: ${outlet.telp}</p>` : ''}
  <div class="divider"></div>
  <p>No: ${invoiceNo}</p>
  ${cfg.tampilTglBayar !== 'tidak' ? `<p>Tgl: ${tgl}</p>` : ''}
  ${trx.pelanggan ? `<p>Pelanggan: ${trx.pelanggan}</p>` : ''}
  ${trx.noMeja ? `<p>Meja: ${trx.noMeja}</p>` : ''}
  ${trx.sales ? `<p>Sales: ${trx.sales}</p>` : ''}
  ${trx.tglJthTempo ? `<p>Jth Tempo: ${new Date(trx.tglJthTempo).toLocaleDateString('id-ID')}</p>` : ''}
  <div class="divider"></div>
  <table>
    <thead><tr><th style="text-align:left;">Produk</th><th>Qty</th><th style="text-align:right;">Harga</th><th style="text-align:right;">Sub</th></tr></thead>
    <tbody>${itemsHtml}</tbody>
    <tfoot>
      <tr class="total-row"><td colspan="3">TOTAL</td><td style="text-align:right;">${fmt(trx.total)}</td></tr>
      ${trx.metodePembayaran === 'Tunai' ? `
      <tr><td colspan="3">Bayar</td><td style="text-align:right;">${fmt(trx.bayar)}</td></tr>
      <tr><td colspan="3">Kembali</td><td style="text-align:right;">${fmt(trx.kembalian)}</td></tr>` : ''}
      <tr><td colspan="4">Metode: ${trx.metodePembayaran}</td></tr>
    </tfoot>
  </table>
  <div class="divider"></div>
  <p class="center">${outlet.catatan || 'Terima kasih!'}</p>
  <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500);}<\/script>
</body></html>`;

  const w = window.open('', '_blank', 'width=400,height=600');
  if (w) { w.document.write(html); w.document.close(); }
}

// ===== TEST PRINT =====
async function testPrint() {
  if (!_btChar) {
    showToast('Hubungkan printer terlebih dahulu');
    return;
  }
  const cfg = getPrinterConfig();
  const width = cfg.ukuran === '58' ? 32 : 42;
  const bytes = [
    ...CMD.INIT,
    ...CMD.ALIGN_CENTER,
    ...CMD.BOLD_ON,
    ...line('=== TEST PRINT ==='),
    ...CMD.BOLD_OFF,
    ...line('KONCOPOS'),
    ...line(new Date().toLocaleString('id-ID')),
    ...divider(width),
    ...line('Printer OK!'),
    ...CMD.FEED_3,
  ];
  if (cfg.autoCut === 'ya') bytes.push(...CMD.CUT);
  try {
    await btWrite(bytes);
    showToast('Test print berhasil!');
  } catch (e) {
    showToast('Gagal: ' + e.message);
  }
}

// ===== PENGATURAN PRINTER =====
function setPrinterMode(mode) {
  const manualBtn = document.getElementById('mode-manual');
  const autoBtn = document.getElementById('mode-auto');
  const manualIcon = document.getElementById('mode-manual-icon');
  const autoIcon = document.getElementById('mode-auto-icon');
  if (mode === 'manual') {
    manualBtn?.classList.add('active');
    autoBtn?.classList.remove('active');
    if (manualIcon) manualIcon.className = 'fa-regular fa-circle-dot';
    if (autoIcon) autoIcon.className = 'fa-regular fa-circle';
  } else {
    autoBtn?.classList.add('active');
    manualBtn?.classList.remove('active');
    if (autoIcon) autoIcon.className = 'fa-regular fa-circle-dot';
    if (manualIcon) manualIcon.className = 'fa-regular fa-circle';
  }
  const cfg = DB.getObj('printer');
  cfg.mode = mode;
  DB.setObj('printer', cfg);
}

function initPengaturanPrinter() {
  const cfg = getPrinterConfig();

  // Mode
  setPrinterMode(cfg.mode || 'manual');

  // BT status
  const nameEl = document.getElementById('printer-bt-name');
  if (cfg.btName && nameEl) nameEl.textContent = cfg.btName;
  if (_btChar && _btDevice?.gatt?.connected) {
    setBluetoothStatus('Terhubung', '#2ecc71', '<i class="fa-solid fa-link"></i> Terhubung', '#2ecc71');
  } else if (cfg.btName) {
    setBluetoothStatus('Printer tersimpan, tap Scan untuk izinkan sambung lagi');
  } else {
    setBluetoothStatus('Tap untuk scan printer');
  }

  // Settings
  const fields = {
    'ps-cash-drawer': cfg.cashDrawer || 'tidak',
    'ps-auto-cut':    cfg.autoCut    || 'tidak',
    'ps-ukuran':      cfg.ukuran     || '58',
    'ps-posisi-qty':  cfg.posisiQty  || 'depan',
    'ps-print-dapur': cfg.printDapur || 'tidak',
    'ps-satuan':      cfg.tampilSatuan || 'tidak',
    'ps-hemat':       cfg.tampilHemat  || 'ya',
    'ps-alamat':      cfg.tampilAlamat || 'tidak',
    'ps-tgl-bayar':   cfg.tampilTglBayar || 'ya',
    'ps-jenis-jual':  cfg.tampilJenisJual || 'tidak',
  };
  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function simpanPengaturanPrinter() {
  const cfg = getPrinterConfig();
  cfg.cashDrawer     = document.getElementById('ps-cash-drawer')?.value || 'tidak';
  cfg.autoCut        = document.getElementById('ps-auto-cut')?.value    || 'tidak';
  cfg.ukuran         = document.getElementById('ps-ukuran')?.value      || '58';
  cfg.posisiQty      = document.getElementById('ps-posisi-qty')?.value  || 'depan';
  cfg.printDapur     = document.getElementById('ps-print-dapur')?.value || 'tidak';
  cfg.tampilSatuan   = document.getElementById('ps-satuan')?.value      || 'tidak';
  cfg.tampilHemat    = document.getElementById('ps-hemat')?.value       || 'ya';
  cfg.tampilAlamat   = document.getElementById('ps-alamat')?.value      || 'tidak';
  cfg.tampilTglBayar = document.getElementById('ps-tgl-bayar')?.value   || 'ya';
  cfg.tampilJenisJual= document.getElementById('ps-jenis-jual')?.value  || 'tidak';
  DB.setObj('printer', cfg);
  showToast('Pengaturan printer disimpan!');
  switchScreen('pengaturan');
}

// ===== SCREEN INIT =====
document.addEventListener('screenInit', (e) => {
  if (e.detail.name === 'pengaturan-printer') initPengaturanPrinter();
});









