import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, ArrowLeft, Save, Dumbbell, Download, Globe2, Lock, Bot } from 'lucide-react'
import { fetchExercises, createExercise, updateExercise, deleteExercise, deleteAllExercises } from '../lib/queries'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../types/workout'
import { COPY_AI_PROMPT } from './Settings'

function parseExercisesText(text: string): Partial<Exercise>[] {
  const exercises: Partial<Exercise>[] = []
  const blocks = text.split(/\n\s*\n/)
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    const ex: Partial<Exercise> = {}
    let isParsingDesc = false
    for (const line of lines) {
      const lowerLine = line.toLowerCase()
      if (lowerLine.startsWith('nombre:')) { ex.name = line.substring(7).trim(); isParsingDesc = false }
      else if (lowerLine.startsWith('grupo:')) { ex.muscle_group = line.substring(6).trim(); isParsingDesc = false }
      else if (lowerLine.startsWith('imagen:')) { ex.image_url = line.substring(7).trim(); isParsingDesc = false }
      else if (lowerLine.startsWith('descripcion:')) { ex.description = line.substring(12).trim(); isParsingDesc = true }
      else if (isParsingDesc) { ex.description = (ex.description || '') + '\n' + line.trim() }
    }
    if (ex.name) exercises.push(ex)
  }
  return exercises
}

