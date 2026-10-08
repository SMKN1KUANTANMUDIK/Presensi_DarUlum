// Konektor API ke Google Apps Script
// Ganti URL ini dengan URL "Execute as Me" -> "Anyone" dari Deployment Google Script Anda.
const GAS_URL = "https://script.google.com/macros/s/AKfycbwPmqZo9Aercc9tI1Q2mdmzarUlnhL7pAIBCpWEjf15-PCkXxeH0ysO7TyRdylFr_Q/exec";

window.lastApiError = null;

window.callGasAPI = function (action, payload, onSuccess, onError) {
    if (!payload) payload = {};
    payload.action = action;

    // Gunakan POST untuk kirim data aman & ukurannya besar (seperti foto Base64)
    fetch(GAS_URL, {
        method: "POST",
        // 'text/plain' mencegah masalah preflight CORS di beberapa kondisi Google Script
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    })
        .then(response => response.text())
        .then(text => {
            try {
                var data = JSON.parse(text);
                window.lastApiError = null;
                if (data.success === false) {
                    if (onError) onError(data.error);
                } else {
                    if (onSuccess) onSuccess(data);
                }
            } catch (errJson) {
                var errDetail = "";
                if (text.includes("accounts.google.com") || text.includes("<html") || text.includes("ServiceLogin")) {
                    errDetail = "Akses Google Apps Script mewajibkan Login Google (Redirect 302). Solusi: Di Google Script Editor, pilih Deploy > Manage deployments > Edit > Ubah 'Who has access' menjadi 'Anyone' (Siapa saja, bahkan anonim) dan 'Execute as' menjadi 'Me'.";
                } else {
                    errDetail = "Respon server bukan format JSON yang valid: " + errJson.message;
                }
                window.lastApiError = errDetail;
                console.error("API Call Error:", errDetail, text.slice(0, 300));
                if (onError) onError(errDetail);
            }
        })
        .catch(err => {
            var errMsg = err.toString();
            var detail = "Koneksi ke backend gagal: " + errMsg;
            if (errMsg.includes("Failed to fetch") || errMsg.includes("NetworkError")) {
                detail = "Google Apps Script meminta Login Google (Redirect 302). Solusi: Di Google Script Editor, pilih Deploy > Manage deployments > Edit > Ubah 'Who has access' (Siapa yang memiliki akses) menjadi 'Anyone' (Siapa saja). Jika memakai akun belajar.id / sekolah, gunakan akun Gmail biasa (@gmail.com) karena akun instansi membatasi akses publik.";
            }
            window.lastApiError = detail;
            console.error("API Call Error:", detail, err);
            if (onError) onError(detail);
        });
};
