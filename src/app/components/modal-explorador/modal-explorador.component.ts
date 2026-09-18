import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { TauriService } from '../../services/tauri.service';
import { I18nService } from '../../services/i18n.service';

export interface ItemDirectorio {
  nombre: string;
  ruta_completa: string;
  es_directorio: boolean;
  tamano_bytes: number;
}

@Component({
  selector: 'app-modal-explorador',
  templateUrl: './modal-explorador.component.html'
})
export class ModalExploradorComponent implements OnChanges {
  @Input() visible: boolean = false;
  @Input() initialPath: string = '';
  @Output() selected: EventEmitter<string> = new EventEmitter<string>();
  @Output() close: EventEmitter<void> = new EventEmitter<void>();

  public currentPath: string = '';
  public elementos: ItemDirectorio[] = [];
  public unidades: string[] = [];
  public rutasSistema = { escritorio: '', descargas: '', documentos: '', videos: '' };
  public cargando: boolean = false;
  public errorMsg: string = '';
  public busqueda: string = '';
  
  public modoCrearCarpeta: boolean = false;
  public nuevoNombre: string = '';

  constructor(
    private tauriService: TauriService,
    public i18n: I18nService
  ) {}

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['visible'] && this.visible) {
      this.modoCrearCarpeta = false;
      this.nuevoNombre = '';
      this.busqueda = '';
      await this.cargarRutasSistema();
      await this.cargarUnidades();
      await this.navegarA(this.initialPath || this.rutasSistema.descargas || 'C:\\');
    }
  }

  public async cargarRutasSistema(): Promise<void> {
    try {
      const r = await this.tauriService.obtenerRutasSistema();
      if (r) {
        this.rutasSistema = r;
      }
    } catch {
      // Fallback
      this.rutasSistema = {
        escritorio: 'C:\\Users\\f.paolo\\Desktop',
        descargas: 'C:\\Users\\f.paolo\\Downloads',
        documentos: 'C:\\Users\\f.paolo\\Documents',
        videos: 'C:\\Users\\f.paolo\\Videos'
      };
    }
  }

  public async cargarUnidades(): Promise<void> {
    try {
      const u = await this.tauriService.obtenerUnidadesDisco();
      this.unidades = u && u.length ? u : ['C:\\'];
    } catch {
      this.unidades = ['C:\\'];
    }
  }

  public async navegarA(ruta: string): Promise<void> {
    if (!ruta) return;
    this.cargando = true;
    this.errorMsg = '';
    try {
      const items = await this.tauriService.listarDirectorios(ruta);
      this.elementos = items || [];
      this.currentPath = ruta.replace(/\//g, '\\');
      if (/^[a-zA-Z]:$/.test(this.currentPath)) {
        this.currentPath += '\\';
      }
    } catch (err: any) {
      this.errorMsg = 'No se pudo acceder: ' + (err?.message || err);
    } finally {
      this.cargando = false;
    }
  }

  public get elementosFiltrados(): ItemDirectorio[] {
    if (!this.busqueda.trim()) return this.elementos;
    const q = this.busqueda.toLowerCase();
    return this.elementos.filter(c => c.nombre.toLowerCase().includes(q));
  }

  public formatearTamano(bytes: number): string {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }

  public get breadcrumbs(): { label: string; ruta: string }[] {
    if (!this.currentPath) return [];
    const parts = this.currentPath.split('\\').filter(p => p.length > 0);
    const crumbs: { label: string; ruta: string }[] = [];
    let acc = '';

    parts.forEach((p, idx) => {
      if (idx === 0 && p.endsWith(':')) {
        acc = p + '\\';
      } else {
        acc = acc.endsWith('\\') ? acc + p : acc + '\\' + p;
      }
      crumbs.push({ label: p, ruta: acc });
    });

    return crumbs;
  }

  public subirNivel(): void {
    if (!this.currentPath) return;
    const parts = this.currentPath.replace(/\\$/, '').split('\\');
    if (parts.length > 1) {
      parts.pop();
      let parent = parts.join('\\');
      if (parent.endsWith(':')) parent += '\\';
      this.navegarA(parent);
    }
  }

  public async abrirCarpeta(item: ItemDirectorio): Promise<void> {
    if (item.es_directorio) {
      await this.navegarA(item.ruta_completa);
    }
  }

  public seleccionarActual(): void {
    if (this.currentPath) {
      this.selected.emit(this.currentPath);
      this.cerrar();
    }
  }

  public toggleCrearCarpeta(): void {
    this.modoCrearCarpeta = !this.modoCrearCarpeta;
    this.nuevoNombre = '';
  }

  public async confirmarCrearCarpeta(): Promise<void> {
    if (!this.nuevoNombre.trim()) return;
    try {
      await this.tauriService.crearCarpeta(this.currentPath, this.nuevoNombre.trim());
      this.modoCrearCarpeta = false;
      this.nuevoNombre = '';
      await this.navegarA(this.currentPath);
    } catch (err: any) {
      this.errorMsg = 'Error al crear: ' + (err?.message || err);
    }
  }

  public cerrar(): void {
    this.close.emit();
  }
}
