# Kasir Permissions Update - Simplified Structure

## Status: ✅ COMPLETED

## Changes Made

### 1. Updated Kasir Form HTML (`stitch/pages/tambah-kasir.html`)
- Simplified from 26 permissions to 14 permissions
- Removed category groupings and descriptions
- Matched screenshot design provided by user
- Clean, minimal UI with toggle switches

### 2. Updated JavaScript Function (`stitch/js/pengaturan.js`)
- Updated `simpanKasirBaru()` function to collect 14 new permission IDs
- Changed permission object structure to match new form

### 3. New Permission Structure (14 Permissions)

```javascript
const permissions = {
  ubahPOS: boolean,              // Boleh ubah POS
  ubahHarga: boolean,            // Boleh mengubah harga jual
  ubahDiskon: boolean,           // Boleh mengubah diskon
  printDraft: boolean,           // Print Draft
  kelolaMaster: boolean,         // Mengelola Master
  ubahTanggal: boolean,          // Boleh Ubah Tanggal
  tampilBiaya: boolean,          // Tampil Biaya & Pendapatan
  ubahBiaya: boolean,            // Boleh Ubah Biaya & Pendapatan
  tampilPembelian: boolean,      // Tampil Pembelian
  printPembelian: boolean,       // Tampil Print Pembelian
  tampilLaporan: boolean,        // Tampil Laporan
  riwayatPOS: boolean,           // Tampil Riwayat POS
  tampilRekapan: boolean,        // Tampil Rekapan
  tambahProdukManual: boolean,   // Tambah Produk Manual
};
```

### 4. Code.gs Schema
- ✅ Already supports permissions field
- Schema: `['id','userId','nama','telp','email','username','password','permissions','createdAt','updatedAt']`
- Permissions object is automatically JSON stringified when synced to Google Sheets

### 5. Sync Functionality
- ✅ No changes needed in sync.js
- `autoSync('kasir', 'create', kasir, kasir.id)` handles object serialization automatically
- Google Sheets stores permissions as JSON string

## Testing Checklist

- [ ] Open Tambah Kasir page - verify 14 permissions are displayed
- [ ] Fill in kasir details (nama, username, password)
- [ ] Toggle some permissions on/off
- [ ] Click Simpan button
- [ ] Verify kasir is saved to localStorage
- [ ] Verify kasir appears in kasir list
- [ ] Check Google Sheets - verify permissions field contains JSON string
- [ ] Edit existing kasir - verify permissions load correctly

## Files Modified

1. `stitch/pages/tambah-kasir.html` - Simplified permission checkboxes
2. `stitch/js/pengaturan.js` - Updated `simpanKasirBaru()` function

## Files Verified (No Changes Needed)

1. `stitch/gas/Code.gs` - Schema already supports permissions field
2. `stitch/js/sync.js` - Handles object serialization automatically

## Migration Notes

**Old Permission Structure (26 permissions):**
- Grouped into 5 categories
- Had detailed descriptions
- More granular control

**New Permission Structure (14 permissions):**
- Flat list, no categories
- Simplified labels
- Focused on essential permissions
- Matches user's screenshot design

**Backward Compatibility:**
- Existing kasir records with old permission structure will still work
- New kasir records will use new 14-permission structure
- No data migration needed - permissions are stored as objects

## Next Steps

1. Test kasir creation with new form
2. Verify sync to Google Sheets
3. Implement permission checking in relevant pages (POS, Laporan, etc.)
4. Update kasir edit functionality if needed

---

**Date:** 2026-04-14  
**Task:** Simplified kasir permissions from 26 to 14 based on user requirements
