import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.css']
})
export class SplashScreenComponent implements OnInit {
  @Output() completed = new EventEmitter<void>();

  public visible: boolean = true;
  public isFadingOut: boolean = false;
  public progress: number = 0;
  public currentStatus: string = '';

  public cardTransform: string = 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0)';
  public isHovered: boolean = false;

  constructor(public i18n: I18nService) {
    this.currentStatus = this.i18n.t('splash_status_init') || 'Inicializando entorno de alta velocidad...';
  }

  ngOnInit(): void {
    this.runSplashSequence();
  }

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

  private runSplashSequence(): void {
    const steps = [
      { p: 25, msgKey: 'splash_status_fs' },
      { p: 55, msgKey: 'splash_status_sockets' },
      { p: 85, msgKey: 'splash_status_telemetry' },
      { p: 100, msgKey: 'splash_status_ready' }
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        this.progress = steps[currentStep].p;
        this.currentStatus = this.i18n.t(steps[currentStep].msgKey);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          this.isFadingOut = true;
          setTimeout(() => {
            this.visible = false;
            this.completed.emit();
          }, 350);
        }, 300);
      }
    }, 450);
  }
}
