// KONCOWRB v3 — Google Apps Script
// Cara: Extensions > Apps Script > paste semua ini > Save > Run setupDatabase
var SS = SpreadsheetApp.getActiveSpreadsheet();


var SHEETS = {
  users:'Users', sessions:'Sessions',
  produk:'Produk', kategori:'Kategori Produk',
  pelanggan:'Pelanggan', supplier:'Supplier', sales:'Sales',
  kurir:'Kurir', kasir:'Kasir',
  jenisPenjualan:'Jenis Penjualan', metodePembayaran:'Metode Pembayaran',
  kategoriBiaya:'Kategori Biaya',
  transaksi:'Transaksi', transaksiItems:'Transaksi Items',
  pembelian:'Pembelian', mutasi:'Mutasi Stok', biaya:'Biaya',
  laporanPenjualan:'Laporan Penjualan', laporanPembelian:'Laporan Pembelian',
  laporanStok:'Laporan Stok', laporanLabaRugi:'Laporan Laba Rugi',
  laporanArusKas:'Laporan Arus Kas', laporanPiutang:'Laporan Piutang',
  laporanHutang:'Laporan Hutang', laporanOmsetSales:'Laporan Omset Sales',
  laporanInvoicePelanggan:'Laporan Invoice Pelanggan', laporanInvoiceSupplier:'Laporan Invoice Supplier',
  laporanJatuhTempo:'Laporan Jatuh Tempo',
  outlet:'Outlet', settings:'Settings', syncLog:'Sync Log'
};


var SCHEMAS = {
  'Users':['id','namaLengkap','email','password','namaUsaha','jenisUsaha','telp','role','status','createdAt','lastLogin'],
  'Sessions':['token','userId','email','namaUsaha','createdAt','expiresAt'],
  'Produk':['id','userId','nama','kategori','varian','hargaBeli','hargaJual','diskonPct','diskonRp','kode','unit','barcode','keterangan','tipeModal','pantauStok','stokMinimal','stokAwal','stok','totalModal','foto','varians','grosirs','createdAt','updatedAt'],
  'Kategori Produk':['id','userId','nama','createdAt'],
  'Pelanggan':['id','userId','nama','telp','email','alamat','ket','createdAt','updatedAt'],
  'Supplier':['id','userId','nama','telp','email','alamat','ket','createdAt','updatedAt'],
  'Sales':['id','userId','nama','telp','email','alamat','ket','createdAt','updatedAt'],
  'Kurir':['id','userId','nama','telp','email','alamat','ket','createdAt','updatedAt'],
  'Kasir':['id','userId','nama','telp','email','username','password','permissions','createdAt','updatedAt'],
  'Jenis Penjualan':['id','userId','nama','createdAt'],
  'Metode Pembayaran':['id','userId','nama','createdAt'],
  'Kategori Biaya':['id','userId','nama','createdAt'],
  'Transaksi':['id','userId','tanggal','tglJthTempo','pelangganId','pelanggan','noMeja','jenisPenjualan','salesId','sales','items','total','metodePembayaran','catatan','bayar','kembalian','lunas','isDraft','createdAt','updatedAt'],
  'Transaksi Items':['id','userId','transaksiId','produkId','nama','harga','hargaBeli','qty','unit','subtotal','createdAt'],
  'Pembelian':['id','userId','tanggal','supplierId','supplierNama','produkId','produkNama','unit','jumlah','harga','total','status','tglJthTempo','keterangan','createdAt'],
  'Mutasi Stok':['id','userId','tanggal','produkId','produkNama','tipe','jumlah','keterangan','createdAt'],
  'Biaya':['id','userId','tanggal','metode','kategori','nominal','tipe','keterangan','masukLabaRugi','createdAt'],
  'Laporan Penjualan':['userId','tanggal','invoiceId','pelanggan','items','total','metode','status','kasir'],
  'Laporan Pembelian':['userId','tanggal','produk','supplier','jumlah','harga','total','status'],
  'Laporan Stok':['userId','produk','kategori','stokAwal','masuk','keluar','stokAkhir','nilaiStok'],
  'Laporan Laba Rugi':['userId','periode','pendapatan','hpp','labaKotor','biaya','pendapatanLain','labaBersih'],
  'Laporan Arus Kas':['userId','tanggal','keterangan','tipe','nominal','saldo'],
  'Laporan Piutang':['userId','tanggal','invoiceId','pelanggan','total','status','tglJthTempo'],
  'Laporan Hutang':['userId','tanggal','produk','supplier','total','status'],
  'Laporan Omset Sales':['userId','salesId','salesNama','totalTransaksi','totalOmset','totalLaba'],
  'Laporan Invoice Pelanggan':['userId','tanggal','invoiceId','pelanggan','items','total','metode','status','tglJthTempo'],
  'Laporan Invoice Supplier':['userId','tanggal','invoiceId','supplier','produk','jumlah','total','status','tglJthTempo'],
  'Laporan Jatuh Tempo':['userId','tanggal','tipe','invoiceId','pihak','total','tglJthTempo','selisihHari','status'],
  'Outlet':['id','userId','key','value','updatedAt'],
  'Settings':['userId','key','value'],
  'Sync Log':['waktu','userId','aksi','sheet','jumlah','status','pesan']
};

var JSON_FIELDS = {
  produk: { varians:true, grosirs:true },
  kasir: { permissions:true },
  transaksi: { items:true }
};

var NAMED_MASTER_CONFIG = {
  kategori: { prefix:'kat' },
  metodePembayaran: { prefix:'mp' },
  jenisPenjualan: { prefix:'jp' },
  kategoriBiaya: { prefix:'kb' }
};


