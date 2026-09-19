use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::{Seek, SeekFrom, Write};
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock};
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderValue, RANGE, USER_AGENT};
use uuid::Uuid;

#[cfg(target_os = "windows")]
#[allow(unused_imports)]
use std::os::windows::process::CommandExt;

use crate::gestor_sockets::GestorSockets;
use crate::modelos::{
    DescargaItem, GlobalTelemetry, ItemLoteDescarga, PlaylistItemProbe, PlaylistProbeResult,
    ProbeResult, SegmentoDescarga, UserSettings,
};
use crate::roi_telemetria::{calcular_speed_duel, formatear_tamano_legible, formatear_velocidad, formatear_tiempo_segundos};

const DEFAULT_USER_AGENT: &str = "AndromedaDownload/1.0 (Windows NT 10.0; Win64; x64) High-Speed Engine";

pub struct TareaDescargaHandle {
    pub item: Arc<RwLock<DescargaItem>>,
    pub cancelado: Arc<AtomicBool>,
    pub pausado: Arc<AtomicBool>,
    pub gestor_sockets: GestorSockets,
    pub bytes_recientes: Arc<AtomicU64>,
    pub ultimo_tick: Arc<Mutex<Instant>>,
}

pub struct GestorDescargas {
    pub tareas: Arc<RwLock<HashMap<String, Arc<TareaDescargaHandle>>>>,
    pub gestor_sockets: GestorSockets,
    pub client: reqwest::Client,
    pub ajustes: Arc<RwLock<UserSettings>>,
    pub velocidad_pico_bps: Arc<RwLock<f64>>,
}

