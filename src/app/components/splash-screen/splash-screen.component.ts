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

  constructor(public i18n: I18nService) {
    this.currentStatus = this.i18n.t('splash_status_init');
  }

  ngOnInit(): void {
    this.runSplashSequence();
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
