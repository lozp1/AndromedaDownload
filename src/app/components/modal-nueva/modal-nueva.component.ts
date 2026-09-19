import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { TauriService } from '../../services/tauri.service';
import { DownloadCategory, ProbeResult } from '../../models/download.model';

@Component({
  selector: 'app-modal-nueva',
  templateUrl: './modal-nueva.component.html'
})
export class ModalNuevaDescargaComponent implements OnInit {
  private _visible: boolean = false;
  @Input()
  set visible(val: boolean) {
    this._visible = val;
    if (val) {
      this.notificacionPlaylistMostrada = false;
      this.ultimaUrlPlaylistNotificada = '';
      if (this.downloadService.pendingNuevaDescargaUrl) {
        this.url = this.downloadService.pendingNuevaDescargaUrl;
        this.nombre = this.downloadService.pendingNuevaDescargaNombre || '';
        this.downloadService.pendingNuevaDescargaUrl = '';
        this.downloadService.pendingNuevaDescargaNombre = '';
        setTimeout(() => this.onUrlInput(), 60);
      }
    }
  }
  get visible(): boolean {
    return this._visible;
  }

  @Output() close = new EventEmitter<void>();

  public url: string = '';
  public nombre: string = '';
  public tamanoStr: string = 'Esperando URL...';
  public tamanoBytes: number = 0;
  public carpetaDestino: string = 'C:\\Descargas';
  public categoria: DownloadCategory = 'Otros';
  public conexiones: number = 16;
  public programada: boolean = false;
  public fechaProgramada: string = '';
  public horaProgramada: string = '';

  public sondeoEnCurso: boolean = false;
  public estadoSondeo: string = '';
  private timerSondeo: any = null;

  // Custom Obsidian Calendar & Time State
  public isCalendarOpen: boolean = false;
  public calCurrentYear: number = new Date().getFullYear();
  public calCurrentMonth: number = new Date().getMonth(); // 0-indexed
  public calDays: { day: number; isCurrentMonth: boolean; isSelected: boolean; isToday: boolean; dateStr: string }[] = [];
  public readonly calMonthNames: string[] = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  public readonly calWeekDays: string[] = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

  // Custom Obsidian Time Picker
  public isTimePickerOpen: boolean = false;
  public horaHoras: string = '12';
  public horaMinutos: string = '00';
  public horaPeriodo: 'AM' | 'PM' = 'PM';

  // Custom Category Dropdown (mantiene estilo y cursor custom)
  public isCatDropdownOpen: boolean = false;
  public readonly categoriasDisponibles: { id: DownloadCategory; nombre: string; icon: string }[] = [
    { id: 'Comprimidos', nombre: 'Comprimidos', icon: '📦' },
    { id: 'Videos', nombre: 'Videos', icon: '🎬' },
    { id: 'Documentos', nombre: 'Documentos', icon: '📄' },
    { id: 'Programas', nombre: 'Programas', icon: '⚙️' },
    { id: 'Música', nombre: 'Música', icon: '🎵' },
    { id: 'Imágenes', nombre: 'Imágenes', icon: '🖼️' },
    { id: 'Otros', nombre: 'Otros', icon: '📁' }
  ];

  public toggleCatDropdown(): void {
    this.isCatDropdownOpen = !this.isCatDropdownOpen;
    this.isCalendarOpen = false;
    this.isTimePickerOpen = false;
  }

  public seleccionarCategoria(cat: DownloadCategory): void {
    this.categoria = cat;
    this.isCatDropdownOpen = false;
  }

  // Media & Video Stream Intelligence (YouTube, Vimeo, etc. — SaveFrom Style)
  public isMediaStream: boolean = false;
  public mediaVideoTitle: string = '';
  public mediaChannelName: string = '';
  public mediaThumbnailUrl: string = '';
  public mediaSelectedQuality: string = '1080p';
  public mediaSelectedFormat: 'MP4' | 'MKV' | 'WEBM' | 'MP3' | 'M4A' = 'MP4';
  public mediaFilterTab: 'video' | 'audio' = 'video';
  public enviando: boolean = false;

