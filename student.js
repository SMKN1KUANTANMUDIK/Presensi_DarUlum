var currentStudent = null;
var videoStream = null;
var locationData = { lat: "", lng: "", alamat: "" };
var faceLoaded = false;
document.addEventListener("DOMContentLoaded", function () {
  lucide.createIcons();
  showOptions();
  loadFace(); // Pre-load FaceAPI models
});
var currentTeacherTab = "camera"; // "camera" | "history"
var currentHistoryMonth = new Date().getMonth() + 1;
var currentHistoryYear = new Date().getFullYear();

function isRumahQuranRole(roleStr) {
  var low = String(roleStr || "").toLowerCase();
  return low.indexOf("rumah quran") > -1 || low.indexOf("rumah qur'an") > -1;
}

function showOptions() {
  stopCam();
  var attBox = document.querySelector(".att-box");
  if (attBox) attBox.classList.remove("wide");
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<button class="opt-btn" onclick="startScanner()"><div class="opt-icon blue"><i data-lucide="scan-barcode"></i></div><div class="opt-text"><h3>Scan Barcode</h3><p>Pindai kartu pelajar / NIP</p></div></button>' +
    '<button class="opt-btn" onclick="showManual()"><div class="opt-icon green"><i data-lucide="keyboard"></i></div><div class="opt-text"><h3>Input Manual</h3><p>Ketik barcode / NIP</p></div></button>' +
    '<button class="opt-btn" onclick="showRiwayatManual()"><div class="opt-icon orange"><i data-lucide="history"></i></div><div class="opt-text"><h3>Riwayat Absen Pegawai</h3><p>Cek rekap kehadiran & riwayat NIP</p></div></button>' +
    '<button class="opt-btn" onclick="showSick()"><div class="opt-icon purple"><i data-lucide="thermometer"></i></div><div class="opt-text"><h3>Sakit / Izin</h3><p>Form tidak hadir</p></div></button>';
  lucide.createIcons();
}

function showManual() {
  stopCam();
  var attBox = document.querySelector(".att-box");
  if (attBox) attBox.classList.remove("wide");
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<div style="text-align:center;margin-bottom:15px"><div class="opt-icon green" style="margin:0 auto 10px"><i data-lucide="keyboard"></i></div><h3>Input Manual Barcode / NIP</h3><p style="color:var(--gray);font-size:13px">Masukkan ID untuk presensi atau cek riwayat</p></div>' +
    '<form onsubmit="handleManualSearchSubmit(event)">' +
      '<div class="form-group"><label class="form-label">Barcode / NIS / NIP</label><input type="text" class="form-input" id="barcode" placeholder="Ketik barcode / NIS / NIP..." autocomplete="off" required></div>' +
      '<button type="submit" class="btn btn-primary" style="width:100%"><i data-lucide="search" style="width:16px"></i> Cari Data</button>' +
      '<button type="button" class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showOptions()">Kembali</button>' +
    '</form>';
  lucide.createIcons();
  setTimeout(function() {
    var el = document.getElementById("barcode");
    if (el) el.focus();
  }, 100);
}

function handleManualSearchSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  findStudent();
}

function showRiwayatManual() {
  stopCam();
  var attBox = document.querySelector(".att-box");
  if (attBox) attBox.classList.remove("wide");
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<div style="text-align:center;margin-bottom:18px">' +
      '<div class="opt-icon orange" style="margin:0 auto 10px"><i data-lucide="history"></i></div>' +
      '<h3 style="margin:0 0 4px 0;font-size:18px;">Riwayat Absen Pegawai</h3>' +
      '<p style="color:var(--gray);font-size:13px;margin:0;">Masukkan NIP untuk melihat riwayat & rekap kehadiran Anda</p>' +
    '</div>' +
    '<form onsubmit="handleFindTeacherHistory(event)">' +
      '<div class="form-group">' +
        '<label class="form-label" style="font-weight:600;font-size:13px;">Nomor Induk Pegawai (NIP)</label>' +
        '<input type="text" class="form-input" id="nip-history-input" placeholder="Masukkan NIP (Contoh: 100101)" required style="height:44px;font-size:15px;" autocomplete="off">' +
      '</div>' +
      '<button type="submit" class="btn btn-primary" style="width:100%">' +
        '<i data-lucide="search" style="width:16px"></i> Lihat Riwayat Absen' +
      '</button>' +
      '<button type="button" class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showOptions()">' +
        'Kembali' +
      '</button>' +
    '</form>';
  lucide.createIcons();
  setTimeout(function() {
    var inp = document.getElementById("nip-history-input");
    if (inp) inp.focus();
  }, 100);
}

function handleFindTeacherHistory(e) {
  if (e && e.preventDefault) e.preventDefault();
  var inp = document.getElementById("nip-history-input");
  var bc = inp ? inp.value.trim() : "";
  if (!bc) {
    showToast("Masukkan NIP pegawai", "error");
    return;
  }
  findByCode(bc, "history");
}

function startScanner() {
  var attBox = document.querySelector(".att-box");
  if (attBox) attBox.classList.remove("wide");
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<div id="scanner" style="width:100%;height:260px;border-radius:12px;overflow:hidden;margin-bottom:15px"></div><button class="btn btn-outline" style="width:100%" onclick="stopScan();showOptions()">Batal</button>';
  try {
    window.scanner = new Html5Qrcode("scanner");
    window.scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 100 } },
      function (t) {
        stopScan();
        findByCode(t);
      },
      function () { },
    );
  } catch (e) {
    showToast("Error kamera pemindai", "error");
    showOptions();
  }
}
function stopScan() {
  if (window.scanner) {
    try {
      window.scanner.stop();
    } catch (e) { }
  }
}
function findStudent() {
  var el = document.getElementById("barcode");
  var bc = el ? el.value.trim() : "";
  if (!bc) {
    showToast("Masukkan barcode / NIP", "error");
    return;
  }
  findByCode(bc, "camera");
}
function findByCode(bc, initialTab) {
  stopCam();
  var c = document.getElementById("student-content");
  c.innerHTML =
    "<div style='text-align:center;padding:35px 20px;'><p><i data-lucide='loader' style='animation:spin 1s linear infinite;width:24px;height:24px;display:inline-block;vertical-align:-4px;margin-right:8px;color:var(--primary);'></i> Mencari data ke database...</p></div>";
  lucide.createIcons();

  window.callGasAPI(
    "getStudentByBarcode",
    { barcode: bc },
    function (r) {
      currentStudent = r.student;
      var isTeacher = (currentStudent.type === "guru" || (currentStudent.id && String(currentStudent.id).indexOf("TCH") === 0));
      if (isTeacher) {
        showTeacherPortal(initialTab || "camera");
      } else {
        showSelfie();
      }
    },
    function (err) {
      showToast("Data tidak ditemukan untuk barcode / NIP tersebut", "error");
      showOptions();
    },
  );
}
function getIndonesianMonthName(m) {
  var names = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];
  return names[m - 1] || "";
}

function getIndonesianDayName(dow) {
  var days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  return days[dow] || "";
}

