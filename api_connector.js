// Konektor API ke Google Apps Script
// Ganti URL ini dengan URL "Execute as Me" -> "Anyone" dari Deployment Google Script Anda.
const GAS_URL = "https://script.google.com/macros/s/AKfycbz1igIUFoDJ6UazMuRaxu49QuD52R9Uvd16FSgAije3m4i52GIOkDo7AA6Bud7_LMw/exec";

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
        .then(response => response.json())
        .then(data => {
            if (data.success === false) {
                if (onError) onError(data.error);
            } else {
                if (onSuccess) onSuccess(data);
            }
        })
        .catch(err => {
            console.error("API Call Error:", err);
            if (onError) onError(err.toString());
        });
};
