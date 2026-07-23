import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Dumbbell, User } from 'lucide-react'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      
      {/* 
        El Outlet es el "hueco" mágico. 
        Aquí React Router inyecta la pantalla en la que estés (Feed, Exercises o Profile).
      */}
      <div className="pb-20">
        <Outlet />
      </div>

      {/* Menú de Navegación Inferior */}
      <nav className="fixed bottom-0 w-full bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 px-6 py-3 flex justify-around items-center z-50 pb-safe">
        
        {/* Botón Feed */}
        <Link 
          to="/" 
          className={`flex flex-col items-center gap-1 transition-colors ${
            location.pathname === '/' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <Home size={24} />
          <span className="text-xs font-medium">Progreso</span>
        </Link>
        
        {/* Botón Entrenar (Catálogo) */}
        <Link 
          to="/exercises" 
          className={`flex flex-col items-center gap-1 transition-colors ${
            location.pathname === '/exercises' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <Dumbbell size={24} />
          <span className="text-xs font-medium">Entrenar</span>
        </Link>

        {/* Botón Perfil */}
        <Link 
          to="/profile" 
          className={`flex flex-col items-center gap-1 transition-colors ${
            location.pathname === '/profile' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <User size={24} />
          <span className="text-xs font-medium">Perfil</span>
        </Link>

      </nav>
    </div>
  )
}