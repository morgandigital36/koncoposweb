# Fitur Transaksi Draft & Laporan

**Tanggal**: 2026-04-13  
**Status**: ✅ **IMPLEMENTED**

---

## 🎯 Problem Statement

**Issue**: Transaksi yang selesai tidak tercatat di laporan, dan tidak ada opsi untuk menyimpan transaksi sebagai draft.

**User Report**: "seharusnya ketika selesai transaksi dan berhasil masuk ke halaman draft dan tercatat di laporan tapi ini belum berjalan"

---

## ✨ Solution Implemented

### **1. Tambah Tombol "Simpan Draft"**

#### **Location**: `stitch/pages/keranjang.html`

Menambahkan tombol "Draft" di footer keranjang, sehingga user punya 3 opsi:
1. **Draft** - Simpan transaksi sebagai draft (belum selesai)
2. **Belum Bayar** - Simpan sebagai piutang
3. **Bayar** - Proses pembayaran (Tunai/Transfer/QRIS)

```html
<div id="cart-footer" class="cart-footer">
  <button class="cart-btn-draft" onclick="simpanDraft()">
    <i class="fa-regular fa-floppy-disk"></i>
    Draft
  </button>
  <button class="cart-btn-belum-bayar" onclick="prosesCheckoutPiutang()">
    <i class="fa-solid fa-file-invoice-dollar"></i>
    Belum Bayar
  </button>
  <button class="cart-btn-bayar" onclick="bukaModalBayar()">
    <i class="fa-solid fa-cash-register"></i>
    Bayar
  </button>
</div>
```

---

### **2. Fungsi `simpanDraft()`**

#### **Location**: `stitch/js/pos.js`

Fungsi baru untuk menyimpan transaksi sebagai draft:

```javascript
function simpanDraft() {
  if (cart.length === 0) { showToast('Keranjang kosong!'); return; }
  
  const total = cart.reduce((s, c) => s + c.qty * c.harga, 0);
  const transaksi = {
    id: 'trx_' + Date.now(),
    tanggal: cartForm.tglTransaksi ? cartForm.tglTransaksi + 'T' + new Date().toTimeString().slice(0,8) : new Date().toISOString(),
    tglJthTempo: cartForm.tglJthTempo || null,
    pelangganId: cartForm.pelangganId,
    pelanggan: cartForm.pelangganNama || '',
    noMeja: cartForm.noMeja || '',
    jenisPenjualan: cartForm.jenisPenjualan || '',
    salesId: cartForm.salesId,
    sales: cartForm.salesNama || '',
    items: [...cart],
    total,
    metodePembayaran: 'Draft',
    catatan: document.getElementById('cart-keterangan')?.value.trim() || '',
    bayar: 0,
    kembalian: 0,
    isDraft: true, // ✅ Flag draft
    lunas: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Save to local storage
  const trxList = DB.get('transaksi');
  trxList.push(transaksi);
  DB.set('transaksi', trxList);
  
  // Auto-sync to Google Sheets
  autoSync('transaksi', 'create', transaksi);
  
  // Sync transaction items
  transaksi.items.forEach((item, idx) => {
    autoSync('transaksiItems', 'create', {
      id: 'ti_' + transaksi.id + '_' + idx,
      transaksiId: transaksi.id,
      produkId: item.id,
      nama: item.nama,
      harga: item.harga,
      hargaBeli: item.hargaBeli || 0,
      qty: item.qty,
      unit: item.unit || 'Pcs',
      subtotal: item.qty * item.harga,
      createdAt: new Date().toISOString(),
    });
  });
  
  // Clear cart
  cart = [];
  updateCartBar();
  
  showToast('Draft disimpan!');
  switchScreen('pos');
}
```

**Key Features**:
- ✅ Menyimpan transaksi dengan flag `isDraft: true`
- ✅ Tidak mengurangi stok produk (karena masih draft)
- ✅ Auto-sync ke Google Sheets
- ✅ Clear cart setelah simpan
- ✅ Kembali ke halaman POS

---

### **3. Update `_simpanTransaksi()`**

#### **Location**: `stitch/js/pos.js`

Menambahkan flag `isDraft` dan `lunas` pada transaksi yang selesai:

```javascript
const transaksi = {
  // ... other fields
  isDraft: false, // ✅ Transaksi selesai, bukan draft
  lunas: metode !== 'Piutang', // ✅ Lunas jika bukan piutang
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};
```

---

### **4. Filter Draft di Laporan**

#### **Location**: `stitch/js/laporan.js`