function showTeacherPortal(tab) {
  currentTeacherTab = tab || "camera";
  var attBox = document.querySelector(".att-box");
  if (attBox) {
    if (currentTeacherTab === "history") attBox.classList.add("wide");
    else attBox.classList.remove("wide");
  }

  var c = document.getElementById("student-content");
  var nipDisplay = currentStudent.barcode || currentStudent.id || "-";
  var unitDisplay = currentStudent.kelas || "-";

  var h =
    '<div class="teacher-portal-header" style="text-align:center;margin-bottom:14px;">' +
      '<span class="badge" style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:3px 12px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:8px;">' +
        '<i data-lucide="briefcase" style="width:13px;height:13px"></i> PEGAWAI / GURU' +
      '</span>' +
      '<div class="avatar blue" style="width:52px;height:52px;font-size:18px;margin:0 auto 8px">' +
        getInit(currentStudent.nama) +
      '</div>' +
      '<h3 style="margin:0 0 4px 0;font-size:17px;font-weight:700;">' + currentStudent.nama + '</h3>' +
      '<p style="color:var(--gray);font-size:12px;margin:0;">' +
        'NIP: <strong style="color:var(--text);">' + nipDisplay + '</strong> &nbsp;•&nbsp; ' +
        '<span>' + unitDisplay + '</span>' +
      '</p>' +
    '</div>' +
    '<div class="teacher-portal-tabs">' +
      '<button class="t-tab-btn ' + (currentTeacherTab === 'camera' ? 'active' : '') + '" id="tab-btn-camera" onclick="switchTeacherTab(\'camera\')">' +
        '<i data-lucide="camera" style="width:15px;height:15px;"></i> Presensi Selfie' +
      '</button>' +
      '<button class="t-tab-btn ' + (currentTeacherTab === 'history' ? 'active' : '') + '" id="tab-btn-history" onclick="switchTeacherTab(\'history\')">' +
        '<i data-lucide="history" style="width:15px;height:15px;"></i> Riwayat Absen' +
      '</button>' +
    '</div>' +
    '<div id="teacher-tab-body"></div>';

  c.innerHTML = h;
  lucide.createIcons();

  if (currentTeacherTab === "camera") {
    renderTeacherCameraTab();
  } else {
    renderTeacherHistoryTab(currentHistoryMonth, currentHistoryYear);
  }
}

function switchTeacherTab(tab) {
  if (tab === currentTeacherTab) return;
  showTeacherPortal(tab);
}

function renderTeacherCameraTab() {
  locationData = { lat: "", lng: "", alamat: "" };
  getLoc();

  var bodyEl = document.getElementById("teacher-tab-body");
  if (!bodyEl) return;

  var kStr = String(currentStudent.kelas || "");
  var roleSelectHTML = "";

  if (kStr.indexOf(",") > -1) {
    var roles = kStr.split(",");
    roleSelectHTML = '<div style="margin:8px auto 14px; text-align:left;">' +
      '<label style="font-size:12px; font-weight:700; color:#334155; display:block; margin-bottom:5px;"><i data-lucide="layers" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;color:var(--primary);"></i> Pilih Unit Presensi Hari Ini:</label>' +
      '<select id="role-select" style="width:100%; display:block; padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:13px; background:#fff; font-weight:500;">';
    for (var i = 0; i < roles.length; i++) {
      var rClean = roles[i].trim();
      var isRQ = rClean.toLowerCase().indexOf("rumah quran") > -1 || rClean.toLowerCase().indexOf("rumah qur'an") > -1;
      var optLabel = isRQ ? '📖 Unit Rumah Qur\'an (Jadwal Bebas)' : '🏫 Unit ' + rClean + ' (Presensi Reguler)';
      roleSelectHTML += '<option value="' + rClean + '">' + optLabel + '</option>';
    }
    roleSelectHTML += '</select>' +
      '<small style="display:block;margin-top:4px;font-size:11px;color:var(--gray);">Pegawai dapat absen 2 kali terpisah hari ini: untuk Unit Reguler dan Unit Rumah Qur\'an (Semua hari aktif tanpa libur tertentu).</small>' +
      '</div>';
  }

  bodyEl.innerHTML =
    '<div class="teacher-quick-summary">' +
      '<span><i data-lucide="calendar" style="width:14px;height:14px;vertical-align:-2px;color:var(--primary);margin-right:4px;"></i> Rekap Kehadiran Bulan Ini</span>' +
      '<a onclick="switchTeacherTab(\'history\')">Lihat Riwayat &rarr;</a>' +
    '</div>' +
    roleSelectHTML +
    '<div class="camera-box"><video id="selfie-video" class="camera-video" autoplay playsinline></video></div>' +
    '<div class="face-status loading" id="fs">Memuat kamera...</div>' +
    '<div class="loc-info" id="li"><i data-lucide="map-pin" style="width:14px"></i>Mendeteksi lokasi...</div>' +
    '<button class="btn btn-success" style="width:100%" id="sbtn" disabled onclick="captureSubmit()">' +
      '<i data-lucide="camera" style="width:16px"></i> Absen Sekarang' +
    '</button>' +
    '<button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="stopCam();showOptions()">' +
      'Batal' +
    '</button>';

  lucide.createIcons();
  startSelfie();
}

function renderTeacherHistoryTab(m, y) {
  stopCam();
  var bodyEl = document.getElementById("teacher-tab-body");
  if (!bodyEl) return;

  var monthOptions = "";
  for (var mi = 1; mi <= 12; mi++) {
    monthOptions += '<option value="' + mi + '" ' + (mi === m ? 'selected' : '') + '>' + getIndonesianMonthName(mi) + '</option>';
  }

  var currentYr = new Date().getFullYear();
  var yearOptions = "";
  for (var yi = currentYr - 1; yi <= currentYr + 1; yi++) {
    yearOptions += '<option value="' + yi + '" ' + (yi === y ? 'selected' : '') + '>' + yi + '</option>';
  }

  bodyEl.innerHTML =
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:14px;">' +
      '<div style="flex:1.5;">' +
        '<label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:3px;">Pilih Bulan:</label>' +
        '<select id="th-month" class="form-select" style="width:100%;padding:8px 10px;font-size:13px;" onchange="onTeacherHistoryFilterChange()">' +
          monthOptions +
        '</select>' +
      '</div>' +
      '<div style="flex:1;">' +
        '<label style="font-size:11px;font-weight:700;color:var(--text-muted);display:block;margin-bottom:3px;">Tahun:</label>' +
        '<select id="th-year" class="form-select" style="width:100%;padding:8px 10px;font-size:13px;" onchange="onTeacherHistoryFilterChange()">' +
          yearOptions +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div id="th-content-box">' +
      '<div style="text-align:center;padding:35px 20px;color:var(--gray);">' +
        '<i data-lucide="loader" style="width:24px;height:24px;animation:spin 1s linear infinite;color:var(--primary);margin-bottom:10px;"></i>' +
        '<p style="font-size:13px;margin:0;">Memuat riwayat kehadiran...</p>' +
      '</div>' +
    '</div>';

  lucide.createIcons();
  fetchAndRenderTeacherHistory(m, y);
}

var currentTeacherFilterUnit = "all";
var teacherCachedRecap = null;
var teacherCachedToday = null;

function onTeacherHistoryFilterChange() {
  var mEl = document.getElementById("th-month");
  var yEl = document.getElementById("th-year");
  if (mEl) currentHistoryMonth = parseInt(mEl.value, 10);
  if (yEl) currentHistoryYear = parseInt(yEl.value, 10);
  renderTeacherHistoryTab(currentHistoryMonth, currentHistoryYear);
}

