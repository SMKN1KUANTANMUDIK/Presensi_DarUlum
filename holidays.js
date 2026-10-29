// holidays.js - Modul Kalender Libur Nasional Indonesia & Madrasah Multi-Tahun
(function (root) {
  // 1. Hari Libur Nasional Tanggal Tetap Masehi (Berlaku Abadi untuk Tahun Berapapun)
  var FIXED_DATE_HOLIDAYS = {
    "01-01": "Tahun Baru Masehi",
    "05-01": "Hari Buruh Internasional",
    "06-01": "Hari Lahir Pancasila",
    "08-17": "Hari Proklamasi Kemerdekaan RI",
    "12-25": "Hari Raya Natal",
    "12-26": "Cuti Bersama Hari Raya Natal"
  };

  // 2. Database Libur Nasional & Cuti Bersama (SKB 3 Menteri & Proyeksi Kalender Astronomis)
  var BUILTIN_INDONESIAN_HOLIDAYS = {
    // 2025
    "2025-01-01": "Tahun Baru 2025 Masehi",
    "2025-01-27": "Isra Mikraj Nabi Muhammad SAW",
    "2025-01-28": "Cuti Bersama Tahun Baru Imlek",
    "2025-01-29": "Tahun Baru Imlek 2576 Kongzili",
    "2025-03-28": "Cuti Bersama Hari Suci Nyepi",
    "2025-03-29": "Hari Suci Nyepi (Tahun Baru Saka 1947)",
    "2025-03-31": "Hari Raya Idul Fitri 1446 H",
    "2025-04-01": "Hari Raya Idul Fitri 1446 H",
    "2025-04-02": "Cuti Bersama Idul Fitri 1446 H",
    "2025-04-03": "Cuti Bersama Idul Fitri 1446 H",
    "2025-04-04": "Cuti Bersama Idul Fitri 1446 H",
    "2025-04-07": "Cuti Bersama Idul Fitri 1446 H",
    "2025-04-18": "Wafat Yesus Kristus",
    "2025-04-20": "Kebangkitan Yesus Kristus (Paskah)",
    "2025-05-01": "Hari Buruh Internasional",
    "2025-05-12": "Hari Raya Waisak 2569 BE",
    "2025-05-13": "Cuti Bersama Hari Raya Waisak",
    "2025-05-29": "Kenaikan Yesus Kristus",
    "2025-05-30": "Cuti Bersama Kenaikan Yesus Kristus",
    "2025-06-01": "Hari Lahir Pancasila",
    "2025-06-06": "Hari Raya Idul Adha 1446 H",
    "2025-06-09": "Cuti Bersama Hari Raya Idul Adha",
    "2025-06-27": "1 Muharam Tahun Baru Islam 1447 H",
    "2025-08-17": "Proklamasi Kemerdekaan RI Ke-80",
    "2025-09-05": "Maulid Nabi Muhammad SAW",
    "2025-12-25": "Hari Raya Natal",
    "2025-12-26": "Cuti Bersama Hari Raya Natal",

    // 2026
    "2026-01-01": "Tahun Baru 2026 Masehi",
    "2026-01-16": "Isra Mikraj Nabi Muhammad SAW",
    "2026-02-16": "Cuti Bersama Tahun Baru Imlek",
    "2026-02-17": "Tahun Baru Imlek 2577 Kongzili",
    "2026-03-18": "Cuti Bersama Hari Suci Nyepi",
    "2026-03-19": "Hari Suci Nyepi (Tahun Baru Saka 1948)",
    "2026-03-20": "Cuti Bersama Idul Fitri 1447 H",
    "2026-03-21": "Hari Raya Idul Fitri 1447 H",
    "2026-03-22": "Hari Raya Idul Fitri 1447 H",
    "2026-03-23": "Cuti Bersama Idul Fitri 1447 H",
    "2026-03-24": "Cuti Bersama Idul Fitri 1447 H",
    "2026-04-03": "Wafat Yesus Kristus",
    "2026-04-05": "Hari Paskah",
    "2026-05-01": "Hari Buruh Internasional",
    "2026-05-14": "Kenaikan Yesus Kristus",
    "2026-05-15": "Cuti Bersama Kenaikan Yesus Kristus",
    "2026-05-27": "Hari Raya Idul Adha 1447 H",
    "2026-05-28": "Cuti Bersama Idul Adha 1447 H",
    "2026-05-31": "Hari Raya Waisak 2570 BE",
    "2026-06-01": "Hari Lahir Pancasila",
    "2026-06-16": "1 Muharram Tahun Baru Islam 1448 H",
    "2026-08-17": "Proklamasi Kemerdekaan RI Ke-81",
    "2026-08-25": "Maulid Nabi Muhammad SAW",
    "2026-12-24": "Cuti Bersama Hari Raya Natal",
    "2026-12-25": "Hari Raya Natal",

    // 2027
    "2027-01-01": "Tahun Baru 2027 Masehi",
    "2027-01-05": "Isra Mikraj Nabi Muhammad SAW",
    "2027-02-05": "Cuti Bersama Tahun Baru Imlek",
    "2027-02-06": "Tahun Baru Imlek",
    "2027-03-08": "Hari Suci Nyepi (Tahun Baru Saka)",
    "2027-03-09": "Cuti Bersama Idul Fitri",
    "2027-03-10": "Hari Raya Idul Fitri 1448 H",
    "2027-03-11": "Hari Raya Idul Fitri 1448 H",
    "2027-03-12": "Cuti Bersama Idul Fitri",
    "2027-03-15": "Cuti Bersama Idul Fitri",
    "2027-03-26": "Wafat Yesus Kristus",
    "2027-05-01": "Hari Buruh Internasional",
    "2027-05-06": "Kenaikan Yesus Kristus",
    "2027-05-18": "Hari Raya Idul Adha 1448 H",
    "2027-05-19": "Cuti Bersama Hari Raya Waisak",
    "2027-05-20": "Hari Raya Waisak",
    "2027-06-01": "Hari Lahir Pancasila",
    "2027-06-06": "1 Muharam Tahun Baru Islam 1449 H",
    "2027-08-15": "Maulid Nabi Muhammad SAW",
    "2027-08-17": "Proklamasi Kemerdekaan RI Ke-82",
    "2027-12-24": "Cuti Bersama Natal",
    "2027-12-25": "Hari Raya Natal",

    // 2028 (SKB / Proyeksi Kalender Astronomis Nasional)
    "2028-01-01": "Tahun Baru 2028 Masehi",
    "2028-01-24": "Isra Mikraj Nabi Muhammad SAW",
    "2028-01-26": "Tahun Baru Imlek 2579 Kongzili",
    "2028-03-09": "Hari Raya Idul Fitri 1449 H",
    "2028-03-10": "Hari Raya Idul Fitri 1449 H",
    "2028-03-11": "Cuti Bersama Hari Raya Idul Fitri",
    "2028-03-12": "Cuti Bersama Hari Raya Idul Fitri",
    "2028-03-27": "Hari Suci Nyepi (Tahun Baru Saka 1950)",
    "2028-04-14": "Wafat Yesus Kristus (Jumat Agung)",
    "2028-04-16": "Hari Paskah",
    "2028-05-01": "Hari Buruh Internasional",
    "2028-05-09": "Hari Raya Waisak 2572 BE",
    "2028-05-16": "Hari Raya Idul Adha 1449 H",
    "2028-05-25": "Kenaikan Yesus Kristus",
    "2028-06-01": "Hari Lahir Pancasila",
    "2028-06-25": "1 Muharam Tahun Baru Islam 1450 H",
    "2028-08-14": "Maulid Nabi Muhammad SAW",
    "2028-08-17": "Proklamasi Kemerdekaan RI Ke-83",
    "2028-12-24": "Cuti Bersama Hari Raya Natal",
    "2028-12-25": "Hari Raya Natal",
    "2028-12-26": "Cuti Bersama Hari Raya Natal",

    // 2029 (SKB / Proyeksi Kalender Astronomis Nasional)
    "2029-01-01": "Tahun Baru 2029 Masehi",
    "2029-01-14": "Isra Mikraj Nabi Muhammad SAW",
    "2029-02-13": "Tahun Baru Imlek 2580 Kongzili",
    "2029-02-27": "Hari Raya Idul Fitri 1450 H",
    "2029-02-28": "Hari Raya Idul Fitri 1450 H",
    "2029-03-01": "Cuti Bersama Hari Raya Idul Fitri",
    "2029-03-16": "Hari Suci Nyepi (Tahun Baru Saka 1951)",
    "2029-03-30": "Wafat Yesus Kristus (Jumat Agung)",
    "2029-04-01": "Hari Paskah",
    "2029-05-01": "Hari Buruh Internasional",
    "2029-05-06": "Hari Raya Idul Adha 1450 H",
    "2029-05-10": "Kenaikan Yesus Kristus",
    "2029-05-28": "Hari Raya Waisak 2573 BE",
    "2029-06-01": "Hari Lahir Pancasila",
    "2029-06-15": "1 Muharam Tahun Baru Islam 1451 H",
    "2029-08-17": "Proklamasi Kemerdekaan RI Ke-84",
    "2029-09-02": "Maulid Nabi Muhammad SAW",
    "2029-12-24": "Cuti Bersama Hari Raya Natal",
    "2029-12-25": "Hari Raya Natal",
    "2029-12-26": "Cuti Bersama Hari Raya Natal",

    // 2030 (SKB / Proyeksi Kalender Astronomis Nasional)
    "2030-01-01": "Tahun Baru 2030 Masehi",
    "2030-01-03": "Isra Mikraj Nabi Muhammad SAW",
    "2030-02-03": "Tahun Baru Imlek 2581 Kongzili",
    "2030-02-16": "Hari Raya Idul Fitri 1451 H",
    "2030-02-17": "Hari Raya Idul Fitri 1451 H",
    "2030-02-18": "Cuti Bersama Hari Raya Idul Fitri",
    "2030-03-05": "Hari Suci Nyepi (Tahun Baru Saka 1952)",
    "2030-04-19": "Wafat Yesus Kristus (Jumat Agung)",
    "2030-04-21": "Hari Paskah",
    "2030-04-26": "Hari Raya Idul Adha 1451 H",
    "2030-05-01": "Hari Buruh Internasional",
    "2030-05-17": "Hari Raya Waisak 2574 BE",
    "2030-05-30": "Kenaikan Yesus Kristus",
    "2030-06-01": "Hari Lahir Pancasila",
    "2030-06-04": "1 Muharam Tahun Baru Islam 1452 H",
    "2030-08-17": "Proklamasi Kemerdekaan RI Ke-85",
    "2030-08-22": "Maulid Nabi Muhammad SAW",
    "2030-12-24": "Cuti Bersama Hari Raya Natal",
    "2030-12-25": "Hari Raya Natal",
    "2030-12-26": "Cuti Bersama Hari Raya Natal"
  };

  var HolidayManager = {
    /**
     * Mengambil daftar seluruh hari libur (bawaan + cloud + custom)
     */
    getAllHolidays: function () {
      var merged = Object.assign({}, BUILTIN_INDONESIAN_HOLIDAYS);

      // 1. Data sinkronisasi cloud dari localStorage
      try {
        if (typeof localStorage !== "undefined") {
          var cached = localStorage.getItem("indonesia_holidays_synced");
          if (cached) {
            var parsed = JSON.parse(cached);
            Object.assign(merged, parsed);
          }
        }
      } catch (e) {}

      // 2. Custom holidays dari Pengaturan Madrasah / Yayasan
      try {
        if (typeof localStorage !== "undefined") {
          var customLocal = localStorage.getItem("app_custom_holidays");
          if (customLocal) {
            Object.assign(merged, JSON.parse(customLocal));
          }
        }
      } catch (e) {}

      if (root.appSettings && root.appSettings.customHolidays) {
        if (typeof root.appSettings.customHolidays === "string") {
          try {
            Object.assign(merged, JSON.parse(root.appSettings.customHolidays));
          } catch (e) {}
        } else {
          Object.assign(merged, root.appSettings.customHolidays);
        }
      }
      return merged;
    },

    /**
     * Memeriksa dan mengambil informasi libur untuk satu tanggal spesifik (YYYY-MM-DD).
     * Bekerja untuk tahun sekarang maupun tahun berapapun di masa depan.
     */
    getHoliday: function (dateStr) {
      if (!dateStr) return null;
      var s = String(dateStr).trim();
      if (s.indexOf("'") === 0) s = s.substring(1);
      var p = s.split("-");
      if (p.length === 3) {
        var y = p[0];
        var m = p[1].length === 1 ? "0" + p[1] : p[1];
        var d = p[2].length === 1 ? "0" + p[2] : p[2];
        var key = y + "-" + m + "-" + d;
        var md = m + "-" + d;

        var all = this.getAllHolidays();

        // 1. Cek apakah ada di database/cloud/custom
        if (all[key]) {
          var custObj = root.appSettings && root.appSettings.customHolidays;
          if (typeof custObj === "string") {
            try { custObj = JSON.parse(custObj); } catch(e){}
          }
          var isCustom = (custObj && !!custObj[key]);
          return {
            date: key,
            name: all[key],
            isHoliday: true,
            isCustom: isCustom
          };
        }

        // 2. Cek apakah tanggal tetap nasional (berlaku abadi untuk tahun berapapun)
        if (FIXED_DATE_HOLIDAYS[md]) {
          return {
            date: key,
            name: FIXED_DATE_HOLIDAYS[md] + " " + y,
            isHoliday: true,
            isCustom: false,
            isFixedPerpetual: true
          };
        }
      }
      return null;
    },

    /**
     * True jika tanggal tersebut merupakan hari libur
     */
    isHolidayDate: function (dateStr) {
      return this.getHoliday(dateStr) !== null;
    },

    /**
     * Mengambil seluruh hari libur untuk tahun tertentu
     */
    getHolidaysForYear: function (year) {
      var yStr = String(year).trim();
      var all = this.getAllHolidays();
      var result = {};

      // 1. Masukkan libur tetap abadi untuk tahun tersebut
      for (var fKey in FIXED_DATE_HOLIDAYS) {
        result[yStr + "-" + fKey] = FIXED_DATE_HOLIDAYS[fKey] + " " + yStr;
      }

      // 2. Gabungkan dengan data tersimpan
      for (var k in all) {
        if (k.indexOf(yStr + "-") === 0) {
          result[k] = all[k];
        }
      }
      return result;
    },

    /**
     * Sinkronisasi kalender libur dari repositori cloud publik resmi
     */
    syncFromCloud: function (callback) {
      if (typeof fetch === "undefined") {
        if (callback) callback(false, "Fetch not supported");
        return;
      }
      var url = "https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json";
      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        })
        .then(function (data) {
          var extracted = {};
          for (var k in data) {
            if (data[k].holiday) {
              extracted[k] = data[k].summary ? data[k].summary.join(", ") : "Hari Libur Nasional";
            }
          }
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("indonesia_holidays_synced", JSON.stringify(extracted));
          }
          console.log("[Holidays] Kalender libur Indonesia berhasil diperbarui dari cloud:", Object.keys(extracted).length, "tanggal");
          if (callback) callback(true, extracted);
        })
        .catch(function (err) {
          console.warn("[Holidays] Menggunakan dataset libur lokal bawaan:", err);
          if (callback) callback(false, err);
        });
    }
  };

  root.HolidayManager = HolidayManager;
  root.BUILTIN_INDONESIAN_HOLIDAYS = BUILTIN_INDONESIAN_HOLIDAYS;
  root.FIXED_DATE_HOLIDAYS = FIXED_DATE_HOLIDAYS;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = HolidayManager;
  }

  // Sinkronisasi otomatis di latar belakang jika di browser
  if (typeof window !== "undefined") {
    setTimeout(function () {
      HolidayManager.syncFromCloud();
    }, 2000);
  }
})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
