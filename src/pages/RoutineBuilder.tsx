import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, Play, Dumbbell, Bot, Info, ChevronDown, ChevronUp, Globe2, Lock } from 'lucide-react'
import { fetchExercises, createStructuredRoutine, createExercise } from '../lib/queries'
import { COPY_AI_PROMPT } from './Settings'
import type { Exercise } from '../types/workout'

const normalize = (str: string) => 
  str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

function parseExercisesText(text: string): Partial<Exercise>[] {
  const exercises: Partial<Exercise>[] = []
  const blocks = text.split(/\n\s*\n/)
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    const ex: Partial<Exercise> = {}
    let isParsingDesc = false
    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      if (lowerLine.startsWith('nombre:')) { ex.name = line.substring(7).trim(); isParsingDesc = false }
      else if (lowerLine.startsWith('grupo:')) { ex.muscle_group = line.substring(6).trim(); isParsingDesc = false }
      else if (lowerLine.startsWith('imagen:')) { ex.image_url = line.substring(7).trim(); isParsingDesc = false }
      else if (lowerLine.startsWith('descripcion:')) { ex.description = line.substring(12).trim(); isParsingDesc = true }
      else if (isParsingDesc) { ex.description = (ex.description || '') + '\n' + line.trim() }
    }
    if (ex.name) exercises.push(ex)
  }
  return exercises
}

interface ParsedAlternative {
  originalName: string
  exercise_id: string
  is_new?: boolean
  is_specified?: boolean
}

interface ParsedExercise {
  exercise_id: string
  originalName: string
  target_sets: number
  target_reps: number
  is_new?: boolean
  is_specified?: boolean
  alternatives?: ParsedAlternative[]
  config: { sets_config: { reps: number; weight: number }[], routine_alternatives?: string[] }
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
  autoCount: number
  specifiedCount: number
}

