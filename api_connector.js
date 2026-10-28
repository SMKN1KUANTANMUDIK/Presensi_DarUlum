// Konektor API ke Google Apps Script.
// Catatan: URL Web App bukan mekanisme autentikasi. Endpoint yang dapat diakses "Anyone"
// harus dilindungi validasi/otorisasi di backend sebelum dipakai untuk data produksi.
const GAS_URL = "https://script.google.com/macros/s/AKfycbwoEz18f77lOgZzk6tRWt5fKv0tm3h2WhhODgq0dSC3sMKrkItbCvWoB9eTEzvOtwI/exec";

window.lastApiError = null;

window.callGasAPI = function (action, payload, onSuccess, onError) {
    const requestData = Object.assign({}, payload || {}, { action: action });
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 60000) : null;

    fetch(GAS_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(requestData),
        signal: controller ? controller.signal : undefined
    })
    .then(response => {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.text();
    })
    .then(text => {
        let data;
        try {
            data = JSON.parse(text);
        } catch (errJson) {
            const loginPage = /accounts\.google\.com|<html|ServiceLogin/i.test(text);
            const detail = loginPage
                ? "Backend mengembalikan halaman login Google. Periksa deployment Web App dan izin aksesnya."
                : "Respons backend bukan JSON yang valid.";
            throw new Error(detail);
        }

        window.lastApiError = null;
        if (data && data.success === false) {
            const detail = data.error || "Permintaan API gagal.";
            window.lastApiError = detail;
            if (typeof onError === "function") onError(detail);
            return;
        }
        if (typeof onSuccess === "function") onSuccess(data);
    })
    .catch(err => {
        const detail = err && err.name === "AbortError"
            ? "Permintaan ke backend melewati batas waktu 60 detik. Coba lagi."
            : "Koneksi/backend gagal: " + (err && err.message ? err.message : String(err));
        window.lastApiError = detail;
        console.error("API Call Error:", detail);
        if (typeof onError === "function") onError(detail);
    })
    .finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    });
};
