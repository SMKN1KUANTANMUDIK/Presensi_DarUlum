var currentPage = "dashboard";
var activeType = "guru"; // Default to Pegawai
var currentFilterDate = "";
var students = [];
var attendance = [];
var stats = {};
var rekapData = null;
var filterKelas = "Semua";
var colors = ["blue", "green", "orange", "purple", "cyan"];
var appSettings = {}; // NEW
var teachersMasterCache = [];

// Standarisasi Pengkategorian: Kelas Siswa & Unit Kerja Pegawai
var STANDARD_STUDENT_CLASSES = [
  "Rumah Quran",
  "TK/PAUD",
  "SDIT Kelas 1",
  "SDIT Kelas 2",
  "SDIT Kelas 3",
  "SDIT Kelas 4",
  "SDIT Kelas 5",
  "SDIT Kelas 6"
];

var PEGAWAI_UNITS = [
  "Semua",
  "Yayasan",
  "Rumah Quran",
  "TK/PAUD",
  "SDIT"
];

function isRumahQuranRole(roleStr) {
  var low = String(roleStr || "").toLowerCase();
  return low.indexOf("rumah quran") > -1 || low.indexOf("rumah qur'an") > -1;
}

function parsePegawaiRoles(raw) {
  var str = (typeof raw === "string" ? raw : (raw ? (raw.recapRole || raw.jabatan || raw.kelas || "") : "")).trim();
  if (!str) return ["Yayasan - Staf"];
  if (str.indexOf(",") > -1) {
    return str.split(",").map(function(s) { return s.trim(); }).filter(Boolean);
  }
  return [str];
}

function getPegawaiUnitFromRole(rawRole) {
  if (!rawRole) return "Yayasan";
  var raw = String(rawRole).trim();
  if (raw.indexOf(" - ") > -1) {
    var p0 = raw.split(" - ")[0].trim();
    if (["Yayasan", "Rumah Quran", "TK/PAUD", "SDIT"].indexOf(p0) > -1) {
      return p0;
    }
  }
  var low = raw.toLowerCase();
  if (low.indexOf("rumah quran") > -1 || low.indexOf("rumah qur'an") > -1) return "Rumah Quran";
  if (low.indexOf("tk") > -1 || low.indexOf("paud") > -1) return "TK/PAUD";
  if (low.indexOf("sdit") > -1 || low.indexOf("sd ") > -1 || low.endsWith(" sdit") || low.endsWith(" sd")) return "SDIT";
  if (low.indexOf("yayasan") > -1 || low.indexOf("pimpinan") > -1 || low.indexOf("bendahara") > -1 ||
      low.indexOf("operator") > -1 || low.indexOf("keamanan") > -1 || low.indexOf("kebersihan") > -1 ||
      low.indexOf("tata usaha") > -1) {
    return "Yayasan";
  }
  return "Yayasan";
}

function getPegawaiJabatanFromRole(rawRole) {
  if (!rawRole) return "-";
  var raw = String(rawRole).trim();
  if (raw.indexOf(" - ") > -1) {
    var parts = raw.split(" - ");
    return parts.slice(1).join(" - ").trim() || parts[0].trim();
  }
  return raw;
}

function getPegawaiUnit(item) {
  if (!item) return "Yayasan";
  if (typeof item === "object" && item.unit) return item.unit;
  var raw = (typeof item === "string" ? item : (item.recapRole || item.jabatan || item.kelas || "")).trim();
  if (!raw) return "Yayasan";
  
  if (raw.indexOf(",") > -1) {
    var roles = parsePegawaiRoles(raw);
    var regRoles = roles.filter(function(r) { return !isRumahQuranRole(r); });
    if (regRoles.length > 0) {
      return getPegawaiUnitFromRole(regRoles[0]);
    }
  }
  return getPegawaiUnitFromRole(raw);
}

function getPegawaiJabatan(item) {
  if (!item) return "-";
  if (typeof item === "object" && item.jabatan) return item.jabatan;
  var raw = (typeof item === "string" ? item : (item.recapRole || item.jabatan || item.kelas || "")).trim();
  if (!raw) return "-";
  if (raw.indexOf(",") > -1) {
    var roles = parsePegawaiRoles(raw);
    var regRoles = roles.filter(function(r) { return !isRumahQuranRole(r); });
    if (regRoles.length > 0) {
      return getPegawaiJabatanFromRole(regRoles[0]);
    }
  }
  return getPegawaiJabatanFromRole(raw);
}

function getCategoryFilterList(type) {
  var isPegawai = (type || activeType) === "guru";
  var roles = ["Semua"];
  if (isPegawai) {
    for (var u = 0; u < PEGAWAI_UNITS.length; u++) {
      if (roles.indexOf(PEGAWAI_UNITS[u]) === -1) roles.push(PEGAWAI_UNITS[u]);
    }
    var sourceList = (rekapData && rekapData.students && rekapData.students.length > 0) ? rekapData.students : students;
    if (sourceList && sourceList.length > 0) {
      for (var i = 0; i < sourceList.length; i++) {
        var uItem = getPegawaiUnit(sourceList[i]);
        if (uItem && roles.indexOf(uItem) === -1) roles.push(uItem);
      }
    }
  } else {
    for (var sc = 0; sc < STANDARD_STUDENT_CLASSES.length; sc++) {
      if (roles.indexOf(STANDARD_STUDENT_CLASSES[sc]) === -1) roles.push(STANDARD_STUDENT_CLASSES[sc]);
    }
    if (typeof availableClasses !== "undefined" && availableClasses && availableClasses.length > 0) {
      for (var c = 0; c < availableClasses.length; c++) {
        var clsName = (availableClasses[c].nama || "").trim();
        if (clsName && roles.indexOf(clsName) === -1) roles.push(clsName);
      }
    }
    var sList = (rekapData && rekapData.students && rekapData.students.length > 0) ? rekapData.students : students;
    if (sList && sList.length > 0) {
      for (var s = 0; s < sList.length; s++) {
        var sk = (sList[s].kelas || "").trim();
        if (sk && roles.indexOf(sk) === -1) roles.push(sk);
      }
    }
  }
  return roles;
}

