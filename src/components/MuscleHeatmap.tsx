import { useMemo } from 'react'

interface MuscleHeatmapProps {
  muscleData: Record<string, number> // Recibe { 'pecho': 12, 'espalda': 5, ... } (número de series)
}

// Mapeo del lenguaje natural de la app a las zonas del SVG
const GROUP_MAP: Record<string, string[]> = {
  'pecho': ['chest'],
  'espalda': ['lats', 'traps'],
  'piernas': ['quads', 'hamstrings', 'glutes'],
  'cuadriceps': ['quads'],
  'cuádriceps': ['quads'],
  'isquiotibiales': ['hamstrings'],
  'gluteos': ['glutes'],
  'glúteos': ['glutes'],
  'glúteo': ['glutes'],
  'hombros': ['shoulders'],
  'hombro': ['shoulders'],
  'brazos': ['biceps', 'triceps'],
  'biceps': ['biceps'],
  'bíceps': ['biceps'],
  'triceps': ['triceps'],
  'tríceps': ['triceps'],
  'core': ['abs'],
  'abdomen': ['abs'],
  'gemelos': ['calves'],
  'pantorrillas': ['calves']
}

export default function MuscleHeatmap({ muscleData }: MuscleHeatmapProps) {
  // Consolida los datos según nuestro mapeo
  const mappedData = useMemo(() => {
    const data: Record<string, number> = {
      chest: 0, lats: 0, traps: 0, shoulders: 0, biceps: 0, 
      triceps: 0, abs: 0, quads: 0, hamstrings: 0, glutes: 0, calves: 0
    }
    
    Object.entries(muscleData).forEach(([rawName, sets]) => {
      const normalized = rawName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()
      // Busca coincidencias en el diccionario
      Object.entries(GROUP_MAP).forEach(([key, targets]) => {
        if (normalized.includes(key)) {
          targets.forEach(t => data[t] += sets)
        }
      })
    })
    return data
  }, [muscleData])

  // Lógica termográfica: Gris -> Verde -> Amarillo -> Rojo
  const getColor = (sets: number) => {
    if (sets === 0) return '#27272a' // zinc-800 (Inactivo)
    if (sets < 5) return '#047857'   // emerald-700 (Volumen bajo)
    if (sets <= 12) return '#10b981' // emerald-500 (Volumen óptimo)
    if (sets <= 18) return '#eab308' // yellow-500 (Volumen alto)
    return '#ef4444'                 // red-500 (Volumen extremo / Posible sobreentrenamiento)
  }

  return (
    <div className="flex justify-center items-center gap-8 py-4">
      {/* --- FRENTE --- */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Frente</span>
        <svg viewBox="0 0 100 200" className="w-24 sm:w-32 drop-shadow-2xl">
          {/* Cabeza */}
          <circle cx="50" cy="15" r="10" fill="#27272a" />
          {/* Cuello/Trapecios (Frontal) */}
          <path d="M40 25 L60 25 L65 35 L35 35 Z" fill={getColor(mappedData.traps)} stroke="#09090b" strokeWidth="1"/>
          {/* Hombros */}
          <circle cx="30" cy="40" r="8" fill={getColor(mappedData.shoulders)} stroke="#09090b" strokeWidth="1"/>
          <circle cx="70" cy="40" r="8" fill={getColor(mappedData.shoulders)} stroke="#09090b" strokeWidth="1"/>
          {/* Pecho */}
          <path d="M35 35 L65 35 L65 55 L50 60 L35 55 Z" fill={getColor(mappedData.chest)} stroke="#09090b" strokeWidth="1"/>
          {/* Abdomen / Core */}
          <path d="M38 58 L62 58 L60 90 L40 90 Z" fill={getColor(mappedData.abs)} stroke="#09090b" strokeWidth="1"/>
          {/* Bíceps (Brazos) */}
          <path d="M22 45 L32 45 L30 70 L20 70 Z" fill={getColor(mappedData.biceps)} stroke="#09090b" strokeWidth="1"/>
          <path d="M68 45 L78 45 L80 70 L70 70 Z" fill={getColor(mappedData.biceps)} stroke="#09090b" strokeWidth="1"/>
          {/* Antebrazos */}
          <path d="M18 70 L30 70 L28 95 L16 95 Z" fill="#27272a" stroke="#09090b" strokeWidth="1"/>
          <path d="M70 70 L82 70 L84 95 L72 95 Z" fill="#27272a" stroke="#09090b" strokeWidth="1"/>
          {/* Cuádriceps (Piernas Frontales) */}
          <path d="M38 90 L50 90 L48 140 L35 140 Z" fill={getColor(mappedData.quads)} stroke="#09090b" strokeWidth="1"/>
          <path d="M50 90 L62 90 L65 140 L52 140 Z" fill={getColor(mappedData.quads)} stroke="#09090b" strokeWidth="1"/>
          {/* Gemelos (Frontal) */}
          <path d="M35 145 L48 145 L46 190 L36 190 Z" fill={getColor(mappedData.calves)} stroke="#09090b" strokeWidth="1"/>
          <path d="M52 145 L65 145 L64 190 L54 190 Z" fill={getColor(mappedData.calves)} stroke="#09090b" strokeWidth="1"/>
        </svg>
      </div>

      {/* --- ESPALDA --- */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase">Espalda</span>
        <svg viewBox="0 0 100 200" className="w-24 sm:w-32 drop-shadow-2xl">
          {/* Cabeza */}
          <circle cx="50" cy="15" r="10" fill="#27272a" />
          {/* Trapecios */}
          <path d="M40 25 L60 25 L65 40 L50 65 L35 40 Z" fill={getColor(mappedData.traps)} stroke="#09090b" strokeWidth="1"/>
          {/* Hombros */}
          <circle cx="30" cy="40" r="8" fill={getColor(mappedData.shoulders)} stroke="#09090b" strokeWidth="1"/>
          <circle cx="70" cy="40" r="8" fill={getColor(mappedData.shoulders)} stroke="#09090b" strokeWidth="1"/>
          {/* Dorsales (Lats) */}
          <path d="M35 45 L50 65 L65 45 L62 80 L50 90 L38 80 Z" fill={getColor(mappedData.lats)} stroke="#09090b" strokeWidth="1"/>
          {/* Tríceps (Brazos) */}
          <path d="M22 45 L32 45 L30 70 L20 70 Z" fill={getColor(mappedData.triceps)} stroke="#09090b" strokeWidth="1"/>
          <path d="M68 45 L78 45 L80 70 L70 70 Z" fill={getColor(mappedData.triceps)} stroke="#09090b" strokeWidth="1"/>
          {/* Antebrazos */}
          <path d="M18 70 L30 70 L28 95 L16 95 Z" fill="#27272a" stroke="#09090b" strokeWidth="1"/>
          <path d="M70 70 L82 70 L84 95 L72 95 Z" fill="#27272a" stroke="#09090b" strokeWidth="1"/>
          {/* Glúteos */}
          <path d="M38 90 L62 90 L65 110 L50 115 L35 110 Z" fill={getColor(mappedData.glutes)} stroke="#09090b" strokeWidth="1"/>
          {/* Isquiotibiales (Piernas Traseras) */}
          <path d="M36 112 L49 115 L48 140 L35 140 Z" fill={getColor(mappedData.hamstrings)} stroke="#09090b" strokeWidth="1"/>
          <path d="M51 115 L64 112 L65 140 L52 140 Z" fill={getColor(mappedData.hamstrings)} stroke="#09090b" strokeWidth="1"/>
          {/* Gemelos (Trasero) */}
          <path d="M34 145 L48 145 L46 190 L36 190 Z" fill={getColor(mappedData.calves)} stroke="#09090b" strokeWidth="1"/>
          <path d="M52 145 L66 145 L64 190 L54 190 Z" fill={getColor(mappedData.calves)} stroke="#09090b" strokeWidth="1"/>
        </svg>
      </div>
    </div>
  )
}