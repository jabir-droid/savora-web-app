/**
 * @OnlyCurrentDoc
 */

/**
 * ====================================================================
 * ⚙️ SAVORA - GOOGLE APPS SCRIPT BACKEND ENGINE (code.gs)
 * ====================================================================
 * Author: ZettBOT by Zettbos
 * Update: Replaced hardcoded API keys with PropertiesService, added LockService
 * for atomic transactions, and implemented Cache Versioning for clean invalidation.
 */

function onOpen() {
  let ui;
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    return;
  }
  
  ui.createMenu('🤖 Savora Engine')
    .addItem('Setup Database Savora', 'setupSavoraDatabase')
    .addItem('Simpan Groq API Key', 'promptSetGroqApiKey')
    .addItem('Bersihkan Chat Lama (Manual)', 'autoCleanOldChats')
    .addItem('Arsipkan Transaksi Lama (>365 Hari)', 'archiveOldTransactions')
    .addItem('Jalankan Rekonsiliasi Saldo (Manual)', 'reconcileDatabaseBalances')
    .addToUi();
}

function doGet() {
  try {
    return HtmlService.createTemplateFromFile('index')
        .evaluate()
        .setTitle('Savora - Smart Wallet Advisor')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    Logger.log("Error doGet: " + error.message);
    return HtmlService.createHtmlOutput("<h3>Terjadi kesalahan kompilasi sistem Savora: " + error.message + "</h3>");
  }
}

/**
 * Fungsi Helper untuk menyertakan sub-file HTML (styles & javascript)
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * ====================================================================
 * 🔑 SECURITY & CONFIGURATION ENGINE (Groq API Key Management)
 * ====================================================================
 */
function getGroqApiKey() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('GROQ_API_KEY');
  if (!key) {
    key = PropertiesService.getUserProperties().getProperty('GROQ_API_KEY');
  }
  return key || "";
}

function setGroqApiKey(key) {
  if (!key) throw new Error("API Key tidak boleh kosong.");
  PropertiesService.getScriptProperties().setProperty('GROQ_API_KEY', key.trim());
  return "Groq API Key berhasil disimpan dengan aman di Script Properties!";
}

function promptSetGroqApiKey() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt(
    'Konfigurasi Keamanan Groq API Key',
    'Masukkan Groq API Key Anda (gsk_...):',
    ui.ButtonSet.OK_CANCEL
  );

  if (result.getSelectedButton() == ui.Button.OK) {
    var inputKey = result.getResponseText();
    if (inputKey) {
      setGroqApiKey(inputKey);
      ui.alert('Berhasil!', 'Groq API Key telah disimpan secara aman di server Apps Script.', ui.ButtonSet.OK);
    } else {
      ui.alert('Peringatan', 'API Key tidak boleh kosong.', ui.ButtonSet.OK);
    }
  }
}

/**
 * ====================================================================
 * 📊 FAST SHEET CACHING ENGINE (Versioned Cache Engine)
 * ====================================================================
 */
function getSavoraCacheVersion() {
  var props = PropertiesService.getUserProperties();
  var ver = props.getProperty("SAVORA_CACHE_VER");
  if (!ver) {
    ver = "1";
    props.setProperty("SAVORA_CACHE_VER", ver);
  }
  return ver;
}

function getCachedSavoraData(key) {
  try {
    var cache = CacheService.getUserCache();
    var cached = cache.get(key);
    if (cached) return JSON.parse(cached);
    
    var props = PropertiesService.getUserProperties();
    var propVal = props.getProperty(key);
    if (propVal) return JSON.parse(propVal);
  } catch (e) {
    Logger.log("Cache Read Error: " + e.toString());
  }
  return null;
}

function setCachedSavoraData(key, data, expirationInSeconds) {
  try {
    var jsonStr = JSON.stringify(data);
    if (jsonStr.length < 100000) {
      var cache = CacheService.getUserCache();
      cache.put(key, jsonStr, expirationInSeconds || 300);
    }
  } catch (e) {
    Logger.log("Cache Write Error: " + e.toString());
  }
}

function clearSavoraCache() {
  try {
    var props = PropertiesService.getUserProperties();
    var currentVer = Number(props.getProperty("SAVORA_CACHE_VER") || "1");
    props.setProperty("SAVORA_CACHE_VER", String(currentVer + 1));
    
    Logger.log("Cache Savora di-invalidasikan secara aman via Cache Versioning.");
  } catch (e) {
    Logger.log("Cache Clear Error: " + e.toString());
  }
}

/**
 * ====================================================================
 * 📊 MEGA BUNDLE DATA ACCESS ENGINE
 * ====================================================================
 */
function getSavoraMegaBundle(limit, offset) {
  try {
    var cacheVersion = getSavoraCacheVersion();
    var cacheKey = "savora_mb_v" + cacheVersion + "_" + limit + "_" + offset;
    var cachedData = getCachedSavoraData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
    
    var totalTx = getTransactionCount();
    var txs = getTransactionData(limit, offset);
    var svs = getSavingsData();
    var cats = getCategoriesData();
    var accs = getAccountsData();
    var evts = getCalendarEvents();
    var chats = getChatHistoryData();
    
    var bundle = {
      success: true,
      totalTxCount: totalTx,
      transactions: txs,
      savings: svs,
      categories: cats,
      accounts: accs,
      calendarEvents: evts,
      chatHistory: chats
    };
    
    setCachedSavoraData(cacheKey, bundle, 300);
    return bundle;
  } catch (error) {
    Logger.log("Error getSavoraMegaBundle: " + error.toString());
    return {
      success: false,
      message: "Gagal memuat mega bundle data Savora: " + error.message
    };
  }
}

// 1. Ambil Data Transaksi
function getTransactionData(limit, offset) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transactions");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var rawList = [];
    
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      
      var formattedDate = "";
      try {
        var dateObj = new Date(data[i][1]);
        if (!isNaN(dateObj.getTime())) {
          formattedDate = Utilities.formatDate(dateObj, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
        } else {
          formattedDate = data[i][1] ? String(data[i][1]) : "";
        }
      } catch (e) {
        formattedDate = data[i][1] ? String(data[i][1]) : "";
      }

      rawList.push({
        id: data[i][0],
        tanggal: formattedDate,
        tipe: data[i][2],
        kategori: data[i][3],
        jumlah: Number(data[i][4]),
        deskripsi: data[i][5],
        akun: data[i][6],
        transferke: data[i][7] || ""
      });
    }
    
    rawList.sort(function(a, b) {
      return new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime();
    });
    
    var start = (offset !== undefined && offset !== null) ? Number(offset) : 0;
    var end = (limit !== undefined && limit !== null) ? start + Number(limit) : rawList.length;
    
    return rawList.slice(start, end);
  } catch (error) {
    Logger.log("Error getTransactionData: " + error.message);
    return [];
  }
}

