import { Dumbbell } from 'lucide-react'

interface PlateMathProps {
  weight: number
}

export default function PlateMath({ weight }: PlateMathProps) {
  // En el futuro, estos valores vendrán de la configuración del usuario
  const BAR_WEIGHT = 20
  const AVAILABLE_PLATES = [20, 15, 10, 5, 2.5, 1.25]

  // Calcular peso por lado
  let perSide = (weight - BAR_WEIGHT) / 2
  const plates: number[] = []

  if (perSide > 0) {
    AVAILABLE_PLATES.forEach(plate => {
      while (perSide >= plate) {
        plates.push(plate)
        // Redondeamos para evitar el clásico error de decimales infinitos en JavaScript
        perSide = Math.round((perSide - plate) * 100) / 100 
      }
    })
  }

  // Si el peso es menor o igual a la barra
  if (weight <= BAR_WEIGHT) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 text-center mt-4">
        <p className="text-zinc-400 text-sm">Solo usar la barra ({BAR_WEIGHT}kg)</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-zinc-400">
          <Dumbbell size={16} />
          <span className="text-sm font-medium">Discos por lado</span>
        </div>
        <span className="text-xs text-zinc-500">Barra: {BAR_WEIGHT}kg</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {plates.length === 0 ? (
          <span className="text-zinc-500 text-sm">Peso imposible de armar</span>
        ) : (
          plates.map((plate, index) => (
            <div 
              key={index}
              className="bg-zinc-800 border border-emerald-500/20 text-emerald-500 font-bold px-3 py-2 rounded-xl flex items-center justify-center min-w-[3rem] shadow-sm shadow-black/20"
            >
              {plate}
            </div>
          ))
        )}
      </div>
    </div>
  )
}