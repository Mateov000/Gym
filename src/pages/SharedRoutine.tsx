import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Download, ArrowLeft } from 'lucide-react'
import { fetchRoutineById, cloneRoutine } from '../lib/queries'

export default function SharedRoutine() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: routine, isLoading, isError } = useQuery({
    queryKey: ['shared-routine', id],
    queryFn: () => fetchRoutineById(id!),
    enabled: !!id,
  })

  const cloneMutation = useMutation({
    mutationFn: () => cloneRoutine(id!),
    onSuccess: () => {
      // Obligamos a la app a recargar la lista de rutinas para que aparezca la nueva
      queryClient.invalidateQueries({ queryKey: ['routines'] })
      navigate('/routines')
    },
    onError: (err: any) => {
      alert(`Error al clonar: ${err.message}`)
    }
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
        <p className="text-emerald-400 font-black text-2xl mb-4">{routine.name}</p>
        
        {routine.notes && (
          <p className="text-zinc-400 text-sm mb-6 bg-zinc-950 p-4 rounded-xl w-full border border-zinc-800/50">
            {routine.notes}
          </p>
        )}
        
        <p className="text-zinc-500 text-xs mb-8 uppercase tracking-widest font-bold">
          {routine.routine_days?.length || 0} días de entrenamiento
        </p>

        <button 
          onClick={() => cloneMutation.mutate()}
          disabled={cloneMutation.isPending}
          className="w-full bg-emerald-500 text-zinc-950 font-bold p-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all mb-4 disabled:opacity-50"
        >
          <Download size={20} />
          {cloneMutation.isPending ? 'Clonando...' : 'Clonar en mi cuenta'}
        </button>

        <button 
          onClick={() => navigate('/')}
          className="text-zinc-500 text-sm flex items-center gap-2 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={16} /> Ir al inicio
        </button>
      </div>
    </div>
  )
}