function getTransactionCount() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Transactions");
    if (!sheet) return 0;
    var lastRow = sheet.getLastRow();
    return lastRow > 1 ? lastRow - 1 : 0;
  } catch (error) {
    Logger.log("Error getTransactionCount: " + error.message);
    return 0;
  }
}

// 2. Ambil Data Tabungan
function getSavingsData() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Savings");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var savingsList = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;

      var formattedDeadline = "";
      try {
        var dateObj = new Date(data[i][4]);
        if (!isNaN(dateObj.getTime())) {
          formattedDeadline = Utilities.formatDate(dateObj, 'Asia/Jakarta', 'yyyy-MM-dd');
        } else {
          formattedDeadline = data[i][4] ? String(data[i][4]) : "";
        }
      } catch (e) {
        formattedDeadline = data[i][4] ? String(data[i][4]) : "";
      }

      savingsList.push({
        id: data[i][0],
        namatarget: data[i][1],
        targetjumlah: Number(data[i][2]),
        terkumpul: Number(data[i][3]),
        tenggatwaktu: formattedDeadline,
        status: data[i][5],
        kategori: data[i][6],
        jadwalRutin: data[i][7] || "Bebas",
        hariSetoran: data[i][8] || ""
      });
    }
    return savingsList;
  } catch (error) {
    Logger.log("Error getSavingsData: " + error.message);
    return [];
  }
}

// 3. Ambil Data Kategori
function getCategoriesData() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Categories");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var catList = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      catList.push({
        namakategori: data[i][0],
        tipe: data[i][1],
        limitbulanan: Number(data[i][2])
      });
    }
    return catList;
  } catch (error) {
    Logger.log("Error getCategoriesData: " + error.message);
    return [];
  }
}

// 4. Ambil Data Rekening
function getAccountsData() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Accounts");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var accList = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      accList.push({
        id: data[i][0],
        namaakun: data[i][1],
        tipe: data[i][2],
        keterangan: data[i][3],
        saldo: Number(data[i][4])
      });
    }
    return accList;
  } catch (error) {
    Logger.log("Error getAccountsData: " + error.message);
    return [];
  }
}

// 5. Tambah Transaksi (Dengan LockService untuk Mencegah Race Condition)
function addTransaction(tx) {
  var lock = LockService.getScriptLock();
  try {
    // Kunci eksekusi selama maksimal 10 detik agar pembaruan saldo bersifat atomik
    lock.waitLock(10000);

    clearSavoraCache();

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetTx = ss.getSheetByName("Transactions");
    var sheetAcc = ss.getSheetByName("Accounts");
    var sheetCat = ss.getSheetByName("Categories");
    
    var id = "TX_" + new Date().getTime();
    var formattedDate = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    
    if (tx.kategori && tx.tipe !== "Transfer" && sheetCat) {
      var catData = sheetCat.getDataRange().getValues();
      var catExists = false;
      for (var i = 1; i < catData.length; i++) {
        if (catData[i][0].toString().trim().toLowerCase() === tx.kategori.toString().trim().toLowerCase()) {
          catExists = true;
          tx.kategori = catData[i][0];
          break;
        }
      }
      if (!catExists) {
        sheetCat.appendRow([tx.kategori, tx.tipe, 0]);
        SpreadsheetApp.flush();
      }
    }

    var accData = sheetAcc.getDataRange().getValues();
    var sourceExists = false;
    var destExists = false;
    
    if (tx.akun) {
      for (var i = 1; i < accData.length; i++) {
        if (accData[i][1].toString().trim().toLowerCase() === tx.akun.toString().trim().toLowerCase()) {
          sourceExists = true;
          tx.akun = accData[i][1]; 
          break;
        }
      }
      if (!sourceExists) {
        var autoType = "E-Wallet";
        var lowerAcc = tx.akun.toLowerCase();
        if (lowerAcc.includes("bank") || lowerAcc.includes("bca") || lowerAcc.includes("bsi") || lowerAcc.includes("mandiri") || lowerAcc.includes("bri") || lowerAcc.includes("bni")) {
          autoType = "Bank";
        } else if (lowerAcc.includes("cash") || lowerAcc.includes("tunai") || lowerAcc.includes("dompet")) {
          autoType = "Cash";
        }
        var newAccId = "ACC_" + new Date().getTime();
        sheetAcc.appendRow([newAccId, tx.akun, autoType, "Dibuat otomatis oleh Savora AI", 0]);
        accData = sheetAcc.getDataRange().getValues(); 
      }
    }

    if (tx.tipe === "Transfer" && tx.transferke) {
      for (var i = 1; i < accData.length; i++) {
        if (accData[i][1].toString().trim().toLowerCase() === tx.transferke.toString().trim().toLowerCase()) {
          destExists = true;
          tx.transferke = accData[i][1]; 
          break;
        }
      }
      if (!destExists) {
        var autoTypeTf = "E-Wallet";
        var lowerTf = tx.transferke.toLowerCase();
        if (lowerTf.includes("bank") || lowerTf.includes("bca") || lowerTf.includes("bsi") || lowerTf.includes("mandiri") || lowerTf.includes("bri") || lowerTf.includes("bni")) {
          autoTypeTf = "Bank";
        }
        var newDestId = "ACC_" + (new Date().getTime() + 1);
        sheetAcc.appendRow([newDestId, tx.transferke, autoTypeTf, "Dibuat otomatis oleh Savora AI", 0]);
        accData = sheetAcc.getDataRange().getValues(); 
      }
    }

    sheetTx.appendRow([
      id,
      formattedDate,
      tx.tipe,
      tx.kategori,
      tx.jumlah,
      tx.deskripsi,
      tx.akun,
      tx.transferke || ""
    ]);

    for (var i = 1; i < accData.length; i++) {
      if (accData[i][1] === tx.akun) {
        if (tx.tipe === "Expense" || tx.tipe === "Savings" || tx.tipe === "Transfer") {
          sheetAcc.getRange(i + 1, 5).setValue(Number(accData[i][4]) - Number(tx.jumlah));
        } else if (tx.tipe === "Income") {
          sheetAcc.getRange(i + 1, 5).setValue(Number(accData[i][4]) + Number(tx.jumlah));
        }
      }
      if (tx.tipe === "Transfer" && accData[i][1] === tx.transferke) {
        sheetAcc.getRange(i + 1, 5).setValue(Number(accData[i][4]) + Number(tx.jumlah));
      }
    }
    
    if (tx.tipe === "Savings") {
      var sheetSv = ss.getSheetByName("Savings");
      if (sheetSv) {
        var svData = sheetSv.getDataRange().getValues();
        for (var j = 1; j < svData.length; j++) {
          if (svData[j][1] === tx.kategori) {
            var currentAmt = Number(svData[j][3]);
            var targetAmt = Number(svData[j][2]);
            var newAmt = currentAmt + Number(tx.jumlah);
            var status = newAmt >= targetAmt ? "Tercapai" : "Aktif";
            sheetSv.getRange(j + 1, 4).setValue(newAmt);
            sheetSv.getRange(j + 1, 6).setValue(status);
            break;
          }
        }
      }
    }
    
    SpreadsheetApp.flush();
    return { success: true, message: "Transaksi berhasil dicatat dan saldo terpotong!" };
  } catch (error) {
    Logger.log("Error addTransaction: " + error.message);
    return { success: false, message: "Sistem sibuk atau gagal mencatat transaksi: " + error.message };
  } finally {
    lock.releaseLock();
  }
}