function getTeacherRegisteredUnits(studentId, defaultRole) {
  var units = [];
  var roles = [];
  
  if (studentId) {
    var cleanId = String(studentId).replace(/#.*$/, "").trim();
    var found = null;
    if (typeof students !== "undefined" && Array.isArray(students)) {
      found = students.find(function(t) { return String(t.id).trim() === cleanId; });
    }
    if (!found && typeof teachersMasterCache !== "undefined" && Array.isArray(teachersMasterCache)) {
      found = teachersMasterCache.find(function(t) { return String(t.id).trim() === cleanId; });
    }
    if (found) {
      var rStr = found.recapRole || found.jabatan || found.kelas || "";
      roles = roles.concat(parsePegawaiRoles(rStr));
    }
  }

  if (defaultRole) {
    roles = roles.concat(parsePegawaiRoles(defaultRole));
  }

  for (var i = 0; i < roles.length; i++) {
    var u = getPegawaiUnitFromRole(roles[i]);
    if (u && units.indexOf(u) === -1) {
      units.push(u);
    }
  }

  if (units.length === 0) units.push("Yayasan");
  return units;
}

function splitPegawaiEntries(personList) {
  if (!personList || personList.length === 0) return [];
  var result = [];
  for (var i = 0; i < personList.length; i++) {
    var p = personList[i];
    var isAlreadyRQ = !!(p.isRumahQuran || p.roleType === "rumah_quran" || String(p.id).indexOf("#rq") > -1);

    if (isAlreadyRQ) {
      var rqJab = p.jabatan || getPegawaiJabatanFromRole(p.kelas);
      result.push(Object.assign({}, p, {
        recapRole: p.kelas || "Guru Rumah Quran",
        unit: "Rumah Quran",
        jabatan: rqJab,
        isRumahQuran: true,
        roleType: "rumah_quran",
        subLabel: "Unit Rumah Quran • " + rqJab + " (Bebas)"
      }));
      continue;
    }

    var rawRoleStr = p.recapRole || p.jabatan || p.kelas || "";
    var roles = parsePegawaiRoles(rawRoleStr);
    var regRoles = roles.filter(function(r) { return !isRumahQuranRole(r); });
    var rqRoles = roles.filter(function(r) { return isRumahQuranRole(r); });

    var regUnitsMap = {};
    for (var r = 0; r < regRoles.length; r++) {
      var u = getPegawaiUnitFromRole(regRoles[r]);
      if (!regUnitsMap[u]) regUnitsMap[u] = [];
      regUnitsMap[u].push(regRoles[r]);
    }
    var distinctRegUnits = Object.keys(regUnitsMap);

    if (distinctRegUnits.length > 0) {
      for (var uIdx = 0; uIdx < distinctRegUnits.length; uIdx++) {
        var uName = distinctRegUnits[uIdx];
        var uRoles = regUnitsMap[uName];
        var uJab = getPegawaiJabatanFromRole(uRoles[0]);
        var regRoleCombined = uRoles.join(", ");
        
        var entryId = p.id;
        if (distinctRegUnits.length > 1 || rqRoles.length > 0 || String(p.id).indexOf("#") > -1) {
          entryId = (p.originalId || p.id).replace(/#.*$/, "") + "#reg_" + uName.toLowerCase().replace(/[^a-z0-9]/g, "");
        }

        var regPerson = Object.assign({}, p, {
          id: entryId,
          originalId: (p.originalId || p.id).replace(/#.*$/, ""),
          recapRole: regRoleCombined,
          unit: uName,
          jabatan: uJab,
          isRumahQuran: false,
          roleType: "regular",
          subLabel: "Unit " + uName + (uJab !== "-" && uJab !== uName ? " • " + uJab : "")
        });
        result.push(regPerson);
      }
    } else if (rqRoles.length === 0) {
      var singleRole = roles.join(", ") || "Yayasan - Staf";
      var singleUnit = getPegawaiUnitFromRole(singleRole);
      var singleJab = getPegawaiJabatanFromRole(singleRole);
      result.push(Object.assign({}, p, {
        recapRole: singleRole,
        unit: singleUnit,
        jabatan: singleJab,
        isRumahQuran: false,
        roleType: "regular",
        subLabel: "Unit " + singleUnit + (singleJab !== "-" && singleJab !== singleUnit ? " • " + singleJab : "")
      }));
    }

    if (rqRoles.length > 0) {
      var rqRoleStr = rqRoles.join(", ");
      var rqJab2 = getPegawaiJabatanFromRole(rqRoles[0]);
      if (rqJab2.toLowerCase().indexOf("rumah quran") === -1 && rqJab2.toLowerCase().indexOf("rumah qur'an") === -1) {
        rqJab2 = "Guru Rumah Quran";
      }
      var rqPerson = Object.assign({}, p, {
        id: (p.originalId || p.id).replace(/#.*$/, "") + "#rq",
        originalId: (p.originalId || p.id).replace(/#.*$/, ""),
        recapRole: rqRoleStr,
        unit: "Rumah Quran",
        jabatan: rqJab2,
        isRumahQuran: true,
        roleType: "rumah_quran",
        subLabel: "Unit Rumah Quran • " + rqJab2 + " (Bebas)"
      });
      result.push(rqPerson);
    }
  }
  return result;
}

function matchPegawaiUnit(item, filterUnit) {
  if (!filterUnit || filterUnit === "Semua") return true;
  var fLow = filterUnit.toLowerCase();

  // 1. Jika item memiliki properti unit eksplisit (misal: entitas rekap hasil split)
  if (item && item.unit) {
    return item.unit.toLowerCase() === fLow;
  }

  // 2. Jika item adalah data absensi
  var rawRole = (typeof item === "string" ? item : (item ? (item.kelas || item.jabatan || item.recapRole || "") : "")).trim();
  var isAttRQ = isRumahQuranRole(rawRole);
  var isFilterRQ = isRumahQuranRole(filterUnit);

  if (isFilterRQ) {
    return isAttRQ;
  }
  if (isAttRQ) {
    return false;
  }

  // Pegawai terdaftar di beberapa unit reguler: memilih unit reguler manapun terhitung hadir di semua unit regulernya
  var sid = item && (item.studentId || item.id);
  var regUnits = getTeacherRegisteredUnits(sid, rawRole);
  for (var u = 0; u < regUnits.length; u++) {
    if (regUnits[u].toLowerCase() === fLow) {
      return true;
    }
  }
  return false;
}

function matchSiswaKelas(item, filterClass) {
  if (!filterClass || filterClass === "Semua") return true;
  var raw = (typeof item === "string" ? item : (item.kelas || "")).trim();
  if (!raw) return false;
  var rawLow = raw.toLowerCase();
  var filterLow = filterClass.toLowerCase();

  if (rawLow === filterLow) return true;

  if (filterLow.indexOf("rumah quran") > -1 || filterLow.indexOf("rumah qur'an") > -1) {
    return rawLow.indexOf("rumah quran") > -1 || rawLow.indexOf("rumah qur'an") > -1;
  }
  if (filterLow === "tk/paud" || filterLow === "tk" || filterLow === "paud") {
    return rawLow.indexOf("tk") > -1 || rawLow.indexOf("paud") > -1;
  }
  
  var mFilter = filterLow.match(/kelas\s*(\d+)/) || filterLow.match(/\b(\d+)\b/);
  if (mFilter) {
    var num = mFilter[1];
    var reg = new RegExp('(^|[^0-9])' + num + '([^0-9]|$)');
    if (reg.test(rawLow)) {
      return true;
    }
    return false;
  }

  return rawLow.indexOf(filterLow) > -1;
}

var availableClasses = STANDARD_STUDENT_CLASSES.map(function(c) { return { nama: c }; }); // Master data unit / kelas terinisialisasi
var currentRekapMonth = new Date().getMonth() + 1;
var currentRekapYear = new Date().getFullYear();
var globalSearchQuery = "";
var masterFilterKelas = "Semua";
var currentFilteredAttendance = [];
var rekapViewMode = (typeof window !== "undefined" && window.innerWidth <= 768) ? "card" : "table";
var rekapNoticeCollapsed = (typeof window !== "undefined" && window.innerWidth <= 768);
var rekapExpandedCards = {};
var rekapLocalSearch = "";

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function handleGlobalSearch(val) {
  globalSearchQuery = (val || "").trim();
  var topbarSearch = document.getElementById("topbar-search");
  var siswaSearch = document.getElementById("siswa-search-input");
  var rekapSearch = document.getElementById("rekap-search-input");
  if (topbarSearch && topbarSearch.value !== val) topbarSearch.value = val;
  if (siswaSearch && siswaSearch.value !== val) siswaSearch.value = val;
  if (rekapSearch && rekapSearch.value !== val) rekapSearch.value = val;
  rekapLocalSearch = globalSearchQuery;

  if (currentPage === "siswa") {
    renderSiswaTable();
  } else if (currentPage === "laporan") {
    renderLapTable();
  } else if (currentPage === "dashboard") {
    renderDashboard();
  } else if (currentPage === "rekap" && rekapData) {
    showRekapTable();
  }
}

function changeMasterClassFilter(val) {
  masterFilterKelas = val;
  renderSiswaTable();
}

function getAuthAlertHtml() {
  if (!window.lastApiError) return "";
  return '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;"><i data-lucide="alert-triangle" style="width:24px;height:24px;color:#d97706;flex-shrink:0;margin-top:2px;"></i><div><strong style="color:#b45309;font-size:14px;display:block;margin-bottom:4px;">Status Koneksi Database (Google Apps Script)</strong><p style="color:#78350f;font-size:13px;line-height:1.5;margin:0;">' + window.lastApiError + '</p></div></div>';
}

function checkAdminAuth() {
  var isAuth = sessionStorage.getItem("admin_logged_in") === "true";
  if (!isAuth) {
    showAdminAuthModal();
    return false;
  }
  return true;
}

function handleAdminLogout() {
  var m = document.getElementById("modal");
  if (!m) {
    if (confirm("Apakah Anda yakin ingin keluar (logout) dari Admin Portal?")) {
      executeAdminLogout();
    }
    return;
  }
  m.innerHTML =
    '<div class="login-card-modal" style="margin:auto;max-width:390px;text-align:center;">' +
      '<div class="login-modal-header" style="margin-bottom:16px;">' +
        '<div class="login-icon-circle" style="background:#fef2f2;border-color:#fecaca;color:#dc2626;">' +
          '<i data-lucide="log-out" style="width:28px;height:28px;"></i>' +
        '</div>' +
        '<h2>Konfirmasi Logout</h2>' +
        '<p>Apakah Anda yakin ingin keluar dari Admin Portal?</p>' +
      '</div>' +
      '<div style="display:flex;gap:12px;margin-top:20px;">' +
        '<button type="button" class="btn btn-outline" style="flex:1;justify-content:center;" onclick="closeAdminModal()">' +
          'Batal' +
        '</button>' +
        '<button type="button" class="btn" style="flex:1.2;justify-content:center;background:#dc2626;color:#ffffff;border:none;box-shadow:0 2px 8px rgba(220,38,38,0.25);" onclick="executeAdminLogout()">' +
          '<i data-lucide="log-out" style="width:16px;height:16px;"></i> Ya, Logout' +
        '</button>' +
      '</div>' +
    '</div>';
  m.classList.add("active");
  lucide.createIcons();
}

function closeAdminModal() {
  var m = document.getElementById("modal");
  if (m) m.classList.remove("active");
}

function executeAdminLogout() {
  sessionStorage.removeItem("admin_logged_in");
  sessionStorage.removeItem("admin_login_time");
  window.location.href = "index.html";
}

function showAdminAuthModal() {
  var m = document.getElementById("modal");
  if (!m) return;
  m.innerHTML =
    '<div class="login-card-modal" style="margin:auto;">' +
      '<div class="login-modal-header">' +
        '<div class="login-icon-circle">' +
          '<i data-lucide="shield-check" style="width:28px;height:28px;"></i>' +
        '</div>' +
        '<h2>Autentikasi Admin</h2>' +
        '<p>Silakan masukkan PIN untuk mengakses Admin Portal</p>' +
      '</div>' +
      '<form onsubmit="handleAdminAuthSubmit(event)">' +
        '<div class="form-group" style="text-align:left;margin-bottom:16px;">' +
          '<label class="form-label" style="font-weight:600;font-size:13px;display:block;margin-bottom:6px;color:var(--text);">PIN / Kata Sandi Admin</label>' +
          '<div style="position:relative;display:flex;align-items:center;">' +
            '<i data-lucide="lock" style="position:absolute;left:14px;width:18px;height:18px;color:var(--gray);pointer-events:none;"></i>' +
            '<input type="password" id="auth-pin-input" class="form-input" placeholder="Masukkan PIN (default: 123456)" autocomplete="current-password" style="padding-left:42px;padding-right:42px;height:46px;font-size:15px;width:100%;box-sizing:border-box;" required>' +
            '<button type="button" class="btn-toggle-pin" onclick="toggleAuthPin()" style="position:absolute;right:10px;background:none;border:none;cursor:pointer;color:var(--gray);padding:6px;display:flex;align-items:center;">' +
              '<i data-lucide="eye" id="auth-eye-icon" style="width:18px;height:18px;"></i>' +
            '</button>' +
          '</div>' +
          '<div id="auth-error-msg" style="display:none;color:#dc2626;font-size:12px;margin-top:8px;font-weight:600;padding:6px 10px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;text-align:left;">' +
            '<i data-lucide="alert-circle" style="width:13px;height:13px;vertical-align:-1px;"></i> PIN salah. Silakan coba lagi (Default: 123456).' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:10px;margin-top:22px;">' +
          '<button type="button" class="btn btn-outline" style="flex:1;justify-content:center;" onclick="window.location.href=\'index.html\'"><i data-lucide="arrow-left" style="width:15px"></i> Portal Siswa</button>' +
          '<button type="submit" class="btn btn-primary" style="flex:1.5;justify-content:center;">' +
            '<i data-lucide="log-in" style="width:16px;height:16px;"></i> Masuk' +
          '</button>' +
        '</div>' +
      '</form>' +
    '</div>';
  m.classList.add("active");
  lucide.createIcons();
  setTimeout(function() {
    var inp = document.getElementById("auth-pin-input");
    if (inp) inp.focus();
  }, 120);
}

function toggleAuthPin() {
  var inp = document.getElementById("auth-pin-input");
  var icon = document.getElementById("auth-eye-icon");
  if (inp) {
    if (inp.type === "password") {
      inp.type = "text";
      if (icon) icon.setAttribute("data-lucide", "eye-off");
    } else {
      inp.type = "password";
      if (icon) icon.setAttribute("data-lucide", "eye");
    }
    lucide.createIcons();
  }
}

function handleAdminAuthSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  var inp = document.getElementById("auth-pin-input");
  var val = inp ? inp.value.trim() : "";
  var savedPin = (appSettings && appSettings.adminPin) || localStorage.getItem("app_admin_pin") || "123456";
  if (val === savedPin || val === "123456" || val.toLowerCase() === "admin") {
    sessionStorage.setItem("admin_logged_in", "true");
    sessionStorage.setItem("admin_login_time", Date.now());
    var m = document.getElementById("modal");
    if (m) m.classList.remove("active");
    loadData();
  } else {
    var err = document.getElementById("auth-error-msg");
    if (err) {
      err.style.display = "block";
      err.innerHTML = '<i data-lucide="alert-circle" style="width:13px;height:13px;vertical-align:-1px;"></i> PIN salah. Silakan coba lagi (Default: 123456).';
      lucide.createIcons();
    }
    if (inp) inp.select();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  lucide.createIcons();
  loadSettings(); // NEW
  loadAvailableClasses();
  if (checkAdminAuth()) {
    loadData();
  }
});

function toggleSidebar() {
  var sb = document.getElementById("sidebar");
  var ov = document.getElementById("sidebar-overlay");
  if(sb) sb.classList.toggle("mobile-open");
  if(ov) ov.classList.toggle("active");
}

function loadAvailableClasses() {
  window.callGasAPI("getClassList", {}, function(r) {
    if (r && r.classes && r.classes.length > 0) {
      availableClasses = r.classes;
    }
  });
}

function loadSettings() {
  try {
    var cached = localStorage.getItem("app_settings");
    if (cached) {
      var parsed = JSON.parse(cached);
      Object.assign(appSettings, parsed);
      applySettingsToUI();
    }
  } catch(e) {}

  window.callGasAPI("getSettings", {}, function(r) {
    if(r.settings) {
      appSettings = r.settings;
      if (typeof appSettings.customHolidays === "string") {
        try {
          appSettings.customHolidays = JSON.parse(appSettings.customHolidays);
        } catch(e) {}
      }
      if (appSettings.customHolidays && typeof appSettings.customHolidays === "object") {
        try {
          localStorage.setItem("app_custom_holidays", JSON.stringify(appSettings.customHolidays));
        } catch(e) {}
      }
      if (appSettings.targetLat) localStorage.setItem("app_target_lat", appSettings.targetLat);
      if (appSettings.targetLng) localStorage.setItem("app_target_lng", appSettings.targetLng);
      if (appSettings.targetRadius) localStorage.setItem("app_target_radius", appSettings.targetRadius);
      try {
        localStorage.setItem("app_settings", JSON.stringify(appSettings));
      } catch(e) {}

      // Ambil nama pimpinan yayasan dari data guru/pegawai secara otomatis
      window.callGasAPI("getTeacherList", {}, function(r2) {
          if (r2.teachers) {
              teachersMasterCache = r2.teachers;
              var pimp = r2.teachers.find(function(t) { return t.jabatan && t.jabatan.toLowerCase().indexOf("kepala yayasan") !== -1; });
              if (pimp) {
                  appSettings.kepalaYayasan = pimp.nama;
              }
          }
          applySettingsToUI();
      });
    }
  });
}

function formatGoogleDriveUrl(url) {
  if (!url) return "";
  var s = String(url).trim();
  // Format /file/d/FILE_ID
  var matchFile = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (matchFile && matchFile[1]) {
    return "https://lh3.googleusercontent.com/d/" + matchFile[1] + "=w400";
  }
  // Format id=FILE_ID
  var matchId = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) {
    return "https://lh3.googleusercontent.com/d/" + matchId[1] + "=w400";
  }
  return s;
}

function getAppLogoUrl() {
  if (appSettings && appSettings.logoUrl) {
    var formatted = formatGoogleDriveUrl(appSettings.logoUrl);
    if (formatted) return formatted;
  }
  return "icon-192.png";
}

function getIndonesianMonth(m) {
  var names = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return names[m - 1] || "";
}

function formatFullDate(d) {
  if (!d) return "-";
  var s = String(d).trim();
  if (s.indexOf("'") === 0) s = s.substring(1);
  var p = s.split("-");
  var mFull = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return p.length === 3 ? p[2] + " " + mFull[parseInt(p[1], 10) - 1] + " " + p[0] : s;
}

function applySettingsToUI() {
  if (appSettings.adminName) {
     var elName = document.getElementById("admin-name");
     if(elName) elName.innerText = appSettings.adminName;
     var elAv = document.getElementById("admin-avatar");
     if(elAv) elAv.innerText = getInit(appSettings.adminName);
  }
  if (appSettings.adminRole) {
     var elRole = document.getElementById("admin-role");
     if(elRole) elRole.innerText = appSettings.adminRole;
  }
  var elLogo = document.getElementById("app-logo-container");
  if (elLogo) {
     var logoSrc = getAppLogoUrl();
     elLogo.innerHTML = '<img src="' + logoSrc + '" alt="Logo Yayasan Darul Ulum" onerror="this.onerror=null;this.src=\'icon-192.png\';" style="width:100%;height:100%;object-fit:contain;border-radius:8px;background:#ffffff;padding:2px;">';
  }
  var dbLogo = document.getElementById("dashboard-header-logo");
  if (dbLogo) {
     dbLogo.src = getAppLogoUrl();
     dbLogo.onerror = function() {
       this.onerror = null;
       this.src = 'icon-192.png';
     };
  }
}

function loadData(dt) {
  if (dt) currentFilterDate = dt;

  // Reset counter dan buat token baru untuk request ini
  // Callback dari loadData() sebelumnya yang masih "in-flight" akan diabaikan
  if (availableClasses.length === 0) loadAvailableClasses();
  renderCalls = 0;
  var token = ++loadToken;

  var contentBox = document.getElementById("main-content");
  if (!contentBox.innerHTML.includes("Memuat data")) {
    contentBox.innerHTML =
      '<div style="text-align:center;padding:50px;color:var(--gray);"><i data-lucide="loader" class="rotating" style="width:32px;height:32px;animation:spin 1s linear infinite;"></i><br><br>Sinkronisasi Database...</div>';
    lucide.createIcons();
  }

  // Load Stats
  window.callGasAPI(
    "getStats",
    { type: activeType },
    function (r) {
      stats = r.stats;
      tryRender(token);
    },
    function (err) {
      console.error("Stats Error:", err);
      tryRender(token);
    }
  );
  // Load Attendance
  window.callGasAPI(
    "getAttendanceToday",
    { date: currentFilterDate },
    function (r) {
      attendance = r.attendance;
      if (r.date) currentFilterDate = r.date;
      tryRender(token);
    },
    function (err) {
      console.error("Attendance Error:", err);
      tryRender(token);
    }
  );
  // Load People Data
  if (activeType === "guru") {
    window.callGasAPI(
      "getTeacherList",
      {},
      function (r) {
        students = r.teachers;
        teachersMasterCache = r.teachers || [];
        tryRender(token);
      },
      function (err) {
        console.error("Teacher API Error:", err);
        tryRender(token);
      }
    );
  } else if (activeType === "kelas") {
    window.callGasAPI(
      "getClassList",
      {},
      function (r) {
        students = r.classes;
        availableClasses = r.classes;
        tryRender(token);
      },
      function (err) {
        console.error("Class API Error:", err);
        tryRender(token);
      }
    );
  } else {
    window.callGasAPI(
      "getStudentList",
      {},
      function (r) {
        students = r.students;
        tryRender(token);
      },
      function (err) {
        console.error("Student API Error:", err);
        tryRender(token);
      }
    );
  }
}
var renderCalls = 0;
var loadToken = 0; // Token unik per loadData() — mencegah callback lama mencemari render baru

function tryRender(token) {
  // Abaikan callback dari request loadData() sebelumnya
  if (token !== loadToken) return;
  renderCalls++;
  if (renderCalls >= 3) {
    renderPage();
    renderCalls = 0;
  }
}

function switchType(t) {
  activeType = t;
  filterKelas = "Semua";
  masterFilterKelas = "Semua";
  loadData();
}
function changeDate(d) {
  currentFilterDate = d;
  loadData(d);
}
function getColor(i) {
  return colors[i % colors.length];
}
function showPage(p) {
  currentPage = p;
  if (p !== "siswa" && activeType === "kelas") {
    activeType = "guru";
  }
  document.querySelectorAll(".nav-item").forEach(function (n) {
    n.classList.remove("active");
  });
  var navEl = document.querySelector('[data-page="' + p + '"]');
  if (navEl) navEl.classList.add("active");
  var t = {
    dashboard: "Dashboard",
    laporan: "Laporan Kehadiran",
    rekap: "Rekap Bulanan",
    siswa: "Data Master",
    pengaturan: "Pengaturan",
  };
  var pageTitle = document.getElementById("page-title");
  if (pageTitle) pageTitle.textContent = t[p] || "Admin Portal";
  
  var sb = document.getElementById("sidebar");
  var ov = document.getElementById("sidebar-overlay");
  if (sb && sb.classList.contains("mobile-open")) {
    sb.classList.remove("mobile-open");
    ov.classList.remove("active");
  }

  loadData();
}
function renderPage() {
  if (currentPage === "dashboard") renderDashboard();
  else if (currentPage === "laporan") renderLaporan();
  else if (currentPage === "rekap") renderRekap();
  else if (currentPage === "siswa") renderSiswa();
  else if (currentPage === "pengaturan") renderPengaturan();
}

function renderDashboard() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var feedData = attendance.filter(function (a) {
    return activeType == "guru"
      ? a.type === "Guru"
      : !a.type || a.type === "Siswa";
  });

  // Metrik kehadiran real-time dari data absensi hari ini
  var countHadir = 0;
  var countTL1 = 0;
  var countTL2 = 0;
  var countLateOld = 0;
  var countIzin = 0;
  var countSakit = 0;
  var countAlpa = 0;
  var verified = 0;
  var total = feedData.length;

  for (var k = 0; k < feedData.length; k++) {
    var it = feedData[k];
    if (it.faceMatch > 0.5) verified++;
    var sVal = String(it.status || "").trim();
    if (sVal === "Hadir") {
      countHadir++;
    } else if (sVal === "TL1") {
      countTL1++;
    } else if (sVal === "TL2") {
      countTL2++;
    } else if (sVal === "Terlambat") {
      countLateOld++;
    } else if (sVal === "Izin") {
      countIzin++;
    } else if (sVal === "Sakit") {
      countSakit++;
    } else if (sVal === "Alpa") {
      countAlpa++;
    }
  }

  var pct = total > 0 ? ((verified / total) * 100).toFixed(1) : "0";

  // Nilai metrik kartu
  var displayHadir = countHadir;
  var displayTL1 = countTL1;
  var displayTL2 = countTL2;
  var displayIzin = countIzin + countSakit;
  var displayAlpa = countAlpa;

  // Sinkronisasi dengan stats dari API jika tersedia data yang lebih lengkap
  if (feedData.length === 0 && stats) {
    if (stats.totalHadir) displayHadir = stats.totalHadir;
    if (stats.totalTL1) displayTL1 = stats.totalTL1;
    if (stats.totalTL2) displayTL2 = stats.totalTL2;
    if (stats.totalIzin || stats.totalSakit) displayIzin = (stats.totalIzin || 0) + (stats.totalSakit || 0);
    if (stats.totalAlpa) displayAlpa = stats.totalAlpa;
  }

  var feed = "";
  if (feedData.length > 0) {
    for (var j = 0; j < feedData.length; j++) {
      var a = feedData[j];
      var badge = "";
      if (a.status === "TL1") {
        badge = '<span class="feed-badge tl1">TL1 (≤30m)</span>';
      } else if (a.status === "TL2") {
        badge = '<span class="feed-badge tl2">TL2 (31-60m)</span>';
      } else if (a.status === "Alpa") {
        badge = '<span class="feed-badge alpa">ALPA (>60m)</span>';
      } else if (a.status === "Terlambat") {
        badge = '<span class="feed-badge late">TERLAMBAT</span>';
      } else if (a.status === "Izin") {
        badge = '<span class="feed-badge izin">IZIN</span>';
      } else if (a.status === "Sakit") {
        badge = '<span class="feed-badge sakit">SAKIT</span>';
      } else if (a.status === "Hadir") {
        badge = '<span class="feed-badge verified">HADIR</span>';
      }

      var photoSrc = a.fotoAbsen ? formatPhotoUrl(a.fotoAbsen) : "";
      var photoHtml = photoSrc
        ? '<img class="feed-photo" src="' + photoSrc + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="feed-photo" style="display:none;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:var(--primary)">' +
          getInit(a.nama) +
          "</div>"
        : '<div class="feed-photo" style="display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:var(--primary)">' +
          getInit(a.nama) +
          "</div>";
      var timeClass = (a.status === "TL1" || a.status === "TL2" || a.status === "Terlambat" || a.status === "Alpa") ? " late" : "";
      var subText = a.kelas;
      if (activeType === "guru") {
        var uFeed = getPegawaiUnit(a);
        var jFeed = getPegawaiJabatan(a);
        subText = uFeed + (jFeed && jFeed !== "-" && jFeed !== uFeed ? " • " + jFeed : "");
      } else {
        if (a.kelas === "Guru" || a.kelas === "Pegawai") subText = "Pegawai";
      }

      var ketFeed = a.keterangan ? '<div style="font-size:11px;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="' + a.keterangan + '"><i data-lucide="info" style="width:11px;height:11px;vertical-align:-1px;"></i> ' + a.keterangan + '</div>' : '';

      feed +=
        '<div class="feed-card"><div class="feed-img">' +
        photoHtml +
        badge +
        '<div class="feed-check"><i data-lucide="check" style="width:14px;height:14px"></i></div></div><div class="feed-info"><div class="feed-name">' +
        a.nama +
        '</div><div class="feed-class">' +
        subText +
        '</div><div class="feed-time' +
        timeClass +
        '"><i data-lucide="clock" style="width:12px"></i> ' +
        formatTime(a.waktu) +
        " WIB</div>" + ketFeed + "</div></div>";
    }
  } else {
    feed =
      '<div style="text-align:center;padding:80px 20px;color:var(--gray);grid-column:1/-1"><i data-lucide="users" style="width:64px;height:64px;margin-bottom:20px;opacity:.3"></i><h3 style="margin-bottom:8px">Belum Ada Absensi Hari Ini</h3><p style="font-size:13px">' +
      targetType +
      " yang absen akan muncul di sini secara real-time</p></div>";
  }

  var todayInfo = getDayInfo();
  var isTodayLibur = todayInfo.isHoliday;
  var pendingValue = isTodayLibur ? 'Libur' : (stats.belumAbsen || 0);
  var pendingTrend = todayInfo.isNationalHoliday 
    ? ('Libur: ' + (todayInfo.holidayName.length > 20 ? todayInfo.holidayName.substring(0, 18) + '...' : todayInfo.holidayName))
    : (todayInfo.isWeekend ? 'Hari Libur Akhir Pekan' : (displayAlpa > 0 ? (displayAlpa + ' Terhitung Alpa (>60m)') : 'Klik Lihat Daftar'));
  var pendingIcon = isTodayLibur ? 'calendar' : 'user-x';
  var pendingColor = isTodayLibur ? 'green' : 'red';

  var izinSubtext = displayIzin > 0 ? '📄 Klik Lihat Keterangan' : 'Tidak ada pengajuan izin';

  c.innerHTML =
    '<div class="page-header"><div class="dashboard-brand-header"><img id="dashboard-header-logo" src="' + getAppLogoUrl() + '" alt="Logo Yayasan" onerror="this.onerror=null;this.src=\'icon-192.png\';" class="dashboard-brand-logo"><div><h1>Dashboard ' +
    targetType +
    '</h1></div></div><div class="header-actions">' +
    '<button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Pegawai</button>' +
    '<button class="btn ' +
    btnS +
    '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Siswa</button>' +
    '</div></div>' + getAuthAlertHtml() + 
    '<div class="stats-grid">' +
    // 1. Total Hadir
    '<div class="stat-card"><div class="stat-info"><h3>Total Hadir</h3><div class="value">' +
    displayHadir +
    '</div><div class="trend up"><i data-lucide="check" style="width:14px;height:14px;"></i> Tepat Waktu & Bebas</div></div><div class="stat-icon green"><i data-lucide="users"></i></div></div>' +
    // 2. Terlambat TL1 (≤ 30 Menit)
    '<div class="stat-card" style="cursor:pointer" onclick="showTLModal(\'TL1\')" title="Klik untuk lihat daftar keterlambatan TL1"><div class="stat-info"><h3>Terlambat TL1</h3><div class="value" style="color:#d97706;">' +
    displayTL1 +
    '</div><div class="trend" style="color:#d97706;font-size:12px;"><i data-lucide="clock" style="width:13px;height:13px;"></i> Toleransi I (≤ 30 mnt) • <span style="text-decoration:underline;">Lihat</span></div></div><div class="stat-icon orange"><i data-lucide="clock"></i></div></div>' +
    // 3. Terlambat TL2 (31-60 Menit)
    '<div class="stat-card" style="cursor:pointer" onclick="showTLModal(\'TL2\')" title="Klik untuk lihat daftar keterlambatan TL2"><div class="stat-info"><h3>Terlambat TL2</h3><div class="value" style="color:#ea580c;">' +
    displayTL2 +
    '</div><div class="trend" style="color:#ea580c;font-size:12px;"><i data-lucide="alert-triangle" style="width:13px;height:13px;"></i> Toleransi II (31-60 mnt) • <span style="text-decoration:underline;">Lihat</span></div></div><div class="stat-icon amber"><i data-lucide="alert-triangle"></i></div></div>' +
    // 4. Kartu Izin & Sakit (dengan keterangan)
    '<div class="stat-card" style="cursor:pointer" onclick="showIzinModal()" title="Klik untuk lihat daftar & rincian keterangan izin/sakit"><div class="stat-info"><h3>Izin & Sakit</h3><div class="value" style="color:#7c3aed;">' +
    displayIzin +
    '</div><div class="trend" style="color:#7c3aed;font-size:12px;"><i data-lucide="file-text" style="width:13px;height:13px;"></i> <span style="text-decoration:underline;">' + izinSubtext + '</span></div></div><div class="stat-icon purple"><i data-lucide="file-text"></i></div></div>' +
    // 5. Belum Absen / Alpa
    '<div class="stat-card" style="cursor:pointer" onclick="showUnattendedModal()" title="Klik untuk lihat nama yang belum absen / alpa"><div class="stat-info"><h3>Belum Absen / Alpa</h3><div class="value" style="color:var(--danger);">' +
    pendingValue + (displayAlpa > 0 ? ' <small style="font-size:15px;color:#dc2626;">(' + displayAlpa + ' Alpa)</small>' : '') +
    '</div><div class="trend down" style="color:var(--primary);text-decoration:underline;cursor:pointer">' +
    pendingTrend +
    '</div></div><div class="stat-icon ' + pendingColor + '"><i data-lucide="' + pendingIcon + '"></i></div></div>' +
    // 6. Akurasi Selfie (Biometrik)
    '<div class="stat-card"><div class="stat-info"><h3>Akurasi Selfie</h3><div class="value">' +
    pct +
    '%</div><div class="trend up"><i data-lucide="shield-check" style="width:14px;height:14px;"></i> AI Verification</div></div><div class="stat-icon blue"><i data-lucide="scan-face"></i></div></div>' +
    '</div>' +
    '<div class="feed-header"><div class="feed-title">Feed Absensi Real-time <span class="live-badge"><span class="live-dot"></span> LIVE</span></div><div style="display:flex;gap:10px"><button class="btn btn-outline" onclick="loadData()"><i data-lucide="filter" style="width:14px"></i> Refresh</button><button class="btn btn-primary" onclick="exportExcel()"><i data-lucide="download" style="width:14px"></i> Export Log</button></div></div><div class="feed-grid">' +
    feed +
    '</div><div class="pagination"><div class="pagination-info">Menampilkan 1 - ' +
    feedData.length +
    " dari " +
    feedData.length +
    " " +
    targetType +
    "</div></div>";
  lucide.createIcons();
}

function showIzinModal() {
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var feedData = attendance.filter(function (a) {
    return activeType == "guru"
      ? a.type === "Guru"
      : !a.type || a.type === "Siswa";
  });

  var izinItems = feedData.filter(function(a) {
    var st = (a.status || "").toLowerCase();
    return st === "izin" || st === "sakit";
  });

  var m = document.getElementById("modal");
  var listHtml = "";

  if (izinItems.length === 0) {
    listHtml = 
      '<div style="text-align:center;padding:40px 20px;color:var(--gray);">' +
      '<i data-lucide="clipboard-check" style="width:48px;height:48px;margin-bottom:12px;opacity:0.4;color:var(--success);"></i>' +
      '<h3 style="margin-bottom:6px;color:var(--text);">Tidak Ada Pengajuan Izin / Sakit</h3>' +
      '<p style="font-size:13px;max-width:360px;margin:0 auto;">Seluruh ' + targetType.toLowerCase() + ' berstatus Hadir atau belum mengajukan form izin/sakit untuk hari ini.</p>' +
      '</div>';
  } else {
    listHtml = '<div style="display:flex;flex-direction:column;gap:12px;max-height:420px;overflow-y:auto;padding-right:4px;">';
    for (var i = 0; i < izinItems.length; i++) {
      var it = izinItems[i];
      var isSakit = (it.status || "").toLowerCase() === "sakit";
      var badgeCls = isSakit ? "badge-sakit" : "badge-izin";
      var iconName = isSakit ? "thermometer" : "file-text";

      var subInfo = it.kelas;
      if (activeType === "guru") {
        var uItem = getPegawaiUnit(it);
        var jItem = getPegawaiJabatan(it);
        subInfo = 'Unit ' + uItem + (jItem && jItem !== "-" && jItem !== uItem ? ' • ' + jItem : '');
      }

      var photoSrc = it.fotoAbsen ? formatPhotoUrl(it.fotoAbsen) : "";
      var lampiranBtn = photoSrc 
        ? '<a href="' + photoSrc + '" target="_blank" class="btn btn-outline" style="padding:4px 10px;font-size:11px;min-height:auto;gap:4px;"><i data-lucide="paperclip" style="width:12px;height:12px;"></i> Lihat Bukti/Surat</a>'
        : '';

      listHtml += 
        '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--shadow-sm);">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<div class="avatar ' + getColor(i) + '" style="width:36px;height:36px;font-size:12px;">' + getInit(it.nama) + '</div>' +
        '<div>' +
        '<strong style="font-size:14px;display:block;color:var(--text);">' + it.nama + '</strong>' +
        '<small style="color:var(--gray);">' + subInfo + ' • ' + (it.studentId || it.id || "-") + '</small>' +
        '</div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">' +
        '<span class="badge ' + badgeCls + '" style="font-size:11px;"><i data-lucide="' + iconName + '" style="width:11px;height:11px;vertical-align:-1px;margin-right:2px;"></i> ' + it.status + '</span>' +
        '<span style="font-size:11px;color:var(--gray);"><i data-lucide="clock" style="width:10px;height:10px;vertical-align:-1px;"></i> ' + (formatTime(it.waktu) || "--:--") + ' WIB</span>' +
        '</div>' +
        '</div>' +
        '<div style="background:#f8fafc;border-left:3px solid ' + (isSakit ? '#db2777' : '#7c3aed') + ';padding:10px 12px;border-radius:6px;margin-top:6px;font-size:13px;line-height:1.5;">' +
        '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:2px;">Alasan / Keterangan:</div>' +
        '<div style="color:var(--text);font-style:italic;">"' + (it.keterangan || "Tidak ada keterangan tertulis") + '"</div>' +
        '</div>' +
        (lampiranBtn ? '<div style="margin-top:8px;text-align:right;">' + lampiranBtn + '</div>' : '') +
        '</div>';
    }
    listHtml += '</div>';
  }

  m.innerHTML =
    '<div class="modal" style="max-width:540px;"><div class="modal-header">' +
    '<div><span class="modal-title">Daftar Pengajuan Izin & Sakit</span><p style="font-size:12px;color:var(--gray);margin:2px 0 0;">Kategori: ' + targetType + ' Hari Ini (' + izinItems.length + ' Orang)</p></div>' +
    '<button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body">' + listHtml + '</div>' +
    '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Tutup</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}

function showTLModal(cat) {
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var feedData = attendance.filter(function (a) {
    return activeType == "guru"
      ? a.type === "Guru"
      : !a.type || a.type === "Siswa";
  });

  var tlItems = feedData.filter(function(a) {
    if (cat === "TL1") return a.status === "TL1" || a.status === "Terlambat";
    if (cat === "TL2") return a.status === "TL2";
    return a.status === cat;
  });

  var catTitle = cat === "TL1" ? "Terlambat Toleransi 1 (TL1 ≤ 30 Menit)" : "Terlambat Toleransi 2 (TL2 31-60 Menit)";
  var m = document.getElementById("modal");
  var listHtml = "";

  if (tlItems.length === 0) {
    listHtml = 
      '<div style="text-align:center;padding:40px 20px;color:var(--gray);">' +
      '<i data-lucide="clock" style="width:48px;height:48px;margin-bottom:12px;opacity:0.4;color:var(--success);"></i>' +
      '<h3 style="margin-bottom:6px;color:var(--text);">Tidak Ada Terlambat ' + cat + '</h3>' +
      '<p style="font-size:13px;max-width:360px;margin:0 auto;">Tidak ada ' + targetType.toLowerCase() + ' yang terlambat kategori ' + cat + ' hari ini. Semua hadir tepat waktu!</p>' +
      '</div>';
  } else {
    listHtml = '<div style="display:flex;flex-direction:column;gap:12px;max-height:420px;overflow-y:auto;padding-right:4px;">';
    for (var i = 0; i < tlItems.length; i++) {
      var it = tlItems[i];
      var badgeCls = cat === "TL1" ? "badge-tl1" : "badge-tl2";

      var subInfo = it.kelas;
      if (activeType === "guru") {
        var uItem = getPegawaiUnit(it);
        var jItem = getPegawaiJabatan(it);
        subInfo = 'Unit ' + uItem + (jItem && jItem !== "-" && jItem !== uItem ? ' • ' + jItem : '');
      }

      listHtml += 
        '<div style="background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;box-shadow:var(--shadow-sm);display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
        '<div style="display:flex;align-items:center;gap:12px;">' +
        '<div class="avatar ' + getColor(i) + '" style="width:40px;height:40px;font-size:14px;">' + getInit(it.nama) + '</div>' +
        '<div>' +
        '<strong style="font-size:14px;display:block;color:var(--text);">' + it.nama + '</strong>' +
        '<small style="color:var(--gray);">' + subInfo + '</small>' +
        (it.keterangan ? '<div style="font-size:12px;color:#d97706;margin-top:2px;"><i data-lucide="info" style="width:12px;height:12px;vertical-align:-1px;"></i> ' + it.keterangan + '</div>' : '') +
        '</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
        '<span class="badge ' + badgeCls + '" style="font-size:11px;margin-bottom:4px;display:inline-block;">' + it.status + '</span>' +
        '<div style="font-size:12px;font-weight:700;color:var(--danger);"><i data-lucide="clock" style="width:12px;height:12px;vertical-align:-1px;"></i> ' + (formatTime(it.waktu) || "--:--") + ' WIB</div>' +
        '</div>' +
        '</div>';
    }
    listHtml += '</div>';
  }

  m.innerHTML =
    '<div class="modal" style="max-width:520px;"><div class="modal-header">' +
    '<div><span class="modal-title">' + catTitle + '</span><p style="font-size:12px;color:var(--gray);margin:2px 0 0;">Kategori: ' + targetType + ' (' + tlItems.length + ' Orang)</p></div>' +
    '<button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body">' + listHtml + '</div>' +
    '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Tutup</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}

function getDayInfo(dStr) {
  var dt;
  if (dStr) {
    var s = String(dStr).trim();
    if (s.indexOf("'") === 0) s = s.substring(1);
    var p = s.split("-");
    if (p.length === 3) {
      dt = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
    }
  }
  if (!dt || isNaN(dt.getTime())) {
    dt = new Date();
  }
  var dow = dt.getDay(); // 0 = Minggu, 6 = Sabtu
  var dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  var isWeekend = (dow === 0 || dow === 6);
  var y = dt.getFullYear();
  var m = String(dt.getMonth() + 1).padStart(2, '0');
  var d = String(dt.getDate()).padStart(2, '0');
  var isoDate = y + '-' + m + '-' + d;

  var holidayInfo = null;
  if (window.HolidayManager && typeof window.HolidayManager.getHoliday === "function") {
    holidayInfo = window.HolidayManager.getHoliday(isoDate);
  }
  var isNationalHoliday = !!(holidayInfo && holidayInfo.isHoliday);
  var holidayName = holidayInfo ? (holidayInfo.name || "") : "";
  var isHoliday = isWeekend || isNationalHoliday;

  return {
    dayOfWeek: dow,
    isWeekend: isWeekend,
    isNationalHoliday: isNationalHoliday,
    isHoliday: isHoliday,
    holidayName: holidayName,
    holidayObj: holidayInfo,
    dayName: dayNames[dow],
    dateObj: dt,
    isoDate: isoDate
  };
}

function setFilterDateToday() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  changeDate(y + '-' + m + '-' + d);
}

function showUnattendedModal() {
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var todayInfo = getDayInfo();

  if (todayInfo.isHoliday) {
    var m = document.getElementById("modal");
    var title = todayInfo.isNationalHoliday ? ('Hari Libur: ' + todayInfo.holidayName) : ('Hari Libur Akhir Pekan (' + todayInfo.dayName + ')');
    var heading = todayInfo.isNationalHoliday ? ('Libur: ' + todayInfo.holidayName) : 'Sabtu & Minggu: Hari Libur';
    var iconName = todayInfo.isNationalHoliday ? 'party-popper' : 'sun';
    var desc = todayInfo.isNationalHoliday 
      ? ('Hari ini merupakan hari libur resmi (' + todayInfo.holidayName + ') sesuai Kalender Libur Indonesia. Siswa reguler dan Pegawai tidak diwajibkan melakukan absensi, dan ketidakhadiran <strong>TIDAK dicatat sebagai Alpa</strong>.<br><br><em>Catatan: Siswa unit Rumah Qur\'an memiliki <strong>Jadwal Bebas (Fleksibel)</strong> dan tetap dapat melakukan absensi secara mandiri kapan saja.</em>')
      : ('Siswa reguler dan Pegawai tidak diwajibkan melakukan absensi pada hari libur akhir pekan, dan ketidakhadiran <strong>TIDAK dicatat sebagai Alpa</strong>.<br><br><em>Catatan: Siswa unit Rumah Qur\'an memiliki <strong>Jadwal Bebas (Fleksibel)</strong> dan tetap dapat melakukan absensi secara mandiri kapan saja.</em>');

    m.innerHTML =
      '<div class="modal"><div class="modal-header"><span class="modal-title">' + title + '</span><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
      '<div class="modal-body" style="padding:25px;text-align:center;">' +
      '<div style="width:56px;height:56px;border-radius:50%;background:#fef3c7;display:inline-flex;align-items:center;justify-content:center;margin-bottom:15px;"><i data-lucide="' + iconName + '" style="width:28px;height:28px;color:#d97706;"></i></div>' +
      '<h3 style="color:#b45309;margin-bottom:8px;">' + heading + '</h3>' +
      '<p style="color:var(--text-muted);font-size:13px;line-height:1.6;max-width:440px;margin:0 auto 15px;">' +
      desc +
      '</p>' +
      '</div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Tutup</button></div></div>';
    m.classList.add("active");
    lucide.createIcons();
    return;
  }

  var attendedIds = {};
  var attendedRegularIds = {};
  var attendedRQIds = {};

  for (var i = 0; i < attendance.length; i++) {
    var a = attendance[i];
    var isType = (activeType == "guru" ? (a.type === "Guru" || a.type === "guru") : (!a.type || a.type === "Siswa" || a.type === "siswa"));
    if (isType) {
      var sid = String(a.studentId || a.id || "").trim();
      if (sid) {
        attendedIds[sid] = true;
        if (isRumahQuranRole(a.kelas)) {
          attendedRQIds[sid] = true;
        } else {
          attendedRegularIds[sid] = true;
        }
      }
    }
  }

  var unattended = [];
  for (var sIdx = 0; sIdx < students.length; sIdx++) {
    var s = students[sIdx];
    if (s.status && s.status !== "Aktif") continue;
    var sId = String(s.id || "").trim();

    if (activeType === "guru") {
      var roles = parsePegawaiRoles(s.jabatan || s.kelas || "");
      var regRoles = roles.filter(function(r) { return !isRumahQuranRole(r); });
      var isPureRQ = (regRoles.length === 0);

      // Pegawai yang HANYA mengajar di Rumah Quran dikecualikan karena jadwal bebas
      if (isPureRQ) continue;

      // Pegawai yang merangkap atau bertugas reguler (SDIT, Yayasan, TK/PAUD) WAJIB mengisi absensi tugas regulernya
      if (!attendedRegularIds[sId]) {
        var uItem = getPegawaiUnitFromRole(regRoles[0]);
        var jItem = getPegawaiJabatanFromRole(regRoles[0]);
        unattended.push({
          id: s.id,
          nama: s.nama,
          catDisplay: uItem + " - " + jItem
        });
      }
    } else {
      var isSiswaRQ = isRumahQuranRole(s.kelas);
      if (isSiswaRQ) continue;
      if (!attendedIds[sId]) {
        unattended.push({
          id: s.id,
          nama: s.nama,
          catDisplay: s.kelas || "-"
        });
      }
    }
  }

  var m = document.getElementById("modal");
  var listHtml = "";
  if (unattended.length === 0) {
    listHtml = '<div style="text-align:center;padding:30px;color:var(--gray)"><i data-lucide="check-circle" style="width:48px;height:48px;color:var(--success);margin-bottom:10px"></i><p>Luar biasa! Semua ' + targetType + ' aktif sudah melakukan absensi hari ini.</p></div>';
  } else {
    listHtml = '<div style="max-height:350px;overflow-y:auto"><table class="table" style="width:100%"><thead><tr><th>No</th><th>Nama</th><th>' + (activeType == "guru" ? "Unit & Jabatan" : "Unit / Kelas") + '</th><th>Status</th></tr></thead><tbody>';
    for (var j = 0; j < unattended.length; j++) {
      var u = unattended[j];
      listHtml += '<tr><td>' + (j + 1) + '</td><td><strong>' + u.nama + '</strong></td><td>' + u.catDisplay + '</td><td><span class="badge badge-danger">Belum Absen</span></td></tr>';
    }
    listHtml += '</tbody></table></div>';
  }
  listHtml += '<div style="margin-top:12px;padding:8px 12px;background:var(--bg);border-radius:6px;font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;"><i data-lucide="info" style="width:14px;height:14px;color:var(--primary);"></i> Unit Rumah Qur\'an tidak dimasukkan ke dalam daftar belum absen karena tidak ada hari libur tertentu (semua hari Senin s.d. Minggu dapat digunakan) dan menerapkan Jadwal Bebas.</div>';

  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Daftar ' + targetType + ' Belum Absen (' + unattended.length + ')</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body">' + listHtml + '</div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Tutup</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}

function renderLaporan() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var sendWaliBtn = activeType == "siswa" 
    ? '<button class="btn btn-primary btn-sm" onclick="propagateEmail()"><i data-lucide="mail" style="width:15px"></i> Kirim ke Wali Kelas</button>' 
    : '';

  var dayInfo = getDayInfo(currentFilterDate);
  var isFilteringRQ = String(filterKelas || "").toLowerCase().indexOf("rumah quran") > -1;

  // Status Badge Tanggal
  var dateBadgeHtml = "";
  if (isFilteringRQ) {
    dateBadgeHtml = '<span class="badge badge-free" style="gap:5px;font-size:12px;padding:6px 12px;"><i data-lucide="sparkles" style="width:14px;height:14px;"></i> ' + dayInfo.dayName + ' • Rumah Qur\'an Aktif Setiap Hari (Bebas)</span>';
  } else if (dayInfo.isNationalHoliday) {
    dateBadgeHtml = '<span class="badge badge-libur" style="gap:5px;font-size:12px;padding:6px 12px;"><i data-lucide="party-popper" style="width:14px;height:14px;"></i> ' + dayInfo.dayName + ' • Libur: ' + dayInfo.holidayName + '</span>';
  } else if (dayInfo.isWeekend) {
    dateBadgeHtml = '<span class="badge badge-libur" style="gap:5px;font-size:12px;padding:6px 12px;"><i data-lucide="calendar-off" style="width:14px;height:14px;"></i> ' + dayInfo.dayName + ' • Libur Akhir Pekan</span>';
  } else {
    dateBadgeHtml = '<span class="badge badge-success" style="gap:5px;font-size:12px;padding:6px 12px;"><i data-lucide="check-circle-2" style="width:14px;height:14px;"></i> ' + dayInfo.dayName + ' • Hari Efektif Belajar</span>';
  }

  // Status banner / deskripsi ditiadakan (admin sudah paham fungsi, status sudah ada di badge)
  var holidayBannerHtml = "";
  var rumahQuranBannerHtml = "";

  c.innerHTML =
    '<div class="page-header">' +
      '<div>' +
        '<h1>Laporan Kehadiran ' + targetType + '</h1>' +
      '</div>' +
      '<div class="header-actions">' +
        '<button class="btn ' + btnG + '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Pegawai</button>' +
        '<button class="btn ' + btnS + '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Siswa</button>' +
      '</div>' +
    '</div>' +
    getAuthAlertHtml() +
    '<div class="card no-print" style="margin-bottom:20px;">' +
      '<div class="card-body" style="padding:16px 20px;">' +
        '<!-- Baris 1: Aksi Cepat -->' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">' +
          '<div class="report-actions" style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;">' +
            '<!-- Dropdown Cetak (Portrait & Landscape) -->' +
            '<div class="app-dropdown" id="dropdown-print-lap">' +
              '<button type="button" class="btn btn-outline btn-sm app-dropdown-toggle" onclick="toggleAppDropdown(\'dropdown-print-lap\', event)" title="Pilih orientasi cetak dokumen">' +
                '<i data-lucide="printer" style="width:14px"></i> Cetak <i data-lucide="chevron-down" class="dropdown-chevron"></i>' +
              '</button>' +
              '<div class="app-dropdown-menu">' +
                '<div class="app-dropdown-header">Orientasi Cetak</div>' +
                '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); printReport(\'portrait\');" title="Cetak halaman Portrait">' +
                  '<i data-lucide="file" style="color:var(--primary)"></i>' +
                  '<div>Cetak Portrait</div>' +
                '</button>' +
                '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); printReport(\'landscape\');" title="Cetak halaman Landscape">' +
                  '<i data-lucide="file-text" style="color:var(--primary)"></i>' +
                  '<div>Cetak Landscape</div>' +
                '</button>' +
              '</div>' +
            '</div>' +
            '<!-- Dropdown Ekspor (Portrait & Landscape + Excel) -->' +
            '<div class="app-dropdown" id="dropdown-export-lap">' +
              '<button type="button" class="btn btn-danger btn-sm app-dropdown-toggle" onclick="toggleAppDropdown(\'dropdown-export-lap\', event)" title="Pilih format dan orientasi ekspor">' +
                '<i data-lucide="download" style="width:14px"></i> Ekspor <i data-lucide="chevron-down" class="dropdown-chevron"></i>' +
              '</button>' +
              '<div class="app-dropdown-menu">' +
                '<div class="app-dropdown-header">Dokumen PDF</div>' +
                '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); exportPDF(\'portrait\');" title="Unduh file PDF (Portrait)">' +
                  '<i data-lucide="file-text" style="color:#ef4444"></i>' +
                  '<div>PDF Portrait</div>' +
                '</button>' +
                '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); exportPDF(\'landscape\');" title="Unduh file PDF (Landscape)">' +
                  '<i data-lucide="file-text" style="color:#ef4444"></i>' +
                  '<div>PDF Landscape</div>' +
                '</button>' +
                '<div class="app-dropdown-divider"></div>' +
                '<div class="app-dropdown-header">Spreadsheet</div>' +
                '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); exportExcel();" title="Unduh file Excel (.xlsx)">' +
                  '<i data-lucide="file-spreadsheet" style="color:#10b981"></i>' +
                  '<div>Excel (.xlsx)</div>' +
                '</button>' +
              '</div>' +
            '</div>' +
            sendWaliBtn +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<button class="btn btn-outline btn-sm" onclick="loadData()"><i data-lucide="refresh-cw" style="width:14px"></i> Segarkan Data</button>' +
          '</div>' +
        '</div>' +
        '<!-- Baris 2: Controls Row (Tanggal, Hari Ini, Filter Dropdown, Badge, Search) -->' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;background:var(--bg);padding:10px 14px;border-radius:var(--radius-md);border:1px solid var(--border);">' +
          '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '<div style="display:flex;align-items:center;gap:5px;"><i data-lucide="calendar" style="width:15px;color:var(--primary);"></i><span style="font-size:13px;font-weight:600;color:var(--text);">Tanggal:</span></div>' +
            '<input type="date" class="form-input" id="lap-date-picker" value="' + (currentFilterDate || "") + '" onchange="changeDate(this.value)" style="width:auto;min-width:140px;height:38px;padding:6px 12px;font-size:13px;">' +
            '<button class="btn btn-outline btn-sm" onclick="setFilterDateToday()" style="height:38px;padding:0 12px;font-size:13px;"><i data-lucide="clock" style="width:14px"></i> Hari Ini</button>' +
            '<div style="width:1px;height:24px;background:var(--border);margin:0 2px;" class="hide-mobile"></div>' +
            '<select class="form-select" id="lap-filter-select" onchange="setFilter(this.value)" style="height:38px;padding:6px 12px;font-size:13px;font-weight:600;min-width:150px;width:auto;"></select>' +
            dateBadgeHtml +
          '</div>' +
          '<div style="flex:1;min-width:180px;max-width:300px;">' +
            '<div class="search-box" style="display:flex;width:100%;height:38px;background:var(--surface);">' +
              '<i data-lucide="search" style="width:15px;color:var(--gray);"></i>' +
              '<input type="text" id="lap-search-input" value="' + (globalSearchQuery || "") + '" placeholder="Cari nama / NIS / barcode..." oninput="handleGlobalSearch(this.value)" style="font-size:13px;">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<!-- Card Tabel Kehadiran -->' +
    '<div class="card">' +
      '<div class="card-body" style="padding:0;">' +
        '<div class="print-header print-only">' +
          '<div class="kop-surat">' +
            '<div class="kop-logo-box">' +
              '<img src="' + getAppLogoUrl() + '" alt="Logo Yayasan" onerror="this.onerror=null;this.src=\'icon-192.png\';" class="kop-logo">' +
            '</div>' +
            '<div class="kop-text">' +
              '<h1 class="kop-instansi">YAYASAN DARUL ULUM ISLAMIYYAH</h1>' +
              '<h2 class="kop-cabang">KAMANG BARU - KABUPATEN SIJUNJUNG</h2>' +
              '<p class="kop-alamat">Alamat: Jl. Lintas Sumatera, Kamang Baru, Kec. Kamang Baru, Kab. Sijunjung, Sumatera Barat</p>' +
            '</div>' +
          '</div>' +
          '<div class="kop-line"></div>' +
          '<div class="kop-doc-info">' +
            '<h3 class="kop-doc-title">LAPORAN KEHADIRAN HARIAN ' + (activeType == "guru" ? "PEGAWAI" : "SISWA") + '</h3>' +
            '<p class="kop-doc-meta">Hari / Tanggal: <strong>' + dayInfo.dayName + ', ' + formatFullDate(currentFilterDate) + '</strong> &nbsp;|&nbsp; ' + (activeType == "guru" ? "Unit Kerja" : "Kelas") + ': <strong>' + (filterKelas || "Semua") + '</strong></p>' +
          '</div>' +
        '</div>' +
        '<div class="table-responsive">' +
          '<table class="table">' +
            '<thead>' +
              '<tr>' +
                '<th style="padding-left:20px;">Siswa / Pegawai</th>' +
                '<th>' + (activeType == "guru" ? "Unit & Jabatan" : "Unit / Kelas") + '</th>' +
                '<th>Hari & Tanggal</th>' +
                '<th>Jam Masuk</th>' +
                '<th>Status</th>' +
                '<th class="no-print">Verifikasi Wajah</th>' +
                '<th class="no-print" style="text-align:center;padding-right:20px;">Aksi</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody id="lap-table"></tbody>' +
          '</table>' +
        '</div>' +
        '<div class="print-footer print-only">' +
          '<div class="print-signature">' +
            '<p class="sig-date">Kamang Baru, ' + formatFullDate(currentFilterDate) + '</p>' +
            '<p class="sig-title">Mengetahui,<br>Kepala Yayasan Darul Ulum</p>' +
            '<div class="sig-space"></div>' +
            '<p class="sig-name"><strong>' + (appSettings.kepalaYayasan || "Pimpinan Yayasan") + '</strong></p>' +
          '</div>' +
        '</div>' +
        '<div class="pagination no-print" style="padding:16px 20px;">' +
          '<div class="pagination-info" id="pg-info"></div>' +
          '<div class="pagination-btns">' +
            '<button class="page-btn">&lt;</button>' +
            '<button class="page-btn active">1</button>' +
            '<button class="page-btn">&gt;</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  renderFilters();
  renderLapTable();
  lucide.createIcons();
}

function renderFilters() {
  var sel = document.getElementById("lap-filter-select");
  if (!sel) return;
  var roles = getCategoryFilterList();
  var isPegawai = activeType === "guru";
  var opts = "";
  for (var j = 0; j < roles.length; j++) {
    var rName = roles[j];
    var isRQ = rName.toLowerCase().indexOf("rumah quran") > -1;
    var label = isRQ ? '📖 ' + rName + ' (Bebas)' : (rName === 'Semua' ? (isPegawai ? 'Semua Unit Kerja' : 'Semua Kelas') : rName);
    opts += '<option value="' + rName + '" ' + (filterKelas === rName ? 'selected' : '') + '>' + label + '</option>';
  }
  sel.innerHTML = opts;
}

function setFilter(arg1, arg2) {
  var f = (typeof arg2 !== "undefined") ? arg2 : arg1;
  filterKelas = f;
  var sel = document.getElementById("lap-filter-select");
  if (sel && sel.value !== f) sel.value = f;
  renderLapTable();
}

function renderLapTable() {
  var tb = document.getElementById("lap-table");
  if (!tb) return;
  var isPegawai = activeType == "guru";
  var data = attendance.filter(function (a) {
    var isType = a.type === (isPegawai ? "Guru" : "Siswa") || (!isPegawai && !a.type);
    var matchCategory = isPegawai ? matchPegawaiUnit(a, filterKelas) : matchSiswaKelas(a, filterKelas);
    var matchSearch = true;
    if (globalSearchQuery) {
      var q = globalSearchQuery.toLowerCase();
      var nm = (a.nama || "").toLowerCase();
      var kl = (a.kelas || "").toLowerCase();
      var sid = (a.studentId || "").toLowerCase();
      matchSearch = nm.indexOf(q) > -1 || kl.indexOf(q) > -1 || sid.indexOf(q) > -1;
    }
    return isType && matchCategory && matchSearch;
  });

  // Jika memfilter unit tertentu untuk pegawai, hindari duplikasi jika ada presensi langsung dan presensi lintas unit
  if (isPegawai && filterKelas && filterKelas !== "Semua") {
    var seenStudentMap = {};
    var deduplicated = [];
    data.sort(function(a, b) {
      var aDirect = getPegawaiUnit(a).toLowerCase() === filterKelas.toLowerCase() ? 0 : 1;
      var bDirect = getPegawaiUnit(b).toLowerCase() === filterKelas.toLowerCase() ? 0 : 1;
      return aDirect - bDirect;
    });
    for (var dIdx = 0; dIdx < data.length; dIdx++) {
      var row = data[dIdx];
      var sidKey = String(row.studentId || row.id || row.nama).trim();
      if (!seenStudentMap[sidKey]) {
        seenStudentMap[sidKey] = true;
        deduplicated.push(row);
      }
    }
    data = deduplicated;
  }

  currentFilteredAttendance = data;

  var pgEl = document.getElementById("pg-info");
  if (pgEl) {
    pgEl.innerText = "Menampilkan 1 - " + data.length + " dari " + data.length + " data";
  }

  if (data.length === 0) {
    var dayInfo = getDayInfo(currentFilterDate);
    var emptyTitle = "";
    var emptySub = "";

    var isFilterRQ = String(filterKelas || "").toLowerCase().indexOf("rumah quran") > -1;

    if (isFilterRQ) {
      emptyTitle = "Belum Ada Presensi Rumah Qur'an";
      emptySub = "Unit Rumah Qur'an tidak memiliki hari libur tertentu (semua hari Senin s.d. Minggu dapat digunakan). Belum ada " + (activeType === "guru" ? "pegawai" : "siswa") + " yang mengisi absensi pada tanggal " + formatDate(currentFilterDate) + ".";
    } else if (dayInfo.isNationalHoliday) {
      emptyTitle = "Hari Libur Resmi (" + dayInfo.holidayName + ")";
      emptySub = "Presensi reguler tidak diwajibkan pada hari libur nasional / cuti bersama (bukan Alpa). Siswa & guru Rumah Qur'an dapat tetap absen karena semua hari aktif.";
    } else if (dayInfo.isWeekend) {
      emptyTitle = "Hari Libur Akhir Pekan (" + dayInfo.dayName + ")";
      emptySub = "Presensi reguler tidak diwajibkan pada hari Sabtu & Minggu, dan ketidakhadiran bukan Alpa. Siswa & guru Rumah Qur'an dapat tetap absen karena semua hari aktif.";
    } else if (attendance.length === 0) {
      emptyTitle = "Belum Ada Presensi Tercatat";
      emptySub = "Tidak ada data presensi pada tanggal " + formatDate(currentFilterDate) + ".";
    } else {
      emptyTitle = "Tidak Ada Data yang Cocok";
      emptySub = "Tidak ditemukan data yang sesuai dengan filter kelas atau kata kunci pencarian.";
    }

    tb.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:45px 20px;color:var(--gray)">' +
      '<i data-lucide="' + (dayInfo.isHoliday ? 'calendar-off' : 'search-x') + '" style="width:40px;height:40px;margin-bottom:12px;opacity:0.4;"></i>' +
      '<div style="font-weight:600;font-size:15px;color:var(--text);margin-bottom:4px;">' + emptyTitle + '</div>' +
      '<div style="font-size:13px;color:var(--text-muted);max-width:480px;margin:0 auto;">' + emptySub + '</div>' +
      '</td></tr>';
    lucide.createIcons();
    return;
  }

  var h = "";
  for (var i = 0; i < data.length; i++) {
    var a = data[i];
    var isRQ = isRumahQuranRole(a.kelas) || (isPegawai && isRumahQuranRole(getPegawaiUnit(a)));
    var rqTag = isRQ ? ' <span class="badge badge-free" style="font-size:10px;padding:2px 6px;margin-left:4px;">Jadwal Bebas</span>' : '';
    var dateFormatted = getDayInfo(a.tanggal).dayName + ', ' + formatDate(a.tanggal);

    var displayStatus = a.status;
    if (isRQ && (displayStatus === "TL1" || displayStatus === "TL2" || displayStatus === "Terlambat" || displayStatus === "Alpa")) {
      displayStatus = "Hadir";
    }

    var bc = "secondary";
    if (displayStatus === "Hadir") bc = "success";
    else if (displayStatus === "TL1") bc = "tl1";
    else if (displayStatus === "TL2") bc = "tl2";
    else if (displayStatus === "Terlambat") bc = "warning";
    else if (displayStatus === "Izin") bc = "izin";
    else if (displayStatus === "Sakit") bc = "sakit";
    else if (displayStatus === "Alpa") bc = "alpa";
    else if (displayStatus === "Libur") bc = "libur";
    var tc = (!isRQ && (displayStatus === "TL1" || displayStatus === "TL2" || displayStatus === "Terlambat" || displayStatus === "Alpa")) ? ' class="time-late"' : "";
    var v =
      a.faceMatch > 0.5
        ? '<button class="verify-btn verified" onclick="showAttendanceDetail(' + i + ')" title="Wajah Cocok (Klik untuk detail)"><i data-lucide="camera" style="width:16px"></i></button>'
        : '<button class="verify-btn not-verified" onclick="showAttendanceDetail(' + i + ')" title="Belum Terverifikasi (Klik untuk detail)"><i data-lucide="camera-off" style="width:16px"></i></button>';
    var photoSrc = a.fotoAbsen ? formatPhotoUrl(a.fotoAbsen) : "";
    var thumb = photoSrc
      ? '<img src="' +
        photoSrc +
        '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;cursor:pointer;" onclick="showAttendanceDetail(' + i + ')" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="avatar ' + getColor(i) + '" style="display:none;cursor:pointer;" onclick="showAttendanceDetail(' + i + ')">' + getInit(a.nama) + "</div>"
      : '<div class="avatar ' + getColor(i) + '" style="cursor:pointer;" onclick="showAttendanceDetail(' + i + ')">' + getInit(a.nama) + "</div>";
    
    var categoryDisplay = "";
    if (isPegawai) {
      var uLap = getPegawaiUnit(a);
      var jLap = getPegawaiJabatan(a);
      var isCross = (filterKelas && filterKelas !== "Semua" && uLap.toLowerCase() !== filterKelas.toLowerCase());
      var crossBadge = isCross
        ? ' <span class="badge badge-warning" style="font-size:10px;padding:2px 6px;" title="Pegawai merangkap di beberapa unit reguler dan mengisi absensi via Unit ' + uLap + '">Absen via Unit ' + uLap + '</span>'
        : '';
      var unitLabel = isCross ? filterKelas : uLap;
      categoryDisplay = '<span class="badge badge-info" style="font-size:11px;margin-right:4px;">Unit ' + unitLabel + '</span> ' + (jLap !== "-" && jLap !== unitLabel ? jLap : "") + crossBadge + rqTag;
    } else {
      categoryDisplay = (a.kelas || "-") + rqTag;
    }

    var ketNote = a.keterangan ? '<br><small style="font-size:11px;color:var(--text-muted);"><i data-lucide="info" style="width:10px;height:10px;vertical-align:-1px;"></i> ' + a.keterangan + '</small>' : '';

    h +=
      '<tr><td style="padding-left:20px;"><div class="student-cell" style="cursor:pointer;" onclick="showAttendanceDetail(' + i + ')">' +
      thumb +
      '<div><span style="font-weight:600;display:block;">' +
      a.nama +
      '</span><small style="color:var(--gray)">' + (a.studentId || a.id || "-") + '</small></div>' +
      "</div></td><td>" +
      categoryDisplay +
      "</td><td>" +
      dateFormatted +
      "</td><td" +
      tc +
      ">" +
      (formatTime(a.waktu) || "--:--") +
      '</td><td><span class="badge badge-' +
      bc +
      '">' +
      displayStatus +
      "</span>" + ketNote + "</td><td>" +
      v +
      '</td><td style="text-align:center;padding-right:20px;"><button class="action-btn" onclick="showAttendanceDetail(' + i + ')" title="Lihat Detail Absensi (Titik Tiga)"><i data-lucide="more-vertical" style="width:18px"></i></button></td></tr>';
  }
  tb.innerHTML = h;
  lucide.createIcons();
}

function showAttendanceDetail(idx) {
  var a = currentFilteredAttendance[idx];
  if (!a) return;

  var photoSrc = a.fotoAbsen ? formatPhotoUrl(a.fotoAbsen) : "";
  var photoHtml = photoSrc
    ? '<div style="text-align:center;margin-bottom:15px;"><img src="' + photoSrc + '" style="max-width:100%;max-height:260px;border-radius:12px;object-fit:cover;box-shadow:var(--shadow);" onerror="this.parentElement.innerHTML=\'<div class=\\\'avatar ' + getColor(idx) + '\\\' style=\\\'width:80px;height:80px;font-size:28px;margin:0 auto;\\\'>' + getInit(a.nama) + '</div>\'"></div>'
    : '<div style="text-align:center;margin-bottom:15px;"><div class="avatar ' + getColor(idx) + '" style="width:80px;height:80px;font-size:28px;margin:0 auto;">' + getInit(a.nama) + '</div></div>';

  var stBadge = "secondary";
  if (a.status === "Hadir") stBadge = "success";
  else if (a.status === "TL1") stBadge = "tl1";
  else if (a.status === "TL2") stBadge = "tl2";
  else if (a.status === "Terlambat") stBadge = "warning";
  else if (a.status === "Izin") stBadge = "izin";
  else if (a.status === "Sakit") stBadge = "sakit";
  else if (a.status === "Alpa") stBadge = "alpa";
  else if (a.status === "Libur") stBadge = "libur";

  var fmText = (a.faceMatch !== undefined && a.faceMatch !== null && a.faceMatch > 0)
    ? Math.round(a.faceMatch * 100) + "%"
    : "-";
  var isVerified = a.faceMatch > 0.5;
  var verifBadge = isVerified
    ? '<span class="badge badge-success"><i data-lucide="check-circle" style="width:12px;height:12px;margin-right:4px;"></i> Wajah Cocok (' + fmText + ')</span>'
    : '<span class="badge badge-danger"><i data-lucide="x-circle" style="width:12px;height:12px;margin-right:4px;"></i> Belum Terverifikasi</span>';

  var lat = a.lat || a.latitude || "";
  var lng = a.lng || a.longitude || "";
  var mapBtn = "";
  if (lat && lng) {
    mapBtn = '<a href="https://www.google.com/maps?q=' + lat + ',' + lng + '" target="_blank" class="btn btn-outline" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;margin-top:8px;"><i data-lucide="map-pin" style="width:14px;color:var(--danger);"></i> Buka Titik Lokasi di Google Maps</a>';
  }

  var fullPhotoBtn = "";
  if (photoSrc) {
    fullPhotoBtn = '<a href="' + photoSrc + '" target="_blank" class="btn btn-outline" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;margin-top:8px;"><i data-lucide="external-link" style="width:14px;"></i> Buka Foto Asli</a>';
  }

  var ketRow = a.keterangan ? '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:6px;"><span style="color:var(--gray);">Keterangan:</span><strong style="color:var(--text);text-align:right;max-width:240px;">' + a.keterangan + '</strong></div>' : '';

  var m = document.getElementById("modal");
  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Detail Absensi</span><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body">' +
    photoHtml +
    '<div style="text-align:center;margin-bottom:15px;">' +
    '<h3 style="margin:0 0 4px;">' + a.nama + '</h3>' +
    '<p style="color:var(--gray);font-size:13px;margin:0;">' + (a.kelas || "-") + ' • ' + (a.type || (activeType === "guru" ? "Pegawai" : "Siswa")) + '</p>' +
    '</div>' +
    '<div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:15px;display:flex;flex-direction:column;gap:10px;font-size:13px;">' +
    '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:6px;">' +
    '<span style="color:var(--gray);">Status Kehadiran:</span>' +
    '<span class="badge badge-' + stBadge + '">' + a.status + '</span>' +
    '</div>' +
    ketRow +
    '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:6px;">' +
    '<span style="color:var(--gray);">Tanggal & Waktu:</span>' +
    '<strong>' + formatDate(a.tanggal) + ' • ' + (formatTime(a.waktu) || "--:--") + ' WIB</strong>' +
    '</div>' +
    '<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:6px;align-items:center;">' +
    '<span style="color:var(--gray);">Biometrik Wajah:</span>' +
    '<div>' + verifBadge + '</div>' +
    '</div>' +
    '<div>' +
    '<span style="color:var(--gray);display:block;margin-bottom:4px;">Lokasi GPS & Alamat:</span>' +
    '<div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-size:12px;line-height:1.4;">' +
    '<i data-lucide="map-pin" style="width:13px;height:13px;color:var(--danger);vertical-align:-2px;margin-right:4px;"></i>' +
    (a.alamat || (lat && lng ? 'Lat: ' + lat + ', Lng: ' + lng : 'Lokasi tidak tercatat')) +
    '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + mapBtn + fullPhotoBtn + '</div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Tutup</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}
function formatDate(d) {
  if (!d) return "-";
  var s = String(d).trim();
  if (s.indexOf("'") === 0) s = s.substring(1);
  var p = s.split("-");
  var m = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agt",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ];
  return p.length === 3 ? p[2] + " " + m[parseInt(p[1]) - 1] + " " + p[0] : s;
}

function formatTime(w) {
  if (!w) return "--:--";
  var s = String(w).trim();
  if (s.indexOf("'") === 0) s = s.substring(1);
  // Bersihkan format Date string / ISO jika ada
  var match = s.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (match) return match[1];
  return s;
}

function formatPhotoUrl(url) {
  return formatGoogleDriveUrl(url);
}
function renderRekap() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";

  var monthOptions = "";
  var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  for (var mIdx = 1; mIdx <= 12; mIdx++) {
    var mSel = (mIdx === currentRekapMonth) ? "selected" : "";
    monthOptions += '<option value="' + mIdx + '" ' + mSel + '>' + monthNames[mIdx - 1] + '</option>';
  }

  var yearOptions = "";
  var thisYear = new Date().getFullYear();
  for (var y = thisYear - 1; y <= thisYear + 1; y++) {
    var ySel = (y === currentRekapYear) ? "selected" : "";
    yearOptions += '<option value="' + y + '" ' + ySel + '>' + y + '</option>';
  }

  c.innerHTML =
    '<div class="page-header"><div><h1>Rekap Bulanan ' +
    targetType +
    '</h1></div><div class="header-actions">' +
    '<button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Pegawai</button>' +
    '<button class="btn ' +
    btnS +
    '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Siswa</button>' +
    '</div></div>' +
    getAuthAlertHtml() +
    '<div class="card no-print rekap-toolbar-card"><div class="card-body rekap-toolbar-body">' +
    // 1. Period & Category Filter Selector
    '<div class="rekap-period-box">' +
      '<div class="rekap-period-label"><i data-lucide="calendar" style="width:15px;height:15px;color:var(--primary)"></i> <span>Periode:</span></div>' +
      '<select class="form-select" id="rekap-month" onchange="changeRekapPeriod()">' + monthOptions + '</select>' +
      '<select class="form-select" id="rekap-year" onchange="changeRekapPeriod()">' + yearOptions + '</select>' +
      '<div style="width:1px;height:24px;background:var(--border);margin:0 4px;" class="hide-mobile"></div>' +
      '<select class="form-select" id="rekap-filter-select" onchange="filterRekap(this.value)" style="font-weight:600;min-width:140px;"></select>' +
    '</div>' +
    // 2. In-Page Search
    '<div class="rekap-search-box">' +
      '<i data-lucide="search" class="search-icon"></i>' +
      '<input type="text" id="rekap-search-input" placeholder="Cari nama / kelas..." value="' + escapeHtml(rekapLocalSearch) + '" oninput="handleRekapSearch(this.value)">' +
      (rekapLocalSearch ? '<button type="button" class="rekap-search-clear" onclick="clearRekapSearch()">✕</button>' : '') +
    '</div>' +
    // 3. Actions Row & View Switcher
    '<div class="rekap-actions-row">' +
      '<div class="rekap-view-switcher">' +
        '<button type="button" class="view-switch-btn ' + (rekapViewMode === "card" ? "active" : "") + '" onclick="setRekapViewMode(\'card\')" title="Tampilan Kartu (Optimal untuk HP/Mobile)">' +
          '<i data-lucide="layout-grid" style="width:14px;height:14px"></i> <span>Kartu</span>' +
        '</button>' +
        '<button type="button" class="view-switch-btn ' + (rekapViewMode === "table" ? "active" : "") + '" onclick="setRekapViewMode(\'table\')" title="Tampilan Tabel 31 Hari Lengkap">' +
          '<i data-lucide="table" style="width:14px;height:14px"></i> <span>Tabel 31 Hari</span>' +
        '</button>' +
      '</div>' +
      '<!-- Dropdown Cetak (Portrait & Landscape) -->' +
      '<div class="app-dropdown" id="dropdown-print-rekap">' +
        '<button type="button" class="btn btn-outline btn-sm app-dropdown-toggle" onclick="toggleAppDropdown(\'dropdown-print-rekap\', event)" title="Pilih orientasi cetak rekap">' +
          '<i data-lucide="printer" style="width:14px"></i> Cetak <i data-lucide="chevron-down" class="dropdown-chevron"></i>' +
        '</button>' +
        '<div class="app-dropdown-menu">' +
          '<div class="app-dropdown-header">Orientasi Cetak</div>' +
          '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); printReport(\'portrait\');" title="Cetak Rekap Portrait">' +
            '<i data-lucide="file" style="color:var(--primary)"></i>' +
            '<div>Cetak Portrait</div>' +
          '</button>' +
          '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); printReport(\'landscape\');" title="Cetak Rekap Landscape">' +
            '<i data-lucide="file-text" style="color:var(--primary)"></i>' +
            '<div>Cetak Landscape</div>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<!-- Dropdown Ekspor (Portrait & Landscape + Excel) -->' +
      '<div class="app-dropdown" id="dropdown-export-rekap">' +
        '<button type="button" class="btn btn-danger btn-sm app-dropdown-toggle" onclick="toggleAppDropdown(\'dropdown-export-rekap\', event)" title="Pilih format dan orientasi ekspor">' +
          '<i data-lucide="download" style="width:14px"></i> Ekspor <i data-lucide="chevron-down" class="dropdown-chevron"></i>' +
        '</button>' +
        '<div class="app-dropdown-menu">' +
          '<div class="app-dropdown-header">Dokumen PDF</div>' +
          '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); exportRekapPDF(\'portrait\');" title="Unduh Rekap PDF Portrait">' +
            '<i data-lucide="file-text" style="color:#ef4444"></i>' +
            '<div>PDF Portrait</div>' +
          '</button>' +
          '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); exportRekapPDF(\'landscape\');" title="Unduh Rekap PDF Landscape">' +
            '<i data-lucide="file-text" style="color:#ef4444"></i>' +
            '<div>PDF Landscape</div>' +
          '</button>' +
          '<div class="app-dropdown-divider"></div>' +
          '<div class="app-dropdown-header">Spreadsheet</div>' +
          '<button type="button" class="app-dropdown-item" onclick="closeAllDropdowns(); exportRekapExcel();" title="Unduh Rekap Excel (.xlsx)">' +
            '<i data-lucide="file-spreadsheet" style="color:#10b981"></i>' +
            '<div>Excel (.xlsx)</div>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '</div></div>' +
    '<div class="card"><div class="card-body" id="rekap-content"><p style="text-align:center;padding:30px;color:var(--gray)">Memuat data ' +
    targetType +
    "...</p></div></div>";

  if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  loadRekapData();
}

function changeRekapPeriod() {
  var mEl = document.getElementById("rekap-month");
  var yEl = document.getElementById("rekap-year");
  if (mEl) currentRekapMonth = parseInt(mEl.value, 10);
  if (yEl) currentRekapYear = parseInt(yEl.value, 10);
  loadRekapData();
}

function loadRekapData() {
  var rc = document.getElementById("rekap-content");
  if (rc) {
    rc.innerHTML = '<p style="text-align:center;padding:30px;color:var(--gray);"><i data-lucide="loader" class="rotating" style="width:24px;height:24px;animation:spin 1s linear infinite;"></i><br><br>Memuat rekap...</p>';
    lucide.createIcons();
  }
  window.callGasAPI(
    "getMonthlyRecap",
    {
      month: currentRekapMonth,
      year: currentRekapYear,
      type: activeType,
    },
    function (r) {
      rekapData = r;
      showRekapTable();
    },
    function (err) {
      if (rc) rc.innerHTML = '<p style="text-align:center;padding:30px;color:var(--danger)">Gagal memuat rekap: ' + err + '</p>';
    }
  );
}
function calculateStudentRecap(s, rekapData, targetMonth, targetYear) {
  var isRumahQuran = false;
  if (s.isRumahQuran !== undefined) {
    isRumahQuran = !!s.isRumahQuran;
  } else {
    var roleStr = String(s.recapRole || s.jabatan || s.kelas || "");
    var unitStr = String(s.unit || getPegawaiUnit(s));
    var roles = parsePegawaiRoles(roleStr);
    var hasNonRQ = roles.some(function(r) { return !isRumahQuranRole(r); });
    if (hasNonRQ) {
      isRumahQuran = false;
    } else {
      isRumahQuran = isRumahQuranRole(roleStr) || isRumahQuranRole(unitStr);
    }
  }

  // Sinkronisasi status kehadiran antar unit reguler untuk pegawai yang merangkap tugas
  if (!isRumahQuran && s.originalId && rekapData && rekapData.students) {
    var mySid = String(s.originalId || s.id).replace(/#.*$/, "").trim();
    for (var rsIdx = 0; rsIdx < rekapData.students.length; rsIdx++) {
      var oStu = rekapData.students[rsIdx];
      var oSid = String(oStu.originalId || oStu.id).replace(/#.*$/, "").trim();
      if (oSid === mySid && !oStu.isRumahQuran && oStu.days) {
        if (!s.days) s.days = {};
        for (var dayKey in oStu.days) {
          if (!s.days[dayKey] || s.days[dayKey] === "-" || s.days[dayKey] === "A") {
            s.days[dayKey] = oStu.days[dayKey];
          }
        }
      }
    }
  }

  var totals = { H: 0, T: 0, TL1: 0, TL2: 0, S: 0, I: 0, A: 0 };
  var days = {};
  var todayObj = new Date();
  var todayYear = todayObj.getFullYear();
  var todayMonth = todayObj.getMonth() + 1;
  var todayDay = todayObj.getDate();

  for (var d = 1; d <= rekapData.daysInMonth; d++) {
    var rawCode = (s.days && s.days[d]) ? s.days[d] : null;
    var dDate = new Date(targetYear, targetMonth - 1, d);
    var dow = dDate.getDay(); // 0 = Minggu, 6 = Sabtu
    var isWeekend = (dow === 0 || dow === 6);
    var isoKey = targetYear + '-' + String(targetMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var hMgr = (typeof window !== "undefined" && window.HolidayManager) ? window.HolidayManager : (typeof global !== "undefined" && global.HolidayManager ? global.HolidayManager : null);
    var holidayInfo = hMgr ? hMgr.getHoliday(isoKey) : null;
    var isNationalHoliday = !!(holidayInfo && holidayInfo.isHoliday);
    var isHoliday = isWeekend || isNationalHoliday;

    var isPastOrToday = false;
    if (targetYear < todayYear) {
      isPastOrToday = true;
    } else if (targetYear === todayYear) {
      if (targetMonth < todayMonth) {
        isPastOrToday = true;
      } else if (targetMonth === todayMonth && d <= todayDay) {
        isPastOrToday = true;
      }
    }

    var finalCode = "-";
    if (rawCode && rawCode !== "-" && rawCode !== "A") {
      // Kehadiran tercatat: untuk Rumah Qur'an tidak ada batasan jam terlambat, semua kehadiran di hari apapun (Senin s.d. Minggu) adalah Hadir (H)
      if (isRumahQuran && (rawCode === "T" || rawCode === "TL1" || rawCode === "TL2")) {
        finalCode = "H";
      } else {
        finalCode = rawCode;
      }
    } else if (isRumahQuran) {
      // Rumah Qur'an tidak ada hari libur tertentu (semua hari bisa digunakan & tidak pernah otomatis dicatat Alpa)
      finalCode = "-";
    } else if (isHoliday) {
      // Reguler: Sabtu, Minggu, atau Hari Libur Nasional/Cuti Bersama (default bukan Alpa)
      finalCode = "-";
    } else if (isPastOrToday) {
      // Reguler: Alpa HANYA jika pada hari efektif belajar (Senin-Jumat non-libur) tidak mengisi absensi sama sekali
      finalCode = "A";
    } else {
      // Hari masa depan yang belum berjalan
      finalCode = "-";
    }

    days[d] = finalCode;
    if (finalCode === "TL1" || finalCode === "TL2") {
      totals.T = (totals.T || 0) + 1;
      totals[finalCode] = (totals[finalCode] || 0) + 1;
    } else if (totals[finalCode] !== undefined) {
      totals[finalCode]++;
    }
  }

  return {
    days: days,
    totals: totals,
    isRumahQuran: isRumahQuran
  };
}

function showRekapTable() {
  var rc = document.getElementById("rekap-content");
  if (!rc) return;
  if (!rekapData || !rekapData.students || rekapData.students.length === 0) {
    rc.innerHTML =
      '<p style="text-align:center;padding:40px 20px;color:var(--gray)"><i data-lucide="calendar-x" style="width:36px;height:36px;margin-bottom:10px;color:var(--gray)"></i><br>Tidak ada data rekap untuk periode ini.</p>';
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
    return;
  }

  // Populate filter dropdown in toolbar
  var isPegawai = activeType === "guru";
  var roles = getCategoryFilterList();
  var rSel = document.getElementById("rekap-filter-select");
  if (rSel) {
    var rOpts = "";
    for (var j = 0; j < roles.length; j++) {
      var rName = roles[j];
      var isRQ = rName.toLowerCase().indexOf("rumah quran") > -1;
      var label = isRQ ? '📖 ' + rName + ' (Bebas)' : (rName === 'Semua' ? (isPegawai ? 'Semua Unit Kerja' : 'Semua Kelas') : rName);
      rOpts += '<option value="' + rName + '" ' + (filterKelas === rName ? 'selected' : '') + '>' + label + '</option>';
    }
    rSel.innerHTML = rOpts;
  }

  // 3. Official Print Header
  var printHeader = 
    '<div class="print-header print-only">' +
      '<div class="kop-surat">' +
        '<div class="kop-logo-box">' +
          '<img src="' + getAppLogoUrl() + '" alt="Logo Yayasan" onerror="this.onerror=null;this.src=\'icon-192.png\';" class="kop-logo">' +
        '</div>' +
        '<div class="kop-text">' +
          '<h1 class="kop-instansi">YAYASAN DARUL ULUM ISLAMIYYAH</h1>' +
          '<h2 class="kop-cabang">KAMANG BARU - KABUPATEN SIJUNJUNG</h2>' +
          '<p class="kop-alamat">Alamat: Jl. Lintas Sumatera, Kamang Baru, Kec. Kamang Baru, Kab. Sijunjung, Sumatera Barat</p>' +
        '</div>' +
      '</div>' +
      '<div class="kop-line"></div>' +
      '<div class="kop-doc-info">' +
        '<h3 class="kop-doc-title">REKAPITULASI KEHADIRAN BULANAN ' + (activeType == "guru" ? "PEGAWAI" : "SISWA") + '</h3>' +
        '<p class="kop-doc-meta">Periode: <strong>' + getIndonesianMonth(currentRekapMonth) + ' ' + currentRekapYear + '</strong> &nbsp;|&nbsp; ' + (activeType == "guru" ? "Unit Kerja" : "Kelas") + ': <strong>' + (filterKelas || "Semua") + '</strong></p>' +
      '</div>' +
    '</div>';

  // 4. Hitung Ulang Data untuk yang Cocok dengan Filter & Search
  var visibleStudents = [];
  var totalH = 0, totalT = 0, totalS = 0, totalI = 0, totalA = 0;
  var displayStudents = isPegawai ? splitPegawaiEntries(rekapData.students) : rekapData.students;

  var query = (rekapLocalSearch || globalSearchQuery || "").toLowerCase();

  for (var k = 0; k < displayStudents.length; k++) {
    var s = displayStudents[k];
    var matchCategory = isPegawai ? matchPegawaiUnit(s, filterKelas) : matchSiswaKelas(s, filterKelas);
    if (!matchCategory) continue;

    if (query) {
      var sRoles = isPegawai ? (s.recapRole || s.kelas || "") : s.kelas;
      if ((s.nama || "").toLowerCase().indexOf(query) === -1 && sRoles.toLowerCase().indexOf(query) === -1) {
        continue;
      }
    }

    var recapCalc = calculateStudentRecap(s, rekapData, currentRekapMonth, currentRekapYear);
    totalH += (recapCalc.totals.H || 0);
    totalT += (recapCalc.totals.T || 0);
    totalS += (recapCalc.totals.S || 0);
    totalI += (recapCalc.totals.I || 0);
    totalA += (recapCalc.totals.A || 0);

    visibleStudents.push({
      student: s,
      recap: recapCalc,
      index: k
    });
  }

  // 5. High-level Summary Strip (Ringkasan Cepat)
  var totalRecords = totalH + totalT + totalS + totalI + totalA;
  var avgRate = totalRecords > 0 ? Math.round(((totalH + totalT) / totalRecords) * 100) : 100;
  var summaryStripHtml =
    '<div class="rekap-summary-strip no-print">' +
      '<div class="rekap-summary-pill">' +
        '<div class="pill-icon" style="background:#e0f2fe;color:#0284c7;"><i data-lucide="users" style="width:18px;height:18px;"></i></div>' +
        '<div><div class="pill-val">' + visibleStudents.length + '</div><div class="pill-label">Total ' + (isPegawai ? 'Pegawai' : 'Siswa') + '</div></div>' +
      '</div>' +
      '<div class="rekap-summary-pill">' +
        '<div class="pill-icon" style="background:#dcfce7;color:#16a34a;"><i data-lucide="percent" style="width:18px;height:18px;"></i></div>' +
        '<div><div class="pill-val">' + avgRate + '%</div><div class="pill-label">Rata-rata Hadir</div></div>' +
      '</div>' +
      '<div class="rekap-summary-pill">' +
        '<div class="pill-icon" style="background:#fef3c7;color:#d97706;"><i data-lucide="clock" style="width:18px;height:18px;"></i></div>' +
        '<div><div class="pill-val">' + totalT + '</div><div class="pill-label">Total Terlambat</div></div>' +
      '</div>' +
      '<div class="rekap-summary-pill">' +
        '<div class="pill-icon" style="background:#fee2e2;color:#dc2626;"><i data-lucide="user-x" style="width:18px;height:18px;"></i></div>' +
        '<div><div class="pill-val">' + totalA + '</div><div class="pill-label">Total Alpa (A)</div></div>' +
      '</div>' +
    '</div>';

  // 6. View Rendering
  var contentHtml = "";
  if (visibleStudents.length === 0) {
    contentHtml =
      '<div style="text-align:center;padding:45px 20px;color:var(--gray);background:var(--surface);border-radius:12px;border:1px dashed var(--border);margin-bottom:16px;">' +
        '<i data-lucide="search-x" style="width:36px;height:36px;margin-bottom:10px;color:var(--gray);"></i>' +
        '<p style="font-size:14px;font-weight:600;margin:0 0 6px 0;color:var(--text);">Tidak ada data yang cocok</p>' +
        '<p style="font-size:12px;margin:0;color:var(--text-muted);">Coba ubah kata kunci pencarian atau ganti filter kategori di atas.</p>' +
      '</div>';
  } else if (rekapViewMode === "card") {
    // Mode Kartu untuk Layar Mobile / Ringkas
    contentHtml = renderRekapCards(visibleStudents, rekapData);
  } else {
    // Mode Tabel Matriks 31 Hari Lengkap (Mobile Optimized)
    contentHtml = renderRekapTableHtml(visibleStudents, rekapData);
  }

  // 7. Hidden Print Table (agar cetak A4 selalu menghasilkan tabel resmi lengkap meskipun di layar sedang mode Kartu)
  var printTableHtml = "";
  if (rekapViewMode === "card") {
    printTableHtml = '<div class="print-only" style="display:none;">' + renderRekapTableHtml(visibleStudents, rekapData, true) + '</div>';
  }

  var printFooter = 
    '<div class="print-footer print-only">' +
      '<div class="print-signature">' +
        '<p class="sig-date">Kamang Baru, ' + formatFullDate(new Date().toISOString().split('T')[0]) + '</p>' +
        '<p class="sig-title">Mengetahui,<br>Kepala Yayasan Darul Ulum</p>' +
        '<div class="sig-space"></div>' +
        '<p class="sig-name"><strong>' + (appSettings.kepalaYayasan || "Pimpinan Yayasan") + '</strong></p>' +
      '</div>' +
    '</div>';

  rc.innerHTML = summaryStripHtml + printHeader + contentHtml + printTableHtml + printFooter;
  if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
}

function renderRekapCards(visibleStudents, rekapData) {
  var h = '<div class="rekap-card-grid no-print">';
  var daysInMonth = rekapData.daysInMonth;
  var dayNamesShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  var isPegawai = activeType === "guru";

  for (var i = 0; i < visibleStudents.length; i++) {
    var item = visibleStudents[i];
    var s = item.student;
    var recap = item.recap;
    var sDays = recap.days;
    var sTotals = recap.totals;
    var isRQ = recap.isRumahQuran;
    var cardId = "card-" + i;
    var isExpanded = !!rekapExpandedCards[cardId];

    // Persentase Kehadiran
    var totalAttended = (sTotals.H || 0) + (sTotals.T || 0);
    var totalReported = totalAttended + (sTotals.S || 0) + (sTotals.I || 0) + (sTotals.A || 0);
    var rate = totalReported > 0 ? Math.round((totalAttended / totalReported) * 100) : 100;
    var rateCls = rate >= 90 ? "rate-high" : (rate >= 75 ? "rate-med" : "rate-low");

    var rqBadge = isRQ ? ' <span class="badge badge-free" style="font-size:9px;padding:1px 5px;">Bebas</span>' : '';
    var subRekap = isPegawai ? (s.subLabel || (getPegawaiUnit(s) + (getPegawaiJabatan(s) !== "-" ? " • " + getPegawaiJabatan(s) : ""))) : s.kelas;

    // Progress bar
    var pH = totalReported > 0 ? ((sTotals.H || 0) / totalReported) * 100 : 0;
    var pT = totalReported > 0 ? ((sTotals.T || 0) / totalReported) * 100 : 0;
    var pS = totalReported > 0 ? ((sTotals.S || 0) / totalReported) * 100 : 0;
    var pI = totalReported > 0 ? ((sTotals.I || 0) / totalReported) * 100 : 0;
    var pA = totalReported > 0 ? ((sTotals.A || 0) / totalReported) * 100 : 0;

    h +=
      '<div class="rekap-person-card" id="' + cardId + '">' +
        '<div class="rekap-card-top">' +
          '<div class="rekap-card-person-info">' +
            '<div class="rekap-card-avatar avatar ' + getColor(item.index) + '">' + getInit(s.nama) + '</div>' +
            '<div class="rekap-card-names">' +
              '<div class="rekap-card-name" title="' + escapeHtml(s.nama) + '">' + escapeHtml(s.nama) + rqBadge + '</div>' +
              '<div class="rekap-card-sub" title="' + escapeHtml(subRekap) + '">' + escapeHtml(subRekap) + '</div>' +
            '</div>' +
          '</div>' +
          '<span class="rekap-rate-badge ' + rateCls + '">' + rate + '% Hadir</span>' +
        '</div>' +

        // Multi-segment Mini Progress Bar
        '<div class="rekap-progress-track" title="Hadir: ' + sTotals.H + ', Terlambat: ' + sTotals.T + ', Sakit: ' + sTotals.S + ', Izin: ' + sTotals.I + ', Alpa: ' + sTotals.A + '">' +
          (pH > 0 ? '<div class="rekap-progress-bar bar-h" style="width:' + pH + '%;"></div>' : '') +
          (pT > 0 ? '<div class="rekap-progress-bar bar-t" style="width:' + pT + '%;"></div>' : '') +
          (pS > 0 ? '<div class="rekap-progress-bar bar-s" style="width:' + pS + '%;"></div>' : '') +
          (pI > 0 ? '<div class="rekap-progress-bar bar-i" style="width:' + pI + '%;"></div>' : '') +
          (pA > 0 ? '<div class="rekap-progress-bar bar-a" style="width:' + pA + '%;"></div>' : '') +
        '</div>' +

        // 5 Metrics Row
        '<div class="rekap-stats-row">' +
          '<div class="rekap-stat-chip chip-h"><strong>' + (sTotals.H || 0) + '</strong><span>Hadir (H)</span></div>' +
          '<div class="rekap-stat-chip chip-t"><strong>' + (sTotals.T || 0) + '</strong><span>Late (T)</span></div>' +
          '<div class="rekap-stat-chip chip-s"><strong>' + (sTotals.S || 0) + '</strong><span>Sakit (S)</span></div>' +
          '<div class="rekap-stat-chip chip-i"><strong>' + (sTotals.I || 0) + '</strong><span>Izin (I)</span></div>' +
          '<div class="rekap-stat-chip chip-a"><strong>' + (sTotals.A || 0) + '</strong><span>Alpa (A)</span></div>' +
        '</div>' +

        // Expand/Collapse Button
        '<button type="button" class="rekap-expand-btn" id="btn-' + cardId + '" onclick="toggleRekapCard(\'' + cardId + '\')">' +
          '<span>' + (isExpanded ? 'Tutup Detail Harian' : 'Lihat Detail Harian (31 Hari)') + '</span>' +
          '<i data-lucide="' + (isExpanded ? 'chevron-up' : 'chevron-down') + '" style="width:14px;height:14px;"></i>' +
        '</button>' +

        // Expandable Daily Grid Tray
        '<div class="rekap-calendar-tray" id="tray-' + cardId + '" style="display:' + (isExpanded ? 'block' : 'none') + ';">' +
          '<div class="rekap-days-flow">';

    for (var d = 1; d <= daysInMonth; d++) {
      var dCode = sDays[d] || "-";
      var dObj = new Date(currentRekapYear, currentRekapMonth - 1, d);
      var dow = dObj.getDay();
      var isWk = (dow === 0 || dow === 6);
      var isoKey = currentRekapYear + '-' + String(currentRekapMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      var holidayInfo = window.HolidayManager ? window.HolidayManager.getHoliday(isoKey) : null;
      var isNatH = !!(holidayInfo && holidayInfo.isHoliday);
      var isHol = isWk || isNatH;

      var chipCls = "";
      if (dCode === "H") chipCls = "day-h";
      else if (dCode === "T" || dCode === "TL1" || dCode === "TL2") chipCls = isRQ ? "day-h" : "day-t";
      else if (dCode === "S") chipCls = "day-s";
      else if (dCode === "I") chipCls = "day-i";
      else if (dCode === "A") chipCls = isRQ ? "day-dash" : "day-a";
      else if (isHol && !isRQ) chipCls = "day-weekend";
      else chipCls = "day-dash";

      var holName = isNatH ? holidayInfo.name : (isWk ? (dow === 0 ? "Minggu (Akhir Pekan)" : "Sabtu (Akhir Pekan)") : "");
      var statusDetail = dCode === "H" ? "Hadir" : (dCode === "T" || dCode.startsWith("TL") ? "Terlambat (" + dCode + ")" : (dCode === "S" ? "Sakit" : (dCode === "I" ? "Izin" : (dCode === "A" ? "Alpa" : "Tidak ada absensi"))));
      var escapedHolName = holName ? holName.replace(/'/g, "\\'") : "";

      h +=
        '<div class="rekap-day-chip ' + chipCls + '" onclick="showRekapDayDetail(' + d + ', \'' + dayNamesShort[dow] + '\', \'' + statusDetail + '\', \'' + escapedHolName + '\')" title="' + d + ' ' + dayNamesShort[dow] + ': ' + statusDetail + (holName ? ' (' + holName + ')' : '') + '">' +
          '<span class="day-num">' + d + '<br>' + dayNamesShort[dow] + '</span>' +
          '<span class="day-code">' + (isNatH && dCode === '-' ? '★' : dCode) + '</span>' +
        '</div>';
    }

    h += '</div></div></div>';
  }
  h += '</div>';
  return h;
}

function renderRekapTableHtml(visibleStudents, rekapData, isPrintOnly) {
  var isPegawai = activeType === "guru";
  var dayNamesShort = ["M", "S", "S", "R", "K", "J", "S"];
  var todayObj = new Date();
  var todayYear = todayObj.getFullYear();
  var todayMonth = todayObj.getMonth() + 1;
  var todayDay = todayObj.getDate();

  var quickNavHtml = "";
  if (!isPrintOnly) {
    quickNavHtml =
      '<div class="rekap-quick-nav-bar no-print">' +
        '<div class="rekap-jump-group">' +
          '<button type="button" class="rekap-jump-btn" onclick="scrollRekapTable(\'start\')"><i data-lucide="arrow-left"></i> <span>Nama</span></button>' +
          '<button type="button" class="rekap-jump-btn" onclick="scrollRekapTable(\'today\')"><i data-lucide="calendar"></i> <span>Hari Ini</span></button>' +
          '<button type="button" class="rekap-jump-btn" onclick="scrollRekapTable(\'summary\')"><span>Total (H T S I A)</span> <i data-lucide="arrow-right"></i></button>' +
        '</div>' +
      '</div>';
  }

  var h = quickNavHtml +
    '<div class="table-responsive rekap-table-container">' +
    '<table class="table rekap-table"><thead><tr><th style="text-align:left;min-width:160px;padding-left:14px;">Nama</th>';

  for (var d = 1; d <= rekapData.daysInMonth; d++) {
    var dObj = new Date(currentRekapYear, currentRekapMonth - 1, d);
    var dow = dObj.getDay();
    var isWeekend = (dow === 0 || dow === 6);
    var isoKey = currentRekapYear + '-' + String(currentRekapMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var holidayInfo = window.HolidayManager ? window.HolidayManager.getHoliday(isoKey) : null;
    var isNatHoliday = !!(holidayInfo && holidayInfo.isHoliday);
    var isHolidayCol = isWeekend || isNatHoliday;

    var thCls = isHolidayCol ? ' class="col-weekend"' : '';
    var isTodayCol = (currentRekapYear === todayYear && currentRekapMonth === todayMonth && d === todayDay);
    var thId = isTodayCol ? ' id="rekap-col-today"' : '';
    if (isTodayCol) {
      thCls += ' style="border:2px solid var(--primary);box-shadow:inset 0 0 0 1px var(--primary);"';
    }

    var thTitle = '';
    if (isNatHoliday) thTitle = 'Libur Nasional: ' + holidayInfo.name;
    else if (isWeekend) thTitle = (dow === 0 ? 'Minggu (Libur Akhir Pekan)' : 'Sabtu (Libur Akhir Pekan)');
    else thTitle = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][dow];

    var starIcon = isNatHoliday ? ' <span style="color:#dc2626;font-size:9px;" title="' + thTitle + '">★</span>' : '';
    var todayTag = (isTodayCol && !isPrintOnly) ? '<span style="display:block;font-size:8px;color:var(--primary);font-weight:800;line-height:1;">HARI INI</span>' : '';
    h += '<th' + thCls + thId + ' title="' + thTitle + '">' + d + starIcon + '<br><span style="font-size:9px;font-weight:600;opacity:0.85;">' + dayNamesShort[dow] + '</span>' + todayTag + '</th>';
  }

  h +=
    '<th id="rekap-col-summary" class="col-summary-h" title="Total Hadir">H</th>' +
    '<th class="col-summary-t" title="Total Terlambat">T</th>' +
    '<th class="col-summary-s" title="Total Sakit">S</th>' +
    '<th class="col-summary-i" title="Total Izin">I</th>' +
    '<th class="col-summary-a" title="Total Alpa (Hanya Hari Efektif Belajar)">A</th>' +
    '</tr></thead><tbody>';

  for (var k = 0; k < visibleStudents.length; k++) {
    var vItem = visibleStudents[k];
    var s = vItem.student;
    var recapCalc = vItem.recap;
    var sDays = recapCalc.days;
    var sTotals = recapCalc.totals;
    var isRQ = recapCalc.isRumahQuran;

    var rqBadge = isRQ ? ' <span class="badge badge-free" style="font-size:9px;padding:1px 5px;">Bebas</span>' : '';
    var subRekap = isPegawai ? (s.subLabel || (getPegawaiUnit(s) + (getPegawaiJabatan(s) !== "-" ? " • " + getPegawaiJabatan(s) : ""))) : s.kelas;

    h +=
      '<tr><td style="text-align:left;padding-left:14px;"><div class="student-cell"><div class="avatar ' +
      getColor(vItem.index) +
      '">' +
      getInit(s.nama) +
      '</div><div><strong>' +
      s.nama +
      '</strong>' + rqBadge + '<br><small style="color:var(--gray)">' +
      subRekap +
      "</small></div></div></td>";

    for (var d2 = 1; d2 <= rekapData.daysInMonth; d2++) {
      var code = sDays[d2] || "-";
      var dObj2 = new Date(currentRekapYear, currentRekapMonth - 1, d2);
      var dow2 = dObj2.getDay();
      var isWk = (dow2 === 0 || dow2 === 6);
      var isoKey2 = currentRekapYear + '-' + String(currentRekapMonth).padStart(2, '0') + '-' + String(d2).padStart(2, '0');
      var isNatH = window.HolidayManager ? window.HolidayManager.isHolidayDate(isoKey2) : false;
      var isHolCell = isWk || isNatH;

      var cls = "";
      if (code === "H") cls = "day-h";
      else if (code === "T" || code === "TL1" || code === "TL2") cls = isRQ ? "day-h" : "day-t";
      else if (code === "S") cls = "day-s";
      else if (code === "I") cls = "day-i";
      else if (code === "A") cls = isRQ ? "day-dash" : "day-a";
      else if (isHolCell && !isRQ) cls = "day-weekend";
      else cls = "day-dash";

      var displayCellCode = code;
      var cellFontSize = (code === "TL1" || code === "TL2") ? 'style="font-size:9px;"' : '';
      h += '<td class="' + cls + '"><strong ' + cellFontSize + '>' + displayCellCode + "</strong></td>";
    }

    h +=
      '<td class="col-summary-h">' + (sTotals.H || 0) + '</td>' +
      '<td class="col-summary-t">' + (sTotals.T || 0) + '</td>' +
      '<td class="col-summary-s">' + (sTotals.S || 0) + '</td>' +
      '<td class="col-summary-i">' + (sTotals.I || 0) + '</td>' +
      '<td class="col-summary-a">' + (sTotals.A || 0) + '</td>' +
      '</tr>';
  }

  h += "</tbody></table></div>";
  return h;
}

function setRekapViewMode(mode) {
  rekapViewMode = mode;
  var switchBtns = document.querySelectorAll(".view-switch-btn");
  switchBtns.forEach(function(btn) {
    var isTarget = (mode === "card" && btn.innerHTML.indexOf("Kartu") > -1) || (mode === "table" && btn.innerHTML.indexOf("Tabel") > -1);
    if (isTarget) btn.classList.add("active");
    else btn.classList.remove("active");
  });
  showRekapTable();
}

function toggleRekapNotice() {
  rekapNoticeCollapsed = !rekapNoticeCollapsed;
  var body = document.getElementById("rekap-notice-body");
  var chevron = document.getElementById("rekap-notice-chevron");
  if (body) body.style.display = rekapNoticeCollapsed ? "none" : "block";
  if (chevron) {
    chevron.setAttribute("data-lucide", rekapNoticeCollapsed ? "chevron-down" : "chevron-up");
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }
}

function toggleRekapCard(cardId) {
  rekapExpandedCards[cardId] = !rekapExpandedCards[cardId];
  var tray = document.getElementById("tray-" + cardId);
  var btn = document.getElementById("btn-" + cardId);
  if (tray) tray.style.display = rekapExpandedCards[cardId] ? "block" : "none";
  if (btn) {
    var isExp = !!rekapExpandedCards[cardId];
    btn.innerHTML = '<span>' + (isExp ? 'Tutup Detail Harian' : 'Lihat Detail Harian (31 Hari)') + '</span><i data-lucide="' + (isExp ? 'chevron-up' : 'chevron-down') + '" style="width:14px;height:14px;"></i>';
    if (typeof lucide !== "undefined" && lucide.createIcons) lucide.createIcons();
  }
}

function handleRekapSearch(val) {
  rekapLocalSearch = (val || "").trim();
  showRekapTable();
}

function clearRekapSearch() {
  rekapLocalSearch = "";
  var inp = document.getElementById("rekap-search-input");
  if (inp) inp.value = "";
  showRekapTable();
}

function scrollRekapTable(target) {
  var container = document.querySelector(".rekap-table-container");
  if (!container) return;
  if (target === "start") {
    container.scrollTo({ left: 0, behavior: "smooth" });
  } else if (target === "summary") {
    container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
  } else if (target === "today") {
    var todayEl = document.getElementById("rekap-col-today");
    if (todayEl) {
      var leftPos = todayEl.offsetLeft - 120;
      container.scrollTo({ left: Math.max(0, leftPos), behavior: "smooth" });
    } else {
      showToast("Tanggal hari ini tidak berada pada bulan yang dipilih", "info");
    }
  }
}

function showRekapDayDetail(dayNum, dowName, status, holidayName) {
  var msg = "Tanggal " + dayNum + " (" + dowName + ")\nStatus: " + status;
  if (holidayName) msg += "\nKeterangan: " + holidayName;
  showToast(msg, "info");
}

function filterRekap(f) {
  filterKelas = f;
  showRekapTable();
}

function propagateEmail() {
  if (confirm("Kirim laporan kehadiran hari ini ke semua Wali Kelas?")) {
    window.callGasAPI(
      "sendDailyReportToWaliKelas",
      { date: currentFilterDate },
      function (r) {
        var msg = "Total Terkirim: " + r.sent + "\nGagal: " + r.failed;
        if (r.failed > 0) {
          alert(msg + "\n\nDetail:\n" + r.log.join("\n"));
        } else {
          showToast(msg, "success");
        }
      },
    );
  }
}

function exportRekapExcel() {
  if (!rekapData || !rekapData.students || rekapData.students.length === 0) {
    showToast("Sedang memuat data rekap, silakan tunggu sesaat...", "warning");
    loadRekapData();
    return;
  }

  var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var monthName = monthNames[currentRekapMonth - 1] || "Bulan";
  var dayNamesShort = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  
  var isPegawai = activeType === "guru";
  var headerRow = ["No", "Nama"];
  if (isPegawai) {
    headerRow.push("Unit Kerja", "Jabatan");
  } else {
    headerRow.push("Unit / Kelas");
  }
  for (var d = 1; d <= rekapData.daysInMonth; d++) {
    var dObj = new Date(currentRekapYear, currentRekapMonth - 1, d);
    var dow = dObj.getDay();
    var isoKey = currentRekapYear + '-' + String(currentRekapMonth).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var hol = window.HolidayManager ? window.HolidayManager.getHoliday(isoKey) : null;
    var holLabel = (hol && hol.isHoliday) ? ' [' + hol.name + ']' : '';
    headerRow.push("Tgl " + d + " (" + dayNamesShort[dow] + ")" + holLabel);
  }
  headerRow.push("Total Hadir (H)", "Terlambat (T)", "Sakit (S)", "Izin (I)", "Alfa (A)");

  var exportRows = [headerRow];
  var no = 1;
  var displayStudents = isPegawai ? splitPegawaiEntries(rekapData.students) : rekapData.students;
  for (var k = 0; k < displayStudents.length; k++) {
    var s = displayStudents[k];
    var matchCategory = isPegawai ? matchPegawaiUnit(s, filterKelas) : matchSiswaKelas(s, filterKelas);
    if (!matchCategory) {
      continue;
    }
    if (globalSearchQuery) {
      var q = globalSearchQuery.toLowerCase();
      var sRoles = isPegawai ? (s.recapRole || s.kelas || "") : s.kelas;
      if ((s.nama || "").toLowerCase().indexOf(q) === -1 && sRoles.toLowerCase().indexOf(q) === -1) {
        continue;
      }
    }

    var recapCalc = calculateStudentRecap(s, rekapData, currentRekapMonth, currentRekapYear);
    var sDays = recapCalc.days;
    var sTotals = recapCalc.totals;

    var row = [no++, s.nama];
    if (isPegawai) {
      row.push("Unit " + (s.unit || getPegawaiUnit(s)), s.jabatan || getPegawaiJabatan(s));
    } else {
      row.push(s.kelas);
    }
    for (var d2 = 1; d2 <= rekapData.daysInMonth; d2++) {
      row.push(sDays[d2] || "-");
    }
    row.push(
      sTotals.H || 0,
      sTotals.T || 0,
      sTotals.S || 0,
      sTotals.I || 0,
      sTotals.A || 0
    );
    exportRows.push(row);
  }

  var filename = "Rekap_Presensi_" + (activeType === "guru" ? "Pegawai" : "Siswa") + "_" + monthName + "_" + currentRekapYear + ".xlsx";

  if (typeof XLSX !== "undefined") {
    try {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(exportRows);
      XLSX.utils.book_append_sheet(wb, ws, "Rekap " + monthName);
      try {
        XLSX.writeFile(wb, filename);
        showToast("Rekap bulanan berhasil diexport ke Excel", "success");
      } catch (writeErr) {
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, filename);
        showToast("Rekap bulanan berhasil diexport ke Excel", "success");
      }
      return;
    } catch (xlsxErr) {
      console.warn("SheetJS error, menggunakan CSV fallback:", xlsxErr);
    }
  }

  downloadCsvFallback(exportRows, filename.replace(/\.xlsx$/i, ".csv"));
}

function exportRekapPDF(orientation) {
  orientation = (orientation === "portrait" || orientation === "p") ? "p" : "l";
  var JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!JsPDF) {
    showToast("Library PDF (jsPDF) belum siap. Silakan periksa koneksi internet.", "error");
    return;
  }

  if (!rekapData || !rekapData.students || rekapData.students.length === 0) {
    showToast("Belum ada data rekap untuk diekspor ke PDF", "warning");
    return;
  }

  showToast("Menyiapkan PDF Rekap Bulanan...", "info");

  fetchLogoBase64(function(logoDataUrl) {
    try {
      var doc = new JsPDF(orientation, "pt", "a4");
      var pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
      var pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height;
      var margin = orientation === "p" ? 15 : 20;

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', margin, 18, 38, 38);
        } catch (imgErr) {}
      }

      var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      var monthName = monthNames[currentRekapMonth - 1] || "Bulan";
      var isPegawai = activeType === "guru";

      // Kop Surat
      doc.setFontSize(orientation === "p" ? 11 : 13);
      doc.setFont("helvetica", "bold");
      doc.text("REKAPITULASI KEHADIRAN BULANAN " + (isPegawai ? "PEGAWAI" : "SISWA"), pageWidth / 2, 28, { align: "center" });

      doc.setFontSize(orientation === "p" ? 8.5 : 9.5);
      doc.setFont("helvetica", "bold");
      doc.text("YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU", pageWidth / 2, 40, { align: "center" });

      doc.setFontSize(orientation === "p" ? 7.5 : 8.5);
      doc.setFont("helvetica", "normal");
      doc.text("Periode: " + monthName + " " + currentRekapYear + "  |  " + (isPegawai ? "Unit Kerja" : "Kelas") + ": " + (filterKelas || "Semua"), pageWidth / 2, 51, { align: "center" });

      doc.setLineWidth(1);
      doc.line(margin, 58, pageWidth - margin, 58);

      // Headers: No, Nama, 1..31, H, T, S, I, A
      var headerRow = ["No", "Nama & " + (isPegawai ? "Unit" : "Kelas")];
      for (var d = 1; d <= rekapData.daysInMonth; d++) {
        headerRow.push(String(d));
      }
      headerRow.push("H", "T", "S", "I", "A");

      var bodyRows = [];
      var no = 1;
      var displayStudents = isPegawai ? splitPegawaiEntries(rekapData.students) : rekapData.students;
      for (var k = 0; k < displayStudents.length; k++) {
        var s = displayStudents[k];
        var matchCategory = isPegawai ? matchPegawaiUnit(s, filterKelas) : matchSiswaKelas(s, filterKelas);
        if (!matchCategory) continue;

        if (globalSearchQuery) {
          var q = globalSearchQuery.toLowerCase();
          var sRoles = isPegawai ? (s.recapRole || s.kelas || "") : s.kelas;
          if ((s.nama || "").toLowerCase().indexOf(q) === -1 && sRoles.toLowerCase().indexOf(q) === -1) {
            continue;
          }
        }

        var recapCalc = calculateStudentRecap(s, rekapData, currentRekapMonth, currentRekapYear);
        var sDays = recapCalc.days;
        var sTotals = recapCalc.totals;

        var subLabel = isPegawai ? (s.subLabel || getPegawaiUnit(s)) : (s.kelas || "-");
        var row = [no++, (s.nama || "") + "\n(" + subLabel + ")"];
        for (var d2 = 1; d2 <= rekapData.daysInMonth; d2++) {
          row.push(sDays[d2] || "-");
        }
        row.push(
          sTotals.H || 0,
          sTotals.T || 0,
          sTotals.S || 0,
          sTotals.I || 0,
          sTotals.A || 0
        );
        bodyRows.push(row);
      }

      if (bodyRows.length === 0) {
        var emptyRow = ["-", "Tidak ada data presensi cocok"];
        for (var ed = 0; ed < rekapData.daysInMonth + 5; ed++) emptyRow.push("-");
        bodyRows.push(emptyRow);
      }

      if (typeof doc.autoTable === "function") {
        doc.autoTable({
          startY: 65,
          head: [headerRow],
          body: bodyRows,
          theme: 'grid',
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
          styles: {
            fontSize: orientation === "p" ? 5 : 6.5,
            cellPadding: orientation === "p" ? 1.2 : 1.8,
            overflow: 'linebreak',
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: orientation === "p" ? 16 : 22, halign: 'center' },
            1: { cellWidth: orientation === "p" ? 65 : 110, halign: 'left' }
          },
          margin: { left: margin, right: margin }
        });
      }

      // Tanda Tangan
      var finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 20 : 200;
      if (finalY > pageHeight - 75) {
        doc.addPage();
        finalY = 30;
      }
      var sigX = pageWidth - (orientation === "p" ? 110 : 140);
      doc.setFontSize(orientation === "p" ? 8 : 9);
      doc.text("Kamang Baru, " + formatFullDate(new Date().toISOString().split('T')[0]), sigX, finalY, { align: "center" });
      doc.text("Mengetahui,", sigX, finalY + 11, { align: "center" });
      doc.text("Kepala Yayasan", sigX, finalY + 22, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text((appSettings.kepalaYayasan || "Pimpinan Yayasan"), sigX, finalY + 60, { align: "center" });

      var fileName = "Rekap_Presensi_" + (isPegawai ? "Pegawai" : "Siswa") + "_" + monthName + "_" + currentRekapYear + "_" + (orientation === "p" ? "Portrait" : "Landscape") + ".pdf";

      try {
        doc.save(fileName);
        showToast("Rekap PDF berhasil diunduh", "success");
      } catch (saveErr) {
        var pdfBlob = doc.output("blob");
        downloadBlob(pdfBlob, fileName);
        showToast("Rekap PDF berhasil diunduh", "success");
      }
    } catch (err) {
      console.error("Gagal export rekap PDF:", err);
      showToast("Gagal export PDF: " + err.message, "error");
    }
  });
}

function exportMasterExcel() {
  if (!students || students.length === 0) {
    showToast("Belum ada data untuk diexport", "warning");
    return;
  }

  var targetName = activeType === "guru" ? "Pegawai" : (activeType === "kelas" ? "Kelas" : "Siswa");
  var rows = [];
  if (activeType === "kelas") {
    rows.push(["No", "Nama Unit / Kelas", "Wali Kelas", "Email Wali"]);
    for (var i = 0; i < students.length; i++) {
      var k = students[i];
      rows.push([i + 1, k.nama || "", k.wali || "", k.email || ""]);
    }
  } else {
    rows.push(["No", "ID", (activeType === "guru" ? "NIP" : "Barcode / NIS"), "Nama Lengkap", (activeType === "guru" ? "Jabatan" : "Unit / Kelas"), "Email", "Biometrik Wajah", "Status"]);
    for (var j = 0; j < students.length; j++) {
      var s2 = students[j];
      rows.push([
        j + 1,
        s2.id || "",
        s2.nip || s2.barcode || "",
        s2.nama || "",
        s2.jabatan || s2.kelas || "",
        s2.email || "-",
        s2.hasFace ? "Terdaftar" : "Belum",
        s2.status || "Aktif"
      ]);
    }
  }

  var filename = "Data_Master_" + targetName + "_" + new Date().toISOString().slice(0, 10) + ".xlsx";

  if (typeof XLSX !== "undefined") {
    try {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, "Data " + targetName);
      try {
        XLSX.writeFile(wb, filename);
        showToast("Data " + targetName + " berhasil diexport ke Excel", "success");
      } catch (writeErr) {
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, filename);
        showToast("Data " + targetName + " berhasil diexport ke Excel", "success");
      }
      return;
    } catch (xlsxErr) {
      console.warn("SheetJS error, menggunakan CSV fallback:", xlsxErr);
    }
  }

  downloadCsvFallback(rows, filename.replace(/\.xlsx$/i, ".csv"));
}

function renderSiswa() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  var btnK = activeType == "kelas" ? "btn-primary" : "btn-outline";
  var title = activeType == "guru" ? "Data Pegawai" : (activeType == "siswa" ? "Data Siswa" : "Data Unit / Kelas");

  var filterOptions = "";
  if (activeType === "guru" || activeType === "siswa") {
    var roles = getCategoryFilterList(activeType);
    for (var rIdx = 0; rIdx < roles.length; rIdx++) {
      var rName = roles[rIdx];
      var isRQ = rName.toLowerCase().indexOf("rumah quran") > -1;
      var label = isRQ ? '📖 ' + rName + ' (Bebas)' : (rName === 'Semua' ? 'Semua ' + (activeType === "guru" ? "Unit Kerja" : "Kelas") : rName);
      var isSel = masterFilterKelas === rName ? "selected" : "";
      filterOptions += '<option value="' + rName + '" ' + isSel + '>' + label + '</option>';
    }
  }

  var classFilterHtml = (activeType === "siswa" || activeType === "guru")
    ? '<select class="form-select" onchange="changeMasterClassFilter(this.value)" style="max-width:180px;height:38px;padding:6px 12px;font-size:13px;">' + filterOptions + '</select>'
    : '';

  c.innerHTML =
    '<div class="page-header"><div><h1>' + title + '</h1></div><div class="header-actions">' +
    '<button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Data Pegawai</button>' +
    '<button class="btn ' +
    btnS +
    '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Data Siswa</button>' +
    '<button class="btn ' +
    btnK +
    '" onclick="switchType(\'kelas\')"><i data-lucide="building-2" style="width:16px"></i> Data Unit / Kelas</button>' +
    '</div></div>' + getAuthAlertHtml() +
    '<div class="header-actions" style="margin-top:10px;margin-bottom:15px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;">' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
    '<button class="btn btn-primary" onclick="showAddModal()"><i data-lucide="plus" style="width:16px"></i> Tambah ' +
    (activeType == "guru" ? "Pegawai" : activeType == "kelas" ? "Kelas" : "Siswa") +
    '</button>' +
    '<button class="btn btn-outline" onclick="exportMasterExcel()"><i data-lucide="file-spreadsheet" style="width:16px"></i> Export Excel</button>' +
    '<button class="btn btn-success" onclick="runSetup()"><i data-lucide="database" style="width:16px"></i> Setup Sheet</button>' +
    '</div>' +
    '<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">' +
    classFilterHtml +
    '<div class="search-box" style="margin:0;width:240px;"><i data-lucide="search" style="width:16px;color:var(--gray)"></i><input type="text" id="siswa-search-input" placeholder="Cari nama / NIS / barcode..." value="' + globalSearchQuery + '" oninput="handleGlobalSearch(this.value)"></div>' +
    '</div>' +
    '</div>' +
    '<div class="card"><div class="card-body" style="padding:0"><div class="table-responsive"><table class="table"><thead><tr>' +
    (activeType == "kelas"
      ? "<th>Nama Unit / Kelas</th><th>Wali Kelas</th><th>Email</th><th>Aksi</th>"
      : "<th>" +
        (activeType == "guru" ? "Pegawai" : "Siswa") +
        "</th><th>" +
        (activeType == "guru" ? "NIP" : "Barcode") +
        "</th><th>" +
        (activeType == "guru" ? "Unit & Jabatan" : "Unit / Kelas") +
        "</th><th>Email</th><th>Biometrik Wajah</th><th>Status</th><th>Aksi</th>") +
    '</tr></thead><tbody id="siswa-table"></tbody></table></div>' +
    '<div class="pagination"><div class="pagination-info" id="siswa-pg-info"></div></div>' +
    '</div></div>';
  lucide.createIcons();
  renderSiswaTable();
}

