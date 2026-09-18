/**
 * ANDROMEDA DOWNLOAD - Popup de extensión
 * Muestra estado de descargas en tiempo real consultando el servidor IPC local.
 */

const PUERTO = 47990;
const URL_PING = `http://127.0.0.1:${PUERTO}/ping`;
const URL_DESCARGAR = `http://127.0.0.1:${PUERTO}/descargar`;

let intervaloActualizacion = null;

// ── Iconos SVG por categoría ──
const ICONOS_CAT = {
    videos: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EC4899" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,
    musica: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    documentos: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    programas: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>`,
    comprimidos: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    otros: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`
};

// ── Iconos SVG por estado ──
const ICONOS_EST = {
    "Descargando": `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
    "Completado": `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    "Pausado": `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
    "Error": `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    "Detenido": `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`,
    "Pendiente": `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
};

// ── Formatear bytes ──
function formatearTamano(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const unidades = ["B", "KB", "MB", "GB"];
    let i = 0, val = bytes;
    while (val >= 1024 && i < unidades.length - 1) { val /= 1024; i++; }
    return `${val.toFixed(1)} ${unidades[i]}`;
}

// ── Estado de conexión ──
function setEstadoConexion(online) {
    const dot = document.getElementById("dot-estado");
    if (online) {
        dot.classList.add("online");
        dot.title = "Conectado a ANDROMEDA DOWNLOAD";
    } else {
        dot.classList.remove("online");
        dot.title = "ANDROMEDA DOWNLOAD no está ejecutándose";
    }
}

// ── Renderizar descargas ──
function renderizarDescargas(data) {
    const lista = document.getElementById("lista-descargas");
    const vacio = document.getElementById("estado-vacio");

    // KPIs globales
    const activas = data.activas !== undefined ? data.activas : (data.descargas ? data.descargas.filter(d => d.estado === "Descargando").length : 0);
    const total   = data.total_descargas !== undefined ? data.total_descargas : (data.descargas ? data.descargas.length : 0);
    document.getElementById("kpi-activas").textContent = activas;
    document.getElementById("kpi-total").textContent = total;

    // Velocidad global
    if (data.velocidad_global) {
        document.getElementById("kpi-velocidad").textContent = data.velocidad_global;
    } else {
        // Suma local si el servidor no la provee
        let bps = 0;
        if (data.descargas) {
            data.descargas.forEach(d => {
                const v = parseFloat((d.velocidad || "0").replace(/[^0-9.]/g, ""));
                if (!isNaN(v) && d.estado === "Descargando") {
                    const unidad = (d.velocidad || "").replace(/[0-9. ]/g, "");
                    const mult = unidad.includes("GB") ? 1e9 : unidad.includes("MB") ? 1e6 : unidad.includes("KB") ? 1024 : 1;
                    bps += v * mult;
                }
            });
        }
        document.getElementById("kpi-velocidad").textContent = bps > 0 ? `${formatearTamano(bps)}/s` : "0 B/s";
    }

    // Lista
    lista.innerHTML = "";

    if (!data.descargas || data.descargas.length === 0) {
        const el = document.createElement("div");
        el.className = "vacio";
        el.innerHTML = `<div class="vacio-ico">📭</div><div class="vacio-txt">Sin descargas en el historial.</div>`;
        lista.appendChild(el);
        return;
    }

    // Mostrar las últimas 8 descargas (más recientes primero)
    const recientes = [...data.descargas].reverse().slice(0, 8);
    recientes.forEach(d => {
        const cat = (d.categoria || "otros").toLowerCase();
        const ico = ICONOS_CAT[cat] || "📁";
        const icopista = ICONOS_EST[d.estado] || "🔄";
        const claseEstado = `badge-${(d.estado || "pendiente").toLowerCase()}`;

        const porcentaje = d.tamano_total > 0
            ? Math.min(100, Math.round((d.descargado / d.tamano_total) * 100))
            : (d.estado === "Completado" ? 100 : 0);

        const item = document.createElement("div");
        item.className = "item-descarga";
        item.innerHTML = `
            <div class="item-icono">${ico}</div>
            <div class="item-info">
                <div class="item-nombre" title="${d.nombre || ''}">${d.nombre || 'Sin nombre'}</div>
                <div class="item-detalle">
                    <span class="${claseEstado}">${icopista} ${d.estado || 'Pendiente'}</span>
                    · ${formatearTamano(d.descargado)} / ${formatearTamano(d.tamano_total)}
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${porcentaje}%"></div>
                </div>
            </div>
            <div class="item-vel">${d.estado === 'Descargando' ? (d.velocidad || '') : ''}</div>
        `;
        lista.appendChild(item);
    });
}

// ── Consultar estado al servidor IPC ──
async function obtenerDatosIPC() {
    // Intentar primero con 127.0.0.1
    try {
        const resp = await fetch(`http://127.0.0.1:${PUERTO}/ping`, {
            signal: AbortSignal.timeout(3000),
            cache: "no-store"
        });
        if (resp.ok) return await resp.json();
    } catch (e1) {
        // Fallback a localhost
        try {
            const resp2 = await fetch(`http://localhost:${PUERTO}/ping`, {
                signal: AbortSignal.timeout(3000),
                cache: "no-store"
            });
            if (resp2.ok) return await resp2.json();
        } catch (e2) {
            throw new Error("No se pudo conectar al IPC local");
        }
    }
    throw new Error("Respuesta inválida del servidor");
}

