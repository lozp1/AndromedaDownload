import { Component, OnInit, OnDestroy, ElementRef, ViewChildren, QueryList, NgZone } from '@angular/core';
import { DownloadService } from '../../services/download.service';

@Component({
  selector: 'app-custom-cursor',
  templateUrl: './custom-cursor.component.html'
})
export class CustomCursorComponent implements OnInit, OnDestroy {
  @ViewChildren('circle') circleElements!: QueryList<ElementRef<HTMLDivElement>>;

  public circles = Array(22).fill(0);
  private coords = { x: -100, y: -100 };
  private circleData: Array<{ x: number; y: number }> = [];
  private animFrameId: number | null = null;
  public isHidden = true;

  // Paleta Dark: Cyan Neón Andromeda -> Electric Blue -> Deep Obsidian
  private darkColors = [
    "#67E8F9", "#38BDF8", "#00F0FF", "#0EA5E9", "#0284C7", 
    "#0369A1", "#2563EB", "#1D4ED8", "#1E40AF", "#1E3A8A", 
    "#172554", "#10E761", "#059669", "#047857", "#064E3B", 
    "#0B2922", "#0F172A", "#0B1120", "#080D1A", "#050811", 
    "#03050A", "#000000"
  ];

  // Paleta Light: Zafiro Profundo -> Cobalto -> Esmeralda contrastante
  private lightColors = [
    "#1D4ED8", "#2563EB", "#3B82F6", "#0284C7", "#0369A1", 
    "#075985", "#0C4A6E", "#1E40AF", "#1E3A8A", "#172554", 
    "#047857", "#059669", "#10B981", "#2563EB", "#1D4ED8", 
    "#1E3A8A", "#0F172A", "#334155", "#475569", "#64748B", 
    "#94A3B8", "#CBD5E1"
  ];

  private colors = this.darkColors;
  private themeSub: any = null;

  constructor(
    private ngZone: NgZone,
    private downloadService: DownloadService
  ) {
    for (let i = 0; i < 22; i++) {
      this.circleData.push({ x: -100, y: -100 });
    }
  }

  private isDraggingScrollbar = false;
  private draggingScrollTarget: HTMLElement | null = null;

  ngOnInit(): void {
    this.updateColors();
    this.themeSub = this.downloadService.settingsObservable.subscribe(() => {
      this.updateColors();
    });

    this.ngZone.runOutsideAngular(() => {
      window.addEventListener('mousemove', this.onMouseMove, { capture: true, passive: true });
      document.addEventListener('mousemove', this.onMouseMove, { capture: true, passive: true });
      window.addEventListener('pointermove', this.onMouseMove, { capture: true, passive: true });
      document.addEventListener('pointermove', this.onMouseMove, { capture: true, passive: true });
      window.addEventListener('dragover', this.onMouseMove, { capture: true, passive: true });
      window.addEventListener('pointerdown', this.onPointerDown, { capture: true, passive: true });
      document.addEventListener('pointerdown', this.onPointerDown, { capture: true, passive: true });
      window.addEventListener('pointerup', this.onPointerUp, { capture: true, passive: true });
      document.addEventListener('pointerup', this.onPointerUp, { capture: true, passive: true });
      window.addEventListener('mouseup', this.onPointerUp, { capture: true, passive: true });
      document.addEventListener('mouseup', this.onPointerUp, { capture: true, passive: true });
      window.addEventListener('wheel', this.onWheel, { capture: true, passive: true });
      document.addEventListener('wheel', this.onWheel, { capture: true, passive: true });
      document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
      window.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
      window.addEventListener('mouseleave', this.onMouseLeave);
      window.addEventListener('mouseenter', this.onMouseEnter);

      // Iniciar el ciclo de animación suave a 120 FPS
      this.animateCircles();
    });
  }

  private updateColors(): void {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    this.colors = isLight ? this.lightColors : this.darkColors;
  }

