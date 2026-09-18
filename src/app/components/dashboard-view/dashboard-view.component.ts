import { Component, OnDestroy, OnInit } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { GlobalTelemetry } from '../../models/download.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-dashboard-view',
  templateUrl: './dashboard-view.component.html'
})
export class DashboardViewComponent implements OnInit, OnDestroy {
  public telemetry: GlobalTelemetry | null = null;
  public chartPathArea: string = 'M0,120 L700,120';
  public chartPathAndromeda: string = 'M0,120 L700,120';
  public chartPathBrowser: string = 'M0,120 L700,120';
  public circleY: number = 30;

  public socketsMatrix: { id: number; active: boolean; opacity?: number }[] = [];
  public duelBrowserPct: number = 6;
  public duelAndromedaPct: number = 94;
  public tachometerAngle: number = -90; // -90 deg a +90 deg (180 deg total sweep)
  public tachometerSpeedMB: number = 88.5;
  public tachometerPct: number = 74;
  public get kpiEstadoConexion(): { lbl: string; col: string; cls: string } { if (!this.telemetry) return { lbl: 'Inactivo', col: 'var(--text-muted)', cls: 'muted' }; const bps = this.telemetry.velocidad_global_bps; if (bps < 10) return { lbl: 'Inactivo', col: 'var(--text-muted)', cls: 'muted' }; if (bps > 15 * 1024 * 1024) return { lbl: 'Conexión Óptima', col: 'var(--accent-green)', cls: 'green' }; if (bps > 3 * 1024 * 1024) return { lbl: 'Conexión Estable', col: 'var(--accent-amber)', cls: 'amber' }; return { lbl: 'Conexión Lenta', col: 'var(--accent-red)', cls: 'red' }; }

  public get semaforoRoi(): { lbl: string; cls: string; barPct: number } {
    if (!this.telemetry || (this.telemetry.tiempo_total_ahorrado_segundos <= 0 && this.telemetry.activas === 0)) {
      return { lbl: this.i18n.t('kpi_sem_inactivo') || 'Inactivo', cls: 'muted', barPct: 15 };
    }
    const multStr = this.telemetry.multiplicador_promedio_str || '1.0x';
    const mult = parseFloat(multStr.replace('x', '')) || 1.0;
    if (mult >= 5.0 || this.telemetry.tiempo_total_ahorrado_segundos > 60) {
      return { lbl: this.i18n.t('kpi_sem_optimo') || 'Óptimo', cls: 'green', barPct: Math.min(100, Math.round(mult * 2.5) + 20) };
    }
    return { lbl: this.i18n.t('kpi_sem_moderado') || 'Moderado', cls: 'amber', barPct: 45 };
  }

  public get semaforoThroughput(): { lbl: string; cls: string; col: string; sparkCol: string; barPct: number } {
    if (!this.telemetry) {
      return { lbl: this.i18n.t('kpi_sem_inactivo') || 'Inactivo', cls: 'muted', col: 'var(--text-muted, #64748B)', sparkCol: '#64748B', barPct: 5 };
    }
    const bps = this.telemetry.velocidad_global_bps;
    if (bps < 1024) {
      return { lbl: this.i18n.t('kpi_sem_inactivo') || 'Inactivo', cls: 'muted', col: 'var(--text-muted, #64748B)', sparkCol: '#64748B', barPct: 5 };
    }
    if (bps >= 15 * 1024 * 1024) {
      return { lbl: this.i18n.t('kpi_sem_optimo') || 'Óptimo', cls: 'green', col: 'var(--accent-green, #10E761)', sparkCol: '#10E761', barPct: Math.min(100, Math.round((bps / (100 * 1024 * 1024)) * 100)) };
    }
    if (bps >= 3 * 1024 * 1024) {
      return { lbl: this.i18n.t('kpi_sem_moderado') || 'Moderado', cls: 'amber', col: 'var(--accent-amber, #F59E0B)', sparkCol: '#F59E0B', barPct: Math.max(30, Math.round((bps / (15 * 1024 * 1024)) * 65)) };
    }
    return { lbl: this.i18n.t('kpi_sem_atencion') || 'Lento', cls: 'red', col: 'var(--accent-red, #EF4444)', sparkCol: '#EF4444', barPct: 20 };
  }

  public get semaforoSockets(): { lbl: string; cls: string; barPct: number } {
    if (!this.telemetry) return { lbl: this.i18n.t('kpi_sem_inactivo') || 'Inactivo', cls: 'muted', barPct: 5 };
    const activos = this.telemetry.sockets_activos;
    const max = this.telemetry.max_sockets || 32;
    const pct = Math.min(100, Math.round((activos / max) * 100));
    if (activos >= 16) {
      return { lbl: this.i18n.t('kpi_sem_optimo') || 'Óptimo', cls: 'green', barPct: pct };
    }
    if (activos > 0) {
      return { lbl: this.i18n.t('kpi_sem_moderado') || 'Moderado', cls: 'amber', barPct: pct };
    }
    return { lbl: this.i18n.t('kpi_sem_inactivo') || 'Inactivo', cls: 'muted', barPct: 5 };
  }

