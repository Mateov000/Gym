import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save, AlertTriangle, CheckCircle2, Play, Dumbbell, Bot, Info, ChevronDown, ChevronUp, Globe2, Lock, Sparkles, X } from 'lucide-react'
import { fetchExercises, createStructuredRoutine, createExercise } from '../lib/queries'
import { COPY_AI_PROMPT, SYSTEM_PROMPT } from './Settings'
import { useSettingsStore } from '../store/useSettingsStore'
import type { Exercise } from '../types/workout'

// --- FUNCIONES DE LIMPIEZA Y SIMILITUD ---
const normalize = (str: string) => 
  str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

function getBigrams(str: string) {
  const bigrams = new Set<string>()
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2))
  }
  return bigrams
}

function getSimilarity(str1: string, str2: string) {
  const s1 = normalize(str1)
  const s2 = normalize(str2)
  if (s1 === s2) return 1
  const bg1 = getBigrams(s1)
  const bg2 = getBigrams(s2)
  let intersection = 0
  for (const bg of bg1) {
    if (bg2.has(bg)) intersection++
  }
  if (bg1.size === 0 && bg2.size === 0) return 1
  if (bg1.size === 0 || bg2.size === 0) return 0
  return (2.0 * intersection) / (bg1.size + bg2.size)
}

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
      if (lowerLine.startsWith('nombre:')) { 
        ex.name = line.substring(7).replace(/\*\*/g, '').trim()
        isParsingDesc = false 
      }
      else if (lowerLine.startsWith('grupo:')) { 
        ex.muscle_group = line.substring(6).replace(/\*\*/g, '').trim()
        isParsingDesc = false 
      }
      else if (lowerLine.startsWith('equipamiento:')) { 
        const eqMap: Record<string, string> = {
          'barra': 'barbell', 'mancuernas': 'dumbbell', 'maquina': 'machine', 'máquina': 'machine',
          'polea': 'cable', 'smith': 'smith', 'peso corporal': 'bodyweight', 'kettlebell': 'kettlebell'
        }
        const val = line.substring(13).trim().toLowerCase()
        let matched = 'other'
        for (const [k, v] of Object.entries(eqMap)) {
           if (val.includes(k)) matched = v
        }
        ex.config = { ...(ex.config || {}), equipment: matched as any }
        isParsingDesc = false 
      }
      else if (lowerLine.startsWith('usa barra:') || lowerLine.startsWith('usa barra olímpica:')) {
        const val = line.split(':')[1]?.trim().toLowerCase() || ''
        const uses = val === 'si' || val === 'sí' || val === 'true' || val === 'yes'
        ex.config = { ...(ex.config || {}), uses_barbell: uses }
        isParsingDesc = false
      }
      else if (lowerLine.startsWith('peso barra:') || lowerLine.startsWith('barra kg:')) {
        const val = parseFloat(line.split(':')[1]?.trim() || '0')
        if (!isNaN(val)) {
          ex.config = { ...(ex.config || {}), bar_weight: val }
        }
        isParsingDesc = false
      }
      else if (lowerLine.startsWith('visibilidad:')) {
        const val = line.substring(12).trim().toLowerCase()
        ex.is_public = val.includes('public') || val.includes('público')
        isParsingDesc = false
      }
      else if (lowerLine.startsWith('imagen:')) { 
        let imgStr = line.substring(7).trim()
        const urlMatch = imgStr.match(/(https?:\/\/[^\s\]\)]+)/)
        if (urlMatch) imgStr = urlMatch[1]
        ex.image_url = imgStr
        isParsingDesc = false 
      }
      else if (lowerLine.startsWith('descripcion:')) { 
        ex.description = line.substring(12).trim()
        isParsingDesc = true 
      }
      else if (isParsingDesc) { 
        ex.description = (ex.description || '') + '\n' + line.trim() 
      }
    }
    if (ex.name) exercises.push(ex)
  }
  return exercises
}

