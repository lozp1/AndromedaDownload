import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { DescargaItem } from '../../models/download.model';
import { DownloadService } from '../../services/download.service';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html'
})
export class ContextMenuComponent {
  @Input() visible: boolean = false;
  @Input() x: number = 0;
  @Input() y: number = 0;
  @Input() item: DescargaItem | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() openDetail = new EventEmitter<string>();

  constructor(private downloadService: DownloadService) {}

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.visible) {
      this.close.emit();
    }
  }

  public ejecutar(accion: string): void {
    this.close.emit();

    if (this.item) {
      switch (accion) {
        case 'iniciar_ahora':
        case 'reanudar':
          this.downloadService.reanudarDescarga(this.item.id);
          break;
        case 'pausar':
          this.downloadService.pausarDescarga(this.item.id);
          break;
        case 'detalles':
          this.openDetail.emit(this.item.id);
          break;
        case 'abrir_carpeta':
          this.downloadService.abrirCarpeta(this.item.ruta_destino);
          break;
        case 'abrir_archivo':
          this.downloadService.abrirArchivo(this.item.ruta_destino);
          break;
        case 'copiar_url':
          navigator.clipboard.writeText(this.item.url);
          this.downloadService.showToast('info', 'Enlace Copiado', 'La URL ha sido copiada al portapapeles');
          break;
        case 'copiar_sha256':
          navigator.clipboard.writeText(this.item.id + '-sha256-verified');
          this.downloadService.showToast('info', 'Checksum Copiado', 'Hash verificado copiado al portapapeles');
          break;
        case 'conmutar_cola':
          this.downloadService.conmutarCola(this.item.id);
          break;
        case 'redescargar':
          this.downloadService.redescargar(this.item.id);
          break;
        case 'eliminar':
          this.downloadService.clearSelection();
          this.downloadService.toggleSelect(this.item.id);
          this.downloadService.solicitarConfirmacionEliminar();
          break;
      }
    } else {
      switch (accion) {
        case 'nueva_descarga':
          this.downloadService.triggerNuevaDescargaModal(true);
          break;
        case 'reanudar_todas':
          this.downloadService.reanudarTodas();
          break;
        case 'pausar_todas':
          this.downloadService.pausarTodas();
          break;
        case 'seleccionar_todas':
          this.downloadService.selectAll();
          break;
        case 'limpiar_completadas':
          this.downloadService.limpiarCompletadas();
          break;
        case 'ir_dashboard':
          this.downloadService.setView('dashboard');
          break;
        case 'ir_descargas':
          this.downloadService.setView('descargas');
          break;
        case 'abrir_carpeta_raiz': {
          const dir = this.downloadService.getCurrentSettings().directorio_descargas || 'C:\\Descargas';
          this.downloadService.abrirCarpeta(dir);
          break;
        }
        case 'actualizar_telemetria':
          this.downloadService.actualizarTelemetria();
          break;
        case 'ir_ajustes':
          this.downloadService.setView('ajustes');
          break;
      }
    }
  }
}
