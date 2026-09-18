import { Component, OnInit } from '@angular/core';
import { DownloadService } from '../../services/download.service';
import { I18nService } from '../../services/i18n.service';
import { TauriService } from '../../services/tauri.service';
import { UserSettings } from '../../models/download.model';

@Component({
  selector: 'app-ajustes-view',
  templateUrl: './ajustes-view.component.html'
})
export class AjustesViewComponent implements OnInit {
  public formSettings: UserSettings = {
    conexiones_por_archivo: 16,
    limite_velocidad_kb: 0,
    reintentos_conexion: 3,
    socket_timeout_segundos: 30,
    directorio_descargas: 'C:\\Descargas',
    auto_categorizar: true,
    abrir_carpeta_al_completar: false,
    max_descargas_simultaneas: 5,
    tema: 'dark',
    idioma: 'es',
    animaciones_fluidas: true,
    dock_osciloscopio_activo: true,
    vel_referencia_mb: 2.5,
    toast_notificaciones: true,
    sonidos_activos: true,
    iniciar_con_windows: false
  };

  constructor(
    public downloadService: DownloadService,
    public i18n: I18nService,
    private tauriService: TauriService
  ) {}

  ngOnInit(): void {
    this.downloadService.settingsObservable.subscribe(s => {
      this.formSettings = { ...s };
    });
  }

  public onThemeChange(tema: 'dark' | 'oled' | 'white' | 'system' | 'black' | 'light' | 'auto'): void {
    this.formSettings.tema = tema as any;
  }

  public setVelPreset(mb: number): void {
    this.formSettings.vel_referencia_mb = mb;
  }

  public save(): void {
    this.downloadService.guardarAjustes(this.formSettings);
  }

  public async seleccionarCarpeta(): Promise<void> {
    const ruta = await this.downloadService.abrirExploradorModal(this.formSettings.directorio_descargas);
    if (ruta && ruta.trim()) {
      this.formSettings.directorio_descargas = ruta.trim();
      // Guardar de inmediato para persistencia instantánea y fiable
      this.downloadService.guardarAjustes(this.formSettings);
    }
  }

  public cancel(): void {
    this.downloadService.setView('descargas');
  }
}