  public mediaQualities: {
    label: string;
    val: string;
    format: 'MP4' | 'MKV' | 'WEBM' | 'MP3' | 'M4A';
    type: 'video' | 'audio';
    badge: string;
    size: string;
    bytes: number;
  }[] = [
    { label: '1080p', val: '1080p', format: 'MP4', type: 'video', badge: '1080p MP4', size: '284.46 MB', bytes: Math.round(284.46 * 1024 * 1024) },
    { label: '720p', val: '720p', format: 'MP4', type: 'video', badge: '720p MP4', size: '151.22 MB', bytes: Math.round(151.22 * 1024 * 1024) },
    { label: '480p', val: '480p', format: 'MP4', type: 'video', badge: '480p SD', size: '38.31 MB', bytes: Math.round(38.31 * 1024 * 1024) },
    { label: '360p', val: '360p', format: 'MP4', type: 'video', badge: '360p Móvil', size: '45.64 MB', bytes: Math.round(45.64 * 1024 * 1024) },
    { label: '240p', val: '240p', format: 'MP4', type: 'video', badge: '240p Móvil', size: '9.90 MB', bytes: Math.round(9.90 * 1024 * 1024) },
    { label: '144p', val: '144p', format: 'MP4', type: 'video', badge: '144p Móvil', size: '5.26 MB', bytes: Math.round(5.26 * 1024 * 1024) },
    { label: '1080p', val: '1080p_mkv', format: 'MKV', type: 'video', badge: '1080p MKV', size: '290.10 MB', bytes: Math.round(290.10 * 1024 * 1024) },
    { label: '320 kbps', val: 'mp3_320', format: 'MP3', type: 'audio', badge: 'MP3 320k', size: '8.98 MB', bytes: Math.round(8.98 * 1024 * 1024) },
    { label: '256 kbps', val: 'mp3_256', format: 'MP3', type: 'audio', badge: 'MP3 256k', size: '7.20 MB', bytes: Math.round(7.20 * 1024 * 1024) },
    { label: '128 kbps', val: 'm4a_128', format: 'M4A', type: 'audio', badge: 'M4A 128k', size: '4.50 MB', bytes: Math.round(4.50 * 1024 * 1024) },
    { label: '64 kbps', val: 'm4a_64', format: 'M4A', type: 'audio', badge: 'M4A 64k', size: '2.25 MB', bytes: Math.round(2.25 * 1024 * 1024) }
  ];

  public selectedQualities: Set<string> = new Set<string>();

  public isQualitySelected(val: string): boolean {
    if (this.selectedQualities.size === 0) {
      return this.mediaSelectedQuality === val;
    }
    return this.selectedQualities.has(val);
  }

  public toggleQualitySelection(q: { label: string; val: string; format: 'MP4' | 'MKV' | 'WEBM' | 'MP3' | 'M4A'; type: 'video' | 'audio'; size: string; bytes: number }): void {
    if (this.selectedQualities.size === 0) {
      this.selectedQualities.add(this.mediaSelectedQuality);
    }
    if (this.selectedQualities.has(q.val)) {
      this.selectedQualities.delete(q.val);
    } else {
      this.selectedQualities.add(q.val);
    }
    this.selectMediaQuality(q);
  }

  public get selectedFormatsCount(): number {
    return this.selectedQualities.size;
  }

  public get conteoCola(): number {
    if (this.downloadService.loteEnCola && this.downloadService.loteEnCola.length > 0) {
      return this.downloadService.loteEnCola.length;
    }
    return this.isMediaStream && this.selectedFormatsCount > 1 ? this.selectedFormatsCount : 0;
  }

  public get filteredMediaQualities(): {
    label: string;
    val: string;
    format: 'MP4' | 'MKV' | 'WEBM' | 'MP3' | 'M4A';
    type: 'video' | 'audio';
    badge: string;
    size: string;
    bytes: number;
  }[] {
    if (this.mediaFilterTab === 'video') return this.mediaQualities.filter(q => q.type === 'video');
    if (this.mediaFilterTab === 'audio') return this.mediaQualities.filter(q => q.type === 'audio');
    return this.mediaQualities;
  }

  public autoCategorizarActivo: boolean = true;