// ===== ENTRY POINTS =====
function doGet(e) {
  try {
    var p = e.parameter, action = p.action||'', token = p.token||'';
    if (action==='ping')  return respond(doPing());
    if (action==='setup') return respond(setupDatabase());
    var user = validateToken(token);
    if (!user) return respond({error:'Unauthorized',code:401});
    if (action==='read')        return respond(readAllUser(p.sheet, user.id));
    if (action==='readOne')     return respond(readOne(p.sheet, p.id, user.id));
    if (action==='pullAll')     return respond(pullAll(user.id));
    if (action==='readLaporan') return respond(readAllUser(p.sheet, user.id));
    if (action==='profile')     return respond({user:safeUser(user)});
    return respond({error:'Unknown action: '+action});
  } catch(err) { return respond({error:err.message}); }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action||'', token = body.token||'';
    if (action==='register') return respond(doRegister(body));
    if (action==='login')    return respond(doLogin(body));
    if (action==='setup')    return respond(setupDatabase());
    var user = validateToken(token);
    if (!user) return respond({error:'Unauthorized',code:401});
    if (action==='logout')          return respond(doLogout(token));
    if (action==='create')          return respond(createRow(body.sheet, body.data, user.id));
    if (action==='update')          return respond(updateRow(body.sheet, body.id, body.data, user.id));
    if (action==='delete')          return respond(deleteRow(body.sheet, body.id, user.id));
    if (action==='upsert')          return respond(upsertRow(body.sheet, body.data, user.id));
    if (action==='bulkSync')        return respond(bulkSyncUser(body.sheet, body.rows, user.id));
    if (action==='pushAll')         return respond(pushAll(body.data, user.id));
    if (action==='generateLaporan') return respond(generateAllLaporan(user.id));
    if (action==='updateProfile')   return respond(updateProfile(user.id, body.data));
    return respond({error:'Unknown action: '+action});
  } catch(err) { return respond({error:err.message}); }
}


// ===== SETUP DATABASE =====
function setupDatabase() {
  var created=[], existing=[];
  var sheetNames = Object.keys(SCHEMAS);
  for (var i=0; i<sheetNames.length; i++) {
    var name = sheetNames[i];
    var sh = SS.getSheetByName(name);
    if (!sh) {
      sh = SS.insertSheet(name);
      var headers = SCHEMAS[name];
      sh.getRange(1,1,1,headers.length).setValues([headers]);
      var isAuth    = (name==='Users'||name==='Sessions');
      var isLaporan = (name.indexOf('Laporan')===0);
      var bg = isAuth ? '#1a1a2e' : isLaporan ? '#2c3e50' : '#e8637a';
      sh.getRange(1,1,1,headers.length).setBackground(bg).setFontColor('#fff').setFontWeight('bold');
      sh.setFrozenRows(1);
      created.push(name);
    } else {
      existing.push(name);
      ensureSheetSchema_(sh, SCHEMAS[name]);
    }
  }
  var seededOwner = ensureDefaultOwnerAccount_();
  try {
    SpreadsheetApp.getUi().alert(
      'Setup selesai!\nDibuat: '+created.length+'\nSudah ada: '+existing.length+
      '\nAkun default: ' + seededOwner.email +
      '\nPassword default: owner123' +
      '\n\nLangkah deploy:\n1. Deploy > New deployment\n2. Web App\n3. Execute as: Me\n4. Access: Anyone\n5. Copy URL'
    );
  } catch(e) {}
  return {status:'ok', created:created, existing:existing, defaultOwner:seededOwner};
}

function ensureSheetSchema_(sh, expectedHeaders) {
  var existingHeaders = getHeaders(sh);
  if (!existingHeaders.length) {
    sh.getRange(1,1,1,expectedHeaders.length).setValues([expectedHeaders]);
    sh.setFrozenRows(1);
    return;
  }
  for (var i = 0; i < expectedHeaders.length; i++) {
    if (existingHeaders[i] === expectedHeaders[i]) continue;
    if (existingHeaders.indexOf(expectedHeaders[i]) === -1) {
      sh.insertColumnAfter(Math.max(i, sh.getLastColumn()));
      sh.getRange(1, i + 1).setValue(expectedHeaders[i]);
      existingHeaders.splice(i, 0, expectedHeaders[i]);
    }
  }
}

function getNamedMasterConfig_(sheetKey) {
  return NAMED_MASTER_CONFIG[sheetKey] || null;
}

function normalizeName_(value) {
  return trim(value || '').toLowerCase();
}

