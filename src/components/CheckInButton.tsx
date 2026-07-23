import { useRef, useState } from 'react'
import { Check } from 'lucide-react'

interface CheckInButtonProps {
  isCompleted: boolean
  onClick: () => void
}

export default function CheckInButton({ isCompleted, onClick }: CheckInButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const startXRef = useRef<number | null>(null)
  const hasTriggeredSwipeRef = useRef(false)
  const [swipeProgress, setSwipeProgress] = useState(0)

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (isCompleted) return
    startXRef.current = event.clientX
    hasTriggeredSwipeRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (startXRef.current === null || !buttonRef.current || isCompleted) return

    const deltaX = Math.max(0, event.clientX - startXRef.current)
    const width = buttonRef.current.offsetWidth
    const nextProgress = Math.min(100, (deltaX / width) * 100)
    setSwipeProgress(nextProgress)

    if (nextProgress >= 55 && !hasTriggeredSwipeRef.current) {
      hasTriggeredSwipeRef.current = true
      onClick()
      startXRef.current = null
      setSwipeProgress(0)
    }
  }

  const handlePointerEnd = () => {
    startXRef.current = null
    setSwipeProgress(0)
  }

  return (
    <button
      ref={buttonRef}
      onClick={() => {
        if (!hasTriggeredSwipeRef.current && !isCompleted) onClick()
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      className={`w-full h-16 rounded-2xl flex items-center justify-center font-bold text-lg transition-all active:scale-95 ${
        isCompleted 
          ? 'bg-zinc-800 text-emerald-500 border-2 border-emerald-500/50' 
          : 'bg-emerald-500 text-zinc-950'
      }`}
      style={{
        backgroundImage: isCompleted
          ? undefined
          : `linear-gradient(to right, rgba(9,9,11,0.2) ${swipeProgress}%, transparent ${swipeProgress}%)`,
      }}
    >
      {isCompleted ? (
        <span className="flex items-center gap-2"><Check size={24} /> Completada</span>
      ) : (
        'Desliza o toca para marcar serie'
      )}
    </button>
  )
}