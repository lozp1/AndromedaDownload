import { Injectable } from '@angular/core';
import { DescargaItem, GlobalTelemetry, ProbeResult, UserSettings } from '../models/download.model';

declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
      };
      window: {
        getCurrentWindow: () => any;
      };
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class TauriService {
  private isTauriApp: boolean = false;

  constructor() {
    this.isTauriApp = typeof window !== 'undefined' && !!window.__TAURI__;
  }

  public get isTauri(): boolean {
    return this.isTauriApp;
  }

  public async invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    if (this.isTauriApp && window.__TAURI__?.core) {
      try {
        return await window.__TAURI__.core.invoke<T>(cmd, args);
      } catch (err) {
        console.error(`[TauriService] Error invoking command '${cmd}':`, err);
        throw err;
      }
    } else {
      console.warn(`[TauriService] Mock execution for '${cmd}' (Browser mode):`, args);
      return this.handleMockCommand<T>(cmd, args);
    }
  }

  public async listen<T>(event: string, handler: (e: { event: string; payload: T }) => void): Promise<(() => void) | void> {
    if (this.isTauriApp) {
      try {
        const tauriEvent = (window as any).__TAURI__?.event;
        if (tauriEvent?.listen) {
          return await tauriEvent.listen(event, handler);
        }
      } catch (err) {
        console.error(`[TauriService] Error listening to '${event}':`, err);
      }
    }
  }

  // Window Controls
  public async startDragging(): Promise<void> {
    if (this.isTauriApp) {
      try {
        const win = window.__TAURI__?.window?.getCurrentWindow();
        if (win?.startDragging) {
          await win.startDragging();
        }
      } catch (e) {
        console.error('Error starting window drag:', e);
      }
    }
  }

  public async minimizeWindow(): Promise<void> {
    if (this.isTauriApp) {
      try {
        const win = window.__TAURI__?.window?.getCurrentWindow();
        if (win?.minimize) {
          await win.minimize();
          return;
        }
      } catch (e) {
        console.error('Error minimizing window:', e);
      }
    }
    await this.invoke('minimizar_ventana');
  }

  public async toggleMaximizeWindow(): Promise<void> {
    if (this.isTauriApp) {
      try {
        const win = window.__TAURI__?.window?.getCurrentWindow();
        if (win?.toggleMaximize) {
          await win.toggleMaximize();
          return;
        }
      } catch (e) {
        console.error('Error toggling maximize:', e);
      }
    }
    await this.invoke('maximizar_ventana');
  }

  public async closeWindow(): Promise<void> {
    if (this.isTauriApp) {
      try {
        const win = window.__TAURI__?.window?.getCurrentWindow();
        if (win?.close) {
          await win.close();
          return;
        }
      } catch (e) {
        console.error('Error closing window:', e);
      }
    }
    await this.invoke('cerrar_ventana');
  }

  public async setSplashMode(): Promise<void> {
    await this.invoke('set_splash_mode');
  }

  public async setMainMode(): Promise<void> {
    await this.invoke('set_main_mode');
  }

  public async seleccionarDirectorio(): Promise<string | null> {
    return await this.invoke<string | null>('seleccionar_directorio_dialogo');
  }

  public async obtenerUnidadesDisco(): Promise<string[]> {
    return await this.invoke<string[]>('obtener_unidades_disco');
  }

  public async obtenerRutasSistema(): Promise<{ escritorio: string; descargas: string; documentos: string; videos: string }> {
    return await this.invoke<{ escritorio: string; descargas: string; documentos: string; videos: string }>('obtener_rutas_sistema');
  }

  public async listarDirectorios(ruta?: string): Promise<any[]> {
    return await this.invoke<any[]>('listar_directorios', { ruta });
  }

  public async crearCarpeta(rutaPadre: string, nombre: string): Promise<string> {
    return await this.invoke<string>('crear_carpeta', { rutaPadre, nombre });
  }

  public async actualizarWidgetBarraTareas(
    progreso?: number | null,
    velocidad?: string | null,
    estado?: 'descargando' | 'pausado' | 'error' | 'indeterminado' | 'ninguno' | null,
    tituloTooltip?: string | null
  ): Promise<void> {
    await this.invoke('actualizar_widget_barra_tareas', {
      progreso: progreso !== undefined && progreso !== null ? Math.round(progreso) : null,
      velocidad: velocidad || null,
      estado: estado || null,
      tituloTooltip: tituloTooltip || null
    });
  }

  // Fallback Mock data for browser testing
  private handleMockCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
    switch (cmd) {
      case 'sondear_url': {
        const url = (args?.['url'] as string) || '';
        const name = url.split('/').pop()?.split('?')[0] || 'archivo_descarga.iso';
        const res: ProbeResult = {
          ok: true,
          url,
          nombre: name || 'archivo_descarga.iso',
          tamano: 1048576000,
          tamano_str: '1000.00 MB',
          soporta_rangos: true,
          categoria: 'Comprimidos',
          content_type: 'application/octet-stream'
        };
        return Promise.resolve(res as unknown as T);
      }
      case 'iniciar_descarga': {
        const id = 'task-' + Math.random().toString(36).substring(2, 9);
        return Promise.resolve(id as unknown as T);
      }
      case 'obtener_ajustes': {
        const defaults: UserSettings = {
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
        };
        return Promise.resolve(defaults as unknown as T);
      }
      case 'guardar_ajustes': {
        return Promise.resolve(true as unknown as T);
      }
      case 'abrir_carpeta': {
        return Promise.resolve(true as unknown as T);
      }
      default:
        return Promise.resolve(null as unknown as T);
    }
  }
}
