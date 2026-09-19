import { Injectable } from '@angular/core';
import { BehaviorSubject, interval, Subscription, Subject } from 'rxjs';
import { 
  DescargaItem, 
  GlobalTelemetry, 
  DownloadStatus, 
  DownloadCategory, 
  UserSettings, 
  ProbeResult,
  RoiMetrics,
  PlaylistProbeResult,
  ItemLoteDescarga
} from '../models/download.model';
import { TauriService } from './tauri.service';
import { AudioService } from './audio.service';
import { I18nService } from './i18n.service';

export interface ToastMessage {
  id: string;
  tipo: 'success' | 'error' | 'info' | 'warning';
  titulo: string;
  mensaje: string;
  tiempo: number;
  ruta_destino?: string;
  accion?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadService {
  private descargas$ = new BehaviorSubject<DescargaItem[]>([]);
  public descargasObservable = this.descargas$.asObservable();

  private telemetry$ = new BehaviorSubject<GlobalTelemetry>({
    descargas: [],
    velocidad_global: '0.00 B/s',
    velocidad_global_bps: 0,
    velocidad_pico_bps: 0,
    velocidad_pico_str: '0.00 B/s',
    sockets_activos: 0,
    max_sockets: 32,
    total_transferido_bytes: 0,
    total_transferido_str: '0 B',
    tiempo_total_ahorrado_segundos: 0,
    tiempo_total_ahorrado_str: '0 s',
    multiplicador_promedio_str: '1.0x',
    total_descargas: 0,
    completadas: 0,
    activas: 0,
    motor_conectado: true
  });
  public telemetryObservable = this.telemetry$.asObservable();

  private speedBuffer$ = new BehaviorSubject<number[]>(Array(60).fill(0));
  public speedBufferObservable = this.speedBuffer$.asObservable();

  private toast$ = new BehaviorSubject<ToastMessage[]>([]);
  public toastObservable = this.toast$.asObservable();

  private activeView$ = new BehaviorSubject<'descargas' | 'dashboard' | 'ajustes'>('dashboard');
  public activeViewObservable = this.activeView$.asObservable();

  private activeFilter$ = new BehaviorSubject<string>('Todas');
  public activeFilterObservable = this.activeFilter$.asObservable();

  private searchTerm$ = new BehaviorSubject<string>('');
  public searchTermObservable = this.searchTerm$.asObservable();

  private selectedIds$ = new BehaviorSubject<Set<string>>(new Set());
  public selectedIdsObservable = this.selectedIds$.asObservable();

  private deleteConfirm$ = new Subject<number>();
  public deleteConfirmObservable = this.deleteConfirm$.asObservable();

  private exitConfirm$ = new Subject<void>();
  public exitConfirmObservable = this.exitConfirm$.asObservable();

  private tourRequested$ = new Subject<void>();
  public tourRequestedObservable = this.tourRequested$.asObservable();

  private trayPanelSubject = new Subject<boolean>();
  public trayPanelObservable = this.trayPanelSubject.asObservable();

  public triggerTrayPanel(open: boolean = true): void {
    this.trayPanelSubject.next(open);
  }

  public getCurrentDownloads(): DescargaItem[] {
    return this.descargas$.value;
  }

  public requestTour(): void {
    this.tourRequested$.next();
  }

  public solicitarConfirmacionEliminar(): void {
    const count = this.selectedIds$.value.size;
    if (count > 0) {
      this.deleteConfirm$.next(count);
    }
  }

  public solicitarConfirmacionSalir(): void {
    this.exitConfirm$.next();
  }

  public settings$ = new BehaviorSubject<UserSettings>({
    conexiones_por_archivo: 16,
    limite_velocidad_kb: 0,
    reintentos_conexion: 3,
    socket_timeout_segundos: 30,
    directorio_descargas: 'C:\\Descargas',
    auto_categorizar: true,
    abrir_carpeta_al_completar: false,
    max_descargas_simultaneas: 5,
    tema: 'dark',
    idioma: 'es',
    animaciones_fluidas: true,
    dock_osciloscopio_activo: true,
    vel_referencia_mb: 2.5,
    toast_notificaciones: true,
    sonidos_activos: true,
    iniciar_con_windows: false
  });
  public settingsObservable = this.settings$.asObservable();

  public getCurrentSettings(): UserSettings {
    return this.settings$.value;
  }

  public async pausarDescarga(id: string): Promise<void> {
    await this.pausar([id]);
  }

  public async reanudarDescarga(id: string): Promise<void> {
    await this.reanudar([id]);
  }

  public async pausarTodas(): Promise<void> {
    const activas = this.descargas$.value.filter(d => d.estado === 'Descargando');
    const ids = activas.map(d => d.id);
    if (ids.length > 0) {
      await this.pausar(ids);
    }
  }

  public async reanudarTodas(): Promise<void> {
    const pausadas = this.descargas$.value.filter(d => d.estado === 'Pausado');
    const ids = pausadas.map(d => d.id);
    if (ids.length > 0) {
      await this.reanudar(ids);
    }
  }

  private pollingSub: Subscription | null = null;
  private peakSpeedBps: number = 0;
  private completedNotifiedIds = new Set<string>();
  private isFirstTelemetryPoll = true;

  constructor(
    private tauri: TauriService,
    private audio: AudioService,
    private i18n: I18nService
  ) {
    this.iniciarPolling();
    this.cargarAjustes();
  }

  public setView(view: 'descargas' | 'dashboard' | 'ajustes'): void {
    this.activeView$.next(view);
    this.audio.playClick();
  }

  public setFilter(filter: string): void {
    this.activeFilter$.next(filter);
    this.audio.playClick();
  }

  public setSearch(query: string): void {
    this.searchTerm$.next(query);
  }

  public toggleSelect(id: string): void {
    const current = new Set(this.selectedIds$.value);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds$.next(current);
  }

  public toggleSelectAll(select: boolean, ids: string[]): void {
    const current = new Set(this.selectedIds$.value);
    if (select) {
      ids.forEach(id => current.add(id));
    } else {
      ids.forEach(id => current.delete(id));
    }
    this.selectedIds$.next(current);
  }

  public clearSelection(): void {
    this.selectedIds$.next(new Set());
  }

  public setSelectedIds(ids: Set<string>): void {
    this.selectedIds$.next(ids);
  }

  // Polling de telemetría y actualización periódica (500ms)
  private iniciarPolling(): void {
    this.pollingSub = interval(500).subscribe(() => {
      this.actualizarTelemetria();
    });
  }

  public async actualizarTelemetria(): Promise<void> {
    try {
      const data = await this.tauri.invoke<GlobalTelemetry>('obtener_telemetria');
      if (data && Array.isArray(data.descargas)) {
        this.procesarTelemetria(data);
      }
    } catch {
      // Si el motor aún está iniciando o estamos en browser mock
    }
  }

  private procesarTelemetria(data: GlobalTelemetry): void {
    // Monitoreo de picos de velocidad
    if (data.velocidad_global_bps > this.peakSpeedBps) {
      this.peakSpeedBps = data.velocidad_global_bps;
    }
    data.velocidad_pico_bps = this.peakSpeedBps;
    data.velocidad_pico_str = this.formatBps(this.peakSpeedBps);

    // Buffer de 60 segundos de velocidad para el osciloscopio
    const buf = [...this.speedBuffer$.value];
    buf.shift();
    buf.push(data.velocidad_global_bps);
    this.speedBuffer$.next(buf);

    // Detección de descargas completadas para disparar Victory Toast y Sonido
    if (this.isFirstTelemetryPoll) {
      data.descargas.forEach(d => {
        if (d.estado === 'Completado') {
          this.completedNotifiedIds.add(d.id);
        }
      });
      this.isFirstTelemetryPoll = false;
    } else {
      data.descargas.forEach(d => {
        if (d.tamano_total > 0 && d.descargado > d.tamano_total) {
          d.descargado = d.tamano_total;
        }
        d.progreso = Math.min(100, Math.max(0, d.progreso || 0));
        if (d.estado === 'Completado' && !this.completedNotifiedIds.has(d.id)) {
          this.completedNotifiedIds.add(d.id);
          this.audio.playComplete();
          this.showToast('success', '⚡ Descarga Completada', `${d.nombre} (${d.roi?.tiempo_ahorrado_str || 'Ahorro ROI activado'})`, d.ruta_destino);
        }
      });
    }

    this.descargas$.next(data.descargas);
    this.telemetry$.next(data);

    // Actualizar Widget en barra de tareas de Windows y bandeja del sistema
    this.actualizarWidgetBarraTareas(data);
  }

  private actualizarWidgetBarraTareas(data: GlobalTelemetry): void {
    const activas = data.descargas.filter(d => d.estado === 'Descargando');
    const pausadas = data.descargas.filter(d => d.estado === 'Pausado');
    const errores = data.descargas.filter(d => d.estado === 'Error');

    if (activas.length > 0) {
      let totalBytes = 0;
      let descargadoBytes = 0;
      activas.forEach(d => {
        totalBytes += d.tamano_total || 0;
        descargadoBytes += d.descargado || 0;
      });

      let pct = 0;
      if (totalBytes > 0) {
        pct = Math.min(100, Math.round((descargadoBytes / totalBytes) * 100));
      } else {
        const sumPct = activas.reduce((acc, curr) => acc + (curr.progreso || 0), 0);
        pct = Math.round(sumPct / activas.length);
      }

      const tooltip = `Andromeda: ${pct}% • ${data.velocidad_global} (${activas.length} activa${activas.length > 1 ? 's' : ''})`;
      this.tauri.actualizarWidgetBarraTareas(pct, data.velocidad_global, 'descargando', tooltip);
    } else if (pausadas.length > 0) {
      const sumPct = pausadas.reduce((acc, curr) => acc + (curr.progreso || 0), 0);
      const pct = Math.round(sumPct / pausadas.length);
      const tooltip = `Andromeda: Pausado (${pausadas.length} descarga${pausadas.length > 1 ? 's' : ''})`;
      this.tauri.actualizarWidgetBarraTareas(pct, '0 B/s', 'pausado', tooltip);
    } else if (errores.length > 0) {
      const tooltip = `Andromeda: ${errores.length} error${errores.length > 1 ? 'es' : ''} en descarga`;
      this.tauri.actualizarWidgetBarraTareas(100, '0 B/s', 'error', tooltip);
    } else {
      this.tauri.actualizarWidgetBarraTareas(0, '0 B/s', 'ninguno', 'Andromeda Download Suite - En espera');
    }
  }

  // Acciones de Descarga
  public async iniciarNuevaDescarga(params: {
    url: string;
    nombre?: string;
    ruta_destino?: string;
    conexiones?: number;
    categoria?: DownloadCategory;
    programada?: boolean;
    fecha_programada?: string;
    alta_demanda?: boolean;
    tamano_forzado?: number;
  }): Promise<string> {
    this.audio.playClick();
    const id = await this.tauri.invoke<string>('iniciar_descarga', {
      url: params.url,
      nombre: params.nombre || '',
      rutaDestino: params.ruta_destino || '',
      conexiones: params.conexiones || 16,
      categoria: params.categoria || 'Otros',
      programada: !!params.programada,
      fechaProgramada: params.fecha_programada || '',
      altaDemanda: !!params.alta_demanda,
      tamanoForzado: params.tamano_forzado || null
    });
    this.showToast('info', 'Descarga Encolada', params.nombre || params.url);
    await this.actualizarTelemetria();
    return id;
  }

  public async pausar(ids?: string[]): Promise<void> {
    this.audio.playClick();
    const targetIds = ids || Array.from(this.selectedIds$.value);
    for (const id of targetIds) {
      await this.tauri.invoke('pausar_descarga', { id });
    }
    await this.actualizarTelemetria();
  }

  public async reanudar(ids?: string[]): Promise<void> {
    this.audio.playClick();
    const targetIds = ids || Array.from(this.selectedIds$.value);
    for (const id of targetIds) {
      await this.tauri.invoke('reanudar_descarga', { id });
    }
    await this.actualizarTelemetria();
  }

  public async detener(ids?: string[]): Promise<void> {
    this.audio.playClick();
    const targetIds = ids || Array.from(this.selectedIds$.value);
    for (const id of targetIds) {
      await this.tauri.invoke('detener_descarga', { id });
    }
    await this.actualizarTelemetria();
  }

  public async eliminar(ids?: string[], borrarArchivo: boolean = false): Promise<void> {
    this.audio.playClick();
    const targetIds = ids || Array.from(this.selectedIds$.value);
    for (const id of targetIds) {
      await this.tauri.invoke('eliminar_descarga', { id, borrar_archivo: borrarArchivo, borrarArchivo });
    }
    this.clearSelection();
    await this.actualizarTelemetria();
  }

  public async sondearUrl(url: string): Promise<ProbeResult> {
    return await this.tauri.invoke<ProbeResult>('sondear_url', { url });
  }

  public async abrirCarpeta(ruta: string): Promise<void> {
    this.audio.playClick();
    await this.tauri.invoke('abrir_carpeta', { ruta });
  }

  public async abrirArchivo(ruta: string): Promise<void> {
    this.audio.playClick();
    await this.tauri.invoke('abrir_archivo', { ruta });
  }

  public resolverTemaEfectivo(tema: string): 'dark' | 'black' | 'white' | 'contrast' {
    const t = (tema || 'dark').toLowerCase();
    if (t === 'contrast' || t === 'high-contrast' || t === 'alto-contraste') return 'contrast';
    if (t === 'oled' || t === 'black') return 'black';
    if (t === 'white' || t === 'light') return 'white';
    if (t === 'system' || t === 'auto') {
      return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'white';
    }
    return 'dark';
  }

  public async cargarAjustes(): Promise<void> {
    try {
      // 1. Restaurar primero de localStorage para carga visual instantánea
      try {
        const local = localStorage.getItem('andromeda_settings');
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed && typeof parsed === 'object') {
            this.settings$.next({ ...this.settings$.value, ...parsed });
            const temaEf = this.resolverTemaEfectivo(parsed.tema);
            document.documentElement.setAttribute('data-theme', temaEf);
            localStorage.setItem('andromeda_theme', temaEf);
          }
        }
      } catch {}

      // 2. Obtener ajustes oficiales persistidos en disco por el motor Rust
      const cfg = await this.tauri.invoke<UserSettings>('obtener_ajustes');
      if (cfg) {
        this.settings$.next(cfg);
        const temaEf = this.resolverTemaEfectivo(cfg.tema);
        try {
          localStorage.setItem('andromeda_settings', JSON.stringify(cfg));
          localStorage.setItem('andromeda_theme', temaEf);
        } catch {}
        this.audio.setEnabled(cfg.sonidos_activos);
        this.i18n.setLanguage(cfg.idioma);
        this.actualizarAnimaciones(cfg.animaciones_fluidas);
        document.documentElement.setAttribute('data-theme', temaEf);
      }
    } catch {
      // Fallback
    }