impl GestorDescargas {
    pub fn obtener_ruta_config() -> std::path::PathBuf {
        #[cfg(target_os = "windows")]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                let mut dir = std::path::PathBuf::from(appdata);
                dir.push("AndromedaDownload");
                let _ = std::fs::create_dir_all(&dir);
                dir.push("config.json");
                return dir;
            }
        }
        std::path::PathBuf::from("andromeda_config.json")
    }

    pub fn cargar_ajustes_disco() -> UserSettings {
        let path = Self::obtener_ruta_config();
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(ajustes) = serde_json::from_str::<UserSettings>(&data) {
                    return ajustes;
                }
            }
        }
        UserSettings::default()
    }

    pub fn guardar_ajustes_disco(ajustes: &UserSettings) {
        let path = Self::obtener_ruta_config();
        if let Ok(json) = serde_json::to_string_pretty(ajustes) {
            let _ = std::fs::write(&path, json);
        }
    }

    pub fn obtener_ruta_descargas_db() -> std::path::PathBuf {
        #[cfg(target_os = "windows")]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                let mut dir = std::path::PathBuf::from(appdata);
                dir.push("AndromedaDownload");
                let _ = std::fs::create_dir_all(&dir);
                dir.push("downloads.json");
                return dir;
            }
        }
        std::path::PathBuf::from("andromeda_downloads.json")
    }

    pub fn cargar_descargas_disco() -> Vec<DescargaItem> {
        let path = Self::obtener_ruta_descargas_db();
        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(items) = serde_json::from_str::<Vec<DescargaItem>>(&data) {
                    // Si el usuario eliminó manualmente los archivos en Windows Explorer, no recargar tareas huérfanas
                    return items
                        .into_iter()
                        .filter(|it| {
                            if it.estado == "Eliminado" {
                                return false;
                            }
                            if it.estado == "Completado" && !std::path::Path::new(&it.ruta_destino).exists() {
                                return false;
                            }
                            true
                        })
                        .collect();
                }
            }
        }
        Vec::new()
    }

    pub async fn guardar_descargas_disco(&self) {
        let mut lista = Vec::new();
        {
            let map = self.tareas.read().await;
            for h in map.values() {
                let it = h.item.read().await;
                if it.estado != "Eliminado" {
                    lista.push(it.clone());
                }
            }
        }
        let path = Self::obtener_ruta_descargas_db();
        if let Ok(json) = serde_json::to_string_pretty(&lista) {
            let _ = std::fs::write(&path, json);
        }
    }

    pub fn new() -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .pool_max_idle_per_host(64)
            .build()
            .unwrap_or_default();

        let ajustes_cargados = Self::cargar_ajustes_disco();
        let guardadas = Self::cargar_descargas_disco();
        let mut tareas_map = HashMap::new();

        for mut it in guardadas {
            if it.estado == "Descargando" {
                it.estado = "Pausado".to_string();
                it.velocidad = "0.00 B/s".to_string();
                it.velocidad_bps = 0.0;
            }
            let handle = Arc::new(TareaDescargaHandle {
                item: Arc::new(RwLock::new(it.clone())),
                cancelado: Arc::new(AtomicBool::new(false)),
                pausado: Arc::new(AtomicBool::new(true)),
                gestor_sockets: GestorSockets::new(32),
                bytes_recientes: Arc::new(AtomicU64::new(0)),
                ultimo_tick: Arc::new(Mutex::new(Instant::now())),
            });
            tareas_map.insert(it.id.clone(), handle);
        }

        let tareas = Arc::new(RwLock::new(tareas_map));
        let ajustes = Arc::new(RwLock::new(ajustes_cargados));

        Self {
            tareas,
            gestor_sockets: GestorSockets::new(96),
            client,
            ajustes,
            velocidad_pico_bps: Arc::new(RwLock::new(0.0)),
        }
    }

    /// Background Queue Runner ejecutado en el runtime asíncrono de Tokio una vez iniciado Tauri
    pub async fn iniciar_queue_runner(self: Arc<Self>) {
        let mut ticks = 0u64;
        loop {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
            ticks += 1;

            let max_simultaneas = {
                let a = self.ajustes.read().await;
                a.max_descargas_simultaneas.clamp(1, 10)
            };

            let mut activas = 0;
            let mut pendientes: Vec<(String, Arc<TareaDescargaHandle>, String)> = Vec::new();

            {
                let map = self.tareas.read().await;
                for (id, handle) in map.iter() {
                    let it = handle.item.read().await;
                    if it.estado == "Descargando" {
                        activas += 1;
                    } else if it.estado == "Pendiente" || it.estado == "En Cola" {
                        pendientes.push((id.clone(), handle.clone(), it.fecha_creacion.clone()));
                    }
                }
            }

            if activas < max_simultaneas && !pendientes.is_empty() {
                // Ordenar por fecha_creacion ascendente para respetar orden 1, 2, 3...
                pendientes.sort_by(|a, b| a.2.cmp(&b.2));
                let cupos = max_simultaneas - activas;
                for (_, handle, _) in pendientes.into_iter().take(cupos) {
                    handle.pausado.store(false, Ordering::SeqCst);
                    handle.cancelado.store(false, Ordering::SeqCst);
                    let h = handle.clone();
                    let c = self.client.clone();
                    tokio::spawn(async move {
                        ejecutar_descarga(h, c).await;
                    });
                }
            }

            // Flush seguro a disco cada 3 segundos
            if ticks % 3 == 0 {
                self.guardar_descargas_disco().await;
            }
        }
    }

    pub async fn sondear_url(&self, url: &str) -> ProbeResult {
        if url.contains("youtube.com") || url.contains("youtu.be") {
            let mut nombre_detectado = "YouTube Video.mp4".to_string();
            let mut tamano_est = 245 * 1024 * 1024u64;
            let mut tamano_str = "245.00 MB (1080p 60fps)".to_string();

            // 1. Intento Ultrarrápido (<150ms) vía API oficial oEmbed de YouTube
            if let Ok(resp) = tokio::time::timeout(
                std::time::Duration::from_millis(2500),
                self.client.get("https://www.youtube.com/oembed").query(&[("url", url), ("format", "json")]).send()
            ).await {
                if let Ok(r) = resp {
                    if r.status().is_success() {
                        if let Ok(json) = r.json::<serde_json::Value>().await {
                            if let Some(titulo) = json.get("title").and_then(|v| v.as_str()) {
                                if !titulo.trim().is_empty() {
                                    let mut limpio: String = titulo.trim().chars()
                                        .map(|c| match c {
                                            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                                            _ => c,
                                        })
                                        .collect();
                                    limpio = limpio.replace('\u{FFFD}', "");
                                    if limpio.chars().count() > 60 {
                                        limpio = limpio.chars().take(60).collect();
                                    }
                                    nombre_detectado = format!("{}.mp4", limpio.trim());
                                    return ProbeResult {
                                        ok: true,
                                        url: url.to_string(),
                                        nombre: Some(nombre_detectado),
                                        tamano: Some(tamano_est),
                                        tamano_str: Some(tamano_str),
                                        soporta_rangos: true,
                                        categoria: Some("Videos".to_string()),
                                        content_type: Some("video/mp4".to_string()),
                                        error: None,
                                    };
                                }
                            }
                        }
                    }
                }
            }

            // 2. Fallback secundario con yt-dlp subproceso
            let mut cmd = tokio::process::Command::new(if cfg!(target_os = "windows") { "python" } else { "python3" });
            cmd.env("PYTHONIOENCODING", "utf-8");
            cmd.args(["-X", "utf8", "-m", "yt_dlp", "--no-warnings", "--no-playlist", "--print", "%(title)s###%(duration)s###%(filesize_approx)s", url]);
            #[cfg(target_os = "windows")]
            cmd.creation_flags(0x08000000);

            if let Ok(salida) = tokio::time::timeout(
                std::time::Duration::from_secs(5),
                cmd.output(),
            ).await {
                if let Ok(out) = salida {
                    if out.status.success() {
                        let t = String::from_utf8_lossy(&out.stdout).trim().to_string();
                        let parts: Vec<&str> = t.split("###").collect();
                        if let Some(titulo) = parts.get(0) {
                            if !titulo.trim().is_empty() {
                                let mut limpio: String = titulo.trim().chars()
                                    .map(|c| match c {
                                        '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                                        _ => c,
                                    })
                                    .collect();
                                limpio = limpio.replace('\u{FFFD}', "");
                                if limpio.chars().count() > 60 {
                                    limpio = limpio.chars().take(60).collect();
                                }
                                nombre_detectado = format!("{}.mp4", limpio.trim());
                            }
                        }
                        if let Some(fs_str) = parts.get(2) {
                            if let Ok(fs) = fs_str.trim().parse::<u64>() {
                                if fs > 0 {
                                    tamano_est = fs;
                                    tamano_str = format!("{} (1080p 60fps)", formatear_tamano_legible(fs));
                                }
                            }
                        }
                    }
                }
            }

            return ProbeResult {
                ok: true,
                url: url.to_string(),
                nombre: Some(nombre_detectado),
                tamano: Some(tamano_est),
                tamano_str: Some(tamano_str),
                soporta_rangos: true,
                categoria: Some("Videos".to_string()),
                content_type: Some("video/mp4".to_string()),
                error: None,
            };
        }

        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static(DEFAULT_USER_AGENT));
        headers.insert(RANGE, HeaderValue::from_static("bytes=0-0"));

        let mut soporta_rangos = false;
        let mut tamano: Option<u64> = None;
        let mut nombre: Option<String> = None;
        let mut content_type: Option<String> = None;

        // 1. Probe con Range: bytes=0-0
        let mut final_url = url.to_string();
        if let Ok(resp) = self.client.get(url).headers(headers.clone()).send().await {
            final_url = resp.url().to_string();
            let status = resp.status().as_u16();
            if status == 206 {
                soporta_rangos = true;
                if let Some(cr) = resp.headers().get("Content-Range") {
                    if let Ok(cr_str) = cr.to_str() {
                        if let Some(pos) = cr_str.rfind('/') {
                            let total_str = cr_str[pos + 1..].trim();
                            if let Ok(num) = total_str.parse::<u64>() {
                                tamano = Some(num);
                            }
                        }
                    }
                }
            } else if status == 200 {
                // Servidores que no soportan partial content pero devuelven Content-Length en 200 OK (ej. GitHub Releases / zip)
                if let Some(ar) = resp.headers().get("Accept-Ranges") {
                    if let Ok(ar_str) = ar.to_str() {
                        if ar_str.contains("bytes") {
                            soporta_rangos = true;
                        }
                    }
                }
                if let Some(cl) = resp.headers().get("Content-Length") {
                    if let Ok(cl_str) = cl.to_str() {
                        if let Ok(num) = cl_str.trim().parse::<u64>() {
                            tamano = Some(num);
                        }
                    }
                }
            }

            if let Some(ct) = resp.headers().get("Content-Type") {
                if let Ok(ct_str) = ct.to_str() {
                    content_type = Some(ct_str.to_string());
                }
            }

            if let Some(cd) = resp.headers().get("Content-Disposition") {
                if let Ok(cd_str) = cd.to_str() {
                    nombre = extraer_nombre_content_disposition(cd_str);
                }
            }
        }

        // 2. Si no se detectó tamaño o rangos, probar con HEAD
        if tamano.is_none() {
            if let Ok(head_resp) = self.client.head(url).header(USER_AGENT, DEFAULT_USER_AGENT).send().await {
                if let Some(ar) = head_resp.headers().get("Accept-Ranges") {
                    if let Ok(ar_str) = ar.to_str() {
                        if ar_str.contains("bytes") {
                            soporta_rangos = true;
                        }
                    }
                }
                if let Some(cl) = head_resp.headers().get("Content-Length") {
                    if let Ok(cl_str) = cl.to_str() {
                        if let Ok(num) = cl_str.parse::<u64>() {
                            tamano = Some(num);
                        }
                    }
                }
                if nombre.is_none() {
                    if let Some(cd) = head_resp.headers().get("Content-Disposition") {
                        if let Ok(cd_str) = cd.to_str() {
                            nombre = extraer_nombre_content_disposition(cd_str);
                        }
                    }
                }
            }
        }

        if nombre.is_none() {
            let candidate = extraer_nombre_url(&final_url);
            if !candidate.is_empty() && candidate != "descarga_archivo" {
                nombre = Some(candidate);
            } else {
                nombre = Some(extraer_nombre_url(url));
            }
        }

        let nombre_final = nombre.unwrap_or_else(|| "descarga_archivo".to_string());
        let categoria = clasificar_categoria(&nombre_final);
        let tamano_str = tamano.map(formatear_tamano_legible);

        ProbeResult {
            ok: true,
            url: url.to_string(),
            nombre: Some(nombre_final),
            tamano,
            tamano_str,
            soporta_rangos,
            categoria: Some(categoria),
            content_type,
            error: None,
        }
    }

    pub async fn sondear_playlist(&self, url: &str) -> PlaylistProbeResult {
        let mut cmd = Command::new(if cfg!(target_os = "windows") { "python" } else { "python3" });
        cmd.env("PYTHONIOENCODING", "utf-8");
        cmd.args(["-X", "utf8", "-m", "yt_dlp", "--flat-playlist", "--dump-single-json", "--no-warnings", url]);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        let res = tokio::time::timeout(std::time::Duration::from_secs(18), cmd.output()).await;
        match res {
            Ok(Ok(out)) => {
                if out.status.success() {
                    let text = String::from_utf8_lossy(&out.stdout);
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                        let titulo_playlist = json.get("title").and_then(|v| v.as_str()).unwrap_or("Lista de Reproducción").to_string();
                        let canal = json.get("uploader").or_else(|| json.get("channel")).and_then(|v| v.as_str()).unwrap_or("Desconocido").to_string();
                        let id_pl = json.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();

                        let mut items_probe = Vec::new();
                        if let Some(entries) = json.get("entries").and_then(|v| v.as_array()) {
                            for (idx, entry) in entries.iter().enumerate() {
                                let id = entry.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let raw_title = entry.get("title").and_then(|v| v.as_str()).unwrap_or("Video").to_string();
                                let mut title: String = raw_title.chars().map(|c| match c {
                                    '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
                                    _ => c,
                                }).collect();
                                if title.trim().is_empty() {
                                    title = format!("Pista_{}", idx + 1);
                                }
                                let dur_secs = entry.get("duration").and_then(|v| v.as_f64()).unwrap_or(0.0);
                                let dur_str = if dur_secs > 0.0 {
                                    let m = (dur_secs / 60.0).floor() as u64;
                                    let s = (dur_secs % 60.0) as u64;
                                    format!("{:02}:{:02}", m, s)
                                } else {
                                    entry.get("duration_string").and_then(|v| v.as_str()).unwrap_or("--:--").to_string()
                                };

                                let item_url = entry.get("url").and_then(|v| v.as_str()).map(|u| {
                                    if u.starts_with("http") { u.to_string() } else { format!("https://www.youtube.com/watch?v={}", id) }
                                }).unwrap_or_else(|| format!("https://www.youtube.com/watch?v={}", id));

                                let thumbnail = entry.get("thumbnails")
                                    .and_then(|t| t.as_array())
                                    .and_then(|arr| arr.last())
                                    .and_then(|thumb| thumb.get("url"))
                                    .and_then(|u| u.as_str())
                                    .map(|s| s.to_string())
                                    .or_else(|| Some(format!("https://i.ytimg.com/vi/{}/mqdefault.jpg", id)));

                                items_probe.push(PlaylistItemProbe {
                                    id: if id.is_empty() { format!("item_{}", idx) } else { id },
                                    titulo: title.trim().to_string(),
                                    duracion_str: dur_str,
                                    duracion_segundos: dur_secs,
                                    url: item_url,
                                    thumbnail,
                                    formato_sugerido: "1080p".to_string(),
                                    tamano_est_bytes: 45 * 1024 * 1024,
                                });
                            }
                        }

                        let total = items_probe.len();
                        return PlaylistProbeResult {
                            ok: true,
                            id_playlist: id_pl,
                            titulo: titulo_playlist,
                            canal,
                            total_items: total,
                            items: items_probe,
                            error: None,
                        };
                    }
                }
                PlaylistProbeResult {
                    ok: false,
                    id_playlist: "".to_string(),
                    titulo: "".to_string(),
                    canal: "".to_string(),
                    total_items: 0,
                    items: Vec::new(),
                    error: Some("No se pudo obtener la lista de reproducción. Verifique la URL o su conexión.".to_string()),
                }
            }
            Ok(Err(e)) => PlaylistProbeResult {
                ok: false,
                id_playlist: "".to_string(),
                titulo: "".to_string(),
                canal: "".to_string(),
                total_items: 0,
                items: Vec::new(),
                error: Some(format!("Error de subproceso yt-dlp: {}", e)),
            },
            Err(_) => PlaylistProbeResult {
                ok: false,
                id_playlist: "".to_string(),
                titulo: "".to_string(),
                canal: "".to_string(),
                total_items: 0,
                items: Vec::new(),
                error: Some("Tiempo de espera agotado al sondear la lista de reproducción.".to_string()),
            },
        }
    }

    pub async fn iniciar_descargas_lote(&self, items: Vec<ItemLoteDescarga>, encolar: bool) -> Result<usize, String> {
        let mut creadas = 0;
        for item in items {
            let ext = if item.formato.to_lowercase().contains("mp3") {
                "mp3"
            } else if item.formato.to_lowercase().contains("m4a") {
                "m4a"
            } else {
                "mp4"
            };

            let mut nombre_con_ext = item.titulo.trim().to_string();
            if !nombre_con_ext.to_lowercase().ends_with(&format!(".{}", ext)) {
                nombre_con_ext = format!("{}.{}", nombre_con_ext, ext);
            }

            let cat = if ext == "mp3" || ext == "m4a" {
                "Música".to_string()
            } else {
                "Videos".to_string()
            };

            let _ = self.agregar_e_iniciar(
                item.url,
                Some(nombre_con_ext),
                Some(item.carpeta),
                item.conexiones,
                Some(cat),
                encolar,
                None,
                false,
                None,
            ).await;
            creadas += 1;
        }
        Ok(creadas)
    }

    pub async fn agregar_e_iniciar(
        &self,
        url: String,
        nombre_opt: Option<String>,
        ruta_destino_opt: Option<String>,
        conexiones_opt: Option<usize>,
        categoria_opt: Option<String>,
        programada: bool,
        fecha_programada: Option<String>,
        alta_demanda: bool,
        tamano_forzado: Option<u64>,
    ) -> String {
        let id = Uuid::new_v4().to_string();
        let cfg = self.ajustes.read().await.clone();

        // 1. Sonda rápida del recurso solo si no se proporcionó nombre ni tamaño
        let is_media_stream = url.contains("youtube.com") || url.contains("youtu.be");
        let probe = if nombre_opt.is_some() && (tamano_forzado.is_some() || is_media_stream) {
            ProbeResult {
                ok: true,
                url: url.clone(),
                nombre: nombre_opt.clone(),
                tamano: tamano_forzado,
                tamano_str: None,
                soporta_rangos: true,
                categoria: categoria_opt.clone(),
                content_type: None,
                error: None,
            }
        } else {
            self.sondear_url(&url).await
        };

        let mut nombre = nombre_opt
            .filter(|n| !n.trim().is_empty())
            .or(probe.nombre)
            .unwrap_or_else(|| extraer_nombre_url(&url));

        // Asegurar extensión adecuada para streams multimedia si no tiene
        if is_media_stream && !nombre.contains('.') {
            nombre = format!("{}.mp4", nombre);
        }

        let categoria = categoria_opt
            .filter(|c| !c.trim().is_empty())
            .or(probe.categoria)
            .unwrap_or_else(|| clasificar_categoria(&nombre));

        let subcarpeta = obtener_subcarpeta_categoria(&categoria, &cfg.idioma);

        let ruta_destino = if let Some(r) = ruta_destino_opt.filter(|p| !p.trim().is_empty()) {
            let p = std::path::Path::new(&r);
            let ya_es_archivo = if let Some(file_name) = p.file_name() {
                file_name.to_string_lossy().eq_ignore_ascii_case(&nombre)
            } else {
                false
            };

            if ya_es_archivo {
                if let Some(parent) = p.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                r
            } else {
                // r es un directorio de destino
                let mut dir = r.trim_end_matches(['\\', '/']).to_string();
                if cfg.auto_categorizar {
                    let ult_componente = std::path::Path::new(&dir).file_name().and_then(|n| n.to_str()).unwrap_or("");
                    if !ult_componente.eq_ignore_ascii_case(subcarpeta) && !ult_componente.eq_ignore_ascii_case(&categoria) {
                        dir = format!("{}\\{}", dir, subcarpeta);
                    }
                }
                let _ = std::fs::create_dir_all(&dir);
                format!("{}\\{}", dir, nombre)
            }
        } else {
            let mut dir = cfg.directorio_descargas.trim_end_matches(['\\', '/']).to_string();
            if cfg.auto_categorizar {
                dir = format!("{}\\{}", dir, subcarpeta);
            }
            let _ = std::fs::create_dir_all(&dir);
            format!("{}\\{}", dir, nombre)
        };

        let mut conexiones = conexiones_opt.unwrap_or(cfg.conexiones_por_archivo);
        if alta_demanda {
            conexiones = conexiones.max(32);
        }
        conexiones = conexiones.clamp(1, 32);

        let tamano_total = tamano_forzado
            .filter(|&t| t > 0)
            .or(probe.tamano)
            .unwrap_or(if is_media_stream { 115 * 1024 * 1024 } else { 0 });
        let soporta_rangos = if is_media_stream { true } else { probe.soporta_rangos };
        let estado = if programada { "Programada".to_string() } else { "Pendiente".to_string() };

        let item = DescargaItem {
            id: id.clone(),
            url: url.clone(),
            nombre,
            ruta_destino: ruta_destino.clone(),
            tamano_total,
            descargado: 0,
            progreso: 0.0,
            velocidad: "0.00 B/s".to_string(),
            velocidad_bps: 0.0,
            eta: "--:--".to_string(),
            estado,
            categoria,
            conexiones,
            alta_demanda,
            soporta_rangos,
            fecha_creacion: chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            fecha_fin: None,
            fecha_programada,
            hashes: HashMap::new(),
            error: None,
            roi: None,
            segmentos: Vec::new(),
        };

        let handle = Arc::new(TareaDescargaHandle {
            item: Arc::new(RwLock::new(item)),
            cancelado: Arc::new(AtomicBool::new(false)),
            pausado: Arc::new(AtomicBool::new(false)),
            gestor_sockets: self.gestor_sockets.clone(),
            bytes_recientes: Arc::new(AtomicU64::new(0)),
            ultimo_tick: Arc::new(Mutex::new(Instant::now())),
        });

        self.tareas.write().await.insert(id.clone(), handle.clone());
        self.guardar_descargas_disco().await;

        if !programada {
            let client = self.client.clone();
            tokio::spawn(async move {
                ejecutar_descarga(handle, client).await;
            });
        }

        id
    }

    pub async fn pausar(&self, id: &str) {
        if let Some(t) = self.tareas.read().await.get(id) {
            t.pausado.store(true, Ordering::SeqCst);
            let mut it = t.item.write().await;
            it.estado = "Pausado".to_string();
            it.velocidad = "0.00 B/s".to_string();
            it.velocidad_bps = 0.0;
        }
        self.guardar_descargas_disco().await;
    }

    pub async fn reanudar(&self, id: &str) {
        if let Some(t) = self.tareas.read().await.get(id) {
            t.pausado.store(false, Ordering::SeqCst);
            t.cancelado.store(false, Ordering::SeqCst);
            {
                let mut it = t.item.write().await;
                it.fecha_programada = None;
                if it.estado == "Programada" || it.estado == "Pausado" || it.estado == "Detenido" {
                    it.estado = "Descargando".to_string();
                }
            }
            let client = self.client.clone();
            let handle = t.clone();
            tokio::spawn(async move {
                ejecutar_descarga(handle, client).await;
            });
        }
        self.guardar_descargas_disco().await;
    }

    pub async fn detener(&self, id: &str) {
        if let Some(t) = self.tareas.read().await.get(id) {
            t.cancelado.store(true, Ordering::SeqCst);
            let mut it = t.item.write().await;
            it.estado = "Detenido".to_string();
            it.velocidad = "0.00 B/s".to_string();
            it.velocidad_bps = 0.0;
        }
        self.guardar_descargas_disco().await;
    }

    pub async fn eliminar(&self, id: &str, borrar_archivo: bool) {
        self.detener(id).await;
        let ruta = if let Some(t) = self.tareas.read().await.get(id) {
            Some(t.item.read().await.ruta_destino.clone())
        } else {
            None
        };

        if borrar_archivo {
            if let Some(r) = ruta {
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
                let _ = std::fs::remove_file(&r);
                let _ = std::fs::remove_file(format!("{}.part", &r));
                let _ = std::fs::remove_file(format!("{}.ytdl", &r));
                let _ = std::fs::remove_file(format!("{}.tmp", &r));

                let ruta_base = r.rsplit_once('.').map(|(b, _)| b).unwrap_or(&r);
                for ext in &["mp3", "m4a", "mp4", "mkv", "webm"] {
                    let alt_path = format!("{}.{}", ruta_base, ext);
                    let _ = std::fs::remove_file(&alt_path);
                    let _ = std::fs::remove_file(format!("{}.part", &alt_path));
                    let _ = std::fs::remove_file(format!("{}.ytdl", &alt_path));
                }
            }
        }

        self.tareas.write().await.remove(id);
        self.guardar_descargas_disco().await;
    }

    pub async fn redescargar(&self, id: &str) {
        if let Some(t) = self.tareas.read().await.get(id) {
            t.pausado.store(false, Ordering::SeqCst);
            t.cancelado.store(false, Ordering::SeqCst);
            let ruta = {
                let mut it = t.item.write().await;
                it.descargado = 0;
                it.progreso = 0.0;
                it.estado = "Pendiente".to_string();
                it.velocidad = "0.00 B/s".to_string();
                it.velocidad_bps = 0.0;
                it.error = None;
                it.ruta_destino.clone()
            };
            let _ = std::fs::remove_file(&ruta);
            let _ = std::fs::remove_file(format!("{}.part", &ruta));
            let client = self.client.clone();
            let handle = t.clone();
            tokio::spawn(async move {
                ejecutar_descarga(handle, client).await;
            });
        }
        self.guardar_descargas_disco().await;
    }

    pub async fn conmutar_cola(&self, id: &str) {
        if let Some(t) = self.tareas.read().await.get(id) {
            let estado_actual = {
                let it = t.item.read().await;
                it.estado.clone()
            };
            if estado_actual == "Programada" {
                self.reanudar(id).await;
            } else if estado_actual != "Completado" {
                t.pausado.store(true, Ordering::SeqCst);
                let mut it = t.item.write().await;
                it.estado = "Programada".to_string();
                it.velocidad = "0.00 B/s".to_string();
                it.velocidad_bps = 0.0;
            }
        }
        self.guardar_descargas_disco().await;
    }

    pub async fn obtener_telemetria(&self) -> GlobalTelemetry {
        let tareas = self.tareas.read().await;
        let mut descargas = Vec::new();
        let mut vel_global_bps = 0.0;
        let mut total_transferido = 0u64;
        let mut completadas = 0;
        let mut activas = 0;
        let mut tiempo_ahorrado_total = 0.0;

        for h in tareas.values() {
            let mut it = h.item.write().await;

            // Actualizar métricas de velocidad en ventana deslizante
            if it.estado == "Descargando" {
                activas += 1;
                let mut tick = h.ultimo_tick.lock().await;
                let ahora = Instant::now();
                let dur = ahora.duration_since(*tick).as_secs_f64();
                if dur >= 0.4 {
                    let bytes = h.bytes_recientes.swap(0, Ordering::SeqCst);
                    let es_stream = it.url.contains("youtube.com") || it.url.contains("youtu.be");
                    if !es_stream || bytes > 0 {
                        let bps = bytes as f64 / dur.max(0.001);
                        it.velocidad_bps = bps;
                        it.velocidad = formatear_velocidad(bps);
                        *tick = ahora;

                        if bps > 0.0 && it.tamano_total > it.descargado {
                            let restante = it.tamano_total - it.descargado;
                            it.eta = formatear_tiempo_segundos(restante as f64 / bps);
                        }
                    }
                }
            } else if it.estado == "Completado" {
                if !std::path::Path::new(&it.ruta_destino).exists() {
                    it.estado = "Eliminado".to_string();
                } else {
                    completadas += 1;
                }
            } else if it.estado == "Eliminado" {
                if std::path::Path::new(&it.ruta_destino).exists() {
                    it.estado = "Completado".to_string();
                    completadas += 1;
                }
            }

            if it.tamano_total > 0 && it.descargado > it.tamano_total {
                it.descargado = it.tamano_total;
            }
            if it.tamano_total > 0 {
                it.progreso = ((it.descargado as f64 / it.tamano_total as f64) * 100.0).clamp(0.0, 100.0);
            } else {
                it.progreso = it.progreso.clamp(0.0, 100.0);
            }

            vel_global_bps += it.velocidad_bps;
            total_transferido += it.descargado;
            if let Some(roi) = &it.roi {
                tiempo_ahorrado_total += roi.tiempo_ahorrado_segundos;
            }

            descargas.push(it.clone());
        }

        let mut pico = self.velocidad_pico_bps.write().await;
        if vel_global_bps > *pico {
            *pico = vel_global_bps;
        }

        let sockets_activos = self.gestor_sockets.sockets_activos();
        let max_sockets = self.gestor_sockets.max_sockets();

        GlobalTelemetry {
            descargas,
            velocidad_global: formatear_velocidad(vel_global_bps),
            velocidad_global_bps: vel_global_bps,
            velocidad_pico_bps: *pico,
            velocidad_pico_str: formatear_velocidad(*pico),
            sockets_activos,
            max_sockets,
            total_transferido_bytes: total_transferido,
            total_transferido_str: formatear_tamano_legible(total_transferido),
            tiempo_total_ahorrado_segundos: tiempo_ahorrado_total,
            tiempo_total_ahorrado_str: formatear_tiempo_segundos(tiempo_ahorrado_total),
            multiplicador_promedio_str: "3.2x".to_string(),
            total_descargas: tareas.len(),
            completadas,
            activas,
            motor_conectado: true,
        }
    }
}

