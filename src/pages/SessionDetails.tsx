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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 pb-24">
      {/* Usamos max-w-6xl para que en PC aproveche el ancho, en lugar de max-w-2xl */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => navigate(-1)} className="text-zinc-400 p-2 bg-zinc-900 rounded-xl active:scale-95 transition-transform">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl md:text-3xl font-bold">Detalle del Entrenamiento</h1>
          <button onClick={() => navigate(`/session/${id}/edit`)} className="text-emerald-500 p-2 md:px-4 bg-emerald-500/10 rounded-xl active:scale-95 transition-transform flex items-center gap-2">
            <Edit2 size={20} />
            <span className="hidden md:inline font-bold">Editar</span>
          </button>
        </div>

        {/* Panel Superior: Layout Grid para PC */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 ${session.notes ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            <h2 className="text-2xl font-black text-zinc-100 mb-6">Sesión Completada</h2>
            
            <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
              <div className="flex items-center gap-2 bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800/50">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <span className="font-bold text-base">{new Date(session.start_time).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800/50">
                <Clock className="w-5 h-5 text-emerald-500" />
                <span className="font-bold text-base">{new Date(session.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
              </div>
              {duration && (
                <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-xl">
                  <Timer className="w-5 h-5 text-emerald-500" />
                  <span className="font-bold text-emerald-400 text-base">{duration}</span>
                </div>
              )}
            </div>
          </div>

          {session.notes && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 relative lg:col-span-1 flex flex-col">
              <div className="flex items-center gap-2 mb-3 text-zinc-400 font-bold">
                 <AlignLeft size={18} /> Notas Generales
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap flex-1">{session.notes}</p>
            </div>
          )}
        </div>

        <h3 className="text-lg font-bold text-zinc-400 mb-4 uppercase tracking-widest border-b border-zinc-800/50 pb-2">
          Ejercicios Realizados ({Object.keys(groupedSets).length})
        </h3>
        
        {/* Cuadrícula de Ejercicios */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {Object.entries(groupedSets).map(([exerciseId, sets]) => {
            const exName = exercises.find(e => e.id === exerciseId)?.name || 'Ejercicio'
            return (
              <div key={exerciseId} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col h-full hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-3 mb-5 border-b border-zinc-800 pb-4">
                  <div className="bg-emerald-500/10 p-2.5 rounded-xl"><Dumbbell size={20} className="text-emerald-500"/></div>
                  <h3 className="font-bold text-zinc-100 text-lg leading-tight line-clamp-2">{exName}</h3>
                </div>
                
                <div className="flex flex-col gap-2.5 flex-1">
                  {sets.map((set, idx) => (
                    <div key={set.id} className="flex items-center justify-between bg-zinc-950 px-3 py-3 rounded-xl border border-zinc-800/50">
                      <div className="flex items-center gap-3">
                         <span className={`w-6 font-black text-center ${set.set_type === 'warm_up' ? 'text-orange-500' : set.set_type === 'drop_set' ? 'text-purple-400' : 'text-zinc-500'}`}>
                           {set.set_type === 'warm_up' ? 'W' : set.set_type === 'drop_set' ? 'D' : idx + 1}
                         </span>
                         
                         <div className="flex items-center gap-1.5">
                           <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded-md min-w-[3.5rem] text-center font-bold text-sm border border-zinc-800">
                             {set.weight} <span className="text-[10px] text-zinc-500 font-sans ml-0.5">{set.unit}</span>
                           </span>
                           <span className="text-zinc-600 text-xs">×</span>
                           <span className="font-mono text-zinc-200 bg-zinc-900 px-2 py-1 rounded-md min-w-[2.5rem] text-center font-bold text-sm border border-zinc-800">
                             {set.reps}
                           </span>
                         </div>
                      </div>

                      {set.rir !== null && set.rir !== undefined && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border border-zinc-700 whitespace-nowrap">
                          RIR {set.rir}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}