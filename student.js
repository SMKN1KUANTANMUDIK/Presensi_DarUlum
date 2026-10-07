var currentStudent = null;
var videoStream = null;
var locationData = { lat: "", lng: "", alamat: "" };
var faceLoaded = false;
document.addEventListener("DOMContentLoaded", function () {
  lucide.createIcons();
  showOptions();
  loadFace(); // Pre-load FaceAPI models

  // Load settings for logo
  window.callGasAPI("getSettings", {}, function (r) {
    if (r.settings && r.settings.logoUrl) {
      var cont = document.getElementById("student-logo-container");
      cont.style.display = "block";
      cont.innerHTML = '<img src="' + r.settings.logoUrl + '" style="height:100%;object-fit:contain">';
    }
  });
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
  var kStr = String(currentStudent.kelas);
  var roleHTML = "";
  if (kStr.indexOf(",") > -1) {
    var roles = kStr.split(",");
    roleHTML = '<select id="role-select" style="margin:5px auto 15px; width:90%; display:block; padding:8px; border-radius:8px; border:1px solid #e2e8f0; font-family:inherit; font-size:14px;">';
    for (var i = 0; i < roles.length; i++) {
      roleHTML += '<option value="' + roles[i].trim() + '">' + roles[i].trim() + '</option>';
    }
    roleHTML += '</select>';
  } else {
    roleHTML = '<p style="color:var(--gray)">' + currentStudent.kelas + '</p>';
  }

  c.innerHTML =
    '<div style="text-align:center;margin-bottom:20px"><div class="avatar blue" style="width:60px;height:60px;font-size:20px;margin:0 auto 10px">' +
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

  if (distance > 100) {
    showToast("Gagal: Anda berada di luar radius absensi (" + Math.round(distance) + " meter dari target)", "error");
    return;
  }

  var v = document.getElementById("selfie-video");
  var cv = document.createElement("canvas");
  var maxWidth = 400;
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
      var fm = 0;
      var newDesc = null;
      if (currentStudent.faceDescriptor && currentStudent.faceDescriptor.length > 0) {
        var dist = faceapi.euclideanDistance(
          desc,
          currentStudent.faceDescriptor,
        );
        fm = Math.max(0, 1 - dist);
      } else {
        fm = 1.0;
        newDesc = Array.from(desc);
      }
      var photo = cv.toDataURL("image/jpeg", 0.4);
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
    '<div class="form-group"><label class="form-label">Barcode / NIS / NIP</label><input type="text" class="form-input" id="sbc"></div><div class="form-group"><label class="form-label">Status</label><select class="form-select" id="sst"><option value="Sakit">Sakit</option><option value="Izin">Izin</option></select></div><div class="form-group"><label class="form-label">Keterangan</label><textarea class="form-input" id="skt" rows="3"></textarea></div><button class="btn btn-primary" style="width:100%" onclick="submitSick()">Kirim</button><button class="btn btn-outline" style="width:100%;margin-top:10px" onclick="showOptions()">Batal</button>';
}
function submitSick() {
  var bc = document.getElementById("sbc").value.trim();
  var st = document.getElementById("sst").value;
  var kt = document.getElementById("skt").value;
  if (!bc) {
    showToast("Isi barcode", "error");
    return;
  }

  window.callGasAPI(
    "getStudentByBarcode",
    { barcode: bc },
    function (r) {
      currentStudent = r.student;
      window.callGasAPI(
        "submitSickLeave",
        {
          studentId: currentStudent.id,
          nama: currentStudent.nama,
          kelas: currentStudent.kelas,
          status: st,
          keterangan: kt,
        },
        function (r2) {
          showSuccess(r2.status, r2.time, 0);
        },
        function (e2) {
          showToast("Gagal kirim izin", "error");
        },
      );
    },
    function (err) {
      showToast("Tidak ditemukan", "error");
    },
  );
}
function showSuccess(st, tm, fm) {
  var c = document.getElementById("student-content");
  var col = st === "Terlambat" ? "var(--warning)" : "var(--success)";
  c.innerHTML =
    '<div class="success-screen"><div class="success-icon" style="background:' +
    col +
    '"><i data-lucide="check" style="width:40px;height:40px"></i></div><h2 style="color:' +
    col +
    ';margin-bottom:10px">Berhasil!</h2><strong>' +
    currentStudent.nama +
    '</strong><p style="color:var(--gray)">' +
    currentStudent.kelas +
    '</p><div style="background:var(--bg);padding:15px;border-radius:8px;margin:20px 0;text-align:left"><p><strong>Status:</strong> ' +
    st +
    "</p><p><strong>Waktu:</strong> " +
    tm +
    "</p><p><strong>Verifikasi:</strong> " +
    (fm > 0.5 ? "Cocok" : "Tidak") +
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
