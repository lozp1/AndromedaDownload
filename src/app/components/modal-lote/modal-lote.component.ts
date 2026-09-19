import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { TauriService } from '../../services/tauri.service';
import { PlaylistProbeResult, PlaylistItemProbe, ItemLoteDescarga } from '../../models/download.model';

@Component({
  selector: 'app-modal-lote',
  templateUrl: './modal-lote.component.html',
  styleUrls: []
})
export class ModalLoteComponent implements OnInit, OnChanges {
  @Input() visible: boolean = false;
  @Input() playlistData: PlaylistProbeResult | null = null;
  @Output() close = new EventEmitter<void>();

  public itemsSeleccionados: Set<string> = new Set();
  public indiceInspeccionado: number = 0;
  public presetGlobal: string = '1080p'; // '1080p', '720p', 'mp3', 'm4a'
  public carpetaDestino: string = '';
  public formatosPersonalizados: Map<string, string> = new Map();
  public titulosPersonalizados: Map<string, string> = new Map();
  public estaProcesando: boolean = false;

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService,
    private tauriService: TauriService
  ) {}

  ngOnInit(): void {
    this.inicializarCarpeta();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['playlistData'] && this.playlistData && this.playlistData.items) {
      this.itemsSeleccionados = new Set(this.playlistData.items.map(i => i.id));
      this.indiceInspeccionado = 0;
      this.formatosPersonalizados.clear();
      this.titulosPersonalizados.clear();
      this.inicializarCarpeta();
    }
  }

  private inicializarCarpeta(): void {
    const s = this.downloadService.getCurrentSettings();
    const base = s.directorio_descargas || 'C:\\Descargas';
    const sub = this.presetGlobal.includes('mp3') || this.presetGlobal.includes('m4a') ? 'Musica' : 'Videos';
    this.carpetaDestino = `${base.replace(/[\\/]+$/, '')}\\${sub}`;
  }

  public cerrarModal(): void {
    this.close.emit();
  }

  public toggleSeleccionarTodos(): void {
    if (!this.playlistData?.items) return;
    if (this.estaTodosSeleccionados()) {
      this.itemsSeleccionados.clear();
    } else {
      this.itemsSeleccionados = new Set(this.playlistData.items.map(i => i.id));
    }
  }

  public estaTodosSeleccionados(): boolean {
    if (!this.playlistData?.items?.length) return false;
    return this.itemsSeleccionados.size === this.playlistData.items.length;
  }

  public toggleSeleccion(id: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    if (this.itemsSeleccionados.has(id)) {
      this.itemsSeleccionados.delete(id);
    } else {
      this.itemsSeleccionados.add(id);
    }
  }

  public estaSeleccionado(id: string): boolean {
    return this.itemsSeleccionados.has(id);
  }

  public aplicarPresetGlobal(): void {
    this.formatosPersonalizados.clear();
    this.inicializarCarpeta();
  }

  public seleccionarParaInspeccion(index: number): void {
    if (!this.playlistData?.items?.length) return;
    if (index >= 0 && index < this.playlistData.items.length) {
      this.indiceInspeccionado = index;
    }
  }

  public anteriorVideo(): void {
    this.seleccionarOffset(-1);
  }

  public siguienteVideo(): void {
    this.seleccionarOffset(1);
  }

  public getVideoActual(): PlaylistItemProbe | null {
    if (!this.playlistData?.items?.length) return null;
    return this.playlistData.items[this.indiceInspeccionado] || null;
  }

  public getFormatoVideo(id: string): string {
    return this.formatosPersonalizados.get(id) || this.presetGlobal;
  }

  public setFormatoVideo(id: string, fmt: string): void {
    this.formatosPersonalizados.set(id, fmt);
  }

  public getTituloVideo(item: PlaylistItemProbe): string {
    return this.titulosPersonalizados.get(item.id) ?? item.titulo;
  }

  public setTituloVideo(id: string, nuevoTitulo: string): void {
    this.titulosPersonalizados.set(id, nuevoTitulo);
  }

  public getTamanoEstimadoTotal(): string {
    if (!this.playlistData?.items) return '0 MB';
    let bytes = 0;
    for (const item of this.playlistData.items) {
      if (this.itemsSeleccionados.has(item.id)) {
        const fmt = this.getFormatoVideo(item.id);
        if (fmt.includes('mp3') || fmt.includes('m4a')) {
          bytes += 8 * 1024 * 1024; // ~8 MB promedio audio
        } else if (fmt === '720p') {
          bytes += 25 * 1024 * 1024;
        } else {
          bytes += 45 * 1024 * 1024;
        }
      }
    }
    return this.downloadService.formatBytes(bytes);
  }

  public getVideoRelativo(offset: number): PlaylistItemProbe | null {
    if (!this.playlistData?.items?.length) return null;
    const len = this.playlistData.items.length;
    const idx = (this.indiceInspeccionado + offset + len) % len;
    return this.playlistData.items[idx] || null;
  }

  public swapDirection: 'left' | 'right' | null = null;
  private swapTimer: any = null;

  public seleccionarOffset(offset: number): void {
    if (!this.playlistData?.items?.length) return;
    this.swapDirection = offset < 0 ? 'left' : 'right';
    if (this.swapTimer) clearTimeout(this.swapTimer);
    const len = this.playlistData.items.length;
    this.indiceInspeccionado = (this.indiceInspeccionado + offset + len) % len;
    this.swapTimer = setTimeout(() => {
      this.swapDirection = null;
    }, 400);
  }

  public async seleccionarCarpeta(): Promise<void> {
    const ruta = await this.downloadService.abrirExploradorModal(this.carpetaDestino);
    if (ruta && ruta.trim().length > 0) {
      this.carpetaDestino = ruta.trim();
    }
  }

  public async confirmarDescargaLote(): Promise<void> {
    if (!this.playlistData?.items?.length || this.itemsSeleccionados.size === 0) return;
    this.estaProcesando = true;

    const payload: ItemLoteDescarga[] = [];
    for (const item of this.playlistData.items) {
      if (this.itemsSeleccionados.has(item.id)) {
        const titulo = this.getTituloVideo(item);
        const formato = this.getFormatoVideo(item.id);
        payload.push({
          url: item.url,
          titulo,
          formato,
          carpeta: this.carpetaDestino,
          conexiones: 16
        });
      }
    }

    await this.downloadService.iniciarDescargasLote(payload, true);
    this.estaProcesando = false;
    this.cerrarModal();
  }
}
