import { Component, OnInit } from '@angular/core';
import { DownloadService, ToastMessage } from '../../services/download.service';

@Component({
  selector: 'app-toast',
  templateUrl: './toast.component.html'
})
export class ToastComponent implements OnInit {
  public toasts: ToastMessage[] = [];

  constructor(public downloadService: DownloadService) {}

  ngOnInit(): void {
    this.downloadService.toastObservable.subscribe(t => {
      this.toasts = t;
    });
  }

  public dismiss(id: string): void {
    this.downloadService.removerToast(id);
  }

  public onClickToast(t: ToastMessage): void {
    if (t.ruta_destino) {
      this.downloadService.abrirCarpeta(t.ruta_destino);
    }
    this.dismiss(t.id);
  }
}