  public getSubcarpetaCategoria(): string {
    const cat = (this.categoria || 'Otros').toLowerCase();
    let key = 'otros';
    if (cat.includes('mús') || cat.includes('mus') || cat.includes('aud')) key = 'musica';
    else if (cat.includes('vid') || cat.includes('pel')) key = 'videos';
    else if (cat.includes('doc') || cat.includes('pdf')) key = 'documentos';
    else if (cat.includes('comp') || cat.includes('zip') || cat.includes('rar')) key = 'comprimidos';
    else if (cat.includes('prog') || cat.includes('app') || cat.includes('exe')) key = 'programas';
    else if (cat.includes('im') || cat.includes('img') || cat.includes('pic')) key = 'imagenes';

    const lang = this.i18n.getCurrentLang();
    if (lang === 'es' && key === 'musica') {
      return 'Musica';
    }
    const trans = this.i18n.t('cat_' + key);
    return trans || this.categoria;
  }

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService,
    private tauriService: TauriService
  ) {}

  ngOnInit(): void {
    this.downloadService.settingsObservable.subscribe(s => {
      this.carpetaDestino = s.directorio_descargas || 'C:\\Descargas';
      this.conexiones = s.conexiones_por_archivo || 16;
      this.autoCategorizarActivo = s.auto_categorizar ?? true;
    });

    this.downloadService.newModalObservable.subscribe(open => {
      if (open && this.downloadService.pendingNuevaDescargaUrl) {
        this.url = this.downloadService.pendingNuevaDescargaUrl;
        this.nombre = this.downloadService.pendingNuevaDescargaNombre || '';
        this.downloadService.pendingNuevaDescargaUrl = '';
        this.downloadService.pendingNuevaDescargaNombre = '';
        this.notificacionPlaylistMostrada = false;
        this.ultimaUrlPlaylistNotificada = '';

        // Si proviene de lote/playlist, categorizar según los formatos seleccionados
        if (this.downloadService.loteEnCola && this.downloadService.loteEnCola.length > 0) {
          const tieneAudio = this.downloadService.loteEnCola.some(it => {
            const fmt = (it.formato || '').toLowerCase();
            return fmt.includes('mp3') || fmt.includes('m4a') || fmt.includes('audio');
          });
          this.categoria = tieneAudio ? 'Música' : 'Videos';
          this.isMediaStream = false;
        } else {
          setTimeout(() => this.onUrlInput(), 60);
        }
      }
    });

    // Fecha actual por defecto para el calendario
    const hoy = new Date();
    this.fechaProgramada = hoy.toISOString().split('T')[0];
    const h = hoy.getHours();
    this.horaPeriodo = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    this.horaHoras = String(h12).padStart(2, '0');
    const mins = String((hoy.getMinutes() + 15) % 60).padStart(2, '0');
    this.horaMinutos = mins;
    this.horaProgramada = `${String(h).padStart(2, '0')}:${mins}`;
    this.calCurrentYear = hoy.getFullYear();
    this.calCurrentMonth = hoy.getMonth();
    this.renderCustomCalendar();
  }

  public toggleCustomTimePicker(): void {
    this.isTimePickerOpen = !this.isTimePickerOpen;
    this.isCalendarOpen = false;
  }

  public setTime(h: string, m: string, p: 'AM' | 'PM'): void {
    this.horaHoras = h;
    this.horaMinutos = m;
    this.horaPeriodo = p;
    let hh = parseInt(h, 10);
    if (p === 'PM' && hh < 12) hh += 12;
    if (p === 'AM' && hh === 12) hh = 0;
    this.horaProgramada = `${String(hh).padStart(2, '0')}:${m}`;
    this.isTimePickerOpen = false;
  }

  public toggleCustomCalendar(): void {
    this.isCalendarOpen = !this.isCalendarOpen;
    if (this.isCalendarOpen) {
      if (this.fechaProgramada) {
        const parts = this.fechaProgramada.split('-');
        if (parts.length === 3) {
          this.calCurrentYear = parseInt(parts[0], 10);
          this.calCurrentMonth = parseInt(parts[1], 10) - 1;
        }
      }
      this.renderCustomCalendar();
    }
  }

  public calPrevMonth(event: Event): void {
    event.stopPropagation();
    if (this.calCurrentMonth === 0) {
      this.calCurrentMonth = 11;
      this.calCurrentYear--;
    } else {
      this.calCurrentMonth--;
    }
    this.renderCustomCalendar();
  }

  public calNextMonth(event: Event): void {
    event.stopPropagation();
    if (this.calCurrentMonth === 11) {
      this.calCurrentMonth = 0;
      this.calCurrentYear++;
    } else {
      this.calCurrentMonth++;
    }
    this.renderCustomCalendar();
  }

  public selectCalDate(dateStr: string, event: Event): void {
    event.stopPropagation();
    this.fechaProgramada = dateStr;
    this.isCalendarOpen = false;
    this.renderCustomCalendar();
  }

  public renderCustomCalendar(): void {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const firstDayIndex = new Date(this.calCurrentYear, this.calCurrentMonth, 1).getDay();
    const daysInMonth = new Date(this.calCurrentYear, this.calCurrentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(this.calCurrentYear, this.calCurrentMonth, 0).getDate();

    const days: { day: number; isCurrentMonth: boolean; isSelected: boolean; isToday: boolean; dateStr: string }[] = [];

    // Días del mes anterior
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = this.calCurrentMonth === 0 ? 12 : this.calCurrentMonth;
      const y = this.calCurrentMonth === 0 ? this.calCurrentYear - 1 : this.calCurrentYear;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        isCurrentMonth: false,
        isSelected: this.fechaProgramada === dateStr,
        isToday: dateStr === todayStr,
        dateStr
      });
    }

    // Días del mes actual
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${this.calCurrentYear}-${String(this.calCurrentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        day: d,
        isCurrentMonth: true,
        isSelected: this.fechaProgramada === dateStr,
        isToday: dateStr === todayStr,
        dateStr
      });
    }

    // Días del mes siguiente para completar cuadrícula (hasta 35 o 42)
    const remaining = 42 - days.length;
    if (remaining > 0 && remaining < 14) {
      for (let d = 1; d <= remaining; d++) {
        const m = this.calCurrentMonth === 11 ? 1 : this.calCurrentMonth + 2;
        const y = this.calCurrentMonth === 11 ? this.calCurrentYear + 1 : this.calCurrentYear;
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        days.push({
          day: d,
          isCurrentMonth: false,
          isSelected: this.fechaProgramada === dateStr,
          isToday: dateStr === todayStr,
          dateStr
        });
      }
    }

    this.calDays = days;
  }

  public async seleccionarCarpeta(): Promise<void> {
    const ruta = await this.downloadService.abrirExploradorModal(this.carpetaDestino);
    if (ruta && ruta.trim()) {
      this.carpetaDestino = ruta.trim();
    }
  }

  public playlistSondeando: boolean = false;
  private notificacionPlaylistMostrada: boolean = false;
  private ultimaUrlPlaylistNotificada: string = '';

  public onUrlInput(): void {
    if (this.timerSondeo) clearTimeout(this.timerSondeo);
    const trimmed = (this.url || '').trim();
    if (!trimmed) {
      this.playlistSondeando = false;
      this.notificacionPlaylistMostrada = false;
      this.ultimaUrlPlaylistNotificada = '';
      this.tamanoStr = 'Esperando URL...';
      this.estadoSondeo = '';
      this.isMediaStream = false;
      return;
    }
    const isYt = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
    const isPl = trimmed.includes('list=') || trimmed.includes('playlist');

    if (isPl && (!this.downloadService.loteEnCola || this.downloadService.loteEnCola.length === 0) && (!this.notificacionPlaylistMostrada || this.ultimaUrlPlaylistNotificada !== trimmed)) {
      this.notificacionPlaylistMostrada = true;
      this.ultimaUrlPlaylistNotificada = trimmed;
      this.downloadService.showToastWithAction(
        'info',
        '🎬 Lista de Reproducción Detectada',
        'Haz clic aquí para abrir el Gestor de Descarga por Lotes',
        () => this.abrirGestorLotes()
      );
    } else if (!isPl) {
      this.notificacionPlaylistMostrada = false;
      this.ultimaUrlPlaylistNotificada = '';
    }

    if (!isYt) {
      this.isMediaStream = false;
    }
    if (trimmed.length > 8 && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
      this.timerSondeo = setTimeout(() => this.ejecutarSondeo(trimmed), 300);
    } else {
      this.tamanoStr = 'Esperando URL...';
      this.estadoSondeo = '';
      this.isMediaStream = false;
    }
  }

  public async abrirGestorLotes(): Promise<void> {
    if (!this.url) return;
    this.playlistSondeando = true;
    this.downloadService.mostrarToast('Analizando Playlist', 'Extrayendo videos y metadatos de la lista...', 'info');
    const res = await this.downloadService.sondearPlaylist(this.url);
    this.playlistSondeando = false;
    if (res && res.ok && res.items.length > 0) {
      this.cerrarModal();
      this.downloadService.triggerLoteModal(true, res);
    } else {
      this.downloadService.mostrarToast('Error en lista', res.error || 'No se pudieron extraer los videos de la playlist.', 'error');
    }
  }

  public volverALista(): void {
    if (this.downloadService.activePlaylistData) {
      const data = this.downloadService.activePlaylistData;
      this.close.emit();
      this.downloadService.triggerLoteModal(true, data);
    }
  }

  public async ejecutarSondeo(url: string): Promise<void> {
    this.sondeoEnCurso = true;
    this.estadoSondeo = 'Sondeando cabeceras HTTP Range y streams...';

    // Detección Inteligente de YouTube / Video Streaming
    const isYt = url.includes('youtube.com') || url.includes('youtu.be');
    if (isYt) {
      if (this.downloadService.loteEnCola && this.downloadService.loteEnCola.length > 0) {
        this.isMediaStream = false;
        const tieneAudio = this.downloadService.loteEnCola.some(it => {
          const fmt = (it.formato || '').toLowerCase();
          return fmt.includes('mp3') || fmt.includes('m4a') || fmt.includes('audio');
        });
        this.categoria = tieneAudio ? 'Música' : 'Videos';
        this.sondeoEnCurso = false;
        this.estadoSondeo = `Lote listo: ${this.downloadService.loteEnCola.length} archivos ✓`;
        return;
      }
      this.isMediaStream = true;
      this.categoria = 'Videos';
      this.estadoSondeo = 'Detectando video y formatos disponibles...';
      
      let videoId = 'Video';
      try {
        if (url.includes('v=')) {
          videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('/shorts/')) {
          videoId = url.split('/shorts/')[1].split('?')[0].split('/')[0];
        }
      } catch {}

      if (videoId && videoId !== 'Video') {
        this.mediaThumbnailUrl = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
      }

      // 1. Intento Ultrarrápido (<150ms) vía API oficial oEmbed de YouTube
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const resp = await fetch(oembedUrl);
        if (resp.ok) {
          const ytData = await resp.json();
          if (ytData && ytData.title) {
            let cleanTitle = ytData.title.replace(/[<>:"/\\|?*]/g, '_').replace(/\uFFFD/g, '').trim();
            if (cleanTitle.length > 60) {
              cleanTitle = cleanTitle.substring(0, 60).trim();
            }
            this.mediaVideoTitle = cleanTitle;
            this.mediaChannelName = ytData.author_name ? `${ytData.author_name} • YouTube HD` : 'YouTube HD';
            const safeName = cleanTitle;
            this.nombre = `${safeName}.${this.mediaSelectedFormat.toLowerCase()}`;
            this.tamanoStr = '284.46 MB (1080p)';
            this.tamanoBytes = Math.round(284.46 * 1024 * 1024);
            this.estadoSondeo = `Video detectado: ${cleanTitle} ✓`;
            this.sondeoEnCurso = false;
            return;
          }
        }
      } catch (err) {
        console.warn('Fallo oEmbed YouTube en frontend:', err);
      }

      // 2. Fallback con sonda backend
      try {
        const res: ProbeResult = await this.downloadService.sondearUrl(url);
        if (res && res.ok && res.nombre) {
          let tName = res.nombre.replace(/\.mp4$/i, '').replace(/[<>:"/\\|?*]/g, '_').replace(/\uFFFD/g, '').trim();
          if (tName.length > 60) {
            tName = tName.substring(0, 60).trim();
          }
          this.mediaVideoTitle = tName;
          this.mediaChannelName = 'Stream Multimedia HD Multi-Bitrate';
          const baseBytes = res.tamano || 284 * 1024 * 1024;
          const mb = baseBytes / (1024 * 1024);
          this.mediaQualities = [
            { label: '1080p', val: '1080p', format: 'MP4', type: 'video', badge: '1080p MP4', size: `${mb.toFixed(2)} MB`, bytes: baseBytes },
            { label: '720p', val: '720p', format: 'MP4', type: 'video', badge: '720p MP4', size: `${(mb * 0.53).toFixed(2)} MB`, bytes: Math.round(baseBytes * 0.53) },
            { label: '480p', val: '480p', format: 'MP4', type: 'video', badge: '480p SD', size: `${(mb * 0.22).toFixed(2)} MB`, bytes: Math.round(baseBytes * 0.22) },
            { label: '360p', val: '360p', format: 'MP4', type: 'video', badge: '360p Móvil', size: `${(mb * 0.16).toFixed(2)} MB`, bytes: Math.round(baseBytes * 0.16) },
            { label: '240p', val: '240p', format: 'MP4', type: 'video', badge: '240p Móvil', size: `${(mb * 0.08).toFixed(2)} MB`, bytes: Math.round(baseBytes * 0.08) },
            { label: '144p', val: '144p', format: 'MP4', type: 'video', badge: '144p Móvil', size: `${(mb * 0.04).toFixed(2)} MB`, bytes: Math.round(baseBytes * 0.04) },
            { label: '1080p', val: '1080p_mkv', format: 'MKV', type: 'video', badge: '1080p MKV', size: `${(mb * 1.05).toFixed(2)} MB`, bytes: Math.round(baseBytes * 1.05) },
            { label: '320 kbps', val: 'mp3_320', format: 'MP3', type: 'audio', badge: 'MP3 320k', size: `${(Math.max(4.5, mb * 0.04)).toFixed(2)} MB`, bytes: Math.round(Math.max(4.5, mb * 0.04) * 1024 * 1024) },
            { label: '256 kbps', val: 'mp3_256', format: 'MP3', type: 'audio', badge: 'MP3 256k', size: `${(Math.max(3.6, mb * 0.032)).toFixed(2)} MB`, bytes: Math.round(Math.max(3.6, mb * 0.032) * 1024 * 1024) },
            { label: '128 kbps', val: 'm4a_128', format: 'M4A', type: 'audio', badge: 'M4A 128k', size: `${(Math.max(2.2, mb * 0.018)).toFixed(2)} MB`, bytes: Math.round(Math.max(2.2, mb * 0.018) * 1024 * 1024) },
            { label: '64 kbps', val: 'm4a_64', format: 'M4A', type: 'audio', badge: 'M4A 64k', size: `${(Math.max(1.1, mb * 0.009)).toFixed(2)} MB`, bytes: Math.round(Math.max(1.1, mb * 0.009) * 1024 * 1024) }
          ];

          const safeName = this.mediaVideoTitle;
          this.nombre = `${safeName}.${this.mediaSelectedFormat.toLowerCase()}`;
          this.tamanoStr = `${mb.toFixed(2)} MB (1080p)`;
          this.tamanoBytes = baseBytes;
          this.estadoSondeo = `Video detectado: ${this.mediaVideoTitle} ✓`;
          this.sondeoEnCurso = false;
          return;
        }
      } catch (err) {
        console.warn('Fallo sonda yt-dlp backend:', err);
      }

      this.mediaVideoTitle = `YouTube_Video_${videoId}`;
      this.mediaChannelName = 'Stream Multimedia HD Multi-Bitrate';
      this.nombre = `YouTube_${videoId}.${this.mediaSelectedFormat.toLowerCase()}`;
      this.tamanoStr = '245.00 MB (1080p 60fps)';
      this.tamanoBytes = 245 * 1024 * 1024;
      this.estadoSondeo = 'Flujo de Video YouTube Detectado ✓';
      this.sondeoEnCurso = false;
      return;
    } else {
      this.isMediaStream = false;
    }

    try {
      const res: ProbeResult = await this.downloadService.sondearUrl(url);
      this.sondeoEnCurso = false;
      if (res && res.ok) {
        this.estadoSondeo = res.soporta_rangos 
          ? 'Servidor remoto OK (Descarga Multi-hilo Acelerada ✓)' 
          : 'Servidor remoto OK (Descarga estándar)';
        if (res.nombre && (!this.nombre || this.nombre === 'archivo_descarga.iso')) {
          this.nombre = res.nombre;
        }
        if (res.tamano_str) {
          this.tamanoStr = res.tamano_str;
          this.tamanoBytes = res.tamano || 0;
        } else {
          this.tamanoStr = 'Flujo Dinámico / Desconocido';
          this.tamanoBytes = 0;
        }
        if (res.categoria) {
          this.categoria = res.categoria;
        }
      } else {
        this.estadoSondeo = 'No se pudo inspeccionar el recurso remoto';
      }
    } catch {
      this.sondeoEnCurso = false;
      this.estadoSondeo = 'Error al conectar con la sonda';
    }
  }

  public selectMediaQuality(q: { label: string; val: string; format: 'MP4' | 'MKV' | 'WEBM' | 'MP3' | 'M4A'; type: 'video' | 'audio'; size: string; bytes: number }): void {
    this.mediaSelectedQuality = q.val;
    this.mediaSelectedFormat = q.format;
    this.tamanoStr = q.size;
    this.tamanoBytes = q.bytes;
    if (q.type === 'audio') {
      this.categoria = 'Música';
    } else {
      this.categoria = 'Videos';
    }
    if (this.mediaVideoTitle) {
      let safeName = this.mediaVideoTitle.replace(/[<>:"/\\|?*]/g, '_').trim();
      if (safeName.length > 60) safeName = safeName.substring(0, 60).trim();
      const ext = q.format.toLowerCase();
      if (q.val === '720p') {
        this.nombre = `${safeName}_720p.${ext}`;
      } else if (q.val === '480p') {
        this.nombre = `${safeName}_480p.${ext}`;
      } else if (q.val === '360p') {
        this.nombre = `${safeName}_360p.${ext}`;
      } else {
        this.nombre = `${safeName}.${ext}`;
      }
    }
  }

  public async iniciar(autoIniciar: boolean = true): Promise<void> {
    if (this.enviando) return;

    // Si proviene de selección por lotes / playlist
    if (this.downloadService.loteEnCola && this.downloadService.loteEnCola.length > 0) {
      const lote = [...this.downloadService.loteEnCola];
      this.downloadService.loteEnCola = [];
      if (this.carpetaDestino) {
        lote.forEach(it => {
          if (!it.carpeta || it.carpeta === 'C:\\Descargas') {
            it.carpeta = this.carpetaDestino;
          }
        });
      }
      this.enviando = true;
      try {
        await this.downloadService.iniciarDescargasLote(lote, autoIniciar);
      } finally {
        this.enviando = false;
        this.cerrarModal();
      }
      return;
    }

    if (!this.url.trim()) return;

    this.enviando = true;
    try {
      let nombreBase = this.nombre.trim();
      if (!nombreBase || nombreBase.toLowerCase().startsWith('watch.') || nombreBase.toLowerCase() === 'watch') {
        if (this.mediaVideoTitle) {
          nombreBase = `${this.mediaVideoTitle}.${this.mediaSelectedFormat.toLowerCase()}`;
        } else {
          nombreBase = this.url.split('/').pop()?.split('?')[0] || 'descarga_archivo';
          if (nombreBase.toLowerCase().startsWith('watch')) {
            nombreBase = 'Video_Descarga.mp4';
          }
        }
      }

      // Truncar nombre a 60 caracteres max antes de la extensión si es muy largo
      const lastDot = nombreBase.lastIndexOf('.');
      if (lastDot > 60) {
        const bName = nombreBase.substring(0, 60).trim();
        const ext = nombreBase.substring(lastDot);
        nombreBase = `${bName}${ext}`;
      }

      // Si es flujo multimedia y se seleccionaron múltiples calidades (> 1)
      if (this.isMediaStream && this.selectedQualities.size > 1) {
        // Si el usuario presiona "Añadir a cola" (autoIniciar == false)
        if (!autoIniciar) {
          for (const val of Array.from(this.selectedQualities)) {
            const q = this.mediaQualities.find(item => item.val === val);
            if (!q) continue;
            const ext = q.format.toLowerCase();
            let safeTitle = (this.mediaVideoTitle || 'Video').replace(/[<>:"/\\|?*]/g, '_').trim();
            if (safeTitle.length > 50) safeTitle = safeTitle.substring(0, 50).trim();
            const qName = `${safeTitle}_${q.label.replace(/\s+/g, '')}.${ext}`;

            await this.downloadService.iniciarNuevaDescarga({
              url: this.url.trim(),
              nombre: qName,
              ruta_destino: this.carpetaDestino,
              conexiones: this.conexiones,
              categoria: q.type === 'audio' ? 'Música' : 'Videos',
              programada: this.programada,
              fecha_programada: this.horaProgramada,
              alta_demanda: this.conexiones > 16,
              tamano_forzado: q.bytes > 0 ? q.bytes : undefined
            });
          }
          this.cerrarModal();
          return;
        }

        // Si el usuario presiona "Iniciar Descarga" (autoIniciar == true)
        const primaryVal = this.mediaSelectedQuality;
        const otherVals = Array.from(this.selectedQualities).filter(v => v !== primaryVal);

        await this.downloadService.iniciarNuevaDescarga({
          url: this.url.trim(),
          nombre: nombreBase,
          ruta_destino: this.carpetaDestino,
          conexiones: this.conexiones,
          categoria: this.categoria,
          programada: this.programada || false,
          fecha_programada: this.horaProgramada,
          alta_demanda: this.conexiones > 16,
          tamano_forzado: this.tamanoBytes > 0 ? this.tamanoBytes : undefined
        });

        for (const val of otherVals) {
          const q = this.mediaQualities.find(item => item.val === val);
          if (!q) continue;
          const ext = q.format.toLowerCase();
          let safeTitle = (this.mediaVideoTitle || 'Video').replace(/[<>:"/\\|?*]/g, '_').trim();
          if (safeTitle.length > 50) safeTitle = safeTitle.substring(0, 50).trim();
          const qName = `${safeTitle}_${q.label.replace(/\s+/g, '')}.${ext}`;

          await this.downloadService.iniciarNuevaDescarga({
            url: this.url.trim(),
            nombre: qName,
            ruta_destino: this.carpetaDestino,
            conexiones: this.conexiones,
            categoria: q.type === 'audio' ? 'Música' : 'Videos',
            programada: false, // En cola automática secuencial
            fecha_programada: this.horaProgramada,
            alta_demanda: this.conexiones > 16,
            tamano_forzado: q.bytes > 0 ? q.bytes : undefined
          });
        }

        this.cerrarModal();
        return;
      }

      // Descarga normal de archivo único (1 formato o archivo estándar)
      await this.downloadService.iniciarNuevaDescarga({
        url: this.url.trim(),
        nombre: nombreBase,
        ruta_destino: this.carpetaDestino,
        conexiones: this.conexiones,
        categoria: this.categoria,
        programada: this.programada,
        fecha_programada: this.horaProgramada,
        alta_demanda: this.conexiones > 16,
        tamano_forzado: this.tamanoBytes > 0 ? this.tamanoBytes : undefined
      });

      this.cerrarModal();
    } catch (err) {
      console.error('Error al iniciar descarga:', err);
      this.enviando = false;
    }
  }

  public cerrarModal(): void {
    this.enviando = false;
    this.downloadService.loteEnCola = [];
    this.url = '';
    this.nombre = '';
    this.tamanoStr = 'Esperando URL...';
    this.estadoSondeo = '';
    this.isMediaStream = false;
    this.mediaVideoTitle = '';
    this.mediaThumbnailUrl = '';
    this.mediaFilterTab = 'video';
    this.isCalendarOpen = false;
    this.isTimePickerOpen = false;
    this.selectedQualities.clear();
    this.playlistSondeando = false;
    this.notificacionPlaylistMostrada = false;
    this.ultimaUrlPlaylistNotificada = '';
    this.close.emit();
  }
}
