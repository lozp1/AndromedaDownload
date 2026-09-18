/**
 * ANDROMEDA DOWNLOAD - Detector y Sniffer de Videos Web
 * Superpone un botón flotante moderno sobre reproductores de video (YouTube, Vimeo, etc.)
 */

(function () {
    'use strict';

    const ID_BOTON_OVERLAY = "andromeda-video-download-btn";

    function crearBotonOverlay(videoElement, contenedor) {
        if (!contenedor || contenedor.querySelector(`#${ID_BOTON_OVERLAY}`)) {
            return;
        }

        // Crear botón flotante
        const logoUrl = (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL)
            ? chrome.runtime.getURL("iconos/logo_brand_squircle.png")
            : "";

        const btn = document.createElement("div");
        btn.id = ID_BOTON_OVERLAY;
        btn.className = "andromeda-badge-flotante";
        btn.innerHTML = `
            <span class="andromeda-logo-box">
                ${logoUrl ? `<img src="${logoUrl}" class="andromeda-squircle-img" alt="Andromeda">` : `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>`}
            </span>
            <span class="andromeda-txt">Descargar con Andromeda</span>
        `;
        btn.title = "Acelerar descarga con motor Tokio Zero-Assemble";

        const dispararDescarga = (e) => {
            if (e) {
                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();
            }

            let urlVideo = "";
            let titulo = document.title || "Video_Descarga";
            const host = window.location.hostname.toLowerCase();

            // 1. Caso YouTube
            if (host.includes("youtube.com") || host.includes("youtu.be")) {
                // Caso 1a: Estamos en la página del video (/watch o /shorts)
                if (window.location.pathname.includes("/watch") || window.location.pathname.includes("/shorts")) {
                    const searchParams = new URLSearchParams(window.location.search);
                    const vParam = searchParams.get("v");
                    if (vParam) {
                        urlVideo = `https://www.youtube.com/watch?v=${vParam}`;
                    } else if (window.location.pathname.includes("/shorts/")) {
                        const parts = window.location.pathname.split("/shorts/");
                        const shortId = parts[1] ? parts[1].split("/")[0].split("?")[0] : "";
                        urlVideo = shortId ? `https://www.youtube.com/shorts/${shortId}` : window.location.href;
                    } else {
                        urlVideo = window.location.href;
                    }

                    const ytTitle = document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
                                    document.querySelector("h1.title") ||
                                    document.querySelector(".ytd-video-primary-info-renderer h1");
                    if (ytTitle && ytTitle.innerText.trim()) {
                        titulo = ytTitle.innerText.trim();
                    }
                } else {
                    // Caso 1b: Portada (Home), feed de suscripciones, tendencias o canal
                    const card = contenedor.closest(
                        "ytd-rich-item-renderer, ytd-video-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytd-reel-item-renderer, ytd-playlist-video-renderer, ytd-rich-grid-media, [id*='dismissible']"
                    ) || contenedor.parentElement;

                    if (card) {
                        const enlace = card.querySelector(
                            "a#thumbnail[href*='watch'], a#thumbnail[href*='shorts'], a#video-title-link, a#video-title[href*='watch'], a[href*='/watch?v='], a[href*='/shorts/']"
                        );
                        if (enlace && enlace.href) {
                            try {
                                const parsed = new URL(enlace.href, window.location.origin);
                                const v = parsed.searchParams.get("v");
                                if (v) {
                                    urlVideo = `https://www.youtube.com/watch?v=${v}`;
                                } else {
                                    urlVideo = enlace.href;
                                }
                            } catch (e) {
                                urlVideo = enlace.href;
                            }
                        }

                        const titleEl = card.querySelector("#video-title, #video-title-link, #title");
                        if (titleEl) {
                            titulo = titleEl.innerText.trim() || titleEl.getAttribute("title") || titulo;
                        }
                    }

                    // Fallback para YouTube cards: buscar por id de video en elementos cercanos
                    if (!urlVideo) {
                        const anyThumb = contenedor.querySelector("a[href*='watch?v='], a[href*='/shorts/']");
                        if (anyThumb && anyThumb.href) {
                            urlVideo = anyThumb.href;
                        }
                    }
                }

                // Si no se obtuvo video válido en YouTube, advertir al usuario
                if (!urlVideo || (!urlVideo.includes("v=") && !urlVideo.includes("/shorts/"))) {
                    btn.classList.add("andromeda-enviado");
                    btn.innerHTML = `<span class="andromeda-logo-box">⚠️</span><span class="andromeda-txt">Abre el video para descargar</span>`;
                    setTimeout(() => {
                        btn.classList.remove("andromeda-enviado");
                        btn.innerHTML = `
                            <span class="andromeda-logo-box">
                                ${logoUrl ? `<img src="${logoUrl}" class="andromeda-squircle-img" alt="Andromeda">` : `
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                                </svg>`}
                            </span>
                            <span class="andromeda-txt">Descargar con Andromeda</span>
                        `;
                    }, 3000);
                    return;
                }
            }
            // 2. Caso Pornhub y sitios para adultos
            else if (host.includes("pornhub.com") || host.includes("xvideos.com") || host.includes("xnxx.com") || host.includes("redtube.com") || host.includes("youporn.com")) {
                // Si estamos dentro de la página del video
                if (window.location.search.includes("viewkey=") || window.location.pathname.includes("/video") || window.location.pathname.includes("/watch/")) {
                    urlVideo = window.location.href;
                    const h1El = document.querySelector("h1, .video-wrapper h1, span.inlineFree");
                    if (h1El && h1El.innerText.trim()) {
                        titulo = h1El.innerText.trim();
                    }
                } else {
                    // Estamos en la portada o listado (tarjeta de video)
                    const card = contenedor.closest(
                        "li.pcVideoListItem, .videoblock, .thumb-block, .thumb, .video-card, div[data-segment-id], li[class*='video']"
                    );
                    if (card) {
                        const link = card.querySelector("a[href*='/view_video.php'], a[href*='/video/'], a[href*='/watch/']");
                        if (link && link.href) {
                            urlVideo = link.href;
                        }
                        const titleEl = card.querySelector(".title a, .video-title, span.title, [title]");
                        if (titleEl) {
                            titulo = titleEl.getAttribute("title") || titleEl.innerText.trim() || titulo;
                        }
                    }
                }
            }
            // 3. Caso General HTML5 Video
            else {
                // Evitar pasar blobs 'blob:https://...' porque causan archivos vacíos en requests convencionales
                const src = videoElement.currentSrc || videoElement.src || "";
                if (src && !src.startsWith("blob:") && !src.startsWith("data:")) {
                    urlVideo = src;
                } else {
                    urlVideo = window.location.href;
                }
            }

            if (!urlVideo) {
                return;
            }

            let safeNombre = titulo.replace(/[\\/*?:"<>|]/g, "_").trim();
            if (!safeNombre.includes(".")) {
                safeNombre += ".mp4";
            }

            const payload = {
                url: urlVideo,
                nombre: safeNombre,
                referer: window.location.href,
                origen: "extension_overlay",
                abrir_modal: true
            };

            const exitoVisual = () => {
                btn.classList.add("andromeda-enviado");
                btn.innerHTML = `
                    <span class="andromeda-ico">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                        </svg>
                    </span>
                    <span class="andromeda-txt">Abriendo en Andromeda</span>
                `;
                setTimeout(() => {
                    btn.classList.remove("andromeda-enviado");
                    btn.innerHTML = `
                        <span class="andromeda-logo-box">
                            ${logoUrl ? `<img src="${logoUrl}" class="andromeda-squircle-img" alt="Andromeda">` : `
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                            </svg>`}
                        </span>
                        <span class="andromeda-txt">Descargar con Andromeda</span>
                    `;
                }, 2800);
            };

            // Notificar al background script y fallback directo HTTP
            let enviado = false;
            try {
                chrome.runtime.sendMessage({
                    tipo: "ABRIR_MODAL_ANDROMEDA",
                    url: urlVideo,
                    nombre: payload.nombre
                }, (res) => {
                    if (!enviado) {
                        enviado = true;
                        exitoVisual();
                    }
                });
            } catch (err) {}

            fetch("http://127.0.0.1:47990/descargar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            }).then(() => {
                if (!enviado) {
                    enviado = true;
                    exitoVisual();
                }
            }).catch(() => {
                if (!enviado) {
                    exitoVisual();
                }
            });
        };

        // Capturar en fase de captura y en pointerdown para evitar que los controles del reproductor bloqueen el evento
        const pararTodo = (e) => {
            if (e) {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        };
        btn.addEventListener("click", dispararDescarga, true);
        btn.addEventListener("pointerdown", pararTodo, true);
        btn.addEventListener("pointerup", pararTodo, true);
        btn.addEventListener("mousedown", pararTodo, true);
        btn.addEventListener("mouseup", pararTodo, true);

        // Asegurar que el contenedor tenga posición relativa
        const posicionEstilo = window.getComputedStyle(contenedor).position;
        if (posicionEstilo === "static") {
            contenedor.style.position = "relative";
        }

        contenedor.appendChild(btn);
    }

    function escanearVideos() {
        // 1. YouTube Player principal
        const ytPlayer = document.querySelector("#movie_player");
        if (ytPlayer) {
            const video = ytPlayer.querySelector("video");
            if (video) {
                crearBotonOverlay(video, ytPlayer);
            }
        }

        // 2. YouTube Feed / Portada (miniaturas con hover preview, descartando anuncios)
        const ytCards = document.querySelectorAll("ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer");
        ytCards.forEach(card => {
            if (card.closest("ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, [class*='ad-'], [id*='ad-']")) return;
            const video = card.querySelector("video");
            if (video) {
                const thumbArea = card.querySelector("#thumbnail") || video.parentElement;
                if (thumbArea) {
                    crearBotonOverlay(video, thumbArea);
                }
            }
        });

        // 3. Reproductores para adultos
        const phPlayer = document.querySelector("#player, .video-wrapper, .mgp_player, #main-player");
        if (phPlayer) {
            const video = phPlayer.querySelector("video");
            if (video) {
                crearBotonOverlay(video, phPlayer);
            }
        }

        // 4. Reproductores de video HTML5 genéricos (excluyendo YouTube e iframes publicitarios)
        const videos = document.querySelectorAll("video");
        videos.forEach(video => {
            if (video.closest("#movie_player, ytd-app, .ad-container, .ytp-ad-player-overlay, .video-ads, ytd-ad-slot-renderer, [class*='ad-container'], [class*='advertisement'], [id*='google_ads'], [id*='ad-slot']")) return;
            const parent = video.parentElement;
            if (parent && video.offsetWidth > 220 && video.offsetHeight > 130) {
                crearBotonOverlay(video, parent);
            }
        });
    }

    // Monitorear inserción dinámica de videos en el DOM
    const observador = new MutationObserver(() => {
        escanearVideos();
    });

    observador.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Escaneo inicial al cargar la página
    setTimeout(escanearVideos, 1000);
    setInterval(escanearVideos, 3000); // Polling secundario para páginas SPA pesadas
})();
