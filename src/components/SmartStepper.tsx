import { Minus, Plus } from 'lucide-react'

interface SmartStepperProps {
  label: string
  value: number
  step: number
  unit?: string
  onChange: (newValue: number) => void
}

export default function SmartStepper({ label, value, step, unit = '', onChange }: SmartStepperProps) {
  return (
    <div className="flex flex-col bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
      <span className="text-zinc-400 text-sm font-medium mb-3 text-center">{label}</span>
      <div className="flex items-center justify-between gap-4">
        <button 
          onClick={() => onChange(Math.max(0, value - step))}
          className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-500 active:scale-95 active:bg-zinc-700 transition-all"
        >
          <Minus size={32} />
        </button>
        
        <div className="flex flex-col items-center justify-center min-w-[80px]">
          <span className="text-4xl font-bold text-zinc-100">{value}</span>
          {unit && <span className="text-zinc-500 text-sm">{unit}</span>}
        </div>

        <button 
          onClick={() => onChange(value + step)}
          className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-500 active:scale-95 active:bg-zinc-700 transition-all"
        >
          <Plus size={32} />
        </button>
      </div>
    </div>
  )
}