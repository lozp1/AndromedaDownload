mod gestor_sockets;
mod modelos;
mod motor_descarga;
mod roi_telemetria;
mod servidor_ipc;

use std::sync::Arc;
use tauri::{Manager, State, Window, Emitter};

use modelos::{GlobalTelemetry, ProbeResult, UserSettings};
use motor_descarga::GestorDescargas;
use tauri::window::{ProgressBarState, ProgressBarStatus};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};
use tauri::menu::{Menu, MenuItem};

#[tauri::command]
async fn iniciar_descarga(
    url: String,
    nombre: Option<String>,
    ruta_destino: Option<String>,
    conexiones: Option<usize>,
    categoria: Option<String>,
    programada: Option<bool>,
    fecha_programada: Option<String>,
    alta_demanda: Option<bool>,
    tamano_forzado: Option<u64>,
    gestor: State<'_, Arc<GestorDescargas>>,
) -> Result<String, String> {
    let id = gestor
        .agregar_e_iniciar(
            url,
            nombre,
            ruta_destino,
            conexiones,
            categoria,
            programada.unwrap_or(false),
            fecha_programada,
            alta_demanda.unwrap_or(false),
            tamano_forzado,
        )
        .await;
    Ok(id)
}

#[tauri::command]
async fn pausar_descarga(id: String, gestor: State<'_, Arc<GestorDescargas>>) -> Result<(), String> {
    gestor.pausar(&id).await;
    Ok(())
}

#[tauri::command]
async fn reanudar_descarga(id: String, gestor: State<'_, Arc<GestorDescargas>>) -> Result<(), String> {
    gestor.reanudar(&id).await;
    Ok(())
}

#[tauri::command]
async fn detener_descarga(id: String, gestor: State<'_, Arc<GestorDescargas>>) -> Result<(), String> {
    gestor.detener(&id).await;
    Ok(())
}

#[tauri::command]
async fn eliminar_descarga(
    id: String,
    borrar_archivo: Option<bool>,
    gestor: State<'_, Arc<GestorDescargas>>,
) -> Result<(), String> {
    gestor.eliminar(&id, borrar_archivo.unwrap_or(false)).await;
    Ok(())
}

#[tauri::command]
async fn obtener_telemetria(gestor: State<'_, Arc<GestorDescargas>>) -> Result<GlobalTelemetry, String> {
    Ok(gestor.obtener_telemetria().await)
}

#[tauri::command]
async fn sondear_url(url: String, gestor: State<'_, Arc<GestorDescargas>>) -> Result<ProbeResult, String> {
    Ok(gestor.sondear_url(&url).await)
}

#[tauri::command]
async fn obtener_ajustes(gestor: State<'_, Arc<GestorDescargas>>) -> Result<UserSettings, String> {
    Ok(gestor.ajustes.read().await.clone())
}

#[tauri::command]
async fn guardar_ajustes(
    ajustes: UserSettings,
    gestor: State<'_, Arc<GestorDescargas>>,
) -> Result<(), String> {
    motor_descarga::GestorDescargas::guardar_ajustes_disco(&ajustes);
    *gestor.ajustes.write().await = ajustes;
    Ok(())
}

