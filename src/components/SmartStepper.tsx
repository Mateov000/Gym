import { Minus, Plus } from 'lucide-react'
import { useState, useEffect } from 'react'

interface SmartStepperProps {
  label: string
  value: number
  step: number
  unit?: string
  onChange: (newValue: number) => void
}

export default function SmartStepper({ label, value, step, unit = '', onChange }: SmartStepperProps) {
  const [localVal, setLocalVal] = useState(value.toString())

  useEffect(() => {
    // Solo sincroniza si el valor numérico es realmente distinto, 
    // así no borra la coma o el punto mientras el usuario lo está escribiendo (ej: "10.")
    const parsedLocal = parseFloat(localVal) || 0
    if (parsedLocal !== value && !(localVal === '' && value === 0)) {
      setLocalVal(value.toString())
    }
  }, [value, localVal])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convierte comas a puntos automáticamente y elimina caracteres inválidos
    let text = e.target.value.replace(',', '.')
    text = text.replace(/[^0-9.]/g, '') 
    
    // Previene que se escriban múltiples puntos (ej: "10.5.2")
    const parts = text.split('.')
    if (parts.length > 2) {
      text = parts[0] + '.' + parts.slice(1).join('')
    }

    setLocalVal(text)
    
    const parsed = parseFloat(text)
    if (!isNaN(parsed)) {
      onChange(parsed)
    } else if (text === '') {
      onChange(0)
    }
  }

  const handleStep = (direction: 1 | -1) => {
    const current = parseFloat(localVal) || 0
    const next = Math.max(0, Number((current + step * direction).toFixed(2)))
    setLocalVal(next.toString())
    onChange(next)
  }

  return (
    <div className="flex flex-col bg-zinc-900 p-3 sm:p-4 rounded-2xl border border-zinc-800">
      <span className="text-zinc-400 text-xs sm:text-sm font-medium mb-3 text-center truncate">{label}</span>
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        <button 
          onClick={() => handleStep(-1)}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-500 active:scale-95 active:bg-zinc-700 transition-all flex-shrink-0"
        >
          <Minus size={24} />
        </button>
        
        <div className="flex flex-col items-center justify-center flex-1">
          <input 
            type="text"
            inputMode="decimal"
            value={localVal} 
            onChange={handleInputChange}
            className="bg-transparent text-2xl sm:text-3xl font-bold text-zinc-100 w-full text-center outline-none [&::-webkit-inner-spin-button]:appearance-none appearance-none"
          />
          {unit && <span className="text-zinc-500 text-xs sm:text-sm truncate w-16 text-center">{unit}</span>}
        </div>

        <button 
          onClick={() => handleStep(1)}
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-emerald-500 active:scale-95 active:bg-zinc-700 transition-all flex-shrink-0"
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  )
}
