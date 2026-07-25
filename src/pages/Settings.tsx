import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2, AlertTriangle } from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteAllWorkoutHistory } from '../lib/queries'

export default function Settings() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showQuickCompleteButton, setShowQuickCompleteButton } = useSettingsStore()

  // Mutación para borrar el historial
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

      {/* --- SECCIÓN: ENTRENAMIENTO --- */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6">
        <h2 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-6">Entrenamiento</h2>
        
        <div className="flex items-center justify-between">
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
      </div>

      {/* --- SECCIÓN: ZONA DE PELIGRO --- */}
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