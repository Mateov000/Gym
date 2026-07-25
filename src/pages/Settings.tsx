import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useSettingsStore } from '../store/useSettingsStore'

export default function Settings() {
  const navigate = useNavigate()
  const { showQuickCompleteButton, setShowQuickCompleteButton } = useSettingsStore()

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
        
        <div className="flex items-center justify-between">
          <div className="pr-4">
            <p className="font-bold text-zinc-100">Botón rápido de completado</p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Muestra un pequeño botón junto al deslizador para completar la serie con un solo toque.
            </p>
          </div>
          
          {/* Toggle Switch */}
          <button 
            onClick={() => setShowQuickCompleteButton(!showQuickCompleteButton)}
            className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${showQuickCompleteButton ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <div className={`absolute top-1 left-1 bg-zinc-950 w-5 h-5 rounded-full transition-transform ${showQuickCompleteButton ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}