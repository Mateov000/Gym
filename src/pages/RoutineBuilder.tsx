import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { fetchExercises, createStructuredRoutine } from '../lib/queries'

interface ParsedExercise {
  exercise_id: string
  originalName: string
  target_sets: number
  target_reps: number
  config: { sets_config: { reps: number; weight: number }[] }
}

interface ParsedDay {
  name: string
  exercises: ParsedExercise[]
}

interface ParsedRoutine {
  name: string
  folder: string
  notes: string
  days: ParsedDay[]
  errors: string[]
}

// ---> NUEVO: Helper súper inteligente para comparar nombres de ejercicios <---
// Transforma "Press de Bíceps  " a "press de biceps" (quita tildes, espacios extra y mayúsculas)
const normalize = (str: string) => 
  str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

export default function RoutineBuilder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [text, setText] = useState('')

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  // Motor de Parsing en tiempo real
  const parsedResult = useMemo(() => {
    const result: ParsedRoutine = { name: 'Nueva Rutina', folder: '', notes: '', days: [], errors: [] }
    if (!text.trim()) return result

    const lines = text.split('\n')
    let currentDay: ParsedDay | null = null

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim()
      if (!t) continue

      // Usamos Regex (/.../i) para que soporte espacios variables ("Rutina:", "Rutina : ", etc.)
      if (/^rutina\s*:/i.test(t)) { result.name = t.replace(/^rutina\s*:/i, '').trim(); continue }
      if (/^carpeta\s*:/i.test(t)) { result.folder = t.replace(/^carpeta\s*:/i, '').trim(); continue }
      if (/^notas\s*:/i.test(t)) { result.notes = t.replace(/^notas\s*:/i, '').trim(); continue }
      
      if (/^d[íi]a\s*:/i.test(t)) {
        currentDay = { name: t.replace(/^d[íi]a\s*:/i, '').trim(), exercises: [] }
        result.days.push(currentDay)
        continue
      }

      if (t.includes('|')) {
        if (!currentDay) { 
          result.errors.push(`Línea ${i + 1}: Encontré el ejercicio "${t.split('|')[0].trim()}" antes de definir un Día. Usa "Día: Nombre".`)
          continue 
        }

        const [exName, setsStr] = t.split('|').map(s => s.trim())
        
        // Búsqueda inteligente
        const ex = allExercises.find(e => normalize(e.name) === normalize(exName))
        if (!ex) {
           result.errors.push(`Línea ${i + 1}: El ejercicio "${exName}" no existe en tu catálogo. Escríbelo exactamente igual o créalo primero.`)
           continue
        }

        const setsArr = setsStr.split(',').map(s => s.trim())
        const sets_config = setsArr.map(s => {
           // Separa por 'x', 'X' o '*'
           const parts = s.split(/[xX*]/)
           
           // Extraemos SOLO los números. Esto permite escribir "10 reps x 20.5 kg" y que siga funcionando
           const repsStr = parts[0] ? parts[0].replace(/[^0-9]/g, '') : ''
           const weightStr = parts[1] ? parts[1].replace(/[^0-9.]/g, '') : ''

           const r = parseInt(repsStr) || 10
           const w = parseFloat(weightStr) || 0
           
           return { reps: r, weight: w }
        })

        currentDay.exercises.push({
           exercise_id: ex.id,
           originalName: ex.name,
           target_sets: sets_config.length,
           target_reps: sets_config[0]?.reps || 10,
           config: { sets_config }
        })
      }
    }

    if (result.days.length === 0 && text.trim().length > 10) {
      result.errors.push('No has definido ningún día. Usa "Día: Nombre del día"')
    }

    return result
  }, [text, allExercises])

  const saveMutation = useMutation({
    mutationFn: () => createStructuredRoutine(parsedResult.name, parsedResult.folder, parsedResult.notes, parsedResult.days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (error: any) => alert(`Error al guardar: ${error.message}`)
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/routines')} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Importador Estructurado</h1>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || parsedResult.errors.length > 0 || parsedResult.days.length === 0}
          className="bg-emerald-500 text-zinc-950 p-2 rounded-xl flex items-center gap-2 font-bold disabled:opacity-50"
        >
          <Save size={20} />
        </button>
      </div>

      {parsedResult.errors.length > 0 ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> Revisa estos errores:</div>
          <ul className="list-disc pl-5 space-y-1">
            {parsedResult.errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      ) : text.trim().length > 10 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl mb-4 flex items-center gap-2 text-sm font-bold">
          <CheckCircle2 size={18} /> Todo correcto. Listo para importar {parsedResult.days.length} días.
        </div>
      ) : null}

      <div className="bg-zinc-900 p-4 rounded-2xl mb-4">
        <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
          Pega aquí tu rutina. El sistema es inteligente: puedes usar "x", "X" o "*" y añadir "kg" o "lbs" al final de los pesos sin que se rompa.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 outline-none focus:border-emerald-500 h-[50vh] text-sm font-mono resize-none leading-relaxed"
          placeholder={`Rutina: Rutina Arnold\nCarpeta: Hipertrofia\nNotas: Alta frecuencia\n\nDía: Lunes - Pecho\nPress de Banca | 8x20, 7x18kg, 5x15\nAperturas | 10x10, 10X10, 10*10`}
        />
      </div>
    </div>
  )
}