// --- INTERFACES ---
interface FuzzyMatch {
  id: string
  name: string
  score: number
}

interface ParsedEntity {
  originalName: string
  exercise_id: string
  is_new: boolean
  is_specified: boolean
  fuzzy_matches: FuzzyMatch[]
}

interface ParsedAlternative extends ParsedEntity {}

interface ParsedExercise extends ParsedEntity {
  target_sets: number
  target_reps: number
  alternatives: ParsedAlternative[]
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
}

export default function RoutineBuilder() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  const [text, setText] = useState('')
  const [exercisesText, setExercisesText] = useState('')
  const [showExDefs, setShowExDefs] = useState(false)
  const [importAsPublic, setImportAsPublic] = useState(false)

  const { aiApiKey } = useSettingsStore()
  const [aiInput, setAiInput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAiModal, setShowAiModal] = useState(false)
  
  const [resolutions, setResolutions] = useState<Record<string, string>>({})

  const { data: allExercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const parsedResult = useMemo(() => {
    const result: ParsedRoutine = { name: 'Nueva Rutina', folder: '', notes: '', days: [], errors: [] }
    if (!text.trim()) return result

    const combinedText = text + '\n\n' + exercisesText;
    const parsedDefs = parseExercisesText(combinedText);
    const specifiedNames = new Set(parsedDefs.map(d => normalize(d.name || '')));

    const lines = text.split('\n')
    let currentDay: ParsedDay | null = null

    const resolveEntity = (name: string): ParsedEntity => {
      const ex = allExercises.find(e => normalize(e.name) === normalize(name))
      if (ex) {
        return { originalName: name, exercise_id: ex.id, is_new: false, is_specified: false, fuzzy_matches: [] }
      }
      
      const fuzzy = allExercises
        .map(e => ({ id: e.id, name: e.name, score: getSimilarity(name, e.name) }))
        .filter(m => m.score > 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)

      return {
        originalName: name,
        exercise_id: 'NEW',
        is_new: true,
        is_specified: specifiedNames.has(normalize(name)),
        fuzzy_matches: fuzzy
      }
    }

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

        const mainEntity = resolveEntity(mainExName);
        const alternatives = altNames.map(altName => resolveEntity(altName));

        currentDay.exercises.push({
           ...mainEntity,
           target_sets,
           target_reps: sets_config[0]?.reps || 10,
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

  const stats = useMemo(() => {
    let finalAuto = 0; let finalSpec = 0; let finalExist = 0;
    const processed = new Set<string>();

    const processEntity = (ent: ParsedEntity) => {
      const norm = normalize(ent.originalName);
      if (processed.has(norm)) return;
      processed.add(norm);

      if (!ent.is_new) { finalExist++; return; }
      
      const finalAction = resolutions[ent.originalName] || 'NEW';
      if (finalAction !== 'NEW') { finalExist++; return; }
      
      if (ent.is_specified) finalSpec++; else finalAuto++;
    };

    parsedResult.days.forEach(day => {
      day.exercises.forEach(ex => {
        processEntity(ex);
        ex.alternatives?.forEach(processEntity);
      })
    })

    return { auto: finalAuto, specified: finalSpec, existing: finalExist, hasNew: finalAuto > 0 || finalSpec > 0 }
  }, [parsedResult, resolutions])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const defs = parseExercisesText(text + '\n\n' + exercisesText);
      const defMap = new Map(defs.map(d => [normalize(d.name!), d]));
      const newExMap = new Map<string, string>(); 

      const daysToSave = [...parsedResult.days]
      
      for (const day of daysToSave) {
         for (const ex of day.exercises) {
            
            const finalMainId = resolutions[ex.originalName] || ex.exercise_id;

            if (finalMainId === 'NEW') {
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
                   config: manualDef?.config || {}, // <--- CORREGIDO: Se inyecta el config completo parseado
                   is_public: manualDef?.is_public ?? importAsPublic 
                 });
                 ex.exercise_id = createdEx.id;
                 newExMap.set(norm, createdEx.id);
               }
            } else {
               ex.exercise_id = finalMainId;
            }

            if (ex.alternatives && ex.alternatives.length > 0) {
               const altIds = []
               for (const alt of ex.alternatives) {
                  const finalAltId = resolutions[alt.originalName] || alt.exercise_id;

                  if (finalAltId === 'NEW') {
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
                         config: manualDef?.config || {}, // <--- CORREGIDO: Config completo para alternativas
                         is_public: manualDef?.is_public ?? importAsPublic
                       });
                       altIds.push(createdAlt.id);
                       newExMap.set(normAlt, createdAlt.id);
                     }
                  } else {
                    altIds.push(finalAltId)
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

  const renderEntityBadge = (ent: ParsedEntity) => {
    if (!ent.is_new) {
      return <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">Ya en Catálogo</span>
    }

    const selectedAction = resolutions[ent.originalName] || 'NEW';
    const hasFuzzyMatches = ent.fuzzy_matches.length > 0;

    if (hasFuzzyMatches) {
      const isResolved = selectedAction !== 'NEW';
      return (
        <select 
          value={selectedAction} 
          onChange={(e) => setResolutions(prev => ({...prev, [ent.originalName]: e.target.value}))}
          className={`text-[10px] font-bold uppercase tracking-widest rounded px-1 py-0.5 outline-none cursor-pointer border max-w-[180px] sm:max-w-[200px] truncate ${isResolved ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}`}
        >
          <option value="NEW">✨ CREAR NUEVO</option>
          {ent.fuzzy_matches.map(m => (
            <option key={m.id} value={m.id}>🔗 VINCULAR: {m.name}</option>
          ))}
        </select>
      )
    }

    return ent.is_specified 
      ? <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">Nuevo (Definido)</span>
      : <span className="bg-yellow-500/20 text-yellow-500 border border-yellow-500/30 text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest whitespace-nowrap">Nuevo (Auto)</span>
  }

  const handleGenerateAI = async () => {
    if (!aiApiKey) {
      alert("Por favor, configura tu API Key de OpenAI en la pestaña Perfil -> Configuración.")
      return
    }
    if (!aiInput) return

    setIsGenerating(true)
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: aiInput }
          ],
          temperature: 0.7
        })
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error.message)
      
      const result = data.choices[0].message.content
      setText(result)
      setShowAiModal(false)
      setAiInput('')
    } catch (err: any) {
      alert('Error de IA: ' + err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate('/routines')} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Importador Estructurado</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAiModal(true)} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 p-2.5 rounded-xl font-bold active:scale-95 transition-transform flex items-center gap-1.5 text-xs">
            <Sparkles size={16} /> IA
          </button>
          <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || parsedResult.errors.length > 0 || parsedResult.days.length === 0} className="bg-zinc-800 text-zinc-100 p-2 rounded-xl flex items-center gap-2 font-bold disabled:opacity-50 active:scale-95 transition-transform" aria-label="Guardar">
            <Save size={20} />
          </button>
        </div>
      </div>

      {showAiModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 w-full sm:max-w-md rounded-3xl p-6 relative animate-in slide-in-from-bottom-10 border border-indigo-500/30">
            <button onClick={() => setShowAiModal(false)} className="absolute top-4 right-4 p-2 bg-zinc-800 rounded-full text-zinc-400"><X size={20}/></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-indigo-500/20 p-3 rounded-full text-indigo-400"><Sparkles size={24} /></div>
              <h2 className="text-xl font-bold text-zinc-100">Entrenador IA</h2>
            </div>
            <p className="text-sm text-zinc-400 mb-4">Dile qué tipo de rutina necesitas (días, objetivo, lesiones, tiempo) y la IA escribirá la estructura por ti.</p>
            <textarea 
              value={aiInput} 
              onChange={e => setAiInput(e.target.value)} 
              placeholder="Ej: Hazme una rutina de 4 días (PPL + FullBody). No puedo hacer sentadilla libre por una lesión en la lumbar."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-200 outline-none focus:border-indigo-500 h-32 text-sm resize-none mb-4"
            />
            <button onClick={handleGenerateAI} disabled={isGenerating || !aiInput} className="w-full bg-indigo-500 text-white font-bold p-4 rounded-xl flex justify-center items-center gap-2 disabled:opacity-50 active:scale-95 transition-transform">
              {isGenerating ? 'Generando rutina...' : 'Generar Rutina'}
            </button>
          </div>
        </div>
      )}

      {parsedResult.errors.length > 0 ? (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl mb-4 flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 font-bold"><AlertTriangle size={18} /> Revisa estos errores:</div>
          <ul className="list-disc pl-5 space-y-1">
            {parsedResult.errors.map((err, i) => <li key={i}>{err}</li>)}
          </ul>
        </div>
      ) : text.trim().length > 10 ? (
        <div className="flex flex-col gap-3 mb-4">
           {(stats.hasNew || stats.existing > 0) && (
             <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex flex-col gap-2 text-sm">
               <div className="flex items-center gap-2 font-bold text-zinc-100 mb-1">
                 <Info size={18} className="flex-shrink-0 text-emerald-500" />
                 Resumen de ejercicios:
               </div>
               <ul className="pl-7 text-xs text-zinc-400 font-normal list-disc space-y-1.5">
                  {stats.existing > 0 && <li><strong>{stats.existing}</strong> están en tu catálogo (o los vinculaste) y se reciclarán.</li>}
                  {stats.specified > 0 && <li><strong>{stats.specified}</strong> son nuevos y tomarán las definiciones que escribiste.</li>}
                  {stats.auto > 0 && <li><strong>{stats.auto}</strong> son nuevos y se crearán en blanco <span className="text-yellow-500/80">(Auto)</span>.</li>}
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

      {stats.hasNew && (
        <div className="mb-6">
          <button onClick={() => setShowExDefs(!showExDefs)} className="text-xs text-emerald-500 font-bold mb-2 flex items-center gap-1 bg-emerald-500/10 px-3 py-2 rounded-lg active:scale-95 transition-all w-full justify-between border border-emerald-500/20">
            <span className="flex items-center gap-2">
              {showExDefs ? <ChevronUp size={14}/> : <ChevronDown size={14}/>} 
              Añadir detalles a los {stats.auto + stats.specified} ejercicios nuevos (Opcional)
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
Equipamiento: Mancuernas
Usa barra: no
Peso barra: 20
Visibilidad: privado
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
                    <div key={eIdx} className={`bg-zinc-950 border p-3 rounded-xl flex items-center justify-between ${ex.is_new ? 'border-orange-500/30' : 'border-zinc-800'}`}>
                      <div className="w-full">
                        <div className="flex items-start sm:items-center justify-between gap-2 flex-col sm:flex-row w-full mb-1">
                          <p className="font-bold text-sm text-zinc-100 truncate">{ex.originalName}</p>
                          {renderEntityBadge(ex)}
                        </div>
                        
                        {ex.alternatives && ex.alternatives.length > 0 && (
                           <div className="text-[10px] mt-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800 flex flex-col gap-1.5">
                             <span className="text-zinc-500 font-bold">ALTERNATIVAS:</span>
                             {ex.alternatives.map((alt, aIdx) => (
                               <div key={aIdx} className="flex items-center justify-between gap-2 pl-2 border-l-2 border-zinc-700">
                                 <span className="text-zinc-300 truncate font-medium">{alt.originalName}</span>
                                 {renderEntityBadge(alt)}
                               </div>
                             ))}
                           </div>
                        )}

                        <p className="text-[11px] text-zinc-500 mt-2 uppercase tracking-wider font-medium">
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