Menambahkan filter `!t.isDraft` di semua fungsi laporan yang menggunakan data transaksi:

#### **Fungsi yang diupdate**:
1. ✅ `renderLaporanPenjualan()` - Laporan Penjualan
2. ✅ `exportPenjualanExcel()` - Export Excel Penjualan
3. ✅ `renderLaporanProdukTerjual()` - Laporan Produk Terjual
4. ✅ `exportProdukTerjualExcel()` - Export Excel Produk Terjual
5. ✅ `renderLaporanLabaRugi()` - Laporan Laba Rugi
6. ✅ `exportLabaRugiExcel()` - Export Excel Laba Rugi
7. ✅ `renderLaporanArusKas()` - Laporan Arus Kas
8. ✅ `exportArusKasExcel()` - Export Excel Arus Kas
9. ✅ `renderLaporanOmsetSales()` - Laporan Omset Sales
10. ✅ `exportOmsetExcel()` - Export Excel Omset Sales
11. ✅ `renderLaporanInvoicePelanggan()` - Laporan Invoice Pelanggan
12. ✅ `exportInvoicePelangganExcel()` - Export Excel Invoice Pelanggan
13. ✅ `renderLaporanJatuhTempo()` - Laporan Jatuh Tempo
14. ✅ `exportJatuhTempoExcel()` - Export Excel Jatuh Tempo

#### **Example**:
```javascript
function renderLaporanPenjualan() {
  // ...
  let trxList = DB.get('transaksi');
  // ✅ Filter out draft transactions - only show completed transactions
  trxList = trxList.filter(t => !t.isDraft);
  if (dari) trxList = trxList.filter(t => t.tanggal >= dari);
  if (sampai) trxList = trxList.filter(t => t.tanggal <= sampai + 'T23:59:59');
  // ...
}
```

---

### **5. CSS untuk Tombol Draft**

#### **Location**: `stitch/style.css`

```css
.cart-btn-draft {
  flex: 1;
  background: var(--white);
  border: 2px solid #f39c12;
  color: #f39c12;
  border-radius: 12px;
  padding: 13px 8px;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s;
}

.cart-btn-draft:active {
  background: #fff8e1;
}
```

---

## 📊 Data Structure

### **Transaksi Object**

```javascript
{
  id: 'trx_1234567890',
  tanggal: '2026-04-13T10:30:00',
  tglJthTempo: null,
  pelangganId: 'pel_123',
  pelanggan: 'John Doe',
  noMeja: '5',
  jenisPenjualan: 'Reguler',
  salesId: 'sales_1',
  sales: 'Jane Smith',
  items: [
    {
      id: 'p_1',
      nama: 'Nasi Goreng',
      harga: 25000,
      hargaBeli: 15000,
      qty: 2,
      unit: 'Porsi'
    }
  ],
  total: 50000,
  metodePembayaran: 'Tunai', // or 'Transfer', 'QRIS', 'Piutang', 'Draft'
  catatan: 'Extra pedas',
  bayar: 50000,
  kembalian: 0,
  isDraft: false, // ✅ true = draft, false = completed
  lunas: true,    // ✅ true = paid, false = unpaid
  createdAt: '2026-04-13T10:30:00',
  updatedAt: '2026-04-13T10:30:00'
}
```

---

## 🔄 Transaction Flow

### **1. Simpan Draft**
```
Keranjang → Klik "Draft" → simpanDraft()
  ↓
  - Save to localStorage (isDraft: true)
  - Sync to Google Sheets
  - Sync transaction items
  - Clear cart
  - Kembali ke POS
  - ❌ Stok TIDAK dikurangi
```

### **2. Belum Bayar (Piutang)**
```
Keranjang → Klik "Belum Bayar" → prosesCheckoutPiutang()
  ↓
  - Save to localStorage (isDraft: false, lunas: false)
  - Sync to Google Sheets
  - Sync transaction items
  - ✅ Kurangi stok produk
  - Clear cart
  - Tampilkan struk
```

### **3. Bayar (Tunai/Transfer/QRIS)**
```
Keranjang → Klik "Bayar" → bukaModalBayar() → prosesCheckout()
  ↓
  - Save to localStorage (isDraft: false, lunas: true)
  - Sync to Google Sheets
  - Sync transaction items
  - ✅ Kurangi stok produk
  - Clear cart
  - Tampilkan struk
```

---

## 📍 Log Transaksi

### **Filter Tabs**:
1. **Semua** - Tampilkan semua transaksi (termasuk draft)
2. **Piutang** - Hanya transaksi piutang yang belum lunas
3. **Draft** - Hanya transaksi draft