function selectTeacherUnitFilter(unitName) {
  currentTeacherFilterUnit = unitName;
  if (teacherCachedRecap) {
    renderTeacherHistoryContent(teacherCachedRecap, teacherCachedToday, currentHistoryMonth, currentHistoryYear);
  }
}

function fetchAndRenderTeacherHistory(m, y) {
  var contentBox = document.getElementById("th-content-box");
  if (!contentBox) return;

  var now = new Date();
  var isCurrentMonth = (m === (now.getMonth() + 1) && y === now.getFullYear());

  window.callGasAPI(
    "getMonthlyRecap",
    { month: m, year: y, type: "guru" },
    function (recapRes) {
      teacherCachedRecap = recapRes;
      if (isCurrentMonth) {
        window.callGasAPI(
          "getAttendanceToday",
          {},
          function (todayRes) {
            teacherCachedToday = todayRes;
            renderTeacherHistoryContent(recapRes, todayRes, m, y);
          },
          function () {
            teacherCachedToday = null;
            renderTeacherHistoryContent(recapRes, null, m, y);
          }
        );
      } else {
        teacherCachedToday = null;
        renderTeacherHistoryContent(recapRes, null, m, y);
      }
    },
    function (err) {
      contentBox.innerHTML =
        '<div style="text-align:center;padding:30px 15px;color:var(--danger);">' +
          '<i data-lucide="alert-circle" style="width:32px;height:32px;margin-bottom:8px;"></i>' +
          '<p style="font-size:13px;font-weight:600;margin:0 0 12px 0;">Gagal memuat riwayat: ' + err + '</p>' +
          '<button class="btn btn-outline btn-sm" onclick="fetchAndRenderTeacherHistory(' + m + ',' + y + ')">Coba Lagi</button>' +
        '</div>';
      lucide.createIcons();
    }
  );
}

