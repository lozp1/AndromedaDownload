export type DownloadStatus = 
  | 'Pendiente' 
  | 'Descargando' 
  | 'Pausado' 
  | 'Detenido' 
  | 'Completado' 
  | 'Error' 
  | 'Programada';

export type DownloadCategory = 
  | 'Comprimidos' 
  | 'Videos' 
  | 'Música' 
  | 'Documentos' 
  | 'Programas' 
  | 'Imágenes' 
  | 'Otros';

export interface SegmentoDescarga {
  id: number;
  inicio: number;
  actual: number;
  fin: number;
  estado: 'esperando' | 'descargando' | 'terminado' | 'reintentando' | 'error';
  padre_id?: number;
}

export interface RoiMetrics {
  tiempo_ahorrado_segundos: number;
  tiempo_ahorrado_str: string;
  multiplicador_aceleracion: number;
  multiplicador_str: string;
  tiempo_andromeda_segundos: number;
  tiempo_andromeda_str: string;
  tiempo_navegador_segundos: number;
  tiempo_navegador_str: string;
  vel_referencia_bps: number;
  vel_referencia_str: string;
  progreso_nav_porcentaje: number;
  porcentaje_diferencia: number;
}

export interface DescargaItem {
  id: string;
  url: string;
  nombre: string;
  ruta_destino: string;
  tamano_total: number;
  descargado: number;
  progreso: number;
  velocidad: string;
  velocidad_bps: number;
  eta: string;
  estado: DownloadStatus;
  categoria: DownloadCategory;
  conexiones: number;
  alta_demanda?: boolean;
  soporta_rangos?: boolean;
  fecha_creacion: string;
  fecha_fin?: string;
  fecha_programada?: string;
  hashes?: { [key: string]: string };
  error?: string;
  roi?: RoiMetrics;
  segmentos?: SegmentoDescarga[];
  seleccionado?: boolean;
}

export interface GlobalTelemetry {
  descargas: DescargaItem[];
  velocidad_global: string;
  velocidad_global_bps: number;
  velocidad_pico_bps: number;
  velocidad_pico_str: string;
  sockets_activos: number;
  max_sockets: number;
  total_transferido_bytes: number;
  total_transferido_str: string;
  tiempo_total_ahorrado_segundos: number;
  tiempo_total_ahorrado_str: string;
  multiplicador_promedio_str: string;
  total_descargas: number;
  completadas: number;
  activas: number;
  motor_conectado: boolean;
}

export interface ProbeResult {
  ok: boolean;
  url: string;
  nombre?: string;
  tamano?: number;
  tamano_str?: string;
  soporta_rangos: boolean;
  categoria?: DownloadCategory;
  content_type?: string;
  error?: string;
}

export interface UserSettings {
  conexiones_por_archivo: number;
  limite_velocidad_kb: number;
  reintentos_conexion: number;
  socket_timeout_segundos: number;
  directorio_descargas: string;
  auto_categorizar: boolean;
  abrir_carpeta_al_completar: boolean;
  max_descargas_simultaneas: number;
  tema: 'dark' | 'black' | 'light' | 'auto' | 'system' | 'oled' | 'white';
  idioma: 'es' | 'en' | 'pt' | 'qu' | 'myn' | 'fr' | 'de' | 'it' | 'ja' | 'zh';
  animaciones_fluidas: boolean;
  dock_osciloscopio_activo: boolean;
  vel_referencia_mb: number;
  toast_notificaciones: boolean;
  sonidos_activos: boolean;
  iniciar_con_windows: boolean;
}
