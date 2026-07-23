import { Check } from 'lucide-react'

interface CheckInButtonProps {
  isCompleted: boolean
  onClick: () => void
}

export default function CheckInButton({ isCompleted, onClick }: CheckInButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full h-16 rounded-2xl flex items-center justify-center font-bold text-lg transition-all active:scale-95 ${
        isCompleted 
          ? 'bg-zinc-800 text-emerald-500 border-2 border-emerald-500/50' 
          : 'bg-emerald-500 text-zinc-950'
      }`}
    >
      {isCompleted ? (
        <span className="flex items-center gap-2"><Check size={24} /> Completada</span>
      ) : (
        'Marcar Serie'
      )}
    </button>
  )
}