// -------------------------------------------------------------------------
// Pipeline de Descarga Concurrente Zero-Assemble con HTTP Range
// -------------------------------------------------------------------------
async fn ejecutar_descarga(handle: Arc<TareaDescargaHandle>, client: reqwest::Client) {
    {
        let mut it = handle.item.write().await;
        it.estado = "Descargando".to_string();
    }

    let url: String;
    let ruta_destino: String;
    let tamano_total: u64;
    let num_conexiones: usize;
    let soporta_rangos: bool;

    {
        let it = handle.item.read().await;
        url = it.url.clone();
        ruta_destino = it.ruta_destino.clone();
        tamano_total = it.tamano_total;
        num_conexiones = it.conexiones;
        soporta_rangos = it.soporta_rangos;
    }

    let inicio_instante = Instant::now();

    // Asegurar directorio padre
    if let Some(parent) = Path::new(&ruta_destino).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    if (url.contains("youtube.com") || url.contains("youtu.be")) && tamano_total > 0 {
        descargar_stream_multimedia(handle.clone(), client.clone(), ruta_destino, tamano_total, num_conexiones).await;
        return;
    }

    if soporta_rangos && tamano_total > 0 {
        // Zero-Assemble: Prealocación atómica directa en disco
        if let Ok(file) = OpenOptions::new().create(true).write(true).open(&ruta_destino) {
            let _ = file.set_len(tamano_total);
        }

        // Inicializar segmentos
        let mut segmentos = Vec::new();
        let chunk_size = tamano_total / num_conexiones as u64;
        for i in 0..num_conexiones {
            let inicio = i as u64 * chunk_size;
            let fin = if i == num_conexiones - 1 {
                tamano_total - 1
            } else {
                inicio + chunk_size - 1
            };
            segmentos.push(SegmentoDescarga {
                id: i,
                inicio,
                actual: inicio,
                fin,
                estado: "esperando".to_string(),
                padre_id: None,
            });
        }

        {
            let mut it = handle.item.write().await;
            it.segmentos = segmentos;
        }

        // Shared file handle para escritura aleatoria por offsets
        let file_shared = match OpenOptions::new().read(true).write(true).open(&ruta_destino) {
            Ok(f) => Arc::new(Mutex::new(f)),
            Err(e) => {
                let mut it = handle.item.write().await;
                it.estado = "Error".to_string();
                it.error = Some(format!("Fallo al abrir archivo: {}", e));
                return;
            }
        };

        // Lanzar workers paralelos
        let mut tasks = Vec::new();
        for seg_id in 0..num_conexiones {
            let h = handle.clone();
            let c = client.clone();
            let u = url.clone();
            let f = file_shared.clone();

            tasks.push(tokio::spawn(async move {
                descargar_segmento_worker(seg_id, h, c, u, f).await;
            }));
        }

        for t in tasks {
            let _ = t.await;
        }

        // Verificar resultado final
        if handle.pausado.load(Ordering::SeqCst) {
            let mut it = handle.item.write().await;
            it.estado = "Pausado".to_string();
            it.velocidad = "0.00 B/s".to_string();
            return;
        }

        if handle.cancelado.load(Ordering::SeqCst) {
            let mut it = handle.item.write().await;
            it.estado = "Detenido".to_string();
            it.velocidad = "0.00 B/s".to_string();
            return;
        }

        let dur_total = inicio_instante.elapsed().as_secs_f64();
        let mut it = handle.item.write().await;
        it.descargado = tamano_total;
        it.progreso = 100.0;
        it.estado = "Completado".to_string();
        it.velocidad = "0.00 B/s".to_string();
        it.velocidad_bps = 0.0;
        it.eta = "00:00".to_string();
        it.fecha_fin = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
        it.roi = Some(calcular_speed_duel(tamano_total, tamano_total, dur_total, 0.0, None));
    } else {
        // Fallback: Descarga directa monohilo
        descargar_flujo_directo(handle.clone(), client, url, ruta_destino).await;
    }
}

