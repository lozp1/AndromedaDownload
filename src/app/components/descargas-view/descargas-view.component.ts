import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { DescargaItem, GlobalTelemetry } from '../../models/download.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-descargas-view',
  templateUrl: './descargas-view.component.html'
})
export class DescargasViewComponent implements OnInit, OnDestroy {
  @Output() openNewDownload = new EventEmitter<void>();
  @Output() openDetail = new EventEmitter<string>();

  public descargas: DescargaItem[] = [];
  public descargasFiltradas: DescargaItem[] = [];
  public telemetry: GlobalTelemetry | null = null;
  public settings: any = null;
  public selectedIds: Set<string> = new Set();
  public searchString: string = '';
  public activeFilter: string = 'Todas';

  // Anchos de columna redimensionables estilo Excel (px)
  public columnWidths: { [key: string]: number } = {
    check: 40,
    nombre: 260,
    tamano: 140,
    progreso: 160,
    vel: 110,
    eta: 105,
    estado: 110,
    cat: 105,
    fecha: 115
  };

  private activeColKey: string | null = null;
  private startX: number = 0;
  private startWidth: number = 0;
  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseUpListener: (() => void) | null = null;

  // SVG Bézier Dock Oscilloscope
  public osciPath: string = 'M0,32 L500,32';
  public osciCircleY: number = 32;

