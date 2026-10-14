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
var availableClasses = []; // Master data unit / kelas
var currentRekapMonth = new Date().getMonth() + 1;
var currentRekapYear = new Date().getFullYear();
var globalSearchQuery = "";
var masterFilterKelas = "Semua";
var currentFilteredAttendance = [];

function handleGlobalSearch(val) {
  globalSearchQuery = (val || "").trim();
  var topbarSearch = document.getElementById("topbar-search");
  var siswaSearch = document.getElementById("siswa-search-input");
  if (topbarSearch && topbarSearch.value !== val) topbarSearch.value = val;
  if (siswaSearch && siswaSearch.value !== val) siswaSearch.value = val;

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
document.addEventListener("DOMContentLoaded", function () {
  lucide.createIcons();
  loadSettings(); // NEW
  loadAvailableClasses();
  loadData();
});

function toggleSidebar() {
  var sb = document.getElementById("sidebar");
  var ov = document.getElementById("sidebar-overlay");
  if(sb) sb.classList.toggle("mobile-open");
  if(ov) ov.classList.toggle("active");
}

function loadAvailableClasses() {
  window.callGasAPI("getClassList", {}, function(r) {
    if (r && r.classes) availableClasses = r.classes;
  });
}

function loadSettings() {
  window.callGasAPI("getSettings", {}, function(r) {
    if(r.settings) {
      appSettings = r.settings;
      // Ambil nama pimpinan yayasan dari data guru/pegawai secara otomatis
      window.callGasAPI("getTeacherList", {}, function(r2) {
          if (r2.teachers) {
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
  if (appSettings.logoUrl) {
     var elLogo = document.getElementById("app-logo-container");
     if(elLogo) elLogo.innerHTML = '<img src="'+appSettings.logoUrl+'" style="width:100%;height:100%;object-fit:contain;border-radius:6px;background:#fff;padding:2px">';
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
  var verified = 0;
  var total = feedData.length;
  for (var i = 0; i < feedData.length; i++) {
    if (feedData[i].faceMatch > 0.5) verified++;
  }
  var pct = total > 0 ? ((verified / total) * 100).toFixed(1) : "0";
  var feed = "";
  if (feedData.length > 0) {
    for (var j = 0; j < feedData.length; j++) {
      var a = feedData[j];
      var badge =
        a.faceMatch > 0.5
          ? a.status === "Terlambat"
            ? '<span class="feed-badge late">TERLAMBAT</span>'
            : '<span class="feed-badge verified">TERVERIFIKASI</span>'
          : "";
      var photoSrc = a.fotoAbsen ? formatPhotoUrl(a.fotoAbsen) : "";
      var photoHtml = photoSrc
        ? '<img class="feed-photo" src="' + photoSrc + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="feed-photo" style="display:none;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:var(--primary)">' +
          getInit(a.nama) +
          "</div>"
        : '<div class="feed-photo" style="display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;color:var(--primary)">' +
          getInit(a.nama) +
          "</div>";
      var timeClass = a.status === "Terlambat" ? " late" : "";
      var subText = a.kelas;
      if (a.kelas === "Guru" || a.kelas === "Pegawai") subText = "Pegawai";
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
        " WIB</div></div></div>";
    }
  } else {
    feed =
      '<div style="text-align:center;padding:80px 20px;color:var(--gray);grid-column:1/-1"><i data-lucide="users" style="width:64px;height:64px;margin-bottom:20px;opacity:.3"></i><h3 style="margin-bottom:8px">Belum Ada Absensi Hari Ini</h3><p style="font-size:13px">' +
      targetType +
      " yang absen akan muncul di sini secara real-time</p></div>";
  }
  var lblHadir = "Total " + targetType + " Hadir";
  var lblTelat = targetType + " Terlambat";
  c.innerHTML =
    '<div class="page-header"><div><h1>Dashboard ' +
    targetType +
    '</h1><p>Pantau kehadiran ' +
    (activeType == "guru" ? "pegawai dan guru" : "seluruh siswa") +
    ' secara real-time.</p></div><div class="header-actions">' +
    '<button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Pegawai</button>' +
    '<button class="btn ' +
    btnS +
    '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Siswa</button>' +
    '</div></div>' + getAuthAlertHtml() + '<div class="stats-grid"><div class="stat-card"><div class="stat-info"><h3>' +
    lblHadir +
    '</h3><div class="value">' +
    (stats.totalHadir || 0) +
    '</div><div class="trend up">+5% vs Kemarin</div></div><div class="stat-icon green"><i data-lucide="users"></i></div></div><div class="stat-card"><div class="stat-info"><h3>' +
    lblTelat +
    '</h3><div class="value">' +
    (stats.totalTerlambat || 0) +
    '</div><div class="trend down">-2% Membaik</div></div><div class="stat-icon orange"><i data-lucide="clock"></i></div></div><div class="stat-card" style="cursor:pointer" onclick="showUnattendedModal()" title="Klik untuk lihat nama yang belum absen"><div class="stat-info"><h3>Belum Absen</h3><div class="value">' +
    (stats.belumAbsen || 0) +
    '</div><div class="trend down" style="color:var(--primary);text-decoration:underline;cursor:pointer">Klik Lihat Daftar</div></div><div class="stat-icon red"><i data-lucide="user-x"></i></div></div><div class="stat-card"><div class="stat-info"><h3>Akurasi Selfie</h3><div class="value">' +
    pct +
    '%</div><div class="trend up">AI Verification</div></div><div class="stat-icon blue"><i data-lucide="scan-face"></i></div></div></div><div class="feed-header"><div class="feed-title">Feed Absensi Real-time <span class="live-badge"><span class="live-dot"></span> LIVE</span></div><div style="display:flex;gap:10px"><button class="btn btn-outline" onclick="loadData()"><i data-lucide="filter" style="width:14px"></i> Refresh</button><button class="btn btn-primary" onclick="exportExcel()"><i data-lucide="download" style="width:14px"></i> Export Log</button></div></div><div class="feed-grid">' +
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

function showUnattendedModal() {
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var attendedIds = {};
  for (var i = 0; i < attendance.length; i++) {
    var a = attendance[i];
    var isType = (activeType == "guru" ? a.type === "Guru" : (!a.type || a.type === "Siswa"));
    if (isType) {
      if (a.studentId) attendedIds[String(a.studentId)] = true;
      if (a.id) attendedIds[String(a.id)] = true;
    }
  }

  var unattended = students.filter(function (s) {
    if (s.status && s.status !== "Aktif") return false;
    return !attendedIds[String(s.id)];
  });

  var m = document.getElementById("modal");
  var listHtml = "";
  if (unattended.length === 0) {
    listHtml = '<div style="text-align:center;padding:30px;color:var(--gray)"><i data-lucide="check-circle" style="width:48px;height:48px;color:var(--success);margin-bottom:10px"></i><p>Luar biasa! Semua ' + targetType + ' aktif sudah melakukan absensi hari ini.</p></div>';
  } else {
    listHtml = '<div style="max-height:350px;overflow-y:auto"><table class="table" style="width:100%"><thead><tr><th>No</th><th>Nama</th><th>' + (activeType == "guru" ? "Jabatan" : "Kelas") + '</th><th>Status</th></tr></thead><tbody>';
    for (var j = 0; j < unattended.length; j++) {
      var u = unattended[j];
      listHtml += '<tr><td>' + (j + 1) + '</td><td><strong>' + u.nama + '</strong></td><td>' + (u.jabatan || u.kelas || "-") + '</td><td><span class="badge badge-danger">Belum Absen</span></td></tr>';
    }
    listHtml += '</tbody></table></div>';
  }

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
    ? '<button class="btn btn-primary" onclick="propagateEmail()"><i data-lucide="mail" style="width:16px"></i> Kirim ke Wali Kelas</button>' 
    : '';

  c.innerHTML =
    '<div class="page-header"><div><h1>Laporan Kehadiran ' +
    targetType +
    "</h1><p>Kelola dan pantau data kehadiran harian " +
    (activeType == "guru" ? "pegawai dan guru" : "siswa") +
    ' dengan verifikasi selfie.</p></div><div class="header-actions">' +
    '<button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Pegawai</button>' +
    '<button class="btn ' +
    btnS +
    '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Siswa</button>' +
    '</div></div>' +
    getAuthAlertHtml() +
    '<div class="header-actions" style="margin-bottom:15px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-outline" onclick="window.print()"><i data-lucide="printer" style="width:16px"></i> Cetak Laporan</button><button class="btn btn-danger" onclick="exportPDF()"><i data-lucide="file-text" style="width:16px"></i> Export PDF</button><button class="btn btn-success" onclick="exportExcel()"><i data-lucide="file-spreadsheet" style="width:16px"></i> Export Excel</button>' +
    sendWaliBtn +
    '</div><div class="card"><div class="card-body"><div class="filters"><div class="filter-group"><div class="filter-label">Filter ' +
    (activeType == "guru" ? "Jabatan" : "Unit / Kelas") +
    '</div><div class="filter-tabs" id="filter-tabs"></div></div><div class="filter-group"><div class="filter-label">Tanggal Laporan</div><input type="date" class="form-input" value="' +
    (currentFilterDate || "") +
    '" onchange="changeDate(this.value)" style="max-width:200px"></div></div>' +
    '<div class="print-header print-only"><img src="' + (appSettings.logoUrl || 'https://dummyimage.com/200x200/059669/ffffff&text=Darul+Ulum') + '" alt="Logo"><div class="print-header-text"><h1>LAPORAN KEHADIRAN ' + (activeType == "guru" ? "PEGAWAI" : "SISWA") + '</h1><p>YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU</p><p>Tanggal: ' + currentFilterDate + '</p></div></div>' +
    '<table class="table"><thead><tr><th>Nama</th><th>' +
    (activeType == "guru" ? "Jabatan" : "Unit / Kelas") +
    '</th><th>Tanggal</th><th>Jam Masuk</th><th>Status</th><th>Verifikasi</th><th>Aksi</th></tr></thead><tbody id="lap-table"></tbody></table>' +
    '<div class="print-footer print-only"><div class="print-signature">Kamang Baru, ' + currentFilterDate + '<br>Mengetahui,<br>Kepala Yayasan<p></p><b>' + (appSettings.kepalaYayasan || "Pimpinan Yayasan") + '</b></div></div>' +
    '<div class="pagination"><div class="pagination-info" id="pg-info"></div><div class="pagination-btns"><button class="page-btn">&lt;</button><button class="page-btn active">1</button><button class="page-btn">&gt;</button></div></div></div></div>';
  renderFilters();
  renderLapTable();
  lucide.createIcons();
}
function renderFilters() {
  var t = document.getElementById("filter-tabs");
  if (!t) return;
  var roles = ["Semua"];
  if (activeType == "siswa") {
    if (availableClasses && availableClasses.length > 0) {
      for (var c = 0; c < availableClasses.length; c++) {
        var clsName = (availableClasses[c].nama || "").trim();
        if (clsName && roles.indexOf(clsName) === -1) roles.push(clsName);
      }
    }
    if (students && students.length > 0) {
      for (var s = 0; s < students.length; s++) {
        var sk = (students[s].kelas || "").trim();
        if (sk && roles.indexOf(sk) === -1) roles.push(sk);
      }
    }
    if (attendance && attendance.length > 0) {
      for (var a = 0; a < attendance.length; a++) {
        if (!attendance[a].type || attendance[a].type === "Siswa") {
          var ak = (attendance[a].kelas || "").trim();
          if (ak && roles.indexOf(ak) === -1) roles.push(ak);
        }
      }
    }
  } else {
    if (students && students.length > 0) {
      for (var i = 0; i < students.length; i++) {
        var jbStr = students[i].jabatan || students[i].kelas || "";
        if (jbStr) {
          var jbs = jbStr.split(',');
          for (var x = 0; x < jbs.length; x++) {
            var jbClean = jbs[x].trim();
            if (jbClean && roles.indexOf(jbClean) === -1) roles.push(jbClean);
          }
        }
      }
    }
    if (attendance && attendance.length > 0) {
      for (var a2 = 0; a2 < attendance.length; a2++) {
        if (attendance[a2].type === "Guru") {
          var ak2 = (attendance[a2].kelas || "").trim();
          if (ak2 && roles.indexOf(ak2) === -1) roles.push(ak2);
        }
      }
    }
  }
  var h = "";
  for (var j = 0; j < roles.length; j++) {
    h +=
      '<button class="filter-tab ' +
      (filterKelas == roles[j] ? "active" : "") +
      '" onclick="setFilter(this,\'' +
      roles[j] +
      "')\">" +
      roles[j] +
      "</button>";
  }
  t.innerHTML = h;
}
function setFilter(el, f) {
  filterKelas = f;
  renderFilters();
  renderLapTable();
}
function renderLapTable() {
  var tb = document.getElementById("lap-table");
  if (!tb) return;
  var targetType = activeType == "guru" ? "Pegawai" : "Siswa";
  var data = attendance.filter(function (a) {
    var isType = a.type === (activeType == "guru" ? "Guru" : "Siswa") || (activeType == "siswa" && !a.type);
    var matchClass = (filterKelas === "Semua" || (a.kelas && a.kelas.indexOf(filterKelas) > -1));
    var matchSearch = true;
    if (globalSearchQuery) {
      var q = globalSearchQuery.toLowerCase();
      var nm = (a.nama || "").toLowerCase();
      var kl = (a.kelas || "").toLowerCase();
      var sid = (a.studentId || "").toLowerCase();
      matchSearch = nm.indexOf(q) > -1 || kl.indexOf(q) > -1 || sid.indexOf(q) > -1;
    }
    return isType && matchClass && matchSearch;
  });

  currentFilteredAttendance = data;

  var pgEl = document.getElementById("pg-info");
  if (pgEl) {
    pgEl.innerText = "Menampilkan 1 - " + data.length + " dari " + data.length + " data";
  }

  if (data.length === 0) {
    tb.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray)">' +
      (attendance.length === 0 ? "Tidak ada data absensi hari ini." : "Tidak ada data yang cocok dengan filter pencarian.") +
      '</td></tr>';
    return;
  }
  var h = "";
  for (var i = 0; i < data.length; i++) {
    var a = data[i];
    var bc =
      a.status === "Hadir"
        ? "success"
        : a.status === "Terlambat"
          ? "warning"
          : a.status === "Izin"
            ? "info"
            : "danger";
    var tc = a.status === "Terlambat" ? ' class="time-late"' : "";
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
    h +=
      '<tr><td><div class="student-cell" style="cursor:pointer;" onclick="showAttendanceDetail(' + i + ')">' +
      thumb +
      '<span style="font-weight:500">' +
      a.nama +
      "</span></div></td><td>" +
      (a.kelas || "-") +
      "</td><td>" +
      formatDate(a.tanggal) +
      "</td><td" +
      tc +
      ">" +
      (formatTime(a.waktu) || "--:--") +
      '</td><td><span class="badge badge-' +
      bc +
      '">' +
      a.status +
      "</span></td><td>" +
      v +
      '</td><td><button class="action-btn" onclick="showAttendanceDetail(' + i + ')" title="Lihat Detail Absensi (Titik Tiga)"><i data-lucide="more-vertical" style="width:18px"></i></button></td></tr>';
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

  var stBadge = a.status === "Hadir" ? "success" : (a.status === "Terlambat" ? "warning" : (a.status === "Izin" ? "info" : "danger"));
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
  if (!url) return "";
  // Konversi link Drive uc?export=view lama menjadi direct thumbnail agar tidak diblokir browser
  var match = String(url).match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return "https://drive.google.com/thumbnail?id=" + match[1] + "&sz=w400";
  }
  return url;
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
    '</h1><p>Rekap kehadiran ' +
    (activeType == "guru" ? "pegawai dan guru" : "siswa") +
    ' per bulan dengan status harian.</p></div><div class="header-actions">' +
    '<button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')"><i data-lucide="briefcase" style="width:16px"></i> Pegawai</button>' +
    '<button class="btn ' +
    btnS +
    '" onclick="switchType(\'siswa\')"><i data-lucide="graduation-cap" style="width:16px"></i> Siswa</button>' +
    '</div></div>' +
    getAuthAlertHtml() +
    '<div class="card" style="margin-bottom:15px;"><div class="card-body" style="padding:15px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:15px;">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
    '<span style="font-weight:600;font-size:13px;color:var(--gray);">Pilih Periode:</span>' +
    '<select class="form-select" id="rekap-month" style="width:140px;display:inline-block;" onchange="changeRekapPeriod()">' + monthOptions + '</select>' +
    '<select class="form-select" id="rekap-year" style="width:100px;display:inline-block;" onchange="changeRekapPeriod()">' + yearOptions + '</select>' +
    '</div>' +
    '<div style="display:flex;gap:8px;">' +
    '<button class="btn btn-success" onclick="exportRekapExcel()"><i data-lucide="file-spreadsheet" style="width:16px"></i> Export Excel</button>' +
    '<button class="btn btn-outline" onclick="window.print()"><i data-lucide="printer" style="width:16px"></i> Cetak Rekap</button>' +
    '</div>' +
    '</div></div>' +
    '<div class="card"><div class="card-body" id="rekap-content"><p style="text-align:center;padding:30px;color:var(--gray)">Memuat data ' +
    targetType +
    "...</p></div></div>";
  lucide.createIcons();
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
function showRekapTable() {
  var rc = document.getElementById("rekap-content");
  if (!rekapData || !rekapData.students || rekapData.students.length === 0) {
    rc.innerHTML =
      '<p style="text-align:center;padding:30px;color:var(--gray)">Tidak ada data rekap</p>';
    return;
  }
  // Extract unique roles for filtering
  var roles = ["Semua"];
  var u = {};
  if (activeType === "siswa" && availableClasses && availableClasses.length > 0) {
    for (var cIdx = 0; cIdx < availableClasses.length; cIdx++) {
      var cName = (availableClasses[cIdx].nama || "").trim();
      if (cName) u[cName] = 1;
    }
  }
  for (var i = 0; i < rekapData.students.length; i++) {
    if (rekapData.students[i].kelas) {
      var jbs = rekapData.students[i].kelas.split(',');
      for (var x = 0; x < jbs.length; x++) {
        var cln = jbs[x].trim();
        if (cln) u[cln] = 1;
      }
    }
  }
  for (var key in u) roles.push(key);

  var filterLabel = activeType === "guru" ? "Filter Jabatan" : "Filter Unit / Kelas";
  var filterHtml = '<div class="filters" style="margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid var(--border)"><div class="filter-group"><div class="filter-label">' + filterLabel + '</div><div class="filter-tabs">';
  for (var j = 0; j < roles.length; j++) {
    filterHtml += '<button class="filter-tab ' + (filterKelas == roles[j] ? "active" : "") + '" onclick="filterRekap(\'' + roles[j] + '\')">' + roles[j] + '</button>';
  }
  filterHtml += '</div></div></div>';

  var printHeader = '<div class="print-header print-only"><img src="' + (appSettings.logoUrl || 'https://dummyimage.com/200x200/059669/ffffff&text=Darul+Ulum') + '" alt="Logo"><div class="print-header-text"><h1>REKAPITULASI KEHADIRAN ' + (activeType == "guru" ? "PEGAWAI" : "SISWA") + '</h1><p>YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU</p><p>Kategori: ' + filterKelas + ' | Bulan: ' + new Date().toLocaleString('id-ID', {month: 'long', year: 'numeric'}) + '</p></div></div>';

  var h = filterHtml + printHeader + '<div class="table-responsive"><table class="table rekap-table"><thead><tr><th style="text-align:left;min-width:150px">Nama</th>';
  for (var d = 1; d <= rekapData.daysInMonth; d++) h += "<th>" + d + "</th>";
  h +=
    '<th style="background:#dcfce7">H</th><th style="background:#fef3c7">T</th><th style="background:#ede9fe">S</th><th style="background:#cffafe">I</th><th style="background:#fee2e2">A</th></tr></thead><tbody>';
  for (var k = 0; k < rekapData.students.length; k++) {
    var s = rekapData.students[k];
    
    // Terapkan Filter
    if (filterKelas !== "Semua" && s.kelas.indexOf(filterKelas) === -1) {
      continue;
    }

    h +=
      '<tr><td style="text-align:left"><div class="student-cell"><div class="avatar ' +
      getColor(k) +
      '" style="width:28px;height:28px;font-size:10px">' +
      getInit(s.nama) +
      '</div><div><strong style="font-size:12px">' +
      s.nama +
      '</strong><br><small style="color:var(--gray)">' +
      s.kelas +
      "</small></div></div></td>";
    for (var d = 1; d <= rekapData.daysInMonth; d++) {
      var code = s.days[d] || "-";
      var cls =
        code === "H"
          ? "day-h"
          : code === "T"
            ? "day-t"
            : code === "S"
              ? "day-s"
              : code === "I"
                ? "day-i"
                : code === "A"
                  ? "day-a"
                  : "";
      h += '<td class="' + cls + '"><strong>' + code + "</strong></td>";
    }
    h +=
      '<td style="font-weight:700;color:var(--success)">' +
      (s.totals.H || 0) +
      '</td><td style="font-weight:700;color:var(--warning)">' +
      (s.totals.T || 0) +
      '</td><td style="font-weight:700;color:var(--purple)">' +
      (s.totals.S || 0) +
      '</td><td style="font-weight:700;color:var(--info)">' +
      (s.totals.I || 0) +
      '</td><td style="font-weight:700;color:var(--danger)">' +
      (s.totals.A || 0) +
      "</td></tr>";
  }
  var printFooter = '<div class="print-footer print-only"><div class="print-signature">Kamang Baru, ' + new Date().toISOString().split('T')[0] + '<br>Mengetahui,<br>Kepala Yayasan<p></p><b>' + (appSettings.kepalaYayasan || "Pimpinan Yayasan") + '</b></div></div>';
  h += "</tbody></table></div>" + printFooter;
  rc.innerHTML = h;
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
    showToast("Belum ada data rekap untuk diekspor", "warning");
    return;
  }
  if (typeof XLSX === "undefined") {
    showToast("Library Excel belum dimuat", "error");
    return;
  }

  var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  var monthName = monthNames[currentRekapMonth - 1] || "Bulan";
  var headerRow = ["No", "Nama", (activeType === "guru" ? "Jabatan" : "Unit / Kelas")];
  for (var d = 1; d <= rekapData.daysInMonth; d++) {
    headerRow.push("Tgl " + d);
  }
  headerRow.push("Total Hadir (H)", "Terlambat (T)", "Sakit (S)", "Izin (I)", "Alfa (A)");

  var exportRows = [headerRow];
  var no = 1;
  for (var k = 0; k < rekapData.students.length; k++) {
    var s = rekapData.students[k];
    if (filterKelas !== "Semua" && s.kelas.indexOf(filterKelas) === -1) {
      continue;
    }
    if (globalSearchQuery) {
      var q = globalSearchQuery.toLowerCase();
      if ((s.nama || "").toLowerCase().indexOf(q) === -1 && (s.kelas || "").toLowerCase().indexOf(q) === -1) {
        continue;
      }
    }
    var row = [no++, s.nama, s.kelas];
    for (var d2 = 1; d2 <= rekapData.daysInMonth; d2++) {
      row.push(s.days[d2] || "-");
    }
    row.push(
      s.totals.H || 0,
      s.totals.T || 0,
      s.totals.S || 0,
      s.totals.I || 0,
      s.totals.A || 0
    );
    exportRows.push(row);
  }

  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(exportRows);
  XLSX.utils.book_append_sheet(wb, ws, "Rekap " + monthName);
  var filename = "Rekap_Presensi_" + (activeType === "guru" ? "Pegawai" : "Siswa") + "_" + monthName + "_" + currentRekapYear + ".xlsx";
  XLSX.writeFile(wb, filename);
  showToast("Rekap bulanan berhasil diexport ke Excel", "success");
}

function exportMasterExcel() {
  if (!students || students.length === 0) {
    showToast("Belum ada data untuk diexport", "warning");
    return;
  }
  if (typeof XLSX === "undefined") {
    showToast("Library Excel belum dimuat", "error");
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

  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Data " + targetName);
  var filename = "Data_Master_" + targetName + "_" + new Date().toISOString().slice(0, 10) + ".xlsx";
  XLSX.writeFile(wb, filename);
  showToast("Data " + targetName + " berhasil diexport ke Excel", "success");
}

function renderSiswa() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  var btnK = activeType == "kelas" ? "btn-primary" : "btn-outline";
  var title = activeType == "guru" ? "Data Pegawai" : (activeType == "siswa" ? "Data Siswa" : "Data Unit / Kelas");
  var desc = activeType == "guru" ? "Kelola data Pegawai, Guru, dan Jabatan." : (activeType == "siswa" ? "Kelola data Siswa dan Unit / Kelas." : "Kelola data Unit, Kelas, dan Wali Kelas.");

  var classOptions = '<option value="Semua">Semua Kelas</option>';
  if (availableClasses && availableClasses.length > 0) {
    for (var cl = 0; cl < availableClasses.length; cl++) {
      var cName = (availableClasses[cl].nama || "").trim();
      if (cName) {
        var isSel = masterFilterKelas === cName ? "selected" : "";
        classOptions += '<option value="' + cName + '" ' + isSel + '>' + cName + '</option>';
      }
    }
  }

  var classFilterHtml = activeType === "siswa"
    ? '<select class="form-select" onchange="changeMasterClassFilter(this.value)" style="max-width:180px;height:38px;padding:6px 12px;font-size:13px;">' + classOptions + '</select>'
    : '';

  c.innerHTML =
    '<div class="page-header"><div><h1>' + title + '</h1><p>' + desc + '</p></div><div class="header-actions">' +
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
    '<div class="card"><div class="card-body" style="padding:0"><table class="table"><thead><tr>' +
    (activeType == "kelas"
      ? "<th>Nama Unit / Kelas</th><th>Wali Kelas</th><th>Email</th><th>Aksi</th>"
      : "<th>" +
        (activeType == "guru" ? "Pegawai" : "Siswa") +
        "</th><th>" +
        (activeType == "guru" ? "NIP" : "Barcode") +
        "</th><th>" +
        (activeType == "guru" ? "Jabatan" : "Unit / Kelas") +
        "</th><th>Email</th><th>Biometrik Wajah</th><th>Status</th><th>Aksi</th>") +
    '</tr></thead><tbody id="siswa-table"></tbody></table>' +
    '<div class="pagination"><div class="pagination-info" id="siswa-pg-info"></div></div>' +
    '</div></div>';
  lucide.createIcons();
  renderSiswaTable();
}

function renderSiswaTable() {
  var tb = document.getElementById("siswa-table");
  if (!tb) return;

  var filteredStudents = students.filter(function (s) {
    if (activeType === "siswa" && masterFilterKelas !== "Semua") {
      var kls = s.kelas || "";
      if (kls.indexOf(masterFilterKelas) === -1) return false;
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
      var sub = s.jabatan || s.kelas || "-";
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
function renderPengaturan() {
  var c = document.getElementById("main-content");
  c.innerHTML =
    '<div class="page-header"><h1>Pengaturan</h1><p>Konfigurasi parameter sistem.</p></div><div class="card"><div class="card-body"><div style="max-width:400px"><div class="form-group"><label class="form-label">Nama Admin</label><input type="text" class="form-input" id="set-admin-nama" value="'+(appSettings.adminName || 'Budi Santoso')+'"></div><div class="form-group"><label class="form-label">Jabatan Admin</label><input type="text" class="form-input" id="set-admin-role" value="'+(appSettings.adminRole || 'Administrator')+'"></div><div class="form-group"><label class="form-label">URL Logo Web (Opsional)</label><input type="url" class="form-input" id="set-logo" value="'+(appSettings.logoUrl || '')+'" placeholder="https://..."></div><div class="form-group"><label class="form-label">Jam Batas Terlambat</label><input type="time" class="form-input" id="set-jam" value="'+(appSettings.jamTerlambat || '07:15')+'"></div><div class="form-group"><label class="form-label">Threshold Face Match (0-1)</label><input type="number" class="form-input" id="set-th" value="'+(appSettings.faceMatchThreshold || '0.5')+'" min="0" max="1" step="0.1"></div><button class="btn btn-primary" onclick="saveSettings()"><i data-lucide="save" style="width:16px"></i> Simpan Pengaturan</button></div></div></div>';
  lucide.createIcons();
}

function showAddModal() {
  var m = document.getElementById("modal");
  if (activeType === "kelas") {
    m.innerHTML =
      '<div class="modal"><div class="modal-header"><span class="modal-title">Tambah Unit / Kelas Baru</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">Nama Unit / Kelas (Misal: SDIT Kelas 1)</label><input type="text" class="form-input" id="add-kelas-nama" placeholder="Contoh: SDIT Kelas 1"></div><div class="form-group"><label class="form-label">Nama Wali Kelas</label><input type="text" class="form-input" id="add-kelas-wali" placeholder="Nama Wali Kelas"></div><div class="form-group"><label class="form-label">Email Wali Kelas</label><input type="email" class="form-input" id="add-kelas-email" placeholder="email@sekolah.sch.id"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitAdd()">Simpan</button></div></div>';
  } else {
    var lblCode = activeType == "guru" ? "NIP" : "Barcode / NIS";
    var lblSub = activeType == "guru" ? "Jabatan" : "Unit / Kelas";
    
    var subInput = "";
    if (activeType === "guru") {
      subInput = '<select class="form-select" id="add-kelas" multiple style="height:120px">' +
                 '<option value="Kepala Yayasan">Kepala Yayasan</option>' +
                 '<option value="Kepala Sekolah">Kepala Sekolah</option>' +
                 '<option value="Wali Kelas">Wali Kelas</option>' +
                 '<option value="Guru Kelas">Guru Kelas</option>' +
                 '<option value="Guru Bidang Studi">Guru Bidang Studi</option>' +
                 '<option value="Guru Rumah Quran">Guru Rumah Quran</option>' +
                 '<option value="Staf Tata Usaha">Staf Tata Usaha</option>' +
                 '<option value="Bendahara">Bendahara</option>' +
                 '<option value="Operator">Operator</option>' +
                 '<option value="Keamanan">Keamanan</option>' +
                 '<option value="Kebersihan">Kebersihan</option>' +
                 '</select><small style="color:var(--gray);font-size:11px">Tahan Ctrl (Windows) atau Cmd (Mac) untuk memilih lebih dari satu.</small>';
    } else {
      var classOptions = "";
      if (availableClasses && availableClasses.length > 0) {
        for (var cIdx = 0; cIdx < availableClasses.length; cIdx++) {
          var cName = (availableClasses[cIdx].nama || "").trim();
          if (cName) classOptions += '<option value="' + cName + '">' + cName + '</option>';
        }
      }
      if (!classOptions) {
        classOptions = '<option value="Rumah Quran">Rumah Quran</option><option value="TK">TK</option><option value="SDIT Kelas 1">SDIT Kelas 1</option><option value="SDIT Kelas 2">SDIT Kelas 2</option><option value="SMP">SMP</option>';
      }
      subInput = '<select class="form-select" id="add-kelas">' + classOptions + '</select><small style="color:var(--gray);font-size:11px">Pilihan Unit / Kelas diambil otomatis dari master Data Unit / Kelas.</small>';
    }

    m.innerHTML =
      '<div class="modal"><div class="modal-header"><span class="modal-title">Tambah ' +
      (activeType == "guru" ? "Pegawai" : "Siswa") +
      ' Baru</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">' +
      lblCode +
      '</label><input type="text" class="form-input" id="add-bc" placeholder="Masukan ' +
      lblCode +
      '"></div><div class="form-group"><label class="form-label">Nama Lengkap</label><input type="text" class="form-input" id="add-nama" placeholder="Nama Lengkap"></div><div class="form-group"><label class="form-label">' +
      lblSub +
      '</label>' + subInput + '</div><div class="form-group"><label class="form-label">Email (Opsional)</label><input type="email" class="form-input" id="add-email" placeholder="email@domain.com"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitAdd()">Simpan</button></div></div>';
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
  var bc = document.getElementById("add-bc").value;
  var nm = document.getElementById("add-nama").value;
  var klEl = document.getElementById("add-kelas");
  var kl = "";
  if (klEl.multiple) {
    var vals = [];
    for(var i=0; i<klEl.options.length; i++) {
        if(klEl.options[i].selected) vals.push(klEl.options[i].value);
    }
    kl = vals.join(", ");
  } else {
    kl = klEl.value;
  }
  var em = document.getElementById("add-email").value;
  if (!bc || !nm || !kl) {
    showToast("Lengkapi semua field", "error");
    return;
  }
  if (activeType === "guru") {
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
  var lblSub = activeType == "guru" ? "Jabatan" : "Unit / Kelas";
  var code = activeType == "guru" ? s.nip : s.barcode;
  var sub = activeType == "guru" ? s.jabatan : s.kelas;
  
  var subInput = "";
  if (activeType === "guru") {
    var opts = ["Kepala Yayasan", "Kepala Sekolah", "Wali Kelas", "Guru Kelas", "Guru Bidang Studi", "Guru Rumah Quran", "Staf Tata Usaha", "Bendahara", "Operator", "Keamanan", "Kebersihan", "Lainnya"];
    subInput = '<select class="form-select" id="edit-kelas" multiple style="height:120px">';
    var selectedSubs = (sub || "").split(",").map(function(s){ return s.trim() });
    
    for(var i=0; i<opts.length; i++) {
        var sel = (selectedSubs.indexOf(opts[i]) !== -1) ? "selected" : "";
        subInput += '<option value="' + opts[i] + '" ' + sel + '>' + opts[i] + '</option>';
    }
    
    // Add custom ones that aren't in opts
    for(var i=0; i<selectedSubs.length; i++) {
        if(selectedSubs[i] && opts.indexOf(selectedSubs[i]) === -1) {
            subInput += '<option value="' + selectedSubs[i] + '" selected>' + selectedSubs[i] + '</option>';
        }
    }
    
    subInput += '</select><small style="color:var(--gray);font-size:11px">Tahan Ctrl/Cmd untuk multiseleksi.</small>';
  } else {
    var classOptions = "";
    var currentClass = (sub || "").trim();
    var foundCurrent = false;
    if (availableClasses && availableClasses.length > 0) {
      for (var c2 = 0; c2 < availableClasses.length; c2++) {
        var cName2 = (availableClasses[c2].nama || "").trim();
        if (cName2) {
          var isSel = cName2 === currentClass ? "selected" : "";
          if (isSel) foundCurrent = true;
          classOptions += '<option value="' + cName2 + '" ' + isSel + '>' + cName2 + '</option>';
        }
      }
    }
    if (!foundCurrent && currentClass) {
      classOptions = '<option value="' + currentClass + '" selected>' + currentClass + '</option>' + classOptions;
    }
    subInput = '<select class="form-select" id="edit-kelas">' + classOptions + '</select><small style="color:var(--gray);font-size:11px">Pilihan Unit / Kelas sinkron dengan master Data Kelas.</small>';
  }

  m.innerHTML =
    '<div class="modal"><div class="modal-header"><span class="modal-title">Edit ' +
    (activeType == "guru" ? "Pegawai" : "Siswa") +
    '</span><button class="modal-close" onclick="closeModal()">&times;</button></div><div class="modal-body"><div class="form-group"><label class="form-label">' +
    lblCode +
    '</label><input type="text" class="form-input" id="edit-bc" value="' + (code || "") + '"></div><div class="form-group"><label class="form-label">Nama Lengkap</label><input type="text" class="form-input" id="edit-nama" value="' + s.nama + '"></div><div class="form-group"><label class="form-label">' +
    lblSub +
    '</label>' + subInput + '</div><div class="form-group"><label class="form-label">Email (Opsional)</label><input type="email" class="form-input" id="edit-email" value="' + (s.email || "") + '"></div></div><div class="modal-footer"><button class="btn btn-outline" onclick="closeModal()">Batal</button><button class="btn btn-primary" onclick="submitEdit(\'' + id + '\')">Update</button></div></div>';
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

  var bc = document.getElementById("edit-bc").value;
  var nm = document.getElementById("edit-nama").value;
  var klEl = document.getElementById("edit-kelas");
  var kl = "";
  if (klEl.multiple) {
    var vals = [];
    for(var i=0; i<klEl.options.length; i++) {
        if(klEl.options[i].selected) vals.push(klEl.options[i].value);
    }
    kl = vals.join(", ");
  } else {
    kl = klEl.value;
  }
  var em = document.getElementById("edit-email").value;
  if (!bc || !nm || !kl) {
    showToast("Lengkapi semua field", "error");
    return;
  }
  if (activeType === "guru") {
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
  var n = document.getElementById("set-admin-nama").value;
  var r = document.getElementById("set-admin-role").value;
  var l = document.getElementById("set-logo").value;
  var j = document.getElementById("set-jam").value;
  var t = document.getElementById("set-th").value;
  var payload = { adminName: n, adminRole: r, logoUrl: l, jamTerlambat: j, faceMatchThreshold: t };
  
  window.callGasAPI(
    "updateSettings",
    payload,
    function (res) {
      showToast("Pengaturan disimpan", "success");
      appSettings = payload;
      applySettingsToUI();
    },
    function(err) {
      showToast("Gagal simpan pengaturan: " + err, "error");
    }
  );
}
function exportPDF() {
  var doc = new jspdf.jsPDF("l", "pt", "a4");
  var pageWidth = doc.internal.pageSize.width;
  var margin = 40;

  var renderPDF = function(logoDataUrl) {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', margin, 25, 50, 50);
    }

    // Kop Surat (Sebagai Judul Laporan)
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    var docTitle = "LAPORAN KEHADIRAN " + (activeType === "guru" ? "PEGAWAI" : "SISWA");
    if (filterKelas !== "Semua") docTitle += " (" + filterKelas.toUpperCase() + ")";
    doc.text(docTitle, pageWidth / 2, 40, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU", pageWidth / 2, 55, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Tanggal: " + currentFilterDate, pageWidth / 2, 70, { align: "center" });
    
    // Garis Bawah Kop
    doc.setLineWidth(2);
    doc.line(margin, 90, pageWidth - margin, 90);
    doc.setLineWidth(0.5);
    doc.line(margin, 92, pageWidth - margin, 92);

    // Tabel
    var headers = [["No", "Nama", (activeType == "guru" ? "Jabatan" : "Unit / Kelas"), "Tanggal", "Jam Masuk", "Status", "Verifikasi"]];
    var data = [];
    var filteredData = attendance.filter(function (a) {
      var isType = a.type === (activeType == "guru" ? "Guru" : "Siswa") || (activeType == "siswa" && !a.type);
      return isType && (filterKelas === "Semua" || a.kelas.indexOf(filterKelas) > -1);
    });

    for (var i = 0; i < filteredData.length; i++) {
      var a = filteredData[i];
      // Gunakan faceMatch (konsisten dengan seluruh codebase), bukan a.verified yang tidak pernah diset
      var v = a.faceMatch > 0.5 ? "Terverifikasi Wajah" : "Tidak Terverifikasi";
      data.push([i + 1, a.nama, a.kelas, currentFilterDate, formatTime(a.waktu), a.status, v]);
    }

    doc.autoTable({
      startY: 110,
      head: headers,
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [5, 150, 105] },
      margin: { left: margin, right: margin }
    });

    // Tanda Tangan (Footer)
    var finalY = doc.lastAutoTable.finalY + 40;
    if (finalY > doc.internal.pageSize.height - 100) {
      doc.addPage();
      finalY = 40;
    }
    
    doc.setFontSize(11);
    doc.text("Kamang Baru, " + currentFilterDate, pageWidth - 150, finalY, { align: "center" });
    doc.text("Mengetahui,", pageWidth - 150, finalY + 15, { align: "center" });
    doc.text("Kepala Yayasan", pageWidth - 150, finalY + 30, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text((appSettings.kepalaYayasan || "Pimpinan Yayasan"), pageWidth - 150, finalY + 90, { align: "center" });

    doc.save("Laporan_Kehadiran_" + currentFilterDate + ".pdf");
    showToast("PDF diunduh", "success");
  };

  showToast("Menyiapkan PDF...", "info");
  var logoUrl = appSettings.logoUrl || 'https://dummyimage.com/200x200/059669/ffffff&text=Darul+Ulum';
  var img = new Image();
  img.crossOrigin = "Anonymous";
  img.onload = function() {
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    renderPDF(canvas.toDataURL("image/png"));
  };
  img.onerror = function() {
    renderPDF(null);
  };
  img.src = logoUrl;
}
function exportExcel() {
  var wb = XLSX.utils.book_new();
  var data = [
    ["No", "Nama", (activeType == "guru" ? "Jabatan" : "Unit / Kelas"), "Tanggal", "Waktu", "Status", "Verifikasi"],
  ];
  
  var filteredData = attendance.filter(function (a) {
    var isType = a.type === (activeType == "guru" ? "Guru" : "Siswa") || (activeType == "siswa" && !a.type);
    return isType && (filterKelas === "Semua" || a.kelas.indexOf(filterKelas) > -1);
  });

  for (var i = 0; i < filteredData.length; i++) {
    var a = filteredData[i];
    data.push([
      i + 1,
      a.nama,
      a.kelas,
      a.tanggal || "-",
      formatTime(a.waktu),
      a.status,
      a.faceMatch > 0.5 ? "Ya" : "Tidak",
    ]);
  }
  var ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");
  var fileName = "laporan_kehadiran_" + (activeType === "guru" ? "pegawai" : "siswa") + "_" + (currentFilterDate || "hari_ini") + ".xlsx";
  XLSX.writeFile(wb, fileName);
  showToast("Excel diunduh", "success");
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
