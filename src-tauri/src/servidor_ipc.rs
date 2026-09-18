use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use serde::Deserialize;
use tauri::{AppHandle, Manager, Emitter};
use crate::motor_descarga::GestorDescargas;

#[derive(Deserialize, Debug)]
#[allow(dead_code)]
struct PeticionDescargaIPC {
    url: String,
    #[serde(default)]
    nombre: Option<String>,
    #[serde(default)]
    referer: Option<String>,
    #[serde(default)]
    origen: Option<String>,
    #[serde(default)]
    abrir_modal: Option<bool>,
}

pub async fn iniciar_servidor_ipc(app_handle: AppHandle, gestor: Arc<GestorDescargas>, puerto: u16) {
    let addr = format!("127.0.0.1:{}", puerto);
    let mut intentos = 0;
    let listener = loop {
        match TcpListener::bind(&addr).await {
            Ok(l) => {
                log::info!("[IPC] Servidor IPC HTTP iniciado exitosamente en {}", addr);
                break l;
            }
            Err(e) => {
                intentos += 1;
                if intentos >= 10 {
                    log::warn!("[IPC] No se pudo enlazar servidor IPC en {} tras 10 intentos: {}", addr, e);
                    return;
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            }
        }
    };

    loop {
        let (mut socket, _) = match listener.accept().await {
            Ok(s) => s,
            Err(_) => continue,
        };

        let gestor_clon = gestor.clone();
        let app_clon = app_handle.clone();
        tokio::spawn(async move {
            let mut buf = Vec::new();
            let mut temp = [0u8; 4096];
            loop {
                let _bytes = match socket.read(&mut temp).await {
                    Ok(0) => break,
                    Ok(b) => {
                        buf.extend_from_slice(&temp[..b]);
                        b
                    }
                    Err(_) => break,
                };

                let req_str = String::from_utf8_lossy(&buf);
                if let Some(pos) = req_str.find("\r\n\r\n") {
                    let headers = &req_str[..pos];
                    let mut cl: usize = 0;
                    for l in headers.lines() {
                        if l.to_ascii_lowercase().starts_with("content-length:") {
                            if let Ok(num) = l["content-length:".len()..].trim().parse::<usize>() {
                                cl = num;
                            }
                        }
                    }
                    let body_len = buf.len() - (pos + 4);
                    if body_len >= cl {
                        break;
                    }
                } else if req_str.contains("\n\n") {
                    break;
                }
                if buf.len() > 65536 {
                    break;
                }
            }

            if buf.is_empty() {
                return;
            }

            let req_str = String::from_utf8_lossy(&buf);
            let mut lines = req_str.lines();
            let req_line = lines.next().unwrap_or("");
            let parts: Vec<&str> = req_line.split_whitespace().collect();

            if parts.is_empty() {
                return;
            }

            let method = parts[0];
            let path = parts.get(1).copied().unwrap_or("/");

            // Manejo de CORS Preflight
            if method == "OPTIONS" {
                let respuesta = "HTTP/1.1 204 No Content\r\n\
                    Access-Control-Allow-Origin: *\r\n\
                    Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n\
                    Access-Control-Allow-Headers: Content-Type, Authorization\r\n\
                    Access-Control-Max-Age: 86400\r\n\
                    Content-Length: 0\r\n\r\n";
                let _ = socket.write_all(respuesta.as_bytes()).await;
                return;
            }

            // Endpoint GET /ping (Estado de telemetría y descargas para el popup)
            if method == "GET" && (path == "/ping" || path.starts_with("/ping?")) {
                let telemetria = gestor_clon.obtener_telemetria().await;
                let json = serde_json::to_string(&telemetria).unwrap_or_else(|_| "{}".to_string());

                let respuesta = format!(
                    "HTTP/1.1 200 OK\r\n\
                    Content-Type: application/json; charset=utf-8\r\n\
                    Access-Control-Allow-Origin: *\r\n\
                    Connection: close\r\n\
                    Content-Length: {}\r\n\r\n{}",
                    json.len(),
                    json
                );
                let _ = socket.write_all(respuesta.as_bytes()).await;
                return;
            }

            // Endpoint GET o POST /abrir (Restaura y enfoca la ventana principal para Single-Instance)
            if path == "/abrir" || path.starts_with("/abrir?") {
                if let Some(window) = app_clon.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
                let respuesta = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\nContent-Length: 2\r\n\r\nOK";
                let _ = socket.write_all(respuesta.as_bytes()).await;
                return;
            }

            // Endpoint POST /descargar o /abrir_modal (Enviado por extensión o navegador)
            if method == "POST" && (path == "/descargar" || path == "/abrir_modal" || path.starts_with("/descargar?") || path.starts_with("/abrir_modal?")) {
                let body = if let Some(pos) = req_str.find("\r\n\r\n") {
                    &req_str[pos + 4..]
                } else if let Some(pos) = req_str.find("\n\n") {
                    &req_str[pos + 2..]
                } else {
                    ""
                };

                let mut desc_id = String::new();
                let mut ok = false;

                log::info!("[IPC] Petición POST {} recibida. Payload: {}", path, body);

                if let Ok(datos) = serde_json::from_str::<PeticionDescargaIPC>(body) {
                    if !datos.url.trim().is_empty() {
                        let abrir_modal = datos.abrir_modal.unwrap_or(true);
                        if abrir_modal {
                            log::info!("[IPC] Abriendo formulario de nueva descarga en Andromeda: {} ({:?})", datos.url, datos.nombre);
                            if let Some(window) = app_clon.get_webview_window("main") { let is_visible = window.is_visible().unwrap_or(false); let _ = window.show(); let _ = window.unminimize(); let _ = window.set_focus(); if !is_visible { let _ = window.emit("abrir_nueva_descarga_standalone", serde_json::json!({ "url": datos.url, "nombre": datos.nombre.unwrap_or_default() })); } else { let _ = window.emit("abrir_nueva_descarga", serde_json::json!({ "url": datos.url, "nombre": datos.nombre.unwrap_or_default() })); } }
                            ok = true;
                        } else {
                            log::info!("[IPC] Procesando descarga directa URL: {} (Nombre: {:?})", datos.url, datos.nombre);
                            let id = gestor_clon
                                .agregar_e_iniciar(
                                    datos.url,
                                    datos.nombre,
                                    None,
                                    None,
                                    None,
                                    false,
                                    None,
                                    false,
                                    None,
                                )
                                .await;
                            desc_id = id;
                            ok = true;
                        }
                    }
                } else {
                    log::warn!("[IPC] Error al deserializar payload JSON de {}: {}", path, body);
                }

                let resp_json = serde_json::json!({
                    "ok": ok,
                    "id": desc_id
                }).to_string();

                let respuesta = format!(
                    "HTTP/1.1 200 OK\r\n\
                    Content-Type: application/json; charset=utf-8\r\n\
                    Access-Control-Allow-Origin: *\r\n\
                    Connection: close\r\n\
                    Content-Length: {}\r\n\r\n{}",
                    resp_json.len(),
                    resp_json
                );
                let _ = socket.write_all(respuesta.as_bytes()).await;
                return;
            }

            // Fallback 404
            let respuesta = "HTTP/1.1 404 Not Found\r\n\
                Access-Control-Allow-Origin: *\r\n\
                Content-Length: 0\r\n\r\n";
            let _ = socket.write_all(respuesta.as_bytes()).await;
        });
    }
}
