import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchWorkoutHistory, fetchExercises } from '../lib/queries'
import { useSettingsStore } from '../store/useSettingsStore'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, BarChart3, AlertTriangle, Dumbbell, Info } from 'lucide-react'

// Utilidad para unificar todos los pesos a KG antes de graficar
function convertToKg(value: number, fromUnit: string, equivalencies: any[]): number {
  if (fromUnit === 'kg') return value;
  if (fromUnit === 'bodyweight') return 0;

  const graph: Record<string, { to: string, factor: number }[]> = {};
  const addEdge = (u: string, v: string, f: number) => {
    if (!graph[u]) graph[u] = [];
    graph[u].push({ to: v, factor: f });
  };
  addEdge('kg', 'lbs', 2.20462262); addEdge('lbs', 'kg', 0.45359237);
  equivalencies.forEach((eq: any) => { addEdge(eq.from, eq.to, eq.multiplier); addEdge(eq.to, eq.from, 1 / eq.multiplier); });
  
  const queue: { unit: string, val: number }[] = [{ unit: fromUnit, val: value }];
  const visited = new Set<string>([fromUnit]);

  while (queue.length > 0) {
    const { unit, val } = queue.shift()!;
    if (unit === 'kg') return val;
    for (const neighbor of (graph[unit] || [])) {
      if (!visited.has(neighbor.to)) { visited.add(neighbor.to); queue.push({ unit: neighbor.to, val: val * neighbor.factor }); }
    }
  }
  return value; // Fallback
}

