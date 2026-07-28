import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, AlertTriangle, Plus, Scale, Tag, X, Bot, Copy, Download, FileText, Code, Key } from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteAllWorkoutHistory, fetchAllWorkoutData, fetchExercises } from '../lib/queries'

// Exportamos el texto maestro para usarlo en la llamada a la API
export const SYSTEM_PROMPT = `Actúa como un experto entrenador personal. Quiero que me generes rutinas de gimnasio y listas de ejercicios usando ESTRICTAMENTE los siguientes formatos de texto para que yo pueda copiarlos y pegarlos directamente en mi aplicación. No uses markdown ni viñetas, solo texto plano con la estructura exacta:

Para crear una RUTINA entera, usa este formato:
Rutina: [Nombre de la Rutina]
Carpeta: [Nombre de la Carpeta o Categoría opcional]
Notas: [Cualquier indicación general]

Día: [Nombre del Día]
[Nombre Ejercicio] / [Alternativa 1] / [Alternativa 2] | [Series]x[Reps] @ [Peso opcional]
[Nombre Ejercicio] | [Reps]@[Peso], [Reps]@[Peso]

Ejemplo de Rutina:
Rutina: Fuerza Total
Carpeta: Powerlifting
Notas: Descansar 3 min entre series pesadas.

Día: Lunes - Pecho
Press de Banca / Press con Mancuernas | 4x5 @ 80
Fondos | 3x10
Aperturas en Polea / Pec Deck | 12@10, 10@12.5, 8@15

Para crear EJERCICIOS sueltos para mi catálogo, usa este formato (separa cada uno con doble salto de línea):
Nombre: [Nombre]
Grupo: [Músculo]
Equipamiento: [Barra / Mancuernas / Polea / Máquina / Peso Corporal / Smith / Kettlebell]
Usa barra: [sí / no]
Peso barra: [número en kg, ej: 20]
Visibilidad: [público / privado]
Imagen: [URL]
Descripcion: [Tips]

Ejemplo de Ejercicios:
Nombre: Press de Banca
Grupo: Pecho
Equipamiento: Barra
Usa barra: sí
Peso barra: 20
Visibilidad: público
Imagen: https://ejemplo.com/bench.gif
Descripcion: Mantén los omóplatos retraídos.`;

export const COPY_AI_PROMPT = () => {
  navigator.clipboard.writeText(SYSTEM_PROMPT);
  alert('¡Prompt copiado al portapapeles! Pégalo en tu IA favorita (ChatGPT, Claude, Gemini) para generar rutinas que puedas importar al instante.');
}

