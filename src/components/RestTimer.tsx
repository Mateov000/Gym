import { useEffect, useRef, useState } from 'react'
import { X, Plus, Minus, Timer } from 'lucide-react'
import { useWorkoutStore } from '../store/useWorkoutStore'

export default function RestTimer() {
  const { isResting, restEndsAt, completeSet, stopRest } = useWorkoutStore()
  
  const [timeLeft, setTimeLeft] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  const computeTimeLeft = () => {
    if (!restEndsAt) return 0
    return Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - Date.now()) / 1000))
  }

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!isVisible) return null

  return (
    <div className="w-full flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300 mt-3">
       
       <span className="text-xs text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1.5 hidden sm:flex">
         <Timer size={14} /> Descanso
       </span>
       <span className="text-xs text-emerald-500 font-bold uppercase tracking-widest flex sm:hidden">
         <Timer size={16} />
       </span>
       
       <div className="flex items-center gap-3">
         <button onClick={() => adjustTime(-30)} className="text-emerald-500/70 hover:text-emerald-400 active:scale-95 p-1.5 bg-emerald-500/10 rounded-md"><Minus size={16} /></button>
         <span className="text-emerald-400 font-mono font-bold text-lg min-w-[3rem] text-center">{formatTime(timeLeft)}</span>
         <button onClick={() => adjustTime(30)} className="text-emerald-500/70 hover:text-emerald-400 active:scale-95 p-1.5 bg-emerald-500/10 rounded-md"><Plus size={16} /></button>
       </div>

       <div className="flex items-center gap-2">
         <div className="w-px h-5 bg-emerald-500/20 hidden sm:block mx-1"></div>
         <button onClick={closeTimer} className="text-emerald-500/50 hover:text-emerald-500 active:scale-95 p-1"><X size={18} /></button>
       </div>
       
    </div>
  )
}
