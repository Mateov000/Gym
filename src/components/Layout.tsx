import { Outlet, Link, useLocation } from 'react-router-dom'
import { Home, Dumbbell, BookOpen, User, TrendingUp } from 'lucide-react'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="bg-zinc-950 min-h-screen text-zinc-100 font-sans">
      
      <div className="pb-20">
        <Outlet />
      </div>

      <nav className="fixed bottom-0 w-full bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 px-2 py-3 flex justify-between items-center z-50 pb-safe">
        
        <Link 
          to="/" 
          className={`flex flex-col items-center gap-1 transition-colors flex-1 ${
            location.pathname === '/' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <Home size={22} />
          <span className="text-[10px] font-bold">Feed</span>
        </Link>

        <Link
          to="/routines"
          className={`flex flex-col items-center gap-1 transition-colors flex-1 ${
            location.pathname === '/routines' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <BookOpen size={22} />
          <span className="text-[10px] font-bold">Rutinas</span>
        </Link>
        
        <Link 
          to="/exercises" 
          className={`flex flex-col items-center gap-1 transition-colors flex-1 ${
            location.pathname === '/exercises' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <Dumbbell size={22} />
          <span className="text-[10px] font-bold">Entrenar</span>
        </Link>

        <Link 
          to="/analytics" 
          className={`flex flex-col items-center gap-1 transition-colors flex-1 ${
            location.pathname === '/analytics' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <TrendingUp size={22} />
          <span className="text-[10px] font-bold">Análisis</span>
        </Link>

        <Link 
          to="/profile" 
          className={`flex flex-col items-center gap-1 transition-colors flex-1 ${
            location.pathname === '/profile' ? 'text-emerald-500' : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          <User size={22} />
          <span className="text-[10px] font-bold">Perfil</span>
        </Link>

      </nav>
    </div>
  )
}