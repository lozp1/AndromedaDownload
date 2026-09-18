use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentoDescarga {
    pub id: usize,
    pub inicio: u64,
    pub actual: u64,
    pub fin: u64,
    pub estado: String, // "esperando", "descargando", "terminado", "reintentando", "error"
    pub padre_id: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoiMetrics {
    pub tiempo_ahorrado_segundos: f64,
    pub tiempo_ahorrado_str: String,
    pub multiplicador_aceleracion: f64,
    pub multiplicador_str: String,
    pub tiempo_andromeda_segundos: f64,
    pub tiempo_andromeda_str: String,
    pub tiempo_navegador_segundos: f64,
    pub tiempo_navegador_str: String,
    pub vel_referencia_bps: f64,
    pub vel_referencia_str: String,
    pub progreso_nav_porcentaje: f64,
    pub porcentaje_diferencia: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DescargaItem {
    pub id: String,
    pub url: String,
    pub nombre: String,
    pub ruta_destino: String,
    pub tamano_total: u64,
    pub descargado: u64,
    pub progreso: f64,
    pub velocidad: String,
    pub velocidad_bps: f64,
    pub eta: String,
    pub estado: String, // "Pendiente", "Descargando", "Pausado", "Detenido", "Completado", "Error", "Programada"
    pub categoria: String,
    pub conexiones: usize,
    pub alta_demanda: bool,
    pub soporta_rangos: bool,
    pub fecha_creacion: String,
    pub fecha_fin: Option<String>,
    pub fecha_programada: Option<String>,
    pub hashes: HashMap<String, String>,
    pub error: Option<String>,
    pub roi: Option<RoiMetrics>,
    pub segmentos: Vec<SegmentoDescarga>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalTelemetry {
    pub descargas: Vec<DescargaItem>,
    pub velocidad_global: String,
    pub velocidad_global_bps: f64,
    pub velocidad_pico_bps: f64,
    pub velocidad_pico_str: String,
    pub sockets_activos: usize,
    pub max_sockets: usize,
    pub total_transferido_bytes: u64,
    pub total_transferido_str: String,
    pub tiempo_total_ahorrado_segundos: f64,
    pub tiempo_total_ahorrado_str: String,
    pub multiplicador_promedio_str: String,
    pub total_descargas: usize,
    pub completadas: usize,
    pub activas: usize,
    pub motor_conectado: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProbeResult {
    pub ok: bool,
    pub url: String,
    pub nombre: Option<String>,
    pub tamano: Option<u64>,
    pub tamano_str: Option<String>,
    pub soporta_rangos: bool,
    pub categoria: Option<String>,
    pub content_type: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub conexiones_por_archivo: usize,
    pub limite_velocidad_kb: u64,
    pub reintentos_conexion: usize,
    pub socket_timeout_segundos: u64,
    pub directorio_descargas: String,
    pub auto_categorizar: bool,
    pub abrir_carpeta_al_completar: bool,
    pub max_descargas_simultaneas: usize,
    pub tema: String,
    pub idioma: String,
    pub animaciones_fluidas: bool,
    pub dock_osciloscopio_activo: bool,
    pub vel_referencia_mb: f64,
    pub toast_notificaciones: bool,
    pub sonidos_activos: bool,
    pub iniciar_con_windows: bool,
}

impl Default for UserSettings {
    fn default() -> Self {
        let default_dir = std::env::var("USERPROFILE")
            .map(|u| format!("{}\\Downloads\\Andromeda", u))
            .unwrap_or_else(|_| "C:\\Downloads\\Andromeda".to_string());
        Self {
            conexiones_por_archivo: 16,
            limite_velocidad_kb: 0,
            reintentos_conexion: 3,
            socket_timeout_segundos: 30,
            directorio_descargas: default_dir,
            auto_categorizar: true,
            abrir_carpeta_al_completar: false,
            max_descargas_simultaneas: 5,
            tema: "dark".to_string(),
            idioma: "es".to_string(),
            animaciones_fluidas: true,
            dock_osciloscopio_activo: true,
            vel_referencia_mb: 2.5,
            toast_notificaciones: true,
            sonidos_activos: true,
            iniciar_con_windows: false,
        }
    }
}
