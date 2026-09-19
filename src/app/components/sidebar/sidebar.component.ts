import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { TauriService } from '../../services/tauri.service';
import { DescargaItem } from '../../models/download.model';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html'
})
export class SidebarComponent implements OnInit {
  @Output() openAbout = new EventEmitter<void>();

  public activeView: string = 'descargas';
  public activeFilter: string = 'Todas';

  public counts = {
    todas: 0,
    descargando: 0,
    completadas: 0,
    pausadas: 0,
    programadas: 0,
    error: 0,
    comprimidos: 0,
    videos: 0,
    musica: 0,
    documentos: 0,
    programas: 0,
    otros: 0
  };

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService,
    private tauri: TauriService
  ) {}

  ngOnInit(): void {
    this.downloadService.activeViewObservable.subscribe(view => this.activeView = view);
    this.downloadService.activeFilterObservable.subscribe(filter => this.activeFilter = filter);

    this.downloadService.descargasObservable.subscribe(descargas => {
      this.recalcularContadores(descargas);
    });
  }

  public selectDashboard(): void {
    this.downloadService.setView('dashboard');
  }

  public selectFilter(filtro: string): void {
    this.downloadService.setView('descargas');
    this.downloadService.setFilter(filtro);
  }

  public selectSettings(): void {
    this.downloadService.setView('ajustes');
  }

  public triggerAbout(): void {
    this.openAbout.emit();
  }

  public exitApp(): void {
    this.downloadService.solicitarConfirmacionSalir();
  }

  private recalcularContadores(descargas: DescargaItem[]): void {
    const c = {
      todas: descargas.length,
      descargando: 0,
      completadas: 0,
      pausadas: 0,
      programadas: 0,
      error: 0,
      comprimidos: 0,
      videos: 0,
      musica: 0,
      documentos: 0,
      programas: 0,
      otros: 0
    };

    descargas.forEach(d => {
      const est = (d.estado || '').toLowerCase();
      const cat = (d.categoria || '').toLowerCase();

      if (est.includes('descarg') || est.includes('progreso')) c.descargando++;
      else if (est.includes('complet') || est.includes('elimin')) c.completadas++;
      else if (est.includes('paus') || est.includes('deten')) c.pausadas++;
      else if (est.includes('program') || est.includes('cola')) c.programadas++;
      else if (est.includes('error') || est.includes('fall')) c.error++;

      if (cat.includes('comprim')) c.comprimidos++;
      else if (cat.includes('vid')) c.videos++;
      else if (cat.includes('mus') || cat.includes('mús')) c.musica++;
      else if (cat.includes('doc')) c.documentos++;
      else if (cat.includes('prog') || cat.includes('app')) c.programas++;
      else c.otros++;
    });

    this.counts = c;
  }
}
