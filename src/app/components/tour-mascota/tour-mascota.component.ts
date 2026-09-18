import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, HostListener, ChangeDetectorRef } from '@angular/core';
import { I18nService } from '../../services/i18n.service';
import { DownloadService } from '../../services/download.service';

export interface HotspotGuide {
  id: string;
  selector: string;
  categoria: string;
  titulo: string;
  descripcion: string;
  tip: string;
  vista: 'dashboard' | 'descargas' | 'ajustes';
  iconType: 'menu' | 'speed' | 'roi' | 'sockets' | 'chart' | 'matrix' | 'new' | 'table' | 'actions';
}

@Component({
  selector: 'app-tour-mascota',
  templateUrl: './tour-mascota.component.html',
  styleUrls: ['./tour-mascota.component.css']
})
export class TourMascotaComponent implements OnInit, OnDestroy, OnChanges {
  @Input() visible: boolean = false;
  @Output() close: EventEmitter<void> = new EventEmitter<void>();

  public currentStepIndex: number = 0;
  public spotlightRect: { top: number; left: number; width: number; height: number } | null = null;
  public cardPos: { top: number; left: number } = { top: 200, left: 300 };

  public hotspots: HotspotGuide[] = [
    {
      id: 'nav-dashboard',
      selector: '[data-tour="nav-dashboard"]',
      categoria: 'MENÚ PRINCIPAL',
      titulo: 'Panel de Control',
      descripcion: 'Centro neurálgico de telemetría, métricas de red en tiempo real y visualización de throughput.',
      tip: 'Monitoreo de throughput y sockets Tokio en vivo.',
      vista: 'dashboard',
      iconType: 'menu'
    },
    {
      id: 'nav-todas',
      selector: '[data-tour="nav-todas"]',
      categoria: 'ESTADO',
      titulo: 'Todas las Descargas',
      descripcion: 'Visualiza la lista global de descargas activas, pausadas, programadas y completadas.',
      tip: 'Gestión unificada con selección múltiple y columnas redimensionables.',
      vista: 'descargas',
      iconType: 'table'
    },
    {
      id: 'nav-progreso',
      selector: '[data-tour="nav-progreso"]',
      categoria: 'ESTADO',
      titulo: 'En Progreso',
      descripcion: 'Filtra las transferencias que se están descargando activamente a máxima velocidad.',
      tip: 'Monitorea el porcentaje y la tasa de transferencia en tiempo real.',
      vista: 'descargas',
      iconType: 'speed'
    },
    {
      id: 'nav-completadas',
      selector: '[data-tour="nav-completadas"]',
      categoria: 'ESTADO',
      titulo: 'Completadas',
      descripcion: 'Historial de descargas finalizadas con verificación de integridad de archivos.',
      tip: 'Abre la carpeta contenedora o ejecuta el archivo directamente.',
      vista: 'descargas',
      iconType: 'table'
    },
    {
      id: 'nav-pausadas',
      selector: '[data-tour="nav-pausadas"]',
      categoria: 'ESTADO',
      titulo: 'Pausadas & Detenidas',
      descripcion: 'Archivos en espera de reanudación que conservan los fragmentos ya descargados.',
      tip: 'Reanuda tus descargas en cualquier momento con un clic.',
      vista: 'descargas',
      iconType: 'actions'
    },
    {
      id: 'nav-programadas',
      selector: '[data-tour="nav-programadas"]',
      categoria: 'ESTADO',
      titulo: 'Programadas & En Cola',
      descripcion: 'Tareas programadas o en cola que se inician automáticamente en orden secuencial.',
      tip: 'Respeta el número máximo de descargas simultáneas configurado.',
      vista: 'descargas',
      iconType: 'actions'
    },
    {
      id: 'nav-fallidas',
      selector: '[data-tour="nav-fallidas"]',
      categoria: 'ESTADO',
      titulo: 'Fallidas',
      descripcion: 'Registro de transferencias con error por caída de red o enlace caducado.',
      tip: 'Reintenta la conexión instantáneamente desde el menú contextual.',
      vista: 'descargas',
      iconType: 'actions'
    },
    {
      id: 'nav-categorias',
      selector: '[data-tour="nav-categorias"]',
      categoria: 'CATEGORÍAS',
      titulo: 'Categorías Automáticas',
      descripcion: 'Clasificación organizada: Comprimidos, Videos, Música, Documentos, Programas y Otros.',
      tip: 'Organización automática según la extensión del archivo.',
      vista: 'descargas',
      iconType: 'menu'
    },
    {
      id: 'nav-ajustes',
      selector: '[data-tour="nav-ajustes"]',
      categoria: 'SISTEMA',
      titulo: 'Configuración del Sistema',
      descripcion: 'Ajusta el tema visual, idioma, conexiones simultáneas por archivo y carpeta de destino.',
      tip: 'Preferencias guardadas automáticamente en disco.',
      vista: 'ajustes',
      iconType: 'actions'
    },
    {
      id: 'nav-about',
      selector: '[data-tour="nav-about"]',
      categoria: 'SISTEMA',
      titulo: 'Acerca de Andromeda',
      descripcion: 'Información sobre la suite de aceleración, arquitectura nativa y versión del sistema.',
      tip: 'Motor nativo Tokio Zero-Copy de alto rendimiento.',
      vista: 'dashboard',
      iconType: 'menu'
    },
    {
      id: 'nav-salir',
      selector: '[data-tour="nav-salir"]',
      categoria: 'SISTEMA',
      titulo: 'Salir o Minimizar',
      descripcion: 'Cierra la aplicación o minimízala a la bandeja de Windows para continuar descargas en segundo plano.',
      tip: 'Soporte de segundo plano continuo.',
      vista: 'dashboard',
      iconType: 'actions'
    },
    {
      id: 'kpi-roi',
      selector: '[data-tour="kpi-roi"]',
      categoria: 'DASHBOARD',
      titulo: 'Tiempo Recuperado (ROI)',
      descripcion: 'Compara la velocidad alcanzada frente a la tasa estándar de un navegador y contabiliza el tiempo ahorrado.',
      tip: 'Aceleración multi-segmento inteligente por fragmentos.',
      vista: 'dashboard',
      iconType: 'roi'
    },
    {
      id: 'kpi-throughput',
      selector: '[data-tour="kpi-throughput"]',
      categoria: 'DASHBOARD',
      titulo: 'Ancho de Banda Actual',
      descripcion: 'Muestra el caudal de datos combinado en MB/s en todos los canales activos junto con el pico alcanzado.',
      tip: 'Muestreo en tiempo real cada 500 ms con alta precisión.',
      vista: 'dashboard',
      iconType: 'speed'
    },
    {
      id: 'kpi-sockets',
      selector: '[data-tour="kpi-sockets"]',
      categoria: 'DASHBOARD',
      titulo: 'Sockets Activos',
      descripcion: 'Indica la cantidad de conexiones paralelas concurrentes negociadas para maximizar el ancho de banda.',
      tip: 'Balanceo dinámico por fragmento de descarga.',
      vista: 'dashboard',
      iconType: 'sockets'
    },
    {
      id: 'chart-bezier',
      selector: '[data-tour="chart-bezier"]',
      categoria: 'GRÁFICO',
      titulo: 'Historial de Rendimiento (60 Seg)',
      descripcion: 'Gráfica visual con interpolación Bézier que compara el rendimiento continuo de Andromeda frente a un navegador convencional.',
      tip: 'Telemetría gráfica continua con suavizado en tiempo real.',
      vista: 'dashboard',
      iconType: 'chart'
    },
    {
      id: 'matrix-sockets',
      selector: '[data-tour="matrix-sockets"]',
      categoria: 'GRÁFICO',
      titulo: 'Matriz de 32 Sockets',
      descripcion: 'Rejilla visual de 32 canales: cada celda representa un socket en transferencia activa, conectando o en espera.',
      tip: 'Verde = Activo, Cian = Conectando, Gris = En espera.',
      vista: 'dashboard',
      iconType: 'matrix'
    },
    {
      id: 'new-btn',
      selector: '[data-tour="new-btn"]',
      categoria: 'HERRAMIENTA',
      titulo: 'Crear Nueva Descarga',
      descripcion: 'Pega enlaces web directos o videos multimedia. Detecta automáticamente título, calidades y formatos.',
      tip: 'Resolución de enlaces ultrarrápida sin esperas.',
      vista: 'descargas',
      iconType: 'new'
    },
    {
      id: 'downloads-table',
      selector: '[data-tour="downloads-table"]',
      categoria: 'TABLA',
      titulo: 'Gestor de Archivos y Cola',
      descripcion: 'Lista interactiva con selección múltiple, cabeceras redimensionables estilo Excel y menú contextual con clic derecho.',
      tip: 'Soporte completo de pausa, reanudación y apertura directa.',
      vista: 'descargas',
      iconType: 'table'
    },
    {
      id: 'toolbar-actions',
      selector: '[data-tour="toolbar-actions"]',
      categoria: 'ACCIONES',
      titulo: 'Barra de Control en Lote',
      descripcion: 'Permite pausar, reanudar o eliminar las descargas seleccionadas de manera simultánea con confirmación visual segura.',
      tip: 'Control unificado e idempotente de descargas.',
      vista: 'descargas',
      iconType: 'actions'
    }
  ];

