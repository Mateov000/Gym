import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, Play, Dumbbell, Bot } from 'lucide-react'
import { fetchExercises, createStructuredRoutine } from '../lib/queries'
import { COPY_AI_PROMPT } from './Settings'

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

  const parsedResult = useMemo(() => {
    const result: ParsedRoutine = { name: 'Nueva Rutina', folder: '', notes: '', days: [], errors: [] }
    if (!text.trim()) return result

    const lines = text.split('\n')
    let currentDay: ParsedDay | null = null

    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim()
      if (!t) continue

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
          result.errors.push(`Línea ${i + 1}: Encontré "${t.split('|')[0].trim()}" antes de definir un Día. Usa "Día: Nombre".`)
          continue 
        }

        const [exName, setsStr] = t.split('|').map(s => s.trim())
        const ex = allExercises.find(e => normalize(e.name) === normalize(exName))
        if (!ex) {
           result.errors.push(`Línea ${i + 1}: El ejercicio "${exName}" no existe en tu catálogo.`)
           continue
        }

        // ---> NUEVO PARSER MÁS INTELIGENTE QUE ENTIENDE PESOS CON '@' <---
        let target_sets = 0;
        let sets_config: { reps: number; weight: number }[] = [];

        // Buscamos formato simple: "4x10" o "4x10 @ 60"
        const simpleMatch = setsStr.match(/^(\d+)\s*[xX*]\s*(\d+)(?:\s*@\s*(\d+(?:\.\d+)?))?/);
        
        if (simpleMatch && !setsStr.includes(',')) {
            target_sets = parseInt(simpleMatch[1]);
            const reps = parseInt(simpleMatch[2]);
            const weight = simpleMatch[3] ? parseFloat(simpleMatch[3]) : 0;
            sets_config = Array(target_sets).fill({ reps, weight });
        } else {
            // Buscamos formato por serie: "10@50, 8@55, 6@60" o simplemente "10, 8, 6"
            const setsArr = setsStr.split(',').map(s => s.trim());
            target_sets = setsArr.length;
            sets_config = setsArr.map(s => {
                const [repsStr, weightStr] = s.split('@');
                const reps = parseInt(repsStr.replace(/[^0-9]/g, '')) || 10;
                const weight = weightStr ? parseFloat(weightStr.replace(/[^0-9.]/g, '')) : 0;
                return { reps, weight };
            });
        }

        currentDay.exercises.push({
           exercise_id: ex.id,
           originalName: ex.name,
           target_sets,
           target_reps: sets_config[0]?.reps || 10,
           config: { sets_config }
        })
      }
    }

    if (result.days.length === 0 && text.trim().length > 10) {
      result.errors.push('No has definido ningún día. Usa "Día: Nombre del día"')
    }
    return result
  } , [text, allExercises])

  const saveMutation = useMutation({
    mutationFn: () => createStructuredRoutine(parsedResult.name, parsedResult.folder, parsedResult.notes, parsedResult.days),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (error: any) => alert(`Error al guardar: ${error.message}`)
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/routines')} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Importador Estructurado</h1>
        <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || parsedResult.errors.length > 0 || parsedResult.days.length === 0} className="bg-zinc-800 text-zinc-100 p-2 rounded-xl flex items-center gap-2 font-bold disabled:opacity-50 active:scale-95 transition-transform" aria-label="Guardar">
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
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl mb-4 flex items-center justify-between text-sm font-bold">
          <div className="flex items-center gap-2"><CheckCircle2 size={18} /> Todo correcto.</div>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-500 text-zinc-950 px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-transform">
            <Play size={16} fill="currentColor" /> Guardar e Iniciar
          </button>
        </div>
      ) : null}

      <div className="bg-zinc-900 p-4 rounded-2xl mb-6">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-zinc-400 leading-relaxed pr-4">
            Pega aquí tu rutina. Usa "x" o "*" y añade "@ peso" al final si quieres indicar un peso inicial (Ej: 4x10 @ 60).
          </p>
          <button onClick={COPY_AI_PROMPT} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1.5 font-bold active:scale-95 transition-transform flex-shrink-0">
            <Bot size={14} /> Prompt IA
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 outline-none focus:border-emerald-500 h-48 text-sm font-mono resize-none leading-relaxed"
          placeholder={`Rutina: Fuerza y Volumen\nCarpeta: Hipertrofia\n\nDía: Lunes - Pecho\nPress de Banca | 4x8 @ 60\nAperturas | 12@10, 10@12.5, 8@15`}
        />
      </div>

      {parsedResult.days.length > 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Dumbbell size={14} /> Vista Previa
          </h2>
          
          <div className="space-y-4">
            {parsedResult.days.map((day, dIdx) => (
              <div key={dIdx} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4">
                <h3 className="text-lg font-bold text-emerald-500 mb-3 pb-2 border-b border-zinc-800/50">{day.name}</h3>
                <div className="flex flex-col gap-2">
                  {day.exercises.map((ex, eIdx) => (
                    <div key={eIdx} className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-zinc-100">{ex.originalName}</p>
                        <p className="text-[11px] text-zinc-500 mt-1 uppercase tracking-wider font-medium">
                          {ex.target_sets} series <span className="text-zinc-600 mx-1">|</span> {ex.config.sets_config.map(s => s.weight > 0 ? `${s.reps}@${s.weight}` : `${s.reps}`).join(', ')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}