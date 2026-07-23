import { useEffect, useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { useWorkoutStore } from '../store/useWorkoutStore'

export default function RestTimer() {
  // Leemos si el cerebro global nos dice que debemos descansar
  const { isResting } = useWorkoutStore()
  
  const [timeLeft, setTimeLeft] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  // Cuando marcamos una serie, Zustand activa isResting
  useEffect(() => {
    if (isResting) {
      setTimeLeft(90) // 1:30 por defecto
      setIsVisible(true)
    }
  }, [isResting])

  // La lógica de la cuenta regresiva
  // La lógica de la cuenta regresiva
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    
    if (isVisible && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => prev - 1)
      }, 1000)
    } else if (timeLeft <= 0 && isVisible) {
      // Cuando llega a 0, se cierra automáticamente
      closeTimer()
    }
    
    return () => clearInterval(interval)
  }, [isVisible, timeLeft])

  const closeTimer = () => {
    setIsVisible(false)
    // Apagamos el estado de descanso modificando Zustand directamente
    useWorkoutStore.setState({ isResting: false })
  }

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
        onClick={() => setTimeLeft(prev => Math.max(0, prev - 30))}
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
        onClick={() => setTimeLeft(prev => prev + 30)}
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