<div align="center">

# 🚀 ANDROMEDA DOWNLOAD SUITE
### *The Next-Gen Asynchronous Multi-Socket HTTP Range Download Engine*

[![Rust](https://img.shields.io/badge/Rust-1.77+-orange.svg?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-v2.11-24C8DB.svg?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app/)
[![Angular](https://img.shields.io/badge/Angular-13-DD0031.svg?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.5-3178C6.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

<br/>

<img src="src/assets/img/logo_brand_squircle.png" width="96" height="96" alt="Andromeda Download Suite Logo" />

<p align="center">
  <b>Andromeda Download Suite</b> es un acelerador de descargas de alta gama para Windows y plataformas cruzadas.
  Combina un motor en segundo plano desarrollado en <b>Rust Tokio Asynchronous I/O</b> capaz de multiplexar hasta <b>32 sockets TCP concurrentes</b> con preasignación de disco y ensamblado directo en memoria (Zero-Assemble Direct I/O), integrado a una interfaz moderna y reactiva construida en <b>Angular y Tauri v2</b>.
</p>

[✨ Características](#-características-principales) •
[🏗️ Arquitectura](#-arquitectura-del-sistema) •
[⚡ Atajos de Teclado](#-atajos-de-teclado) •
[🛠️ Instalación y Compilación](#️-instalación-y-compilación) •
[☕ Donaciones y Apoyo](#-donaciones-y-apoyo) •
[👨‍💻 Autor](#-desarrollador--autor)

---

</div>

## 🌟 Características Principales

- **⚡ Motor Tokio Multi-Socket Ultra Acelerado:** Divide dinámicamente cualquier archivo en hasta 32 fragmentos paralelos mediante cabeceras `HTTP Range 206`, saturando de forma balanceada el ancho de banda disponible.
- **💾 Zero-Assemble Direct I/O:** Preasignación de espacio en disco en bloques contiguos. Elimina la sobrecarga de re-ensamblar archivos al finalizar la descarga.
- **🎬 Gestor de Medios & Listas de Reproducción (Playlists):** Inspección remota inteligente de YouTube y plataformas multimedia con selector de calidades (1080p, 720p, 480p, Audio MP3/M4A), carrusel interactivo 3D y **embebido automático de portada/metadata ID3** en audios.
- **📊 Telemetría en Tiempo Real (Speed Duel ROI):** Muestra analíticamente el multiplicador de velocidad y el tiempo neto ahorrado frente a las descargas estándar de navegadores.
- **🎨 Sistema Dual de Temas Avanzado:** Motor de estilos con soporte para *Obsidian Dark*, *Deep Black (OLED)*, *Light* y *Pure White* sin destellos ni artefactos.
- **🛡️ Verificación Criptográfica Continua:** Cálculo en tiempo real de hashes **SHA-256** mediante streaming directo para garantizar la integridad absoluta de cada archivo descargado.
- **🔔 Quick Tray Panel & Integración con Windows:** Panel rápido en la bandeja del sistema de Windows para control ágil de descargas, pausado masivo y monitoreo en vivo sin ocupar espacio en pantalla.
- **🌐 Servidor IPC & Extensión Web:** Servidor local seguro en puerto dedicado para interceptar y transferir descargas desde el navegador en un clic.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                 INTERFAZ DE USUARIO (GUI)                   │
│   Angular 13 • TypeScript • Tailwind/Obsidian CSS Engine    │
└──────────────────────────────┬──────────────────────────────┘
                               │ Tauri v2 IPC Bridge
┌──────────────────────────────▼──────────────────────────────┐
│                    NÚCLEO NATIVO EN RUST                    │
│                                                             │
│  ┌──────────────────────┐        ┌───────────────────────┐  │
│  │   Gestor de Tareas   │◄──────►│  Servidor IPC Local   │  │
│  │  (Persistencia JSON) │        │ (Extensión Web / Chrome) │
│  └──────────┬───────────┘        └───────────────────────┘  │
│             │ Tokio Async Tasks                             │
│  ┌──────────▼────────────────────────────────────────────┐  │
│  │     Motor Multi-Socket HTTP Range & Zero-Assemble     │  │
│  │        (Reqwest + Tokio + SHA-256 Stream Hasher)      │  │
│  └──────────────────────────┬────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      SISTEMA DE ARCHIVOS                    │
│            Escritura Directa Concurrente en Disco           │
└─────────────────────────────────────────────────────────────┘
```

---

## ⚡ Atajos de Teclado

| Atajo | Acción | Ámbito |
| :--- | :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>N</kbd> | Abrir formulario de **Nueva Descarga** | Global |
| <kbd>Ctrl</kbd> + <kbd>A</kbd> | **Seleccionar todas** las descargas de la lista | Tabla Principal |
| <kbd>Ctrl</kbd> + <kbd>F</kbd> | Bloqueado para evitar el buscador nativo del navegador | Global |
| <kbd>Espacio</kbd> | Pausar / Reanudar descarga seleccionada | Menú Contextual |
| <kbd>Supr</kbd> | Eliminar descarga seleccionada | Tabla Principal |
| <kbd>Ctrl</kbd> + <kbd>V</kbd> | Pegar nativo vía Windows API (sin alertas del navegador) | Campos de Texto |

---

## 🛠️ Instalación y Compilación

### Requisitos Previos
- **Node.js** 18+ y **npm**
- **Rust** 1.77+ con `cargo` instalado
- Herramientas de C++ de Visual Studio (MSVC)
- **Python** 3.10+ y `yt-dlp` (para descargas multimedia avanzadas)

### Pasos de Construcción

```bash
# 1. Clonar el repositorio
git clone https://github.com/lozp1/AndromedaDownload.git
cd AndromedaDownload

# 2. Instalar dependencias del frontend
npm install

# 3. Compilar el frontend en Angular
npm run build

# 4. Compilar el binario nativo en modo Release con Tauri / Cargo
cargo build --release --manifest-path src-tauri/Cargo.toml

# El ejecutable compilado se encontrará en:
# release/andromeda_download.exe
```

---

## ☕ Donaciones y Apoyo

Andromeda Download Suite es un proyecto desarrollado con dedicación para brindar una alternativa moderna, rápida y sin publicidad a los gestores de descargas tradicionales.

Si esta herramienta te ha sido de utilidad para tu trabajo o estudio, considera apoyar su desarrollo continuo:

- ⭐ **Dale una Estrella al Repositorio en GitHub:** Ayuda a que el proyecto llegue a más personas.
- 💖 **GitHub Sponsors:** [github.com/sponsors/lozp1](https://github.com/sponsors/lozp1)
- ☕ **Buy Me a Coffee:** [buymeacoffee.com/francolopez](https://buymeacoffee.com)
- 💳 **PayPal:** [paypal.me/francopaololg](https://paypal.me)

---

## 👨‍💻 Desarrollador / Autor

<table align="center">
  <tr>
    <td align="center">
      <img src="https://github.com/lozp1.png" width="100px;" alt="Franco Lopez" style="border-radius:50%;"/><br />
      <sub><b>Franco Paolo López Gálvez</b></sub><br />
      <sub>Software Engineer • Guatemala 🇬🇹</sub><br />
      <a href="https://github.com/lozp1">GitHub</a> •
      <a href="https://linkedin.com/in/franco-lopez">LinkedIn</a> •
      <a href="mailto:francopaolo_lg@outlook.com">Correo</a>
    </td>
  </tr>
</table>

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT** - consulta el archivo [LICENSE](LICENSE) para más detalles.
Andromeda Download Suite © 2026. Todos los derechos reservados.
