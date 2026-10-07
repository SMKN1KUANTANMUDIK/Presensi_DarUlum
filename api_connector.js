// Konektor API ke Google Apps Script
// Ganti URL ini dengan URL "Execute as Me" -> "Anyone" dari Deployment Google Script Anda.
const GAS_URL = "https://script.google.com/macros/s/AKfycbygLmOulICnWJDkPdAeyeFKQYRa-5w6ijZ66CbADxg2IBvnh09-qyN11hn3iF6oyG0/exec";

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