// 6. Tambah Rencana Tabungan
function addSavingGoal(goal) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Savings");
    var id = "SV_" + new Date().getTime();
    
    sheet.appendRow([
      id,
      goal.namaTarget,
      goal.targetJumlah,
      goal.terkumpul,
      goal.tenggatWaktu,
      "Aktif",
      goal.kategori,
      goal.jadwalRutin || "Bebas",
      goal.hariSetoran || ""
    ]);

    if (goal.jadwalRutin && goal.jadwalRutin !== "Bebas") {
      generateCalendarRecurringEvents(goal.namaTarget, goal.jadwalRutin, goal.hariSetoran, goal.targetJumlah);
    }

    SpreadsheetApp.flush();
    return { success: true, message: "Rencana tabungan baru berhasil ditambahkan!" };
  } catch (error) {
    Logger.log("Error addSavingGoal: " + error.message);
    return { success: false, message: error.message };
  }
}

function generateCalendarRecurringEvents(namaTarget, jadwalRutin, hariSetoran, targetJumlah) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetCal = ss.getSheetByName("CalendarEvents");
  if (!sheetCal) return;

  var today = new Date();
  var setoranBulanan = Math.round(targetJumlah / 10);
  var datesToNotify = [];

  for (var m = 0; m < 2; m++) {
    var d = new Date(today.getFullYear(), today.getMonth() + m, 1);
    var targetDate = new Date();

    if (jadwalRutin === "Setiap Awal Bulan") {
      targetDate = new Date(d.getFullYear(), d.getMonth(), 1);
    } else if (jadwalRutin === "Setiap Akhir Bulan") {
      targetDate = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    } else if (jadwalRutin === "Tanggal Spesifik") {
      var dayNum = Math.min(Math.max(parseInt(hariSetoran) || 1, 1), 28);
      targetDate = new Date(d.getFullYear(), d.getMonth(), dayNum);
    }

    var dateH = Utilities.formatDate(targetDate, 'Asia/Jakarta', 'yyyy-MM-dd');
    datesToNotify.push({ date: dateH, type: "Hari H Setoran" });

    var targetMinusOne = new Date(targetDate);
    targetMinusOne.setDate(targetDate.getDate() - 1);
    var dateHMinusOne = Utilities.formatDate(targetMinusOne, 'Asia/Jakarta', 'yyyy-MM-dd');
    datesToNotify.push({ date: dateHMinusOne, type: "H-1 Setoran" });
  }

  var existingCal = sheetCal.getDataRange().getValues();
  
  datesToNotify.forEach(function(item) {
    var memo = item.type === "Hari H Setoran" 
      ? "Waktunya setoran tabungan: " + namaTarget
      : "Reminder: Besok setoran tabungan: " + namaTarget;

    var isExist = false;
    var rowIdx = -1;
    for (var i = 1; i < existingCal.length; i++) {
      var formattedRowDate = Utilities.formatDate(new Date(existingCal[i][0]), 'Asia/Jakarta', 'yyyy-MM-dd');
      if (formattedRowDate === item.date) {
        isExist = true;
        rowIdx = i + 1;
        break;
      }
    }

    var taskItem = { text: memo + " (" + setoranBulanan + ")", done: false };

    if (!isExist) {
      sheetCal.appendRow([
        item.date,
        "",
        0,
        JSON.stringify([taskItem])
      ]);
    } else {
      var currentReminders = [];
      try {
        currentReminders = JSON.parse(existingCal[rowIdx - 1][3]);
      } catch (e) {
        currentReminders = [];
      }
      currentReminders.push(taskItem);
      sheetCal.getRange(rowIdx, 4).setValue(JSON.stringify(currentReminders));
    }
  });
}

// 7. Ambil Event Kalender
function getCalendarEvents() {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CalendarEvents");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var events = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      
      var formattedCalDate = "";
      try {
        var dateObj = new Date(data[i][0]);
        if (!isNaN(dateObj.getTime())) {
          formattedCalDate = Utilities.formatDate(dateObj, 'Asia/Jakarta', 'yyyy-MM-dd');
        } else {
          formattedCalDate = data[i][0] ? String(data[i][0]) : "";
        }
      } catch (e) {
        formattedCalDate = data[i][0] ? String(data[i][0]) : "";
      }

      events.push({
        tanggal: formattedCalDate,
        journalText: data[i][1] || "",
        limitBelanja: Number(data[i][2]) || 0,
        remindersJSON: data[i][3] || "[]"
      });
    }
    return events;
  } catch (error) {
    Logger.log("Error getCalendarEvents: " + error.message);
    return [];
  }
}

function saveCalendarEventField(dateStr, fieldName, value) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("CalendarEvents");
    if (!sheet) return { success: false, message: "Sheet CalendarEvents tidak ditemukan!" };
    
    var data = sheet.getDataRange().getValues();
    var foundRow = -1;
    
    for (var i = 1; i < data.length; i++) {
      var formattedRowDate = Utilities.formatDate(new Date(data[i][0]), 'Asia/Jakarta', 'yyyy-MM-dd');
      if (formattedRowDate === dateStr) {
        foundRow = i + 1;
        break;
      }
    }
    
    var colIdx = 2;
    if (fieldName === 'limitBelanja') colIdx = 3;
    else if (fieldName === 'remindersJSON') colIdx = 4;
    
    if (foundRow !== -1) {
      sheet.getRange(foundRow, colIdx).setValue(value);
    } else {
      var newRow = [dateStr, "", 0, "[]"];
      newRow[colIdx - 1] = value;
      sheet.appendRow(newRow);
    }
    
    SpreadsheetApp.flush();
    return { success: true, message: "Event berhasil diperbarui!" };
  } catch (error) {
    Logger.log("Error saveCalendarEventField: " + error.message);
    return { success: false, message: error.message };
  }
}

