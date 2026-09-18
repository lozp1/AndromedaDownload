import { Component, EventEmitter, Input, Output } from '@angular/core';
import { I18nService } from '../../services/i18n.service';

@Component({
  selector: 'app-modal-confirm',
  templateUrl: './modal-confirm.component.html'
})
export class ModalConfirmComponent {
  @Input() visible: boolean = false;
  @Input() tipo: 'eliminar' | 'salir' = 'eliminar';
  @Input() selectedCount: number = 1;
  @Output() confirm = new EventEmitter<{ deleteFromDisk: boolean; action?: 'salir' | 'minimizar' }>();
  @Output() close = new EventEmitter<void>();

  public deleteFromDisk: boolean = false;

  constructor(public i18n: I18nService) {}

  public onConfirmDelete(): void {
    this.confirm.emit({ deleteFromDisk: this.deleteFromDisk });
    this.deleteFromDisk = false;
  }

  public onConfirmExit(): void {
    this.confirm.emit({ deleteFromDisk: false, action: 'salir' });
  }

  public onConfirmMinimize(): void {
    this.confirm.emit({ deleteFromDisk: false, action: 'minimizar' });
  }

  public onCancel(): void {
    this.deleteFromDisk = false;
    this.close.emit();
  }
}
