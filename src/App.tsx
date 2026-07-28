import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import type { Session } from '@supabase/supabase-js'
import { Settings as SettingsIcon, LogOut } from 'lucide-react'

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
import SessionDetails from './pages/SessionDetails'
import SettingsPage from './pages/Settings'
import Analytics from './pages/Analytics' // <-- NUEVA PÁGINA

const Profile = () => {
  const navigate = useNavigate()
  return (
    <div className="p-6 text-zinc-100 pb-24">
      <h1 className="text-2xl font-bold mb-6">Perfil</h1>
      <div className="flex flex-col gap-4">
        <button onClick={() => navigate('/settings')} className="w-full bg-zinc-900 border border-zinc-800 text-zinc-100 p-4 rounded-xl font-bold active:scale-95 transition-transform flex items-center gap-3">
          <SettingsIcon size={20} className="text-emerald-500" /> Configuración
        </button>
        <button onClick={() => supabase.auth.signOut()} className="w-full bg-red-500/10 text-red-500 border border-red-500/20 p-4 rounded-xl font-bold active:scale-95 transition-transform flex items-center gap-3">
          <LogOut size={20} /> Cerrar Sesión
        </button>
      </div>
    </div>
  )
}

function ProtectedRoute({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Auth />
  return <>{children}</>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setIsInitializing(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (isInitializing) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500">Cargando...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/routines/shared/:id" element={<SharedRoutine />} />

        <Route element={<ProtectedRoute session={session}><Layout /></ProtectedRoute>}>
          <Route path="/" element={<Feed />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/analytics" element={<Analytics />} /> {/* <-- NUEVA RUTA */}
          <Route path="/profile" element={<Profile />} />
        </Route>
        
        <Route path="/workout" element={<ProtectedRoute session={session}><Workout /></ProtectedRoute>} />
        <Route path="/routines/new" element={<ProtectedRoute session={session}><RoutineBuilder /></ProtectedRoute>} />
        <Route path="/routines/:id/edit" element={<ProtectedRoute session={session}><RoutineEditor /></ProtectedRoute>} />
        <Route path="/session/:id" element={<ProtectedRoute session={session}><SessionDetails /></ProtectedRoute>} />
        <Route path="/session/:id/edit" element={<ProtectedRoute session={session}><SessionEditor /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute session={session}><SettingsPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}