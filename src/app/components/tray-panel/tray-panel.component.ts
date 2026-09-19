import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { DownloadService } from '../../services/download.service';
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

  public getTiempoLimpio(str: string | undefined | null): string {
    if (!str) return '0 s';
    return str.replace(/\s*ahorrados?/gi, '').trim();
  }

  constructor(private downloadService: DownloadService) {
    this.telemetry$ = this.downloadService.telemetryObservable;
  }

  ngOnInit(): void {
    this.sub = this.downloadService.descargasObservable.subscribe(items => {
      this.descargasActivas = items.filter(d => d.estado === 'Descargando' || d.estado === 'Pausado');
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
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
