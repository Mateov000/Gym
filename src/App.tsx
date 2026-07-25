import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom' // <-- Importamos Navigate
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'

import Auth from './pages/Auth'
import Layout from './components/Layout'
import Workout from './pages/Workout'
import Feed from './pages/Feed'
import Exercises from './pages/Exercises'
import Routines from './pages/Routines'
import RoutineBuilder from './pages/RoutineBuilder'
import SharedRoutine from './pages/SharedRoutine'
import RoutineEditor from './pages/RoutineEditor'
import SessionEditor from './pages/SessionEditor'

const Profile = () => (
  <div className="p-6 text-zinc-100 pb-24">
    <h1 className="text-2xl font-bold mb-4">Perfil</h1>
    <button 
      onClick={() => supabase.auth.signOut()} 
      className="bg-red-500/10 text-red-500 border border-red-500/20 px-4 py-2 rounded-xl font-bold active:scale-95 transition-transform"
    >
      Cerrar Sesión
    </button>
  </div>
)

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsInitializing(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isInitializing) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Cargando...</div>
  }

  // Si no está logueado, mostramos Auth.
  // La genialidad aquí es que la URL (ej. /routines/shared/...) se conserva en el navegador.
  if (!session) {
    return <Auth />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Feed />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        
        <Route path="/workout" element={<Workout />} />
        <Route path="/routines/new" element={<RoutineBuilder />} />
        <Route path="/routines/shared/:id" element={<SharedRoutine />} />
        <Route path="/routines/:id/edit" element={<RoutineEditor />} />
        <Route path="/session/:id/edit" element={<SessionEditor />} />

        {/* ---> NUEVO: RUTA COMODÍN (CATCH-ALL) <--- */}
        {/* Si el usuario ingresa a cualquier link que no definimos arriba, lo mandamos al inicio */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}