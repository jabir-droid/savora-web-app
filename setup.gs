/**
 * ==========================================
 * 🛠️ SAVORA - DATABASE INITIALIZER (setup.gs)
 * ==========================================
 * Author: ZettBOT by Zettbos
 * Revision: Integrated SUPPORT_TICKETS sheet creation with sample data.
 */

/**
 * Trigger otomatis saat Spreadsheet dibuka untuk memunculkan menu setup.
 * Dilengkapi pengaman try-catch jika dibuka di environment tanpa UI.
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
    .addToUi();
}

/**
 * Membuat seluruh Sheet dengan header standar secara otomatis jika belum terbentuk.
 * Dilengkapi pengisian data awal (dummy/mock) agar aplikasi siap pakai seketika.
 * Aman dijalankan dari context editor, webapp, maupun spreadsheet secara langsung.
 */
function setupSavoraDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let ui;
  
  // Deteksi Context UI secara aman (Anti-Crash)
  try {
    ui = SpreadsheetApp.getUi();
  } catch (e) {
    ui = null;
  }
  
  try {
    const requiredSheets = [
      {
        name: 'Transactions',
        headers: [['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Deskripsi', 'Akun', 'TransferKe']]
      },
      {
        name: 'Savings',
        headers: [['ID', 'Nama Target', 'Target Jumlah', 'Terkumpul', 'Tenggat Waktu', 'Status', 'Kategori', 'Jadwal Rutin', 'Hari Setoran']]
      },
      {
        name: 'Categories',
        headers: [['Nama Kategori', 'Tipe', 'Limit Bulanan']]
      },
      {
        name: 'Accounts',
        headers: [['ID', 'Nama Akun', 'Tipe', 'Keterangan', 'Saldo']]
      },
      {
        name: 'CalendarEvents',
        headers: [['Tanggal', 'JournalText', 'LimitBelanja', 'RemindersJSON']]
      },
      {
        name: 'ChatHistory',
        headers: [['Timestamp', 'Sender', 'Text', 'Mode']]
      },
      {
        name: 'SUPPORT_TICKETS',
        headers: [['ID TIKET', 'TANGGAL MASUK', 'NAMA CLIENT', 'EMAIL CLIENT', 'DESKRIPSI KENDALA', 'BALASAN ADMIN', 'STATUS', 'RAW_TIMESTAMP']]
      }
    ];
    
    requiredSheets.forEach(sheetObj => {
      let sheet = ss.getSheetByName(sheetObj.name);
      if (!sheet) {
        sheet = ss.insertSheet(sheetObj.name);
        sheet.getRange(1, 1, 1, sheetObj.headers[0].length)
             .setValues(sheetObj.headers)
             .setFontWeight('bold')
             .setBackground('#0B192C')
             .setFontColor('#FFFFFF');
        
        // Inject Data Awal (Mockup) untuk memudahkan user di deployment pertama
        if (sheetObj.name === 'Accounts') {
          sheet.appendRow(["ACC_1", "Cash Wallet", "Cash", "Dompet Tunai Utama", 250000]);
          sheet.appendRow(["ACC_2", "Mandiri Bank", "Bank", "Tabungan Mandiri", 25000000]);
          sheet.appendRow(["ACC_3", "BCA Bank", "M-Banking", "Rekening BCA Bisnis", 125500000]);
          sheet.appendRow(["ACC_4", "Savings Pocket", "Savings", "Celengan Saku Savora", 63400000]);
        } else if (sheetObj.name === 'Categories') {
          sheet.appendRow(["Food & Beverage", "Expense", 1500000]);
          sheet.appendRow(["Transportation", "Expense", 500000]);
          sheet.appendRow(["Entertainment", "Expense", 1000000]);
          sheet.appendRow(["Monthly Salary", "Income", 0]);
          sheet.appendRow(["Investment", "Savings", 1500000]);
        } else if (sheetObj.name === 'Savings') {
          sheet.appendRow(["SV_1", "Dream House Down Payment", 45000000, 40700000, "2026-12-31", "Aktif", "Personal", "Bebas", ""]);
          sheet.appendRow(["SV_2", "Macbook Air 2026 Laptop", 13000000, 1300000, "2026-09-30", "Aktif", "Personal", "Bebas", ""]);
          sheet.appendRow(["SV_3", "Travel to Karimunjawa", 3200000, 800000, "2026-07-15", "Aktif", "Mutual", "Bebas", ""]);
          sheet.appendRow(["SV_4", "Honda PCX 160 Motorcycle", 44000000, 5300000, "2026-10-31", "Aktif", "Family", "Bebas", ""]);
          sheet.appendRow(["SV_5", "Umrah with Parents", 120000000, 12000000, "2027-05-01", "Aktif", "Family", "Bebas", ""]);
          sheet.appendRow(["SV_6", "College Semester Tuition", 6000000, 3300000, "2026-08-01", "Aktif", "Personal", "Bebas", ""]);
        } else if (sheetObj.name === 'Transactions') {
          sheet.appendRow(["TX_1", "2026-05-25 08:30:00", "Income", "Monthly Salary", 15000000, "Gaji Pokok Bulanan Savora", "BCA Bank", ""]);
          sheet.appendRow(["TX_2", "2026-05-25 12:15:00", "Expense", "Food & Beverage", 75000, "Makan Siang Bebek Goreng", "Cash Wallet", ""]);
          sheet.appendRow(["TX_3", "2026-05-25 15:00:00", "Expense", "Transportation", 150000, "Isi Bensin Pertamax Mobil", "Cash Wallet", ""]);
        } else if (sheetObj.name === 'ChatHistory') {
          sheet.appendRow(["2026-06-06 14:00:00", "ai", "Halo! Selamat datang di Savora AI Advisor.", "consult"]);
        } else if (sheetObj.name === 'SUPPORT_TICKETS') {
          sheet.appendRow(["TKT-20260615-0001", "15/06/2026 09:00:00", "Budi Prasetyo", "budi@gmail.com", "Gagal memuat halaman checkout payment", "Sesi server sudah diperbarui, silakan dicoba login kembali.", "Selesai", new Date().getTime()]);
          sheet.hideColumns(8); // Sembunyikan kolom timestamp murni
        }
      }
    });
    
    SpreadsheetApp.flush();
    
    if (ui) {
      ui.alert('Sukses', 'Seluruh database Savora berhasil dikonfigurasi secara real-time cloud!', ui.ButtonSet.OK);
    } else {
      Logger.log('Success: Seluruh database Savora berhasil dikonfigurasi secara real-time cloud!');
    }
  } catch (error) {
    Logger.log('Setup Error: ' + error.toString());
    if (ui) {
      ui.alert('Error Setup', 'Gagal memformat database: ' + error.message, ui.ButtonSet.OK);
    }
  }
}

