# -*- coding: utf-8 -*-
"""
Generador de Identidad Visual Matemática para ANDROMEDA DOWNLOAD.
Genera 5 propuestas basadas en la espiral áurea de Fibonacci, proporciones Phi (1.618),
convergencia en flecha de descarga y estéticas inspiradas en Dreamcast, Tarkett,
Hexágono de Titán y Monograma 'A'.
"""

import math
import os
import sys
from PySide6.QtWidgets import QApplication
from PySide6.QtGui import (
    QImage, QPainter, QColor, QPen, QBrush, QLinearGradient,
    QRadialGradient, QPainterPath, QFont, QFontDatabase
)
from PySide6.QtCore import Qt, QPointF, QRectF

app = QApplication.instance() or QApplication(sys.argv)
DIR_SALIDA = os.path.dirname(os.path.abspath(__file__))
SIZE = 1024


def dibujar_fondo(painter: QPainter):
    """Fondo Obsidian Blue ultra profundo con viñeta sutil."""
    bg_grad = QRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.75)
    bg_grad.setColorAt(0.0, QColor("#111827"))
    bg_grad.setColorAt(0.65, QColor("#0B0F19"))
    bg_grad.setColorAt(1.0, QColor("#06080F"))
    painter.setBrush(QBrush(bg_grad))
    painter.setPen(Qt.NoPen)
    painter.drawRect(0, 0, SIZE, SIZE)


def dibujar_texto_andromeda(painter: QPainter):
    """Tipografía inferior impecable con el nombre exacto ANDROMEDA DOWNLOAD."""
    font_main = QFont("Segoe UI", 36, QFont.Bold)
    font_main.setLetterSpacing(QFont.AbsoluteSpacing, 8)
    painter.setFont(font_main)
    painter.setPen(QColor("#F8FAFC"))
    rect_main = QRectF(0, SIZE - 145, SIZE, 50)
    painter.drawText(rect_main, Qt.AlignCenter, "ANDROMEDA")

    font_sub = QFont("Segoe UI", 18, QFont.DemiBold)
    font_sub.setLetterSpacing(QFont.AbsoluteSpacing, 14)
    painter.setFont(font_sub)
    painter.setPen(QColor("#38BDF8"))
    rect_sub = QRectF(0, SIZE - 90, SIZE, 35)
    painter.drawText(rect_sub, Qt.AlignCenter, "DOWNLOAD")