function renderTeacherHistoryContent(recapRes, todayRes, m, y) {
  var contentBox = document.getElementById("th-content-box");
  if (!contentBox) return;

  var mySid = String(currentStudent.id || "").replace(/#.*$/, "").trim();
  var myBarcode = String(currentStudent.barcode || "").trim();

  var matched = [];
  if (recapRes && recapRes.students) {
    matched = recapRes.students.filter(function (s) {
      var sid = String(s.originalId || s.id || "").replace(/#.*$/, "").trim();
      return sid === mySid || s.id === mySid || (myBarcode && String(s.barcode).trim() === myBarcode);
    });
    matched.forEach(function (ent) {
      var kClean = String(ent.kelas || "").trim();
      var jClean = String(ent.jabatan || "").trim();
      if (isRumahQuranRole(kClean) || isRumahQuranRole(jClean)) {
        ent.isRumahQuran = true;
      }
    });
  }

  if (matched.length === 0) {
    contentBox.innerHTML =
      '<div style="text-align:center;padding:35px 20px;color:var(--gray);">' +
        '<i data-lucide="calendar-x" style="width:32px;height:32px;margin-bottom:8px;color:var(--gray);"></i>' +
        '<p style="font-size:13px;margin:0;">Tidak ditemukan catatan riwayat untuk NIP ini pada ' + getIndonesianMonthName(m) + ' ' + y + '.</p>' +
        '<div style="margin-top:16px;">' +
          '<button class="btn btn-success btn-sm" onclick="switchTeacherTab(\'camera\')"><i data-lucide="camera" style="width:14px"></i> Ambil Absen</button>' +
        '</div>' +
      '</div>';
    lucide.createIcons();
    return;
  }

  // Identifikasi Semua Unit / Jabatan yang dimiliki Pegawai
  var availableUnits = [];
  matched.forEach(function (ent) {
    var u = String(ent.kelas || "").trim();
    if (u && !availableUnits.includes(u)) availableUnits.push(u);
  });
  if (currentStudent && currentStudent.kelas) {
    var rawK = String(currentStudent.kelas);
    if (rawK.indexOf(",") > -1) {
      rawK.split(",").forEach(function (p) {
        var clean = p.trim();
        if (clean && !availableUnits.includes(clean)) availableUnits.push(clean);
      });
    } else if (rawK.trim() && !availableUnits.includes(rawK.trim())) {
      availableUnits.push(rawK.trim());
    }
  }

  // Filter Entitas Sesuai Pilihan Unit / Jabatan
  var activeEntities = matched;
  if (currentTeacherFilterUnit !== "all") {
    activeEntities = matched.filter(function (ent) {
      var ek = String(ent.kelas || "").toLowerCase();
      var uk = String(currentTeacherFilterUnit).toLowerCase();
      return ek.indexOf(uk) > -1 || uk.indexOf(ek) > -1;
    });
    if (activeEntities.length === 0) activeEntities = matched;
  }

  // Agregasi Totals Berdasarkan Unit Aktif
  var totals = { H: 0, T: 0, S: 0, I: 0, A: 0 };
  var isFilterRQ = isRumahQuranRole(currentTeacherFilterUnit);
  var isCurrentEntRQ = activeEntities.length > 0 && activeEntities.every(function (ent) { 
    return ent.isRumahQuran || isRumahQuranRole(ent.kelas) || isRumahQuranRole(ent.jabatan); 
  });
  var isPureRQ = isFilterRQ || isCurrentEntRQ;

  activeEntities.forEach(function (ent) {
    if (ent.totals) {
      totals.H += (ent.totals.H || 0);
      totals.T += (ent.totals.T || 0);
      totals.S += (ent.totals.S || 0);
      totals.I += (ent.totals.I || 0);
      totals.A += (ent.totals.A || 0);
    }
  });

  // Jika Rumah Qur'an: tidak ada keterlambatan dan tidak ada alpa (semua hari bisa digunakan)
  if (isPureRQ) {
    totals.H += (totals.T || 0);
    totals.T = 0;
    totals.A = 0;
  }

  // Today Attendance Map
  var todayRecords = [];
  if (todayRes && todayRes.attendance) {
    todayRecords = todayRes.attendance.filter(function (att) {
      var asid = String(att.studentId || "").trim();
      var matchId = (asid === mySid || asid === currentStudent.id);
      if (!matchId) return false;
      if (currentTeacherFilterUnit !== "all") {
        var attK = String(att.kelas || "").toLowerCase();
        var fuk = String(currentTeacherFilterUnit).toLowerCase();
        return attK.indexOf(fuk) > -1 || fuk.indexOf(attK) > -1;
      }
      return true;
    });
  }

  // Filter Bar Unit / Jabatan (Jika Pegawai Memiliki > 1 Unit)
  var unitFilterHTML = "";
  if (availableUnits.length > 1) {
    unitFilterHTML =
      '<div style="margin-bottom:14px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:10px 12px;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
          '<span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;"><i data-lucide="layers" style="width:12px;height:12px;vertical-align:-1px;margin-right:4px;color:var(--primary);"></i> Pilihan Unit / Jabatan:</span>' +
          (currentTeacherFilterUnit !== "all" ? '<span style="font-size:11px;color:var(--primary);font-weight:700;">' + currentTeacherFilterUnit + '</span>' : '<span style="font-size:11px;color:var(--gray);">Semua Unit</span>') +
        '</div>' +
        '<div class="teacher-unit-pills">' +
          '<button type="button" class="t-unit-pill ' + (currentTeacherFilterUnit === "all" ? "active" : "") + '" onclick="selectTeacherUnitFilter(\'all\')">' +
            '<i data-lucide="layers" style="width:13px;height:13px;"></i> Semua Unit' +
          '</button>';

    availableUnits.forEach(function (u) {
      var isRQ = u.toLowerCase().indexOf("rumah quran") > -1 || u.toLowerCase().indexOf("rumah qur'an") > -1;
      var iconName = isRQ ? "book-open" : "school";
      var activeCls = currentTeacherFilterUnit === u ? "active" : "";
      unitFilterHTML +=
        '<button type="button" class="t-unit-pill ' + activeCls + '" onclick="selectTeacherUnitFilter(\'' + u.replace(/'/g, "\\'") + '\')">' +
          '<i data-lucide="' + iconName + '" style="width:13px;height:13px;"></i> ' + u +
        '</button>';
    });

    unitFilterHTML += '</div></div>';
  } else if (availableUnits.length === 1) {
    unitFilterHTML =
      '<div style="margin-bottom:12px;padding:6px 12px;background:var(--bg);border-radius:8px;border:1px solid var(--border);font-size:12px;color:var(--text-muted);display:flex;align-items:center;justify-content:space-between;">' +
        '<span>Unit / Jabatan:</span><strong style="color:var(--text);">' + availableUnits[0] + '</strong>' +
      '</div>';
  }

  // Stats Cards Grid
  var statsHTML =
    '<div class="teacher-stats-grid">' +
      '<div class="t-stat-card stat-h">' +
        '<span class="t-stat-num">' + totals.H + '</span>' +
        '<span class="t-stat-label">Hadir</span>' +
      '</div>' +
      '<div class="t-stat-card stat-t">' +
        '<span class="t-stat-num">' + totals.T + '</span>' +
        '<span class="t-stat-label">Terlambat</span>' +
      '</div>' +
      '<div class="t-stat-card stat-i">' +
        '<span class="t-stat-num">' + totals.I + '</span>' +
        '<span class="t-stat-label">Izin</span>' +
      '</div>' +
      '<div class="t-stat-card stat-s">' +
        '<span class="t-stat-num">' + totals.S + '</span>' +
        '<span class="t-stat-label">Sakit</span>' +
      '</div>' +
      '<div class="t-stat-card stat-a">' +
        '<span class="t-stat-num">' + totals.A + '</span>' +
        '<span class="t-stat-label">Alpa</span>' +
      '</div>' +
    '</div>';

  var daysInMonth = recapRes.daysInMonth || new Date(y, m, 0).getDate();
  var now = new Date();
  var isCurrentMonth = (m === (now.getMonth() + 1) && y === now.getFullYear());
  var todayDate = now.getDate();

  var listHTML = '<div class="teacher-history-list">';
  var shortDayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  // Urutkan dari hari terakhir (atau hari ini) menurun ke tanggal 1
  for (var d = daysInMonth; d >= 1; d--) {
    var dObj = new Date(y, m - 1, d);
    var dow = dObj.getDay();
    var isWeekend = (dow === 0 || dow === 6);
    var mPad = m < 10 ? "0" + m : "" + m;
    var dPad = d < 10 ? "0" + d : "" + d;
    var isoKey = y + "-" + mPad + "-" + dPad;

    var hMgr = window.HolidayManager;
    var holidayInfo = hMgr ? hMgr.getHoliday(isoKey) : null;
    var isNatHoliday = !!(holidayInfo && holidayInfo.isHoliday);

    var isToday = (isCurrentMonth && d === todayDate);
    var isFuture = (isCurrentMonth && d > todayDate) || (y > now.getFullYear()) || (y === now.getFullYear() && m > (now.getMonth() + 1));

    // Dapatkan status dari matched entities aktif
    var dayCodes = [];
    activeEntities.forEach(function (ent) {
      if (ent.days && ent.days[d]) {
        dayCodes.push({
          role: ent.kelas || ent.roleType || "",
          code: ent.days[d],
          isRQ: ent.isRumahQuran
        });
      }
    });

    var primaryCode = "-";
    var roleLabelInfo = "";
    if (dayCodes.length > 0) {
      var present = dayCodes.find(function (dc) { return dc.code && dc.code !== "-" && dc.code !== "A"; });
      if (present) {
        primaryCode = present.code;
        roleLabelInfo = present.role;
      } else {
        primaryCode = dayCodes[0].code;
        roleLabelInfo = dayCodes[0].role;
      }
    }

    var badgeHTML = "";
    var isFilterRQ = isRumahQuranRole(currentTeacherFilterUnit);
    var isCurrentEntRQ = activeEntities.length > 0 && activeEntities.every(function (ent) { 
      return ent.isRumahQuran || isRumahQuranRole(ent.kelas) || isRumahQuranRole(ent.jabatan); 
    });
    var isPureRQ = isFilterRQ || isCurrentEntRQ;

    var statusText = "";
    var rowClass = "history-row-item";
    var timeDisplay = "";

    if (isToday) rowClass += " today";
    else if (!isPureRQ && isNatHoliday) rowClass += " holiday";
    else if (!isPureRQ && isWeekend) rowClass += " weekend";

    if (isFuture) {
      badgeHTML = '<span style="font-size:11px;color:var(--gray);font-style:italic;">Belum berjalan</span>';
      statusText = isPureRQ ? "Rumah Qur'an (Semua Hari Aktif)" : (isWeekend ? (dow === 0 ? "Minggu (Akhir Pekan)" : "Sabtu (Akhir Pekan)") : (isNatHoliday ? holidayInfo.name : "Hari Belajar"));
    } else if (primaryCode === "H" || (isPureRQ && (primaryCode === "T" || primaryCode === "TL1" || primaryCode === "TL2"))) {
      badgeHTML = '<span class="badge badge-success" style="font-size:11px;padding:3px 8px;">Hadir</span>';
      statusText = isPureRQ ? "Hadir (Jadwal Bebas)" : "Tepat Waktu";
    } else if (primaryCode === "TL1") {
      badgeHTML = '<span class="badge badge-tl1" style="font-size:11px;padding:3px 8px;">TL1 (≤ 30m)</span>';
      statusText = "Terlambat Toleransi 1";
    } else if (primaryCode === "TL2") {
      badgeHTML = '<span class="badge badge-tl2" style="font-size:11px;padding:3px 8px;">TL2 (31-60m)</span>';
      statusText = "Terlambat Toleransi 2";
    } else if (primaryCode === "T") {
      badgeHTML = '<span class="badge badge-warning" style="font-size:11px;padding:3px 8px;">Terlambat</span>';
      statusText = "Terlambat";
    } else if (primaryCode === "S") {
      badgeHTML = '<span class="badge badge-sakit" style="font-size:11px;padding:3px 8px;">Sakit</span>';
      statusText = "Surat Keterangan Sakit";
    } else if (primaryCode === "I") {
      badgeHTML = '<span class="badge badge-izin" style="font-size:11px;padding:3px 8px;">Izin</span>';
      statusText = "Pengajuan Izin";
    } else if (primaryCode === "A") {
      badgeHTML = '<span class="badge badge-alpa" style="font-size:11px;padding:3px 8px;">Alpa</span>';
      statusText = "Tidak Mengisi Presensi";
    } else {
      // Code is "-"
      if (isPureRQ) {
        badgeHTML = '<span class="badge badge-free" style="font-size:11px;padding:3px 8px;">Bebas</span>';
        statusText = "Rumah Qur'an - Tidak Ada Hari Libur Tertentu (Semua Hari Aktif)";
      } else if (isNatHoliday) {
        badgeHTML = '<span class="badge badge-holiday" style="font-size:11px;padding:3px 8px;"><i data-lucide="star" style="width:10px;height:10px;vertical-align:-1px;"></i> Libur</span>';
        statusText = "Libur Nasional: " + holidayInfo.name;
      } else if (isWeekend) {
        badgeHTML = '<span class="badge badge-holiday" style="font-size:11px;padding:3px 8px;">Libur</span>';
        statusText = (dow === 0 ? "Minggu (Akhir Pekan)" : "Sabtu (Akhir Pekan)");
      } else if (activeEntities.some(function (ent) { return ent.isRumahQuran || isRumahQuranRole(ent.kelas) || isRumahQuranRole(ent.jabatan); })) {
        badgeHTML = '<span class="badge badge-free" style="font-size:11px;padding:3px 8px;">Bebas</span>';
        statusText = "Rumah Qur'an - Semua Hari Aktif (Jadwal Bebas)";
      } else {
        badgeHTML = '<span class="badge badge-secondary" style="font-size:11px;padding:3px 8px;">-</span>';
        statusText = "-";
      }
    }

    // Detail jam jika hari ini dan ada di todayRecords
    if (isToday && todayRecords.length > 0) {
      var latestRec = todayRecords[0];
      if (latestRec.waktu) timeDisplay = latestRec.waktu.substring(0, 5) + " WIB";
      if (latestRec.keterangan) statusText = latestRec.keterangan;
    }

    // Tambahkan label unit jika sedang menampilkan 'Semua Unit' dan ada indikasi role
    if (currentTeacherFilterUnit === "all" && roleLabelInfo) {
      statusText += ' • ' + roleLabelInfo;
    }

    var fullDateStr = getIndonesianDayName(dow) + ", " + d + " " + getIndonesianMonthName(m) + " " + y;
    var todayIndicator = isToday ? ' <span style="background:#dcfce7;color:#15803d;padding:1px 6px;border-radius:6px;font-size:10px;font-weight:700;">HARI INI</span>' : '';

    listHTML +=
      '<div class="' + rowClass + '">' +
        '<div class="history-row-left">' +
          '<div class="history-day-circle">' +
            '<strong>' + d + '</strong>' +
            '<span>' + shortDayNames[dow] + '</span>' +
          '</div>' +
          '<div class="history-detail-text">' +
            '<h4>' + fullDateStr + todayIndicator + '</h4>' +
            '<p title="' + statusText + '">' + (timeDisplay ? '<strong style="color:var(--text);">' + timeDisplay + '</strong> &nbsp;•&nbsp; ' : '') + statusText + '</p>' +
          '</div>' +
        '</div>' +
        '<div class="history-row-right">' +
          badgeHTML +
        '</div>' +
      '</div>';
  }
  listHTML += '</div>';

  var actionsHTML =
    '<div style="display:flex;gap:10px;margin-top:14px;">' +
      '<button class="btn btn-outline" style="flex:1;justify-content:center;" onclick="showOptions()">' +
        '<i data-lucide="arrow-left" style="width:15px"></i> Menu Awal' +
      '</button>' +
      '<button class="btn btn-success" style="flex:1.2;justify-content:center;" onclick="switchTeacherTab(\'camera\')">' +
        '<i data-lucide="camera" style="width:15px"></i> Absen Sekarang' +
      '</button>' +
    '</div>';

  contentBox.innerHTML = unitFilterHTML + statsHTML + listHTML + actionsHTML;
  lucide.createIcons();
}


function showSelfie() {
  locationData = { lat: "", lng: "", alamat: "" };
  getLoc();
  var c = document.getElementById("student-content");
  var kStr = String(currentStudent.kelas || "");
  var roleHTML = "";
  var isTeacher = (currentStudent.type === "guru" || (currentStudent.id && String(currentStudent.id).indexOf("TCH") === 0));
  var labelText = isTeacher ? "Pilih Unit Presensi Hari Ini" : "Pilih Kelas / Unit";
  var catBadge = isTeacher 
    ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="briefcase" style="width:12px;height:12px"></i> PEGAWAI / GURU</span>'
    : '<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="graduation-cap" style="width:12px;height:12px"></i> SISWA</span>';

  if (kStr.indexOf(",") > -1) {
    var roles = kStr.split(",");
    roleHTML = '<div style="margin:8px auto 14px; max-width:320px; text-align:left;">' +
      '<label style="font-size:12px; font-weight:700; color:#334155; display:block; margin-bottom:5px;"><i data-lucide="layers" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;color:var(--primary);"></i> ' + labelText + ':</label>' +
      '<select id="role-select" style="width:100%; display:block; padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:13px; background:#fff; font-weight:500;">';
    for (var i = 0; i < roles.length; i++) {
      var rClean = roles[i].trim();
      var isRQ = rClean.toLowerCase().indexOf("rumah quran") > -1 || rClean.toLowerCase().indexOf("rumah qur'an") > -1;
      var optLabel = isTeacher 
        ? (isRQ ? '📖 Unit Rumah Qur\'an (Jadwal Bebas)' : '🏫 Unit ' + rClean + ' (Presensi Reguler)') 
        : rClean;
      roleHTML += '<option value="' + rClean + '">' + optLabel + '</option>';
    }
    roleHTML += '</select>' +
      '<small style="display:block;margin-top:4px;font-size:11px;color:var(--gray);">Pegawai dapat absen 2 kali terpisah hari ini: untuk Unit Reguler dan Unit Rumah Qur\'an.</small>' +
      '</div>';
  } else {
    var isSingleRQ = isRumahQuranRole(kStr);
    var unitTag = isSingleRQ ? "📖 Rumah Qur'an (Semua Hari Aktif • Jadwal Bebas)" : (isTeacher ? "Unit " + (currentStudent.kelas || "-") : (currentStudent.kelas || "-"));
    var rqNote = isSingleRQ ? '<div style="margin-top:4px;font-size:12px;color:#047857;font-weight:600;"><i data-lucide="sparkles" style="width:13px;height:13px;vertical-align:-1px;margin-right:4px;"></i> Semua Hari Aktif (Tanpa Libur Tertentu)</div>' : '';
    roleHTML = '<p style="color:var(--gray); margin-top:4px;"><span style="display:inline-block; background:' + (isSingleRQ ? '#ecfdf5;color:#065f46;border:1px solid #a7f3d0' : '#e0f2fe;color:#0369a1') + '; padding:3px 12px; border-radius:12px; font-size:13px; font-weight:600;">' + unitTag + '</span>' + rqNote + '</p>';
  }

  c.innerHTML =
    '<div style="text-align:center;margin-bottom:20px">' + catBadge + '<div class="avatar blue" style="width:60px;height:60px;font-size:20px;margin:0 auto 10px">' +
    getInit(currentStudent.nama) +
    "</div><h3>" +
    currentStudent.nama +
    '</h3>' + roleHTML +
    '</div><div class="camera-box"><video id="selfie-video" class="camera-video" autoplay playsinline></video></div><div class="face-status loading" id="fs">Memuat...</div><div class="loc-info" id="li"><i data-lucide="map-pin" style="width:14px"></i>Mendeteksi lokasi...</div><button class="btn btn-success" style="width:100%" id="sbtn" disabled onclick="captureSubmit()"><i data-lucide="camera" style="width:16px"></i> Absen Sekarang</button><button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="stopCam();showOptions()">Batal</button>';
  lucide.createIcons();
  startSelfie();
}
function startSelfie() {
  navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } })
    .then(function (s) {
      videoStream = s;
      document.getElementById("selfie-video").srcObject = s;
      loadFace();
    })
    .catch(function () {
      document.getElementById("fs").className = "face-status error";
      document.getElementById("fs").textContent = "Gagal kamera";
    });
}
function stopCam() {
  if (videoStream) {
    videoStream.getTracks().forEach(function (t) {
      t.stop();
    });
    videoStream = null;
  }
}
function loadFace() {
  // Helper: update UI hanya jika elemen selfie sudah dirender oleh showSelfie()
  function setFaceStatus(cls, text) {
    var fsEl = document.getElementById("fs");
    var sbtnEl = document.getElementById("sbtn");
    if (fsEl) {
      fsEl.className = "face-status " + cls;
      fsEl.textContent = text;
    }
    if (sbtnEl && cls === "success") {
      sbtnEl.disabled = false;
    }
  }

  // Jika model sudah pernah dimuat sebelumnya, langsung update UI (jika ada)
  if (faceLoaded) {
    setFaceStatus("success", "Siap!");
    return;
  }

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
      faceLoaded = true;
      // Update UI hanya jika halaman selfie sedang aktif
      setFaceStatus("success", "Siap!");
    })
    .catch(function (err) {
      console.error("FaceAPI load error:", err);
      // Hanya tampilkan error di UI jika elemen selfie sudah ada
      setFaceStatus("error", "Gagal memuat model wajah");
    });
}
function getLoc() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (p) {
        locationData.lat = p.coords.latitude;
        locationData.lng = p.coords.longitude;
        locationData.accuracy = p.coords.accuracy;
        locationData.altitude = p.coords.altitude;
        fetch(
          "https://nominatim.openstreetmap.org/reverse?format=json&lat=" +
          p.coords.latitude +
          "&lon=" +
          p.coords.longitude,
        )
          .then(function (r) {
            return r.json();
          })
          .then(function (d) {
            locationData.alamat = d.display_name || "";
            document.getElementById("li").innerHTML =
              '<i data-lucide="map-pin" style="width:14px;color:var(--success)"></i>' +
              locationData.alamat.substring(0, 40) +
              "...";
            lucide.createIcons();
          })
          .catch(function (err) {
            locationData.alamat = "Lat: " + p.coords.latitude + ", Lng: " + p.coords.longitude;
            document.getElementById("li").innerHTML =
              '<i data-lucide="map-pin" style="width:14px;color:var(--warning)"></i>Lokasi didapatkan (koordinat)';
            lucide.createIcons();
          });
      },
      function (err) {
        document.getElementById("li").innerHTML =
          '<i data-lucide="map-pin" style="width:14px;color:var(--danger)"></i>Lokasi tidak tersedia / Ditolak';
        lucide.createIcons();
      },
      {
        enableHighAccuracy: true, // Memaksa chip GPS fisik menyala, bukan sekadar dari BTS/Sinyal
        maximumAge: 0,            // Jangan gunakan lokasi cache yang lama (mencegah Fake GPS diam)
        timeout: 10000            // Maksimal waktu cari sinyal satelit
      }
    );
  }
}