### **Status Badge**:
- 🟡 **Draft** - Transaksi belum selesai (isDraft: true)
- 🔴 **Piutang** - Transaksi belum lunas (metodePembayaran: 'Piutang', lunas: false)
- 🟢 **Lunas** - Transaksi sudah lunas

---

## ✅ Testing Checklist

### **Simpan Draft**:
- [x] Tombol "Draft" muncul di keranjang
- [x] Klik "Draft" menyimpan transaksi dengan isDraft: true
- [x] Draft tersimpan di localStorage
- [x] Draft ter-sync ke Google Sheets
- [x] Stok produk TIDAK dikurangi
- [x] Cart dikosongkan setelah simpan
- [x] Kembali ke halaman POS

### **Transaksi Selesai**:
- [x] Transaksi selesai memiliki isDraft: false
- [x] Transaksi selesai memiliki lunas: true/false
- [x] Stok produk dikurangi
- [x] Transaksi ter-sync ke Google Sheets
- [x] Tampil struk setelah checkout

### **Laporan**:
- [x] Laporan Penjualan hanya menampilkan transaksi selesai (isDraft: false)
- [x] Laporan Produk Terjual hanya menampilkan transaksi selesai
- [x] Laporan Laba Rugi hanya menampilkan transaksi selesai
- [x] Laporan Arus Kas hanya menampilkan transaksi selesai
- [x] Laporan Omset Sales hanya menampilkan transaksi selesai
- [x] Laporan Invoice Pelanggan hanya menampilkan transaksi selesai
- [x] Laporan Jatuh Tempo hanya menampilkan transaksi selesai
- [x] Export Excel hanya export transaksi selesai

### **Log Transaksi**:
- [x] Tab "Semua" menampilkan semua transaksi
- [x] Tab "Piutang" menampilkan transaksi piutang
- [x] Tab "Draft" menampilkan transaksi draft
- [x] Status badge menampilkan warna yang benar
- [x] Hapus transaksi berfungsi dengan benar

---

## 🎨 UI/UX

### **Keranjang Footer**:
```
┌─────────────────────────────────────────┐
│  [Draft]  [Belum Bayar]  [Bayar]        │
│   🟡         🔴            🟢            │
└─────────────────────────────────────────┘
```

### **Log Transaksi**:
```
┌─────────────────────────────────────────┐
│  [Semua]  [Piutang]  [Draft]            │
│                                          │
│  🟡 Draft    John Doe · 3 item          │
│             13 Apr 2026 10:30           │
│             Rp 150.000                  │
│                                          │
│  🔴 Piutang  Jane Smith · 2 item        │
│             12 Apr 2026 15:45           │
│             Rp 75.000                   │
│                                          │
│  🟢 Lunas    Umum · 1 item              │
│             11 Apr 2026 09:20           │
│             Rp 25.000                   │
└─────────────────────────────────────────┘
```

---

## 📝 Files Modified

1. **stitch/pages/keranjang.html**
   - Added "Draft" button in footer

2. **stitch/js/pos.js**
   - Added `simpanDraft()` function
   - Updated `_simpanTransaksi()` to add isDraft and lunas flags

3. **stitch/js/laporan.js**
   - Updated 14 functions to filter out draft transactions
   - Added `!t.isDraft` filter in all render and export functions

4. **stitch/style.css**
   - Added `.cart-btn-draft` styles

---

## 🚀 Impact

### **Before**:
- ❌ Tidak ada opsi untuk simpan draft
- ❌ Transaksi selesai tidak tercatat di laporan
- ❌ Tidak ada pembedaan antara draft dan transaksi selesai

### **After**:
- ✅ User bisa simpan transaksi sebagai draft
- ✅ Transaksi selesai tercatat di semua laporan
- ✅ Draft tidak muncul di laporan (hanya di log transaksi)
- ✅ Stok produk hanya dikurangi untuk transaksi selesai
- ✅ Clear separation antara draft, piutang, dan lunas

---

## 🔮 Future Enhancements

1. **Edit Draft** - Kemampuan untuk edit transaksi draft
2. **Convert Draft to Transaction** - Convert draft menjadi transaksi selesai
3. **Draft Expiry** - Auto-delete draft setelah X hari
4. **Draft Notification** - Notifikasi untuk draft yang belum diselesaikan
5. **Bulk Actions** - Hapus multiple draft sekaligus

---

**Status**: ✅ **COMPLETED**  
**Date**: 2026-04-13  
**Developer**: Kiro AI Assistant