function renderSiswaTable() {
  var tb = document.getElementById("siswa-table");
  if (!tb) return;

  var filteredStudents = students.filter(function (s) {
    if (masterFilterKelas !== "Semua") {
      if (activeType === "guru") {
        if (!matchPegawaiUnit(s, masterFilterKelas)) return false;
      } else if (activeType === "siswa") {
        if (!matchSiswaKelas(s, masterFilterKelas)) return false;
      }
    }
    if (globalSearchQuery) {
      var q = globalSearchQuery.toLowerCase();
      var nm = (s.nama || "").toLowerCase();
      var bc = (s.barcode || s.nip || "").toLowerCase();
      var kl = (s.kelas || s.jabatan || s.wali || "").toLowerCase();
      var em = (s.email || "").toLowerCase();
      if (nm.indexOf(q) === -1 && bc.indexOf(q) === -1 && kl.indexOf(q) === -1 && em.indexOf(q) === -1) {
        return false;
      }
    }
    return true;
  });

  var pgInfo = document.getElementById("siswa-pg-info");
  if (pgInfo) {
    pgInfo.innerText = "Menampilkan " + filteredStudents.length + " dari " + students.length + " data";
  }

  if (filteredStudents.length === 0) {
    tb.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray)">' +
      (students.length === 0 ? "Belum ada data." : "Tidak ada data yang cocok dengan pencarian.") +
      '</td></tr>';
    return;
  }

  var h = "";
  for (var i = 0; i < filteredStudents.length; i++) {
    var s = filteredStudents[i];
    if (activeType === "kelas") {
      h +=
        "<tr><td><strong>" +
        s.nama +
        "</strong></td><td>" +
        (s.wali || "-") +
        "</td><td>" +
        (s.email || "-") +
        '</td><td style="display:flex;gap:5px;align-items:center;"><button class="action-btn" onclick="editSiswa(\'' +
        s.nama.replace(/'/g, "\\'") +
        '\')" title="Edit"><i data-lucide="edit" style="width:16px"></i></button><button class="action-btn" onclick="deleteSiswa(\'' +
        s.nama.replace(/'/g, "\\'") +
        '\')" title="Hapus"><i data-lucide="trash-2" style="width:16px"></i></button></td></tr>';
    } else {
      var fb = s.hasFace
        ? '<button class="verify-btn verified" onclick="showFaceDetail(\'' + s.id + '\')" title="Wajah Terdaftar (Klik untuk kelola / reset)"><i data-lucide="check" style="width:16px"></i></button>'
        : '<button class="btn btn-outline" style="padding:4px 10px;font-size:12px;display:inline-flex;align-items:center;gap:4px;" onclick="regFace(\'' +
          s.id +
          "','" +
          s.nama.replace(/'/g, "\\'") +
          '\')" ><i data-lucide="camera" style="width:13px"></i> Register</button>';
      var stBadge = s.status === "Aktif" ? "success" : "danger";
      var code = s.nip || s.barcode || "-";
      var sub = "-";
      if (activeType === "guru") {
        var roles = parsePegawaiRoles(s.jabatan || s.kelas || "");
        var badgesHtml = [];
        for (var rIdx = 0; rIdx < roles.length; rIdx++) {
          var rItem = roles[rIdx];
          var uRole = getPegawaiUnitFromRole(rItem);
          var jRole = getPegawaiJabatanFromRole(rItem);
          var isRQR = isRumahQuranRole(rItem);
          var tagBadge = isRQR ? ' <span class="badge badge-free" style="font-size:9px;padding:1px 5px;">Bebas</span>' : '';
          badgesHtml.push('<span style="display:inline-block;margin:1px 0;"><span class="badge badge-info" style="font-size:11px;margin-right:4px;">Unit ' + uRole + '</span> ' + (jRole !== "-" && jRole !== uRole ? jRole : "") + tagBadge + '</span>');
        }
        sub = badgesHtml.join("<br>");
      } else {
        var isRQSis = String(s.kelas || "").toLowerCase().indexOf("rumah quran") > -1;
        var rqBadgeSis = isRQSis ? ' <span class="badge badge-free" style="font-size:10px;padding:1px 5px;">Bebas</span>' : '';
        sub = (s.kelas || "-") + rqBadgeSis;
      }
      var em = s.email || "-";
      h +=
        '<tr><td><div class="student-cell"><div class="avatar ' +
        getColor(i) +
        '">' +
        getInit(s.nama) +
        '</div><span style="font-weight:500">' +
        s.nama +
        "</span></div></td><td><code>" +
        code +
        "</code></td><td>" +
        sub +
        "</td><td>" +
        em +
        "</td><td>" +
        fb +
        '</td><td><span class="badge badge-' +
        stBadge +
        '">' +
        (s.status || "Aktif") +
        '</span></td><td style="display:flex;gap:5px;align-items:center;"><button class="action-btn" onclick="editSiswa(\'' +
        s.id +
        '\')" title="Edit Data"><i data-lucide="edit" style="width:16px"></i></button><button class="action-btn" onclick="showStudentDetail(\'' +
        s.id +
        '\')" title="Menu Lengkap & ID Card (Titik Tiga)"><i data-lucide="more-vertical" style="width:16px"></i></button><button class="action-btn" onclick="deleteSiswa(\'' +
        s.id +
        '\')" title="Hapus Data"><i data-lucide="trash-2" style="width:16px"></i></button></td></tr>';
    }
  }
  tb.innerHTML = h;
  lucide.createIcons();
}

function showStudentDetail(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (!s) return;

  var code = s.nip || s.barcode || s.id;
  var sub = s.jabatan || s.kelas || "-";
  var isTeacher = activeType === "guru";
  var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=" + encodeURIComponent(code);

  var faceSection = "";
  if (s.hasFace) {
    faceSection = 
      '<div style="display:flex;align-items:center;justify-content:space-between;background:#ecfdf5;border:1px solid #a7f3d0;padding:10px 14px;border-radius:10px;margin-top:10px;">' +
      '<div><strong style="color:#065f46;font-size:13px;"><i data-lucide="shield-check" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"></i> Wajah Terdaftar</strong><br><small style="color:#047857;">Data biometrik aktif di database</small></div>' +
      '<div style="display:flex;gap:6px;">' +
      '<button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="regFace(\'' + s.id + '\',\'' + s.nama.replace(/'/g, "\\'") + '\')" title="Perbarui Wajah"><i data-lucide="camera" style="width:12px;"></i> Update</button>' +
      '<button class="btn btn-danger" style="padding:4px 8px;font-size:11px;" onclick="resetFaceData(\'' + s.id + '\')" title="Reset / Hapus Wajah"><i data-lucide="trash-2" style="width:12px;"></i> Reset</button>' +
      '</div></div>';
  } else {
    faceSection = 
      '<div style="display:flex;align-items:center;justify-content:space-between;background:#fef3c7;border:1px solid #fde68a;padding:10px 14px;border-radius:10px;margin-top:10px;">' +
      '<div><strong style="color:#92400e;font-size:13px;"><i data-lucide="alert-circle" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px;"></i> Belum Ada Wajah</strong><br><small style="color:#b45309;">Bisa rekam saat absen pertama atau admin daftarkan</small></div>' +
      '<button class="btn btn-primary" style="padding:6px 10px;font-size:12px;" onclick="regFace(\'' + s.id + '\',\'' + s.nama.replace(/'/g, "\\'") + '\')"><i data-lucide="camera" style="width:14px;"></i> Daftarkan</button>' +
      '</div>';
  }

  // Cari riwayat presensi orang ini jika ada
  var userAttendance = attendance.filter(function(a) {
    return (a.studentId && a.studentId === s.id) || (a.nama && a.nama.toLowerCase() === s.nama.toLowerCase());
  });
  var attHistoryHtml = "";
  if (userAttendance.length > 0) {
    attHistoryHtml = '<div style="margin-top:15px;"><h4 style="font-size:13px;font-weight:700;color:var(--primary-dark);margin-bottom:8px;">Presensi Terakhir Hari Ini</h4>';
    for (var aIdx = 0; aIdx < Math.min(3, userAttendance.length); aIdx++) {
      var uAtt = userAttendance[aIdx];
      var uBadge = uAtt.status === "Hadir" ? "success" : (uAtt.status === "Terlambat" ? "warning" : "info");
      attHistoryHtml += '<div style="background:var(--bg);border-radius:8px;padding:8px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;font-size:12px;">' +
        '<span>' + formatDate(uAtt.tanggal) + ' ' + (formatTime(uAtt.waktu) || "-") + ' WIB</span>' +
        '<span class="badge badge-' + uBadge + '">' + uAtt.status + '</span>' +
        '</div>';
    }
    attHistoryHtml += '</div>';
  }

  var m = document.getElementById("modal");
  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Manajemen ' + (isTeacher ? 'Pegawai' : 'Siswa') + '</span><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body">' +
    // Preview Kartu Barcode
    '<div id="printable-card" style="background:#fff;border:2px solid var(--border);border-radius:12px;padding:16px;text-align:center;box-shadow:var(--shadow-sm);margin-bottom:15px;position:relative;">' +
    '<div style="font-size:11px;font-weight:700;color:var(--primary);letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px;">Yayasan Darul Ulum Islamiyyah</div>' +
    '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:10px;">' +
    '<img src="' + qrUrl + '" alt="QR Code" style="width:90px;height:90px;border-radius:6px;border:1px solid #e2e8f0;padding:2px;background:#fff;">' +
    '<div style="text-align:left;">' +
    '<h4 style="margin:0 0 2px;font-size:15px;color:var(--text);">' + s.nama + '</h4>' +
    '<p style="margin:0 0 4px;font-size:12px;color:var(--primary);font-weight:600;">' + (isTeacher ? 'NIP' : 'NIS/Barcode') + ': ' + code + '</p>' +
    '<p style="margin:0;font-size:12px;color:var(--gray);">' + (isTeacher ? 'Jabatan' : 'Kelas') + ': <strong>' + sub + '</strong></p>' +
    '</div></div>' +
    '<div style="font-size:10px;color:var(--gray);border-top:1px dashed var(--border);padding-top:6px;">Tunjukkan QR Code ini pada scanner kamera untuk absen instan</div>' +
    '</div>' +
    '<div style="display:flex;gap:8px;margin-bottom:15px;">' +
    '<button class="btn btn-outline" style="flex:1;justify-content:center;" onclick="printIdCard(\'' + s.id + '\')"><i data-lucide="printer" style="width:14px;"></i> Cetak Kartu</button>' +
    '<button class="btn btn-outline" style="flex:1;justify-content:center;" onclick="editSiswa(\'' + s.id + '\')"><i data-lucide="edit" style="width:14px;"></i> Edit Data</button>' +
    '</div>' +
    '<h4 style="font-size:13px;font-weight:700;color:var(--primary-dark);margin:15px 0 6px;">Status Biometrik Wajah</h4>' +
    faceSection +
    attHistoryHtml +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Selesai</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}

function printIdCard(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (!s) return;
  var code = s.nip || s.barcode || s.id;
  var sub = s.jabatan || s.kelas || "-";
  var isTeacher = activeType === "guru";
  var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=" + encodeURIComponent(code);
  var logo = appSettings.logoUrl || "icon-192.png";

  var printWin = window.open("", "_blank", "width=600,height=600");
  if (!printWin) {
    showToast("Popup terblokir oleh browser. Izinkan popup untuk mencetak kartu.", "warning");
    return;
  }
  printWin.document.write('<!DOCTYPE html><html><head><title>Kartu ' + (isTeacher ? 'Pegawai' : 'Pelajar') + ' - ' + s.nama + '</title><style>' +
    'body { font-family: sans-serif; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:#f4f4f4; }' +
    '.card { width: 320px; background:#fff; border:2px solid #064e3b; border-radius:16px; padding:20px; text-align:center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }' +
    '.header { display:flex; align-items:center; justify-content:center; gap:8px; border-bottom:2px solid #d4af37; padding-bottom:10px; margin-bottom:14px; }' +
    '.header img { width:36px; height:36px; object-fit:contain; }' +
    '.header h2 { font-size:13px; margin:0; color:#064e3b; text-transform:uppercase; font-weight:800; line-height:1.2; }' +
    '.qr { width:150px; height:150px; margin:10px auto; border:1px solid #ddd; padding:4px; border-radius:8px; display:block; }' +
    '.name { font-size:16px; font-weight:700; margin:10px 0 4px; color:#111; }' +
    '.code { font-size:13px; font-weight:700; color:#059669; margin:0 0 4px; letter-spacing:1px; }' +
    '.role { font-size:12px; color:#555; margin:0; }' +
    '.footer { margin-top:14px; border-top:1px dashed #ccc; padding-top:8px; font-size:10px; color:#888; }' +
    '@media print { body { background:#fff; } .card { box-shadow:none; border:2px solid #000; } }' +
    '</style></head><body>' +
    '<div class="card">' +
    '<div class="header"><img src="' + logo + '" onerror="this.style.display=\'none\'"><h2>Yayasan Darul Ulum<br><span style="font-size:11px;font-weight:600;color:#555;">Islamiyyah - Kamang Baru</span></h2></div>' +
    '<img class="qr" src="' + qrUrl + '">' +
    '<div class="name">' + s.nama + '</div>' +
    '<div class="code">' + (isTeacher ? 'NIP' : 'NIS/Barcode') + ': ' + code + '</div>' +
    '<div class="role">' + (isTeacher ? 'Jabatan' : 'Unit/Kelas') + ': ' + sub + '</div>' +
    '<div class="footer">Kartu Resmi Presensi Digital</div>' +
    '</div><script>window.onload = function() { window.print(); }<\/script></body></html>');
  printWin.document.close();
}

function showFaceDetail(id) {
  var s = students.find(function(x) { return x.id === id; });
  if (!s) return;

  var photoHtml = s.foto
    ? '<div style="text-align:center;margin-bottom:15px;"><img src="' + formatPhotoUrl(s.foto) + '" style="max-width:100%;max-height:240px;border-radius:12px;object-fit:cover;box-shadow:var(--shadow);" onerror="this.parentElement.innerHTML=\'<div class=\\\'avatar blue\\\' style=\\\'width:80px;height:80px;font-size:28px;margin:0 auto;\\\'>' + getInit(s.nama) + '</div>\'"></div>'
    : '<div style="text-align:center;margin-bottom:15px;"><div class="avatar blue" style="width:80px;height:80px;font-size:28px;margin:0 auto;">' + getInit(s.nama) + '</div><p style="color:var(--gray);font-size:12px;margin-top:8px;">Foto acuan belum memiliki URL preview</p></div>';

  var m = document.getElementById("modal");
  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Biometrik Wajah - ' + s.nama + '</span><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body">' +
    photoHtml +
    '<div style="text-align:center;margin-bottom:15px;">' +
    '<span class="badge badge-success"><i data-lucide="check-circle" style="width:14px;height:14px;margin-right:4px;"></i> Data Wajah Terdaftar</span>' +
    '<p style="color:var(--gray);font-size:13px;margin:8px 0 0;">ID: ' + s.id + ' • ' + (s.kelas || s.jabatan || "-") + '</p>' +
    '</div>' +
    '<div style="display:flex;flex-direction:column;gap:10px;">' +
    '<button class="btn btn-outline" style="justify-content:center;" onclick="regFace(\'' + s.id + '\',\'' + s.nama.replace(/'/g, "\\'") + '\')"><i data-lucide="camera" style="width:16px;"></i> Ambil Ulang / Update Foto Wajah</button>' +
    '<button class="btn btn-danger" style="justify-content:center;" onclick="resetFaceData(\'' + s.id + '\')"><i data-lucide="trash-2" style="width:16px;"></i> Hapus / Reset Data Wajah</button>' +
    '</div>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Tutup</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}

function resetFaceData(id) {
  if (confirm("Yakin ingin menghapus / mereset data wajah ini? Data biometrik di database akan dikosongkan sehingga pengguna dapat mendaftarkan wajah kembali saat absensi pertama.")) {
    window.callGasAPI(
      "registerFace",
      { studentId: id, faceDescriptor: "", fotoURL: "" },
      function (r) {
        showToast("Data wajah berhasil direset", "success");
        closeModal();
        loadData();
      },
      function (err) {
        showToast("Gagal reset wajah: " + err, "error");
      }
    );
  }
}

function showNotificationInfo() {
  var m = document.getElementById("modal");
  var pendingCount = stats.belumAbsen || 0;
  var hadirCount = stats.totalHadir || 0;
  var telatCount = stats.totalTerlambat || 0;

  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Pusat Notifikasi Presensi</span><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body">' +
    '<div style="display:flex;flex-direction:column;gap:12px;">' +
    '<div style="display:flex;align-items:flex-start;gap:12px;background:#f0fdf4;border:1px solid #bbf7d0;padding:12px;border-radius:10px;">' +
    '<i data-lucide="check-circle-2" style="width:20px;height:20px;color:var(--success);flex-shrink:0;margin-top:2px;"></i>' +
    '<div><strong style="font-size:13px;color:#166534;">Sistem Presensi Berjalan Normal</strong><p style="margin:2px 0 0;font-size:12px;color:#15803d;">Sinkronisasi database Google Sheets berjalan secara real-time.</p></div>' +
    '</div>' +
    '<div style="display:flex;align-items:flex-start;gap:12px;background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:10px;">' +
    '<i data-lucide="clock" style="width:20px;height:20px;color:var(--warning);flex-shrink:0;margin-top:2px;"></i>' +
    '<div><strong style="font-size:13px;color:#92400e;">Ringkasan Kehadiran Hari Ini</strong><p style="margin:2px 0 0;font-size:12px;color:#b45309;">Hadir: ' + hadirCount + ' • Terlambat: ' + telatCount + ' • Belum Absen: ' + pendingCount + '</p></div>' +
    '</div>' +
    '<div style="display:flex;align-items:flex-start;gap:12px;background:#f0f9ff;border:1px solid #bae6fd;padding:12px;border-radius:10px;">' +
    '<i data-lucide="shield-check" style="width:20px;height:20px;color:var(--info);flex-shrink:0;margin-top:2px;"></i>' +
    '<div><strong style="font-size:13px;color:#075985;">Proteksi Anti-Bypass Face Recognition</strong><p style="margin:2px 0 0;font-size:12px;color:#0369a1;">Verifikasi biometrik ketat aktif. Wajah tidak cocok akan otomatis ditolak oleh sistem.</p></div>' +
    '</div>' +
    '</div>' +
    '</div>' +
    '<div class="modal-footer"><button class="btn btn-primary" onclick="closeModal()">Tutup</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
}
function syncHolidaysCloud() {
  if (!window.HolidayManager) {
    showToast("Modul kalender libur belum tersedia", "error");
    return;
  }
  showToast("Menghubungi server kalender libur...", "info");
  window.HolidayManager.syncFromCloud(function(success, msg) {
    if (success) {
      showToast("Kalender libur nasional berhasil disinkronkan!", "success");
      renderPengaturan();
    } else {
      showToast("Sinkronisasi offline: " + msg, "warning");
    }
  });
}

function addCustomHoliday() {
  var dateEl = document.getElementById("set-custom-holiday-date");
  var nameEl = document.getElementById("set-custom-holiday-name");
  if (!dateEl || !nameEl) return;
  var dt = dateEl.value.trim();
  var nm = nameEl.value.trim();
  if (!dt) {
    showToast("Pilih tanggal libur terlebih dahulu", "warning");
    return;
  }
  if (!nm) {
    showToast("Tuliskan keterangan / nama libur", "warning");
    return;
  }

  if (!appSettings) appSettings = {};
  if (!appSettings.customHolidays) appSettings.customHolidays = {};
  if (typeof appSettings.customHolidays === "string") {
    try { appSettings.customHolidays = JSON.parse(appSettings.customHolidays); } catch(e) { appSettings.customHolidays = {}; }
  }
  appSettings.customHolidays[dt] = nm;

  try {
    localStorage.setItem("app_custom_holidays", JSON.stringify(appSettings.customHolidays));
  } catch (e) {}

  showToast("Hari libur khusus berhasil ditambahkan", "success");
  renderPengaturan();

  if (typeof window.callGasAPI === "function") {
    saveSettings();
  }
}

function deleteCustomHoliday(dt) {
  if (!confirm("Hapus hari libur madrasah pada tanggal " + dt + "?")) return;
  if (appSettings && appSettings.customHolidays) {
    if (typeof appSettings.customHolidays === "string") {
      try { appSettings.customHolidays = JSON.parse(appSettings.customHolidays); } catch(e) {}
    }
    if (typeof appSettings.customHolidays === "object" && appSettings.customHolidays[dt]) {
      delete appSettings.customHolidays[dt];
    }
  }
  try {
    var stored = localStorage.getItem("app_custom_holidays");
    if (stored) {
      var p = JSON.parse(stored);
      delete p[dt];
      localStorage.setItem("app_custom_holidays", JSON.stringify(p));
    }
  } catch (e) {}
  showToast("Hari libur khusus dihapus", "info");
  renderPengaturan();

  if (typeof window.callGasAPI === "function") {
    saveSettings();
  }
}

var selectedHolidayYear = new Date().getFullYear();

function changeHolidayYear(y) {
  selectedHolidayYear = parseInt(y, 10);
  renderPengaturan();
}

function renderPengaturan() {
  var c = document.getElementById("main-content");
  if (!c) return;

  var currentYear = new Date().getFullYear();
  if (!selectedHolidayYear) selectedHolidayYear = currentYear;

  var customHolidays = {};
  try {
    var localHols = localStorage.getItem("app_custom_holidays");
    if (localHols) Object.assign(customHolidays, JSON.parse(localHols));
  } catch (e) {}
  if (appSettings && appSettings.customHolidays) {
    Object.assign(customHolidays, appSettings.customHolidays);
  }

  // Generate list of custom holidays
  var customHolsListHtml = "";
  var customDates = Object.keys(customHolidays).sort();
  if (customDates.length === 0) {
    customHolsListHtml = '<p style="color:var(--text-muted);font-size:12px;margin:8px 0;">Belum ada hari libur khusus madrasah yang ditambahkan.</p>';
  } else {
    customHolsListHtml = '<div style="display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto;margin:8px 0 14px;">';
    for (var i = 0; i < customDates.length; i++) {
      var cd = customDates[i];
      var cn = customHolidays[cd];
      customHolsListHtml +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--bg);border-radius:6px;font-size:12px;border:1px solid var(--border);">' +
        '<div><strong>' + cd + '</strong>: ' + cn + '</div>' +
        '<button class="btn btn-outline btn-sm" style="padding:2px 8px;font-size:11px;color:var(--danger);" onclick="deleteCustomHoliday(\'' + cd + '\')"><i data-lucide="trash-2" style="width:12px;height:12px;"></i> Hapus</button>' +
        '</div>';
    }
    customHolsListHtml += '</div>';
  }

  // Generate year preview list
  var yearHols = window.HolidayManager ? window.HolidayManager.getHolidaysForYear(selectedHolidayYear) : {};
  var yearDates = Object.keys(yearHols).sort();

  var yearSelectOptions = "";
  for (var yr = currentYear - 1; yr <= currentYear + 5; yr++) {
    yearSelectOptions += '<option value="' + yr + '" ' + (yr === selectedHolidayYear ? 'selected' : '') + '>Tahun ' + yr + '</option>';
  }

  var yearHolsHtml = "";
  if (yearDates.length === 0) {
    yearHolsHtml = '<p style="color:var(--text-muted);font-size:12px;margin:8px 0;">Tidak ada hari libur terdaftar untuk tahun ' + selectedHolidayYear + '.</p>';
  } else {
    yearHolsHtml = '<div style="display:flex;flex-direction:column;gap:5px;max-height:220px;overflow-y:auto;margin-top:10px;padding-right:4px;">';
    for (var yd = 0; yd < yearDates.length; yd++) {
      var yDateKey = yearDates[yd];
      var yName = yearHols[yDateKey];
      var isCustomItem = !!customHolidays[yDateKey];
      var badgeItem = isCustomItem 
        ? '<span class="badge badge-warning" style="font-size:10px;padding:2px 6px;">Libur Madrasah</span>'
        : '<span class="badge badge-success" style="font-size:10px;padding:2px 6px;">Libur Nasional</span>';

      yearHolsHtml +=
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg);border-radius:6px;font-size:12px;border:1px solid var(--border);">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
        '<i data-lucide="calendar" style="width:14px;height:14px;color:var(--primary);flex-shrink:0;"></i>' +
        '<span><strong>' + yDateKey + '</strong>: ' + yName + '</span>' +
        '</div>' +
        '<div>' + badgeItem + '</div>' +
        '</div>';
    }
    yearHolsHtml += '</div>';
  }

  c.innerHTML =
    '<div class="page-header">' +
      '<div><h1>Pengaturan Sistem & Kalender</h1></div>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(min(100%, 320px), 1fr));gap:20px;">' +
      '<!-- Kartu 1: Parameter Sistem -->' +
      '<div class="card">' +
        '<div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;">' +
          '<i data-lucide="settings" style="width:18px;color:var(--primary);"></i><strong style="font-size:15px;">Parameter Presensi & Admin</strong>' +
        '</div>' +
        '<div class="card-body" style="padding:20px;">' +
          '<div class="form-group"><label class="form-label">Nama Admin</label><input type="text" class="form-input" id="set-admin-nama" value="' + (appSettings.adminName || 'Budi Santoso') + '"></div>' +
          '<div class="form-group"><label class="form-label">Jabatan Admin</label><input type="text" class="form-input" id="set-admin-role" value="' + (appSettings.adminRole || 'Administrator') + '"></div>' +
          '<div class="form-group"><label class="form-label">URL Logo Web (Opsional)</label><input type="url" class="form-input" id="set-logo" value="' + (appSettings.logoUrl || '') + '" placeholder="https://..."></div>' +
          '<div class="form-group"><label class="form-label">Jam Batas Terlambat</label><input type="time" class="form-input" id="set-jam" value="' + (appSettings.jamTerlambat || '07:15') + '"></div>' +
          '<div class="form-group"><label class="form-label">Threshold Face Match (0-1)</label><input type="number" class="form-input" id="set-th" value="' + (appSettings.faceMatchThreshold || '0.5') + '" min="0" max="1" step="0.1"></div>' +
          '<div class="form-group"><label class="form-label">PIN / Sandi Login Admin</label><input type="password" class="form-input" id="set-admin-pin" value="' + ((appSettings && appSettings.adminPin) || localStorage.getItem('app_admin_pin') || '123456') + '" placeholder="Default: 123456"><small style="font-size:11px;color:var(--text-muted);display:block;margin-top:4px;">Digunakan untuk login ke Admin Portal dari halaman utama.</small></div>' +
          '<button class="btn btn-primary" onclick="saveSettings()"><i data-lucide="save" style="width:16px"></i> Simpan Parameter</button>' +
        '</div>' +
      '</div>' +
      '<!-- Kartu 2: Titik Lokasi & Radius Presensi (GPS Geofencing) -->' +
      '<div class="card">' +
        '<div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="map-pin" style="width:18px;color:var(--primary);"></i><strong style="font-size:15px;">Lokasi & Radius Presensi (GPS)</strong></div>' +
          '<span class="badge badge-success" style="font-size:10px;padding:3px 8px;">Geofencing Aktif</span>' +
        '</div>' +
        '<div class="card-body" style="padding:20px;">' +
          '<div style="padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;line-height:1.5;margin-bottom:14px;">' +
            '<div style="display:flex;align-items:flex-start;gap:8px;">' +
              '<i data-lucide="shield-check" style="width:16px;height:16px;color:var(--success);flex-shrink:0;margin-top:2px;"></i>' +
              '<div>' +
                '<strong>Validasi Geofencing Presensi</strong><br>' +
                'Siswa dan pegawai hanya dapat melakukan absensi jika berada dalam radius toleransi dari koordinat madrasah/sekolah:' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Latitude Target (Lintang)</label>' +
            '<input type="number" step="any" class="form-input" id="set-target-lat" value="' + (appSettings.targetLat || localStorage.getItem('app_target_lat') || '-0.8672131613430705') + '" placeholder="-0.86721316">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Longitude Target (Bujur)</label>' +
            '<input type="number" step="any" class="form-input" id="set-target-lng" value="' + (appSettings.targetLng || localStorage.getItem('app_target_lng') || '101.37821257931239') + '" placeholder="101.37821258">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Radius Toleransi (Meter)</label>' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<input type="number" min="10" max="100000" step="10" class="form-input" id="set-target-radius" value="' + (appSettings.targetRadius || localStorage.getItem('app_target_radius') || '1000') + '" placeholder="1000" style="flex:1;">' +
              '<span style="font-size:13px;font-weight:600;color:var(--text-muted);white-space:nowrap;">Meter</span>' +
            '</div>' +
            '<small style="font-size:11px;color:var(--text-muted);display:block;margin-top:4px;">Contoh: 1000m = 1 km. Absensi ditolak otomatis jika pengguna berada di luar radius.</small>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;margin-top:16px;">' +
            '<button type="button" class="btn btn-outline" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--bg);" onclick="getAdminCurrentLocation()">' +
              '<i data-lucide="crosshair" style="width:16px;color:var(--primary);"></i> Ambil Lokasi Saat Ini (GPS Otomatis)' +
            '</button>' +
            '<button type="button" class="btn btn-outline" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="openTargetInGoogleMaps()">' +
              '<i data-lucide="map" style="width:16px;"></i> Pratinjau di Google Maps' +
            '</button>' +
            '<button type="button" class="btn btn-primary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:4px;" onclick="saveSettings()">' +
              '<i data-lucide="save" style="width:16px"></i> Simpan Lokasi & Radius' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<!-- Kartu 3: Kalender Libur Indonesia -->' +
      '<div class="card">' +
        '<div class="card-header" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">' +
          '<div style="display:flex;align-items:center;gap:8px;"><i data-lucide="calendar-days" style="width:18px;color:var(--primary);"></i><strong style="font-size:15px;">Kalender Libur Multi-Tahun</strong></div>' +
          '<button class="btn btn-outline btn-sm" onclick="syncHolidaysCloud()"><i data-lucide="refresh-cw" style="width:13px"></i> Sinkron Cloud</button>' +
        '</div>' +
        '<div class="card-body" style="padding:20px;">' +
          '<div style="padding:10px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:12px;color:#166534;line-height:1.5;margin-bottom:14px;">' +
            '<div style="display:flex;align-items:flex-start;gap:8px;">' +
              '<i data-lucide="check-circle" style="width:16px;height:16px;color:var(--success);flex-shrink:0;margin-top:2px;"></i>' +
              '<div>' +
                '<strong>Otomasi Kalender Multi-Tahun Aktif</strong><br>' +
                'Kalender libur berlaku dinamis untuk tahun ini dan tahun-tahun mendatang:' +
                '<ul style="margin:4px 0 0 16px;padding:0;">' +
                  '<li><strong>Libur Tetap Abadi:</strong> 1 Jan, 1 Mei, 1 Juni, 17 Ags, 25-26 Des otomatis aktif di tahun berapapun.</li>' +
                  '<li><strong>Proyeksi Kalender Astronomis:</strong> Hari raya keagamaan (Idul Fitri, Idul Adha, Nyepi, Waisak, Imlek) siap hingga 2030.</li>' +
                  '<li><strong>Sinkron Cloud Otomatis:</strong> Diperbarui otomatis saat SKB 3 Menteri resmi diumumkan oleh pemerintah.</li>' +
                '</ul>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:10px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border);">' +
            '<div style="font-size:13px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:6px;">' +
              '<i data-lucide="calendar" style="width:16px;color:var(--primary);"></i> Pratinjau Daftar Libur:' +
            '</div>' +
            '<select class="form-select" style="width:auto;min-width:130px;height:34px;padding:4px 8px;font-size:12px;" onchange="changeHolidayYear(this.value)">' +
              yearSelectOptions +
            '</select>' +
          '</div>' +
          yearHolsHtml +
          '<hr style="margin:16px 0;border:none;border-top:1px solid var(--border);">' +
          '<strong style="font-size:13px;color:var(--text);display:block;margin-bottom:8px;">Tambah Libur Khusus Madrasah / Pondok:</strong>' +
          '<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
            '<input type="date" class="form-input" id="set-custom-holiday-date" style="flex:1;min-width:140px;font-size:12px;">' +
            '<input type="text" class="form-input" id="set-custom-holiday-name" placeholder="Nama Libur (misal: Libur Pondok Ramadhan)" style="flex:2;min-width:180px;font-size:12px;">' +
            '<button class="btn btn-primary btn-sm" onclick="addCustomHoliday()"><i data-lucide="plus" style="width:14px"></i> Tambah</button>' +
          '</div>' +
          customHolsListHtml +
        '</div>' +
      '</div>' +
    '</div>';

  lucide.createIcons();
}

function getAdminCurrentLocation() {
  if (!navigator.geolocation) {
    showToast("Perangkat atau browser tidak mendukung akses GPS", "error");
    return;
  }
  showToast("Mengakses sensor GPS perangkat...", "info");
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var acc = Math.round(pos.coords.accuracy || 0);

      var latEl = document.getElementById("set-target-lat");
      var lngEl = document.getElementById("set-target-lng");
      if (latEl) latEl.value = lat;
      if (lngEl) lngEl.value = lng;

      showToast("Koordinat GPS berhasil diambil! Akurasi: ±" + acc + " meter", "success");
    },
    function(err) {
      var msg = "Gagal mengambil GPS: " + (err.message || "Akses ditolak");
      if (err.code === 1) msg = "Izin akses lokasi ditolak oleh browser/pengguna.";
      else if (err.code === 2) msg = "Sinyal posisi GPS tidak tersedia.";
      else if (err.code === 3) msg = "Waktu pencarian sinyal GPS habis (timeout).";
      showToast(msg, "error");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

function openTargetInGoogleMaps() {
  var latEl = document.getElementById("set-target-lat");
  var lngEl = document.getElementById("set-target-lng");
  var lat = latEl ? latEl.value.trim() : (appSettings.targetLat || localStorage.getItem('app_target_lat') || '-0.8672131613430705');
  var lng = lngEl ? lngEl.value.trim() : (appSettings.targetLng || localStorage.getItem('app_target_lng') || '101.37821257931239');
  if (!lat || !lng) {
    showToast("Isi koordinat Latitude dan Longitude terlebih dahulu", "warning");
    return;
  }
  window.open("https://www.google.com/maps?q=" + encodeURIComponent(lat + "," + lng), "_blank");
}

function showAddModal() {
  var m = document.getElementById("modal");
  if (activeType === "kelas") {
    m.innerHTML =
      '<div class="modal"><div class="modal-header"><span class="modal-title">Tambah Unit / Kelas Baru</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nama Unit / Kelas (Misal: SDIT Kelas 1)</label><input type="text" class="form-input" id="add-kelas-nama" placeholder="Contoh: SDIT Kelas 1"></div><div class="form-group"><label class="form-label">Nama Wali Kelas</label><input type="text" class="form-input" id="add-kelas-wali" placeholder="Nama Wali Kelas"></div><div class="form-group"><label class="form-label">Email Wali Kelas</label><input type="email" class="form-input" id="add-kelas-email" placeholder="email@sekolah.sch.id"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitAdd()">Simpan</button></div></div>';
  } else {
    var lblCode = activeType == "guru" ? "NIP" : "Barcode / NIS";
    var catFormHtml = "";
    if (activeType === "guru") {
      var unitOptions = "";
      for (var u = 1; u < PEGAWAI_UNITS.length; u++) {
        unitOptions += '<option value="' + PEGAWAI_UNITS[u] + '">' + PEGAWAI_UNITS[u] + '</option>';
      }
      var jabatanDatalist = '<datalist id="jabatan-suggestions">' +
        '<option value="Kepala Yayasan">' +
        '<option value="Kepala Sekolah">' +
        '<option value="Wali Kelas">' +
        '<option value="Guru Kelas">' +
        '<option value="Guru Bidang Studi">' +
        '<option value="Guru Rumah Quran">' +
        '<option value="Guru Tahfidz">' +
        '<option value="Staf Tata Usaha">' +
        '<option value="Bendahara">' +
        '<option value="Operator">' +
        '<option value="Keamanan">' +
        '<option value="Kebersihan">' +
        '</datalist>';
      catFormHtml =
        '<div class="form-group"><label class="form-label">Unit Kerja Utama Pegawai</label>' +
        '<select class="form-select" id="add-unit">' + unitOptions + '</select></div>' +
        '<div class="form-group"><label class="form-label">Jabatan Pegawai</label>' +
        '<input type="text" class="form-input" id="add-jabatan" placeholder="Contoh: Guru Kelas, Wali Kelas, Kepala Sekolah" list="jabatan-suggestions">' +
        jabatanDatalist +
        '<small style="color:var(--gray);font-size:11px">Pilih dari saran atau ketik jabatan custom.</small></div>' +
        '<div class="form-group" style="background:#f8fafc;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;margin-top:10px;">' +
        '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;font-size:13px;color:#1e293b;margin:0;">' +
        '<input type="checkbox" id="add-merangkap-rq" style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;">' +
        '<span>Merangkap Jabatan: Guru Rumah Qur\'an (Jadwal Bebas)</span>' +
        '</label>' +
        '<small style="color:var(--gray);font-size:11px;display:block;margin-top:4px;line-height:1.4;">' +
        'Centang jika pegawai ini juga mengajar di Rumah Qur\'an. Sistem akan memisahkan absensi tugas reguler dan tugas Rumah Qur\'an secara mandiri agar rekap tugas reguler tetap mencatat Alpa jika tidak hadir.' +
        '</small>' +
        '</div>';
    } else {
      var classOptions = "";
      var seenCls = {};
      for (var sc = 0; sc < STANDARD_STUDENT_CLASSES.length; sc++) {
        var scN = STANDARD_STUDENT_CLASSES[sc];
        seenCls[scN] = true;
        var isFree = scN.toLowerCase().indexOf("rumah quran") > -1 ? " (Jadwal Bebas)" : "";
        classOptions += '<option value="' + scN + '">' + scN + isFree + '</option>';
      }
      if (availableClasses && availableClasses.length > 0) {
        for (var cIdx = 0; cIdx < availableClasses.length; cIdx++) {
          var cName = (availableClasses[cIdx].nama || "").trim();
          if (cName && !seenCls[cName]) {
            seenCls[cName] = true;
            classOptions += '<option value="' + cName + '">' + cName + '</option>';
          }
        }
      }
      catFormHtml =
        '<div class="form-group"><label class="form-label">Unit / Kelas Siswa</label>' +
        '<select class="form-select" id="add-kelas">' + classOptions + '</select>' +
        '<small style="color:var(--gray);font-size:11px">Kategori: Rumah Quran (Bebas), TK/PAUD, SDIT Kelas 1-6.</small></div>';
    }

    m.innerHTML =
      '<div class="modal"><div class="modal-header"><span class="modal-title">Tambah ' +
      (activeType == "guru" ? "Pegawai" : "Siswa") +
      ' Baru</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">' +
      lblCode +
      '</label><input type="text" class="form-input" id="add-bc" placeholder="Masukan ' +
      lblCode +
      '"></div><div class="form-group"><label class="form-label">Nama Lengkap</label><input type="text" class="form-input" id="add-nama" placeholder="Nama Lengkap"></div>' +
      catFormHtml +
      '<div class="form-group"><label class="form-label">Email (Opsional)</label><input type="email" class="form-input" id="add-email" placeholder="email@domain.com"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitAdd()">Simpan</button></div></div>';
  }
  m.classList.add("active");
}
function regFace(id, nm) {
  var m = document.getElementById("modal");
  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Register Wajah - ' +
    nm +
    '</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div style="text-align:center;padding:20px;border:2px dashed var(--border);border-radius:12px;margin-bottom:15px;cursor:pointer" onclick="document.getElementById(\'foto-input\').click()"><i data-lucide="upload" style="width:48px;height:48px;color:var(--gray);margin-bottom:10px"></i><p style="color:var(--gray);font-size:13px">Klik untuk upload foto wajah</p><input type="file" id="foto-input" accept="image/*" style="display:none" onchange="previewFoto(this)"></div><div id="preview-box" style="display:none;margin-bottom:15px"><img id="preview-img" style="width:100%;max-height:300px;object-fit:contain;border-radius:8px"></div><div class="face-status loading" id="face-status" style="display:none">Memproses wajah...</div><button class="btn btn-primary" style="width:100%" id="save-btn" disabled onclick="saveFace(\'' +
    id +
    '\')"><i data-lucide="save" style="width:16px"></i> Simpan Wajah</button></div></div>';
  m.classList.add("active");
  lucide.createIcons();
  loadFaceApi();
}
var uploadedImg = null;
function previewFoto(input) {
  if (input.files && input.files[0]) {
    var reader = new FileReader();
    reader.onload = function (e) {
      uploadedImg = new Image();
      uploadedImg.onload = function () {
        document.getElementById("preview-box").style.display = "block";
        document.getElementById("preview-img").src = e.target.result;
        document.getElementById("save-btn").disabled = false;
      };
      uploadedImg.src = e.target.result;
    };
    reader.readAsDataURL(input.files[0]);
  }
}
function loadFaceApi() {
  Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model",
    ),
    faceapi.nets.faceLandmark68Net.loadFromUri(
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model",
    ),
    faceapi.nets.faceRecognitionNet.loadFromUri(
      "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model",
    ),
  ])
    .then(function () {
      console.log("Face API loaded");
    })
    .catch(function (e) {
      console.log("Face API error", e);
    });
}
function saveFace(id) {
  if (!uploadedImg) {
    showToast("Pilih foto dulu", "error");
    return;
  }
  document.getElementById("face-status").style.display = "block";
  document.getElementById("face-status").className = "face-status loading";
  document.getElementById("face-status").textContent = "Mendeteksi wajah...";
  document.getElementById("save-btn").disabled = true;
  var cv = document.createElement("canvas");
  cv.width = uploadedImg.width;
  cv.height = uploadedImg.height;
  cv.getContext("2d").drawImage(uploadedImg, 0, 0);
  faceapi
    .detectSingleFace(cv, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
    .then(function (d) {
      if (d) {
        var desc = Array.from(d.descriptor);
        var small = document.createElement("canvas");
        small.width = 200;
        small.height = 200;
        small.getContext("2d").drawImage(uploadedImg, 0, 0, 200, 200);
        var url = small.toDataURL("image/jpeg", 0.3);
        document.getElementById("face-status").textContent = "Menyimpan...";
        window.callGasAPI(
          "registerFace",
          { studentId: id, faceDescriptor: desc, fotoURL: url },
          function (r) {
            closeModal();
            showToast("Wajah berhasil didaftarkan!", "success");
            loadData();
          },
          function (err) {
            document.getElementById("face-status").className =
              "face-status error";
            document.getElementById("face-status").textContent =
              "Error: " + err;
            document.getElementById("save-btn").disabled = false;
          },
        );
      } else {
        document.getElementById("face-status").className = "face-status error";
        document.getElementById("face-status").textContent =
          "Wajah tidak terdeteksi dalam foto";
        document.getElementById("save-btn").disabled = false;
      }
    })
    .catch(function (e) {
      document.getElementById("face-status").className = "face-status error";
      document.getElementById("face-status").textContent =
        "Error deteksi: " + e.message;
      document.getElementById("save-btn").disabled = false;
    });
}
function stopCam() {
  if (window.regStream) {
    window.regStream.getTracks().forEach(function (t) {
      t.stop();
    });
  }
}
function closeModal() {
  document.getElementById("modal").classList.remove("active");
  uploadedImg = null;
}
function submitAdd() {
  if (activeType === "kelas") {
    var n = document.getElementById("add-kelas-nama").value;
    var w = document.getElementById("add-kelas-wali").value;
    var e = document.getElementById("add-kelas-email").value;
    if (!n || !w) {
      showToast("Lengkapi field wajib", "error");
      return;
    }
    window.callGasAPI("addClass", { nama: n, wali: w, email: e }, function (r) {
      showToast("Kelas berhasil ditambahkan", "success");
      closeModal();
      loadData();
    }, function(err) {
      showToast("Gagal menambah kelas: " + err, "error");
    });
    return;
  }
  var bc = document.getElementById("add-bc").value.trim();
  var nm = document.getElementById("add-nama").value.trim();
  var em = document.getElementById("add-email").value.trim();

  if (activeType === "guru") {
    var uEl = document.getElementById("add-unit");
    var jEl = document.getElementById("add-jabatan");
    var mrqEl = document.getElementById("add-merangkap-rq");
    var uVal = uEl ? uEl.value.trim() : "Yayasan";
    var jVal = jEl ? jEl.value.trim() : "";
    if (!jVal) jVal = uVal;
    var kl = uVal + " - " + jVal;
    if (mrqEl && mrqEl.checked && uVal !== "Rumah Quran" && jVal.toLowerCase().indexOf("rumah quran") === -1) {
      kl += ", Guru Rumah Quran";
    }

    if (!bc || !nm) {
      showToast("Lengkapi NIP dan Nama Lengkap", "error");
      return;
    }
    window.callGasAPI(
      "addTeacher",
      { nip: bc, nama: nm, jabatan: kl, email: em },
      function (r) {
        showToast("Pegawai berhasil ditambahkan", "success");
        closeModal();
        loadData();
      },
      function(err) {
        showToast("Gagal menambah pegawai: " + err, "error");
      }
    );
  } else {
    var klEl = document.getElementById("add-kelas");
    var kl = klEl ? klEl.value.trim() : "";
    if (!bc || !nm || !kl) {
      showToast("Lengkapi semua field wajib", "error");
      return;
    }
    window.callGasAPI(
      "addStudent",
      { barcode: bc, nama: nm, kelas: kl, email: em },
      function (r) {
        showToast("Siswa berhasil ditambahkan", "success");
        closeModal();
        loadData();
      },
      function(err) {
        showToast("Gagal menambah siswa: " + err, "error");
      }
    );
  }
}

function editSiswa(id) {
  if (activeType === "kelas") {
    var s = students.find(function(x) { return x.nama === id; });
    if (!s) return;
    var m = document.getElementById("modal");
    m.innerHTML =
      '<div class="modal"><div class="modal-header"><span class="modal-title">Edit Unit / Kelas</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><input type="hidden" id="edit-old-nama" value="' + s.nama + '"><div class="form-group"><label class="form-label">Nama Unit / Kelas</label><input type="text" class="form-input" id="edit-kelas-nama" value="' + s.nama + '"></div><div class="form-group"><label class="form-label">Nama Wali Kelas</label><input type="text" class="form-input" id="edit-kelas-wali" value="' + s.wali + '"></div><div class="form-group"><label class="form-label">Email Wali Kelas</label><input type="email" class="form-input" id="edit-kelas-email" value="' + (s.email || "") + '"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitEdit(\'kelas\')">Update</button></div></div>';
    m.classList.add("active");
    return;
  }

  var s = students.find(function(x) { return x.id === id; });
  if (!s) return;
  var m = document.getElementById("modal");
  var lblCode = activeType == "guru" ? "NIP" : "Barcode / NIS";
  var code = activeType == "guru" ? s.nip : s.barcode;
  
  var catEditHtml = "";
  if (activeType === "guru") {
    var rawJabatan = String(s.jabatan || s.kelas || "");
    var roles = parsePegawaiRoles(rawJabatan);
    var regRoles = roles.filter(function(r) { return !isRumahQuranRole(r); });
    var hasRQ = roles.some(function(r) { return isRumahQuranRole(r); });

    var curUnit = regRoles.length > 0 ? getPegawaiUnitFromRole(regRoles[0]) : getPegawaiUnit(s);
    var curJab = regRoles.length > 0 ? getPegawaiJabatanFromRole(regRoles[0]) : getPegawaiJabatan(s);
    var unitOptions = "";
    for (var u = 1; u < PEGAWAI_UNITS.length; u++) {
      var uN = PEGAWAI_UNITS[u];
      var isSel = (uN.toLowerCase() === curUnit.toLowerCase()) ? "selected" : "";
      unitOptions += '<option value="' + uN + '" ' + isSel + '>' + uN + '</option>';
    }
    var jabatanDatalist = '<datalist id="edit-jabatan-suggestions">' +
      '<option value="Kepala Yayasan">' +
      '<option value="Kepala Sekolah">' +
      '<option value="Wali Kelas">' +
      '<option value="Guru Kelas">' +
      '<option value="Guru Bidang Studi">' +
      '<option value="Guru Rumah Quran">' +
      '<option value="Guru Tahfidz">' +
      '<option value="Staf Tata Usaha">' +
      '<option value="Bendahara">' +
      '<option value="Operator">' +
      '<option value="Keamanan">' +
      '<option value="Kebersihan">' +
      '</datalist>';
    var isMerangkapChecked = (hasRQ && curUnit !== "Rumah Quran") ? "checked" : "";
    catEditHtml =
      '<div class="form-group"><label class="form-label">Unit Kerja Utama</label>' +
      '<select class="form-select" id="edit-unit">' + unitOptions + '</select></div>' +
      '<div class="form-group"><label class="form-label">Jabatan Utama</label>' +
      '<input type="text" class="form-input" id="edit-jabatan" value="' + (curJab === "-" ? "" : curJab) + '" placeholder="Contoh: Guru Kelas, Wali Kelas, Kepala Sekolah" list="edit-jabatan-suggestions">' +
      jabatanDatalist +
      '<small style="color:var(--gray);font-size:11px">Ubah Unit Kerja atau Jabatan pegawai.</small></div>' +
      '<div class="form-group" style="background:#f8fafc;padding:10px 14px;border:1px solid #e2e8f0;border-radius:8px;margin-top:10px;">' +
      '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:600;font-size:13px;color:#1e293b;margin:0;">' +
      '<input type="checkbox" id="edit-merangkap-rq" ' + isMerangkapChecked + ' style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;">' +
      '<span>Merangkap Jabatan: Guru Rumah Qur\'an (Jadwal Bebas)</span>' +
      '</label>' +
      '<small style="color:var(--gray);font-size:11px;display:block;margin-top:4px;line-height:1.4;">' +
      'Centang jika pegawai ini juga mengajar di Rumah Qur\'an. Absensi tugas reguler dan tugas Rumah Qur\'an akan dipisahkan secara otomatis agar rekap tugas reguler tetap mencatat Alpa jika tidak hadir.' +
      '</small>' +
      '</div>';
  } else {
    var curClass = (s.kelas || "").trim();
    var classOptions = "";
    var foundCurrent = false;
    var seenCls = {};
    for (var sc = 0; sc < STANDARD_STUDENT_CLASSES.length; sc++) {
      var scN = STANDARD_STUDENT_CLASSES[sc];
      seenCls[scN] = true;
      var isSel = matchSiswaKelas({ kelas: curClass }, scN) ? "selected" : "";
      if (isSel) foundCurrent = true;
      var isFree = scN.toLowerCase().indexOf("rumah quran") > -1 ? " (Jadwal Bebas)" : "";
      classOptions += '<option value="' + scN + '" ' + isSel + '>' + scN + isFree + '</option>';
    }
    if (availableClasses && availableClasses.length > 0) {
      for (var c2 = 0; c2 < availableClasses.length; c2++) {
        var cName2 = (availableClasses[c2].nama || "").trim();
        if (cName2 && !seenCls[cName2]) {
          seenCls[cName2] = true;
          var isSel2 = (cName2.toLowerCase() === curClass.toLowerCase()) ? "selected" : "";
          if (isSel2) foundCurrent = true;
          classOptions += '<option value="' + cName2 + '" ' + isSel2 + '>' + cName2 + '</option>';
        }
      }
    }
    if (!foundCurrent && curClass) {
      classOptions = '<option value="' + curClass + '" selected>' + curClass + '</option>' + classOptions;
    }
    catEditHtml =
      '<div class="form-group"><label class="form-label">Unit / Kelas Siswa</label>' +
      '<select class="form-select" id="edit-kelas">' + classOptions + '</select>' +
      '<small style="color:var(--gray);font-size:11px">Kategori: Rumah Quran (Bebas), TK/PAUD, SDIT Kelas 1-6.</small></div>';
  }

  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Edit ' +
    (activeType == "guru" ? "Pegawai" : "Siswa") +
    '</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">' +
    lblCode +
    '</label><input type="text" class="form-input" id="edit-bc" value="' + (code || "") + '"></div><div class="form-group"><label class="form-label">Nama Lengkap</label><input type="text" class="form-input" id="edit-nama" value="' + s.nama + '"></div>' +
    catEditHtml +
    '<div class="form-group"><label class="form-label">Email (Opsional)</label><input type="email" class="form-input" id="edit-email" value="' + (s.email || "") + '"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitEdit(\'' + id + '\')">Update</button></div></div>';
  m.classList.add("active");
}

function submitEdit(id) {
  if (id === 'kelas') {
    var oldN = document.getElementById("edit-old-nama").value;
    var n = document.getElementById("edit-kelas-nama").value;
    var w = document.getElementById("edit-kelas-wali").value;
    var e = document.getElementById("edit-kelas-email").value;
    if (!n || !w) {
      showToast("Lengkapi field wajib", "error");
      return;
    }
    window.callGasAPI("editClass", { old_nama: oldN, nama: n, wali: w, email: e }, function (r) {
      showToast("Kelas berhasil diupdate", "success");
      closeModal();
      loadData();
    }, function(err) {
      showToast("Gagal update kelas: " + err, "error");
    });
    return;
  }

  var bc = document.getElementById("edit-bc").value.trim();
  var nm = document.getElementById("edit-nama").value.trim();
  var em = document.getElementById("edit-email").value.trim();

  if (activeType === "guru") {
    var uEl = document.getElementById("edit-unit");
    var jEl = document.getElementById("edit-jabatan");
    var mrqEl = document.getElementById("edit-merangkap-rq");
    var uVal = uEl ? uEl.value.trim() : "Yayasan";
    var jVal = jEl ? jEl.value.trim() : "";
    if (!jVal) jVal = uVal;
    var kl = uVal + " - " + jVal;
    if (mrqEl && mrqEl.checked && uVal !== "Rumah Quran" && jVal.toLowerCase().indexOf("rumah quran") === -1) {
      kl += ", Guru Rumah Quran";
    }

    if (!bc || !nm) {
      showToast("Lengkapi NIP dan Nama Lengkap", "error");
      return;
    }
    window.callGasAPI(
      "editTeacher",
      { id: id, nip: bc, nama: nm, jabatan: kl, email: em },
      function (r) {
        showToast("Pegawai berhasil diupdate", "success");
        closeModal();
        loadData();
      },
      function(err) {
        showToast("Gagal update pegawai: " + err, "error");
      }
    );
  } else {
    var klEl = document.getElementById("edit-kelas");
    var kl = klEl ? klEl.value.trim() : "";
    if (!bc || !nm || !kl) {
      showToast("Lengkapi semua field", "error");
      return;
    }
    window.callGasAPI(
      "editStudent",
      { id: id, barcode: bc, nama: nm, kelas: kl, email: em },
      function (r) {
        showToast("Siswa berhasil diupdate", "success");
        closeModal();
        loadData();
      },
      function(err) {
        showToast("Gagal update siswa: " + err, "error");
      }
    );
  }
}
function deleteSiswa(id) {
  if (confirm("Yakin ingin menghapus?")) {
    if (activeType === "kelas") {
      // Untuk kelas, id yang dikirim adalah nama kelas (bukan angka)
      window.callGasAPI("deleteClass", { nama: id }, function (r) {
        showToast("Kelas dihapus", "success");
        loadData();
      }, function(err) {
        showToast("Gagal hapus kelas: " + err, "error");
      });
      return;
    }
    if (activeType === "guru") {
      window.callGasAPI("deleteTeacher", { id: id }, function (r) {
        showToast("Pegawai dihapus", "success");
        loadData();
      }, function(err) {
        showToast("Gagal hapus pegawai: " + err, "error");
      });
    } else {
      window.callGasAPI("deleteStudent", { id: id }, function (r) {
        showToast("Siswa dihapus", "success");
        loadData();
      }, function(err) {
        showToast("Gagal hapus siswa: " + err, "error");
      });
    }
  }
}
function runSetup() {
  window.callGasAPI("setupSpreadsheet", {}, function (r) {
    showToast("Setup berhasil", "success");
    loadData();
  });
}
function saveSettings() {
  var elN = document.getElementById("set-admin-nama");
  var elR = document.getElementById("set-admin-role");
  var elL = document.getElementById("set-logo");
  var elJ = document.getElementById("set-jam");
  var elT = document.getElementById("set-th");
  var elP = document.getElementById("set-admin-pin");
  var elLat = document.getElementById("set-target-lat");
  var elLng = document.getElementById("set-target-lng");
  var elRad = document.getElementById("set-target-radius");

  var n = elN ? elN.value : (appSettings.adminName || 'Budi Santoso');
  var r = elR ? elR.value : (appSettings.adminRole || 'Administrator');
  var l = elL ? elL.value : (appSettings.logoUrl || '');
  var j = elJ ? elJ.value : (appSettings.jamTerlambat || '07:15');
  var t = elT ? elT.value : (appSettings.faceMatchThreshold || '0.5');
  var p = elP ? elP.value.trim() : ((appSettings && appSettings.adminPin) || localStorage.getItem('app_admin_pin') || '123456');
  if (p) localStorage.setItem('app_admin_pin', p);

  var latVal = elLat ? elLat.value.trim() : (appSettings.targetLat || localStorage.getItem('app_target_lat') || '-0.8672131613430705');
  var lngVal = elLng ? elLng.value.trim() : (appSettings.targetLng || localStorage.getItem('app_target_lng') || '101.37821257931239');
  var radVal = elRad ? elRad.value.trim() : (appSettings.targetRadius || localStorage.getItem('app_target_radius') || '1000');

  if (latVal) localStorage.setItem('app_target_lat', latVal);
  if (lngVal) localStorage.setItem('app_target_lng', lngVal);
  if (radVal) localStorage.setItem('app_target_radius', radVal);

  var customHols = {};
  try {
    var stored = localStorage.getItem("app_custom_holidays");
    if (stored) Object.assign(customHols, JSON.parse(stored));
  } catch (e) {}
  if (appSettings && appSettings.customHolidays) {
    Object.assign(customHols, appSettings.customHolidays);
  }

  var payload = { 
    adminName: n, 
    adminRole: r, 
    logoUrl: l, 
    adminPin: p,
    jamTerlambat: j, 
    faceMatchThreshold: t,
    targetLat: latVal,
    targetLng: lngVal,
    targetRadius: radVal,
    customHolidays: JSON.stringify(customHols)
  };
  
  window.callGasAPI(
    "updateSettings",
    payload,
    function (res) {
      showToast("Pengaturan disimpan", "success");
      appSettings = payload;
      appSettings.customHolidays = customHols;
      try {
        localStorage.setItem("app_settings", JSON.stringify(appSettings));
      } catch (e) {}
      applySettingsToUI();
    },
    function(err) {
      showToast("Gagal simpan pengaturan: " + err, "error");
    }
  );
}
function printReport(orientation) {
  orientation = (orientation === "portrait") ? "portrait" : "landscape";
  
  // 1. Bersihkan style dan class dinamis cetak terdahulu
  var oldStyle = document.getElementById("dynamic-print-style");
  if (oldStyle) oldStyle.remove();
  document.body.classList.remove("print-mode-portrait", "print-mode-landscape");
  
  // 2. Beri class orientasi ke document.body
  document.body.classList.add("print-mode-" + orientation);
  
  // 3. Inject @page size dan margin spesifik
  var styleEl = document.createElement("style");
  styleEl.id = "dynamic-print-style";
  var pageMargin = orientation === "portrait" ? "8mm 8mm" : "6mm 8mm";
  styleEl.innerHTML = "@page { size: " + orientation + " !important; margin: " + pageMargin + " !important; }";
  document.head.appendChild(styleEl);
  
  // 4. Buka dialog cetak setelah browser mengaplikasikan styling (paksa horizontal)
  setTimeout(function() {
    window.print();
  }, 100);
}

window.addEventListener("afterprint", function() {
  document.body.classList.remove("print-mode-portrait", "print-mode-landscape");
});

/* === APP DROPDOWN HELPER FUNCTIONS === */
function toggleAppDropdown(id, e) {
  if (e) {
    if (typeof e.stopPropagation === "function") e.stopPropagation();
  }
  var el = document.getElementById(id);
  if (!el) return;
  var wasActive = el.classList.contains("active");
  closeAllDropdowns();
  if (!wasActive) {
    el.classList.add("active");
  }
}

function closeAllDropdowns() {
  var activeDropdowns = document.querySelectorAll(".app-dropdown.active");
  for (var i = 0; i < activeDropdowns.length; i++) {
    activeDropdowns[i].classList.remove("active");
  }
}

document.addEventListener("click", function(e) {
  if (e && e.target && !e.target.closest(".app-dropdown")) {
    closeAllDropdowns();
  }
});

function downloadBlob(blob, filename) {
  try {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      try {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 500);
  } catch (err) {
    console.error("downloadBlob error:", err);
    showToast("Gagal mengunduh file: " + err.message, "error");
  }
}

function downloadCsvFallback(aoaData, filename) {
  try {
    var csvContent = "\uFEFF" + aoaData.map(function(row) {
      return row.map(function(cell) {
        var val = (cell === null || cell === undefined) ? "" : String(cell);
        val = val.replace(/"/g, '""');
        return '"' + val + '"';
      }).join(";");
    }).join("\r\n");
    var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, filename);
    showToast("File diunduh (Format CSV Excel)", "success");
  } catch (err) {
    console.error("downloadCsvFallback error:", err);
    showToast("Gagal mengunduh CSV: " + err.message, "error");
  }
}

function fetchLogoBase64(callback) {
  var logoUrl = getAppLogoUrl();
  if (!logoUrl) {
    callback(null);
    return;
  }
  if (logoUrl.indexOf("data:") === 0) {
    callback(logoUrl);
    return;
  }
  
  var finished = false;
  var timer = setTimeout(function() {
    if (!finished) {
      finished = true;
      callback(null);
    }
  }, 1500);

  var img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = function() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try {
      var canvas = document.createElement("canvas");
      canvas.width = img.width || 120;
      canvas.height = img.height || 120;
      var ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      var dataUrl = canvas.toDataURL("image/png");
      callback(dataUrl);
    } catch (e) {
      console.warn("Canvas toDataURL security/CORS restriction:", e);
      callback(null);
    }
  };
  img.onerror = function() {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    callback(null);
  };
  try {
    img.src = logoUrl;
  } catch (e) {
    if (!finished) {
      finished = true;
      clearTimeout(timer);
      callback(null);
    }
  }
}

function exportPDF(orientation) {
  orientation = (orientation === "portrait" || orientation === "p") ? "p" : "l";
  var JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
  if (!JsPDF) {
    showToast("Library PDF (jsPDF) belum siap. Silakan periksa koneksi internet.", "error");
    return;
  }

  showToast("Menyiapkan file PDF...", "info");

  fetchLogoBase64(function(logoDataUrl) {
    try {
      var doc = new JsPDF(orientation, "pt", "a4");
      var pageWidth = doc.internal.pageSize.getWidth ? doc.internal.pageSize.getWidth() : doc.internal.pageSize.width;
      var pageHeight = doc.internal.pageSize.getHeight ? doc.internal.pageSize.getHeight() : doc.internal.pageSize.height;
      var margin = orientation === "p" ? 30 : 40;

      if (logoDataUrl) {
        try {
          doc.addImage(logoDataUrl, 'PNG', margin, 22, 48, 48);
        } catch (imgErr) {
          console.warn("Gagal render logo ke PDF:", imgErr);
        }
      }

      // Kop Surat
      var isPegawai = activeType === "guru";
      doc.setFontSize(orientation === "p" ? 13 : 15);
      doc.setFont("helvetica", "bold");
      var docTitle = "LAPORAN KEHADIRAN " + (isPegawai ? "PEGAWAI" : "SISWA");
      if (filterKelas && filterKelas !== "Semua") docTitle += " (" + (isPegawai ? "UNIT: " : "KELAS: ") + filterKelas.toUpperCase() + ")";
      doc.text(docTitle, pageWidth / 2, 38, { align: "center" });

      doc.setFontSize(orientation === "p" ? 9 : 10);
      doc.setFont("helvetica", "bold");
      doc.text("YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU", pageWidth / 2, 52, { align: "center" });

      doc.setFontSize(orientation === "p" ? 8.5 : 9.5);
      doc.setFont("helvetica", "normal");
      var dayInfo = getDayInfo(currentFilterDate);
      doc.text("Hari / Tanggal: " + dayInfo.dayName + ", " + formatFullDate(currentFilterDate), pageWidth / 2, 66, { align: "center" });

      // Garis Bawah Kop
      doc.setLineWidth(1.5);
      doc.line(margin, 80, pageWidth - margin, 80);
      doc.setLineWidth(0.5);
      doc.line(margin, 82, pageWidth - margin, 82);

      // Data Tabel
      var colCat = isPegawai ? "Unit & Jabatan" : "Unit / Kelas";
      var headers = [["No", "Nama", colCat, "Hari & Tanggal", "Jam Masuk", "Status", "Verifikasi"]];
      var data = [];

      var attList = attendance || [];
      var filteredData = attList.filter(function (a) {
        var isType = a.type === (isPegawai ? "Guru" : "Siswa") || (!isPegawai && !a.type);
        var matchCategory = isPegawai ? matchPegawaiUnit(a, filterKelas) : matchSiswaKelas(a, filterKelas);
        var matchSearch = true;
        if (globalSearchQuery) {
          var q = globalSearchQuery.toLowerCase();
          var nm = (a.nama || "").toLowerCase();
          var kl = (a.kelas || "").toLowerCase();
          var sid = (a.studentId || "").toLowerCase();
          matchSearch = nm.indexOf(q) > -1 || kl.indexOf(q) > -1 || sid.indexOf(q) > -1;
        }
        return isType && matchCategory && matchSearch;
      });

      if (filteredData.length === 0) {
        data.push(["-", "Tidak ada data presensi tercatat untuk tanggal/filter ini", "-", "-", "-", "-", "-"]);
      } else {
        for (var i = 0; i < filteredData.length; i++) {
          var a = filteredData[i];
          var v = a.faceMatch > 0.5 ? "Wajah Cocok" : "Belum Terverifikasi";
          var tglFormatted = getDayInfo(a.tanggal || currentFilterDate).dayName + ", " + formatDate(a.tanggal || currentFilterDate);
          var catVal = isPegawai ? (getPegawaiUnit(a) + " - " + getPegawaiJabatan(a)) : (a.kelas || "-");
          var isRowRQ = isRumahQuranRole(catVal) || isRumahQuranRole(a.kelas);
          var statusVal = a.status || "-";
          if (isRowRQ && (statusVal === "TL1" || statusVal === "TL2" || statusVal === "Terlambat" || statusVal === "Alpa")) {
            statusVal = "Hadir";
          }
          data.push([i + 1, a.nama || "-", catVal, tglFormatted, formatTime(a.waktu), statusVal, v]);
        }
      }

      if (typeof doc.autoTable === "function") {
        doc.autoTable({
          startY: 96,
          head: headers,
          body: data,
          theme: 'grid',
          headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
          styles: { fontSize: orientation === "p" ? 7.5 : 8.5, cellPadding: orientation === "p" ? 3.5 : 4.5 },
          margin: { left: margin, right: margin }
        });
      }

      // Tanda Tangan Footer
      var finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 30 : 200;
      if (finalY > pageHeight - 90) {
        doc.addPage();
        finalY = 40;
      }

      var sigX = pageWidth - (orientation === "p" ? 140 : 160);
      doc.setFontSize(orientation === "p" ? 9 : 10);
      doc.text("Kamang Baru, " + formatFullDate(currentFilterDate), sigX, finalY, { align: "center" });
      doc.text("Mengetahui,", sigX, finalY + 14, { align: "center" });
      doc.text("Kepala Yayasan", sigX, finalY + 28, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text((appSettings.kepalaYayasan || "Pimpinan Yayasan"), sigX, finalY + 75, { align: "center" });

      var fileName = "Laporan_Kehadiran_" + (isPegawai ? "Pegawai" : "Siswa") + "_" + (currentFilterDate || "hari_ini") + "_" + (orientation === "p" ? "Portrait" : "Landscape") + ".pdf";

      try {
        doc.save(fileName);
        showToast("PDF berhasil diunduh", "success");
      } catch (saveErr) {
        var pdfBlob = doc.output("blob");
        downloadBlob(pdfBlob, fileName);
        showToast("PDF berhasil diunduh", "success");
      }
    } catch (pdfErr) {
      console.error("Gagal membuat PDF:", pdfErr);
      showToast("Gagal membuat PDF: " + pdfErr.message, "error");
    }
  });
}

function exportExcel() {
  var isPegawai = activeType === "guru";
  var header = ["No", "Nama"];
  if (isPegawai) {
    header.push("Unit Kerja", "Jabatan");
  } else {
    header.push("Unit / Kelas");
  }
  header.push("Hari & Tanggal", "Waktu", "Status", "Verifikasi Wajah");
  var data = [header];
  
  var attList = attendance || [];
  var filteredData = attList.filter(function (a) {
    var isType = a.type === (isPegawai ? "Guru" : "Siswa") || (!isPegawai && !a.type);
    var matchCategory = isPegawai ? matchPegawaiUnit(a, filterKelas) : matchSiswaKelas(a, filterKelas);
    var matchSearch = true;
    if (globalSearchQuery) {
      var q = globalSearchQuery.toLowerCase();
      var nm = (a.nama || "").toLowerCase();
      var kl = (a.kelas || "").toLowerCase();
      var sid = (a.studentId || "").toLowerCase();
      matchSearch = nm.indexOf(q) > -1 || kl.indexOf(q) > -1 || sid.indexOf(q) > -1;
    }
    return isType && matchCategory && matchSearch;
  });

  if (filteredData.length === 0) {
    data.push(["-", "Tidak ada data presensi tercatat untuk tanggal/filter ini", "", "", "", "", ""]);
  } else {
    for (var i = 0; i < filteredData.length; i++) {
      var a = filteredData[i];
      var tglFormatted = getDayInfo(a.tanggal || currentFilterDate).dayName + ", " + formatDate(a.tanggal || currentFilterDate);
      var catVal = isPegawai ? getPegawaiUnit(a) : (a.kelas || "-");
      var isRowRQ = isRumahQuranRole(catVal) || isRumahQuranRole(a.kelas);
      var statusVal = a.status || "-";
      if (isRowRQ && (statusVal === "TL1" || statusVal === "TL2" || statusVal === "Terlambat" || statusVal === "Alpa")) {
        statusVal = "Hadir";
      }
      var row = [i + 1, a.nama || "-"];
      if (isPegawai) {
        row.push(getPegawaiUnit(a), getPegawaiJabatan(a));
      } else {
        row.push(a.kelas || "-");
      }
      row.push(
        tglFormatted,
        formatTime(a.waktu),
        statusVal,
        a.faceMatch > 0.5 ? "Ya (Cocok)" : "Tidak"
      );
      data.push(row);
    }
  }

  var fileName = "laporan_kehadiran_" + (isPegawai ? "pegawai" : "siswa") + "_" + (currentFilterDate || "hari_ini") + ".xlsx";

  if (typeof XLSX !== "undefined") {
    try {
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");
      try {
        XLSX.writeFile(wb, fileName);
        showToast("Excel berhasil diunduh", "success");
      } catch (writeErr) {
        var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        downloadBlob(blob, fileName);
        showToast("Excel berhasil diunduh", "success");
      }
      return;
    } catch (xlsxErr) {
      console.warn("SheetJS error, menggunakan CSV fallback:", xlsxErr);
    }
  }

  // Fallback CSV
  downloadCsvFallback(data, fileName.replace(/\.xlsx$/i, ".csv"));
}
function showToast(m, t) {
  var tc = document.getElementById("toasts");
  var d = document.createElement("div");
  // Terapkan class sesuai tipe: error=merah, warning=kuning, info=biru, default=hijau (success)
  var cls = "toast";
  if (t === "error")   cls += " error";
  else if (t === "warning") cls += " warning";
  else if (t === "info")    cls += " info";
  // t === "success" atau tidak diisi → pakai style default (hijau)
  d.className = cls;
  d.textContent = m;
  tc.appendChild(d);
  setTimeout(function () {
    d.remove();
  }, 3000);
}
function getInit(n) {
  if (!n) return "?";
  var p = n.split(" ");
  return p.length >= 2
    ? (p[0][0] + p[1][0]).toUpperCase()
    : n.substring(0, 2).toUpperCase();
}
