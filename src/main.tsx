import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient.ts'
import { registerSW } from 'virtual:pwa-register'

// Registramos el Service Worker para que la estructura base funcione offline
registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('Gym PWA lista para uso offline.')
  },
})

// Escuchamos los cambios de red (WiFi/4G vs Modo Avión)
onlineManager.setEventListener((setOnline) => {
  const handleOnline = () => setOnline(true)
  const handleOffline = () => setOnline(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
})

// Creamos el disco duro virtual conectado al localStorage
const persister = createSyncStoragePersister({
  storage: window.localStorage,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ 
        persister, 
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 días de almacenamiento offline
      }} 
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)