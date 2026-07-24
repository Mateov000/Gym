import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wand2, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { fetchExercises, createRoutine } from '../lib/queries'
import { parseRoutineText } from '../lib/nlpParser'

export default function RoutineBuilder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [name, setName] = useState('')
  const [textInput, setTextInput] = useState('')

  const { data: catalog = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  // Traduce el texto a objetos estructurados
  const parsedLines = useMemo(() => parseRoutineText(textInput), [textInput])

  // Intenta encontrar cada línea en el catálogo de Supabase
  const matchedExercises = useMemo(() => {
    return parsedLines.map(line => {
      // Búsqueda simple en minúsculas (fuzzy matching)
      const match = catalog.find(ex => 
        ex.name.toLowerCase().includes(line.exerciseName.toLowerCase()) ||
        line.exerciseName.toLowerCase().includes(ex.name.toLowerCase())
      )
      return { ...line, catalogMatch: match }
    })
  }, [parsedLines, catalog])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Por favor, ponle un nombre a tu rutina.')
      
      const validExercises = matchedExercises.filter(m => m.catalogMatch)
      if (validExercises.length === 0) throw new Error('No hay ejercicios válidos reconocidos para guardar.')

      await createRoutine(
        name,
        textInput, // Guardamos el texto original como "notas" de la rutina
        validExercises.map(ex => ({
          exercise_id: ex.catalogMatch!.id,
          sets: ex.targetSets,
          reps: ex.targetReps
        }))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (err: any) => {
      alert(`Error al guardar: ${err.message}`)
    }
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Header Fijo */}
      <div className="sticky top-0 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 z-10 flex items-center justify-between">
        <button onClick={() => navigate('/routines')} className="text-zinc-400 p-2 active:bg-zinc-800 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-bold text-lg">Nueva Rutina (NLP)</h1>
        <button 
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="text-emerald-500 font-bold p-2 active:bg-zinc-800 rounded-xl flex items-center gap-2"
        >
          {saveMutation.isPending ? 'Guardando...' : <><Save size={20}/> Guardar</>}
        </button>
      </div>

      <div className="p-4 pb-24 flex-1 flex flex-col gap-6">
        <input 
          type="text" 
          placeholder="Nombre de la Rutina (ej. Pecho y Tríceps)" 
          value={name}
          onChange={e => setName(e.target.value)}
          className="bg-transparent border-b-2 border-zinc-800 focus:border-emerald-500 text-2xl font-bold py-2 outline-none w-full"
        />

        <div className="flex flex-col gap-2">
          <label className="text-emerald-500 font-bold flex items-center gap-2 text-sm uppercase tracking-wide">
            <Wand2 size={16} /> Escribe libremente
          </label>
          <textarea 
            placeholder="Ejemplo:&#10;Press de Banca 4x8&#10;Sentadilla 3x10&#10;Dominadas 3xMax"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 h-48 focus:border-emerald-500 outline-none resize-none"
          />
          <p className="text-xs text-zinc-500 mt-1">
            Usa el formato: [Nombre] [Series]x[Reps]
          </p>
        </div>

        {/* Vista previa de la Inteligencia de Mapeo */}
        {textInput.trim() && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <h3 className="font-bold text-zinc-400 text-sm mb-3 uppercase tracking-wide">Vista Previa</h3>
            <div className="flex flex-col gap-3">
              {matchedExercises.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                  <div className="flex items-center gap-3">
                    {item.catalogMatch ? (
                      <CheckCircle2 className="text-emerald-500 min-w-[20px]" size={20} />
                    ) : (
                      <AlertCircle className="text-yellow-500 min-w-[20px]" size={20} />
                    )}
                    <div>
                      <p className={`font-bold text-sm ${item.catalogMatch ? 'text-zinc-100' : 'text-zinc-500 line-through'}`}>
                        {item.catalogMatch?.name || item.exerciseName}
                      </p>
                      <p className="text-xs text-zinc-400">
                        {item.targetSets} series x {item.targetReps ? `${item.targetReps} reps` : 'Al fallo'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}