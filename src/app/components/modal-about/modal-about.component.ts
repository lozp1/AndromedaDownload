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

  public cardTransform: string = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0)';
  public isHovered: boolean = false;

  constructor(public i18n: I18nService) {}

  public onMouseMove(e: MouseEvent): void {
    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;
    this.cardTransform = `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
  }

  public onMouseEnter(): void {
    this.isHovered = true;
  }

  public onMouseLeave(): void {
    this.isHovered = false;
    this.cardTransform = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0)';
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
