import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { DownloadService } from './services/download.service';
import { TauriService } from './services/tauri.service';
import { I18nService } from './services/i18n.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  public activeView: 'descargas' | 'dashboard' | 'ajustes' = 'dashboard';
  public isAppReady: boolean = false;
  public isNewModalOpen: boolean = false;
  public isDetailModalOpen: boolean = false;
  public selectedDetailTaskId: string | null = null;
  public isAboutModalOpen: boolean = false;

  // Modales de Confirmación Animados
  public isConfirmModalOpen: boolean = false;
  public confirmModalType: 'eliminar' | 'salir' = 'eliminar';
  public confirmDeleteCount: number = 1;
  public isTourOpen: boolean = false;

  // Panel Flotante de Bandeja / Tareas de Windows
  public isTrayPanelOpen: boolean = false;
  public isStandaloneMode: boolean = false;
  public isTrayMode: boolean = false;

  // Menú Contextual Personalizado
  public isContextMenuOpen: boolean = false;
  public contextMenuX: number = 0;
  public contextMenuY: number = 0;
  public contextMenuItem: any = null;

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService,
    private tauriService: TauriService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'tray') {
      this.isTrayMode = true;
      this.isAppReady = true;
      document.body.classList.add('tray-mode');
      const savedTheme = localStorage.getItem('andromeda_theme') || 'dark';
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.downloadService.settings$.subscribe(cfg => {
        if (cfg && cfg.tema) {
          const t = this.downloadService.resolverTemaEfectivo(cfg.tema);
          document.documentElement.setAttribute('data-theme', t);
        }
      });
      return;
    }

    if (!this.isAppReady) {
      this.tauriService.setSplashMode().catch(() => {});
    }

    // Cerrar cualquier menú contextual abierto al hacer clic en cualquier lugar
    window.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.isContextMenuOpen) {
        const inside = (e.target as HTMLElement)?.closest?.('.context-menu-wrapper');
        if (!inside) {
          this.closeContextMenu();
          this.cdr.detectChanges();
        }
      }
    }, true);

    this.downloadService.activeViewObservable.subscribe(v => {
      this.activeView = v;
    });

    this.i18n.language$.subscribe(lang => {
      try {
        this.tauriService.invoke('actualizar_menu_tray', { idioma: lang });
      } catch(e) {}
    });

    this.downloadService.deleteConfirmObservable.subscribe(count => {
      this.confirmDeleteCount = count;
      this.confirmModalType = 'eliminar';
      this.isConfirmModalOpen = true;
    });

    this.downloadService.exitConfirmObservable.subscribe(() => {
      this.confirmModalType = 'salir';
      this.isConfirmModalOpen = true;
    });

    this.downloadService.tourRequestedObservable.subscribe(() => {
      this.isTourOpen = true;
    });

    this.downloadService.newModalObservable.subscribe(open => {
      this.isNewModalOpen = open;
    });

    this.downloadService.trayPanelObservable.subscribe(open => {
      this.isTrayPanelOpen = open;
    });

    // Escuchar eventos desde la bandeja del sistema de Windows y la extensión web
    const procesarDescargaEntrante = async (p?: { url?: string; nombre?: string }, standalone: boolean = false) => {
      const url = (p?.url || '').trim();
      const nombre = p?.nombre || '';
      if (standalone) {
        this.isStandaloneMode = true;
      }
      const isPl = url.includes('list=') || url.includes('playlist');
      if (isPl) {
        this.downloadService.mostrarToast('🎬 Lista de Reproducción Detectada', 'Analizando videos y metadatos de la lista...', 'info');
        try {
          const res = await this.downloadService.sondearPlaylist(url);
          if (res && res.ok && res.items && res.items.length > 0) {
            this.downloadService.triggerLoteModal(true, res);
            return;
          }
        } catch (e) {
          console.warn('Error al sondear playlist entrante:', e);
        }
      }
      this.downloadService.triggerNuevaDescargaModal(true, url, nombre);
    };

    this.tauriService.listen<{ url?: string; nombre?: string }>('abrir_nueva_descarga', (event) => {
      procesarDescargaEntrante(event?.payload, false);
    });

    this.tauriService.listen<{ url?: string; nombre?: string }>('abrir_nueva_descarga_standalone', (event) => {
      procesarDescargaEntrante(event?.payload, true);
    });

    this.tauriService.listen('toggle_tray_panel', () => {
      this.isTrayPanelOpen = true;
    });

    this.tauriService.listen('abrir_ajustes', () => {
      this.downloadService.setView('ajustes');
    });

    this.tauriService.listen('abrir_guia', () => {
      this.isTourOpen = true;
    });

    this.tauriService.listen('abrir_acerca_de', () => {
      this.isAboutModalOpen = true;
    });

    this.tauriService.listen('abrir_panel', () => {
      this.downloadService.setView('descargas');
    });
  }

  public contextMenuTargetInput: HTMLInputElement | HTMLTextAreaElement | null = null;

  @HostListener('window:contextmenu', ['$event'])
  public onGlobalContextMenu(e: MouseEvent): void {
    const target = e.target as HTMLElement;

    // Si el usuario hace clic derecho sobre un input o textarea,
    // mostrar el menú contextual personalizado de Andromeda para inputs (Cortar, Copiar, Pegar, etc.)
    const inputTarget = target.closest('input, textarea') as HTMLInputElement | HTMLTextAreaElement;
    if (inputTarget) {
      e.preventDefault();
      this.contextMenuTargetInput = inputTarget;
      this.contextMenuItem = null;
      const menuWidth = 240;
      const menuHeight = 270;
      this.contextMenuX = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
      this.contextMenuY = Math.min(e.clientY, window.innerHeight - menuHeight - 12);
      this.isContextMenuOpen = true;
      return;
    }

    e.preventDefault();
    this.contextMenuTargetInput = null;

    const downloadRow = target.closest('[data-download-id]') as HTMLElement;

    if (downloadRow) {
      const id = downloadRow.getAttribute('data-download-id');
      const items = this.downloadService.getCurrentDownloads();
      this.contextMenuItem = items.find(d => d.id === id) || null;
      if (id) {
        this.downloadService.setSelectedIds(new Set([id]));
      }
    } else {
      this.contextMenuItem = null;
    }

    const menuWidth = 270;
    const menuHeight = this.contextMenuItem ? 390 : 350;
    this.contextMenuX = Math.min(e.clientX, window.innerWidth - menuWidth - 12);
    this.contextMenuY = Math.min(e.clientY, window.innerHeight - menuHeight - 12);
    this.isContextMenuOpen = true;
  }

  @HostListener('window:click', ['$event'])
  public onWindowClick(e: MouseEvent): void {
    if (this.isContextMenuOpen) {
      this.closeContextMenu();
    }
  }

  @HostListener('window:keydown', ['$event'])
  public onWindowKeydown(e: KeyboardEvent): void {
    // 1. Bloquear búsqueda nativa del navegador (Ctrl+F, F3) y comandos no deseados (Ctrl+P, Ctrl+U)
    if (
      ((e.ctrlKey || e.metaKey) && ['f', 'F', 'p', 'P', 'u', 'U'].includes(e.key)) ||
      e.key === 'F3'
    ) {
      e.preventDefault();
      return;
    }

    // 2. Atajo Ctrl + N: Abrir modal de Nueva Descarga
    if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      this.openNewModal();
      return;
    }

    // 3. Atajo Ctrl + A: Seleccionar todas las descargas de la tabla (si no está en un campo de texto)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
      if (!isInput) {
        e.preventDefault();
        const allIds = this.downloadService.getCurrentDownloads().map(d => d.id);
        this.downloadService.setSelectedIds(new Set(allIds));
        return;
      }
    }

    // 4. Atajo Supr / Delete: Eliminar descargas seleccionadas (si no está editando texto)
    if (e.key === 'Delete' || e.key === 'Del') {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
      if (!isInput) {
        if (this.downloadService.getSelectedIds().size > 0) {
          e.preventDefault();
          this.downloadService.solicitarConfirmacionEliminar();
          return;
        }
      }
    }
  }

  public closeContextMenu(): void {
    this.isContextMenuOpen = false;
    this.contextMenuItem = null;
    this.contextMenuTargetInput = null;
  }

  public closeTour(): void {
    this.isTourOpen = false;
  }

  public async onSplashFinished(): Promise<void> {
    this.isAppReady = true;
    this.cdr.detectChanges();
    try {
      await this.tauriService.setMainMode();
    } catch (e) {
      console.warn('setMainMode error:', e);
    }
    // Toast de bienvenida al entrar al Dashboard
    setTimeout(() => {
      this.downloadService.showToast(
        'info', 
        this.i18n.t('toast_bienvenida_titulo') || 'Andromeda Download Suite', 
        this.i18n.t('toast_bienvenida_msg') || 'Motor Tokio de 32 sockets activo y conectado'
      );
    }, 450);
  }

  public async onConfirmAction(result: { deleteFromDisk: boolean; action?: 'salir' | 'minimizar' }): Promise<void> {
    this.isConfirmModalOpen = false;
    if (this.confirmModalType === 'eliminar') {
      await this.downloadService.eliminar(undefined, result.deleteFromDisk);
    } else if (this.confirmModalType === 'salir') {
      if (result.action === 'minimizar') {
        await this.tauriService.minimizeWindow();
      } else {
        await this.tauriService.closeWindow();
      }
    }
  }

  public closeConfirmModal(): void {
    this.isConfirmModalOpen = false;
  }

  public openNewModal(): void {
    this.isNewModalOpen = true;
  }

  public closeNewModal(): void { this.isNewModalOpen = false; if (this.isStandaloneMode) { this.isStandaloneMode = false; try { (window as any).__TAURI__?.window?.getCurrentWindow()?.hide(); } catch(e){} } }

  public openDetailModal(id: string): void {
    this.selectedDetailTaskId = id;
    this.isDetailModalOpen = true;
  }

  public closeDetailModal(): void {
    this.isDetailModalOpen = false;
    this.selectedDetailTaskId = null;
  }

  public openAboutModal(): void {
    this.isAboutModalOpen = true;
  }

  public closeAboutModal(): void {
    this.isAboutModalOpen = false;
  }

  @HostListener('window:blur')
  public onWindowBlur(): void {
    if (this.isTrayMode) {
      this.cerrarTrayWindow();
    }
  }

  public cerrarTrayWindow(): void {
    this.downloadService.cerrarTrayFlyout();
  }
}
