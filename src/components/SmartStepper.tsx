import { Minus, Plus } from 'lucide-react'

interface SmartStepperProps {
  label: string
  value: number
  step: number
  unit?: string
  onChange: (newValue: number) => void
}

export default function SmartStepper({ label, value, step, unit = '', onChange }: SmartStepperProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value)
    onChange(isNaN(val) ? 0 : val)
  }

  return (
    <div className="flex flex-col bg-zinc-900 p-3 sm:p-4 rounded-2xl border border-zinc-800">
      <span className="text-zinc-400 text-xs sm:text-sm font-medium mb-3 text-center truncate">{label}</span>
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <button 
          onClick={() => onChange(Math.max(0, Number((value - step).toFixed(2))))}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-500 active:scale-95 active:bg-zinc-700 transition-all flex-shrink-0"
        >
          <Minus size={24} />
        </button>
        
        <div className="flex flex-col items-center justify-center flex-1">
          {/* ---> NUEVO: Caja de texto editable <--- */}
          <input 
            type="number"
            value={value.toString()} // string evita el cero a la izquierda molesto
            onChange={handleInputChange}
            className="bg-transparent text-2xl sm:text-3xl font-bold text-zinc-100 w-full text-center outline-none [&::-webkit-inner-spin-button]:appearance-none appearance-none"
            inputMode="decimal"
          />
          {unit && <span className="text-zinc-500 text-xs sm:text-sm truncate w-16 text-center">{unit}</span>}
        </div>

        <button 
          onClick={() => onChange(Number((value + step).toFixed(2)))}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-500 active:scale-95 active:bg-zinc-700 transition-all flex-shrink-0"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  )
}