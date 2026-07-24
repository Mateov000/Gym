import { useEffect, useState, useCallback } from 'react'

export function useWakeLock(isActive: boolean) {
  // Usamos any temporalmente para evitar que TypeScript se queje en Vercel
  // si la versión de DOM no tiene WakeLockSentinel definido aún.
  const [wakeLock, setWakeLock] = useState<any | null>(null)

  const requestWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await (navigator as any).wakeLock.request('screen')
        setWakeLock(lock)
        console.log('Wake Lock activado: Pantalla encendida 🔥')
        
        lock.addEventListener('release', () => {
          console.log('Wake Lock liberado 💤')
        })
      }
    } catch (err: any) {
      console.error(`Error al solicitar Wake Lock: ${err.message}`)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    if (wakeLock !== null) {
      await wakeLock.release()
      setWakeLock(null)
    }
  }, [wakeLock])

  useEffect(() => {
    // Si la sesión está activa, encendemos el bloqueo
    if (isActive) {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }

    // Regla de oro: Si el usuario minimiza la app para contestar un WhatsApp 
    // y luego vuelve, el navegador destruye el Wake Lock. 
    // Necesitamos detectarlo y volver a activarlo.
    const handleVisibilityChange = () => {
      if (isActive && document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      releaseWakeLock()
    }
  }, [isActive, requestWakeLock, releaseWakeLock])
}