# -*- coding: utf-8 -*-
"""
Generador de Assets Oficiales de Identidad Visual para ANDROMEDA DOWNLOAD.
Basado en la Propuesta Oficial Seleccionada: PROPUESTA 09 (Monograma 'A' Áureo Fibonacci).
Exporta:
- logo_oficial.png (1024x1024 con fondo obsidian)
- logo_transparente.png (1024x1024 con fondo transparente)
- icono_app.ico (256, 128, 64, 48, 32, 16 multi-resolución Windows)
- Assets Microsoft Store (44x44, 50x50, 150x150, 300x300)
- Icono para Extensión del Navegador (16, 48, 128)
"""

import os
import sys
from PIL import Image
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import (
    QImage, QPainter, QColor, QPen, QBrush, QLinearGradient,
    QRadialGradient, QPainterPath, QFont
)
from PySide6.QtCore import Qt, QPointF, QRectF

app = QApplication.instance() or QApplication(sys.argv)
DIR_RECURSOS = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR_LOGOS = os.path.join(DIR_RECURSOS, "logos")
DIR_ICONS = os.path.join(DIR_RECURSOS, "icons")
DIR_EXT = os.path.join(os.path.dirname(DIR_RECURSOS), "extension_navegador", "iconos")
os.makedirs(DIR_EXT, exist_ok=True)


def renderizar_simbolo_a(p: QPainter, size: int):
    """Dibuja el monograma 'A' áureo escalable para cualquier tamaño."""
    scale = size / 1024.0
    cx = size / 2.0
    cy = (size / 2.0) - (25 * scale)

    p.save()
    p.setRenderHint(QPainter.Antialiasing)
    p.setRenderHint(QPainter.SmoothPixmapTransform)

    # Monograma 'A' Áureo
    path_a = QPainterPath()
    path_a.moveTo(cx - 170 * scale, cy + 180 * scale)
    path_a.cubicTo(cx - 150 * scale, cy - 40 * scale, cx - 80 * scale, cy - 180 * scale, cx, cy - 200 * scale)
    path_a.cubicTo(cx + 80 * scale, cy - 180 * scale, cx + 130 * scale, cy - 60 * scale, cx + 160 * scale, cy + 40 * scale)
    path_a.lineTo(cx + 195 * scale, cy + 40 * scale)
    path_a.lineTo(cx + 120 * scale, cy + 175 * scale)
    path_a.lineTo(cx + 45 * scale, cy + 40 * scale)
    path_a.lineTo(cx + 80 * scale, cy + 40 * scale)
    path_a.cubicTo(cx + 60 * scale, cy - 40 * scale, cx + 20 * scale, cy - 110 * scale, cx, cy - 110 * scale)
    path_a.cubicTo(cx - 20 * scale, cy - 110 * scale, cx - 60 * scale, cy - 30 * scale, cx - 80 * scale, cy + 180 * scale)
    path_a.closeSubpath()

    # Barra horizontal de la 'A'
    path_cross = QPainterPath()
    path_cross.moveTo(cx - 95 * scale, cy + 15 * scale)
    path_cross.lineTo(cx + 85 * scale, cy + 15 * scale)
    path_cross.lineTo(cx + 85 * scale, cy + 65 * scale)
    path_cross.lineTo(cx - 95 * scale, cy + 65 * scale)
    path_cross.closeSubpath()

    grad_a = QLinearGradient(cx - 170 * scale, cy - 200 * scale, cx + 195 * scale, cy + 180 * scale)
    grad_a.setColorAt(0.0, QColor("#00F2FE"))
    grad_a.setColorAt(0.4, QColor("#2563EB"))
    grad_a.setColorAt(1.0, QColor("#38BDF8"))

    # Trazo exterior
    pen_glow = QPen(QColor(0, 242, 254, 180), max(2.0, 4.0 * scale))
    p.setPen(pen_glow)
    p.setBrush(QBrush(grad_a))
    p.drawPath(path_a)

    p.setBrush(QBrush(QColor("#00F2FE")))
    p.setPen(Qt.NoPen)
    p.drawPath(path_cross)

    p.restore()


