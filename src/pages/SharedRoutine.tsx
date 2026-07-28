import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Download, ArrowLeft, RefreshCw, Check, Copy } from 'lucide-react'
import { fetchRoutineById, cloneRoutine } from '../lib/queries'
import { useSettingsStore } from '../store/useSettingsStore'

export default function SharedRoutine() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Extraemos el mode de la URL (?mode=sync)
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode') || 'copy';

  const { addSubscribedRoutine, subscribedRoutines } = useSettingsStore();
  const isSubscribed = subscribedRoutines.includes(id!);

  const { data: routine, isLoading, isError } = useQuery({
    queryKey: ['shared-routine', id],
    queryFn: () => fetchRoutineById(id!),
    enabled: !!id,
  })

  const cloneMutation = useMutation({
    mutationFn: () => cloneRoutine(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (err: any) => alert(`Error al clonar: ${err.message}`)
  })

  if (isLoading) return <div className="min-h-screen bg-zinc-950 p-6 text-zinc-500 flex items-center justify-center">Buscando rutina...</div>
  if (isError || !routine) return <div className="min-h-screen bg-zinc-950 p-6 text-red-500 flex items-center justify-center">Rutina no encontrada o enlace inválido.</div>

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
        <div className="bg-emerald-500/20 p-4 rounded-full mb-4">
          <Dumbbell size={40} className="text-emerald-500" />
        </div>
        
        <h1 className="text-xl font-bold mb-1 text-zinc-300">¡Te han compartido una rutina!</h1>
        <p className="text-emerald-400 font-black text-2xl mb-2">{routine.name}</p>
        
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 mb-4 w-full">
           <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">Modo de Invitación</p>
           <p className="font-bold text-sm text-blue-400">
             {mode === 'copy' ? 'Copia Desconectada' : mode === 'sync' ? 'Suscripción (Ver Cambios)' : 'Edición Colaborativa'}
           </p>
        </div>
        
        {routine.notes && <p className="text-zinc-400 text-sm mb-6 bg-zinc-950 p-4 rounded-xl w-full border border-zinc-800/50">{routine.notes}</p>}
        <p className="text-zinc-500 text-xs mb-8 uppercase tracking-widest font-bold">{routine.routine_days?.length || 0} días de entrenamiento</p>

        {mode === 'copy' ? (
           <button onClick={() => cloneMutation.mutate()} disabled={cloneMutation.isPending} className="w-full bg-emerald-500 text-zinc-950 font-bold p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all mb-4 disabled:opacity-50">
             <Download size={20} /> {cloneMutation.isPending ? 'Clonando...' : 'Clonar en mi cuenta'}
           </button>
        ) : isSubscribed ? (
           <button disabled className="w-full bg-zinc-800 border border-zinc-700 text-emerald-500 font-bold p-4 rounded-xl flex items-center justify-center gap-2 mb-4 opacity-80 cursor-not-allowed">
             <Check size={20} /> Ya estás suscrito
           </button>
        ) : (
           <button onClick={() => { addSubscribedRoutine(id!); alert('Rutina añadida a tu Biblioteca'); navigate('/routines'); }} className="w-full bg-blue-500 text-zinc-950 font-bold p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all mb-4">
             <RefreshCw size={20} /> Suscribirse (Añadir a Biblioteca)
           </button>
        )}

        {/* Siempre dar la opción alternativa de clonarla desconectada */}
        {(mode === 'sync' || mode === 'collab') && (
           <button onClick={() => cloneMutation.mutate()} disabled={cloneMutation.isPending} className="w-full bg-zinc-950 border border-zinc-800 text-zinc-300 font-bold p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all mb-4 disabled:opacity-50 text-sm">
             <Copy size={16} /> Crear mi propia copia aislada
           </button>
        )}

        <button onClick={() => navigate('/')} className="text-zinc-500 text-sm flex items-center gap-2 hover:text-zinc-300 transition-colors mt-2">
          <ArrowLeft size={16} /> Ir al inicio
        </button>
      </div>
    </div>
  )
}