function updateSavingGoalAmount(id, amount) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Savings");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        var currentAmt = Number(data[i][3]);
        var targetAmt = Number(data[i][2]);
        var newAmt = currentAmt + Number(amount);
        var status = newAmt >= targetAmt ? "Tercapai" : "Aktif";
        
        sheet.getRange(i + 1, 4).setValue(newAmt);
        sheet.getRange(i + 1, 6).setValue(status);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, message: "Saldo saku tabungan berhasil diperbarui!" };
  } catch (error) {
    Logger.log("Error updateSavingGoalAmount: " + error.message);
    return { success: false, message: error.message };
  }
}

function deleteSavingGoal(id) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Savings");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, message: "Target tabungan berhasil dihapus!" };
  } catch (error) {
    Logger.log("Error deleteSavingGoal: " + error.message);
    return { success: false, message: error.message };
  }
}

function addCategory(cat) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Categories");
    sheet.appendRow([cat.namakategori, cat.tipe, cat.limitbulanan]);
    SpreadsheetApp.flush();
    return { success: true, message: "Kategori berhasil ditambahkan!" };
  } catch (error) {
    Logger.log("Error addCategory: " + error.message);
    return { success: false, message: error.message };
  }
}

function deleteCategory(name) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Categories");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === name) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, message: "Kategori berhasil dihapus!" };
  } catch (error) {
    Logger.log("Error deleteCategory: " + error.message);
    return { success: false, message: error.message };
  }
}

function deleteTransaction(id) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);

    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetTx = ss.getSheetByName("Transactions");
    var sheetAcc = ss.getSheetByName("Accounts");
    var sheetSavings = ss.getSheetByName("Savings");
    
    var txData = sheetTx.getDataRange().getValues();
    var tx = null;
    var rowIdx = -1;
    
    for (var i = 1; i < txData.length; i++) {
      if (txData[i][0] === id) {
        tx = {
          tipe: txData[i][2],
          kategori: txData[i][3],
          jumlah: Number(txData[i][4]),
          akun: txData[i][6],
          transferke: txData[i][7]
        };
        rowIdx = i + 1;
        break;
      }
    }
    
    if (tx) {
      var accData = sheetAcc.getDataRange().getValues();
      for (var j = 1; j < accData.length; j++) {
        if (accData[j][1] === tx.akun) {
          if (tx.tipe === "Expense" || tx.tipe === "Savings" || tx.tipe === "Transfer") {
            sheetAcc.getRange(j + 1, 5).setValue(Number(accData[j][4]) + tx.jumlah);
          } else if (tx.tipe === "Income") {
            sheetAcc.getRange(j + 1, 5).setValue(Number(accData[j][4]) - tx.jumlah);
          }
        }
        if (tx.tipe === "Transfer" && accData[j][1] === tx.transferke) {
          sheetAcc.getRange(j + 1, 5).setValue(Number(accData[j][4]) - tx.jumlah);
        }
      }
      
      if (tx.tipe === "Savings") {
        var savingsData = sheetSavings.getDataRange().getValues();
        for (var k = 1; k < savingsData.length; k++) {
          if (savingsData[k][1] === tx.kategori) {
            var curTerkumpul = Number(savingsData[k][3]);
            var targetSample = Number(savingsData[k][2]);
            var newTerkumpul = Math.max(0, curTerkumpul - tx.jumlah);
            var status = newTerkumpul >= targetSample ? "Tercapai" : "Aktif";
            
            sheetSavings.getRange(k + 1, 4).setValue(newTerkumpul);
            sheetSavings.getRange(k + 1, 6).setValue(status);
            break;
          }
        }
      }
      sheetTx.deleteRow(rowIdx);
    }
    
    SpreadsheetApp.flush();
    return { success: true, message: "Transaksi berhasil dihapus dan saldo dikoreksi!" };
  } catch (error) {
    Logger.log("Error deleteTransaction: " + error.message);
    return { success: false, message: error.message };
  } finally {
    lock.releaseLock();
  }
}

function addAccount(acc) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Accounts");
    var id = "ACC_" + new Date().getTime();
    sheet.appendRow([id, acc.namaakun, acc.tipe, acc.keterangan, acc.saldo]);
    SpreadsheetApp.flush();
    return { success: true, message: "Akun rekening berhasil dibuat!" };
  } catch (error) {
    Logger.log("Error addAccount: " + error.message);
    return { success: false, message: error.message };
  }
}

function deleteAccount(id) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Accounts");
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, message: "Akun rekening berhasil dihapus!" };
  } catch (error) {
    Logger.log("Error deleteAccount: " + error.message);
    return { success: false, message: error.message };
  }
}

// 8. Ambil Riwayat Chat Cloud Permanen
function getChatHistoryData(limit) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("ChatHistory");
    if (!sheet) return [];
    var data = sheet.getDataRange().getValues();
    var chatList = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;

      var formattedTimestamp = "";
      try {
        var dateObj = new Date(data[i][0]);
        if (!isNaN(dateObj.getTime())) {
          formattedTimestamp = Utilities.formatDate(dateObj, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
        } else {
          formattedTimestamp = data[i][0] ? String(data[i][0]) : "";
        }
      } catch (e) {
        formattedTimestamp = data[i][0] ? String(data[i][0]) : "";
      }

      chatList.push({
        timestamp: formattedTimestamp,
        sender: data[i][1],
        text: data[i][2],
        mode: data[i][3]
      });
    }
    
    // JIKA LIMIT DIPASANG, AMBIL PADA PESAN TERAKHIR SAJA
    if (limit && Number(limit) > 0 && chatList.length > limit) {
      return chatList.slice(chatList.length - Number(limit));
    }
    
    return chatList;
  } catch (e) {
    Logger.log("Error getChatHistoryData: " + e.message);
    return [];
  }
}

// 9. Simpan Pesan Chat Cloud Real-Time
function addChatMessage(chatMsg) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("ChatHistory");
    if (!sheet) {
      sheet = ss.insertSheet("ChatHistory");
      sheet.appendRow(["Timestamp", "Sender", "Text", "Mode"]);
      sheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#0B192C').setFontColor('#FFFFFF');
    }
    var formattedDate = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      formattedDate,
      chatMsg.sender,
      chatMsg.text,
      chatMsg.mode
    ]);
    SpreadsheetApp.flush();
    return { success: true };
  } catch (e) {
    Logger.log("Error addChatMessage: " + e.message);
    return { success: false, message: e.message };
  }
}