export default function Analytics() {
  const { equivalencies } = useSettingsStore()
  
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({ 
    queryKey: ['workout-history', 'analytics'], 
    queryFn: () => fetchWorkoutHistory(50) // Traemos las últimas 50 sesiones
  })
  
  const { data: exercises = [], isLoading: loadingEx } = useQuery({ 
    queryKey: ['exercises', 'catalog'], 
    queryFn: fetchExercises 
  })

  const [selectedExId, setSelectedExId] = useState<string>('')

  // 1. DATA PARA EL GRÁFICO DE VOLUMEN (Tonelaje por sesión)
  const volumeData = useMemo(() => {
    return [...sessions].reverse().map(session => {
      let totalVolume = 0;
      session.workout_sets?.forEach(set => {
        if (set.set_type !== 'warm_up') {
          const weightInKg = convertToKg(set.weight, set.unit || 'kg', equivalencies)
          totalVolume += (weightInKg * set.reps)
        }
      })
      return {
        date: new Date(session.start_time).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        volumen: Math.round(totalVolume)
      }
    })
  }, [sessions, equivalencies])

  // 2. DATA PARA EL GRÁFICO DE 1RM (Fuerza Máxima)
  const e1rmData = useMemo(() => {
    if (!selectedExId) return []
    return [...sessions].reverse().map(session => {
      let max1RM = 0;
      session.workout_sets?.forEach(set => {
        if (set.exercise_id === selectedExId && set.set_type !== 'warm_up') {
          const weightInKg = convertToKg(set.weight, set.unit || 'kg', equivalencies)
          const e1rm = weightInKg * (1 + set.reps / 30);
          if (e1rm > max1RM) max1RM = e1rm;
        }
      })
      return max1RM > 0 ? {
        date: new Date(session.start_time).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        '1RM Estimado (kg)': Math.round(max1RM * 10) / 10
      } : null;
    }).filter(Boolean)
  }, [sessions, selectedExId, equivalencies])

  // 3. DETECTOR DE ESTANCAMIENTO (Últimas 3 sesiones por ejercicio)
  const stagnationAlerts = useMemo(() => {
    const alerts: { exerciseId: string, name: string }[] = []
    const exHistory = new Map<string, number[]>()

    // Recopilar el 1RM máximo de cada ejercicio en cada sesión cronológicamente
    ;[...sessions].reverse().forEach(session => {
      const sessionMaxes = new Map<string, number>()
      session.workout_sets?.forEach(set => {
        if (set.set_type === 'warm_up') return
        const weightInKg = convertToKg(set.weight, set.unit || 'kg', equivalencies)
        const e1rm = weightInKg * (1 + set.reps / 30)
        const currentMax = sessionMaxes.get(set.exercise_id) || 0
        if (e1rm > currentMax) sessionMaxes.set(set.exercise_id, e1rm)
      })
      sessionMaxes.forEach((maxRm, exId) => {
        if (!exHistory.has(exId)) exHistory.set(exId, [])
        exHistory.get(exId)!.push(maxRm)
      })
    })

    // Analizar varianza
    exHistory.forEach((history, exId) => {
      if (history.length >= 3) {
        const last3 = history.slice(-3)
        const max = Math.max(...last3)
        const min = Math.min(...last3)
        // Si la variación entre el máximo y mínimo de las últimas 3 sesiones es menor al 3%
        if (max > 0 && ((max - min) / max) <= 0.03) {
          const name = exercises.find(e => e.id === exId)?.name || 'Ejercicio'
          alerts.push({ exerciseId: exId, name })
        }
      }
    })

    return alerts
  }, [sessions, exercises, equivalencies])

  // Setear un ejercicio por defecto para el gráfico 1RM cuando cargan los datos
  if (!selectedExId && exercises.length > 0 && e1rmData.length === 0) {
    const firstExDone = sessions.find(s => s.workout_sets?.length)?.[0]
    if (firstExDone) setSelectedExId(firstExDone.exercise_id)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl shadow-xl">
          <p className="text-zinc-400 text-xs mb-1 font-bold">{label}</p>
          <p className="text-emerald-400 font-bold text-sm">
            {payload[0].name === 'volumen' ? 'Volumen: ' : ''}{payload[0].value} {payload[0].name === 'volumen' ? 'kg' : 'kg'}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loadingSessions || loadingEx) return <div className="p-6 text-zinc-500 min-h-screen text-center mt-10">Procesando datos...</div>

  return (
    <div className="p-4 pb-24 min-h-screen text-zinc-100 relative max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="text-emerald-500" size={32} /> Estadísticas
        </h1>
      </div>

      {sessions.length < 3 ? (
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center">
          <Info className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-50" />
          <p className="text-zinc-400">Necesitas al menos 3 entrenamientos para generar estadísticas y ver tu progreso real.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          {/* 1. DETECTOR DE ESTANCAMIENTO */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            {stagnationAlerts.length > 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-2xl">
                <h2 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} /> Alerta de Estancamiento
                </h2>
                <p className="text-sm text-zinc-300 mb-3 leading-relaxed">
                  Tus niveles de fuerza en estos ejercicios no han variado en las últimas 3 sesiones. Considera cambiar el rango de repeticiones o probar una alternativa:
                </p>
                <div className="flex flex-wrap gap-2">
                  {stagnationAlerts.map(alert => (
                    <span key={alert.exerciseId} className="bg-yellow-500/20 text-yellow-500 text-xs font-bold px-3 py-1.5 rounded-lg border border-yellow-500/20">
                      {alert.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-5 rounded-2xl flex items-center gap-4">
                <div className="p-3 bg-emerald-500/20 rounded-full text-emerald-500"><TrendingUp size={24}/></div>
                <div>
                  <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-1">Cero Estancamiento</h2>
                  <p className="text-xs text-emerald-400/80">Vienes aplicando sobrecarga progresiva excelente. ¡Sigue así!</p>
                </div>
              </div>
            )}
          </div>

          {/* 2. GRÁFICO DE 1RM */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                  <Dumbbell size={16} /> Evolución de Fuerza (1RM)
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Estimación de peso máximo a 1 repetición.</p>
              </div>
              <select 
                value={selectedExId} 
                onChange={(e) => setSelectedExId(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-zinc-300 text-sm font-bold rounded-xl p-2.5 outline-none focus:border-emerald-500 max-w-full sm:max-w-[200px]"
              >
                <option value="" disabled>Selecciona un ejercicio...</option>
                {exercises.map(ex => (
                  <option key={ex.id} value={ex.id}>{ex.name}</option>
                ))}
              </select>
            </div>
            
            <div className="h-64 w-full">
              {e1rmData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={e1rmData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickMargin={10} />
                    <YAxis stroke="#71717a" fontSize={10} tickFormatter={(val) => `${val}kg`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="1RM Estimado (kg)" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#09090b' }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 border-dashed rounded-xl">
                  No hay suficientes datos para este ejercicio.
                </div>
              )}
            </div>
          </div>

          {/* 3. GRÁFICO DE VOLUMEN TOTAL */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            <div className="mb-6">
              <h2 className="text-sm font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={16} /> Volumen por Sesión (Tonelaje)
              </h2>
              <p className="text-xs text-zinc-500 mt-1">La suma de todos los kilos levantados por día.</p>
            </div>
            
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volumeData} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="date" stroke="#71717a" fontSize={10} tickMargin={10} />
                  <YAxis stroke="#71717a" fontSize={10} tickFormatter={(val) => `${val/1000}k`} />
                  <Tooltip content={<CustomTooltip />} cursor={{fill: '#27272a', opacity: 0.4}} />
                  <Bar dataKey="volumen" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}