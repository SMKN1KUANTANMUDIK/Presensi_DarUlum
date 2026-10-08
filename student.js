var currentStudent = null;
var videoStream = null;
var locationData = { lat: "", lng: "", alamat: "" };
var faceLoaded = false;
document.addEventListener("DOMContentLoaded", function () {
  lucide.createIcons();
  showOptions();
  loadFace(); // Pre-load FaceAPI models
});
function showOptions() {
  stopCam();
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<button class="opt-btn" onclick="startScanner()"><div class="opt-icon blue"><i data-lucide="scan-barcode"></i></div><div class="opt-text"><h3>Scan Barcode</h3><p>Pindai kartu pelajar / NIP</p></div></button><button class="opt-btn" onclick="showManual()"><div class="opt-icon green"><i data-lucide="keyboard"></i></div><div class="opt-text"><h3>Input Manual</h3><p>Ketik barcode / NIP</p></div></button><button class="opt-btn" onclick="showSick()"><div class="opt-icon purple"><i data-lucide="thermometer"></i></div><div class="opt-text"><h3>Sakit / Izin</h3><p>Form tidak hadir</p></div></button>';
  lucide.createIcons();
}
function showManual() {
  var c = document.getElementById("student-content");
  c.innerHTML =
    '<div class="form-group"><label class="form-label">Barcode / NIS / NIP</label><input type="text" class="form-input" id="barcode"></div><button class="btn btn-primary" style="width:100%" onclick="findStudent()">Cari Data</button><button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showOptions()">Kembali</button>';
}
function startScanner() {
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
    showToast("Error", "error");
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
  var bc = document.getElementById("barcode").value.trim();
  if (!bc) {
    showToast("Masukkan barcode", "error");
    return;
  }
  findByCode(bc);
}
function findByCode(bc) {
  document.getElementById("student-content").innerHTML =
    "<div style='text-align:center;padding:20px;'><p>Mencari data ke database...</p></div>";
  window.callGasAPI(
    "getStudentByBarcode",
    { barcode: bc },
    function (r) {
      currentStudent = r.student;
      showSelfie();
    },
    function (err) {
      showToast("Data tidak ditemukan", "error");
      showOptions();
    },
  );
}
function showSelfie() {
  locationData = { lat: "", lng: "", alamat: "" };
  getLoc();
  var c = document.getElementById("student-content");
  var kStr = String(currentStudent.kelas || "");
  var roleHTML = "";
  var isTeacher = (currentStudent.type === "guru" || (currentStudent.id && String(currentStudent.id).indexOf("TCH") === 0));
  var labelText = isTeacher ? "Jabatan / Unit" : "Kelas / Unit";
  var catBadge = isTeacher 
    ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="briefcase" style="width:12px;height:12px"></i> PEGAWAI / GURU</span>'
    : '<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="graduation-cap" style="width:12px;height:12px"></i> SISWA</span>';

  if (kStr.indexOf(",") > -1) {
    var roles = kStr.split(",");
    roleHTML = '<div style="margin:8px auto 14px; max-width:280px; text-align:left;"><label style="font-size:12px; font-weight:600; color:var(--gray); display:block; margin-bottom:4px;">Pilih ' + labelText + ' Saat Absen:</label><select id="role-select" style="width:100%; display:block; padding:8px 12px; border-radius:8px; border:1px solid #cbd5e1; font-family:inherit; font-size:14px; background:#fff;">';
    for (var i = 0; i < roles.length; i++) {
      var rClean = roles[i].trim();
      roleHTML += '<option value="' + rClean + '">' + rClean + '</option>';
    }
    roleHTML += '</select></div>';
  } else {
    roleHTML = '<p style="color:var(--gray); margin-top:4px;"><span style="display:inline-block; background:#e0f2fe; color:#0369a1; padding:3px 12px; border-radius:12px; font-size:13px; font-weight:600;">' + (currentStudent.kelas || "-") + '</span></p>';
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
  var cv = document.createElement("canvas");
  var maxWidth = 200;
  var scale = maxWidth / v.videoWidth;
  cv.width = maxWidth;
  cv.height = v.videoHeight * scale;
  cv.getContext("2d").drawImage(v, 0, 0, cv.width, cv.height);
  document.getElementById("fs").textContent = "Mengirim data...";
  document.getElementById("sbtn").disabled = true;

  faceapi
    .detectSingleFace(cv, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor()
    .then(function (d) {
      if (!d) {
        document.getElementById("fs").className = "face-status error";
        document.getElementById("fs").textContent = "Wajah tidak terdeteksi";
        document.getElementById("sbtn").disabled = false;
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
      } else {
        fm = 1.0;
        newDesc = Array.from(desc);
      }
      var photo = cv.toDataURL("image/jpeg", 0.3);
      stopCam();

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

      window.callGasAPI(
        "recordAttendance",
        payload,
        function (r) {
          currentStudent.activeRole = selectedRole;
          showSuccess(r.status, r.time, fm);
        },
        function (err) {
          showToast("Gagal: " + err, "error");
          showOptions();
        },
      );
    })
    .catch(function (err) {
      // Tangani error tak terduga dari FaceAPI (model belum siap, canvas rusak, dll)
      console.error("FaceAPI detection error:", err);
      var fsEl = document.getElementById("fs");
      var sbtnEl = document.getElementById("sbtn");
      if (fsEl) {
        fsEl.className = "face-status error";
        fsEl.textContent = "Error deteksi wajah, coba lagi";
      }
      if (sbtnEl) sbtnEl.disabled = false;
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
    roleHTML = '<div class="form-group"><label class="form-label">Pilih ' + labelText + '</label><select class="form-select" id="sick-role-select">';
    for (var i = 0; i < roles.length; i++) {
      var rClean = roles[i].trim();
      roleHTML += '<option value="' + rClean + '">' + rClean + '</option>';
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

function showSuccess(st, tm, fm) {
  var c = document.getElementById("student-content");
  var col = st === "Terlambat" ? "var(--warning)" : (st === "Hadir" ? "var(--success)" : "var(--info)");
  var isTeacher = (currentStudent.type === "guru" || (currentStudent.id && String(currentStudent.id).indexOf("TCH") === 0));
  var catBadge = isTeacher 
    ? '<span style="display:inline-flex;align-items:center;gap:4px;background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="briefcase" style="width:12px;height:12px"></i> PEGAWAI / GURU</span>'
    : '<span style="display:inline-flex;align-items:center;gap:4px;background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-bottom:6px;"><i data-lucide="graduation-cap" style="width:12px;height:12px"></i> SISWA</span>';

  var roleDisplay = currentStudent.activeRole || currentStudent.kelas || "-";

  c.innerHTML =
    '<div class="success-screen"><div class="success-icon" style="background:' +
    col +
    '"><i data-lucide="check" style="width:40px;height:40px"></i></div><h2 style="color:' +
    col +
    ';margin-bottom:8px">Berhasil!</h2>' +
    catBadge +
    '<br><strong>' +
    currentStudent.nama +
    '</strong><p style="color:var(--gray);margin-top:2px;">' +
    roleDisplay +
    '</p><div style="background:var(--bg);padding:15px;border-radius:8px;margin:20px 0;text-align:left"><p><strong>Status:</strong> ' +
    st +
    "</p><p><strong>Waktu:</strong> " +
    tm +
    "</p><p><strong>Verifikasi:</strong> " +
    (fm > 0.5 ? "Wajah Cocok" : (st === "Hadir" || st === "Terlambat" ? "Bypass / Pertama Kali" : "Pengajuan Izin/Sakit")) +
    '</p></div><button class="btn btn-primary" style="width:100%" onclick="showOptions()">Selesai</button></div>';
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
