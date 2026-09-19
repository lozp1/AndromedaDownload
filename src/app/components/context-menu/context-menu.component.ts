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
  @Input() targetInput: HTMLInputElement | HTMLTextAreaElement | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() openDetail = new EventEmitter<string>();

  public get tieneSeleccion(): boolean {
    if (!this.targetInput) return false;
    const s = this.targetInput.selectionStart ?? 0;
    const e = this.targetInput.selectionEnd ?? 0;
    return e > s;
  }

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

  public async ejecutarInput(accion: string): Promise<void> {
    const input = this.targetInput;
    this.close.emit();
    if (!input) return;

    input.focus();

    switch (accion) {
      case 'deshacer': {
        document.execCommand('undo');
        break;
      }
      case 'cortar': {
        const s = input.selectionStart ?? 0;
        const e = input.selectionEnd ?? 0;
        if (e > s) {
          const sel = input.value.substring(s, e);
          await navigator.clipboard.writeText(sel);
          input.setRangeText('', s, e, 'end');
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        break;
      }
      case 'copiar': {
        const s = input.selectionStart ?? 0;
        const e = input.selectionEnd ?? 0;
        const sel = e > s ? input.value.substring(s, e) : input.value;
        if (sel) {
          await navigator.clipboard.writeText(sel);
        }
        break;
      }
      case 'pegar': {
        try {
          const texto = await navigator.clipboard.readText();
          if (texto) {
            const s = input.selectionStart ?? input.value.length;
            const e = input.selectionEnd ?? input.value.length;
            input.setRangeText(texto, s, e, 'end');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch (err) {
          document.execCommand('paste');
        }
        break;
      }
      case 'pegar_plano': {
        try {
          let texto = await navigator.clipboard.readText();
          if (texto) {
            texto = texto.replace(/[\r\n\t]+/g, ' ').trim();
            const s = input.selectionStart ?? input.value.length;
            const e = input.selectionEnd ?? input.value.length;
            input.setRangeText(texto, s, e, 'end');
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } catch (err) {
          document.execCommand('paste');
        }
        break;
      }
      case 'seleccionar_todo': {
        input.select();
        break;
      }
    }
  }
}
