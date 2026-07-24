import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Edit2, Trash2, ArrowLeft, Save, Dumbbell, Image as ImageIcon } from 'lucide-react'
import { fetchExercises, createExercise, updateExercise, deleteExercise } from '../lib/queries'
import { useWorkoutStore } from '../store/useWorkoutStore'
import type { Exercise } from '../types/workout'

export default function Exercises() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { activeSession, addExercise } = useWorkoutStore()

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises', 'catalog'],
    queryFn: fetchExercises,
  })

  const [search, setSearch] = useState('')
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editingEx, setEditingEx] = useState<Partial<Exercise> | null>(null)

  // Filtro de búsqueda
  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => 
      ex.name.toLowerCase().includes(search.toLowerCase()) || 
      (ex.muscle_group && ex.muscle_group.toLowerCase().includes(search.toLowerCase()))
    )
  }, [exercises, search])

  // Mutaciones CRUD
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

  // Manejadores
  const handleExerciseClick = (ex: Exercise) => {
    if (activeSession) {
      // Si hay una sesión activa, al tocarlo lo añadimos al entrenamiento
      addExercise(ex, { set_type: 'normal', default_reps: 10, default_weight: 20 })
      navigate('/workout')
    } else {
      // Si solo estamos navegando, al tocarlo abrimos el editor
      setEditingEx(ex)
      setView('form')
    }
  }

  const handleDelete = () => {
    if (editingEx?.id && window.confirm('¿Eliminar este ejercicio de la base de datos?')) {
      deleteMutation.mutate(editingEx.id)
    }
  }

  // --- VISTA DE EDITOR (FORMULARIO) ---
  if (view === 'form' && editingEx) {
    return (
      <div className="p-4 pb-24 min-h-screen text-zinc-100 relative">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => { setView('list'); setEditingEx(null) }} className="p-2 bg-zinc-900 rounded-xl text-zinc-400">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-bold">{editingEx.id ? 'Editar' : 'Nuevo Ejercicio'}</h1>
          <button 
            onClick={() => saveMutation.mutate(editingEx)} 
            disabled={saveMutation.isPending || !editingEx.name}
            className="p-2 bg-emerald-500 text-zinc-950 rounded-xl font-bold disabled:opacity-50"
          >
            <Save size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {editingEx.image_url && (
            <div className="w-full h-48 bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
              <img src={editingEx.image_url} alt="Demo" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
            </div>
          )}

          <div className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Nombre *</label>
            <input 
              type="text" 
              value={editingEx.name || ''} 
              onChange={e => setEditingEx({ ...editingEx, name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 mb-4"
              placeholder="Ej: Press de Banca"
            />

            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Grupo Muscular</label>
            <input 
              type="text" 
              value={editingEx.muscle_group || ''} 
              onChange={e => setEditingEx({ ...editingEx, muscle_group: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 mb-4"
              placeholder="Ej: Pecho, Espalda, Piernas..."
            />

            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Enlace de Imagen / GIF</label>
            <input 
              type="url" 
              value={editingEx.image_url || ''} 
              onChange={e => setEditingEx({ ...editingEx, image_url: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 mb-4"
              placeholder="https://..."
            />

            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Técnica y Notas</label>
            <textarea 
              value={editingEx.description || ''} 
              onChange={e => setEditingEx({ ...editingEx, description: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-emerald-500 resize-none h-32"
              placeholder="Mantén la espalda recta y saca pecho..."
            />
          </div>

          {editingEx.id && (
            <button 
              onClick={handleDelete}
              className="w-full py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold flex justify-center items-center gap-2 mt-4"
            >
              <Trash2 size={20} /> Eliminar Ejercicio
            </button>
          )}
        </div>
      </div>
    )
  }

  // --- VISTA DE LISTA (CATÁLOGO) ---
  return (
    <div className="p-4 pb-24 min-h-screen text-zinc-100 relative">
      <h1 className="text-3xl font-bold mb-4">Ejercicios</h1>

      {activeSession && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-xl mb-4 text-sm font-medium text-center">
          Modo Selección: Toca un ejercicio para añadirlo a tu rutina actual.
        </div>
      )}

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text" 
          placeholder="Buscar ejercicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 outline-none focus:border-emerald-500"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-zinc-500 mt-10">Cargando catálogo...</div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredExercises.map((ex) => (
            <div 
              key={ex.id} 
              onClick={() => handleExerciseClick(ex)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 flex items-center gap-4 active:scale-[0.98] transition-transform cursor-pointer"
            >
              {/* Miniatura de imagen */}
              <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                {ex.image_url ? (
                  <img src={ex.image_url} alt={ex.name} className="w-full h-full object-cover" />
                ) : (
                  <Dumbbell className="text-zinc-700" size={24} />
                )}
              </div>

              {/* Información */}
              <div className="flex-1">
                <h3 className="font-bold text-zinc-100">{ex.name}</h3>
                {ex.muscle_group && <p className="text-xs text-zinc-500 uppercase tracking-wider">{ex.muscle_group}</p>}
              </div>

              {/* Botón directo de edición (solo si no hay sesión activa) */}
              {!activeSession && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setEditingEx(ex); setView('form'); }}
                  className="p-3 text-zinc-500 hover:text-emerald-500"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          ))}
          {filteredExercises.length === 0 && (
            <div className="text-center text-zinc-500 mt-10">No se encontraron ejercicios.</div>
          )}
        </div>
      )}

      {/* Botón Flotante para Crear (FAB) */}
      {!activeSession && (
        <button 
          onClick={() => { setEditingEx({ name: '', muscle_group: '', description: '', image_url: '' }); setView('form'); }}
          className="fixed bottom-24 right-6 bg-emerald-500 text-zinc-950 p-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 transition-transform z-40"
        >
          <Plus size={28} strokeWidth={3} />
        </button>
      )}
    </div>
  )
}
