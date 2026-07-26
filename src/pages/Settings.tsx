import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, AlertTriangle, Plus, Scale, Tag } from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteAllWorkoutHistory } from '../lib/queries'

export default function Settings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { 
    showQuickCompleteButton, 
    setShowQuickCompleteButton,
    globalCustomUnits,
    addGlobalCustomUnit,
    removeGlobalCustomUnit,
    equivalencies,
    addEquivalency,
    removeEquivalency
  } = useSettingsStore()

  // Base para los desplegables
  const allUnits = Array.from(new Set(['kg', 'lbs', 'bodyweight', ...globalCustomUnits]))

  // Estados
  const [newCustomUnit, setNewCustomUnit] = useState('')
  const [newUnitFrom, setNewUnitFrom] = useState('kg')
  const [newEqValue, setNewEqValue] = useState('')
  const [newUnitTo, setNewUnitTo] = useState('lbs')

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

  const deleteHistoryMutation = useMutation({
    mutationFn: deleteAllWorkoutHistory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workout-history'] })
      alert('¡Tu historial de entrenamientos ha sido borrado por completo!')
    },
    onError: (err: any) => alert(`Error al borrar historial: ${err.message}`)
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Configuración</h1>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-6">Entrenamiento</h2>
        
        <div className="flex items-center justify-between mb-8">
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

        {/* ---> NUEVA SECCIÓN: GESTIÓN DE UNIDADES <--- */}
        <div className="border-t border-zinc-800 pt-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Tag size={18} className="text-emerald-500" />
            <p className="font-bold text-zinc-100">Mis Unidades Personalizadas</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Las unidades que creas en tus entrenamientos se guardan aquí.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {globalCustomUnits.map((unit) => (
              <div key={unit} className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-lg">
                <span className="text-sm font-bold text-zinc-300">{unit}</span>
                <button onClick={() => removeGlobalCustomUnit(unit)} className="text-red-500 hover:text-red-400">
                  <X size={14} className="lucide lucide-x" />
                </button>
              </div>
            ))}
            {globalCustomUnits.length === 0 && (
              <p className="text-xs text-zinc-600 italic py-2 w-full">No has creado unidades personalizadas.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={newCustomUnit}
              onChange={(e) => setNewCustomUnit(e.target.value)}
              placeholder="Ej: bandas" 
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-emerald-500"
            />
            <button 
              onClick={handleAddCustomUnit}
              disabled={!newCustomUnit}
              className="bg-emerald-500 text-zinc-950 px-4 rounded-xl disabled:opacity-50 active:scale-95 flex items-center justify-center font-bold"
            >
              Añadir
            </button>
          </div>
        </div>

        {/* ---> SECCIÓN: EQUIVALENCIAS <--- */}
        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={18} className="text-emerald-500" />
            <p className="font-bold text-zinc-100">Equivalencias Matemáticas</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Relaciona cualquier unidad entre sí. La app usará esto para convertir tus pesos exactos al vuelo.
          </p>

          <div className="space-y-3 mb-4">
            {equivalencies.map((eq) => (
              <div key={eq.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-300">1 {eq.from}</span>
                  <span className="text-zinc-600">=</span>
                  <span className="text-sm text-emerald-500 font-bold">
                    {Math.round(eq.multiplier * 4) / 4} {eq.to}
                  </span>
                </div>
                <button onClick={() => removeEquivalency(eq.id)} className="text-red-500 p-1.5 bg-red-500/10 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {equivalencies.length === 0 && (
              <p className="text-xs text-zinc-600 italic text-center py-2">No hay conversiones creadas.</p>
            )}
          </div>

          <div className="flex gap-2">
            <div className="flex items-center text-zinc-500 font-bold">1</div>
            <select 
              value={newUnitFrom}
              onChange={(e) => setNewUnitFrom(e.target.value)}
              className="w-[30%] bg-zinc-950 border border-zinc-800 rounded-xl px-1 py-3 text-xs outline-none focus:border-emerald-500 text-center text-zinc-200"
            >
              {allUnits.map(u => <option key={`from-${u}`} value={u}>{u}</option>)}
            </select>

            <div className="flex items-center text-zinc-500 font-bold">=</div>
            
            <input 
              type="number"
              step="any" 
              value={newEqValue}
              onChange={(e) => setNewEqValue(e.target.value)}
              placeholder="0.0" 
              className="w-16 bg-zinc-950 border border-zinc-800 rounded-xl px-1 py-3 text-sm text-center outline-none focus:border-emerald-500"
            />
            
            <select 
              value={newUnitTo}
              onChange={(e) => setNewUnitTo(e.target.value)}
              className="w-[30%] bg-zinc-950 border border-zinc-800 rounded-xl px-1 py-3 text-xs outline-none focus:border-emerald-500 text-center text-zinc-200"
            >
              {allUnits.map(u => <option key={`to-${u}`} value={u}>{u}</option>)}
            </select>

            <button 
              onClick={handleAddEquivalency}
              disabled={!newEqValue || parseFloat(newEqValue) <= 0 || newUnitFrom === newUnitTo}
              className="bg-emerald-500 text-zinc-950 p-3 rounded-xl disabled:opacity-50 active:scale-95 flex-1 flex justify-center"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-6 flex items-center gap-2">
          <AlertTriangle size={16} />
          Zona de Peligro
        </h2>
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-bold text-zinc-100">Reiniciar Progreso</p>
            <p className="text-xs text-red-400/80 mt-1 leading-relaxed mb-4">
              Elimina todo tu historial de entrenamientos. Mantendrás tus ejercicios y plantillas de rutinas.
            </p>
            <button 
              onClick={() => {if (window.confirm('🚨 ¿ESTÁS SEGURO?\n\nEsto eliminará TODOS tus entrenamientos pasados.')) deleteHistoryMutation.mutate()}}
              disabled={deleteHistoryMutation.isPending}
              className="w-full py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors hover:bg-red-500/20 active:scale-95 disabled:opacity-50"
            >
              <Trash2 size={18} />
              {deleteHistoryMutation.isPending ? 'Borrando...' : 'Vaciar Historial'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}