export default function RoutineBuilder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [text, setText] = useState('')
  const [exercisesText, setExercisesText] = useState('')
  const [showExDefs, setShowExDefs] = useState(false)
  const [importAsPublic, setImportAsPublic] = useState(false)

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const parsedResult = useMemo(() => {
    const result: ParsedRoutine = { name: 'Nueva Rutina', folder: '', notes: '', days: [], errors: [], autoCount: 0, specifiedCount: 0 }
    if (!text.trim()) return result

    // 1. Extraer las definiciones de los ejercicios (leyendo de AMBAS cajas)
    const combinedText = text + '\n\n' + exercisesText;
    const parsedDefs = parseExercisesText(combinedText);
    const specifiedNames = new Set(parsedDefs.map(d => normalize(d.name || '')));

    const uniqueNewEx = new Set<string>()

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

        const [exStr, setsStr] = t.split('|').map(s => s.trim())
        
        const exNames = exStr.split(/\s+\/\s+/).map(s => s.trim())
        const mainExName = exNames[0]
        const altNames = exNames.slice(1)

        let target_sets = 0;
        let sets_config: { reps: number; weight: number }[] = [];

        const simpleMatch = setsStr.match(/^(\d+)\s*[xX*]\s*(\d+)(?:\s*@\s*(\d+(?:\.\d+)?))?/);
        if (simpleMatch && !setsStr.includes(',')) {
            target_sets = parseInt(simpleMatch[1]);
            const reps = parseInt(simpleMatch[2]);
            const weight = simpleMatch[3] ? parseFloat(simpleMatch[3]) : 0;
            sets_config = Array(target_sets).fill({ reps, weight });
        } else {
            const setsArr = setsStr.split(',').map(s => s.trim());
            target_sets = setsArr.length;
            sets_config = setsArr.map(s => {
                const [repsStr, weightStr] = s.split('@');
                const reps = parseInt(repsStr.replace(/[^0-9]/g, '')) || 10;
                const weight = weightStr ? parseFloat(weightStr.replace(/[^0-9.]/g, '')) : 0;
                return { reps, weight };
            });
        }

        // Resolución del Ejercicio Principal
        const ex = allExercises.find(e => normalize(e.name) === normalize(mainExName))
        let is_new = false;
        let is_specified = false;
        let exercise_id = ex?.id || 'NEW';
        
        if (!ex) { 
          is_new = true; 
          const norm = normalize(mainExName);
          is_specified = specifiedNames.has(norm);

          if (!uniqueNewEx.has(norm)) { 
            uniqueNewEx.add(norm); 
            if (is_specified) result.specifiedCount++; else result.autoCount++;
          }
        }

        // Resolución de Alternativas
        const alternatives = altNames.map(altName => {
           const altEx = allExercises.find(e => normalize(e.name) === normalize(altName))
           let alt_is_new = false;
           let alt_is_specified = false;

           if (!altEx) { 
             alt_is_new = true; 
             const normAlt = normalize(altName);
             alt_is_specified = specifiedNames.has(normAlt);

             if (!uniqueNewEx.has(normAlt)) { 
                uniqueNewEx.add(normAlt); 
                if (alt_is_specified) result.specifiedCount++; else result.autoCount++;
             }
           }
           return { originalName: altName, exercise_id: altEx?.id || 'NEW', is_new: alt_is_new, is_specified: alt_is_specified }
        })

        currentDay.exercises.push({
           exercise_id,
           originalName: mainExName,
           target_sets,
           target_reps: sets_config[0]?.reps || 10,
           is_new,
           is_specified,
           alternatives,
           config: { sets_config }
        })
      }
    }

    if (result.days.length === 0 && text.trim().length > 10) {
      result.errors.push('No has definido ningún día. Usa "Día: Nombre del día"')
    }
    return result
  } , [text, exercisesText, allExercises])

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Parsear combinando ambos cuadros
      const defs = parseExercisesText(text + '\n\n' + exercisesText);
      const defMap = new Map(defs.map(d => [normalize(d.name!), d]));
      const newExMap = new Map<string, string>(); 

      const daysToSave = [...parsedResult.days]
      
      for (const day of daysToSave) {
         for (const ex of day.exercises) {
            
            if (ex.is_new) {
               const norm = normalize(ex.originalName);
               if (newExMap.has(norm)) {
                 ex.exercise_id = newExMap.get(norm)!;
               } else {
                 const manualDef = defMap.get(norm);
                 const createdEx = await createExercise({ 
                   name: ex.originalName, 
                   muscle_group: manualDef?.muscle_group || 'Otro', 
                   description: manualDef?.description || '',
                   image_url: manualDef?.image_url || '',
                   is_public: importAsPublic
                 });
                 ex.exercise_id = createdEx.id;
                 newExMap.set(norm, createdEx.id);
               }
            }

            if (ex.alternatives && ex.alternatives.length > 0) {
               const altIds = []
               for (const alt of ex.alternatives) {
                  if (alt.is_new) {
                     const normAlt = normalize(alt.originalName);
                     if (newExMap.has(normAlt)) {
                       altIds.push(newExMap.get(normAlt)!);
                     } else {
                       const manualDef = defMap.get(normAlt);
                       const createdAlt = await createExercise({ 
                         name: alt.originalName, 
                         muscle_group: manualDef?.muscle_group || 'Otro', 
                         description: manualDef?.description || '',
                         image_url: manualDef?.image_url || '',
                         is_public: importAsPublic
                       });
                       altIds.push(createdAlt.id);
                       newExMap.set(normAlt, createdAlt.id);
                     }
                  } else {
                    altIds.push(alt.exercise_id)
                  }
               }
               ex.config.routine_alternatives = altIds
            }
         }
      }
      return createStructuredRoutine(parsedResult.name, parsedResult.folder, parsedResult.notes, daysToSave)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      queryClient.invalidateQueries({ queryKey: ['exercises', 'catalog'] })
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
        <div className="flex flex-col gap-3 mb-4">
           {(parsedResult.autoCount > 0 || parsedResult.specifiedCount > 0) && (
             <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-2xl flex flex-col gap-1.5 text-sm font-bold">
               <div className="flex items-center gap-2">
                 <Info size={18} className="flex-shrink-0" />
                 Se crearán {parsedResult.autoCount + parsedResult.specifiedCount} ejercicios nuevos automáticamente.
               </div>
               <ul className="pl-7 text-xs text-yellow-500/80 font-normal list-disc space-y-0.5">
                  {parsedResult.specifiedCount > 0 && <li><strong>{parsedResult.specifiedCount}</strong> fueron especificados por ti con detalles.</li>}
                  {parsedResult.autoCount > 0 && <li><strong>{parsedResult.autoCount}</strong> se crearán con datos en blanco.</li>}
               </ul>
             </div>
           )}
           <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-2xl flex items-center justify-between text-sm font-bold">
             <div className="flex items-center gap-2"><CheckCircle2 size={18} /> Todo correcto.</div>
             <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-emerald-500 text-zinc-950 px-3 py-1.5 rounded-lg flex items-center gap-1 active:scale-95 transition-transform">
               <Play size={16} fill="currentColor" /> Guardar e Iniciar
             </button>
           </div>
        </div>
      ) : null}

      <div className="bg-zinc-900 p-4 rounded-2xl mb-4">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs text-zinc-400 leading-relaxed pr-4">
            Pega aquí tu rutina. Puedes definir los detalles de los ejercicios nuevos aquí mismo, o en la caja de abajo.
          </p>
          <button onClick={COPY_AI_PROMPT} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1.5 rounded-lg flex items-center gap-1.5 font-bold active:scale-95 transition-transform flex-shrink-0">
            <Bot size={14} /> Prompt IA
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 outline-none focus:border-emerald-500 h-64 text-sm font-mono resize-none leading-relaxed"
          placeholder={`Rutina: Fuerza y Volumen\n\nDía: Lunes\nPress Banca / Mancuernas | 4x8 @ 60\nEjercicio Inventado | 3x10\n\nNombre: Ejercicio Inventado\nGrupo: Pecho\nDescripcion: Así se hace...`}
        />
      </div>

      {(parsedResult.autoCount > 0 || parsedResult.specifiedCount > 0) && (
        <div className="mb-6">
          <button onClick={() => setShowExDefs(!showExDefs)} className="text-xs text-emerald-500 font-bold mb-2 flex items-center gap-1 bg-emerald-500/10 px-3 py-2 rounded-lg active:scale-95 transition-all w-full justify-between">
            <span className="flex items-center gap-2">
              {showExDefs ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
              Añadir detalles a ejercicios por separado (Opcional)
            </span>
          </button>
          
          {showExDefs && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              
              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-4 flex items-center justify-between">
                <div className="pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    {importAsPublic ? <Globe2 size={16} className="text-emerald-500" /> : <Lock size={16} className="text-blue-400" />}
                    <p className="font-bold text-zinc-100">Visibilidad</p>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    {importAsPublic ? 'Todos verán los ejercicios nuevos en su catálogo.' : 'Solo tú podrás ver y usar los ejercicios nuevos.'}
                  </p>
                </div>
                <button onClick={() => setImportAsPublic(!importAsPublic)} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${importAsPublic ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                  <div className={`absolute top-1 left-1 bg-zinc-950 w-4 h-4 rounded-full transition-transform ${importAsPublic ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-4">
                <div className="flex items-start justify-between mb-2">
                  <h2 className="text-sm font-bold text-emerald-500">Formato requerido:</h2>
                  <button onClick={COPY_AI_PROMPT} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-lg flex items-center gap-1.5 font-bold active:scale-95 transition-transform">
                    <Bot size={12} /> Prompt IA
                  </button>
                </div>
                <pre className="text-[10px] text-zinc-300 bg-zinc-950 p-3 rounded-xl overflow-x-auto border border-zinc-800">
{`Nombre: Sentadilla Búlgara
Grupo: Piernas
Imagen: https://link-al-gif.com/img.gif
Descripcion: Mantén el torso recto...`}
                </pre>
              </div>
              
              <textarea
                value={exercisesText}
                onChange={(e) => setExercisesText(e.target.value)}
                className="w-full bg-zinc-950 border border-emerald-500/30 rounded-xl p-4 text-zinc-200 outline-none focus:border-emerald-500 h-48 text-sm font-mono resize-none leading-relaxed"
                placeholder={`Pega las definiciones de tus ejercicios nuevos aquí...`}
              />
            </div>
          )}
        </div>
      )}

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
                    <div key={eIdx} className={`bg-zinc-950 border p-3 rounded-xl flex items-center justify-between ${ex.is_new ? 'border-yellow-500/30' : 'border-zinc-800'}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-zinc-100">{ex.originalName}</p>
                          {ex.is_new && (
                             ex.is_specified 
                               ? <span className="bg-emerald-500 text-zinc-950 text-[9px] px-1.5 rounded font-black">NUEVO (DEFINIDO)</span>
                               : <span className="bg-yellow-500 text-zinc-950 text-[9px] px-1.5 rounded font-black">NUEVO (AUTO)</span>
                          )}
                        </div>
                        
                        {ex.alternatives && ex.alternatives.length > 0 && (
                           <p className="text-[10px] text-zinc-500 font-bold mt-1">
                             <span className="text-zinc-600">Alts:</span> {ex.alternatives.map(a => 
                               a.is_new 
                                 ? `${a.originalName} [NUEVO${a.is_specified ? ' DEFINIDO' : ' AUTO'}]` 
                                 : a.originalName
                             ).join(' / ')}
                           </p>
                        )}

                        <p className="text-[11px] text-zinc-500 mt-1.5 uppercase tracking-wider font-medium">
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