function slugifyName_(value) {
  return normalizeName_(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function prepareNamedMasterData_(sheetKey, data) {
  var cfg = getNamedMasterConfig_(sheetKey);
  if (!cfg || !data) return data;
  data.nama = trim(data.nama || '');
  if (!data.id && data.nama) data.id = cfg.prefix + '_' + slugifyName_(data.nama);
  return data;
}

function findExistingNamedMasterRow_(sheetKey, nama, uid) {
  var cfg = getNamedMasterConfig_(sheetKey);
  if (!cfg || !nama) return null;
  var sh = getSheet(sheetKey), all = sh.getDataRange().getValues(), headers = all[0];
  var idCol = headers.indexOf('id'), uidCol = headers.indexOf('userId'), namaCol = headers.indexOf('nama');
  var targetName = normalizeName_(nama);
  if (namaCol === -1) return null;
  for (var i = 1; i < all.length; i++) {
    if (uidCol !== -1 && uid && String(all[i][uidCol]) !== String(uid)) continue;
    if (normalizeName_(all[i][namaCol]) === targetName) {
      return { rowIdx:i, id:all[i][idCol] };
    }
  }
  return null;
}

function dedupeNamedMasterRows_(sheetKey, rows) {
  var cfg = getNamedMasterConfig_(sheetKey);
  if (!cfg || !rows || !rows.length) return rows || [];
  var seen = {}, result = [];
  rows.forEach(function(row){
    row = prepareNamedMasterData_(sheetKey, row || {});
    var namaKey = normalizeName_(row.nama);
    if (!namaKey) return;
    if (seen[namaKey]) return;
    seen[namaKey] = true;
    result.push(row);
  });
  return result;
}


// ===== AUTH =====
function doRegister(body) {
  var email=trim(body.email||'').toLowerCase(), pw=trim(body.password||'');
  var nama=trim(body.namaLengkap||''), usaha=trim(body.namaUsaha||'');
  var jenis=trim(body.jenisUsaha||''), telp=trim(body.telp||'');
  if (!email) return {error:'Email wajib'};
  if (!pw||pw.length<6) return {error:'Password min 6 karakter'};
  if (!nama)  return {error:'Nama lengkap wajib'};
  if (!usaha) return {error:'Nama usaha wajib'};
  if (!jenis) return {error:'Jenis usaha wajib'};
  var sh=getSheet('users'), data=sh.getDataRange().getValues(), headers=data[0];
  var emailCol=headers.indexOf('email');
  for (var i=1;i<data.length;i++) {
    if (String(data[i][emailCol]).toLowerCase()===email) return {error:'Email sudah terdaftar'};
  }
  var now=new Date().toISOString(), uid=genId();
  var user={id:uid,namaLengkap:nama,email:email,password:hashPw(pw),
    namaUsaha:usaha,jenisUsaha:jenis,telp:telp,role:'owner',status:'active',
    createdAt:now,lastLogin:now};
  sh.appendRow(headers.map(function(h){return user[h]!==undefined?user[h]:''}));
  var token=createSession(uid,email,usaha);
  setupDefaultData(uid,usaha,jenis);
  addLog(uid,'register','Users',1,'ok',email);
  return {status:'ok',token:token,user:safeUser(user),message:'Registrasi berhasil! Selamat datang, '+nama};
}

function doLogin(body) {
  var email=trim(body.email||'').toLowerCase(), pw=trim(body.password||'');
  if (!email||!pw) return {error:'Email dan password wajib'};
  var sh=getSheet('users'), data=sh.getDataRange().getValues(), headers=data[0];
  var user=null;
  for (var i=1;i<data.length;i++) {
    var obj={}; headers.forEach(function(h,j){obj[h]=data[i][j]});
    if (String(obj.email).toLowerCase()===email){user=obj;break;}
  }
  if (!user) return {error:'Email tidak ditemukan'};
  if (user.status==='inactive') return {error:'Akun dinonaktifkan'};
  if (!checkPw(pw,user.password)) return {error:'Password salah'};
  updateRow('users',user.id,{lastLogin:new Date().toISOString()},user.id);
  var token=createSession(user.id,user.email,user.namaUsaha);
  addLog(user.id,'login','Users',1,'ok',email);
  return {status:'ok',token:token,user:safeUser(user),message:'Login berhasil! Selamat datang, '+user.namaLengkap};
}

function doLogout(token) {
  var sh=getSheet('sessions'), data=sh.getDataRange().getValues(), headers=data[0];
  var col=headers.indexOf('token');
  for (var i=1;i<data.length;i++) {
    if (String(data[i][col])===token){sh.deleteRow(i+1);break;}
  }
  return {status:'ok',message:'Logout berhasil'};
}

function updateProfile(userId,data) {
  var allowed=['namaLengkap','namaUsaha','jenisUsaha','telp'];
  var upd={};
  allowed.forEach(function(k){if(data[k]!==undefined)upd[k]=data[k]});
  if (data.nama!==undefined) upd.namaLengkap=data.nama;
  if (data.email!==undefined) upd.email=data.email;
  if (data.password&&data.password.length>=6) upd.password=hashPw(data.password);
  return updateRow('users',userId,upd,userId);
}

function validateToken(token) {
  if (!token) return null;
  var sh=getSheet('sessions'), data=sh.getDataRange().getValues(), headers=data[0];
  var now=new Date();
  for (var i=1;i<data.length;i++) {
    var obj={}; headers.forEach(function(h,j){obj[h]=data[i][j]});
    if (obj.token===token) {
      if (new Date(obj.expiresAt)<now){sh.deleteRow(i+1);return null;}
      return getUserById(obj.userId);
    }
  }
  return null;
}

function getUserById(uid) {
  var sh=getSheet('users'), data=sh.getDataRange().getValues(), headers=data[0];
  var col=headers.indexOf('id');
  for (var i=1;i<data.length;i++) {
    if (String(data[i][col])===String(uid)) {
      var obj={}; headers.forEach(function(h,j){obj[h]=data[i][j]}); return obj;
    }
  }
  return null;
}

function createSession(uid,email,namaUsaha) {
  var token=genToken(), now=new Date();
  var exp=new Date(now.getTime()+30*24*60*60*1000);
  getSheet('sessions').appendRow([token,uid,email,namaUsaha,now.toISOString(),exp.toISOString()]);
  return token;
}

function safeUser(u) {
  return {id:u.id,namaLengkap:u.namaLengkap,email:u.email,namaUsaha:u.namaUsaha,
    jenisUsaha:u.jenisUsaha,telp:u.telp,role:u.role,createdAt:u.createdAt};
}

function hashPw(pw) {
  var salt='KONCOWRB2026', h='';
  for (var i=0;i<pw.length;i++) h+=String.fromCharCode(pw.charCodeAt(i)^salt.charCodeAt(i%salt.length));
  return Utilities.base64Encode(h+':'+pw.length);
}
function checkPw(pw,hashed){return hashPw(pw)===hashed;}

function setupDefaultData(uid,usaha,jenis) {
  var now=new Date().toISOString();
  var shKat=getSheet('kategori'), hKat=getHeaders(shKat);
  ['Makanan','Minuman','Snack','Lainnya'].forEach(function(n){
    shKat.appendRow(hKat.map(function(h){return {id:genId(),userId:uid,nama:n,createdAt:now}[h]||''}));
  });
  var shMet=getSheet('metodePembayaran'), hMet=getHeaders(shMet);
  ['Tunai','Transfer','QRIS','Piutang'].forEach(function(n){
    shMet.appendRow(hMet.map(function(h){return {id:genId(),userId:uid,nama:n,createdAt:now}[h]||''}));
  });
  var shOut=getSheet('outlet');
  [
    ['outlet_nama',uid,'nama',usaha,now],
    ['outlet_jenisUsaha',uid,'jenisUsaha',jenis,now],
    ['outlet_catatan',uid,'catatan','Terima kasih!',now]
  ].forEach(function(r){shOut.appendRow(r)});
}

function ensureDefaultOwnerAccount_() {
  var email = 'owner@gmail.com';
  var password = 'owner123';
  var sh = getSheet('users');
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var emailCol = headers.indexOf('email');
  var idCol = headers.indexOf('id');
  var passwordCol = headers.indexOf('password');
  var lastLoginCol = headers.indexOf('lastLogin');
  var statusCol = headers.indexOf('status');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailCol]).toLowerCase() === email) {
      var existingId = data[i][idCol] || genId();
      if (!data[i][idCol]) sh.getRange(i + 1, idCol + 1).setValue(existingId);
      if (passwordCol !== -1) sh.getRange(i + 1, passwordCol + 1).setValue(hashPw(password));
      if (lastLoginCol !== -1) sh.getRange(i + 1, lastLoginCol + 1).setValue(new Date().toISOString());
      if (statusCol !== -1) sh.getRange(i + 1, statusCol + 1).setValue('active');
      return { email: email, password: password, userId: existingId, created: false };
    }
  }

  var now = new Date().toISOString();
  var uid = genId();
  var user = {
    id: uid,
    namaLengkap: 'Owner Default',
    email: email,
    password: hashPw(password),
    namaUsaha: 'Usaha Default',
    jenisUsaha: 'Warung / Toko Kelontong',
    telp: '',
    role: 'owner',
    status: 'active',
    createdAt: now,
    lastLogin: now
  };
  sh.appendRow(headers.map(function(h){ return user[h] !== undefined ? user[h] : ''; }));
  setupDefaultData(uid, user.namaUsaha, user.jenisUsaha);
  addLog(uid, 'seed-owner', 'Users', 1, 'ok', email);
  return { email: email, password: password, userId: uid, created: true };
}


