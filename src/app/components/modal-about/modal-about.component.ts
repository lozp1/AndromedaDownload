import { Component, EventEmitter, Input, Output } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-modal-about',
  templateUrl: './modal-about.component.html'
})
export class ModalAboutComponent {
  @Input() visible: boolean = false;
  @Output() close = new EventEmitter<void>();

  public readonly autor = 'Franco Paolo López Gálvez';
  public readonly correo = 'francopaolo_lg@outlook.com';
  public readonly github = 'https://github.com/lozp1';
  public readonly portafolio = 'https://github.com/lozp1?tab=repositories';
  public readonly webOficial = 'https://github.com/lozp1/AndromedaDownload';
  public readonly suite = 'Andromeda Download Suite';
  public readonly arquitectura = '64-bit Windows Desktop Core (Rust Tauri v2)';
  public readonly version = '1.0.0 versión estable';
  public mostrarDetalles: boolean = false;

  constructor(public i18n: I18nService) {}

  public toggleDetalles(): void {
    this.mostrarDetalles = !this.mostrarDetalles;
  }

  public abrirEnlace(url: string): void {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  public cerrar(): void {
    this.close.emit();
  }
}
