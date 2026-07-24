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
  errors: string[] // Guardamos errores para avisarle al usuario
}

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

    for (const line of lines) {
      const t = line.trim()
      if (!t) continue

      if (t.toLowerCase().startsWith('rutina:')) { result.name = t.substring(7).trim(); continue }
      if (t.toLowerCase().startsWith('carpeta:')) { result.folder = t.substring(8).trim(); continue }
      if (t.toLowerCase().startsWith('notas:')) { result.notes = t.substring(6).trim(); continue }
      
      if (t.toLowerCase().startsWith('día:') || t.toLowerCase().startsWith('dia:')) {
        currentDay = { name: t.substring(4).trim(), exercises: [] }
        result.days.push(currentDay)
        continue
      }

      if (t.includes('|')) {
        if (!currentDay) { 
          result.errors.push(`Encontré el ejercicio "${t}" antes de definir un Día. Usa "Día: Nombre" arriba.`)
          continue 
        }

        const [exName, setsStr] = t.split('|').map(s => s.trim())
        
        // Búsqueda insensible a mayúsculas
        const ex = allExercises.find(e => e.name.toLowerCase() === exName.toLowerCase())
        if (!ex) {
           result.errors.push(`El ejercicio "${exName}" no existe en tu catálogo. Créalo primero.`)
           continue
        }

        const setsArr = setsStr.split(',').map(s => s.trim())
        const sets_config = setsArr.map(s => {
           const [r, w] = s.split('x').map(Number)
           return { reps: r || 10, weight: w || 0 }
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

    // Validaciones finales
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
          <div className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> Hay errores en tu texto:</div>
          <ul className="list-disc pl-5">
            {parsedResult.errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      ) : text.trim().length > 10 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl mb-4 flex items-center gap-2 text-sm font-bold">
          <CheckCircle2 size={18} /> Todo correcto. Listo para importar {parsedResult.days.length} días.
        </div>
      ) : null}

      <div className="bg-zinc-900 p-4 rounded-2xl mb-4">
        <p className="text-xs text-zinc-400 mb-2">
          Pega aquí tu rutina estructurada. El sistema la procesará en tiempo real.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 outline-none focus:border-emerald-500 h-[50vh] text-sm font-mono resize-none leading-relaxed"
          placeholder={`Rutina: Rutina Arnold\nCarpeta: Hipertrofia\nNotas: Alta frecuencia\n\nDía: Lunes - Pecho\nPress de Banca | 8x20, 7x18, 5x15\nAperturas | 10x10, 10x10`}
        />
      </div>
    </div>
  )
}
