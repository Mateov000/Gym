import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Share2, Dumbbell, Play, X, FileText, Code, Copy, RefreshCw, Users, Link as LinkIcon, Unlink } from 'lucide-react'
import { fetchRoutines, fetchRoutinesByIds, deleteRoutine, fetchExercises } from '../lib/queries'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useSettingsStore } from '../store/useSettingsStore'
import type { RoutineWithDays } from '../types/routine'

export default function Routines() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { startRoutine } = useWorkoutStore() 
  const { subscribedRoutines, removeSubscribedRoutine } = useSettingsStore()
  
  const { data: ownedRoutines = [], isLoading: loadingOwned } = useQuery({ queryKey: ['routines'], queryFn: fetchRoutines })
  const { data: subRoutines = [], isLoading: loadingSub } = useQuery({ 
    queryKey: ['subscribed-routines', subscribedRoutines], 
    queryFn: () => fetchRoutinesByIds(subscribedRoutines),
    enabled: subscribedRoutines.length > 0 
  })
  const { data: allExercises = [] } = useQuery({ queryKey: ['exercises', 'catalog'], queryFn: fetchExercises })

  // Juntar Rutinas Propias + Suscritas
  const routines = Array.from(new Map([...ownedRoutines, ...subRoutines].map(item => [item.id, item])).values())
  const isLoading = loadingOwned || loadingSub

  const deleteRoutineMutation = useMutation({
    mutationFn: deleteRoutine,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['routines'] }),
    onError: (err: any) => alert(`Error al eliminar: ${err.message}`)
  })

  // Exportar & Compartir
  const [shareModal, setShareModal] = useState<RoutineWithDays | null>(null)
  const [shareMode, setShareMode] = useState('copy') // 'copy', 'sync', 'collab'

  const generateReadableText = (routine: RoutineWithDays) => {
    let text = `🏋️ ${routine.name}\n`
    if (routine.notes) text += `📝 ${routine.notes}\n`
    text += `\n`
    routine.routine_days.forEach(day => {
      text += `📅 ${day.name}\n`
      day.routine_exercises.forEach((ex, idx) => {
        const exName = allExercises.find(e => e.id === ex.exercise_id)?.name || 'Ejercicio'
        text += `  ${idx + 1}. ${exName}: ${ex.target_sets} series de ${ex.target_reps} reps\n`
      })
      text += '\n'
    })
    return text.trim()
  }

  const generateImportableText = (routine: RoutineWithDays) => {
    let text = `Rutina: ${routine.name}\n`
    if (routine.folder) text += `Carpeta: ${routine.folder}\n`
    if (routine.notes) text += `Notas: ${routine.notes}\n\n`
    routine.routine_days.forEach(day => {
      text += `Día: ${day.name}\n`
      day.routine_exercises.forEach((ex) => {
        const exName = allExercises.find(e => e.id === ex.exercise_id)?.name || 'Ejercicio'
        text += `${exName} | ${ex.target_sets}x${ex.target_reps}\n`
      })
      text += '\n'
    })
    return text.trim()
  }

  const handleCopyText = (type: 'readable' | 'import') => {
    if (!shareModal) return
    const text = type === 'readable' ? generateReadableText(shareModal) : generateImportableText(shareModal)
    navigator.clipboard.writeText(text)
    alert('¡Copiado al portapapeles!')
  }

  const handleCopyLink = () => {
    if (!shareModal) return
    const url = `${window.location.origin}/routines/shared/${shareModal.id}?mode=${shareMode}`
    navigator.clipboard.writeText(url)
    alert('¡Enlace copiado al portapapeles!')
    setShareModal(null)
  }

  const handleStartDay = (routine: any, day: any) => {
    startRoutine(routine, day)
    navigate('/workout')
  }

  return (
    <div className="p-4 pb-24 min-h-screen text-zinc-100 relative max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Tus Rutinas</h1>
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-500 mt-10 animate-pulse">Cargando rutinas...</div>
      ) : routines.length === 0 ? (
        <div className="text-center mt-10 bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
          <Dumbbell className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">No tienes rutinas guardadas.</p>
          <p className="text-sm text-zinc-500 mt-2">Crea una plantilla para no tener que elegir ejercicios todos los días.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routines.map((routine: RoutineWithDays) => {
            const isSubscribed = subscribedRoutines.includes(routine.id);

            return (
              <div key={routine.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                      {routine.name}
                      {isSubscribed && <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Sincronizada</span>}
                    </h3>
                    {routine.notes && <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{routine.notes}</p>}
                  </div>
                </div>

                <div className="mt-2 mb-2">
                  {routine.routine_days && routine.routine_days.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Iniciar Entrenamiento:</span>
                      <div className="flex flex-wrap gap-2">
                        {routine.routine_days.map((day: any) => (
                          <button key={day.id} onClick={() => handleStartDay(routine, day)} className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform">
                            <Play size={14} fill="currentColor" /> <span className="truncate max-w-[150px]">{day.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : <span className="text-xs text-zinc-600 italic">No hay días configurados.</span>}
                </div>

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800/50">
                  {isSubscribed ? (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/routines/${routine.id}/edit`) }} className="flex-1 text-zinc-300 hover:text-emerald-500 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 active:scale-95 transition-transform flex justify-center gap-2 font-bold text-sm"><Edit2 size={16}/> Editar</button>
                      <button onClick={(e) => { e.stopPropagation(); removeSubscribedRoutine(routine.id) }} className="text-red-500 hover:text-red-400 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 active:scale-95"><Unlink size={18} /></button>
                    </>
                  ) : (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/routines/${routine.id}/edit`) }} className="flex-1 text-zinc-300 hover:text-emerald-500 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 active:scale-95 transition-transform flex justify-center gap-2 font-bold text-sm"><Edit2 size={16}/> Editar</button>
                      <button onClick={(e) => { e.stopPropagation(); setShareModal(routine) }} className="text-zinc-400 hover:text-blue-400 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 active:scale-95"><Share2 size={18} /></button>
                      <button onClick={(e) => { e.stopPropagation(); if(window.confirm('¿Borrar esta rutina?')) deleteRoutineMutation.mutate(routine.id) }} className="text-zinc-400 hover:text-red-500 bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 active:scale-95"><Trash2 size={18} /></button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---> MODAL COMPARTIR Y EXPORTAR <--- */}
      {shareModal && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 w-full sm:max-w-md rounded-3xl p-6 relative flex flex-col gap-6 animate-in slide-in-from-bottom-10">
            <button onClick={() => setShareModal(null)} className="absolute top-4 right-4 p-2 bg-zinc-800 rounded-full text-zinc-400"><X size={20}/></button>
            <div>
               <h3 className="text-xl font-bold text-zinc-100 mb-1">Exportar / Compartir</h3>
               <p className="text-sm text-emerald-500 font-bold">{shareModal.name}</p>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={() => handleCopyText('readable')} className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-left active:scale-95 transition-transform">
                <FileText className="text-emerald-500 flex-shrink-0" size={24} />
                <div>
                  <p className="font-bold text-zinc-100 text-sm">Copiar Texto Legible</p>
                  <p className="text-xs text-zinc-500 leading-tight mt-0.5">Ideal para enviar por WhatsApp o guardar en tus notas.</p>
                </div>
              </button>

              <button onClick={() => handleCopyText('import')} className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-left active:scale-95 transition-transform">
                <Code className="text-blue-500 flex-shrink-0" size={24} />
                <div>
                  <p className="font-bold text-zinc-100 text-sm">Copiar Plantilla Textual</p>
                  <p className="text-xs text-zinc-500 leading-tight mt-0.5">Texto compatible para que otros lo peguen e importen.</p>
                </div>
              </button>
            </div>

            <div className="border-t border-zinc-800 pt-4">
              <p className="text-sm font-bold text-zinc-100 mb-3">Crear Enlace Mágico</p>
              
              <div className="flex flex-col gap-2 mb-4">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${shareMode === 'copy' ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
                   <input type="radio" name="shareMode" value="copy" checked={shareMode === 'copy'} onChange={() => setShareMode('copy')} className="hidden"/>
                   <Copy size={18} className={shareMode === 'copy' ? 'text-emerald-500' : 'text-zinc-500'} />
                   <div className="flex-1">
                     <p className={`text-sm font-bold ${shareMode === 'copy' ? 'text-emerald-500' : 'text-zinc-300'}`}>Copia Individual</p>
                     <p className="text-[10px] text-zinc-500 leading-tight">Quien lo abra se quedará con una copia propia desconectada de ti.</p>
                   </div>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${shareMode === 'sync' ? 'bg-blue-500/10 border-blue-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
                   <input type="radio" name="shareMode" value="sync" checked={shareMode === 'sync'} onChange={() => setShareMode('sync')} className="hidden"/>
                   <RefreshCw size={18} className={shareMode === 'sync' ? 'text-blue-500' : 'text-zinc-500'} />
                   <div className="flex-1">
                     <p className={`text-sm font-bold ${shareMode === 'sync' ? 'text-blue-500' : 'text-zinc-300'}`}>Sincronizada (Propietario)</p>
                     <p className="text-[10px] text-zinc-500 leading-tight">Si cambias algo en la rutina, a ellos también se les actualizará.</p>
                   </div>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${shareMode === 'collab' ? 'bg-purple-500/10 border-purple-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
                   <input type="radio" name="shareMode" value="collab" checked={shareMode === 'collab'} onChange={() => setShareMode('collab')} className="hidden"/>
                   <Users size={18} className={shareMode === 'collab' ? 'text-purple-500' : 'text-zinc-500'} />
                   <div className="flex-1">
                     <p className={`text-sm font-bold ${shareMode === 'collab' ? 'text-purple-500' : 'text-zinc-300'}`}>Colaborativa (Pública)</p>
                     <p className="text-[10px] text-zinc-500 leading-tight">Cualquiera con el link podrá editarla y alterar la original.</p>
                   </div>
                </label>
              </div>

              <button onClick={handleCopyLink} className="w-full bg-emerald-500 text-zinc-950 font-bold p-3.5 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform">
                <LinkIcon size={18} /> Copiar Enlace
              </button>
            </div>
          </div>
        </div>
      )}

      <button onClick={() => navigate('/routines/new')} className="fixed bottom-24 right-6 bg-emerald-500 text-zinc-950 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-transform z-40">
        <Plus size={28} strokeWidth={3} />
      </button>
    </div>
  )
}