# ─── PROPUESTA 06: Espiral Áurea Pura de Fibonacci + Flecha Vórtice (Estilo Dreamcast) ───
def generar_propuesta_6():
    img = QImage(SIZE, SIZE, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    p.setRenderHint(QPainter.SmoothPixmapTransform)
    dibujar_fondo(p)

    cx, cy = SIZE / 2, SIZE / 2 - 40
    
    # Glow central
    glow = QRadialGradient(cx, cy, 320)
    glow.setColorAt(0.0, QColor(0, 242, 254, 45))
    glow.setColorAt(0.5, QColor(37, 99, 235, 25))
    glow.setColorAt(1.0, QColor(0, 0, 0, 0))
    p.setBrush(QBrush(glow))
    p.setPen(Qt.NoPen)
    p.drawEllipse(QPointF(cx, cy), 320, 320)

    # 3 brazos espirales de Fibonacci entrelazados (Golden Spiral)
    # r = a * e^(b * theta), b = ln(phi) / (pi / 2) ~ 0.3063
    b_val = 0.3063489
    for brazo in range(3):
        angulo_offset = brazo * (2 * math.pi / 3)
        path = QPainterPath()
        first = True

        # Trazar puntos de la espiral
        num_puntos = 160
        for i in range(num_puntos):
            t = (i / num_puntos) * 3.8 * math.pi
            r = 18 * math.exp(b_val * (t * 0.42))
            if r > 280:
                break
            ang = t + angulo_offset
            x = cx + r * math.cos(ang)
            y = cy + r * math.sin(ang)
            if first:
                path.moveTo(x, y)
                first = False
            else:
                path.lineTo(x, y)

        # Gradiente en cada brazo espiral
        grad = QLinearGradient(cx - 200, cy - 200, cx + 200, cy + 200)
        if brazo == 0:
            grad.setColorAt(0.0, QColor("#00F2FE"))
            grad.setColorAt(1.0, QColor("#2563EB"))
            pen_w = 18
        elif brazo == 1:
            grad.setColorAt(0.0, QColor("#38BDF8"))
            grad.setColorAt(1.0, QColor("#1D4ED8"))
            pen_w = 14
        else:
            grad.setColorAt(0.0, QColor("#10B981"))
            grad.setColorAt(1.0, QColor("#0284C7"))
            pen_w = 11

        pen = QPen(QBrush(grad), pen_w, Qt.SolidLine, Qt.RoundCap, Qt.RoundJoin)
        p.strokePath(path, pen)

    # Flecha central de descarga de alta precisión
    arrow_path = QPainterPath()
    ax, ay = cx, cy - 10
    aw, ah = 70, 95
    arrow_path.moveTo(ax - aw * 0.45, ay - ah * 0.6)
    arrow_path.lineTo(ax + aw * 0.45, ay - ah * 0.6)
    arrow_path.lineTo(ax + aw * 0.45, ay + ah * 0.1)
    arrow_path.lineTo(ax + aw * 0.85, ay + ah * 0.1)
    arrow_path.lineTo(ax, ay + ah * 0.95)
    arrow_path.lineTo(ax - aw * 0.85, ay + ah * 0.1)
    arrow_path.lineTo(ax - aw * 0.45, ay + ah * 0.1)
    arrow_path.closeSubpath()

    arr_grad = QLinearGradient(ax, ay - ah, ax, ay + ah)
    arr_grad.setColorAt(0.0, QColor("#00F2FE"))
    arr_grad.setColorAt(1.0, QColor("#2563EB"))
    p.setBrush(QBrush(arr_grad))
    p.setPen(QPen(QColor("#FFFFFF"), 3))
    p.drawPath(arrow_path)

    dibujar_texto_andromeda(p)
    p.end()
    img.save(os.path.join(DIR_SALIDA, "propuesta_6.jpg"), "JPEG", 95)
    print("Propuesta 6 generada.")


# ─── PROPUESTA 07: Emblema Tarkett Fibonacci (Curvas Cintas de Convergencia) ───
def generar_propuesta_7():
    img = QImage(SIZE, SIZE, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    p.setRenderHint(QPainter.SmoothPixmapTransform)
    dibujar_fondo(p)

    cx, cy = SIZE / 2, SIZE / 2 - 40

    # Cintas simétricas con proporciones de radio Fibonacci: 21, 34, 55, 89, 144, 233
    fib_radii = [45, 80, 130, 195, 260]
    colores = [
        ("#00F2FE", "#2563EB"),
        ("#38BDF8", "#1D4ED8"),
        ("#60A5FA", "#1E40AF"),
        ("#10B981", "#0284C7")
    ]

    for i in range(len(fib_radii) - 1):
        r_in = fib_radii[i]
        r_out = fib_radii[i + 1]

        path = QPainterPath()
        start_angle = 45 + (i * 35)
        span_angle = 210

        path.arcMoveTo(QRectF(cx - r_out, cy - r_out, r_out * 2, r_out * 2), start_angle)
        path.arcTo(QRectF(cx - r_out, cy - r_out, r_out * 2, r_out * 2), start_angle, span_angle)
        path.arcTo(QRectF(cx - r_in, cy - r_in, r_in * 2, r_in * 2), start_angle + span_angle, -span_angle)
        path.closeSubpath()

        c_start, c_end = colores[i % len(colores)]
        grad = QLinearGradient(cx - r_out, cy - r_out, cx + r_out, cy + r_out)
        grad.setColorAt(0.0, QColor(c_start))
        grad.setColorAt(1.0, QColor(c_end))

        p.setBrush(QBrush(grad))
        p.setPen(QPen(QColor(11, 15, 25, 200), 2))
        p.drawPath(path)

    # Flecha central estilizada
    p_arrow = QPainterPath()
    p_arrow.moveTo(cx - 24, cy - 40)
    p_arrow.lineTo(cx + 24, cy - 40)
    p_arrow.lineTo(cx + 24, cy + 10)
    p_arrow.lineTo(cx + 46, cy + 10)
    p_arrow.lineTo(cx, cy + 65)
    p_arrow.lineTo(cx - 46, cy + 10)
    p_arrow.lineTo(cx - 24, cy + 10)
    p_arrow.closeSubpath()

    p.setBrush(QBrush(QColor("#FFFFFF")))
    p.setPen(QPen(QColor("#00F2FE"), 3))
    p.drawPath(p_arrow)

    dibujar_texto_andromeda(p)
    p.end()
    img.save(os.path.join(DIR_SALIDA, "propuesta_7.jpg"), "JPEG", 95)
    print("Propuesta 7 generada.")


# ─── PROPUESTA 08: Hexágono Titán Phi (Geometría Sagrada de Aceleración) ───
def generar_propuesta_8():
    img = QImage(SIZE, SIZE, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    p.setRenderHint(QPainter.SmoothPixmapTransform)
    dibujar_fondo(p)

    cx, cy = SIZE / 2, SIZE / 2 - 40

    # Hexágono de Titanio Exterior
    hex_path = QPainterPath()
    radio_hex = 270
    for k in range(6):
        ang = math.radians(k * 60 - 30)
        hx = cx + radio_hex * math.cos(ang)
        hy = cy + radio_hex * math.sin(ang)
        if k == 0:
            hex_path.moveTo(hx, hy)
        else:
            hex_path.lineTo(hx, hy)
    hex_path.closeSubpath()

    grad_hex = QLinearGradient(cx - radio_hex, cy - radio_hex, cx + radio_hex, cy + radio_hex)
    grad_hex.setColorAt(0.0, QColor("#334155"))
    grad_hex.setColorAt(0.5, QColor("#1E293B"))
    grad_hex.setColorAt(1.0, QColor("#0F172A"))

    p.setBrush(QBrush(grad_hex))
    p.setPen(QPen(QColor("#38BDF8"), 4))
    p.drawPath(hex_path)

    # Espiral de Fibonacci interna que abraza el rayo
    b_val = 0.3063
    spiral_path = QPainterPath()
    first = True
    for i in range(120):
        t = (i / 120) * 2.8 * math.pi
        r = 15 * math.exp(b_val * t)
        if r > 210:
            break
        ang = t + 0.5
        x = cx + r * math.cos(ang)
        y = cy + r * math.sin(ang)
        if first:
            spiral_path.moveTo(x, y)
            first = False
        else:
            spiral_path.lineTo(x, y)

    pen_spiral = QPen(QBrush(QColor("#10B981")), 10, Qt.SolidLine, Qt.RoundCap)
    p.strokePath(spiral_path, pen_spiral)

    # Rayo - Flecha central tallada en cian y esmeralda
    bolt_path = QPainterPath()
    bolt_path.moveTo(cx + 20, cy - 170)
    bolt_path.lineTo(cx - 70, cy - 10)
    bolt_path.lineTo(cx + 5, cy - 10)
    bolt_path.lineTo(cx - 35, cy + 160)
    bolt_path.lineTo(cx + 70, cy + 5)
    bolt_path.lineTo(cx - 5, cy + 5)
    bolt_path.closeSubpath()

    bolt_grad = QLinearGradient(cx - 70, cy - 170, cx + 70, cy + 160)
    bolt_grad.setColorAt(0.0, QColor("#38BDF8"))
    bolt_grad.setColorAt(0.5, QColor("#10B981"))
    bolt_grad.setColorAt(1.0, QColor("#22C55E"))

    p.setBrush(QBrush(bolt_grad))
    p.setPen(QPen(QColor("#FFFFFF"), 3))
    p.drawPath(bolt_path)

    dibujar_texto_andromeda(p)
    p.end()
    img.save(os.path.join(DIR_SALIDA, "propuesta_8.jpg"), "JPEG", 95)
    print("Propuesta 8 generada.")


# ─── PROPUESTA 09: Monograma 'A' de Fibonacci (Curvas Áureas + Fast-Forward) ───
def generar_propuesta_9():
    img = QImage(SIZE, SIZE, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    p.setRenderHint(QPainter.SmoothPixmapTransform)
    dibujar_fondo(p)

    cx, cy = SIZE / 2, SIZE / 2 - 40

    # Construcción de la 'A' mediante arcos áureos continuos
    path_a = QPainterPath()
    # Brazo izquierdo curvo en espiral ascendente
    path_a.moveTo(cx - 170, cy + 180)
    path_a.cubicTo(cx - 150, cy - 40, cx - 80, cy - 180, cx, cy - 200)
    path_a.cubicTo(cx + 80, cy - 180, cx + 130, cy - 60, cx + 160, cy + 40)
    # Vértice de flecha inferior derecha
    path_a.lineTo(cx + 195, cy + 40)
    path_a.lineTo(cx + 120, cy + 175)
    path_a.lineTo(cx + 45, cy + 40)
    path_a.lineTo(cx + 80, cy + 40)
    # Cierre de la pierna derecha
    path_a.cubicTo(cx + 60, cy - 40, cx + 20, cy - 110, cx, cy - 110)
    path_a.cubicTo(cx - 20, cy - 110, cx - 60, cy - 30, cx - 80, cy + 180)
    path_a.closeSubpath()

    # Barra horizontal de la A estilizada como flujo de descarga
    path_cross = QPainterPath()
    path_cross.moveTo(cx - 95, cy + 15)
    path_cross.lineTo(cx + 85, cy + 15)
    path_cross.lineTo(cx + 85, cy + 65)
    path_cross.lineTo(cx - 95, cy + 65)
    path_cross.closeSubpath()

    grad_a = QLinearGradient(cx - 170, cy - 200, cx + 195, cy + 180)
    grad_a.setColorAt(0.0, QColor("#00F2FE"))
    grad_a.setColorAt(0.5, QColor("#2563EB"))
    grad_a.setColorAt(1.0, QColor("#38BDF8"))

    p.setBrush(QBrush(grad_a))
    p.setPen(QPen(QColor("#FFFFFF"), 3))
    p.drawPath(path_a)

    p.setBrush(QBrush(QColor("#00F2FE")))
    p.setPen(Qt.NoPen)
    p.drawPath(path_cross)

    dibujar_texto_andromeda(p)
    p.end()
    img.save(os.path.join(DIR_SALIDA, "propuesta_9.jpg"), "JPEG", 95)
    print("Propuesta 9 generada.")


# ─── PROPUESTA 10: Cometa Multi-Socket en Vórtice Áureo (Golden Multi-Stream) ───
def generar_propuesta_10():
    img = QImage(SIZE, SIZE, QImage.Format_ARGB32)
    img.fill(Qt.transparent)
    p = QPainter(img)
    p.setRenderHint(QPainter.Antialiasing)
    p.setRenderHint(QPainter.SmoothPixmapTransform)
    dibujar_fondo(p)

    cx, cy = SIZE / 2, SIZE / 2 - 40

    # 8 Hilos de datos concurrentes siguiendo la proporción áurea (phi spiral)
    b_val = 0.28
    num_hilos = 8
    colores_hilos = [
        "#00F2FE", "#38BDF8", "#60A5FA", "#3B82F6",
        "#2563EB", "#1D4ED8", "#10B981", "#34D399"
    ]

    for h in range(num_hilos):
        path = QPainterPath()
        first = True
        offset_radio = (h - 3.5) * 8
        offset_ang = h * 0.08

        for i in range(110):
            t = (i / 110) * 3.2 * math.pi
            r = 16 * math.exp(b_val * t) + offset_radio
            if r > 270:
                break
            ang = t + offset_ang - 0.4
            x = cx + r * math.cos(ang)
            y = cy + r * math.sin(ang)
            if first:
                path.moveTo(x, y)
                first = False
            else:
                path.lineTo(x, y)

        color_hex = colores_hilos[h % len(colores_hilos)]
        pen_w = 6 if h % 2 == 0 else 4
        pen = QPen(QColor(color_hex), pen_w, Qt.SolidLine, Qt.RoundCap)
        p.strokePath(path, pen)

    # Núcleo del cometa en la punta final con resplandor
    head_x = cx + 22 * math.cos(0.2)
    head_y = cy + 22 * math.sin(0.2)

    glow_comet = QRadialGradient(head_x, head_y, 70)
    glow_comet.setColorAt(0.0, QColor(255, 255, 255, 255))
    glow_comet.setColorAt(0.3, QColor(0, 242, 254, 200))
    glow_comet.setColorAt(0.7, QColor(37, 99, 235, 80))
    glow_comet.setColorAt(1.0, QColor(0, 0, 0, 0))

    p.setBrush(QBrush(glow_comet))
    p.setPen(Qt.NoPen)
    p.drawEllipse(QPointF(head_x, head_y), 70, 70)

    # Flecha estilizada en el vórtice final
    arr = QPainterPath()
    arr.moveTo(cx - 26, cy - 35)
    arr.lineTo(cx + 26, cy - 35)
    arr.lineTo(cx + 26, cy + 10)
    arr.lineTo(cx + 48, cy + 10)
    arr.lineTo(cx, cy + 68)
    arr.lineTo(cx - 48, cy + 10)
    arr.lineTo(cx - 26, cy + 10)
    arr.closeSubpath()

    p.setBrush(QBrush(QColor("#FFFFFF")))
    p.setPen(QPen(QColor("#00F2FE"), 3))
    p.drawPath(arr)

    dibujar_texto_andromeda(p)
    p.end()
    img.save(os.path.join(DIR_SALIDA, "propuesta_10.jpg"), "JPEG", 95)
    print("Propuesta 10 generada.")


if __name__ == "__main__":
    generar_propuesta_6()
    generar_propuesta_7()
    generar_propuesta_8()
    generar_propuesta_9()
    generar_propuesta_10()
    print("¡Las 5 nuevas propuestas Fibonacci (6 a 10) han sido creadas exitosamente!")