def generar_assets():
    # 1. Logo Oficial con Fondo Obsidian y Texto (1024x1024)
    img_full = QImage(1024, 1024, QImage.Format_ARGB32)
    p = QPainter(img_full)
    p.setRenderHint(QPainter.Antialiasing)

    bg_grad = QRadialGradient(512, 512, 768)
    bg_grad.setColorAt(0.0, QColor("#111827"))
    bg_grad.setColorAt(0.65, QColor("#0B0F19"))
    bg_grad.setColorAt(1.0, QColor("#06080F"))
    p.setBrush(QBrush(bg_grad))
    p.setPen(Qt.NoPen)
    p.drawRect(0, 0, 1024, 1024)

    renderizar_simbolo_a(p, 1024)

    font_main = QFont("Segoe UI", 36, QFont.Bold)
    font_main.setLetterSpacing(QFont.AbsoluteSpacing, 8)
    p.setFont(font_main)
    p.setPen(QColor("#F8FAFC"))
    p.drawText(QRectF(0, 1024 - 145, 1024, 50), Qt.AlignCenter, "ANDROMEDA")

    font_sub = QFont("Segoe UI", 18, QFont.DemiBold)
    font_sub.setLetterSpacing(QFont.AbsoluteSpacing, 14)
    p.setFont(font_sub)
    p.setPen(QColor("#38BDF8"))
    p.drawText(QRectF(0, 1024 - 90, 1024, 35), Qt.AlignCenter, "DOWNLOAD")
    p.end()

    ruta_full = os.path.join(DIR_LOGOS, "andromeda_logo_oficial.png")
    img_full.save(ruta_full, "PNG")
    print(f"[OK] Generado: {ruta_full}")

    # 2. Logo Transparente (1024x1024)
    img_trans = QImage(1024, 1024, QImage.Format_ARGB32)
    img_trans.fill(Qt.transparent)
    p_trans = QPainter(img_trans)
    renderizar_simbolo_a(p_trans, 1024)
    p_trans.end()

    ruta_trans = os.path.join(DIR_LOGOS, "andromeda_simbolo_transparente.png")
    img_trans.save(ruta_trans, "PNG")
    print(f"[OK] Generado: {ruta_trans}")

    # 3. Ícono de Windows (.ico multi-resolución)
    resoluciones_ico = [256, 128, 64, 48, 32, 16]
    frames_ico = []
    for r in resoluciones_ico:
        img_ico = QImage(r, r, QImage.Format_ARGB32)
        img_ico.fill(Qt.transparent)
        pi = QPainter(img_ico)
        renderizar_simbolo_a(pi, r)
        pi.end()
        temp_png = os.path.join(DIR_LOGOS, f"temp_{r}.png")
        img_ico.save(temp_png, "PNG")
        frames_ico.append(Image.open(temp_png))

    ruta_ico = os.path.join(DIR_RECURSOS, "app_icono.ico")
    frames_ico[0].save(
        ruta_ico,
        format="ICO",
        sizes=[(r, r) for r in resoluciones_ico],
        append_images=frames_ico[1:]
    )
    print(f"[OK] Generado icono de aplicación: {ruta_ico}")

    # Limpiar temporales
    for r in resoluciones_ico:
        temp_p = os.path.join(DIR_LOGOS, f"temp_{r}.png")
        if os.path.exists(temp_p):
            os.remove(temp_p)

    # 4. Assets para Microsoft Store
    store_sizes = [
        (44, "StoreLogo_44x44.png"),
        (50, "StoreLogo_50x50.png"),
        (150, "StoreLogo_150x150.png"),
        (300, "StoreLogo_300x300.png")
    ]
    for tam, nombre in store_sizes:
        img_store = QImage(tam, tam, QImage.Format_ARGB32)
        img_store.fill(Qt.transparent)
        ps = QPainter(img_store)
        renderizar_simbolo_a(ps, tam)
        ps.end()
        p_out = os.path.join(DIR_LOGOS, nombre)
        img_store.save(p_out, "PNG")
        print(f"[OK] Asset Store: {p_out}")

    # 5. Iconos para Extensión del Navegador
    ext_sizes = [(16, "icon16.png"), (48, "icon48.png"), (128, "icon128.png")]
    for tam, nombre in ext_sizes:
        img_ext = QImage(tam, tam, QImage.Format_ARGB32)
        img_ext.fill(Qt.transparent)
        pe = QPainter(img_ext)
        renderizar_simbolo_a(pe, tam)
        pe.end()
        p_ext = os.path.join(DIR_EXT, nombre)
        img_ext.save(p_ext, "PNG")
        print(f"[OK] Extensión de navegador: {p_ext}")

    print("\n¡Todos los assets oficiales de la Propuesta 9 fueron generados con éxito!")


if __name__ == "__main__":
    generar_assets()
