import { Dumbbell, Calendar, Clock, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkoutStore } from '../store/useWorkoutStore' // 1. Importamos el store
import { useQuery } from '@tanstack/react-query'
import { fetchWorkoutHistory } from '../lib/queries'
import type { WorkoutSessionWithSets } from '../types/workout'

export default function Feed() {
  const navigate = useNavigate()
  
  // 2. Leemos si hay un entrenamiento activo
  const { activeSession, workoutExercises } = useWorkoutStore()

  const { data: sessions = [], isLoading } = useQuery<WorkoutSessionWithSets[]>({
    queryKey: ['workout-history'],
    queryFn: () => fetchWorkoutHistory(),
  })

  return (
    <div className="p-6 pb-24 min-h-screen flex flex-col">
      <h1 className="text-3xl font-bold text-zinc-100 mb-6">Tu Progreso</h1>
      
      {/* 3. Lógica Condicional del Botón Principal */}
      {activeSession ? (
        <button 
          onClick={() => navigate('/workout')}
          className="w-full bg-blue-500 text-zinc-950 font-bold text-lg p-4 rounded-xl mb-8 active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
        >
          <Play size={24} />
          Continuar Entrenamiento ({workoutExercises.length} ej.)
        </button>
      ) : (
        <button 
          onClick={() => navigate('/exercises')}
          className="w-full bg-emerald-500 text-zinc-950 font-bold text-lg p-4 rounded-xl mb-8 active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Dumbbell size={24} />
          Iniciar Entrenamiento
        </button>
      )}
      
      {/* El resto del historial sigue exactamente igual */}
      {isLoading ? (
        <div className="text-zinc-500 text-center mt-10 animate-pulse">Cargando historial...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center mt-10 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
          <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Aún no hay entrenamientos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map((session: WorkoutSessionWithSets) => (
            <div key={session.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-bold text-zinc-100">Sesión Completada</h3>
                <span className="text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md text-xs font-bold border border-emerald-500/20">
                  {session.workout_sets?.length || 0} series
                </span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span>{new Date(session.start_time).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-zinc-950 px-3 py-1.5 rounded-lg">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span>{new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}