  private subs: Subscription = new Subscription();

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.downloadService.settingsObservable.subscribe(s => {
        this.settings = s;
      })
    );

    this.subs.add(
      this.downloadService.descargasObservable.subscribe(d => {
        this.descargas = d;
        this.aplicarFiltros();
      })
    );

    this.subs.add(
      this.downloadService.telemetryObservable.subscribe(t => {
        this.telemetry = t;
      })
    );

    this.subs.add(
      this.downloadService.selectedIdsObservable.subscribe(s => {
        this.selectedIds = s;
      })
    );

    this.subs.add(
      this.downloadService.activeFilterObservable.subscribe(f => {
        this.activeFilter = f;
        this.aplicarFiltros();
      })
    );

    this.subs.add(
      this.downloadService.speedBufferObservable.subscribe(buf => {
        this.calcularCurvaOsciloscopio(buf);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    if (this.mouseMoveListener) {
      window.removeEventListener('mousemove', this.mouseMoveListener);
    }
    if (this.mouseUpListener) {
      window.removeEventListener('mouseup', this.mouseUpListener);
    }
  }

  public startColResize(colKey: string, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.activeColKey = colKey;
    this.startX = event.clientX;
    this.startWidth = this.columnWidths[colKey] || 100;

    this.mouseMoveListener = (e: MouseEvent) => {
      if (!this.activeColKey) return;
      const diff = e.clientX - this.startX;
      const newWidth = Math.max(50, this.startWidth + diff);
      this.columnWidths[this.activeColKey] = newWidth;
    };

    this.mouseUpListener = () => {
      this.activeColKey = null;
      if (this.mouseMoveListener) {
        window.removeEventListener('mousemove', this.mouseMoveListener);
        this.mouseMoveListener = null;
      }
      if (this.mouseUpListener) {
        window.removeEventListener('mouseup', this.mouseUpListener);
        this.mouseUpListener = null;
      }
    };

    window.addEventListener('mousemove', this.mouseMoveListener);
    window.addEventListener('mouseup', this.mouseUpListener);
  }

  public formatFechaCompacta(fechaStr: string | undefined): string {
    if (!fechaStr) return '--:--';
    try {
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) {
        return fechaStr;
      }
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const hh = d.getHours().toString().padStart(2, '0');
      const mm = d.getMinutes().toString().padStart(2, '0');
      if (isToday) {
        return `Hoy ${hh}:${mm}`;
      }
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return `Ayer ${hh}:${mm}`;
      }
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear().toString().slice(-2);
      return `${day}/${month}/${year}`;
    } catch {
      return fechaStr;
    }
  }

  public onSearch(event: any): void {
    this.searchString = (event.target.value || '').toLowerCase().trim();
    this.aplicarFiltros();
  }

  public toggleSelect(id: string): void {
    this.downloadService.toggleSelect(id);
  }

  public isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  public isMasterChecked(): boolean {
    if (this.descargasFiltradas.length === 0) return false;
    return this.descargasFiltradas.every(d => this.selectedIds.has(d.id));
  }

  public toggleMaster(event: any): void {
    const checked = event.target.checked;
    const ids = this.descargasFiltradas.map(d => d.id);
    this.downloadService.toggleSelectAll(checked, ids);
  }

  public triggerNew(): void {
    this.openNewDownload.emit();
  }

  public get canPause(): boolean {
    if (this.selectedIds.size === 0) return false;
    return this.descargas.some(d => this.selectedIds.has(d.id) && (d.estado === 'Descargando' || d.estado === 'Pendiente'));
  }

  public get canResume(): boolean {
    if (this.selectedIds.size === 0) return false;
    return this.descargas.some(d => this.selectedIds.has(d.id) && (d.estado === 'Pausado' || d.estado === 'Detenido' || d.estado === 'Error'));
  }

  public get canStop(): boolean {
    if (this.selectedIds.size === 0) return false;
    return this.descargas.some(d => this.selectedIds.has(d.id) && d.estado === 'Descargando');
  }

  public pauseSelected(): void {
    this.downloadService.pausar();
  }

  public resumeSelected(): void {
    this.downloadService.reanudar();
  }

  public stopSelected(): void {
    this.downloadService.detener();
  }

  public deleteSelected(): void {
    this.downloadService.solicitarConfirmacionEliminar();
  }

  public viewDetail(): void {
    const firstId = Array.from(this.selectedIds)[0];
    if (firstId) {
      this.openDetail.emit(firstId);
    }
  }

  public viewDetailItem(id: string): void {
    this.openDetail.emit(id);
  }

  private aplicarFiltros(): void {
    const f = this.activeFilter;
    const q = this.searchString;

    this.descargasFiltradas = this.descargas.filter(d => {
      const est = (d.estado || '').toLowerCase();
      const cat = (d.categoria || '').toLowerCase();
      const nom = (d.nombre || '').toLowerCase();

      if (q && !nom.includes(q)) return false;

      if (f === 'Descargando') return est.includes('descarg') || est.includes('progreso');
      if (f === 'Completadas') return est.includes('complet');
      if (f === 'Pausadas') return est.includes('paus') || est.includes('deten');
      if (f === 'Programadas') return est.includes('program') || est.includes('cola');
      if (f === 'Error') return est.includes('error') || est.includes('fall');

      if (!['Todas', 'Descargando', 'Completadas', 'Pausadas', 'Programadas', 'Error'].includes(f)) {
        return cat.includes(f.toLowerCase());
      }

      return true;
    });
  }

  private calcularCurvaOsciloscopio(buffer: number[]): void {
    if (!buffer || buffer.length === 0) return;
    const maxVal = Math.max(...buffer, 1024 * 100);
    const w = 800;
    const h = 32;
    const points: [number, number][] = [];

    for (let i = 0; i < buffer.length; i++) {
      const x = (i / (buffer.length - 1)) * w;
      const normalized = Math.min(1.0, buffer[i] / maxVal);
      const y = h - (normalized * (h - 4));
      points.push([x, y]);
    }

    // Bézier Smoothing
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0[0] + p1[0]) / 2;
      d += ` C${cx},${p0[1]} ${cx},${p1[1]} ${p1[0]},${p1[1]}`;
    }

    this.osciPath = d;
    this.osciCircleY = points[points.length - 1][1];
  }

  public getStatusBadgeClass(estado: string): string {
    const e = (estado || '').toLowerCase();
    if (e.includes('descarg') || e.includes('progreso')) return 'status-descargando';
    if (e.includes('complet')) return 'status-completada';
    if (e.includes('paus')) return 'status-pausada';
    if (e.includes('program')) return 'status-programada';
    if (e.includes('error') || e.includes('fall')) return 'status-error';
    return 'status-pausada';
  }

  public getCategoryBadgeClass(categoria: string): string {
    const c = (categoria || '').toLowerCase();
    if (c.includes('comprim')) return 'cat-comprimidos';
    if (c.includes('vid')) return 'cat-videos';
    if (c.includes('mus') || c.includes('mús')) return 'cat-musica';
    if (c.includes('doc')) return 'cat-documentos';
    if (c.includes('prog')) return 'cat-programas';
    return 'cat-otros';
  }
}