function captureSubmit() {
  if (!locationData.lat || !locationData.lng) {
    showToast("Mohon tunggu, sedang mendeteksi lokasi Anda...", "error");
    return;
  }

  // 1. Anti-Fake GPS: Akurasi harus di bawah 150 meter. 
  // Fake GPS abal-abal / Sinyal buruk sering tembus > 500m.
  if (locationData.accuracy && locationData.accuracy > 150) {
    showToast("Akurasi GPS buruk (" + Math.round(locationData.accuracy) + "m). Harap keluar ruangan/matikan Fake GPS.", "error");
    return;
  }

  var targetLat = -0.8672131613430705;
  var targetLng = 101.37821257931239;
  var distance = getDistanceFromLatLonInM(targetLat, targetLng, locationData.lat, locationData.lng);

  if (distance > 1000) {
    showToast("Gagal: Anda berada di luar radius absensi (" + Math.round(distance) + " meter dari target)", "error");
    return;
  }

  var v = document.getElementById("selfie-video");
  if (!v || !v.videoWidth) {
    showToast("Kamera belum siap, mohon tunggu sebentar...", "error");
    return;
  }

  // 1. Ambil capture resolusi tinggi dari video sebelum kamera dimatikan
  var previewCanvas = document.createElement("canvas");
  previewCanvas.width = v.videoWidth;
  previewCanvas.height = v.videoHeight;
  var pctx = previewCanvas.getContext("2d");
  pctx.drawImage(v, 0, 0, previewCanvas.width, previewCanvas.height);
  var previewUrl = previewCanvas.toDataURL("image/jpeg", 0.9);

  // 2. Bekukan tampilan kamera dengan foto capturean (Layar TIDAK akan menjadi hitam!)
  var camBox = document.querySelector(".camera-box");
  if (camBox) {
    camBox.innerHTML = 
      '<img id="frozen-capture" src="' + previewUrl + '" class="camera-video" style="object-fit:cover; display:block;">' +
      '<div class="camera-badge"><i data-lucide="camera" style="width:14px;height:14px;"></i> Foto Terambil</div>' +
      '<div class="camera-flash" id="cam-flash"></div>';
    lucide.createIcons();

    // Efek flash kamera saat memotret
    var flashEl = document.getElementById("cam-flash");
    if (flashEl) {
      flashEl.style.opacity = "0.75";
      setTimeout(function() { flashEl.style.opacity = "0"; }, 150);
    }
  }

  // Hentikan hardware kamera fisik di background (preview foto tetap tampak jelas)
  stopCam();

  var fsEl = document.getElementById("fs");
  var sbtnEl = document.getElementById("sbtn");
  if (fsEl) {
    fsEl.className = "face-status loading";
    fsEl.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;display:inline-block;animation:spin 1s linear infinite;margin-right:6px;vertical-align:-2px;"></i> Memverifikasi wajah...';
    lucide.createIcons();
  }
  if (sbtnEl) {
    sbtnEl.disabled = true;
    sbtnEl.innerHTML = '<i data-lucide="loader" style="width:16px;height:16px;display:inline-block;animation:spin 1s linear infinite;margin-right:6px;vertical-align:-2px;"></i> Memproses Absen...';
    lucide.createIcons();
  }

  // 3. Canvas untuk FaceAPI & data upload ke Google Drive
  var cv = document.createElement("canvas");
  var maxWidth = 200;
  var scale = maxWidth / previewCanvas.width;
  cv.width = maxWidth;
  cv.height = previewCanvas.height * scale;
  cv.getContext("2d").drawImage(previewCanvas, 0, 0, cv.width, cv.height);

  faceapi
    .detectSingleFace(cv, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
    .then(function (d) {
      if (!d) {
        if (fsEl) {
          fsEl.className = "face-status error";
          fsEl.textContent = "Wajah tidak terdeteksi. Silakan coba lagi.";
        }
        if (sbtnEl) {
          sbtnEl.disabled = false;
          sbtnEl.innerHTML = '<i data-lucide="camera" style="width:16px;"></i> Absen Sekarang';
          lucide.createIcons();
        }
        // Kembalikan video aktif jika tidak terdeteksi
        if (camBox) {
          camBox.innerHTML = '<video id="selfie-video" class="camera-video" autoplay playsinline></video>';
          startSelfie();
        }
        return;
      }
      var desc = d.descriptor;
      var targetDesc = currentStudent.faceDescriptor;
      while (typeof targetDesc === 'string') {
        try {
          targetDesc = JSON.parse(targetDesc);
        } catch (e) {
          targetDesc = null;
          break;
        }
      }

      var fm = 0;
      var newDesc = null;
      if (targetDesc && targetDesc.length > 0) {
        var dist = faceapi.euclideanDistance(
          desc,
          targetDesc,
        );
        fm = Math.max(0, 1 - dist);

        // Validasi Anti-Bypass: Jika wajah tidak cocok, tolak absensi dan jangan kirim ke server
        if (fm < 0.5) {
          showToast("Wajah tidak cocok ! Silakan coba lagi", "error");
          if (fsEl) {
            fsEl.className = "face-status error";
            fsEl.textContent = "Wajah tidak cocok ! Silakan coba lagi";
          }
          if (sbtnEl) {
            sbtnEl.disabled = false;
            sbtnEl.innerHTML = '<i data-lucide="camera" style="width:16px;"></i> Absen Sekarang';
            lucide.createIcons();
          }
          if (camBox) {
            camBox.innerHTML = '<video id="selfie-video" class="camera-video" autoplay playsinline></video>';
            startSelfie();
          }
          return;
        }
      } else {
        // Tetap diizinkan rekam wajah saat absensi pertama kali
        fm = 1.0;
        newDesc = Array.from(desc);
      }
      var photo = cv.toDataURL("image/jpeg", 0.3);

      var selectedRole = currentStudent.kelas;
      var roleSelect = document.getElementById("role-select");
      if (roleSelect) {
        selectedRole = roleSelect.value;
      }

      var payload = {
        studentId: currentStudent.id,
        nama: currentStudent.nama,
        kelas: selectedRole,
        fotoAbsen: photo,
        faceMatch: fm,
        latitude: locationData.lat,
        longitude: locationData.lng,
        alamat: locationData.alamat,
        newDescriptor: newDesc
      };

      if (fsEl) {
        fsEl.className = "face-status loading";
        fsEl.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;display:inline-block;animation:spin 1s linear infinite;margin-right:6px;vertical-align:-2px;"></i> Menyimpan absensi ke database...';
        lucide.createIcons();
      }

      window.callGasAPI(
        "recordAttendance",
        payload,
        function (r) {
          currentStudent.activeRole = selectedRole;
          showSuccess(r.status, r.time, fm, newDesc !== null, r.keterangan);
        },
        function (err) {
          showToast("Gagal: " + err, "error");
          showOptions();
        },
      );
    })
    .catch(function (err) {
      // Tangani error tak terduga dari FaceAPI
      console.error("FaceAPI detection error:", err);
      if (fsEl) {
        fsEl.className = "face-status error";
        fsEl.textContent = "Error deteksi wajah, silakan coba lagi";
      }
      if (sbtnEl) {
        sbtnEl.disabled = false;
        sbtnEl.innerHTML = '<i data-lucide="camera" style="width:16px;"></i> Absen Sekarang';
        lucide.createIcons();
      }
      if (camBox) {
        camBox.innerHTML = '<video id="selfie-video" class="camera-video" autoplay playsinline></video>';
        startSelfie();
      }
    });
}

function showSick() {
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<div style="text-align:center;margin-bottom:15px"><div class="opt-icon purple" style="margin:0 auto 10px"><i data-lucide="thermometer"></i></div><h3>Form Sakit / Izin</h3><p style="color:var(--gray);font-size:13px">Masukkan ID untuk memverifikasi data Anda</p></div><div class="form-group"><label class="form-label">Barcode / NIS / NIP</label><input type="text" class="form-input" id="sbc" placeholder="Masukkan Barcode / NIS / NIP"></div><button class="btn btn-primary" style="width:100%" onclick="checkSickStudent()"><i data-lucide="search" style="width:16px"></i> Periksa Data</button><button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showOptions()">Kembali</button>';
  lucide.createIcons();
}

function checkSickStudent() {
  var bc = document.getElementById("sbc").value.trim();
  if (!bc) {
    showToast("Masukkan barcode / NIS / NIP", "error");
    return;
  }
  var c = document.getElementById("student-content");
  c.innerHTML = "<div style='text-align:center;padding:30px;'><p>Memeriksa data...</p></div>";

  window.callGasAPI(
    "getStudentByBarcode",
    { barcode: bc },
    function (r) {
      currentStudent = r.student;
      showSickForm();
    },
    function (err) {
      showToast("Data tidak ditemukan", "error");
      showSick();
    }
  );
}

function showSickForm() {
  var c = document.getElementById("student-content");
  var isTeacher = (currentStudent.type === "guru" || (currentStudent.id && String(currentStudent.id).indexOf("TCH") === 0));
  var labelText = isTeacher ? "Jabatan / Unit" : "Kelas / Unit";
  var catBadge = isTeacher 
    ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="briefcase" style="width:12px;height:12px"></i> PEGAWAI / GURU</span>'
    : '<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="graduation-cap" style="width:12px;height:12px"></i> SISWA</span>';

  var kStr = String(currentStudent.kelas || "");
  var roleHTML = "";
  if (kStr.indexOf(",") > -1) {
    var roles = kStr.split(",");
    roleHTML = '<div class="form-group"><label class="form-label">' + (isTeacher ? 'Pilih Unit Pengajuan Izin/Sakit' : 'Pilih Kelas') + '</label><select class="form-select" id="sick-role-select">';
    for (var i = 0; i < roles.length; i++) {
      var rClean = roles[i].trim();
      var isRQ = rClean.toLowerCase().indexOf("rumah quran") > -1 || rClean.toLowerCase().indexOf("rumah qur'an") > -1;
      var optLabel = isTeacher 
        ? (isRQ ? '📖 Unit Rumah Qur\'an (Jadwal Bebas)' : '🏫 Unit ' + rClean + ' (Presensi Reguler)') 
        : rClean;
      roleHTML += '<option value="' + rClean + '">' + optLabel + '</option>';
    }
    roleHTML += '</select></div>';
  } else {
    roleHTML = '<div class="form-group"><label class="form-label">' + labelText + '</label><input type="text" class="form-input" value="' + (currentStudent.kelas || "-") + '" disabled style="background:var(--bg)"></div>';
  }

  c.innerHTML =
    '<div style="text-align:center;margin-bottom:15px">' + catBadge + '<div class="avatar blue" style="width:50px;height:50px;font-size:18px;margin:0 auto 8px">' +
    getInit(currentStudent.nama) +
    "</div><h3 style='margin:0;'>" +
    currentStudent.nama +
    "</h3></div>" +
    roleHTML +
    '<div class="form-group"><label class="form-label">Jenis Pengajuan</label><select class="form-select" id="sst"><option value="Sakit">Sakit</option><option value="Izin">Izin</option></select></div>' +
    '<div class="form-group"><label class="form-label">Keterangan / Alasan</label><textarea class="form-input" id="skt" rows="3" placeholder="Contoh: Demam tinggi / Keperluan keluarga"></textarea></div>' +
    '<button class="btn btn-primary" style="width:100%" onclick="submitSick()"><i data-lucide="send" style="width:16px"></i> Kirim Pengajuan</button>' +
    '<button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showSick()">Ganti Barcode</button>';
  lucide.createIcons();
}

function submitSick() {
  var st = document.getElementById("sst").value;
  var kt = document.getElementById("skt").value.trim();
  var selectedRole = currentStudent.kelas;
  var rSel = document.getElementById("sick-role-select");
  if (rSel) selectedRole = rSel.value;

  var c = document.getElementById("student-content");
  c.innerHTML = "<div style='text-align:center;padding:30px;'><p>Mengirim pengajuan izin/sakit...</p></div>";

  window.callGasAPI(
    "submitSickLeave",
    {
      studentId: currentStudent.id,
      nama: currentStudent.nama,
      kelas: selectedRole,
      status: st,
      keterangan: kt,
    },
    function (r2) {
      currentStudent.activeRole = selectedRole;
      showSuccess(r2.status, r2.time, 0);
    },
    function (e2) {
      showToast("Gagal kirim izin: " + e2, "error");
      showSickForm();
    }
  );
}

function showSuccess(st, tm, fm, isFirstReg, ket) {
  var c = document.getElementById("student-content");
  
  var col = "var(--success)";
  var title = "Absensi Berhasil!";
  var stLabel = st;
  var stBadge = '<span class="badge badge-success">Hadir (Tepat Waktu)</span>';

  var isCurrentRQ = currentStudent && (
    (currentStudent.activeRole && isRumahQuranRole(currentStudent.activeRole)) ||
    (currentStudent.kelas && isRumahQuranRole(currentStudent.kelas))
  );

  if (isCurrentRQ && (st === "TL1" || st === "TL2" || st === "Terlambat" || st === "Alpa")) {
    st = "Hadir";
  }

  if (st === "TL1") {
    col = "#d97706";
    title = "Terlambat (TL1)";
    stLabel = "Terlambat Toleransi 1 (≤ 30 Menit)";
    stBadge = '<span class="badge badge-tl1" style="font-size:12px;padding:4px 10px;">TL1 (≤ 30 Menit)</span>';
  } else if (st === "TL2") {
    col = "#ea580c";
    title = "Terlambat (TL2)";
    stLabel = "Terlambat Toleransi 2 (31-60 Menit)";
    stBadge = '<span class="badge badge-tl2" style="font-size:12px;padding:4px 10px;">TL2 (31-60 Menit)</span>';
  } else if (st === "Alpa") {
    col = "#dc2626";
    title = "Terhitung Alpa!";
    stLabel = "Alpa (Lewat Batas Toleransi > 60 Menit)";
    stBadge = '<span class="badge badge-alpa" style="font-size:12px;padding:4px 10px;">Alpa (> 60 Menit)</span>';
  } else if (st === "Terlambat") {
    col = "var(--warning)";
    title = "Terlambat";
    stLabel = "Terlambat";
    stBadge = '<span class="badge badge-warning" style="font-size:12px;padding:4px 10px;">Terlambat</span>';
  } else if (st === "Izin") {
    col = "#7c3aed";
    title = "Pengajuan Izin Berhasil";
    stBadge = '<span class="badge badge-izin" style="font-size:12px;padding:4px 10px;">Izin</span>';
  } else if (st === "Sakit") {
    col = "#db2777";
    title = "Pengajuan Sakit Berhasil";
    stBadge = '<span class="badge badge-sakit" style="font-size:12px;padding:4px 10px;">Sakit</span>';
  } else if (isCurrentRQ) {
    stLabel = "Hadir (Jadwal Bebas Rumah Qur'an)";
    stBadge = '<span class="badge badge-success" style="font-size:12px;padding:4px 10px;">Hadir (Jadwal Bebas)</span>';
  }

  var isTeacher = (currentStudent.type === "guru" || (currentStudent.id && String(currentStudent.id).indexOf("TCH") === 0));
  var catBadge = isTeacher 
    ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="briefcase" style="width:12px;height:12px"></i> PEGAWAI / GURU</span>'
    : '<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="graduation-cap" style="width:12px;height:12px"></i> SISWA</span>';

  var roleDisplay = currentStudent.activeRole || currentStudent.kelas || "-";

  var verifDisplay = "Pengajuan Izin/Sakit";
  if (st === "Hadir" || st === "TL1" || st === "TL2" || st === "Alpa" || st === "Terlambat") {
    if (isFirstReg) {
      verifDisplay = "Wajah Baru Terdaftar";
    } else {
      verifDisplay = "Wajah Cocok (" + Math.round((fm || 1) * 100) + "%)";
    }
  }

  var ketHtml = ket ? '<p style="margin-top:6px;border-top:1px dashed var(--border);padding-top:6px;"><strong>Keterangan:</strong> ' + ket + '</p>' : '';

  var iconName = (st === "Alpa") ? "alert-circle" : (st === "TL1" || st === "TL2" ? "clock" : "check");

  var teacherHistoryBtn = isTeacher 
    ? '<button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showTeacherPortal(\'history\')"><i data-lucide="history" style="width:16px"></i> Lihat Riwayat Absen Saya</button>'
    : '';

  c.innerHTML =
    '<div class="success-screen"><div class="success-icon" style="background:' +
    col +
    '"><i data-lucide="' + iconName + '" style="width:40px;height:40px;color:#fff;"></i></div><h2 style="color:' +
    col +
    ';margin-bottom:8px">' + title + '</h2>' +
    catBadge +
    '<br><strong>' +
    currentStudent.nama +
    '</strong><p style="color:var(--gray);margin-top:2px;">' +
    roleDisplay +
    '</p><div style="background:var(--bg);padding:15px;border-radius:8px;margin:20px 0;text-align:left"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>Status Absensi:</strong> ' +
    stBadge +
    '</div><p><strong>Waktu:</strong> ' +
    (tm || "--:--") +
    ' WIB</p><p><strong>Verifikasi:</strong> ' +
    verifDisplay +
    '</p>' +
    ketHtml +
    '</div><button class="btn btn-primary" style="width:100%" onclick="showOptions()">Selesai</button>' +
    teacherHistoryBtn +
    '</div>';
  lucide.createIcons();
}
function showToast(m, t) {
  var tc = document.getElementById("toasts");
  var d = document.createElement("div");
  d.className = "toast " + (t === "error" ? "error" : "");
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

// === Geolocation Helpers (Haversine Formula) ===
function getDistanceFromLatLonInM(lat1, lon1, lat2, lon2) {
  var R = 6371000; // Radius bumi dalam meter
  var dLat = deg2rad(lat2 - lat1);
  var dLon = deg2rad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}