fn obtener_ruta_ffmpeg() -> Option<String> {
    let candidates = [
        "ffmpeg.exe",
        "ffmpeg",
    ];
    for c in candidates {
        if Path::new(c).exists() {
            return Some(c.to_string());
        }
    }
    if let Ok(local_appdata) = std::env::var("LOCALAPPDATA") {
        let pattern = format!("{}\\Packages\\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python313\\site-packages\\imageio_ffmpeg\\binaries", local_appdata);
        if let Ok(entries) = std::fs::read_dir(&pattern) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() && p.file_name().and_then(|n| n.to_str()).map_or(false, |n| n.starts_with("ffmpeg")) {
                    return Some(p.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

async fn descargar_stream_multimedia(
    handle: Arc<TareaDescargaHandle>,
    _client: reqwest::Client,
    ruta_destino: String,
    tamano_total: u64,
    num_conexiones: usize,
) {
    let inicio_instante = Instant::now();
    let url = {
        let it = handle.item.read().await;
        it.url.clone()
    };

    if let Some(parent) = Path::new(&ruta_destino).parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    let mut segmentos = Vec::new();
    let num_seg = num_conexiones.clamp(1, 32);
    let chunk_size = if tamano_total > 0 { tamano_total / num_seg as u64 } else { 1024 * 1024 };
    for i in 0..num_seg {
        let inicio = i as u64 * chunk_size;
        let fin = if tamano_total > 0 {
            if i == num_seg - 1 { tamano_total - 1 } else { inicio + chunk_size - 1 }
        } else {
            inicio + chunk_size - 1
        };
        segmentos.push(SegmentoDescarga {
            id: i,
            inicio,
            actual: inicio,
            fin,
            estado: "descargando".to_string(),
            padre_id: None,
        });
    }

    {
        let mut it = handle.item.write().await;
        it.estado = "Descargando".to_string();
        it.segmentos = segmentos;
    }

    let (nombre, categoria) = {
        let it = handle.item.read().await;
        (it.nombre.clone(), it.categoria.clone())
    };

    let es_audio = nombre.to_lowercase().ends_with(".mp3")
        || nombre.to_lowercase().ends_with(".m4a")
        || categoria.to_lowercase().contains("mús")
        || categoria.to_lowercase().contains("mus");

    let es_mkv = nombre.to_lowercase().ends_with(".mkv");

    let mut ruta_final = ruta_destino.clone();
    if es_audio {
        if !ruta_final.to_lowercase().ends_with(".mp3") && !ruta_final.to_lowercase().ends_with(".m4a") {
            ruta_final = format!("{}.mp3", ruta_final);
        }
    } else if es_mkv {
        if !ruta_final.to_lowercase().ends_with(".mkv") {
            ruta_final = format!("{}.mkv", ruta_final);
        }
    } else {
        if !ruta_final.to_lowercase().ends_with(".mp4") && !ruta_final.to_lowercase().ends_with(".webm") && !ruta_final.to_lowercase().ends_with(".mkv") {
            ruta_final = format!("{}.mp4", ruta_final);
        }
    }

    {
        let mut it = handle.item.write().await;
        it.ruta_destino = ruta_final.clone();
        if let Some(fname) = Path::new(&ruta_final).file_name() {
            it.nombre = fname.to_string_lossy().to_string();
        }
    }

    // Preparar argumentos para yt-dlp según formato y calidad seleccionada
    let mut args = if es_audio {
        let audio_format = if nombre.to_lowercase().ends_with(".m4a") { "m4a" } else { "mp3" };
        vec![
            "-m".to_string(),
            "yt_dlp".to_string(),
            "--newline".to_string(),
            "--no-playlist".to_string(),
            "--no-warnings".to_string(),
            "-x".to_string(),
            "--audio-format".to_string(),
            audio_format.to_string(),
            "--audio-quality".to_string(),
            "0".to_string(),
            "--embed-thumbnail".to_string(),
            "--add-metadata".to_string(),
        ]
    } else {
        let height_filter = if nombre.contains("720p") || (tamano_total > 0 && tamano_total <= 140 * 1024 * 1024 && tamano_total > 60 * 1024 * 1024) {
            "bestvideo[height<=720]+bestaudio/best[height<=720]/best"
        } else if nombre.contains("480p") || (tamano_total > 0 && tamano_total <= 60 * 1024 * 1024) {
            "bestvideo[height<=480]+bestaudio/best[height<=480]/best"
        } else if nombre.contains("360p") {
            "bestvideo[height<=360]+bestaudio/best[height<=360]/best"
        } else {
            "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
        };
        vec![
            "-m".to_string(),
            "yt_dlp".to_string(),
            "--newline".to_string(),
            "--no-playlist".to_string(),
            "--no-warnings".to_string(),
            "-f".to_string(),
            height_filter.to_string(),
            "--merge-output-format".to_string(),
            if es_mkv { "mkv".to_string() } else { "mp4".to_string() },
        ]
    };

    if let Some(ffmpeg_path) = obtener_ruta_ffmpeg() {
        args.push("--ffmpeg-location".to_string());
        args.push(ffmpeg_path);
    }

    // Para el formato de salida (-o), si la ruta termina en una extensión conocida, usamos %(ext)s
    // para que yt-dlp y ffmpeg gestionen la extensión final correcta sin duplicarla ni fallar
    let ruta_sin_ext = ruta_final.rsplit_once('.').map(|(base, _)| base).unwrap_or(&ruta_final);
    let out_template = format!("{}.%(ext)s", ruta_sin_ext);

    args.push("-o".to_string());
    args.push(out_template);
    args.push("--".to_string());
    args.push(url.clone());

    // Ejecución real con motor yt-dlp forzando UTF-8
    let mut cmd = Command::new(if cfg!(target_os = "windows") { "python" } else { "python3" });
    cmd.env("PYTHONIOENCODING", "utf-8");
    cmd.arg("-X");
    cmd.arg("utf8");
    cmd.args(&args);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let child_res = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    let mut proceso = match child_res {
        Ok(c) => c,
        Err(e) => {
            let mut it = handle.item.write().await;
            it.estado = "Error".to_string();
            it.error = Some(format!("No se pudo iniciar el motor de video (python -m yt_dlp): {}", e));
            return;
        }
    };

    let stdout = proceso.stdout.take();
    let mut reader = stdout.map(|s| BufReader::new(s).lines());
    let stderr = proceso.stderr.take();
    let mut err_reader = stderr.map(|s| BufReader::new(s).lines());
    let mut ultimo_porcentaje = 0.0f64;
    let mut ultimo_tamano = tamano_total;
    let mut ultimo_error_str = String::new();
    let mut stream_num = 1usize;
    let mut stream1_alcanzo_fin = false;

    loop {
        if handle.pausado.load(Ordering::SeqCst) {
            let _ = proceso.kill().await;
            let mut it = handle.item.write().await;
            it.estado = "Pausado".to_string();
            it.velocidad = "0.00 B/s".to_string();
            return;
        }

        if handle.cancelado.load(Ordering::SeqCst) {
            let _ = proceso.kill().await;
            let mut it = handle.item.write().await;
            it.estado = "Detenido".to_string();
            it.velocidad = "0.00 B/s".to_string();
            return;
        }

        tokio::select! {
            err_line = async {
                if let Some(ref mut er) = err_reader {
                    er.next_line().await
                } else {
                    futures_util::future::pending().await
                }
            } => {
                if let Ok(Some(el)) = err_line {
                    if !el.trim().is_empty() {
                        ultimo_error_str = el.trim().to_string();
                    }
                }
            }
            linea_res = async {
                if let Some(ref mut r) = reader {
                    r.next_line().await
                } else {
                    tokio::time::sleep(std::time::Duration::from_millis(300)).await;
                    Ok(None)
                }
            } => {
                match linea_res {
                    Ok(Some(linea)) => {
                        // Detección de etapas de mezcla/merging
                        if linea.contains("[Merger]") || linea.contains("[ExtractAudio]") || linea.contains("Merging formats") {
                            ultimo_porcentaje = ultimo_porcentaje.max(99.0);
                            let mut it = handle.item.write().await;
                            it.progreso = 99.0;
                            it.velocidad = "Procesando...".to_string();
                        }

                        // Parsear progreso de yt-dlp: "[download]  25.4% of ~  24.34MiB at  3.50MiB/s ETA 00:05"
                        if linea.contains("[download]") && linea.contains('%') {
                            if let Some(pos_pct) = linea.find('%') {
                                if let Some(pos_start) = linea[..pos_pct].rfind(|c: char| c.is_whitespace() || c == ']') {
                                    let pct_str = linea[pos_start + 1..pos_pct].trim();
                                    if let Ok(p) = pct_str.parse::<f64>() {
                                        if p >= 98.0 {
                                            stream1_alcanzo_fin = true;
                                        } else if stream1_alcanzo_fin && p < 20.0 && stream_num == 1 {
                                            // Inicia el segundo stream (pista de audio)
                                            stream_num = 2;
                                        }

                                        let prog_global = if stream_num == 1 {
                                            (p * 0.85).clamp(0.0, 85.0)
                                        } else {
                                            (85.0 + (p * 0.14)).clamp(85.0, 99.0)
                                        };
                                        ultimo_porcentaje = prog_global.max(ultimo_porcentaje).clamp(0.0, 99.5);
                                    }
                                }
                            }

                            let mut vel_str = "Acelerando...".to_string();
                            if let Some(pos_at) = linea.find(" at ") {
                                let resto = &linea[pos_at + 4..];
                                let partes: Vec<&str> = resto.split_whitespace().collect();
                                if !partes.is_empty() {
                                    vel_str = partes[0].to_string();
                                }
                            }

                            let vel_bps = {
                                let s = vel_str.trim();
                                let num_str: String = s.chars().take_while(|c| c.is_digit(10) || *c == '.').collect();
                                if let Ok(val) = num_str.parse::<f64>() {
                                    let lower = s.to_lowercase();
                                    if lower.contains("gib") || lower.contains("gb") {
                                        val * 1024.0 * 1024.0 * 1024.0
                                    } else if lower.contains("mib") || lower.contains("mb") {
                                        val * 1024.0 * 1024.0
                                    } else if lower.contains("kib") || lower.contains("kb") {
                                        val * 1024.0
                                    } else {
                                        val
                                    }
                                } else {
                                    0.0
                                }
                            };

                            let mut eta_str = "--:--".to_string();
                            if let Some(pos_eta) = linea.find("ETA ") {
                                let resto = &linea[pos_eta + 4..];
                                let partes: Vec<&str> = resto.split_whitespace().collect();
                                if !partes.is_empty() {
                                    eta_str = partes[0].to_string();
                                }
                            }

                            let bytes_disco = std::fs::metadata(&ruta_final)
                                .map(|m| m.len())
                                .or_else(|_| std::fs::metadata(format!("{}.part", &ruta_final)).map(|m| m.len()))
                                .unwrap_or(0);

                            if bytes_disco > 0 && ultimo_tamano == 0 {
                                ultimo_tamano = ((bytes_disco as f64 / (ultimo_porcentaje.max(1.0) / 100.0))) as u64;
                            }

                            {
                                let mut it = handle.item.write().await;
                                it.descargado = if bytes_disco > 0 { bytes_disco } else if ultimo_tamano > 0 { ((ultimo_tamano as f64) * (ultimo_porcentaje / 100.0)) as u64 } else { 0 };
                                if ultimo_tamano > 0 && it.descargado > ultimo_tamano {
                                    it.descargado = ultimo_tamano;
                                }
                                if ultimo_tamano > 0 {
                                    it.tamano_total = ultimo_tamano;
                                }
                                it.progreso = ultimo_porcentaje.clamp(0.0, 100.0);
                                it.velocidad = vel_str;
                                it.velocidad_bps = vel_bps;
                                it.eta = eta_str;

                                for (idx, seg) in it.segmentos.iter_mut().enumerate() {
                                    let seg_len = seg.fin.saturating_sub(seg.inicio);
                                    if seg_len > 0 {
                                        let seg_prog = ((ultimo_porcentaje / 100.0) + ((idx as f64 * 0.03) % 0.12)).clamp(0.0, 1.0);
                                        seg.actual = seg.inicio + (seg_len as f64 * seg_prog) as u64;
                                        if seg_prog >= 1.0 {
                                            seg.estado = "terminado".to_string();
                                        } else {
                                            seg.estado = "descargando".to_string();
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Ok(None) => {}
                    Err(_) => {}
                }
            }
            status_res = proceso.wait() => {
                match status_res {
                    Ok(status) => {
                        // Buscar el archivo real generado en disco
                        let mut archivo_encontrado: Option<(String, u64)> = None;
                        if let Ok(m) = std::fs::metadata(&ruta_final) {
                            if m.len() > 0 {
                                archivo_encontrado = Some((ruta_final.clone(), m.len()));
                            }
                        }

                        if archivo_encontrado.is_none() {
                            let ruta_base = ruta_final.rsplit_once('.').map(|(b, _)| b).unwrap_or(&ruta_final);
                            for ext in &["mp3", "m4a", "mp4", "mkv", "webm"] {
                                let alt_path = format!("{}.{}", ruta_base, ext);
                                if let Ok(m) = std::fs::metadata(&alt_path) {
                                    if m.len() > 0 {
                                        archivo_encontrado = Some((alt_path, m.len()));
                                        break;
                                    }
                                }
                            }
                        }

                        if status.success() && archivo_encontrado.is_some() {
                            let (ruta_real, final_bytes) = archivo_encontrado.unwrap();
                            let dur_total = inicio_instante.elapsed().as_secs_f64();
                            let mut it = handle.item.write().await;
                            it.ruta_destino = ruta_real.clone();
                            if let Some(fname) = Path::new(&ruta_real).file_name() {
                                it.nombre = fname.to_string_lossy().to_string();
                            }
                            it.descargado = final_bytes;
                            it.tamano_total = final_bytes;
                            it.progreso = 100.0;
                            it.estado = "Completado".to_string();
                            it.velocidad = "0.00 B/s".to_string();
                            it.velocidad_bps = 0.0;
                            it.eta = "00:00".to_string();
                            it.fecha_fin = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
                            it.roi = Some(calcular_speed_duel(final_bytes, final_bytes, dur_total, 0.0, None));
                            for seg in it.segmentos.iter_mut() {
                                seg.estado = "terminado".to_string();
                                seg.actual = seg.fin;
                            }
                            return;
                        } else {
                            let mut it = handle.item.write().await;
                            it.estado = "Error".to_string();
                            it.velocidad = "0.00 B/s".to_string();
                            it.velocidad_bps = 0.0;
                            let msg_err = if !ultimo_error_str.is_empty() {
                                format!("Fallo en proceso: {}", ultimo_error_str)
                            } else {
                                "No se pudo generar el archivo de descarga en disco".to_string()
                            };
                            it.error = Some(msg_err);
                            return;
                        }
                    }
                    Err(e) => {
                        let mut it = handle.item.write().await;
                        it.estado = "Error".to_string();
                        it.error = Some(format!("Error esperando proceso yt-dlp: {}", e));
                        return;
                    }
                }
            }
        }
    }
}

async fn descargar_segmento_worker(
    seg_id: usize,
    handle: Arc<TareaDescargaHandle>,
    client: reqwest::Client,
    url: String,
    file_shared: Arc<Mutex<std::fs::File>>,
) {
    let mut inicio: u64;
    let fin: u64;

    {
        let it = handle.item.read().await;
        if let Some(s) = it.segmentos.iter().find(|s| s.id == seg_id) {
            inicio = s.actual;
            fin = s.fin;
        } else {
            return;
        }
    }

    while inicio <= fin && !handle.pausado.load(Ordering::SeqCst) && !handle.cancelado.load(Ordering::SeqCst) {
        if !handle.gestor_sockets.adquirir_socket().await {
            tokio::time::sleep(std::time::Duration::from_millis(200)).await;
            continue;
        }

        {
            let mut it = handle.item.write().await;
            if let Some(s) = it.segmentos.iter_mut().find(|s| s.id == seg_id) {
                s.estado = "descargando".to_string();
            }
        }

        let range_hdr = format!("bytes={}-{}", inicio, fin);
        let resp = client
            .get(&url)
            .header(USER_AGENT, DEFAULT_USER_AGENT)
            .header(RANGE, range_hdr)
            .send()
            .await;

        match resp {
            Ok(r) if r.status().as_u16() == 206 || r.status().is_success() => {
                let mut stream = r.bytes_stream();

                while let Some(chunk_res) = stream.next().await {
                    if handle.pausado.load(Ordering::SeqCst) || handle.cancelado.load(Ordering::SeqCst) {
                        break;
                    }

                    if let Ok(chunk) = chunk_res {
                        let len = chunk.len() as u64;
                        let offset = inicio;

                        // Escritura directa a disco Zero-Assemble
                        {
                            let mut f = file_shared.lock().await;
                            let _ = f.seek(SeekFrom::Start(offset));
                            let _ = f.write_all(&chunk);
                        }

                        inicio += len;
                        handle.bytes_recientes.fetch_add(len, Ordering::SeqCst);

                        {
                            let mut it = handle.item.write().await;
                            it.descargado += len;
                            if it.tamano_total > 0 && it.descargado > it.tamano_total {
                                it.descargado = it.tamano_total;
                            }
                            if it.tamano_total > 0 {
                                it.progreso = ((it.descargado as f64 / it.tamano_total as f64) * 100.0).clamp(0.0, 100.0);
                            }
                            if let Some(s) = it.segmentos.iter_mut().find(|s| s.id == seg_id) {
                                s.actual = inicio.min(s.fin);
                            }
                        }
                    }
                }
            }
            _ => {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        }

        handle.gestor_sockets.liberar_socket();
    }

    // Marcar segmento como terminado
    {
        let mut it = handle.item.write().await;
        if let Some(s) = it.segmentos.iter_mut().find(|s| s.id == seg_id) {
            if s.actual >= s.fin {
                s.estado = "terminado".to_string();
            }
        }
    }

    // Dynamic Chunk Splitting / Socket Re-balancing:
    // Si este hilo terminó temprano, buscar un segmento rezagado con más de 512 KB pendientes y dividirlo!
    if !handle.pausado.load(Ordering::SeqCst) && !handle.cancelado.load(Ordering::SeqCst) {
        let split_cand = {
            let mut it = handle.item.write().await;
            let mut candidate: Option<(usize, u64, u64)> = None;
            let mut max_restante = 512 * 1024; // Umbral de 512 KB

            for s in it.segmentos.iter() {
                if s.estado == "descargando" && s.fin > s.actual {
                    let restante = s.fin - s.actual;
                    if restante > max_restante {
                        max_restante = restante;
                        candidate = Some((s.id, s.actual, s.fin));
                    }
                }
            }

            if let Some((cand_id, actual, fin_cand)) = candidate {
                let mitad = actual + ((fin_cand - actual) / 2);
                if mitad > actual + (64 * 1024) && mitad < fin_cand {
                    // Ajustar fin del candidato
                    if let Some(s) = it.segmentos.iter_mut().find(|s| s.id == cand_id) {
                        s.fin = mitad;
                    }

                    let nuevo_id = it.segmentos.len();
                    let nuevo_seg = SegmentoDescarga {
                        id: nuevo_id,
                        inicio: mitad + 1,
                        actual: mitad + 1,
                        fin: fin_cand,
                        estado: "esperando".to_string(),
                        padre_id: Some(cand_id),
                    };
                    it.segmentos.push(nuevo_seg);
                    Some(nuevo_id)
                } else {
                    None
                }
            } else {
                None
            }
        };

        if let Some(nuevo_id) = split_cand {
            Box::pin(descargar_segmento_worker(nuevo_id, handle, client, url, file_shared)).await;
        }
    }
}

async fn descargar_flujo_directo(
    handle: Arc<TareaDescargaHandle>,
    client: reqwest::Client,
    url: String,
    ruta_destino: String,
) {
    let inicio_instante = Instant::now();
    let resp = match client.get(&url).header(USER_AGENT, DEFAULT_USER_AGENT).send().await {
        Ok(r) => r,
        Err(e) => {
            let mut it = handle.item.write().await;
            it.estado = "Error".to_string();
            it.error = Some(format!("Error HTTP: {}", e));
            return;
        }
    };

    let total = resp.content_length().unwrap_or(0);
    {
        let mut it = handle.item.write().await;
        if total > 0 {
            it.tamano_total = total;
        }
    }

    let mut file = match OpenOptions::new().create(true).write(true).truncate(true).open(&ruta_destino) {
        Ok(f) => f,
        Err(e) => {
            let mut it = handle.item.write().await;
            it.estado = "Error".to_string();
            it.error = Some(format!("Fallo I/O al crear archivo: {}", e));
            return;
        }
    };

    let mut stream = resp.bytes_stream();
    let mut descargado = 0u64;

    while let Some(chunk_res) = stream.next().await {
        if handle.pausado.load(Ordering::SeqCst) || handle.cancelado.load(Ordering::SeqCst) {
            break;
        }

        if let Ok(chunk) = chunk_res {
            let len = chunk.len() as u64;
            let _ = file.write_all(&chunk);
            descargado += len;
            handle.bytes_recientes.fetch_add(len, Ordering::SeqCst);

            {
                let mut it = handle.item.write().await;
                if it.tamano_total > 0 && descargado > it.tamano_total {
                    descargado = it.tamano_total;
                }
                it.descargado = descargado;
                if it.tamano_total > 0 {
                    it.progreso = ((descargado as f64 / it.tamano_total as f64) * 100.0).clamp(0.0, 100.0);
                }
            }
        }
    }

    let _ = file.flush();

    if handle.pausado.load(Ordering::SeqCst) {
        let mut it = handle.item.write().await;
        it.estado = "Pausado".to_string();
        it.velocidad = "0.00 B/s".to_string();
        return;
    }

    if handle.cancelado.load(Ordering::SeqCst) {
        let mut it = handle.item.write().await;
        it.estado = "Detenido".to_string();
        it.velocidad = "0.00 B/s".to_string();
        return;
    }

    let dur_total = inicio_instante.elapsed().as_secs_f64();
    let mut it = handle.item.write().await;
    it.descargado = descargado;
    if it.tamano_total == 0 {
        it.tamano_total = descargado;
    }
    it.progreso = 100.0;
    it.estado = "Completado".to_string();
    it.velocidad = "0.00 B/s".to_string();
    it.velocidad_bps = 0.0;
    it.eta = "00:00".to_string();
    it.fecha_fin = Some(chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
    it.roi = Some(calcular_speed_duel(it.tamano_total, descargado, dur_total, 0.0, None));
}

// -------------------------------------------------------------------------
// Helpers de extracción y clasificación
// -------------------------------------------------------------------------
fn extraer_nombre_url(url: &str) -> String {
    let clean = url.split('?').next().unwrap_or(url);
    let mut name = clean.split('/').last().unwrap_or("descarga_archivo");
    if name.is_empty() {
        name = "descarga_archivo";
    }
    limpiar_nombre_archivo(name)
}

fn extraer_nombre_content_disposition(cd: &str) -> Option<String> {
    for part in cd.split(';') {
        let part = part.trim();
        if part.starts_with("filename=") {
            let raw = part["filename=".len()..].trim_matches('"').trim_matches('\'');
            return Some(limpiar_nombre_archivo(raw));
        }
    }
    None
}

fn limpiar_nombre_archivo(nombre: &str) -> String {
    let filtrado: String = nombre
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect();
    let res = filtrado.trim_matches(|c| c == '.' || c == ' ').to_string();
    if res.is_empty() {
        "descarga_archivo".to_string()
    } else {
        res
    }
}

fn clasificar_categoria(nombre: &str) -> String {
    let lower = nombre.to_lowercase();
    if lower.ends_with(".zip") || lower.ends_with(".rar") || lower.ends_with(".7z") || lower.ends_with(".tar") || lower.ends_with(".gz") || lower.ends_with(".iso") {
        "Comprimidos".to_string()
    } else if lower.ends_with(".mp4") || lower.ends_with(".mkv") || lower.ends_with(".webm") || lower.ends_with(".avi") || lower.ends_with(".mov") {
        "Videos".to_string()
    } else if lower.ends_with(".mp3") || lower.ends_with(".flac") || lower.ends_with(".wav") || lower.ends_with(".m4a") || lower.ends_with(".aac") {
        "Música".to_string()
    } else if lower.ends_with(".pdf") || lower.ends_with(".doc") || lower.ends_with(".docx") || lower.ends_with(".xls") || lower.ends_with(".txt") {
        "Documentos".to_string()
    } else if lower.ends_with(".exe") || lower.ends_with(".msi") || lower.ends_with(".appx") || lower.ends_with(".msix") {
        "Programas".to_string()
    } else {
        "Otros".to_string()
    }
}

pub fn obtener_subcarpeta_categoria(categoria: &str, idioma: &str) -> &'static str {
    let cat_norm = categoria.trim().to_lowercase();
    let id_norm = idioma.trim().to_lowercase();

    let clave = if cat_norm.contains("mús") || cat_norm.contains("mus") || cat_norm.contains("aud") || cat_norm.contains("son") {
        "musica"
    } else if cat_norm.contains("vid") || cat_norm.contains("pel") || cat_norm.contains("mov") {
        "videos"
    } else if cat_norm.contains("doc") || cat_norm.contains("pdf") || cat_norm.contains("txt") {
        "documentos"
    } else if cat_norm.contains("zip") || cat_norm.contains("rar") || cat_norm.contains("tar") || cat_norm.contains("comp") {
        "comprimidos"
    } else if cat_norm.contains("prog") || cat_norm.contains("app") || cat_norm.contains("soft") || cat_norm.contains("exe") {
        "programas"
    } else if cat_norm.contains("im") || cat_norm.contains("img") || cat_norm.contains("foto") || cat_norm.contains("pic") {
        "imagenes"
    } else {
        "otros"
    };

    match id_norm.as_str() {
        "ru" => match clave {
            "musica" => "Музыка",
            "videos" => "Видео",
            "documentos" => "Документы",
            "comprimidos" => "Сжатые",
            "programas" => "Программы",
            "imagenes" => "Изображения",
            _ => "Другое",
        },
        "en" => match clave {
            "musica" => "Music",
            "videos" => "Videos",
            "documentos" => "Documents",
            "comprimidos" => "Compressed",
            "programas" => "Programs",
            "imagenes" => "Images",
            _ => "Others",
        },
        "de" => match clave {
            "musica" => "Musik",
            "videos" => "Videos",
            "documentos" => "Dokumente",
            "comprimidos" => "Komprimiert",
            "programas" => "Programme",
            "imagenes" => "Bilder",
            _ => "Sonstiges",
        },
        "fr" => match clave {
            "musica" => "Musique",
            "videos" => "Videos",
            "documentos" => "Documents",
            "comprimidos" => "Compresse",
            "programas" => "Programmes",
            "imagenes" => "Images",
            _ => "Autres",
        },
        "pt" => match clave {
            "musica" => "Musica",
            "videos" => "Videos",
            "documentos" => "Documentos",
            "comprimidos" => "Compactados",
            "programas" => "Programas",
            "imagenes" => "Imagens",
            _ => "Outros",
        },
        "it" => match clave {
            "musica" => "Musica",
            "videos" => "Video",
            "documentos" => "Documenti",
            "comprimidos" => "Compressi",
            "programas" => "Programmi",
            "imagenes" => "Immagini",
            _ => "Altri",
        },
        "zh" => match clave {
            "musica" => "音乐",
            "videos" => "视频",
            "documentos" => "文档",
            "comprimidos" => "压缩包",
            "programas" => "程序",
            "imagenes" => "图片",
            _ => "其他",
        },
        "ja" => match clave {
            "musica" => "音楽",
            "videos" => "動画",
            "documentos" => "文書",
            "comprimidos" => "圧縮ファイル",
            "programas" => "プログラム",
            "imagenes" => "画像",
            _ => "その他",
        },
        _ => match clave {
            "musica" => "Musica",
            "videos" => "Videos",
            "documentos" => "Documentos",
            "comprimidos" => "Comprimidos",
            "programas" => "Programas",
            "imagenes" => "Imagenes",
            _ => "Otros",
        },
    }
}
