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
document.addEventListener("DOMContentLoaded", function () {
  lucide.createIcons();
  loadSettings(); // NEW
  loadData();
});

function toggleSidebar() {
  var sb = document.getElementById("sidebar");
  var ov = document.getElementById("sidebar-overlay");
  if(sb) sb.classList.toggle("mobile-open");
  if(ov) ov.classList.toggle("active");
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
  if (p !== "siswa") activeType = "guru";
  document.querySelectorAll(".nav-item").forEach(function (n) {
    n.classList.remove("active");
  });
  document.querySelector('[data-page="' + p + '"]').classList.add("active");
  var t = {
    dashboard: "Dashboard",
    laporan: "Laporan Kehadiran",
    rekap: "Rekap Bulanan",
    siswa: "Data Pegawai",
    pengaturan: "Pengaturan",
  };
  document.getElementById("page-title").textContent = t[p];
  
  // Close sidebar on mobile
  var sb = document.getElementById("sidebar");
  var ov = document.getElementById("sidebar-overlay");
  if(sb && sb.classList.contains("mobile-open")) {
    sb.classList.remove("mobile-open");
    ov.classList.remove("active");
  }

  renderPage();
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
    '<div class="page-header"><h1>Dashboard ' +
    targetType +
    '</h1></div><div class="stats-grid"><div class="stat-card"><div class="stat-info"><h3>' +
    lblHadir +
    '</h3><div class="value">' +
    (stats.totalHadir || 0) +
    '</div><div class="trend up">+5% vs Kemarin</div></div><div class="stat-icon green"><i data-lucide="users"></i></div></div><div class="stat-card"><div class="stat-info"><h3>' +
    lblTelat +
    '</h3><div class="value">' +
    (stats.totalTerlambat || 0) +
    '</div><div class="trend down">-2% Membaik</div></div><div class="stat-icon orange"><i data-lucide="clock"></i></div></div><div class="stat-card"><div class="stat-info"><h3>Belum Absen</h3><div class="value">' +
    (stats.belumAbsen || 0) +
    '</div><div class="trend down">Perlu Cek Manual</div></div><div class="stat-icon red"><i data-lucide="user-x"></i></div></div><div class="stat-card"><div class="stat-info"><h3>Akurasi Selfie</h3><div class="value">' +
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
function renderLaporan() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  c.innerHTML =
    '<div class="page-header"><h1>Laporan Kehadiran ' +
    (activeType == "guru" ? "Pegawai" : "Siswa") +
    "</h1><p>Kelola dan pantau data kehadiran harian " +
    (activeType == "guru" ? "pegawai" : "siswa") +
    ' dengan verifikasi selfie.</p><div class="header-actions" style="margin-top:10px"><button class="btn btn-outline" onclick="window.print()"><i data-lucide="printer" style="width:16px"></i> Cetak Laporan</button><button class="btn btn-danger" onclick="exportPDF()"><i data-lucide="file-text" style="width:16px"></i> Export PDF</button><button class="btn btn-success" onclick="exportExcel()"><i data-lucide="file-spreadsheet" style="width:16px"></i> Export Excel</button><button class="btn btn-primary" onclick="propagateEmail()"><i data-lucide="mail" style="width:16px"></i> Kirim ke Wali Kelas</button></div></div><div class="card"><div class="card-body"><div class="filters"><div class="filter-group"><div class="filter-label">Filter ' +
    (activeType == "guru" ? "Jabatan" : "Unit / Kelas") +
    '</div><div class="filter-tabs" id="filter-tabs"></div></div><div class="filter-group"><div class="filter-label">Tanggal Laporan</div><input type="date" class="form-input" value="' +
    (currentFilterDate || "") +
    '" onchange="changeDate(this.value)" style="max-width:200px"></div></div>' +
    '<div class="print-header print-only"><img src="' + (appSettings.logoUrl || 'https://dummyimage.com/200x200/059669/ffffff&text=Darul+Ulum') + '" alt="Logo"><div class="print-header-text"><h1>LAPORAN KEHADIRAN PEGAWAI</h1><p>YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU</p><p>Tanggal: ' + currentFilterDate + '</p></div></div>' +
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
  if (activeType == "siswa") {
    t.innerHTML =
      '<button class="filter-tab ' +
      (filterKelas == "Semua" ? "active" : "") +
      '" onclick="setFilter(this,\'Semua\')">Semua</button><button class="filter-tab ' +
      (filterKelas == "X" ? "active" : "") +
      '" onclick="setFilter(this,\'X\')">Kelas X</button><button class="filter-tab ' +
      (filterKelas == "XI" ? "active" : "") +
      '" onclick="setFilter(this,\'XI\')">Kelas XI</button><button class="filter-tab ' +
      (filterKelas == "XII" ? "active" : "") +
      '" onclick="setFilter(this,\'XII\')">Kelas XII</button>';
  } else {
    var roles = ["Semua"];
    if (students && students.length > 0) {
      var u = {};
      for (var i = 0; i < students.length; i++) {
        if (students[i].jabatan) {
          var jbs = students[i].jabatan.split(',');
          for (var x = 0; x < jbs.length; x++) {
            if (jbs[x].trim()) u[jbs[x].trim()] = 1;
          }
        }
      }
      for (var k in u) roles.push(k);
    }
    var h = "";
    for (var j = 0; j < roles.length; j++)
      h +=
        '<button class="filter-tab ' +
        (filterKelas == roles[j] ? "active" : "") +
        '" onclick="setFilter(this,\'' +
        roles[j] +
        "')\">" +
        roles[j] +
        "</button>";
    t.innerHTML = h;
  }
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
    return (
      isType && (filterKelas === "Semua" || a.kelas.indexOf(filterKelas) > -1)
    );
  });
  document.getElementById("pg-info").innerText =
    "Menampilkan 1 - " + data.length + " dari " + data.length + " data";
  if (data.length === 0) {
    tb.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray)">Tidak ada data</td></tr>';
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
        ? '<button class="verify-btn verified"><i data-lucide="camera" style="width:16px"></i></button>'
        : '<button class="verify-btn not-verified"><i data-lucide="camera-off" style="width:16px"></i></button>';
    var photoSrc = a.fotoAbsen ? formatPhotoUrl(a.fotoAbsen) : "";
    var thumb = photoSrc
      ? '<img src="' +
        photoSrc +
        '" style="width:36px;height:36px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="avatar ' + getColor(i) + '" style="display:none">' + getInit(a.nama) + "</div>"
      : '<div class="avatar ' + getColor(i) + '">' + getInit(a.nama) + "</div>";
    h +=
      '<tr><td><div class="student-cell">' +
      thumb +
      '<span style="font-weight:500">' +
      a.nama +
      "</span></div></td><td>" +
      a.kelas +
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
      '</td><td><button class="action-btn"><i data-lucide="more-vertical" style="width:18px"></i></button></td></tr>';
  }
  tb.innerHTML = h;
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
  c.innerHTML =
    '<div class="page-header"><h1>Rekap Bulanan</h1><p>Rekap kehadiran ' +
    activeType +
    ' per bulan dengan status harian.</p><div class="header-actions"><button class="btn btn-outline" onclick="window.print()"><i data-lucide="printer" style="width:16px"></i> Cetak Rekap</button></div></div><div class="card"><div class="card-body" id="rekap-content"><p style="text-align:center;padding:30px;color:var(--gray)">Memuat data ' +
    activeType +
    "...</p></div></div>";
  window.callGasAPI(
    "getMonthlyRecap",
    {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      type: activeType,
    },
    function (r) {
      rekapData = r;
      showRekapTable();
    },
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
  for (var i = 0; i < rekapData.students.length; i++) {
    if (rekapData.students[i].kelas) {
      var jbs = rekapData.students[i].kelas.split(',');
      for (var x = 0; x < jbs.length; x++) {
        if (jbs[x].trim()) u[jbs[x].trim()] = 1;
      }
    }
  }
  for (var key in u) roles.push(key);

  var filterHtml = '<div class="filters" style="margin-bottom:20px; padding-bottom:15px; border-bottom:1px solid var(--border)"><div class="filter-group"><div class="filter-label">Filter Kategori / Unit</div><div class="filter-tabs">';
  for (var j = 0; j < roles.length; j++) {
    filterHtml += '<button class="filter-tab ' + (filterKelas == roles[j] ? "active" : "") + '" onclick="filterRekap(\'' + roles[j] + '\')">' + roles[j] + '</button>';
  }
  filterHtml += '</div></div></div>';

  var printHeader = '<div class="print-header print-only"><img src="' + (appSettings.logoUrl || 'https://dummyimage.com/200x200/059669/ffffff&text=Darul+Ulum') + '" alt="Logo"><div class="print-header-text"><h1>REKAPITULASI KEHADIRAN PEGAWAI</h1><p>YAYASAN DARUL ULUM ISLAMIYYAH - KAMANG BARU</p><p>Kategori: ' + filterKelas + ' | Bulan: ' + new Date().toLocaleString('id-ID', {month: 'long', year: 'numeric'}) + '</p></div></div>';

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

function renderSiswa() {
  var c = document.getElementById("main-content");
  var btnS = activeType == "siswa" ? "btn-primary" : "btn-outline";
  var btnG = activeType == "guru" ? "btn-primary" : "btn-outline";
  var btnK = activeType == "kelas" ? "btn-primary" : "btn-outline";
  c.innerHTML =
    '<div class="page-header"><h1>Data Pegawai</h1><p>Kelola data Pegawai dan Unit/Departemen.</p><div class="header-actions"><button class="btn ' +
    btnG +
    '" onclick="switchType(\'guru\')">Data Pegawai</button><button class="btn ' +
    btnK +
    '" onclick="switchType(\'kelas\')">Data Unit / Kelas</button></div><div class="header-actions" style="margin-top:10px"><button class="btn btn-primary" onclick="showAddModal()"><i data-lucide="plus" style="width:16px"></i> Tambah ' +
    (activeType == "guru"
      ? "Pegawai"
      : activeType == "kelas"
        ? "Kelas"
        : "Siswa") +
    '</button><button class="btn btn-success" onclick="runSetup()"><i data-lucide="database" style="width:16px"></i> Setup Sheet</button></div></div><div class="card"><div class="card-body" style="padding:0"><table class="table"><thead><tr>' +
    (activeType == "kelas"
      ? "<th>Nama Unit / Kelas</th><th>Wali Kelas</th><th>Email</th><th>Aksi</th>"
      : "<th>" +
        (activeType == "guru" ? "Pegawai" : "Siswa") +
        "</th><th>" +
        (activeType == "guru" ? "NIP" : "Barcode") +
        "</th><th>" +
        (activeType == "guru" ? "Jabatan" : "Unit / Kelas") +
        "</th><th>Email</th><th>Verifikasi</th><th>Status</th><th>Aksi</th>") +
    '</tr></thead><tbody id="siswa-table"></tbody></table></div></div>';
  lucide.createIcons();
  renderSiswaTable();
}
function renderSiswaTable() {
  var tb = document.getElementById("siswa-table");
  if (!tb) return;
  if (students.length === 0) {
    tb.innerHTML =
      '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gray)">Belum ada data.</td></tr>';
    return;
  }
  var h = "";
  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (activeType === "kelas") {
      h +=
        "<tr><td>" +
        s.nama +
        "</td><td>" +
        s.wali +
        "</td><td>" +
        s.email +
        '</td><td style="display:flex;gap:5px"><button class="action-btn" onclick="editSiswa(\'' +
        s.nama +
        '\')" title="Edit"><i data-lucide="edit" style="width:18px"></i></button><button class="action-btn" onclick="deleteSiswa(\'' +
        s.nama +
        '\')" title="Hapus"><i data-lucide="trash-2" style="width:18px"></i></button></td></tr>';
    } else {
      var fb = s.hasFace
        ? '<button class="verify-btn verified"><i data-lucide="check" style="width:16px"></i></button>'
        : '<button class="btn btn-outline" style="padding:6px 12px;font-size:12px" onclick="regFace(\'' +
          s.id +
          "','" +
          s.nama +
          '\')" ><i data-lucide="camera" style="width:14px"></i> Register</button>';
      var stBadge = s.status === "Aktif" ? "success" : "danger";
      var code = s.nip || s.barcode;
      var sub = s.jabatan || s.kelas;
      var em = s.email || "-";
      h +=
        '<tr><td><div class="student-cell"><div class="avatar ' +
        getColor(i) +
        '">' +
        getInit(s.nama) +
        '</div><span style="font-weight:500">' +
        s.nama +
        "</span></div></td><td>" +
        code +
        "</td><td>" +
        sub +
        "</td><td>" +
        em +
        "</td><td>" +
        fb +
        '</td><td><span class="badge badge-' +
        stBadge +
        '">' +
        (s.status || "Aktif") +
        '</span></td><td style="display:flex;gap:5px"><button class="action-btn" onclick="editSiswa(\'' +
        s.id +
        '\')" title="Edit"><i data-lucide="edit" style="width:18px"></i></button><button class="action-btn" onclick="deleteSiswa(\'' +
        s.id +
        '\')" title="Hapus"><i data-lucide="trash-2" style="width:18px"></i></button></td></tr>';
    }
  }
  tb.innerHTML = h;
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
      subInput = '<input type="text" class="form-input" id="add-kelas" placeholder="Misal: TK, SDIT (Pisahkan dg koma jika >1)">';
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
    subInput = '<input type="text" class="form-input" id="edit-kelas" value="' + (sub || "") + '">';
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
    var docTitle = "LAPORAN KEHADIRAN PEGAWAI";
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
  XLSX.writeFile(wb, "laporan.xlsx");
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