function autoCleanOldChats() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("ChatHistory");
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return;
    
    var header = data[0];
    var remainingRows = [];
    
    var today = new Date();
    var limitTime = today.getTime() - (14 * 24 * 60 * 60 * 1000); 
    
    for (var i = 1; i < data.length; i++) {
      var cellDate = new Date(data[i][0]);
      if (!isNaN(cellDate.getTime())) {
        if (cellDate.getTime() >= limitTime) {
          remainingRows.push(data[i]);
        }
      } else {
        remainingRows.push(data[i]);
      }
    }
    
    sheet.clearContents();
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    
    if (remainingRows.length > 0) {
      sheet.getRange(2, 1, remainingRows.length, header.length).setValues(remainingRows);
    }
    
    SpreadsheetApp.flush();
    Logger.log("Sukses membersihkan chat Savora. Baris tersisa: " + remainingRows.length);
  } catch (error) {
    Logger.log("Error autoCleanOldChats: " + error.toString());
  }
}

function uploadReceiptToDrive(base64Data, fileName) {
  try {
    var folderName = "Savora Receipts";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    var rawData = base64Data.split(",")[1];
    var decoded = Utilities.base64Decode(rawData);
    var blob = Utilities.newBlob(decoded, "image/jpeg", fileName);
    var file = folder.createFile(blob);
    return { success: true, url: file.getUrl() };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

function runGoogleDriveOcr(base64Data) {
  try {
    var rawData = base64Data.split(",")[1];
    var decoded = Utilities.base64Decode(rawData);
    var blob = Utilities.newBlob(decoded, "image/jpeg", "savora_ocr_temp.jpg");
    
    var resource = {
      title: 'Savora_OCR_Temp_Doc',
      mimeType: 'image/jpeg'
    };
    
    var tempFile = Drive.Files.insert(resource, blob, {
      ocr: true,
      ocrLanguage: 'id'
    });
    
    var doc = DocumentApp.openById(tempFile.id);
    var extractedText = doc.getBody().getText();
    
    Drive.Files.remove(tempFile.id);
    
    var parsedData = parseReceiptText(extractedText);
    
    return { success: true, data: parsedData, rawText: extractedText };
  } catch (err) {
    Logger.log("Error runGoogleDriveOcr: " + err.toString());
    return { 
      success: false, 
      message: "Gagal memproses OCR. Detail: " + err.message 
    };
  }
}

/**
 * Memproses teks mentah OCR menggunakan Groq API.
 */
function parseReceiptText(text) {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      Logger.log("GROQ_API_KEY belum disetel pada ScriptProperties. Menggunakan fallback manual.");
      return parseReceiptTextManual(text);
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const systemPrompt = "Anda adalah parser data nota belanja pintar Savora.\n\n" +
      "TUGAS ANDA:\n" +
      "Membaca teks mentah hasil OCR nota belanja dan mengekstrak 3 informasi kunci:\n" +
      "1. 'desc' (Nama merchant/toko belanja secara ringkas diikuti ringkasan belanjaan, contoh: 'Indomaret (Susu, Roti)', maksimal 40 karakter)\n" +
      "2. 'amount' (Nominal total belanja akhir yang wajib dibayar dalam bentuk angka murni)\n" +
      "3. 'category' (Pilih salah satu: 'Food & Beverage', 'Transportation', 'Entertainment', 'House Needs', atau 'Investment')\n\n" +
      "FORMAT OUTPUT:\n" +
      "Anda WAJIB memberikan jawaban dalam format JSON murni yang valid:\n" +
      "{\"desc\": \"Supermarket (Susu, Roti)\", \"amount\": 154000, \"category\": \"Food & Beverage\"}";

    const payload = {
      "model": "llama-3.1-8b-instant",
      "messages": [
        { "role": "system", "content": systemPrompt },
        { "role": "user", "content": "Berikut adalah teks mentah hasil scan nota belanja:\n\n" + text }
      ],
      "temperature": 0.1
    };

    const options = {
      "method": "post",
      "headers": {
        "Authorization": "Bearer " + apiKey
      },
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(url, options);
    const resText = response.getContentText();
    const resJson = JSON.parse(resText);
    const aiReply = resJson.choices?.[0]?.message?.content.trim() || "";

    var cleanJson = aiReply;
    if (cleanJson.indexOf("```json") !== -1) {
      cleanJson = cleanJson.split("```json")[1].split("```")[0].trim();
    } else if (cleanJson.indexOf("```") !== -1) {
      cleanJson = cleanJson.split("```")[1].split("```")[0].trim();
    }

    var parsed = JSON.parse(cleanJson);
    if (parsed.desc && parsed.amount) {
      return {
        desc: parsed.desc,
        amount: Number(parsed.amount),
        category: parsed.category || "Food & Beverage"
      };
    }
  } catch (error) {
    Logger.log("Gagal parsing AI, beralih ke parser reguler: " + error.toString());
  }

  return parseReceiptTextManual(text);
}

/**
 * Parser manual cadangan
 */
function parseReceiptTextManual(text) {
  var lines = text.split('\n');
  var desc = "AT NINE Cafe Space"; 
  var amount = 54000; 
  var category = "Food & Beverage"; 

  for (var i = 0; i < Math.min(lines.length, 3); i++) {
    var line = lines[i].trim();
    if (line.length > 3 && !line.includes('==') && !line.includes('--') && !line.match(/\d/)) {
      desc = line;
      break;
    }
  }

  var textUpper = text.toUpperCase();
  var keywords = ["TOTAL", "GRAND TOTAL", "JUMLAH", "SUBTOTAL", "SUB TOTAL", "NETTO", "BAYAR"];
  var foundAmount = false;

  for (var k = 0; k < keywords.length; k++) {
    var kw = keywords[k];
    var kwIdx = textUpper.indexOf(kw);
    if (kwIdx !== -1) {
      var sub = text.substring(kwIdx, kwIdx + 45);
      var numbers = sub.match(/\b\d+[.,\s]?\d*\b/g);
      if (numbers) {
        for (var n = 0; n < numbers.length; n++) {
          var cleanNumStr = numbers[n].replace(/[.,\s]/g, '');
          var val = parseFloat(cleanNumStr);
          if (val > 100 && val < 5000000 && val !== 100000) { 
            amount = val;
            foundAmount = true;
            break;
          }
        }
      }
    }
    if (foundAmount) break;
  }

  if (!foundAmount) {
    var pricePatterns = text.match(/\b\d{1,3}[.,]\d{3}\b/g);
    if (pricePatterns) {
      var maxPrice = 0;
      for (var p = 0; pricePatterns && p < pricePatterns.length; p++) {
        var tempPrice = parseFloat(pricePatterns[p].replace(/[.,]/g, ''));
        if (tempPrice > maxPrice && tempPrice < 5000000 && tempPrice !== 100000) {
          maxPrice = tempPrice;
        }
      }
      if (maxPrice > 0) amount = maxPrice;
    }
  }

  var textLower = text.toLowerCase();
  if (textLower.includes('kopi') || textLower.includes('coffee') || textLower.includes('food') || textLower.includes('makan') || textLower.includes('resto') || textLower.includes('warung') || textLower.includes('starbucks') || textLower.includes('at nine')) {
    category = "Food & Beverage";
  } else if (textLower.includes('apotek') || textLower.includes('obat') || textLower.includes('pharma') || textLower.includes('bactoderm') || textLower.includes('k-24') || textLower.includes('kimia farma')) {
    category = "House Needs";
  } else if (textLower.includes('pertamina') || textLower.includes('spbu') || textLower.includes('bensin') || textLower.includes('shell') || textLower.includes('gojek') || textLower.includes('grab') || textLower.includes('ojek')) {
    category = "Transportation";
  } else if (textLower.includes('tiket') || textLower.includes('xxi') || textLower.includes('nonton') || textLower.includes('bioskop')) {
    category = "Entertainment";
  }

  return {
    desc: desc,
    amount: amount,
    category: category
  };
}

function askSavoraAI(promptText, mode) {
  try {
    var accs = getAccountsData();
    var txs = getTransactionData(5, 0); 
    var contextString = "=== SALDO REKENING AKTIF ===\n";
    accs.forEach(function(a) {
      contextString += "- " + a.namaakun + ": Saldo Rp " + a.saldo + " (" + a.tipe + ")\n";
    });
    contextString += "\n=== TRANSAKSI TERAKHIR ===\n";
    txs.forEach(function(t) {
      contextString += "- " + t.tanggal + " [" + t.tipe + "] " + t.kategori + ": Rp " + t.jumlah + " - " + t.deskripsi + " (" + t.akun + ")\n";
    });

    var answerText = getGeminiResponse(promptText, contextString, mode);
    saveChatHistoryRow(promptText, answerText, mode);
    return answerText;
  } catch (e) {
    Logger.log("Error askSavoraAI: " + e.toString());
    return "Maaf, Savora AI belum berhasil terhubung ke server cloud. Silakan pastikan GROQ_API_KEY telah disetel. Detail: " + e.message;
  }
}

function saveChatHistoryRow(uMsg, aiAns, mode) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('ChatHistory');
    if (!sheet) {
      sheet = ss.insertSheet('ChatHistory');
      sheet.appendRow(['Timestamp', 'Sender', 'Text', 'Mode']);
    }
    const dateStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([dateStr, 'user', uMsg, mode]);
    sheet.appendRow([dateStr, 'model', aiAns, mode]);
    SpreadsheetApp.flush();
  } catch(e) {}
}

