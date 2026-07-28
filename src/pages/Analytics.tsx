import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchWorkoutHistory, fetchExercises } from '../lib/queries'
import { useSettingsStore } from '../store/useSettingsStore'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, BarChart3, AlertTriangle, Dumbbell, Info, Scale, Trash2, Activity } from 'lucide-react'
import MuscleHeatmap from '../components/MuscleHeatmap'

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
  return value;
}

export default function Analytics() {
  const { equivalencies, biometrics, addBiometric, removeBiometric } = useSettingsStore()
  
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({ 
    queryKey: ['workout-history', 'analytics'], 
    queryFn: () => fetchWorkoutHistory(50) 
  })
  
  const { data: exercises = [], isLoading: loadingEx } = useQuery({ 
    queryKey: ['exercises', 'catalog'], 
    queryFn: fetchExercises 
  })

  const [selectedExId, setSelectedExId] = useState<string>('')
  const [newWeight, setNewWeight] = useState('')

  // 1. DATA PARA MAPA DE CALOR (Últimos 7 días)
  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {}
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    sessions.forEach(session => {
      if (new Date(session.start_time) < sevenDaysAgo) return
      session.workout_sets?.forEach(set => {
        if (set.set_type === 'warm_up') return
        const exName = exercises.find(e => e.id === set.exercise_id)?.muscle_group || 'Otro'
        if (exName !== 'Otro') {
          data[exName] = (data[exName] || 0) + 1
        }
      })
    })
    return data
  }, [sessions, exercises])

  // 2. DATA PARA EL GRÁFICO DE VOLUMEN (Tonelaje por sesión)
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

  // 3. DATA PARA 1RM Y FUERZA RELATIVA (1RM / Peso Corporal)
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

      if (max1RM === 0) return null;

      // Buscar el peso corporal más cercano HASTA la fecha de la sesión
      const sessionDate = new Date(session.start_time).getTime()
      let currentBodyWeight = null
      for (const bio of biometrics) {
        if (new Date(bio.date).getTime() <= sessionDate) {
          currentBodyWeight = bio.weight
        }
      }

      return {
        date: new Date(session.start_time).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }),
        '1RM (kg)': Math.round(max1RM * 10) / 10,
        'Fuerza Relativa (x)': currentBodyWeight ? Math.round((max1RM / currentBodyWeight) * 100) / 100 : null
      }
    }).filter(Boolean)
  }, [sessions, selectedExId, equivalencies, biometrics])

  // 4. DETECTOR DE ESTANCAMIENTO
  const stagnationAlerts = useMemo(() => {
    const alerts: { exerciseId: string, name: string }[] = []
    const exHistory = new Map<string, number[]>()
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

    exHistory.forEach((history, exId) => {
      if (history.length >= 3) {
        const last3 = history.slice(-3)
        const max = Math.max(...last3)
        const min = Math.min(...last3)
        if (max > 0 && ((max - min) / max) <= 0.03) {
          const name = exercises.find(e => e.id === exId)?.name || 'Ejercicio'
          alerts.push({ exerciseId: exId, name })
        }
      }
    })
    return alerts
  }, [sessions, exercises, equivalencies])

  if (!selectedExId && exercises.length > 0 && e1rmData.length === 0) {
    const firstExDone = sessions.find(s => s.workout_sets && s.workout_sets.length > 0)?.workout_sets?.[0]
    if (firstExDone) setSelectedExId(firstExDone.exercise_id)
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-xl shadow-xl">
          <p className="text-zinc-400 text-xs mb-1 font-bold">{label}</p>
          {payload.map((entry: any, i: number) => (
            <p key={i} style={{ color: entry.color }} className="font-bold text-sm">
              {entry.name}: {entry.value} {entry.name.includes('Relativa') ? 'veces tu peso' : 'kg'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const handleAddWeight = () => {
    if (newWeight && parseFloat(newWeight) > 0) {
      addBiometric(parseFloat(newWeight))
      setNewWeight('')
    }
  }

  if (loadingSessions || loadingEx) return <div className="p-6 text-zinc-500 min-h-screen text-center mt-10">Procesando datos...</div>

  return (
    <div className="p-4 pb-24 min-h-screen text-zinc-100 relative max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <TrendingUp className="text-emerald-500" size={32} /> Laboratorio
        </h1>
      </div>

      {/* MAPA DE CALOR MUSCULAR */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2 mb-2">
          <Activity size={16} /> Mapa de Recuperación
        </h2>
        <p className="text-xs text-zinc-400 mb-6">Músculos estimulados en los últimos 7 días. El rojo indica un volumen extremadamente alto.</p>
        <MuscleHeatmap muscleData={heatmapData} />
      </div>

      {/* BIOMETRÍA Y PESO CORPORAL */}
      <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
        <h2 className="text-sm font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2 mb-2">
          <Scale size={16} /> Registro de Peso Corporal
        </h2>
        <p className="text-xs text-zinc-400 mb-6">Registra tu peso para cruzarlo con tu fuerza y descubrir tu Fuerza Relativa real.</p>
        
        <div className="flex gap-2 mb-6">
          <input 
            type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
            placeholder="Ej: 75.5" 
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm outline-none focus:border-blue-500"
          />
          <button onClick={handleAddWeight} className="bg-blue-500 text-zinc-950 font-bold px-6 rounded-xl active:scale-95 transition-transform">
            Guardar
          </button>
        </div>

        {biometrics.length > 0 ? (
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-2">
            {[...biometrics].reverse().map(bio => (
              <div key={bio.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-sm">
                <span className="text-zinc-400 font-mono text-xs">{new Date(bio.date).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric'})}</span>
                <span className="font-bold text-blue-400">{bio.weight} kg</span>
                <button onClick={() => removeBiometric(bio.id)} className="text-red-500 p-1.5 bg-red-500/10 rounded-lg active:scale-95"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-zinc-600 text-xs italic py-4">Aún no has registrado tu peso corporal.</p>
        )}
      </div>

      {sessions.length < 3 ? (
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center">
          <Info className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-50" />
          <p className="text-zinc-400">Necesitas al menos 3 entrenamientos para generar las métricas predictivas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            {stagnationAlerts.length > 0 ? (
              <div className="bg-yellow-500/10 border border-yellow-500/30 p-5 rounded-2xl">
                <h2 className="text-sm font-bold text-yellow-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} /> Alerta de Estancamiento
                </h2>
                <p className="text-sm text-zinc-300 mb-3 leading-relaxed">
                  Tu fuerza en estos ejercicios no ha variado en las últimas 3 sesiones. Considera cambiar repeticiones o probar alternativas:
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
                  <p className="text-xs text-emerald-400/80">Vienes aplicando sobrecarga progresiva excelente.</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-sm font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                  <Dumbbell size={16} /> Evolución (1RM y Relativa)
                </h2>
                <p className="text-xs text-zinc-500 mt-1">Tu fuerza cruzada con tu peso corporal (si está registrado).</p>
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
                    <YAxis yAxisId="left" stroke="#10b981" fontSize={10} tickFormatter={(val) => `${val}kg`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={10} tickFormatter={(val) => `${val}x`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line yAxisId="left" type="monotone" dataKey="1RM (kg)" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#09090b' }} activeDot={{ r: 6 }} />
                    {biometrics.length > 0 && <Line yAxisId="right" type="monotone" dataKey="Fuerza Relativa (x)" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#09090b' }} />}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm border border-zinc-800 border-dashed rounded-xl">
                  No hay suficientes datos para este ejercicio.
                </div>
              )}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            <div className="mb-6">
              <h2 className="text-sm font-bold text-blue-500 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={16} /> Tonelaje (Sobrecarga)
              </h2>
              <p className="text-xs text-zinc-500 mt-1">La suma de todos los kilos levantados por sesión.</p>
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