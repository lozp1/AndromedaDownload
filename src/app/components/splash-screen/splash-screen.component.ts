import { Component, OnInit, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-splash-screen',
  templateUrl: './splash-screen.component.html',
  styleUrls: ['./splash-screen.component.css']
})
export class SplashScreenComponent implements OnInit, OnDestroy {
  @Input() isOnDemand: boolean = false;
  @Output() completed = new EventEmitter<void>();

  public visible: boolean = true;
  public isFadingOut: boolean = false;
  public progress: number = 0;
  public currentStatus: string = '';
  private timer: any = null;

  constructor(public i18n: I18nService) {
    this.currentStatus = this.i18n.t('splash_status_init');
  }

  ngOnInit(): void {
    this.runSplashSequence();
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  public cerrar(): void {
    if (this.isFadingOut) return;
    this.isFadingOut = true;
    setTimeout(() => {
      this.visible = false;
      this.completed.emit();
    }, 350);
  }

  public closeOnBackdrop(e: MouseEvent): void {
    if (this.isOnDemand) {
      this.cerrar();
    }
  }

  private runSplashSequence(): void {
    const steps = [
      { p: 25, msgKey: 'splash_status_fs' },
      { p: 55, msgKey: 'splash_status_sockets' },
      { p: 85, msgKey: 'splash_status_telemetry' },
      { p: 100, msgKey: 'splash_status_ready' }
    ];

    let currentStep = 0;
    this.timer = setInterval(() => {
      if (currentStep < steps.length) {
        this.progress = steps[currentStep].p;
        this.currentStatus = this.i18n.t(steps[currentStep].msgKey);
        currentStep++;
      } else {
        clearInterval(this.timer);
        this.timer = null;
        if (!this.isOnDemand) {
          setTimeout(() => {
            this.cerrar();
          }, 300);
        }
      }
    }, 450);
  }
}
