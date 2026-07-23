import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Dumbbell } from 'lucide-react'

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Revisa tu correo para confirmar tu cuenta.')
      }
    } catch (err: any) {
      setError(err.message || 'Error en la autenticación')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
      <Dumbbell className="w-16 h-16 text-emerald-500 mb-6" />
      <h1 className="text-3xl font-bold mb-8">Gym PWA</h1>

      <form onSubmit={handleAuth} className="w-full max-w-sm flex flex-col gap-4">
        {error && <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm">{error}</div>}
        
        <input
          type="email"
          placeholder="Tu correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-lg focus:outline-none focus:border-emerald-500"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-lg focus:outline-none focus:border-emerald-500"
          required
        />
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-emerald-500 text-zinc-950 font-bold text-lg p-4 rounded-xl mt-2 active:scale-95 transition-transform disabled:opacity-50"
        >
          {isLoading ? 'Cargando...' : (isLogin ? 'Entrar' : 'Crear Cuenta')}
        </button>
      </form>

      <button
        onClick={() => setIsLogin(!isLogin)}
        className="mt-6 text-zinc-400 p-2"
      >
        {isLogin ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta. Entrar'}
      </button>
    </div>
  )
}