async function actualizarEstado() {
    try {
        const data = await obtenerDatosIPC();
        setEstadoConexion(true);

        if (data.velocidad_global !== undefined) {
            document.getElementById("kpi-velocidad").textContent = data.velocidad_global || "0 B/s";
        }
        if (data.activas !== undefined) {
            document.getElementById("kpi-activas").textContent = data.activas;
        }
        if (data.total_descargas !== undefined) {
            document.getElementById("kpi-total").textContent = data.total_descargas;
        } else if (data.total !== undefined) {
            document.getElementById("kpi-total").textContent = data.total;
        }

        renderizarDescargas(data);
    } catch (err) {
        setEstadoConexion(false);
        document.getElementById("kpi-velocidad").textContent = "--";
        document.getElementById("kpi-activas").textContent = "--";
        document.getElementById("kpi-total").textContent = "--";
        const lista = document.getElementById("lista-descargas");
        lista.innerHTML = `
            <div class="vacio">
                <div class="vacio-ico">⚡</div>
                <div class="vacio-txt">ANDROMEDA DOWNLOAD no está abierto.<br>Abre la aplicación para gestionar tus descargas.</div>
            </div>`;
    }
}

// ── Botón: Abrir App ──
document.getElementById("btn-abrir").addEventListener("click", () => {
    // Abre la app enviando un ping — si la app escucha en el IPC, se abrirá
    fetch(URL_PING).catch(() => {});
    // En Chrome no podemos lanzar ejecutables, pero podemos navegar a chrome://apps o mostrar el overlay
    // La app se debe abrir manualmente la primera vez; el IPC mantiene la conexión
    window.close();
});

// ── Botón: Nueva Descarga ──
document.getElementById("btn-nueva").addEventListener("click", () => {
    // Obtener la URL de la pestaña activa
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const url = tab ? tab.url : "";
        const titulo = tab ? tab.title : "";

        fetch(URL_DESCARGAR, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, nombre: titulo, referer: url, origen: "popup_extension" })
        }).then(() => {
            window.close();
        }).catch(() => {
            // Si la app no está abierta, mostrar aviso
            const footer = document.querySelector(".footer");
            footer.innerHTML = `<div style="color:#F87171;font-size:11px;padding:4px 0">⚠ ANDROMEDA DOWNLOAD no está ejecutándose.</div>`;
        });
    });
});

// ── Iniciar actualización periódica ──
actualizarEstado();
intervaloActualizacion = setInterval(actualizarEstado, 2000);