  ngOnDestroy(): void {
    if (this.themeSub) {
      this.themeSub.unsubscribe();
    }
    window.removeEventListener('mousemove', this.onMouseMove, { capture: true } as any);
    document.removeEventListener('mousemove', this.onMouseMove, { capture: true } as any);
    window.removeEventListener('pointermove', this.onMouseMove, { capture: true } as any);
    document.removeEventListener('pointermove', this.onMouseMove, { capture: true } as any);
    window.removeEventListener('dragover', this.onMouseMove, { capture: true } as any);
    window.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as any);
    document.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as any);
    window.removeEventListener('pointerup', this.onPointerUp, { capture: true } as any);
    document.removeEventListener('pointerup', this.onPointerUp, { capture: true } as any);
    window.removeEventListener('mouseup', this.onPointerUp, { capture: true } as any);
    document.removeEventListener('mouseup', this.onPointerUp, { capture: true } as any);
    window.removeEventListener('wheel', this.onWheel, { capture: true } as any);
    document.removeEventListener('wheel', this.onWheel, { capture: true } as any);
    document.removeEventListener('scroll', this.onScroll, { capture: true } as any);
    window.removeEventListener('scroll', this.onScroll, { capture: true } as any);
    window.removeEventListener('mouseleave', this.onMouseLeave);
    window.removeEventListener('mouseenter', this.onMouseEnter);

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  private onMouseMove = (e: MouseEvent | PointerEvent) => {
    this.coords.x = e.clientX;
    this.coords.y = e.clientY;
    this.isHidden = false;
  };

  private onPointerDown = (e: MouseEvent | PointerEvent) => {
    this.coords.x = e.clientX;
    this.coords.y = e.clientY;
    this.isHidden = false;

    // Detectar si se hizo clic en el riel de una barra vertical
    let el = e.target as HTMLElement | null;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight) {
        const rect = el.getBoundingClientRect();
        if (e.clientX >= rect.right - 24 && e.clientX <= rect.right + 6) {
          this.isDraggingScrollbar = true;
          this.draggingScrollTarget = el;
          break;
        }
      }
      el = el.parentElement;
    }
  };

  private onPointerUp = () => {
    this.isDraggingScrollbar = false;
    this.draggingScrollTarget = null;
  };

  private onWheel = (e: WheelEvent) => {
    this.coords.x = e.clientX;
    this.coords.y = e.clientY;
    this.isHidden = false;
  };

  private onScroll = (e: Event) => {
    const target = (e.target as HTMLElement) || this.draggingScrollTarget;
    if (this.isDraggingScrollbar && target && target.getBoundingClientRect && target.scrollHeight > target.clientHeight) {
      const rect = target.getBoundingClientRect();
      const maxScroll = target.scrollHeight - target.clientHeight;
      if (maxScroll > 0) {
        const scrollRatio = target.scrollTop / maxScroll;
        const visibleRatio = target.clientHeight / target.scrollHeight;
        const thumbHeight = Math.max(24, visibleRatio * target.clientHeight);
        const availableTrack = target.clientHeight - thumbHeight;
        const thumbTop = rect.top + (scrollRatio * availableTrack);
        this.coords.y = Math.round(thumbTop + (thumbHeight / 2));
        this.coords.x = Math.round(rect.right - 6);
        this.isHidden = false;
      }
    }
  };

  private onMouseLeave = () => {
    this.isHidden = true;
  };

  private onMouseEnter = () => {
    this.isHidden = false;
  };

  private animateCircles = () => {
    let x = this.coords.x;
    let y = this.coords.y;

    const domCircles = this.circleElements?.toArray();

    if (domCircles && domCircles.length > 0) {
      domCircles.forEach((circleRef, index) => {
        const circle = circleRef.nativeElement;
        const data = this.circleData[index];

        circle.style.left = `${x - 12}px`;
        circle.style.top = `${y - 12}px`;
        circle.style.transform = `scale(${(domCircles.length - index) / domCircles.length})`;
        circle.style.backgroundColor = this.colors[index % this.colors.length];
        circle.style.opacity = this.isHidden ? '0' : '1';

        data.x = x;
        data.y = y;

        const nextCircle = this.circleData[index + 1] || this.circleData[0];
        x += (nextCircle.x - x) * 0.3;
        y += (nextCircle.y - y) * 0.3;
      });
    }

    this.animFrameId = requestAnimationFrame(this.animateCircles);
  };
}