// ===== CRUD =====
function readAllUser(sheetKey,uid) {
  var sh=getSheet(sheetKey), last=sh.getLastRow();
  if (last<=1) return {rows:[],count:0};
  var data=sh.getRange(1,1,last,sh.getLastColumn()).getValues();
  var headers=data[0], uidCol=headers.indexOf('userId');
  var rows=data.slice(1).filter(function(r){
    return uidCol===-1||String(r[uidCol])===String(uid);
  }).map(function(r){
    var o={}; headers.forEach(function(h,i){o[h]=decodeSheetValue_(sheetKey, h, r[i])}); return o;
  });
  return {rows:rows,count:rows.length};
}

function readOne(sheetKey,id,uid) {
  var sh=getSheet(sheetKey), data=sh.getDataRange().getValues(), headers=data[0];
  var idCol=headers.indexOf('id'), uidCol=headers.indexOf('userId');
  for (var i=1;i<data.length;i++) {
    if (String(data[i][idCol])===String(id)) {
      if (uidCol!==-1&&uid&&String(data[i][uidCol])!==String(uid)) return {error:'Akses ditolak'};
      var o={}; headers.forEach(function(h,j){o[h]=decodeSheetValue_(sheetKey, h, data[i][j])}); return {row:o};
    }
  }
  return {row:null};
}

function createRow(sheetKey,data,uid) {
  var sh=getSheet(sheetKey), headers=getHeaders(sh), now=new Date().toISOString();
  data = prepareNamedMasterData_(sheetKey, data || {});
  var existingByName = findExistingNamedMasterRow_(sheetKey, data.nama, uid);
  if (existingByName) {
    data.id = existingByName.id;
    return updateRow(sheetKey, existingByName.id, data, uid);
  }
  if (!data.id) data.id=genId();
  if (!data.createdAt) data.createdAt=now;
  if (headers.indexOf('updatedAt')!==-1) data.updatedAt=now;
  if (headers.indexOf('userId')!==-1&&uid) data.userId=uid;
  if (sheetKey==='outlet' && !data.id) data.id='outlet_'+String(data.key||genId());
  sh.appendRow(headers.map(function(h){return encodeSheetValue_(sheetKey, h, data[h])}));
  addLog(uid,'create',sheetKey,1,'ok',data.id);
  return {status:'ok',id:data.id};
}

