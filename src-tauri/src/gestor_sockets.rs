use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::Semaphore;

#[derive(Clone)]
pub struct GestorSockets {
    semaphore: Arc<Semaphore>,
    max_sockets: usize,
    sockets_en_uso: Arc<AtomicUsize>,
    total_aperturas: Arc<AtomicUsize>,
}

impl GestorSockets {
    pub fn new(max_sockets: usize) -> Self {
        Self {
            semaphore: Arc::new(Semaphore::new(max_sockets)),
            max_sockets,
            sockets_en_uso: Arc::new(AtomicUsize::new(0)),
            total_aperturas: Arc::new(AtomicUsize::new(0)),
        }
    }

    pub async fn adquirir_socket(&self) -> bool {
        match self.semaphore.clone().acquire_owned().await {
            Ok(permit) => {
                self.sockets_en_uso.fetch_add(1, Ordering::SeqCst);
                self.total_aperturas.fetch_add(1, Ordering::SeqCst);
                // Olvidamos el permit explícito para liberarlo manualmente en liberar_socket
                permit.forget();
                true
            }
            Err(_) => false,
        }
    }

    pub fn liberar_socket(&self) {
        let current = self.sockets_en_uso.load(Ordering::SeqCst);
        if current > 0 {
            self.sockets_en_uso.fetch_sub(1, Ordering::SeqCst);
            self.semaphore.add_permits(1);
        }
    }

    pub fn sockets_activos(&self) -> usize {
        self.sockets_en_uso.load(Ordering::SeqCst)
    }

    pub fn max_sockets(&self) -> usize {
        self.max_sockets
    }
}
