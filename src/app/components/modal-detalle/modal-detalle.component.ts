import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { DescargaItem } from '../../models/download.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-modal-detalle',
  templateUrl: './modal-detalle.component.html'
})
export class ModalDetalleComponent implements OnInit, OnChanges, OnDestroy {
  @Input() visible: boolean = false;
  @Input() taskId: string | null = null;
  @Output() close = new EventEmitter<void>();

  public item: DescargaItem | null = null;
  public readonly Math = Math;
  public chunksGrid: { id: number; active: boolean; completed: boolean }[] = [];
  public osciPath: string = 'M0,75 L320,75';
  public osciDotY: number = 75;
  public tachoArcD: string = 'M 25,80 A 55,55 0 0 1 25,80';
  public tachoNeedleRotation: string = 'rotate(-180 80 80)';
  public tachoArcColor: string = '#10E761';
  public tachoPct: number = 0;

  private velHistory: number[] = Array(20).fill(0);
  private subs: Subscription = new Subscription();
  private liveTimer: any = null;

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService
  ) {
    for (let i = 0; i < 32; i++) {
      this.chunksGrid.push({ id: i, active: false, completed: false });
    }
  }

  ngOnInit(): void {
    this.subs.add(
      this.downloadService.descargasObservable.subscribe(descargas => {
        if (this.visible && this.taskId) {
          const found = descargas.find(d => d.id === this.taskId);
          if (found) {
            this.item = found;
            this.actualizarDetalles(found);
          }
        }
      })
    );

    // Timer de 250ms para fluidez, telemetría y oscilación continua en vivo
    this.liveTimer = setInterval(() => {
      if (this.visible && this.taskId) {
        const found = this.downloadService.getCurrentDownloads().find(d => d.id === this.taskId);
        if (found) {
          this.item = found;
          this.actualizarDetalles(found);
        }
      }
    }, 250);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] || changes['visible']) {
      if (this.visible && this.taskId) {
        const found = this.downloadService.getCurrentDownloads().find(d => d.id === this.taskId);
        if (found) {
          this.item = found;
          this.actualizarDetalles(found);
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.liveTimer) {
      clearInterval(this.liveTimer);
    }
  }

  public cerrar(): void {
    this.close.emit();
  }

  public pausar(): void {
    if (this.taskId) this.downloadService.pausar([this.taskId]);
  }

  public reanudar(): void {
    if (this.taskId) this.downloadService.reanudar([this.taskId]);
  }

  public abrirCarpeta(): void {
    if (this.item?.ruta_destino) {
      this.downloadService.abrirCarpeta(this.item.ruta_destino);
    }
  }

  public abrirArchivo(): void {
    if (this.item?.ruta_destino) {
      this.downloadService.abrirArchivo(this.item.ruta_destino);
    }
  }

  public getNombreLimpio(nombre?: string): string {
    if (!nombre) return '';
    const clean = nombre.trim();
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > 0 && lastDot < clean.length - 1) {
      const ext = clean.substring(lastDot + 1);
      if (ext.length <= 6 && /^[a-zA-Z0-9]+$/.test(ext)) {
        return clean.substring(0, lastDot);
      }
    }
    return clean;
  }

  public getExtension(nombre?: string): string {
    if (!nombre) return '—';
    const clean = nombre.trim();
    const lastDot = clean.lastIndexOf('.');
    if (lastDot > 0 && lastDot < clean.length - 1) {
      const ext = clean.substring(lastDot + 1).toUpperCase();
      if (ext.length <= 6 && /^[A-Z0-9]+$/.test(ext)) {
        return ext;
      }
    }
    return '—';
  }

  private actualizarDetalles(d: DescargaItem): void {
    if (d.tamano_total > 0 && d.descargado > d.tamano_total) {
      d.descargado = d.tamano_total;
    }
    d.progreso = Math.min(100, Math.max(0, d.progreso || 0));
    const prog = d.progreso;

    // Desacoplamiento de Sockets Tokio
    if (d.segmentos && d.segmentos.length > 0) {
      const mapped = d.segmentos.slice(0, 32).map((s, idx) => ({
        id: idx,
        active: s.estado === 'descargando',
        completed: s.estado === 'terminado' || s.actual >= s.fin
      }));
      while (mapped.length < 32) {
        mapped.push({ id: mapped.length, active: false, completed: d.estado === 'Completado' });
      }
      this.chunksGrid = mapped;
    } else if (prog >= 99.5 || d.estado === 'Completado') {
      this.chunksGrid.forEach(c => {
        c.completed = true;
        c.active = false;
      });
    } else if (d.estado === 'Pausado' || prog === 0) {
      const completedCount = Math.floor((prog / 100) * 32);
      this.chunksGrid.forEach((c, idx) => {
        c.completed = idx < completedCount;
        c.active = false;
      });
    } else {
      const numSockets = Math.max(1, Math.min(d.conexiones || 16, 32));
      const slotsPerSocket = 32 / numSockets;
      
      this.chunksGrid.forEach((c, idx) => {
        const socketIdx = Math.floor(idx / slotsPerSocket);
        const slotInSocket = idx % slotsPerSocket;
        const socketProg = Math.min(100, Math.max(0, prog + (Math.sin(socketIdx * 1.5) * 12)));
        const socketSlotsCompleted = (socketProg / 100) * slotsPerSocket;

        if (slotInSocket < Math.floor(socketSlotsCompleted)) {
          c.completed = true;
          c.active = false;
        } else if (slotInSocket === Math.floor(socketSlotsCompleted) && prog < 100) {
          c.completed = false;
          c.active = true;
        } else {
          c.completed = false;
          c.active = false;
        }
      });
    }

    // Actualizar Tacómetro
    this.tachoPct = Math.round(prog);
    const angle = -180 + (prog / 100) * 180;
    this.tachoNeedleRotation = `rotate(${angle} 80 80)`;

    const r = 55, cx = 80, cy = 80;
    const endAng = Math.PI + (prog / 100) * Math.PI;
    const x = cx + r * Math.cos(endAng);
    const y = cy + r * Math.sin(endAng);
    this.tachoArcD = `M 25,80 A 55,55 0 0 1 ${x},${y}`;

    if (prog > 85) this.tachoArcColor = '#F59E0B';
    else if (prog > 60) this.tachoArcColor = '#38BDF8';
    else this.tachoArcColor = '#10E761';

    this.renderOsciloscopio();
  }

  private renderOsciloscopio(): void {
    if (!this.item) return;

    let baseSpeed = this.item.velocidad_bps || 0;
    if (this.item.estado === 'Descargando') {
      if (baseSpeed === 0) {
        baseSpeed = 2.4 * 1024 * 1024; // Valor representativo si recién inicia
      }
      const jitter = 0.92 + (Math.random() * 0.16);
      baseSpeed = baseSpeed * jitter;
    } else if (this.item.estado === 'Pausado' || this.item.estado === 'Detenido') {
      baseSpeed = 0;
    }

    this.velHistory.shift();
    this.velHistory.push(baseSpeed);

    const maxV = Math.max(...this.velHistory, 1024 * 1024);
    const w = 320;
    const h = 55;
    const points: [number, number][] = [];

    for (let i = 0; i < this.velHistory.length; i++) {
      const px = (i / (this.velHistory.length - 1)) * w;
      const norm = Math.min(1.0, this.velHistory[i] / maxV);
      const py = 75 - (norm * h);
      points.push([px, py]);
    }

    let path = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midX = (p0[0] + p1[0]) / 2;
      path += ` C${midX},${p0[1]} ${midX},${p1[1]} ${p1[0]},${p1[1]}`;
    }

    this.osciPath = path;
    this.osciDotY = points[points.length - 1][1];
  }
}
