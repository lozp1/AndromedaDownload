import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { TauriService } from '../../services/tauri.service';
import { DescargaItem, GlobalTelemetry } from '../../models/download.model';
import { Observable, Subscription } from 'rxjs';

@Component({
  selector: 'app-tray-panel',
  templateUrl: './tray-panel.component.html'
})
export class TrayPanelComponent implements OnInit, OnDestroy {
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  public telemetry$: Observable<GlobalTelemetry>;
  public descargasActivas: DescargaItem[] = [];
  private sub: Subscription | null = null;
  private pollTimer: any = null;

  public getTiempoLimpio(str: string | undefined | null): string {
    if (!str) return '0 s';
    return str.replace(/\s*ahorrados?/gi, '').trim();
  }

  constructor(
    private downloadService: DownloadService,
    private tauriService: TauriService
  ) {
    this.telemetry$ = this.downloadService.telemetryObservable;
  }

  private themeSub: Subscription | null = null;

  ngOnInit(): void {
    // Sincronizar tema dinámico en la ventana del tray
    const aplicarTema = (tema?: string) => {
      if (!tema) {
        tema = localStorage.getItem('andromeda_theme') || 'dark';
      }
      const ef = this.downloadService.resolverTemaEfectivo(tema);
      document.documentElement.setAttribute('data-theme', ef);
    };

    aplicarTema();

    this.themeSub = this.downloadService.settings$.subscribe(cfg => {
      if (cfg && cfg.tema) {
        aplicarTema(cfg.tema);
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key === 'andromeda_theme' && e.newValue) {
        document.documentElement.setAttribute('data-theme', e.newValue);
      }
    });

    // Actualización inmediata de telemetría y descargas
    this.downloadService.actualizarTelemetria();

    // Escuchar evento emitido por Rust cuando se muestra el panel desde la bandeja
    this.tauriService.listen('tray_shown', () => {
      this.downloadService.actualizarTelemetria();
    });

    window.addEventListener('focus', () => {
      this.downloadService.actualizarTelemetria();
    });

    // Polling activo en el flyout mientras esté abierto
    this.pollTimer = setInterval(() => {
      this.downloadService.actualizarTelemetria();
    }, 400);

    this.sub = this.downloadService.descargasObservable.subscribe(items => {
      this.descargasActivas = items.filter(d => {
        const est = (d.estado || '').toLowerCase();
        return est.includes('descarg') || est.includes('progreso') || est.includes('paus') || est.includes('inici') || est.includes('cola') || est.includes('program');
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.themeSub?.unsubscribe();
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  public cerrar(): void {
    this.close.emit();
  }

  public pausar(id: string): void {
    this.downloadService.pausarDescarga(id);
  }

  public reanudar(id: string): void {
    this.downloadService.reanudarDescarga(id);
  }

  public pausarTodo(): void {
    this.downloadService.pausarTodas();
  }

  public reanudarTodo(): void {
    this.downloadService.reanudarTodas();
  }

  public abrirCarpetaDescargas(): void {
    const dir = this.downloadService.getCurrentSettings().directorio_descargas || 'C:\\Descargas';
    this.downloadService.abrirCarpeta(dir);
  }

  public abrirNuevaDescarga(): void {
    this.cerrar();
    this.downloadService.triggerNuevaDescargaModal(true);
    this.downloadService.gestionarSistemaTray('nueva');
  }

  public abrirSuite(): void {
    this.cerrar();
    this.downloadService.gestionarSistemaTray('abrir');
  }

  public mostrarPanel(): void {
    this.cerrar();
    this.downloadService.setView('descargas');
    this.downloadService.gestionarSistemaTray('panel');
  }

  public abrirAjustes(): void {
    this.cerrar();
    this.downloadService.setView('ajustes');
    this.downloadService.gestionarSistemaTray('ajustes');
  }

  public abrirGuia(): void {
    this.cerrar();
    this.downloadService.requestTour();
    this.downloadService.gestionarSistemaTray('guia');
  }

  public abrirAcercaDe(): void {
    this.cerrar();
    this.downloadService.gestionarSistemaTray('acerca_de');
  }

  public salirApp(): void {
    this.downloadService.gestionarSistemaTray('salir');
  }
}
