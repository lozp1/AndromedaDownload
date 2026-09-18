import { Component, HostListener, OnInit } from '@angular/core';
import { TauriService } from '../../services/tauri.service';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { GlobalTelemetry } from '../../models/download.model';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit {
  public motorStatus: string = 'Motor: Conectado • Direct I/O';
  public motorActivo: boolean = true;
  public showDiag: boolean = false;
  public telemetry: GlobalTelemetry | null = null;

  constructor(
    public tauri: TauriService,
    public downloadService: DownloadService,
    public i18n: I18nService
  ) {}

  @HostListener('document:click', ['$event'])
  public onDocumentClick(): void {
    if (this.showDiag) {
      this.showDiag = false;
    }
  }

  ngOnInit(): void {
    this.downloadService.telemetryObservable.subscribe(telemetry => {
      this.telemetry = telemetry;
      this.motorActivo = telemetry.motor_conectado;
      this.motorStatus = telemetry.motor_conectado 
        ? `Motor: Conectado • ${telemetry.sockets_activos} Sockets`
        : 'Motor: Desconectado';
    });
  }

  public toggleDiag(event: MouseEvent): void {
    event.stopPropagation();
    this.showDiag = !this.showDiag;
  }

  public onMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.traffic-lights') && !target.closest('button')) {
      this.tauri.startDragging();
    }
  }

  public minimize(): void {
    this.tauri.minimizeWindow();
  }

  public toggleMaximize(): void {
    this.tauri.toggleMaximizeWindow();
  }

  public close(): void {
    this.downloadService.solicitarConfirmacionSalir();
  }

  public openTour(): void {
    this.downloadService.requestTour();
  }

  public toggleTrayPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.downloadService.triggerTrayPanel();
  }
}