/**
 * Memasang pemicu jadwal pembersihan (Trigger) otomatis bulanan/mingguan
 */
function createSavoraAutoTriggers() {
  try {
    // Bersihkan trigger lama agar tidak terjadi duplikasi
    var existingTriggers = ScriptApp.getProjectTriggers();
    for (var i = 0; i < existingTriggers.length; i++) {
      var handler = existingTriggers[i].getHandlerFunction();
      if (handler === 'autoCleanOldChats' || handler === 'archiveOldTransactions') {
        ScriptApp.deleteTrigger(existingTriggers[i]);
      }
    }

    // Trigger 1: Pembersihan ChatHistory setiap hari Minggu jam 02:00 Pagi
    ScriptApp.newTrigger('autoCleanOldChats')
      .timeBased()
      .everyWeeks(1)
      .onWeekDay(ScriptApp.WeekDay.SUNDAY)
      .atHour(2)
      .create();

    // Trigger 2: Pengarsipan Transaksi Lama (>365 hari) setiap tanggal 1 jam 03:00 Pagi
    ScriptApp.newTrigger('archiveOldTransactions')
      .timeBased()
      .onMonthDay(1)
      .atHour(3)
      .create();

    Logger.log("Pemicu pembersihan otomatis Savora berhasil dipasang!");
    return "Pemicu pembersihan otomatis Savora berhasil dipasang!";
  } catch (e) {
    Logger.log("Error createSavoraAutoTriggers: " + e.message);
    return "Gagal memasang trigger: " + e.message;
  }
}