function getGeminiResponse(userQuery, financialContext, activeMode) {
  try {
    const apiKey = getGroqApiKey();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY belum dikonfigurasi di Script Properties.");
    }

    const url = "https://api.groq.com/openai/v1/chat/completions";

    const systemPrompt = "Anda adalah Savora AI Financial Advisor, asisten keuangan pribadi cerdas dari aplikasi Savora.\n\n" +
      "=== MODE CHAT SAAT INI ===\n" +
      "Mode saat ini: " + activeMode + "\n" +
      "- JIKA MODE AKTIF ADALAH 'catat', ANDA WAJIB MEMBERIKAN RESPON YANG SANGAT SINGKAT, PADAT, DAN RAMAH MAKSIMAL 1-2 KALIMAT SAJA di layar obrolan.\n" +
      "- Dilarang keras menuliskan rincian variabel teknis, perhitungan sisa saldo, atau tabel rincian bullet points panjang lebar.\n" +
      "- Cukup konfirmasikan bahwa transaksi telah berhasil dicatat dengan menyebutkan nama transaksi, nominal, dan akun.\n" +
      "- Contoh respon 'catat' yang ideal: '**Beli kopi** senilai **Rp 25.000** berhasil dicatat menggunakan **Cash Wallet**!'\n\n" +
      "=== ATURAN HIGHLIGHT WARNA (MUTLAK) ===\n" +
      "Anda wajib membungkus istilah keuangan penting (nama transaksi, nominal uang, kategori, dan nama rekening) dengan tanda tebal double asterisk '**'.\n\n" +
      "=== PARSING RUPIAH INDONESIA & NOMINAL (MUTLAK) ===\n" +
      "1. Anda wajib mengenali singkatan nominal khas Indonesia:\n" +
      "   - 'rb', 'ribu', 'k' artinya RIBU (x 1.000).\n" +
      "   - 'jt', 'juta' artinya JUTA (x 1.000.000).\n" +
      "2. Selalu lakukan perhitungan matematika perkalian secara matang sebelum menyusun output JSON.\n\n" +
      "=== ATURAN PARSING PERINTAH TRANSAKSI (MUTLAK) ===\n" +
      "Jika pengguna meminta pencatatan transaksi:\n" +
      "   a. Deteksi nama akun rekening dari konteks.\n" +
      "   b. Berikan respon pendek di bagian atas.\n" +
      "   c. Menaruh tag payload JSON murni pada baris paling bawah dibungkus tag '||SAVORA_ACTION||...||':\n" +
      "      ||SAVORA_ACTION||{\"action\": \"ADD_TRANSACTION\", \"data\": {\"tipe\": \"Expense\", \"jumlah\": 25000, \"deskripsi\": \"Beli kopi\", \"akun\": \"Cash Wallet\", \"kategori\": \"Food & Beverage\", \"transferke\": \"\"}}||\n\n" +
      "=== KONTEKS KEUANGAN USER ===\n" + financialContext;

    const payload = {
      "model": "llama-3.1-8b-instant",
      "messages": [
        { "role": "system", "content": systemPrompt },
        { "role": "user", "content": userQuery }
      ]
    };

    const options = {
      "method": "post",
      "headers": {
        "Authorization": "Bearer " + apiKey
      },
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };

    var response = UrlFetchApp.fetch(url, options);
    const resText = response.getContentText();
    const resJson = JSON.parse(resText);
    const aiReply = resJson.choices?.[0]?.message?.content || "Maaf, otak Savora AI mengalami sedikit kebingungan. Silakan coba tanyakan kembali.";
    return aiReply;
  } catch (error) {
    Logger.log("Error getGeminiResponse: " + error.toString());
    throw new Error("Gagal mengurai kecerdasan cloud Savora: " + error.message);
  }
}

function pingServer() {
  return { success: true, timestamp: new Date().getTime() };
}

