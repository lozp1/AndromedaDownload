# 🚀 PLAN DE ACCIÓN Y HOJA DE RUTA: ANDROMEDA DOWNLOAD V1.0 STORE READY
**Objetivo:** Guiar de manera metódica, transparente y ejecutable los pasos restantes para la publicación oficial en la Microsoft Store y entrega final del sistema.

---

## FASE 1: ARQUITECTURA Y MIGRACIÓN BASE (ESTADO: 100% COMPLETADA ✅)
- [x] **Frontend:** Desacoplamiento total de PySide6; migración a componentes limpios y modulares en Angular 13+ con TypeScript.
- [x] **Backend:** Sustitución de Python por motor asíncrono puro en Rust con Tokio y Tauri v2 Core.
- [x] **Zero-Assemble I/O:** Creación y prealocación instantánea en disco con `set_len` (`SetFileInformationByHandle`) y escritura paralela en offsets.
- [x] **Binarios Compilados:** Generación del ejecutable nativo optimizado `andromeda_download.exe` (18.16 MB) sin dependencias externas ni intérprete de Python.

---

## FASE 2: RESOLUCIÓN DE REQUERIMIENTOS Y CALIBRACIÓN UI (ESTADO: 100% COMPLETADA ✅)
- [x] **Arrastre Nativo de Ventana:** Integración del listener nativo `mousedown` en el Header frameless comunicando con el API de Tauri.
- [x] **Limpieza del Header:** Eliminación del texto de depuración `Motor: Conectado • 0 Sockets`.
- [x] **Traducción Dinámica:** Traducción de "Dashboard" a *"Panel de Control"* (ES) y *"Painel de Controle"* (PT).
- [x] **Icono de Aplicativo:** Sustitución del icono por defecto de Tauri por el icono oficial de Andromeda (`icono_app.ico`).
- [x] **Apertura de Modales:** Corrección de la regla CSS `.modal-overlay` a `display: flex; z-index: 9999;` con animación `modalPopIn` (Modales Acerca De y Nueva Descarga 100% operativos).
- [x] **Fijación del Dock Inferior:** Eliminación del display inline en `<app-descargas-view>` y expansión `flex: 1` en la tabla de datos, anclando el dock de 72px permanentemente a la base.
- [x] **Esquinas Blancas Eliminadas:** Activación de `"transparent": true` en ventana y `background: transparent !important;` en HTML/Body.
- [x] **Botones 3D Táctiles:** Rediseño de `.tb-btn` eliminando bordes duros e incorporando gradientes verticales, biseles de luz superior, sombras de profundidad y efecto hundimiento en `:active`.
- [x] **Modo Claro (Solar Light):** Reemplazo de colores hexadecimales oscuros hardcodeados por tokens semánticos `var(--bg-card)` con contraste balanceado para luz diurna.

---

## FASE 3: CONSOLIDACIÓN DE DOCUMENTACIÓN Y CATÁLOGOS (ESTADO: 100% COMPLETADA ✅)
- [x] **PRD Maestro Unificado:** Redacción integral de `docs/PRD_GENERAL_ANDROMEDA.md` conteniendo los 9 pilares estratégicos, fórmulas matemáticas de ROI, arquitectura y mapa de componentes.
- [x] **Catálogos Interactivos Migrados:** Copia e integración de los catálogos en vivo (`index.html`, `formularios.html`, `catalogo_diseno_ui.html`, `catalogo_logos.html`) en `docs/catalogos/`.
- [x] **Catálogo de Propuestas Unificado:** Documentación técnica en `docs/CATALOGO_PROPUESTAS.md` de los 10 botones, 4 estilos de iconos, 4 tipografías, 10 variantes de dock y 10 animaciones de toast.

---

## FASE 4: EMPAQUETADO MSIX Y STORE READINESS (PRÓXIMO PASO PRIORITARIO 🎯)
- [ ] **Paso 4.1:** Generación del Manifiesto de Aplicación para Windows App SDK (`AppxManifest.xml`) con identidad `com.andromeda.download`, capacidades declaradas y assets visuales para la Tienda (Logos 44x44, 150x150, Wide 310x150 y StoreLogo).
- [ ] **Paso 4.2:** Desactivación del menú contextual de inspección de desarrollo (clic derecho) para modo producción en la configuración de Tauri (`"devtools": false`).
- [ ] **Paso 4.3:** Generación del paquete `.msix` firmado localmente con certificado autofirmado de prueba para validación de instalación en Windows 10/11 con un solo clic.
- [ ] **Paso 4.4:** Elaboración del checklist de auditoría de políticas de Microsoft Store (políticas 10.8 y 10.13 de streaming/copyright, enlace legal de privacidad y soporte).
