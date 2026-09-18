use crate::modelos::RoiMetrics;

pub const VELOCIDAD_BASE_NAVEGADOR_BPS: f64 = 2.5 * 1024.0 * 1024.0; // 2.5 MB/s

pub fn formatear_tamano_legible(bytes: u64) -> String {
    if bytes == 0 {
        return "0.00 B".to_string();
    }
    let unidades = ["B", "KB", "MB", "GB", "TB"];
    let mut val = bytes as f64;
    let mut idx = 0;
    while val >= 1024.0 && idx < unidades.len() - 1 {
        val /= 1024.0;
        idx += 1;
    }
    format!("{:.2} {}", val, unidades[idx])
}

pub fn formatear_velocidad(bps: f64) -> String {
    if bps <= 0.0 {
        return "0.00 B/s".to_string();
    }
    format!("{}/s", formatear_tamano_legible(bps as u64))
}

pub fn formatear_tiempo_segundos(segundos: f64) -> String {
    if segundos <= 0.0 || segundos.is_nan() || segundos.is_infinite() {
        return "0 s".to_string();
    }
    let segs_int = segundos.round() as u64;
    if segs_int < 60 {
        return format!("{} s", segs_int);
    }
    let mins = segs_int / 60;
    let resto_segs = segs_int % 60;
    if mins < 60 {
        if resto_segs > 0 {
            return format!("{} min {} s", mins, resto_segs);
        }
        return format!("{} min", mins);
    }
    let horas = mins / 60;
    let resto_mins = mins % 60;
    format!("{}h {}m", horas, resto_mins)
}

pub fn calcular_speed_duel(
    tamano_total: u64,
    descargado: u64,
    tiempo_transcurrido_seg: f64,
    _vel_actual_bps: f64,
    vel_ref_bps_opt: Option<f64>,
) -> RoiMetrics {
    let vel_ref = vel_ref_bps_opt.unwrap_or(VELOCIDAD_BASE_NAVEGADOR_BPS);
    let bytes_eval = if tamano_total > 0 { tamano_total } else { descargado };

    // Tiempo que habría tardado un navegador monohilo
    let tiempo_navegador_seg = if vel_ref > 0.0 {
        bytes_eval as f64 / vel_ref
    } else {
        0.0
    };

    let tiempo_andromeda_seg = tiempo_transcurrido_seg.max(0.1);
    let tiempo_ahorrado = (tiempo_navegador_seg - tiempo_andromeda_seg).max(0.0);

    let multiplicador = if tiempo_andromeda_seg > 0.0 {
        (tiempo_navegador_seg / tiempo_andromeda_seg).max(1.0)
    } else {
        1.0
    };

    let progreso_nav = if bytes_eval > 0 {
        let bytes_nav = (vel_ref * tiempo_andromeda_seg).min(bytes_eval as f64);
        ((bytes_nav / bytes_eval as f64) * 100.0).clamp(5.0, 95.0)
    } else {
        20.0
    };

    RoiMetrics {
        tiempo_ahorrado_segundos: tiempo_ahorrado,
        tiempo_ahorrado_str: formatear_tiempo_segundos(tiempo_ahorrado),
        multiplicador_aceleracion: (multiplicador * 10.0).round() / 10.0,
        multiplicador_str: format!("{:.1}x", multiplicador),
        tiempo_andromeda_segundos: tiempo_andromeda_seg,
        tiempo_andromeda_str: formatear_tiempo_segundos(tiempo_andromeda_seg),
        tiempo_navegador_segundos: tiempo_navegador_seg,
        tiempo_navegador_str: formatear_tiempo_segundos(tiempo_navegador_seg),
        vel_referencia_bps: vel_ref,
        vel_referencia_str: formatear_velocidad(vel_ref),
        progreso_nav_porcentaje: (progreso_nav * 10.0).round() / 10.0,
        porcentaje_diferencia: ((multiplicador - 1.0) * 100.0).max(0.0),
    }
}
