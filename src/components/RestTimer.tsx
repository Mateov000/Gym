import { useEffect, useRef, useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useWorkoutStore } from '../store/useWorkoutStore'

export default function RestTimer() {
  // Leemos si el cerebro global nos dice que debemos descansar
  const { isResting, restEndsAt, completeSet, stopRest } = useWorkoutStore()
  
  const [timeLeft, setTimeLeft] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const computeTimeLeft = () => {
    if (!restEndsAt) return 0
    return Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - Date.now()) / 1000))
  }

  // Cuando marcamos una serie, Zustand activa isResting y guarda el timestamp final.
  useEffect(() => {
    if (isResting) {
      setTimeLeft(computeTimeLeft())
      setIsVisible(true)
    } else {
      setIsVisible(false)
      setTimeLeft(0)
    }
  }, [isResting, restEndsAt])

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    
    if (isVisible) {
      interval = setInterval(() => {
        setTimeLeft(computeTimeLeft())
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [isVisible, restEndsAt])

  const closeTimer = () => {
    stopRest()
  }

  useEffect(() => {
    if (isVisible && timeLeft <= 0) {
      closeTimer()
    }
  }, [isVisible, timeLeft])

  const adjustTime = (deltaSeconds: number) => {
    const next = Math.max(0, timeLeft + deltaSeconds)
    if (next === 0) {
      closeTimer()
      return
    }
    completeSet(next)
  }

  useEffect(() => {
    const requestWakeLock = async () => {
      if (!isVisible || timeLeft <= 0 || !('wakeLock' in navigator)) return
      try {
        const lock = await (navigator as Navigator & {
          wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
        }).wakeLock?.request('screen')
        wakeLockRef.current = lock ?? null
      } catch {
        wakeLockRef.current = null
      }
    }

    const releaseWakeLock = async () => {
      if (!wakeLockRef.current) return
      await wakeLockRef.current.release()
      wakeLockRef.current = null
    }

    void requestWakeLock()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      void releaseWakeLock()
    }
  }, [isVisible, timeLeft])

  // Convierte los segundos en formato 01:30
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 bg-zinc-800 border border-zinc-700 rounded-2xl p-4 shadow-2xl shadow-black/50 flex items-center justify-between z-50 animate-in slide-in-from-bottom-5 fade-in duration-200">
      
      {/* Botón de restar tiempo */}
      <button 
        onClick={() => adjustTime(-30)}
        className="bg-zinc-700/50 p-2 rounded-lg text-zinc-300 active:bg-zinc-700"
      >
        <Minus size={20} />
      </button>

      {/* Reloj */}
      <div className="text-center">
        <p className="text-xs text-emerald-500 font-bold mb-1 uppercase tracking-wider">Descanso</p>
        <p className="text-3xl font-mono font-bold text-zinc-100">{formatTime(timeLeft)}</p>
      </div>

      {/* Botón de sumar tiempo */}
      <button 
        onClick={() => adjustTime(30)}
        className="bg-zinc-700/50 p-2 rounded-lg text-zinc-300 active:bg-zinc-700"
      >
        <Plus size={20} />
      </button>

      {/* Botón para cerrar/saltar descanso */}
      <button 
        onClick={closeTimer}
        className="absolute -top-3 -right-3 bg-zinc-700 border-2 border-zinc-800 text-zinc-300 p-1.5 rounded-full shadow-lg"
      >
        <X size={16} />
      </button>
    </div>
  )
}