export default function Exercises() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeSession, addExercise } = useWorkoutStore()

  const [currentUser, setCurrentUser] = useState<string | null>(null)
  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id || null))
  }, [])

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'form' | 'import'>('list')
  const [editingEx, setEditingEx] = useState<Partial<Exercise> | null>(null)
  
  const [importText, setImportText] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [importAsPublic, setImportAsPublic] = useState(false)

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => 
      ex.name.toLowerCase().includes(search.toLowerCase()) || 
      (ex.muscle_group && ex.muscle_group.toLowerCase().includes(search.toLowerCase()))
    )
  }, [exercises, search])

  const saveMutation = useMutation({
    mutationFn: async (ex: Partial<Exercise>) => {
      if (ex.id) return updateExercise(ex.id, ex)
      return createExercise(ex)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', 'catalog'] })
      setView('list')
      setEditingEx(null)
    },
    onError: (err: any) => alert(`Error: ${err.message}`)
  })

  const deleteMutation = useMutation({
    mutationFn: deleteExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', 'catalog'] })
      setView('list')
      setEditingEx(null)
    },
    onError: (err: any) => alert(`Error al eliminar: ${err.message}`)
  })

  const deleteAllMutation = useMutation({
    mutationFn: deleteAllExercises,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises', 'catalog'] })
      alert('¡El catálogo ha sido limpiado!')
    },
    onError: (err: any) => alert(`Error: ${err.message}`)
  })

  const handleExerciseClick = (ex: Exercise) => {
    if (activeSession) {
      addExercise(ex, { set_type: 'normal', default_reps: 10, default_weight: 20 })
      navigate('/workout')
    } else {
      const isOwner = ex.user_id === currentUser
      const isLegacyGlobal = !ex.user_id
      if (isOwner || isLegacyGlobal) {
        setEditingEx(ex)
        setView('form')
      } else {
        alert('Este es un ejercicio público creado por otro usuario. Solo puedes usarlo, no editarlo.')
      }
    }
  }

  const handleDelete = () => {
    if (editingEx?.id && window.confirm('¿Eliminar este ejercicio de la base de datos?')) {
      deleteMutation.mutate(editingEx.id)
    }
  }

  const handleDeleteAll = () => {
    if (window.confirm('🚨 ¿ESTÁS SEGURO? Se eliminarán todos los ejercicios que te pertenecen o que no tienen creador.\n\nEsta acción NO se puede deshacer.')) {
      deleteAllMutation.mutate()
    }
  }

  const handleImportSubmit = async () => {
    setIsImporting(true)
    try {
      const parsed = parseExercisesText(importText)
      if (parsed.length === 0) throw new Error("No se detectó ningún ejercicio válido.")

      await Promise.all(parsed.map(ex => createExercise({ ...ex, is_public: importAsPublic })))

      await queryClient.invalidateQueries({ queryKey: ['exercises', 'catalog'] })
      alert(`¡Se importaron ${parsed.length} ejercicios con éxito!`)
      setView('list')
      setImportText('')
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsImporting(false)
    }
  }

  if (view === 'import') {
    return (
      <div className="p-4 pb-24 min-h-screen text-zinc-100 relative max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => setView('list')} className="p-2 bg-zinc-900 rounded-xl text-zinc-400"><ArrowLeft size={24} /></button>
          <h1 className="text-xl font-bold">Importar Ejercicios</h1>
          <button onClick={handleImportSubmit} disabled={isImporting || !importText.trim()} className="p-2 bg-emerald-500 text-zinc-950 rounded-xl font-bold disabled:opacity-50"><Save size={20} /></button>
        </div>

        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-4 flex items-center justify-between">
          <div className="pr-4">
            <div className="flex items-center gap-2 mb-1">
              {importAsPublic ? <Globe2 size={16} className="text-emerald-500" /> : <Lock size={16} className="text-blue-400" />}
              <p className="font-bold text-zinc-100">Visibilidad</p>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {importAsPublic ? 'Todos los usuarios de la app verán estos ejercicios.' : 'Solo tú podrás ver y usar estos ejercicios.'}
            </p>
          </div>
          <button onClick={() => setImportAsPublic(!importAsPublic)} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${importAsPublic ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
            <div className={`absolute top-1 left-1 bg-zinc-950 w-4 h-4 rounded-full transition-transform ${importAsPublic ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 mb-4">
          <div className="flex items-start justify-between mb-2">
            <h2 className="text-sm font-bold text-emerald-500">Formato requerido:</h2>
            <button onClick={COPY_AI_PROMPT} className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-1 rounded-lg flex items-center gap-1.5 font-bold active:scale-95 transition-transform">
              <Bot size={12} /> Prompt IA
            </button>
          </div>
          <pre className="text-[10px] text-zinc-300 bg-zinc-950 p-3 rounded-xl overflow-x-auto border border-zinc-800">
{`Nombre: Sentadilla Búlgara
Grupo: Piernas
Imagen: https://link-al-gif.com/img.gif
Descripcion: Mantén el torso recto...`}
          </pre>
        </div>
        <textarea value={importText} onChange={e => setImportText(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-zinc-100 outline-none focus:border-emerald-500 resize-none h-64 text-sm" placeholder="Pega tus ejercicios aquí..." />
      </div>
    )
  }

  if (view === 'form' && editingEx) {
    return (
      <div className="p-4 pb-24 min-h-screen text-zinc-100 relative max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { setView('list'); setEditingEx(null) }} className="p-2 bg-zinc-900 rounded-xl text-zinc-400"><ArrowLeft size={24} /></button>
          <h1 className="text-xl font-bold">{editingEx.id ? 'Editar' : 'Nuevo Ejercicio'}</h1>
          <button onClick={() => saveMutation.mutate(editingEx)} disabled={saveMutation.isPending || !editingEx.name} className="p-2 bg-emerald-500 text-zinc-950 rounded-xl font-bold disabled:opacity-50"><Save size={20} /></button>
        </div>

        <div className="flex flex-col gap-4">
          {editingEx.image_url && (
            <div className="w-full h-48 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <img src={editingEx.image_url} alt="Demo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            </div>
          )}

          <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Nombre *</label>
            <input type="text" value={editingEx.name || ''} onChange={e => setEditingEx({ ...editingEx, name: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 mb-4" placeholder="Ej: Press de Banca" />
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Grupo Muscular</label>
            <input type="text" value={editingEx.muscle_group || ''} onChange={e => setEditingEx({ ...editingEx, muscle_group: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 mb-4" placeholder="Ej: Pecho, Espalda, Piernas..." />
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Enlace de Imagen / GIF</label>
            <input type="url" value={editingEx.image_url || ''} onChange={e => setEditingEx({ ...editingEx, image_url: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 mb-4" placeholder="https://..." />
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Técnica y Notas</label>
            <textarea value={editingEx.description || ''} onChange={e => setEditingEx({ ...editingEx, description: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 resize-none h-32" placeholder="Mantén la espalda recta y saca pecho..." />
          </div>

          <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="pr-4">
                <div className="flex items-center gap-2 mb-1">
                  {editingEx.is_public ? <Globe2 size={16} className="text-emerald-500" /> : <Lock size={16} className="text-blue-400" />}
                  <p className="font-bold text-zinc-100">Visibilidad</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {editingEx.is_public ? 'Público: Todos los usuarios verán este ejercicio en su catálogo.' : 'Privado: Solo tú podrás usar y ver este ejercicio.'}
                </p>
              </div>
              <button onClick={() => setEditingEx({ ...editingEx, is_public: !editingEx.is_public })} className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${editingEx.is_public ? 'bg-emerald-500' : 'bg-zinc-700'}`}>
                <div className={`absolute top-1 left-1 bg-zinc-950 w-4 h-4 rounded-full transition-transform ${editingEx.is_public ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {editingEx.id && (
            <button onClick={handleDelete} className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold flex justify-center items-center gap-2 mt-2">
              <Trash2 size={20} /> Eliminar Ejercicio
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-24 min-h-screen text-zinc-100 relative max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold">Ejercicios</h1>
        {!activeSession && (
          <div className="flex items-center gap-2">
            {exercises.length > 0 && <button onClick={handleDeleteAll} disabled={deleteAllMutation.isPending} className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50"><Trash2 size={20} /></button>}
            <button onClick={() => setView('import')} className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl hover:text-emerald-500 transition-colors"><Download size={20} /></button>
          </div>
        )}
      </div>

      {activeSession && <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl mb-4 text-sm font-medium text-center">Toca un ejercicio para añadirlo.</div>}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input type="text" placeholder="Buscar ejercicio..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-500" />
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-500 mt-10">Cargando catálogo...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredExercises.map((ex) => {
            const isOwner = ex.user_id === currentUser
            const isLegacyGlobal = !ex.user_id
            const canEdit = !activeSession && (isOwner || isLegacyGlobal)

            return (
              <div key={ex.id} onClick={() => handleExerciseClick(ex)} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer">
                <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {ex.image_url ? <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" /> : <Dumbbell className="text-zinc-700" size={24} />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-zinc-100">{ex.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {ex.muscle_group && <p className="text-xs text-zinc-500 uppercase tracking-wider">{ex.muscle_group}</p>}
                    {ex.is_public ? (
                      <span className="text-[9px] uppercase tracking-widest bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">Público</span>
                    ) : (
                      <span className="text-[9px] uppercase tracking-widest bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 flex items-center gap-1">Privado</span>
                    )}
                  </div>
                </div>

                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); setEditingEx(ex); setView('form'); }} className="p-3 text-zinc-500 hover:text-emerald-500">
                    <Edit2 size={18} />
                  </button>
                )}
              </div>
            )
          })}
          {filteredExercises.length === 0 && <div className="text-center text-zinc-500 mt-10 md:col-span-2 lg:col-span-3">No se encontraron ejercicios.</div>}
        </div>
      )}

      {!activeSession && (
        <button 
          onClick={() => { setEditingEx({ name: '', muscle_group: '', description: '', image_url: '', is_public: false }); setView('form'); }}
          className="fixed bottom-24 right-6 bg-emerald-500 text-zinc-950 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-transform z-40"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}