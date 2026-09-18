// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "windows")]
fn check_single_instance() -> bool {
    use std::io::Write;
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;

    if let Ok(addr) = "127.0.0.1:47990".parse::<SocketAddr>() {
        if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(300)) {
            // Enviar petición HTTP simple para activar la ventana existente
            let req = "GET /abrir HTTP/1.1\r\nHost: 127.0.0.1:47990\r\nConnection: close\r\n\r\n";
            let _ = stream.write_all(req.as_bytes());
            return false;
        }
    }
    true
}

fn main() {
    #[cfg(target_os = "windows")]
    {
        if !check_single_instance() {
            return;
        }
    }

    andromeda_lib::run();
}