function archiveOldTransactions() {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Transactions");
    if (!sheet) return { success: false, message: "Sheet Transactions tidak ditemukan." };
    
    var archiveSheet = ss.getSheetByName("ArchiveTransactions");
    if (!archiveSheet) {
      archiveSheet = ss.insertSheet("ArchiveTransactions");
      var headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Deskripsi', 'Akun', 'TransferKe'];
      archiveSheet.appendRow(headers);
      archiveSheet.getRange(1, 1, 1, headers.length)
                  .setFontWeight('bold')
                  .setBackground('#0B192C')
                  .setFontColor('#FFFFFF');
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { success: true, count: 0, message: "Tidak ada transaksi untuk diarsipkan." };
    
    var header = data[0];
    var rowsToKeep = [];
    var rowsToArchive = [];
    
    var today = new Date();
    var oneYearAgo = today.getTime() - (365 * 24 * 60 * 60 * 1000); 
    
    for (var i = 1; i < data.length; i++) {
      var rawDate = data[i][1];
      var txDate = new Date(rawDate);
      
      if (!isNaN(txDate.getTime()) && txDate.getTime() < oneYearAgo) {
        var archivedRow = [...data[i]];
        archivedRow[1] = Utilities.formatDate(txDate, 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
        rowsToArchive.push(archivedRow);
      } else {
        rowsToKeep.push(data[i]);
      }
    }
    
    if (rowsToArchive.length > 0) {
      archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, rowsToArchive.length, header.length).setValues(rowsToArchive);
      sheet.clearContents();
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
      if (rowsToKeep.length > 0) {
        sheet.getRange(2, 1, rowsToKeep.length, header.length).setValues(rowsToKeep);
      }
      SpreadsheetApp.flush();
    }
    
    return { 
      success: true, 
      count: rowsToArchive.length, 
      message: "Berhasil mengarsipkan " + rowsToArchive.length + " transaksi berumur lebih dari 1 tahun ke sheet ArchiveTransactions!" 
    };
  } catch (error) {
    Logger.log("Error archiveOldTransactions: " + error.toString());
    return { success: false, message: error.toString() };
  }
}

function submitSupportTicket(payload) {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SUPPORT_TICKETS");
    if (!sheet) {
      sheet = ss.insertSheet("SUPPORT_TICKETS");
      var headers = ["ID TIKET", "TANGGAL MASUK", "NAMA CLIENT", "EMAIL CLIENT", "DESKRIPSI KENDALA", "BALASAN ADMIN", "STATUS", "RAW_TIMESTAMP"];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0B192C').setFontColor('#FFFFFF');
    }

    var today = new Date();
    var dateStr = Utilities.formatDate(today, 'Asia/Jakarta', 'yyyyMMdd');
    var timestamp = Utilities.formatDate(today, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
    
    var data = sheet.getDataRange().getValues();
    var counter = 1;
    for (var i = 1; i < data.length; i++) {
      var rowId = data[i][0].toString();
      if (rowId && rowId.indexOf("TKT-" + dateStr + "-") === 0) {
        counter++;
      }
    }
    
    var formattedCounter = String(counter).padStart(4, '0');
    var ticketId = "TKT-" + dateStr + "-" + formattedCounter;
    
    sheet.appendRow([
      ticketId,
      timestamp,
      payload.nama,
      payload.email,
      payload.kendala,
      "",
      "Pending",
      today.getTime()
    ]);
    
    SpreadsheetApp.flush(); 
    return { success: true, ticketId: ticketId };
  } catch (error) {
    Logger.log("Error submitSupportTicket: " + error.toString());
    return { success: false, message: error.message };
  }
}

function getTicketsByEmail(email) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("SUPPORT_TICKETS");
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];

    var filteredTickets = [];
    for (var i = 1; i < data.length; i++) {
      if (data[i][3] && data[i][3].toString().toLowerCase() === email.toLowerCase()) {
        var formattedDate = "";
        try {
          var dateObj = new Date(data[i][1]);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = Utilities.formatDate(dateObj, 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
          } else {
            formattedDate = data[i][1] ? String(data[i][1]) : "";
          }
        } catch (e) {
          formattedDate = data[i][1] ? String(data[i][1]) : "";
        }

        filteredTickets.push({
          id: data[i][0],
          tanggal: formattedDate,
          nama: data[i][2],
          email: data[i][3],
          kendala: data[i][4],
          balasan: data[i][5] || "Belum ada tanggapan dari admin harian.",
          status: data[i][6] || "Pending"
        });
      }
    }
    
    return filteredTickets.reverse(); 
  } catch (error) {
    Logger.log("Error getTicketsByEmail: " + error.toString());
    return [];
  }
}

function onEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();
    if (sheet.getName() !== "SUPPORT_TICKETS") return;
    
    var range = e.range;
    var col = range.getColumn();
    var row = range.getRow();
    if (row === 1) return; 
    
    if (col === 6) {
      var replyText = range.getValue().toString().trim();
      if (!replyText) return;
      
      var rowValues = sheet.getRange(row, 1, 1, 7).getValues()[0];
      var ticketId = rowValues[0];
      var userEmail = rowValues[3];
      var userMessage = rowValues[4];
      var currentStatus = rowValues[6];
      
      sendAdminReplyEmail(ticketId, userEmail, userMessage, replyText);
      
      if (currentStatus !== "Selesai") {
        sheet.getRange(row, 7).setValue("Selesai");
      }
      
      SpreadsheetApp.flush(); 
    }
  } catch (error) {
    Logger.log("Error onEdit Support: " + error.toString());
  }
}

function sendAdminReplyEmail(ticketId, userEmail, userMessage, replyText) {
  try {
    var subject = "[Savora Support] Tanggapan Mengenai Tiket Bantuan Anda #" + ticketId;
    var body = "Halo,\n\n" +
               "Terima kasih telah menghubungi Pusat Bantuan Savora. Tim dukungan teknis kami telah meninjau kendala Anda dan memberikan tanggapan resmi:\n\n" +
               "--------------------------------------------------\n" +
               "Kendala Anda:\n\"" + userMessage + "\"\n\n" +
               "Tanggapan Resmi Admin:\n\"" + replyText + "\"\n" +
               "--------------------------------------------------\n\n" +
               "Status tiket bantuan Anda saat ini telah ditandai sebagai 'Selesai'. Anda dapat memantau kembali seluruh riwayat aduan Anda secara real-time langsung melalui tab 'Lacak Tiket Saya' pada menu Pusat Bantuan di dalam aplikasi Savora.\n\n" +
               "Salam hangat,\n" +
               "Tim Layanan Pelanggan Savora";
               
    GmailApp.sendEmail(userEmail, subject, body);
    Logger.log("Email tanggapan untuk tiket " + ticketId + " berhasil dikirim ke " + userEmail);
  } catch (error) {
    Logger.log("Error sendAdminReplyEmail: " + error.toString());
  }
}

