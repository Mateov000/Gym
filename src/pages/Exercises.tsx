import { useState } from 'react'
import { Search, Dumbbell, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useWorkoutStore } from '../store/useWorkoutStore'
import { useQuery } from '@tanstack/react-query'
import { fetchExercises } from '../lib/queries'
import type { Exercise } from '../types/workout'

export default function Exercises() {
  const [searchTerm, setSearchTerm] = useState('')
  
  const navigate = useNavigate()
  // Traemos las herramientas de nuestro cerebro global
  const { activeSession, startSession, addExercise } = useWorkoutStore()

  const { data: exercises = [], isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: fetchExercises,
  })

  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="p-6 pb-24 flex flex-col h-screen">
      <h1 className="text-3xl font-bold text-zinc-100 mb-6">Ejercicios</h1>
      
      {/* Buscador */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar ejercicio..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
      </div>

      {/* Lista de Ejercicios */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="text-center text-zinc-500 mt-10">Cargando catálogo...</div>
        ) : filteredExercises.length === 0 ? (
          <div className="text-center text-zinc-500 mt-10">No se encontraron ejercicios.</div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredExercises.map((exercise: Exercise) => (
              <button 
                key={exercise.id}
                onClick={() => {
                  // 1. Si no hay sesión, la creamos
                  if (!activeSession) {
                    startSession()
                  }
                  // 2. Metemos el ejercicio al carrito global
                  addExercise(exercise)
                  // 3. Viajamos al Workout
                  navigate('/workout')
                }}
                className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-zinc-800 p-3 rounded-xl">
                    <Dumbbell className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-100">{exercise.name}</h3>
                    {/* Usamos la columna real: muscle_group */}
                    <p className="text-sm text-zinc-400">
                      {exercise.muscle_group}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}