  public get semaforoSalud(): { lbl: string; cls: string; barPct: number } {
    if (!this.telemetry || !this.telemetry.motor_conectado) {
      return { lbl: this.i18n.t('kpi_sem_atencion') || 'Atención', cls: 'red', barPct: 10 };
    }
    if (this.telemetry.completadas > 0 || this.telemetry.activas > 0) {
      return { lbl: this.i18n.t('kpi_sem_optimo') || 'Óptimo', cls: 'green', barPct: 100 };
    }
    return { lbl: this.i18n.t('kpi_sem_moderado') || 'Moderado', cls: 'amber', barPct: 60 };
  }

  public selectedTimeWindow: '60s' | '5m' | '30m' | '24h' = '60s';
  public timeAxisLabels: string[] = ['-60s', '-45s', '-30s', '-15s', '• 0s (AHORA)'];

  public setTimeWindow(w: '60s' | '5m' | '30m' | '24h'): void {
    this.selectedTimeWindow = w;
    switch (w) {
      case '60s':
        this.timeAxisLabels = ['-60s', '-45s', '-30s', '-15s', '• 0s (AHORA)'];
        break;
      case '5m':
        this.timeAxisLabels = ['-5m', '-3.7m', '-2.5m', '-1.2m', '• 0m (AHORA)'];
        break;
      case '30m':
        this.timeAxisLabels = ['-30m', '-22m', '-15m', '-7m', '• 0m (AHORA)'];
        break;
      case '24h':
        this.timeAxisLabels = ['-24h', '-18h', '-12h', '-6h', '• 0h (HOY)'];
        break;
    }
    if (this.modoSimulacion && this.simBuffer.length > 0) {
      this.calcularEspectrograma(this.simBuffer);
    } else if (this.lastRealBuffer.length > 0) {
      this.calcularEspectrograma(this.lastRealBuffer);
    }
  }