#[tauri::command]
async fn abrir_carpeta(ruta: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::Path;
        use std::os::windows::process::CommandExt;

        let clean_path = ruta.replace('/', "\\");
        let path = Path::new(&clean_path);

        if path.exists() {
            if path.is_file() {
                // Abre el explorador de Windows y resalta exactamente el archivo seleccionado sin fallar en comillas
                let _ = std::process::Command::new("explorer")
                    .raw_arg(format!("/select,\"{}\"", clean_path))
                    .spawn();
            } else {
                let _ = std::process::Command::new("explorer")
                    .raw_arg(format!("\"{}\"", clean_path))
                    .spawn();
            }
        } else {
            let folder = if path.extension().is_some() {
                path.parent().unwrap_or(path)
            } else {
                path
            };
            let _ = std::fs::create_dir_all(folder);
            let folder_str = folder.to_string_lossy().to_string();
            let _ = std::process::Command::new("explorer")
                .raw_arg(format!("\"{}\"", folder_str))
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
async fn abrir_archivo(ruta: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::path::Path;
        let clean_path = ruta.replace('/', "\\");
        let path = Path::new(&clean_path);
        if path.exists() && path.is_file() {
            use std::os::windows::process::CommandExt;
            let _ = std::process::Command::new("cmd")
                .args(["/c", "start", "", &clean_path])
                .creation_flags(0x08000000)
                .spawn();
        }
    }
    Ok(())
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ElementoDirectorio {
    pub nombre: String,
    pub ruta_completa: String,
    pub es_directorio: bool,
    pub tamano_bytes: u64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct RutasSistema {
    pub escritorio: String,
    pub descargas: String,
    pub documentos: String,
    pub videos: String,
}

#[tauri::command]
async fn obtener_rutas_sistema() -> Result<RutasSistema, String> {
    #[cfg(target_os = "windows")]
    {
        let user = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
        Ok(RutasSistema {
            escritorio: format!("{}\\Desktop", user),
            descargas: format!("{}\\Downloads", user),
            documentos: format!("{}\\Documents", user),
            videos: format!("{}\\Videos", user),
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        Ok(RutasSistema {
            escritorio: format!("{}/Desktop", home),
            descargas: format!("{}/Downloads", home),
            documentos: format!("{}/Documents", home),
            videos: format!("{}/Videos", home),
        })
    }
}

#[tauri::command]
async fn obtener_unidades_disco() -> Result<Vec<String>, String> {
    #[cfg(target_os = "windows")]
    {
        let mut unidades = Vec::new();
        for letra in b'C'..=b'Z' {
            let path_str = format!("{}:\\", letra as char);
            if std::path::Path::new(&path_str).exists() {
                unidades.push(path_str);
            }
        }
        if unidades.is_empty() {
            unidades.push("C:\\".to_string());
        }
        Ok(unidades)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Ok(vec!["/".to_string()])
    }
}

#[tauri::command]
async fn listar_directorios(ruta: Option<String>) -> Result<Vec<ElementoDirectorio>, String> {
    use std::path::Path;
    let target = match ruta.filter(|r| !r.trim().is_empty()) {
        Some(r) => r.replace('/', "\\"),
        None => {
            #[cfg(target_os = "windows")]
            {
                std::env::var("USERPROFILE")
                    .map(|u| format!("{}\\Downloads", u))
                    .unwrap_or_else(|_| "C:\\".to_string())
            }
            #[cfg(not(target_os = "windows"))]
            {
                "/".to_string()
            }
        }
    };

    let p = Path::new(&target);
    if !p.exists() || !p.is_dir() {
        return Err(format!("La ruta '{}' no es un directorio accesible", target));
    }

    let mut items = Vec::new();
    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.flatten() {
            let metadata = entry.metadata().ok();
            let es_dir = metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false);
            let nombre = entry.file_name().to_string_lossy().to_string();

            if nombre.starts_with('$') || nombre.starts_with('.') {
                continue;
            }

            let ruta_completa = entry.path().to_string_lossy().to_string();
            let tamano_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

            items.push(ElementoDirectorio {
                nombre,
                ruta_completa,
                es_directorio: es_dir,
                tamano_bytes,
            });
        }
    }

    items.sort_by(|a, b| {
        b.es_directorio.cmp(&a.es_directorio).then(a.nombre.to_lowercase().cmp(&b.nombre.to_lowercase()))
    });

    Ok(items)
}

#[tauri::command]
async fn crear_carpeta(ruta_padre: String, nombre: String) -> Result<String, String> {
    use std::path::Path;
    let clean_parent = ruta_padre.replace('/', "\\");
    let nueva_ruta = Path::new(&clean_parent).join(&nombre);
    std::fs::create_dir_all(&nueva_ruta)
        .map_err(|e| format!("Error creando carpeta: {}", e))?;
    Ok(nueva_ruta.to_string_lossy().to_string())
}

#[tauri::command]
async fn minimizar_ventana(window: Window) -> Result<(), String> {
    let _ = window.minimize();
    Ok(())
}

#[tauri::command]
async fn maximizar_ventana(window: Window) -> Result<(), String> {
    if let Ok(maximized) = window.is_maximized() {
        if maximized {
            let _ = window.unmaximize();
        } else {
            let _ = window.maximize();
        }
    }
    Ok(())
}

#[tauri::command]
async fn cerrar_ventana(window: Window) -> Result<(), String> {
    let _ = window.close();
    Ok(())
}

#[tauri::command]
async fn set_splash_mode(window: Window) -> Result<(), String> {
    let _ = window.set_resizable(false);
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 500.0, height: 300.0 })));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 600.0, height: 380.0 }));
    let _ = window.center();
    let _ = window.show();
    Ok(())
}

#[tauri::command]
async fn set_main_mode(window: Window) -> Result<(), String> {
    let _ = window.set_resizable(true);
    let _ = window.set_min_size(Some(tauri::Size::Logical(tauri::LogicalSize { width: 980.0, height: 660.0 })));
    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize { width: 1220.0, height: 820.0 }));
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
    Ok(())
}

