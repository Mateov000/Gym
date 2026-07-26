import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, AlertTriangle, Plus, Scale } from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteAllWorkoutHistory } from '../lib/queries'

export default function Settings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { 
    showQuickCompleteButton, 
    setShowQuickCompleteButton,
    unitEquivalencies,
    setUnitEquivalency,
    removeUnitEquivalency
  } = useSettingsStore()

  // Estados para añadir nueva equivalencia
  const [newUnit, setNewUnit] = useState('')
  const [newEqValue, setNewEqValue] = useState('')

  const handleAddEquivalency = () => {
    if (newUnit && newEqValue) {
      setUnitEquivalency(newUnit.trim().toLowerCase(), parseFloat(newEqValue))
      setNewUnit('')
      setNewEqValue('')
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

  const handleDeleteHistory = () => {
    if (window.confirm('🚨 ¿ESTÁS SEGURO?\n\nEsto eliminará TODOS tus entrenamientos pasados (tu feed). Perderás tus estadísticas registradas.\n\nTus rutinas y ejercicios del catálogo NO se borrarán.\n\nEsta acción NO se puede deshacer.')) {
      deleteHistoryMutation.mutate()
    }
  }

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

        {/* ---> NUEVA SECCIÓN: EQUIVALENCIAS <--- */}
        <div className="border-t border-zinc-800 pt-6">
          <div className="flex items-center gap-2 mb-2">
            <Scale size={18} className="text-emerald-500" />
            <p className="font-bold text-zinc-100">Equivalencia de Unidades</p>
          </div>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Dile a la app a cuántos kilos equivale tu unidad personalizada para que haga la conversión automática al cambiar de unidad durante el entrenamiento.
          </p>

          <div className="space-y-3 mb-4">
            {Object.entries(unitEquivalencies).map(([unit, eq]) => (
              <div key={unit} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-zinc-300">1 {unit}</span>
                  <span className="text-zinc-600">=</span>
                  <span className="text-sm text-emerald-500 font-bold">{eq} kg</span>
                </div>
                <button onClick={() => removeUnitEquivalency(unit)} className="text-red-500 p-1.5 bg-red-500/10 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {Object.keys(unitEquivalencies).length === 0 && (
              <p className="text-xs text-zinc-600 italic text-center py-2">No hay equivalencias configuradas.</p>
            )}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder="Ej: placa" 
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-emerald-500"
            />
            <input 
              type="number" 
              value={newEqValue}
              onChange={(e) => setNewEqValue(e.target.value)}
              placeholder="Kilos" 
              className="w-20 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-center outline-none focus:border-emerald-500"
            />
            <button 
              onClick={handleAddEquivalency}
              disabled={!newUnit || !newEqValue}
              className="bg-emerald-500 text-zinc-950 p-3 rounded-xl disabled:opacity-50 active:scale-95"
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
              Elimina todo tu historial de entrenamientos. Mantendrás tus ejercicios y plantillas de rutinas, pero tu muro principal volverá a estar vacío.
            </p>
            <button 
              onClick={handleDeleteHistory}
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