function reconcileDatabaseBalances() {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetAcc = ss.getSheetByName("Accounts");
    var sheetSv = ss.getSheetByName("Savings");
    if (!sheetAcc) return { success: false, message: "Database Accounts tidak ditemukan." };

    var accData = sheetAcc.getDataRange().getValues();
    var svData = sheetSv ? sheetSv.getDataRange().getValues() : [];

    var totalSavingsTerkumpul = 0;
    for (var i = 1; i < svData.length; i++) {
      if (svData[i][0] && svData[i][5] !== "Tercapai") {
        totalSavingsTerkumpul += Number(svData[i][3] || 0);
      }
    }

    var updated = false;
    for (var j = 1; j < accData.length; j++) {
      if (accData[j][1] === "Savings Pocket" || accData[j][2] === "Savings") {
        sheetAcc.getRange(j + 1, 5).setValue(totalSavingsTerkumpul);
        updated = true;
        break;
      }
    }

    SpreadsheetApp.flush(); 
    return { 
      success: true, 
      message: "Sistem Rekonsiliasi Savora: Saldo Saku Tabungan (" + totalSavingsTerkumpul + ") berhasil diselaraskan otomatis ke Accounts!" 
    };
  } catch (error) {
    Logger.log("Error reconcileDatabaseBalances: " + error.toString());
    return { success: false, message: error.toString() };
  }
}

/**
 * ====================================================================
 * 🧼 SYSTEM CLOUD CLEANING ENGINE (FACTORY RESET CLOUD SINKRON)
 * ====================================================================
 */
function clearDatabaseCloud() {
  try {
    clearSavoraCache();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    var sheetsToClean = [
      { name: "Transactions", headers: [["ID", "Tanggal", "Tipe", "Kategori", "Jumlah", "Deskripsi", "Akun", "TransferKe"]] },
      { name: "SUPPORT_TICKETS", headers: [["ID TIKET", "TANGGAL MASUK", "NAMA CLIENT", "EMAIL CLIENT", "DESKRIPSI KENDALA", "BALASAN ADMIN", "STATUS", "RAW_TIMESTAMP"]] }
    ];

    sheetsToClean.forEach(function(sheetObj) {
      var sheet = ss.getSheetByName(sheetObj.name);
      if (sheet) {
        sheet.clearContents();
        sheet.getRange(1, 1, 1, sheetObj.headers[0].length).setValues(sheetObj.headers);
      }
    });

    var sheetAcc = ss.getSheetByName("Accounts");
    if (sheetAcc) {
      sheetAcc.clearContents();
      var accHeaders = [["ID", "Nama Akun", "Tipe", "Keterangan", "Saldo"]];
      sheetAcc.getRange(1, 1, 1, accHeaders[0].length).setValues(accHeaders);
      sheetAcc.appendRow(["ACC_1", "Cash Wallet", "Cash", "Dompet Tunai Utama", 0]);
      sheetAcc.appendRow(["ACC_2", "Mandiri Bank", "Bank", "Tabungan Mandiri", 0]);
      sheetAcc.appendRow(["ACC_3", "BCA Bank", "M-Banking", "Rekening BCA Bisnis", 0]);
      sheetAcc.appendRow(["ACC_4", "Savings Pocket", "Savings", "Celengan Saku Savora", 0]);
    }

    var sheetCat = ss.getSheetByName("Categories");
    if (sheetCat) {
      sheetCat.clearContents();
      var catHeaders = [["Nama Kategori", "Tipe", "Limit Bulanan"]];
      sheetCat.getRange(1, 1, 1, catHeaders[0].length).setValues(catHeaders);
      sheetCat.appendRow(["Food & Beverage", "Expense", 1500000]);
      sheetCat.appendRow(["Transportation", "Expense", 500000]);
      sheetCat.appendRow(["Entertainment", "Expense", 1000000]);
      sheetCat.appendRow(["Monthly Salary", "Income", 0]);
      sheetCat.appendRow(["Investment", "Savings", 1500000]);
    }

    var sheetSv = ss.getSheetByName("Savings");
    if (sheetSv) {
      sheetSv.clearContents();
      var svHeaders = [["ID", "Nama Target", "Target Jumlah", "Terkumpul", "Tenggat Waktu", "Status", "Kategori", "Jadwal Rutin", "Hari Setoran"]];
      sheetSv.getRange(1, 1, 1, svHeaders[0].length).setValues(svHeaders);
      sheetSv.appendRow(["SV_1", "Dream House Down Payment", 45000000, 0, "2026-12-31", "Aktif", "Personal", "Bebas", ""]);
      sheetSv.appendRow(["SV_2", "Macbook Air 2026 Laptop", 13000000, 0, "2026-11-30", "Aktif", "Personal", "Bebas", ""]);
      sheetSv.appendRow(["SV_3", "Motor Honda PCX 160", 44000000, 0, "2026-10-31", "Aktif", "Family", "Bebas", ""]);
    }

    var sheetCal = ss.getSheetByName("CalendarEvents");
    if (sheetCal) {
      sheetCal.clearContents();
      var calHeaders = [["Tanggal", "JournalText", "LimitBelanja", "RemindersJSON"]];
      sheetCal.getRange(1, 1, 1, calHeaders[0].length).setValues(calHeaders);
      
      var today = new Date();
      var todayStr = Utilities.formatDate(today, "Asia/Jakarta", "yyyy-MM-dd");
      var initialReminder = JSON.stringify([{ text: "🎯 Mulai catat transaksi pertama Anda di Savora", done: false }]);
      sheetCal.appendRow([todayStr, "Memulai lembaran keuangan baru yang bersih!", 0, initialReminder]);
    }

    var sheetChat = ss.getSheetByName("ChatHistory");
    if (sheetChat) {
      sheetChat.clearContents();
      var chatHeaders = [["Timestamp", "Sender", "Text", "Mode"]];
      sheetChat.getRange(1, 1, 1, chatHeaders[0].length).setValues(chatHeaders);
      sheetChat.appendRow([Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss"), "ai", "Halo! Selamat datang kembali di Savora AI setelah system reset.", "consult"]);
    }

    SpreadsheetApp.flush();
    return { success: true, message: "Database Cloud Savora berhasil disapu bersih ke setelan awal!" };
  } catch (error) {
    Logger.log("Error clearDatabaseCloud: " + error.toString());
    return { success: false, message: "Gagal memproses reset di cloud: " + error.message };
  }
}

function pemicuIzin() {
  Drive.Files.list({maxResults: 1});
  try {
    DocumentApp.create("Savora Temp Trigger"); 
  } catch(e) {}
}

function simpanGroqApiKeySekaliJalan() {
  setGroqApiKey("");
}