function updateRow(sheetKey,id,data,uid) {
  var sh=getSheet(sheetKey), all=sh.getDataRange().getValues(), headers=all[0];
  var idCol=headers.indexOf('id'), uidCol=headers.indexOf('userId'), rowIdx=-1;
  for (var i=1;i<all.length;i++) {
    if (String(all[i][idCol])===String(id)) {
      if (uidCol!==-1&&uid&&String(all[i][uidCol])!==String(uid)) return {error:'Akses ditolak'};
      rowIdx=i; break;
    }
  }
  if (rowIdx===-1) return {error:'Data tidak ditemukan'};
  data.updatedAt=new Date().toISOString();
  headers.forEach(function(h,c){if(data[h]!==undefined)sh.getRange(rowIdx+1,c+1).setValue(encodeSheetValue_(sheetKey, h, data[h]))});
  addLog(uid,'update',sheetKey,1,'ok',id);
  return {status:'ok',id:id};
}

function deleteRow(sheetKey,id,uid) {
  var sh=getSheet(sheetKey), all=sh.getDataRange().getValues(), headers=all[0];
  var idCol=headers.indexOf('id'), uidCol=headers.indexOf('userId'), rowIdx=-1;
  for (var i=1;i<all.length;i++) {
    if (String(all[i][idCol])===String(id)) {
      if (uidCol!==-1&&uid&&String(all[i][uidCol])!==String(uid)) return {error:'Akses ditolak'};
      rowIdx=i; break;
    }
  }
  if (rowIdx===-1) return {error:'Data tidak ditemukan'};
  if (sheetKey==='transaksi') deleteTransaksiItemsByTransaksiId_(id, uid);
  sh.deleteRow(rowIdx+1);
  addLog(uid,'delete',sheetKey,1,'ok',id);
  return {status:'ok',id:id};
}

function upsertRow(sheetKey,data,uid) {
  data = prepareNamedMasterData_(sheetKey, data || {});
  if (sheetKey==='outlet') {
    data.id = data.id || ('outlet_' + String(data.key || 'unknown'));
  }
  if (!data.id) {
    var existingNamed = findExistingNamedMasterRow_(sheetKey, data.nama, uid);
    if (existingNamed) {
      data.id = existingNamed.id;
      return updateRow(sheetKey, existingNamed.id, data, uid);
    }
    return createRow(sheetKey,data,uid);
  }
  var ex=readOne(sheetKey,data.id,uid);
  if (!ex.row) {
    var existingByName = findExistingNamedMasterRow_(sheetKey, data.nama, uid);
    if (existingByName) {
      data.id = existingByName.id;
      return updateRow(sheetKey, existingByName.id, data, uid);
    }
  }
  return ex.row ? updateRow(sheetKey,data.id,data,uid) : createRow(sheetKey,data,uid);
}

function bulkSyncUser(sheetKey,rows,uid) {
  var sh=getSheet(sheetKey), headers=getHeaders(sh), uidCol=headers.indexOf('userId');
  rows = dedupeNamedMasterRows_(sheetKey, rows || []);
  var all=sh.getDataRange().getValues();
  for (var i=all.length-1;i>=1;i--) {
    if (uidCol!==-1&&String(all[i][uidCol])===String(uid)) sh.deleteRow(i+1);
  }
  if (!rows||!rows.length) return {status:'ok',count:0};
  var now=new Date().toISOString();
  var newRows=rows.map(function(d){
    d = prepareNamedMasterData_(sheetKey, d || {});
    if (!d.id) d.id=genId();
    if (!d.createdAt) d.createdAt=now;
    if (uidCol!==-1) d.userId=uid;
    return headers.map(function(h){return encodeSheetValue_(sheetKey, h, d[h])});
  });
  sh.getRange(sh.getLastRow()+1,1,newRows.length,headers.length).setValues(newRows);
  return {status:'ok',count:newRows.length};
}


// ===== PUSH ALL / PULL ALL =====
function pushAll(data,uid) {
  if (!data) return {error:'Data kosong'};
  var results={};
  var map={
    produk:'produk', kategori:'kategori', transaksi:'transaksi',
    pembelian:'pembelian', mutasi:'mutasi', biaya:'biaya',
    pelanggan:'pelanggan', supplier:'supplier', sales:'sales',
    kurir:'kurir', kasir:'kasir',
    jenisPenjualan:'jenisPenjualan', metodePembayaran:'metodePembayaran',
    kategoriBiaya:'kategoriBiaya'
  };
  Object.keys(map).forEach(function(k){
    if (data[k]!==undefined) {
      try{results[k]=bulkSyncUser(map[k],data[k],uid);}
      catch(e){results[k]={error:e.message};}
    }
  });
  if (data.transaksi) {
    try {
      var items=[], now=new Date().toISOString();
      data.transaksi.forEach(function(t){
        var arr=typeof t.items==='string'?JSON.parse(t.items):t.items;
        if (Array.isArray(arr)) arr.forEach(function(item,idx){
          items.push({
            id:item.id||('ti_'+t.id+'_'+idx),
            userId:uid,
            transaksiId:t.id,
            produkId:item.id,
            nama:item.nama,
            harga:item.harga,
            hargaBeli:item.hargaBeli||0,
            qty:item.qty,
            unit:item.unit||'Pcs',
            subtotal:item.qty*item.harga,
            createdAt:now
          });
        });
      });
      results.transaksiItems=bulkSyncUser('transaksiItems',items,uid);
    } catch(e){results.transaksiItems={error:e.message};}
  }
  if (data.outlet) {
    try {
      var sh=getSheet('outlet'), all=sh.getDataRange().getValues(), headers=all[0];
      var uc=headers.indexOf('userId');
      for (var i=all.length-1;i>=1;i--) if(String(all[i][uc])===String(uid)) sh.deleteRow(i+1);
      var oRows=Object.keys(data.outlet).map(function(k){
        var v=data.outlet[k];
        return ['outlet_'+k,uid,k,typeof v==='object'?JSON.stringify(v):String(v),new Date().toISOString()];
      });
      if (oRows.length) sh.getRange(sh.getLastRow()+1,1,oRows.length,5).setValues(oRows);
      results.outlet={status:'ok'};
    } catch(e){results.outlet={error:e.message};}
  }
  try{generateAllLaporan(uid);results.laporan={status:'ok'};}
  catch(e){results.laporan={error:e.message};}
  addLog(uid,'pushAll','ALL',Object.keys(results).length,'ok',new Date().toISOString());
  return {status:'ok',results:results,syncTime:new Date().toISOString()};
}

