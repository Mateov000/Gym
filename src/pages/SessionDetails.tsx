import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Edit2, Calendar, Clock, Timer, AlignLeft, Dumbbell } from 'lucide-react'
import { fetchSessionById, fetchExercises } from '../lib/queries'

function formatDuration(start: string, end?: string | null) {
  if (!end) return null
  const diffMs = new Date(end).getTime() - new Date(start).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return '< 1m'
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export default function SessionDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['session', id],
    queryFn: () => fetchSessionById(id!),
    enabled: !!id
  })

  const { data: exercises = [] } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  if (sessionLoading) return <div className="p-6 text-zinc-500">Cargando entrenamiento...</div>
  if (!session) return <div className="p-6 text-zinc-500">Entrenamiento no encontrado.</div>

  const duration = formatDuration(session.start_time, session.end_time)

  const groupedSets = (session.workout_sets || []).reduce((acc, set) => {
    if (!acc[set.exercise_id]) acc[set.exercise_id] = []
    acc[set.exercise_id].push(set)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl active:scale-95 transition-transform">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Detalle del Entrenamiento</h1>
        <button onClick={() => navigate(`/session/${id}/edit`)} className="text-emerald-500 p-2 bg-emerald-500/10 rounded-xl active:scale-95 transition-transform">
          <Edit2 size={20} />
        </button>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <h2 className="text-2xl font-black text-zinc-100 mb-4">Sesión Completada</h2>
        
        <div className="flex flex-wrap gap-3 text-sm text-zinc-300">
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <span className="font-bold">{new Date(session.start_time).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-2 rounded-xl">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span className="font-bold">{new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
          </div>
          {duration && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <Timer className="w-4 h-4 text-emerald-500" />
              <span className="font-bold text-emerald-400">{duration}</span>
            </div>
          )}
        </div>
      </div>

      {session.notes && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 mb-6 relative">
          <AlignLeft size={16} className="absolute top-4 left-4 text-zinc-600" />
          <p className="pl-8 text-sm text-zinc-300 whitespace-pre-wrap">{session.notes}</p>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {Object.entries(groupedSets).map(([exerciseId, sets]) => {
          const exName = exercises.find(e => e.id === exerciseId)?.name || 'Ejercicio'
          return (
            <div key={exerciseId} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <div className="flex items-center gap-3 mb-4 border-b border-zinc-800 pb-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg"><Dumbbell size={18} className="text-emerald-500"/></div>
                <h3 className="font-bold text-zinc-100 text-lg leading-tight">{exName}</h3>
              </div>
              
              <div className="flex flex-col gap-2">
                {sets.map((set, idx) => (
                  <div key={set.id} className="flex items-center gap-3 bg-zinc-950 px-3 py-2.5 rounded-xl border border-zinc-800/50">
                    <span className={`w-6 font-black text-center ${set.set_type === 'warm_up' ? 'text-orange-500' : set.set_type === 'drop_set' ? 'text-purple-400' : 'text-zinc-500'}`}>
                      {set.set_type === 'warm_up' ? 'W' : set.set_type === 'drop_set' ? 'D' : idx + 1}
                    </span>
                    
                    <div className="flex-1 flex justify-center items-center gap-2">
                      <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded-md min-w-[3rem] text-center font-bold">
                        {set.weight} <span className="text-[10px] text-zinc-500 ml-0.5">{set.unit}</span>
                      </span>
                      <span className="text-zinc-600 text-xs">×</span>
                      <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded-md min-w-[2.5rem] text-center font-bold">
                        {set.reps}
                      </span>
                    </div>

                    <div className="w-12 text-right">
                      {set.rir !== null && set.rir !== undefined && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-zinc-700">RIR {set.rir}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}