#[tauri::command]
async fn seleccionar_directorio_dialogo() -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(|| {
        let folder = rfd::FileDialog::new()
            .set_title("Seleccionar carpeta de descargas")
            .pick_folder();
        Ok(folder.map(|p| p.to_string_lossy().to_string()))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn actualizar_menu_tray(lbl_abrir: String, lbl_salir: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri::menu::{Menu, MenuItem};
    let open_i = MenuItem::with_id(&app, "open", &lbl_abrir, true, None::<&str>).map_err(|e| e.to_string())?;
    let quit_i = MenuItem::with_id(&app, "quit", &lbl_salir, true, None::<&str>).map_err(|e| e.to_string())?;
    let menu = Menu::with_items(&app, &[&open_i, &quit_i]).map_err(|e| e.to_string())?;
    if let Some(tray) = app.tray_by_id("tray_andromeda") {
        let _ = tray.set_menu(Some(menu));
    }
    Ok(())
}
#[tauri::command]
async fn actualizar_widget_barra_tareas(
    app: tauri::AppHandle,
    window: Window,
    progreso: Option<u64>,
    velocidad: Option<String>,
    estado: Option<String>,
    titulo_tooltip: Option<String>,
) -> Result<(), String> {
    let status = match estado.as_deref() {
        Some("descargando") | Some("normal") => Some(ProgressBarStatus::Normal),
        Some("pausado") => Some(ProgressBarStatus::Paused),
        Some("error") => Some(ProgressBarStatus::Error),
        Some("indeterminado") => Some(ProgressBarStatus::Indeterminate),
        Some("ninguno") | Some("none") | None => Some(ProgressBarStatus::None),
        _ => Some(ProgressBarStatus::Normal),
    };

    let state = ProgressBarState {
        progress: progreso,
        status,
    };
    let _ = window.set_progress_bar(state);

    if let Some(tray) = app.tray_by_id("tray_andromeda") {
        let tooltip_text = if let Some(custom) = titulo_tooltip {
            custom
        } else if let Some(v) = velocidad {
            if let Some(p) = progreso {
                format!("Andromeda: {}% • {}", p, v)
            } else {
                format!("Andromeda: {}", v)
            }
        } else {
            "Andromeda Download Suite - En espera".to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip_text));
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let gestor = Arc::new(GestorDescargas::new());
    let gestor_setup = gestor.clone();

    tauri::Builder::default()
        .manage(gestor.clone())
        .plugin(tauri_plugin_log::Builder::default().build())
        .setup(move |app| {
                let app_handle = app.handle().clone();
                let gestor_ipc = gestor_setup.clone();
                tauri::async_runtime::spawn(async move {
                    servidor_ipc::iniciar_servidor_ipc(app_handle, gestor_ipc, 47990).await;
                });

                let gestor_queue = gestor_setup.clone();
                tauri::async_runtime::spawn(async move {
                    gestor_queue.iniciar_queue_runner().await;
                });

                let open_i = MenuItem::with_id(app, "open", "Abrir Andromeda Download Suite", true, None::<&str>)?; let quit_i = MenuItem::with_id(app, "quit", "Salir de Andromeda", true, None::<&str>)?; let menu = Menu::with_items(app, &[&open_i, &quit_i])?;

                let gestor_menu = gestor_setup.clone();
                let mut tray_builder = TrayIconBuilder::with_id("tray_andromeda")
                    .menu(&menu)
                    .tooltip("Andromeda Download Suite - En espera")
                    .show_menu_on_left_click(false)
                    .on_menu_event(move |app, event| {
                        match event.id.as_ref() {
                            "open" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                }
                            }
                            "nueva_descarga" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    let _ = window.emit("abrir_nueva_descarga", serde_json::json!({
                                        "url": "",
                                        "nombre": ""
                                    }));
                                }
                            }
                            "tray_panel" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.emit("toggle_tray_panel", ());
                                }
                            }
                            "pausar_todas" => {
                                let g = gestor_menu.clone();
                                tauri::async_runtime::spawn(async move {
                                    let tareas = g.tareas.read().await;
                                    for t in tareas.values() {
                                        t.pausado.store(true, std::sync::atomic::Ordering::SeqCst);
                                        let mut it = t.item.write().await;
                                        if it.estado == "Descargando" {
                                            it.estado = "Pausado".to_string();
                                            it.velocidad = "0.00 B/s".to_string();
                                            it.velocidad_bps = 0.0;
                                        }
                                    }
                                });
                            }
                            "reanudar_todas" => {
                                let g = gestor_menu.clone();
                                tauri::async_runtime::spawn(async move {
                                    let tareas = g.tareas.read().await;
                                    for (id, _) in tareas.iter() {
                                        g.reanudar(id).await;
                                    }
                                });
                            }
                            "ajustes" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.unminimize();
                                    let _ = window.set_focus();
                                    let _ = window.emit("abrir_ajustes", ());
                                }
                            }
                            "quit" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if let Ok(is_min) = window.is_minimized() {
                                if is_min {
                                    let _ = window.unminimize();
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            iniciar_descarga,
            pausar_descarga,
            reanudar_descarga,
            detener_descarga,
            eliminar_descarga,
            obtener_telemetria,
            sondear_url,
            obtener_ajustes,
            guardar_ajustes,
            abrir_carpeta,
            abrir_archivo, minimizar_ventana, actualizar_menu_tray,
            maximizar_ventana,
            cerrar_ventana,
            set_splash_mode,
            set_main_mode,
            seleccionar_directorio_dialogo,
            obtener_unidades_disco,
            obtener_rutas_sistema,
            listar_directorios,
            crear_carpeta,
            actualizar_widget_barra_tareas
        ])
        .run(tauri::generate_context!())
        .expect("error while running andromeda application");
}