function pullAll(uid) {
  var result={};
  // key = nama yang dikembalikan ke JS, value = sheet key di SHEETS map
  var map={
    produk:'produk', kategori:'kategori', transaksi:'transaksi',
    pembelian:'pembelian', mutasi:'mutasi', biaya:'biaya',
    pelanggan:'pelanggan', supplier:'supplier', sales:'sales',
    kurir:'kurir', kasir:'kasir',
    jenisPenjualan:'jenisPenjualan', metodePembayaran:'metodePembayaran',
    kategoriBiaya:'kategoriBiaya'
  };
  Object.keys(map).forEach(function(k){
    try{result[k]=readAllUser(map[k],uid).rows;}catch(e){result[k]=[];}
  });
  try {
    var oRows=readAllUser('outlet',uid).rows, outlet={};
    oRows.forEach(function(r){outlet[r.key]=r.value});
    result.outlet=outlet;
  } catch(e){result.outlet={};}
  addLog(uid,'pullAll','ALL',1,'ok','Pull berhasil');
  return {status:'ok',data:result,syncTime:new Date().toISOString()};
}


// ===== LAPORAN =====
function generateAllLaporan(uid) {
  genLapPenjualan(uid); genLapPembelian(uid); genLapStok(uid);
  genLapLabaRugi(uid); genLapArusKas(uid); genLapPiutang(uid); genLapHutang(uid);
  genLapOmsetSales(uid); genLapInvoicePelanggan(uid); genLapInvoiceSupplier(uid); genLapJatuhTempo(uid);
  return {status:'ok'};
}

function delUserRows(sh,uid) {
  var all=sh.getDataRange().getValues(), uc=all[0].indexOf('userId');
  if (uc===-1) return;
  for (var i=all.length-1;i>=1;i--) if(String(all[i][uc])===String(uid)) sh.deleteRow(i+1);
}