export default function Settings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { 
    showQuickCompleteButton, 
    setShowQuickCompleteButton,
    enableRir,
    setEnableRir,
    globalCustomUnits,
    addGlobalCustomUnit,
    removeGlobalCustomUnit,
    equivalencies,
    addEquivalency,
    removeEquivalency,
    aiApiKey,
    setAiApiKey
  } = useSettingsStore()

  const allUnits = Array.from(new Set(['kg', 'lbs', 'bodyweight', ...globalCustomUnits]))

  const [newCustomUnit, setNewCustomUnit] = useState('')
  const [newUnitFrom, setNewUnitFrom] = useState('kg')
  const [newEqValue, setNewEqValue] = useState('')
  const [newUnitTo, setNewUnitTo] = useState('lbs')
  const [isExporting, setIsExporting] = useState(false)

  const handleAddCustomUnit = () => {
    if (newCustomUnit && newCustomUnit.trim()) {
      addGlobalCustomUnit(newCustomUnit.trim().toLowerCase())
      setNewCustomUnit('')
    }
  }

  const handleAddEquivalency = () => {
    if (newUnitFrom && newEqValue && newUnitTo && newUnitFrom !== newUnitTo) {
      addEquivalency(newUnitFrom, newUnitTo, parseFloat(newEqValue))
      setNewEqValue('')
    } else if (newUnitFrom === newUnitTo) {
      alert("No puedes crear una equivalencia entre la misma unidad.")
    }
  }

  const handleExport = async (format: 'json' | 'csv') => {
    setIsExporting(true)
    try {
      const data = await fetchAllWorkoutData()
      const catalog = await fetchExercises()

      if (format === 'json') {
        const enriched = data.map(session => ({
          ...session,
          workout_sets: session.workout_sets?.map(set => ({
            ...set,
            exercise_name: catalog.find(e => e.id === set.exercise_id)?.name || 'Desconocido'
          }))
        }))
        const blob = new Blob([JSON.stringify(enriched, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gymtracker-backup-${new Date().toISOString().split('T')[0]}.json`
        a.click()
      } else {
        let csv = 'Fecha,Hora Inicio,Hora Fin,Ejercicio,Tipo de Serie,Peso,Unidad,Reps,RIR,Completado\n'
        data.forEach(session => {
          const date = new Date(session.start_time).toLocaleDateString()
          const time = new Date(session.start_time).toLocaleTimeString()
          const end = session.end_time ? new Date(session.end_time).toLocaleTimeString() : ''
          
          session.workout_sets?.forEach(set => {
            const exName = catalog.find(e => e.id === set.exercise_id)?.name || 'Desconocido'
            const cleanName = exName.replace(/,/g, '') 
            csv += `${date},${time},${end},${cleanName},${set.set_type || 'normal'},${set.weight},${set.unit || 'kg'},${set.reps},${set.rir ?? ''},${set.is_completed}\n`
          })
        })
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gymtracker-backup-${new Date().toISOString().split('T')[0]}.csv`
        a.click()
      }
    } catch (err: any) {
      alert('Error al exportar: ' + err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const deleteHistoryMutation = useMutation({
    mutationFn: deleteAllWorkoutHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history'] })
      alert('¡Tu historial de entrenamientos ha sido borrado por completo!')
    },
    onError: (err: any) => alert(`Error al borrar historial: ${err.message}`)
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Configuración</h1>
      </div>

      <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Bot size={16} /> Inteligencia Artificial (Nativo)
        </h2>
        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
          Ingresa tu clave de OpenAI para permitir que la app genere rutinas automáticamente por ti desde el "Creador de Rutinas". O puedes seguir usando el Prompt para copiar y pegar manualmente.
        </p>
        
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-zinc-500" />
          <input 
            type="password" 
            value={aiApiKey} 
            onChange={(e) => setAiApiKey(e.target.value)} 
            placeholder="sk-proj-..." 
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <button 
          onClick={COPY_AI_PROMPT}
          className="w-full py-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors hover:bg-indigo-500/20 active:scale-95"
        >
          <Copy size={18} /> Copiar Prompt Manual
        </button>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Download size={16} /> Data Science & Backups
        </h2>
        <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
          Descarga todo tu historial de entrenamientos en bruto para analizarlo en Excel, Sheets, o armar tus propios scripts de cruce de datos.
        </p>
        <div className="flex gap-2">
          <button onClick={() => handleExport('csv')} disabled={isExporting} className="flex-1 bg-blue-500/10 text-blue-400 font-bold p-3 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
            <FileText size={18} /> CSV
          </button>
          <button onClick={() => handleExport('json')} disabled={isExporting} className="flex-1 bg-blue-500/10 text-blue-400 font-bold p-3 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50">
            <Code size={18} /> JSON
          </button>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-6">Entrenamiento</h2>
        
        <div className="flex items-center justify-between mb-6">
          <div className="pr-4">
            <p className="font-bold text-zinc-100">Botón rápido de completado</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Muestra un pequeño botón junto al deslizador para completar la serie con un solo toque.
            </p>
          </div>
          <button 
            onClick={() => setShowQuickCompleteButton(!showQuickCompleteButton)}
            className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${showQuickCompleteButton ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-1 left-1 bg-zinc-950 w-5 h-5 rounded-full transition-transform ${showQuickCompleteButton ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-8 border-t border-zinc-800 pt-6">
          <div className="pr-4">
            <p className="font-bold text-zinc-100">Mostrar RIR (Reps en Reserva)</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Activa un campo extra en tus series para registrar a cuántas repeticiones del fallo muscular te quedaste.
            </p>
          </div>
          <button 
            onClick={() => setEnableRir(!enableRir)}
            className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${enableRir ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-1 left-1 bg-zinc-950 w-5 h-5 rounded-full transition-transform ${enableRir ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="border-t border-zinc-800 pt-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={18} className="text-emerald-500" />
            <p className="font-bold text-zinc-100">Mis Unidades Personalizadas</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">Las unidades que creas en tus entrenamientos se guardan aquí.</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {globalCustomUnits.map((unit) => (
              <div key={unit} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg">
                <span className="text-sm font-bold text-zinc-300">{unit}</span>
                <button onClick={() => removeGlobalCustomUnit(unit)} className="text-red-500 hover:text-red-400">
                  <X size={14} />
                </button>
              </div>
            ))}
            {globalCustomUnits.length === 0 && <p className="text-xs text-zinc-600 italic py-2 w-full">No has creado unidades personalizadas.</p>}
          </div>

          <div className="flex gap-2">
            <input type="text" value={newCustomUnit} onChange={(e) => setNewCustomUnit(e.target.value)} placeholder="Ej: bandas" className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-emerald-500" />
            <button onClick={handleAddCustomUnit} disabled={!newCustomUnit} className="bg-emerald-500 text-zinc-950 px-4 rounded-xl disabled:opacity-50 active:scale-95 flex items-center justify-center font-bold">Añadir</button>
          </div>
        </div>

        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={18} className="text-emerald-500" />
            <p className="font-bold text-zinc-100">Equivalencias Matemáticas</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">Relaciona cualquier unidad entre sí. La app usará esto para convertir tus pesos exactos al vuelo.</p>

          <div className="space-y-3 mb-4">
            {equivalencies.map((eq) => (
              <div key={eq.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-300">1 {eq.from}</span>
                  <span className="text-zinc-600">=</span>
                  <span className="text-sm text-emerald-500 font-bold">{Math.round(eq.multiplier * 4) / 4} {eq.to}</span>
                </div>
                <button onClick={() => removeEquivalency(eq.id)} className="text-red-500 p-1.5 bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
              </div>
            ))}
            {equivalencies.length === 0 && <p className="text-xs text-zinc-600 italic text-center py-2">No hay conversiones creadas.</p>}
          </div>

          <div className="flex gap-2">
            <div className="flex items-center text-zinc-500 font-bold">1</div>
            <select value={newUnitFrom} onChange={(e) => setNewUnitFrom(e.target.value)} className="w-[30%] bg-zinc-950 border border-zinc-800 rounded-xl px-1 py-3 text-xs outline-none focus:border-emerald-500 text-center text-zinc-200">
              {allUnits.map(u => <option key={`from-${u}`} value={u}>{u}</option>)}
            </select>
            <div className="flex items-center text-zinc-500 font-bold">=</div>
            <input type="number" step="any" value={newEqValue} onChange={(e) => setNewEqValue(e.target.value)} placeholder="0.0" className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-1 py-3 text-sm text-center outline-none focus:border-emerald-500" />
            <select value={newUnitTo} onChange={(e) => setNewUnitTo(e.target.value)} className="w-[30%] bg-zinc-950 border border-zinc-800 rounded-xl px-1 py-3 text-xs outline-none focus:border-emerald-500 text-center text-zinc-200">
              {allUnits.map(u => <option key={`to-${u}`} value={u}>{u}</option>)}
            </select>
            <button onClick={handleAddEquivalency} disabled={!newEqValue || parseFloat(newEqValue) <= 0 || newUnitFrom === newUnitTo} className="bg-emerald-500 text-zinc-950 p-3 rounded-xl disabled:opacity-50 active:scale-95 flex-1 flex justify-center">
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-6 flex items-center gap-2">
          <AlertTriangle size={16} /> Zona de Peligro
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-bold text-zinc-100">Reiniciar Progreso</p>
            <p className="text-xs text-red-400/80 mt-1 leading-relaxed mb-4">Elimina todo tu historial de entrenamientos. Mantendrás tus ejercicios y plantillas de rutinas.</p>
            <button 
              onClick={() => {if (window.confirm('🚨 ¿ESTÁS SEGURO?\n\nEsto eliminará TODOS tus entrenamientos pasados.')) deleteHistoryMutation.mutate()}}
              disabled={deleteHistoryMutation.isPending}
              className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={18} /> {deleteHistoryMutation.isPending ? 'Borrando...' : 'Vaciar Historial'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}