  public modoSimulacion: boolean = true;
  private simInterval: any = null;
  private simBuffer: number[] = [];
  private simBytes: number = 14.82 * 1024 * 1024 * 1024;
  private lastRealTelemetry: GlobalTelemetry | null = null;
  private lastRealBuffer: number[] = [];
  private subs: Subscription = new Subscription();

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService
  ) {
    for (let i = 0; i < 32; i++) {
      this.socketsMatrix.push({ id: i, active: i < 28, opacity: 1 });
    }
    // Inicializar buffer simulado de 60 segundos con ondulaciones hiper-realistas
    for (let i = 0; i < 60; i++) {
      const base = 82 * 1024 * 1024;
      const variation = Math.sin(i * 0.35) * 8 * 1024 * 1024 + Math.cos(i * 0.7) * 4 * 1024 * 1024;
      this.simBuffer.push(base + variation);
    }
  }

  ngOnInit(): void {
    this.subs.add(
      this.downloadService.telemetryObservable.subscribe(t => {
        this.lastRealTelemetry = t;
        if (t && t.activas > 0) {
          // Si hay descargas reales activas, dar prioridad a los datos reales
          this.modoSimulacion = false;
          this.telemetry = t;
          this.actualizarMatrizSockets(t.sockets_activos);
          this.calcularSpeedDuel(t);
        } else if (!this.modoSimulacion && t) {
          this.telemetry = t;
          this.actualizarMatrizSockets(t.sockets_activos);
          this.calcularSpeedDuel(t);
        }
      })
    );

    this.subs.add(
      this.downloadService.speedBufferObservable.subscribe(buf => {
        this.lastRealBuffer = buf;
        if (!this.modoSimulacion) {
          this.calcularEspectrograma(buf);
        }
      })
    );

    // Iniciar ciclo de simulación para que el usuario pueda visualizar los gráficos en plena acción
    this.iniciarSimulacion();
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.simInterval) {
      clearInterval(this.simInterval);
    }
  }

  public toggleSimulacion(): void {
    this.modoSimulacion = !this.modoSimulacion;
    if (this.modoSimulacion) {
      this.iniciarSimulacion();
    } else {
      if (this.simInterval) clearInterval(this.simInterval);
      if (this.lastRealTelemetry) {
        this.telemetry = this.lastRealTelemetry;
        this.actualizarMatrizSockets(this.lastRealTelemetry.sockets_activos);
        this.calcularSpeedDuel(this.lastRealTelemetry);
      }
      if (this.lastRealBuffer.length > 0) {
        this.calcularEspectrograma(this.lastRealBuffer);
      }
    }
  }

  private iniciarSimulacion(): void {
    if (this.simInterval) clearInterval(this.simInterval);

    const ejecutarPasoSimulacion = () => {
      if (!this.modoSimulacion) return;

      const t = Date.now() / 1000;
      const baseSpeed = 86 * 1024 * 1024; // ~86 MB/s
      const jitter = (Math.sin(t * 1.8) * 7 + Math.cos(t * 3.2) * 4) * 1024 * 1024;
      const currentSpeed = Math.max(1024 * 1024 * 40, baseSpeed + jitter);

      this.simBuffer.shift();
      this.simBuffer.push(currentSpeed);
      this.simBytes += currentSpeed * 0.8;

      const currentMB = (currentSpeed / (1024 * 1024)).toFixed(2);
      const totalGB = (this.simBytes / (1024 * 1024 * 1024)).toFixed(2);

      this.telemetry = {
        descargas: [],
        total_descargas: 14,
        activas: 4,
        completadas: 9,
        velocidad_global_bps: currentSpeed,
        velocidad_global: `${currentMB} MB/s`,
        velocidad_pico_bps: 104.5 * 1024 * 1024,
        velocidad_pico_str: '104.50 MB/s',
        sockets_activos: 28,
        max_sockets: 32,
        total_transferido_bytes: this.simBytes,
        total_transferido_str: `${totalGB} GB`,
        tiempo_total_ahorrado_segundos: 1458,
        tiempo_total_ahorrado_str: '24m 18s ahorrados',
        multiplicador_promedio_str: '37.8x',
        motor_conectado: true
      };

      // Micro-parpadeo orgánico de sockets activos (transmisión Direct I/O de chunks)
      this.socketsMatrix.forEach((s, idx) => {
        if (idx < 28) {
          s.active = true;
          s.opacity = 0.75 + Math.random() * 0.25;
        } else {
          s.active = false;
          s.opacity = 0.3;
        }
      });

      this.duelBrowserPct = 6;
      this.duelAndromedaPct = 94;

      const speedMB = currentSpeed / (1024 * 1024);
      this.tachometerSpeedMB = parseFloat(speedMB.toFixed(1));
      // Escala de 0 a 120 MB/s mapeada de -90deg a +90deg (180deg arco)
      const ratio = Math.min(1, Math.max(0, speedMB / 120));
      this.tachometerPct = Math.round(ratio * 100);
      this.tachometerAngle = -90 + ratio * 180;

      this.calcularEspectrograma(this.simBuffer);
    };

    ejecutarPasoSimulacion();
    this.simInterval = setInterval(ejecutarPasoSimulacion, 800);
  }

  private actualizarMatrizSockets(activos: number): void {
    this.socketsMatrix.forEach((s, idx) => {
      s.active = idx < activos;
      s.opacity = s.active ? 1 : 0.3;
    });
  }

  private calcularSpeedDuel(t: GlobalTelemetry): void {
    const vBase = 2.5 * 1024 * 1024; // 2.5 MB/s
    const vAndro = Math.max(t.velocidad_global_bps, 1024);
    const total = vBase + vAndro;
    this.duelBrowserPct = Math.min(85, Math.max(5, (vBase / total) * 100));
    this.duelAndromedaPct = 100 - this.duelBrowserPct;

    const speedMB = vAndro / (1024 * 1024);
    this.tachometerSpeedMB = parseFloat(speedMB.toFixed(1));
    const ratio = Math.min(1, Math.max(0, speedMB / 120));
    this.tachometerPct = Math.round(ratio * 100);
    this.tachometerAngle = -90 + ratio * 180;
  }

  private calcularEspectrograma(buffer: number[]): void {
    if (!buffer || buffer.length === 0) return;
    const maxVal = 100 * 1024 * 1024; // 100 MB/s escala estándar Tremor
    const w = 700;
    const h = 120;
    const points: [number, number][] = [];

    for (let i = 0; i < buffer.length; i++) {
      const x = (i / (buffer.length - 1)) * w;
      const normalized = Math.min(1.0, buffer[i] / maxVal);
      const y = h - (normalized * (h - 10));
      points.push([x, y]);
    }

    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0[0] + p1[0]) / 2;
      d += ` C${cx},${p0[1]} ${cx},${p1[1]} ${p1[0]},${p1[1]}`;
    }

    this.chartPathAndromeda = d;
    this.chartPathArea = `${d} L${w},${h} L0,${h} Z`;
    this.circleY = points[points.length - 1][1];

    // Línea de referencia del navegador (2.5 MB/s)
    const browserRefNorm = Math.min(1.0, (2.5 * 1024 * 1024) / maxVal);
    const browserY = h - (browserRefNorm * (h - 10));
    this.chartPathBrowser = `M0,${browserY} L${w},${browserY}`;
  }
}