  private animFrameId: number | null = null;

  constructor(
    public i18n: I18nService,
    private downloadService: DownloadService,
    private cdr: ChangeDetectorRef
  ) {}

  public get currentHotspot(): HotspotGuide {
    return this.hotspots[this.currentStepIndex] || this.hotspots[0];
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']) {
      if (this.visible) {
        this.currentStepIndex = 0;
        this.aplicarPasoActual();
      } else {
        this.spotlightRect = null;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  @HostListener('window:keydown', ['$event'])
  public onKeyDown(e: KeyboardEvent): void {
    if (!this.visible) return;
    if (e.key === 'Escape') {
      this.finalizar();
    } else if (e.key === 'ArrowRight') {
      this.siguiente();
    } else if (e.key === 'ArrowLeft') {
      this.anterior();
    }
  }

  @HostListener('window:mousemove', ['$event'])
  public onMouseMove(e: MouseEvent): void {
    if (!this.visible) return;
    const target = e.target as HTMLElement;
    if (!target) return;

    // Detectar si el usuario está pasando el ratón sobre un elemento inspeccionable
    for (let i = 0; i < this.hotspots.length; i++) {
      const h = this.hotspots[i];
      if (target.closest(h.selector)) {
        if (this.currentStepIndex !== i) {
          this.currentStepIndex = i;
          this.recalcularPosiciones();
          this.cdr.detectChanges();
        }
        break;
      }
    }
  }

  public siguiente(): void {
    if (this.currentStepIndex < this.hotspots.length - 1) {
      this.currentStepIndex++;
      this.aplicarPasoActual();
    } else {
      this.finalizar();
    }
  }

  public anterior(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.aplicarPasoActual();
    }
  }

  public irAPaso(index: number): void {
    if (index >= 0 && index < this.hotspots.length) {
      this.currentStepIndex = index;
      this.aplicarPasoActual();
    }
  }

  private aplicarPasoActual(): void {
    const h = this.currentHotspot;
    if (h && h.vista) {
      this.downloadService.setView(h.vista);
    }
    setTimeout(() => {
      this.recalcularPosiciones();
      this.cdr.detectChanges();
    }, 180);
  }

  public recalcularPosiciones(): void {
    const h = this.currentHotspot;
    if (!h) return;

    const el = document.querySelector(h.selector) as HTMLElement;
    if (!el) {
      // Si el elemento aún no está en el DOM, centrar la tarjeta
      this.spotlightRect = null;
      this.cardPos = {
        top: Math.max(100, Math.round(window.innerHeight / 2 - 160)),
        left: Math.max(20, Math.round(window.innerWidth / 2 - 190))
      };
      return;
    }

    const rect = el.getBoundingClientRect();
    this.spotlightRect = {
      top: Math.max(0, Math.round(rect.top - 6)),
      left: Math.max(0, Math.round(rect.left - 6)),
      width: Math.round(rect.width + 12),
      height: Math.round(rect.height + 12)
    };

    const cardWidth = 380;
    const cardHeight = 240;
    const margin = 18;

    let targetLeft = rect.right + margin;
    let targetTop = rect.top;

    // Si desborda por la derecha, colocar a la izquierda
    if (targetLeft + cardWidth > window.innerWidth - 20) {
      targetLeft = rect.left - cardWidth - margin;
    }

    // Si también desborda por la izquierda, colocar abajo o centrar
    if (targetLeft < 20) {
      targetLeft = Math.max(20, Math.min(window.innerWidth - cardWidth - 20, rect.left));
      targetTop = rect.bottom + margin;
    }

    // Si desborda por abajo, desplazar hacia arriba
    if (targetTop + cardHeight > window.innerHeight - 20) {
      targetTop = Math.max(70, window.innerHeight - cardHeight - 20);
    }

    // Evitar solapar con el banner superior (70px de margen superior)
    if (targetTop < 75) {
      targetTop = 75;
    }

    this.cardPos = {
      top: Math.round(targetTop),
      left: Math.round(targetLeft)
    };
  }

  public finalizar(): void {
    this.currentStepIndex = 0;
    this.spotlightRect = null;
    this.close.emit();
  }
}
