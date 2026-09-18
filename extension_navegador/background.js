/**
 * ANDROMEDA DOWNLOAD - Service Worker de Integración
 * Intercepta descargas del navegador y procesa el menú contextual.
 */

const PUERTO_ANDROMEDA = 47990;
const URL_IPC = `http://127.0.0.1:${PUERTO_ANDROMEDA}/descargar`;

// Extensiones de archivo interceptadas automáticamente
const EXTENSIONES_INTERCEPTAR = [
    ".zip", ".rar", ".7z", ".tar", ".gz", ".iso",
    ".exe", ".msi", ".apk", ".bin",
    ".mp4", ".mkv", ".avi", ".mov", ".webm",
    ".mp3", ".flac", ".wav", ".aac",
    ".pdf", ".docx", ".xlsx", ".pptx"
];

// Enviar descarga o apertura de formulario a ANDROMEDA DOWNLOAD mediante HTTP REST local
async function enviarAAndromeda(url, nombre = "", referer = "", abrirModal = true) {
    try {
        const respuesta = await fetch(URL_IPC, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: url,
                nombre: nombre,
                referer: referer || "",
                origen: "extension_navegador",
                abrir_modal: abrirModal
            })
        });

        if (respuesta.ok) {
            console.log("[ANDROMEDA] Petición transferida con éxito al sistema:", url);
            return true;
        }
    } catch (error) {
        console.warn("[ANDROMEDA] No se pudo conectar con el cliente de escritorio:", error.message);
    }
    return false;
}

// 1. Intercepción automática de descargas del navegador
chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
    const nombre = item.filename || "";
    const url = item.finalUrl || item.url || "";
    const extension = nombre.substring(nombre.lastIndexOf(".")).toLowerCase();

    // Comprobar si el archivo coincide con los tipos acelerables o sitios de almacenamiento directo
    const esAcelerable = EXTENSIONES_INTERCEPTAR.includes(extension) ||
                         url.includes("mediafire.com") ||
                         url.includes("drive.google.com") ||
                         url.includes("mega.nz");

    if (esAcelerable) {
        // Enviar a ANDROMEDA inmediatamente
        enviarAAndromeda(url, nombre, item.referrer, true);

        // Cancelar de inmediato la descarga nativa de Chrome para evitar que abra el diálogo "Guardar como"
        try {
            chrome.downloads.cancel(item.id, () => {
                chrome.downloads.erase({ id: item.id });
            });
        } catch (e) {
            console.warn("[ANDROMEDA] Error cancelando descarga nativa:", e);
        }
        return false;
    }
});

// 2. Creación del menú contextual al dar clic derecho (Simplificado)
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "andromeda_descargar_enlace",
        title: "Descargar con Andromeda",
        contexts: ["link", "video", "audio", "image"]
    });
});

// Procesar clic en el menú contextual: Abre el formulario en la app
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "andromeda_descargar_enlace") {
        let urlDestino = info.linkUrl || info.srcUrl || "";
        // Si es un video HTML5 con blob: URL o no tiene URL directa, usar la URL de la pestaña
        if (!urlDestino || urlDestino.startsWith("blob:")) {
            urlDestino = tab ? tab.url : "";
        }
        if (urlDestino) {
            enviarAAndromeda(urlDestino, tab ? (tab.title || "") : "", tab ? tab.url : "", true);
        }
    }
});

// 3. Clic directo en el icono de la extensión en la barra de extensiones
chrome.action.onClicked.addListener((tab) => {
    if (tab && tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://")) {
        enviarAAndromeda(tab.url, tab.title || "", tab.url, true);
    }
});

// 4. Comunicación desde el botón flotante en YouTube / reproductores
chrome.runtime.onMessage.addListener((mensaje, sender, sendResponse) => {
    if (mensaje.tipo === "DESCARGAR_VIDEO_ANDROMEDA" || mensaje.tipo === "ABRIR_MODAL_ANDROMEDA") {
        enviarAAndromeda(mensaje.url, mensaje.nombre, sender.tab ? sender.tab.url : "", true).then(ok => {
            sendResponse({ exito: ok });
        });
        return true; // Respuesta asíncrona
    }
});