function genLapPenjualan(uid) {
  var sh=getSheet('laporanPenjualan'); delUserRows(sh,uid);
  var list=readAllUser('transaksi',uid).rows.filter(function(t){return !t.isDraft;}); if(!list.length) return;
  var h=getHeaders(sh);
  var rows=list.map(function(t){return h.map(function(k){
    var m={userId:uid,tanggal:t.tanggal,invoiceId:t.id,pelanggan:t.pelanggan||'Umum',
      items:t.items?JSON.stringify(t.items):'',total:t.total,metode:t.metodePembayaran,
      status:t.lunas?'Lunas':(t.metodePembayaran==='Piutang'?'Piutang':'Lunas'),kasir:t.sales||''};
    return m[k]!==undefined?m[k]:'';
  })});
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapPembelian(uid) {
  var sh=getSheet('laporanPembelian'); delUserRows(sh,uid);
  var list=readAllUser('pembelian',uid).rows; if(!list.length) return;
  var h=getHeaders(sh);
  var rows=list.map(function(b){return h.map(function(k){
    var m={userId:uid,tanggal:b.tanggal,produk:b.produkNama,supplier:b.supplierNama||'-',
      jumlah:b.jumlah,harga:b.harga,total:b.total,status:b.status};
    return m[k]!==undefined?m[k]:'';
  })});
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapStok(uid) {
  var sh=getSheet('laporanStok'); delUserRows(sh,uid);
  var produk=readAllUser('produk',uid).rows, mutasi=readAllUser('mutasi',uid).rows;
  if(!produk.length) return;
  var h=getHeaders(sh);
  var rows=produk.map(function(p){
    var masuk=mutasi.filter(function(m){return m.produkId===p.id&&m.tipe==='masuk';}).reduce(function(s,m){return s+Number(m.jumlah||0);},0);
    var keluar=mutasi.filter(function(m){return m.produkId===p.id&&m.tipe==='keluar';}).reduce(function(s,m){return s+Number(m.jumlah||0);},0);
    var stokAkhir=Number(p.stok||p.stokAwal||0);
    return h.map(function(k){
      var m={userId:uid,produk:p.nama,kategori:p.kategori,stokAwal:Number(p.stokAwal||0),
        masuk:masuk,keluar:keluar,stokAkhir:stokAkhir,nilaiStok:stokAkhir*Number(p.hargaBeli||0)};
      return m[k]!==undefined?m[k]:'';
    });
  });
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapLabaRugi(uid) {
  var sh=getSheet('laporanLabaRugi'); delUserRows(sh,uid);
  var trx=readAllUser('transaksi',uid).rows.filter(function(t){return !t.isDraft;}), biaya=readAllUser('biaya',uid).rows;
  var bm={};
  trx.forEach(function(t){
    var k=new Date(t.tanggal).toISOString().slice(0,7);
    if(!bm[k]) bm[k]={p:0,hpp:0,b:0,pl:0};
    bm[k].p+=Number(t.total||0);
    var items=typeof t.items==='string'?JSON.parse(t.items||'[]'):t.items;
    if(Array.isArray(items)) items.forEach(function(i){bm[k].hpp+=Number(i.hargaBeli||0)*Number(i.qty||0);});
  });
  biaya.forEach(function(b){
    var k=new Date(b.tanggal).toISOString().slice(0,7);
    if(!bm[k]) bm[k]={p:0,hpp:0,b:0,pl:0};
    if(b.tipe==='biaya') bm[k].b+=Number(b.nominal||0); else bm[k].pl+=Number(b.nominal||0);
  });
  var h=getHeaders(sh);
  var rows=Object.keys(bm).sort().map(function(k){
    var d=bm[k], lk=d.p-d.hpp, lb=lk-d.b+d.pl;
    return h.map(function(hk){
      var m={userId:uid,periode:k,pendapatan:d.p,hpp:d.hpp,labaKotor:lk,biaya:d.b,pendapatanLain:d.pl,labaBersih:lb};
      return m[hk]!==undefined?m[hk]:'';
    });
  });
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapArusKas(uid) {
  var sh=getSheet('laporanArusKas'); delUserRows(sh,uid);
  var ev=[];
  readAllUser('transaksi',uid).rows.forEach(function(t){if(!t.isDraft&&t.metodePembayaran!=='Piutang') ev.push({tgl:t.tanggal,ket:'Penjualan '+(t.pelanggan||''),tipe:'masuk',n:Number(t.total||0)});});
  readAllUser('pembelian',uid).rows.forEach(function(b){if(b.status==='lunas') ev.push({tgl:b.tanggal,ket:'Pembelian '+(b.produkNama||''),tipe:'keluar',n:Number(b.total||0)});});
  readAllUser('biaya',uid).rows.forEach(function(b){ev.push({tgl:b.tanggal,ket:b.kategori||'Biaya',tipe:b.tipe==='pendapatan'?'masuk':'keluar',n:Number(b.nominal||0)});});
  ev.sort(function(a,b){return new Date(a.tgl)-new Date(b.tgl);});
  var saldo=0, h=getHeaders(sh);
  var rows=ev.map(function(e){
    saldo+=e.tipe==='masuk'?e.n:-e.n;
    return h.map(function(k){var m={userId:uid,tanggal:e.tgl,keterangan:e.ket,tipe:e.tipe,nominal:e.n,saldo:saldo};return m[k]!==undefined?m[k]:'';});
  });
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapPiutang(uid) {
  var sh=getSheet('laporanPiutang'); delUserRows(sh,uid);
  var list=readAllUser('transaksi',uid).rows.filter(function(t){return !t.isDraft&&t.metodePembayaran==='Piutang';});
  if(!list.length) return;
  var h=getHeaders(sh);
  var rows=list.map(function(t){return h.map(function(k){
    var m={userId:uid,tanggal:t.tanggal,invoiceId:t.id,pelanggan:t.pelanggan||'Umum',total:t.total,status:t.lunas?'Lunas':'Belum Lunas',tglJthTempo:t.tglJthTempo||''};
    return m[k]!==undefined?m[k]:'';
  })});
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapHutang(uid) {
  var sh=getSheet('laporanHutang'); delUserRows(sh,uid);
  var list=readAllUser('pembelian',uid).rows.filter(function(b){return b.status==='hutang';});
  if(!list.length) return;
  var h=getHeaders(sh);
  var rows=list.map(function(b){return h.map(function(k){
    var m={userId:uid,tanggal:b.tanggal,produk:b.produkNama,supplier:b.supplierNama||'-',total:b.total,status:'Belum Lunas'};
    return m[k]!==undefined?m[k]:'';
  })});
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapOmsetSales(uid) {
  var sh=getSheet('laporanOmsetSales'); delUserRows(sh,uid);
  var trx=readAllUser('transaksi',uid).rows.filter(function(t){return !t.isDraft;});
  if(!trx.length) return;
  var salesMap={};
  trx.forEach(function(t){
    var sid=t.salesId||'no-sales', sname=t.sales||'Tanpa Sales';
    if(!salesMap[sid]) salesMap[sid]={salesId:sid,salesNama:sname,totalTransaksi:0,totalOmset:0,totalLaba:0};
    salesMap[sid].totalTransaksi++;
    salesMap[sid].totalOmset+=Number(t.total||0);
    var items=typeof t.items==='string'?JSON.parse(t.items||'[]'):t.items;
    if(Array.isArray(items)) items.forEach(function(i){
      salesMap[sid].totalLaba+=(Number(i.harga||0)-Number(i.hargaBeli||0))*Number(i.qty||0);
    });
  });
  var h=getHeaders(sh);
  var rows=Object.keys(salesMap).map(function(k){
    var s=salesMap[k];
    return h.map(function(hk){
      var m={userId:uid,salesId:s.salesId,salesNama:s.salesNama,totalTransaksi:s.totalTransaksi,totalOmset:s.totalOmset,totalLaba:s.totalLaba};
      return m[hk]!==undefined?m[hk]:'';
    });
  });
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapInvoicePelanggan(uid) {
  var sh=getSheet('laporanInvoicePelanggan'); delUserRows(sh,uid);
  var list=readAllUser('transaksi',uid).rows.filter(function(t){return !t.isDraft;});
  if(!list.length) return;
  var h=getHeaders(sh);
  var rows=list.map(function(t){return h.map(function(k){
    var m={userId:uid,tanggal:t.tanggal,invoiceId:t.id,pelanggan:t.pelanggan||'Umum',
      items:t.items?JSON.stringify(t.items):'',total:t.total,metode:t.metodePembayaran,
      status:t.lunas?'Lunas':(t.metodePembayaran==='Piutang'?'Piutang':'Lunas'),tglJthTempo:t.tglJthTempo||''};
    return m[k]!==undefined?m[k]:'';
  })});
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapInvoiceSupplier(uid) {
  var sh=getSheet('laporanInvoiceSupplier'); delUserRows(sh,uid);
  var list=readAllUser('pembelian',uid).rows;
  if(!list.length) return;
  var h=getHeaders(sh);
  var rows=list.map(function(b){return h.map(function(k){
    var m={userId:uid,tanggal:b.tanggal,invoiceId:b.id,supplier:b.supplierNama||'-',
      produk:b.produkNama,jumlah:b.jumlah,total:b.total,status:b.status,tglJthTempo:b.tglJthTempo||''};
    return m[k]!==undefined?m[k]:'';
  })});
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}

function genLapJatuhTempo(uid) {
  var sh=getSheet('laporanJatuhTempo'); delUserRows(sh,uid);
  var trx=readAllUser('transaksi',uid).rows.filter(function(t){return !t.isDraft&&t.metodePembayaran==='Piutang'&&!t.lunas&&t.tglJthTempo;});
  var beli=readAllUser('pembelian',uid).rows.filter(function(b){return b.status==='hutang'&&b.tglJthTempo;});
  var h=getHeaders(sh), now=new Date(), rows=[];
  trx.forEach(function(t){
    var jt=new Date(t.tglJthTempo), diff=Math.floor((jt-now)/(1000*60*60*24));
    rows.push(h.map(function(k){
      var m={userId:uid,tanggal:t.tanggal,tipe:'Piutang',invoiceId:t.id,pihak:t.pelanggan||'Umum',
        total:t.total,tglJthTempo:t.tglJthTempo,selisihHari:diff,status:diff<0?'Terlambat':(diff<=7?'Segera':'Normal')};
      return m[k]!==undefined?m[k]:'';
    }));
  });
  beli.forEach(function(b){
    var jt=new Date(b.tglJthTempo), diff=Math.floor((jt-now)/(1000*60*60*24));
    rows.push(h.map(function(k){
      var m={userId:uid,tanggal:b.tanggal,tipe:'Hutang',invoiceId:b.id,pihak:b.supplierNama||'-',
        total:b.total,tglJthTempo:b.tglJthTempo,selisihHari:diff,status:diff<0?'Terlambat':(diff<=7?'Segera':'Normal')};
      return m[k]!==undefined?m[k]:'';
    }));
  });
  if(rows.length) sh.getRange(sh.getLastRow()+1,1,rows.length,h.length).setValues(rows);
}


// ===== HELPERS =====
function getSheet(key) {
  var name=SHEETS[key]||key, sh=SS.getSheetByName(name);
  if (!sh) throw new Error('Sheet "'+name+'" tidak ditemukan. Jalankan setupDatabase()');
  return sh;
}
function getHeaders(sh) {
  var c=sh.getLastColumn(); return c===0?[]:sh.getRange(1,1,1,c).getValues()[0];
}
function encodeSheetValue_(sheetKey, field, value) {
  if (value === undefined || value === null) return '';
  if (JSON_FIELDS[sheetKey] && JSON_FIELDS[sheetKey][field]) return JSON.stringify(value);
  return value;
}
function decodeSheetValue_(sheetKey, field, value) {
  if (value === '') return null;
  if (JSON_FIELDS[sheetKey] && JSON_FIELDS[sheetKey][field] && typeof value === 'string') {
    try { return JSON.parse(value); } catch(e) {}
  }
  if (sheetKey==='transaksi' && (field==='isDraft' || field==='lunas')) {
    return value===true || value==='true';
  }
  return value;
}
function deleteTransaksiItemsByTransaksiId_(transaksiId, uid) {
  var sh=getSheet('transaksiItems'), all=sh.getDataRange().getValues(), headers=all[0];
  var trxCol=headers.indexOf('transaksiId'), uidCol=headers.indexOf('userId');
  for (var i=all.length-1;i>=1;i--) {
    if (String(all[i][trxCol])===String(transaksiId) && (uidCol===-1 || String(all[i][uidCol])===String(uid))) {
      sh.deleteRow(i+1);
    }
  }
}
function genId() { return 'gs_'+Date.now()+'_'+Math.random().toString(36).slice(2,6); }
function genToken() { return Utilities.base64Encode(genId()+'_'+Date.now()).replace(/[^a-zA-Z0-9]/g,'').slice(0,64); }
function trim(s) { return String(s||'').trim(); }
function addLog(uid,aksi,sheet,jml,status,pesan) {
  try {
    var sh=SS.getSheetByName(SHEETS.syncLog); if(!sh) return;
    sh.appendRow([new Date().toISOString(),uid||'',aksi,sheet,jml,status,pesan]);
    if(sh.getLastRow()>1001) sh.deleteRow(2);
  } catch(e){}
}
function doPing() { return {status:'ok',time:new Date().toISOString(),sheet:SS.getName(),version:'3.0'}; }
function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ===== MENU =====
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Koncowrb')
    .addItem('Setup Database (Jalankan Pertama Kali)', 'setupDatabase')
    .addItem('Generate Semua Laporan', 'generateAllLaporanUI')
    .addItem('Info Deploy', 'showDeployInfo')
    .addToUi();
}
function generateAllLaporanUI() {
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt('Generate Laporan','Masukkan userId:',ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()===ui.Button.OK){generateAllLaporan(r.getResponseText().trim());ui.alert('Selesai!');}
}
function showDeployInfo() {
  SpreadsheetApp.getUi().alert('Deploy:\n1. Deploy > New deployment\n2. Web App\n3. Execute as: Me\n4. Access: Anyone\n5. Copy URL');
}
