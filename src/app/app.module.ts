import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { DescargasViewComponent } from './components/descargas-view/descargas-view.component';
import { DashboardViewComponent } from './components/dashboard-view/dashboard-view.component';
import { AjustesViewComponent } from './components/ajustes-view/ajustes-view.component';
import { ModalNuevaDescargaComponent } from './components/modal-nueva/modal-nueva.component';
import { ModalDetalleComponent } from './components/modal-detalle/modal-detalle.component';
import { ModalAboutComponent } from './components/modal-about/modal-about.component';
import { ToastComponent } from './components/toast/toast.component';
import { SplashScreenComponent } from './components/splash-screen/splash-screen.component';
import { CustomCursorComponent } from './components/custom-cursor/custom-cursor.component';
import { ModalConfirmComponent } from './components/modal-confirm/modal-confirm.component';
import { ModalExploradorComponent } from './components/modal-explorador/modal-explorador.component';
import { TourMascotaComponent } from './components/tour-mascota/tour-mascota.component';
import { TrayPanelComponent } from './components/tray-panel/tray-panel.component';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';

@NgModule({
  declarations: [
    AppComponent,
    HeaderComponent,
    SidebarComponent,
    DescargasViewComponent,
    DashboardViewComponent,
    AjustesViewComponent,
    ModalNuevaDescargaComponent,
    ModalDetalleComponent,
    ModalAboutComponent,
    ToastComponent,
    SplashScreenComponent,
    CustomCursorComponent,
    ModalConfirmComponent,
    ModalExploradorComponent,
    TourMascotaComponent,
    TrayPanelComponent,
    ContextMenuComponent
  ],
  imports: [
    BrowserModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