    // Listener para conmutar dinámicamente si el usuario tiene activado 'system'
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        const currentCfg = this.settings$.value.tema;
        if (currentCfg === 'system' || currentCfg === 'auto') {
          const target = e.matches ? 'dark' : 'white';
          document.documentElement.setAttribute('data-theme', target);
          try { localStorage.setItem('andromeda_theme', target); } catch {}
        }
      });
    }
  }

  public async guardarAjustes(nuevosAjustes: UserSettings): Promise<void> {
    this.audio.playClick();

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const targetTheme = this.resolverTemaEfectivo(nuevosAjustes.tema);

    if (currentTheme !== targetTheme) {
      this.triggerThemeWash(targetTheme, () => {
        document.documentElement.setAttribute('data-theme', targetTheme);
      });
    } else {
      document.documentElement.setAttribute('data-theme', targetTheme);
    }

    try {
      localStorage.setItem('andromeda_settings', JSON.stringify(nuevosAjustes));
      localStorage.setItem('andromeda_theme', targetTheme);
    } catch {}

    await this.tauri.invoke('guardar_ajustes', { ajustes: nuevosAjustes });
    this.settings$.next(nuevosAjustes);
    this.audio.setEnabled(nuevosAjustes.sonidos_activos);
    this.i18n.setLanguage(nuevosAjustes.idioma);
    this.actualizarAnimaciones(nuevosAjustes.animaciones_fluidas);
    this.showToast('success', this.i18n.t('toast_pref_guardadas'), this.i18n.t('toast_pref_desc'));
  }

  public actualizarAnimaciones(activas: boolean): void {
    if (!activas) {
      document.body.classList.add('reduce-motion');
    } else {
      document.body.classList.remove('reduce-motion');
    }
  }

  // Modal Nueva Descarga Trigger
  public pendingNuevaDescargaUrl: string = '';
  public pendingNuevaDescargaNombre: string = '';
  private newModalSubject = new Subject<boolean>();
  public newModalObservable = this.newModalSubject.asObservable();

  public triggerNuevaDescargaModal(open: boolean = true, url: string = '', nombre: string = ''): void {
    this.pendingNuevaDescargaUrl = url;
    this.pendingNuevaDescargaNombre = nombre;
    this.newModalSubject.next(open);
  }

  // Global File Explorer State
  public isGlobalExploradorOpen: boolean = false;
  public globalExploradorInitialPath: string = '';
  private globalExploradorResolve: ((path: string | null) => void) | null = null;

  public abrirExploradorModal(initialPath: string = ''): Promise<string | null> {
    this.globalExploradorInitialPath = initialPath || 'C:\\Descargas';
    this.isGlobalExploradorOpen = true;
    return new Promise<string | null>((resolve) => {
      this.globalExploradorResolve = resolve;
    });
  }

  public onGlobalExploradorSelected(path: string): void {
    this.isGlobalExploradorOpen = false;
    if (this.globalExploradorResolve) {
      this.globalExploradorResolve(path);
      this.globalExploradorResolve = null;
    }
  }

  public closeGlobalExplorador(): void {
    this.isGlobalExploradorOpen = false;
    if (this.globalExploradorResolve) {
      this.globalExploradorResolve(null);
      this.globalExploradorResolve = null;
    }
  }

  public triggerThemeWash(tema: string, onHalfway?: () => void): void {
    const iris = document.getElementById('theme-iris-transition');

    if (iris) {
      let bgColor = '#0B1220';
      if (tema === 'light') {
        bgColor = '#F8FAFC';
      } else if (tema === 'black' || tema === 'contrast') {
        bgColor = '#000000';
      } else {
        bgColor = '#0A1128';
      }

      document.documentElement.style.setProperty('--theme-wash-bg', bgColor);
      iris.style.display = 'block';
      iris.classList.remove('active');
      void iris.offsetWidth;
      iris.classList.add('active');

      // A los 480ms (punto en que royalWipeOut cubre totalmente la pantalla), aplicamos el nuevo tema
      if (onHalfway) {
        setTimeout(() => onHalfway(), 480);
      }

      setTimeout(() => {
        iris.classList.remove('active');
        iris.style.display = 'none';
      }, 980);
    } else if (onHalfway) {
      onHalfway();
    }
  }

  // Toasts
  public showToast(tipo: 'success' | 'error' | 'info' | 'warning', titulo: string, mensaje: string, ruta_destino?: string): void {
    const nuevo: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      tipo,
      titulo,
      mensaje,
      tiempo: Date.now(),
      ruta_destino
    };
    const lista = [...this.toast$.value, nuevo];
    this.toast$.next(lista);

    setTimeout(() => {
      this.removerToast(nuevo.id);
    }, 5500);
  }

  public removerToast(id: string): void {
    const filtrada = this.toast$.value.filter(t => t.id !== id);
    this.toast$.next(filtrada);
  }

  public mostrarToast(titulo: string, mensaje: string, tipo: 'info' | 'success' | 'error' = 'info'): void {
    this.showToast(tipo, titulo, mensaje);
  }

  public showToastWithAction(tipo: 'success' | 'error' | 'info' | 'warning', titulo: string, mensaje: string, accion: () => void): void {
    const nuevo: ToastMessage = {
      id: Math.random().toString(36).substring(2, 9),
      tipo,
      titulo,
      mensaje,
      tiempo: Date.now(),
      accion
    };
    const lista = [...this.toast$.value, nuevo];
    this.toast$.next(lista);

    setTimeout(() => {
      this.removerToast(nuevo.id);
    }, 7000);
  }

  // Helpers de formato
  public formatBytes(bytes: number): string {
    if (bytes == null || isNaN(bytes) || bytes <= 0) return '0 B';
    const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
    let idx = 0;
    let val = bytes;
    while (val >= 1024.0 && idx < unidades.length - 1) {
      val /= 1024.0;
      idx++;
    }
    return `${val.toFixed(2)} ${unidades[idx]}`;
  }

  public formatBps(bytesPorSeg: number): string {
    return `${this.formatBytes(bytesPorSeg)}/s`;
  }

  // --- Gestor de Lotes y Listas de Reproducción ---
  public isLoteModalOpen: boolean = false;
  public activePlaylistData: PlaylistProbeResult | null = null;
  public loteEnCola: ItemLoteDescarga[] = [];

  public triggerLoteModal(open: boolean, playlistData?: PlaylistProbeResult): void {
    this.isLoteModalOpen = open;
    if (playlistData) {
      this.activePlaylistData = playlistData;
    }
  }

  public async sondearPlaylist(url: string): Promise<PlaylistProbeResult> {
    try {
      return await this.tauri.invoke<PlaylistProbeResult>('sondear_playlist', { url });
    } catch (e) {
      return {
        ok: false,
        id_playlist: '',
        titulo: '',
        canal: '',
        total_items: 0,
        items: [],
        error: String(e)
      };
    }
  }

  public async iniciarDescargasLote(items: ItemLoteDescarga[], encolar: boolean = true): Promise<number> {
    try {
      const creadas = await this.tauri.invoke<number>('iniciar_descargas_lote', { items, encolar });
      if (encolar) {
        this.mostrarToast('Cola de descargas actualizada', `Se agregaron ${creadas} descargas a la cola.`);
      } else {
        this.mostrarToast('Descargas masivas iniciadas', `Se iniciaron ${creadas} descargas.`);
      }
      await this.actualizarTelemetria();
      return creadas;
    } catch (e) {
      this.mostrarToast('Error en descargas', `No se pudo iniciar el lote: ${e}`);
      return 0;
    }
  }

  public async redescargar(id: string): Promise<void> {
    this.audio.playClick();
    try {
      await this.tauri.invoke('redescargar_tarea', { id });
      this.mostrarToast('Descarga Reiniciada', 'Se reinició la descarga desde cero.');
      await this.actualizarTelemetria();
    } catch (e) {
      console.error('Error al redescargar:', e);
    }
  }

  public async conmutarCola(id: string): Promise<void> {
    this.audio.playClick();
    try {
      await this.tauri.invoke('conmutar_cola_tarea', { id });
      await this.actualizarTelemetria();
    } catch (e) {
      console.error('Error al conmutar cola:', e);
    }
  }

  public selectAll(): void {
    const all = new Set(this.descargas$.value.map(d => d.id));
    this.setSelectedIds(all);
  }

  public async limpiarCompletadas(): Promise<void> {
    const completadas = this.descargas$.value.filter(d => d.estado === 'Completado').map(d => d.id);
    if (completadas.length > 0) {
      await this.eliminar(completadas, false);
      this.mostrarToast('Historial Limpio', `Se eliminaron ${completadas.length} descargas completadas.`);
    }
  }

  public async cerrarTrayFlyout(): Promise<void> {
    try {
      await this.tauri.invoke('cerrar_tray_flyout');
    } catch {}
  }

  public async gestionarSistemaTray(accion: string): Promise<void> {
    try {
      await this.tauri.invoke('gestionar_sistema_tray', { accion });
    } catch {}
  }
}
