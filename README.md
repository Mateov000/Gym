# Gym PWA

Aplicación mobile-first para seguimiento de entrenamientos, enfocada en fricción cero en gimnasio.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS
- Supabase (Auth + PostgreSQL)
- Zustand (estado de sesión activa con persistencia local)
- TanStack Query (lecturas/mutaciones contra Supabase)
- Vite PWA (instalable y cacheable)

## Funcionalidad actual

- Registro/Login con Supabase Auth.
- Catálogo de ejercicios.
- Inicio y continuidad de sesión activa (persistida localmente).
- Registro de series con stepper y check-in.
- Temporizador de descanso y calculadora de discos.
- Historial básico de sesiones guardadas en Supabase.
- Quick Swap básico:
  - Prioriza alternativas explícitas si el ejercicio las incluye.
  - Fallback por mismo grupo muscular.
- Smart defaults por ejercicio usando historial reciente.
- Sprint 5 (base operativa):
  - Jerarquía de rutinas: Rutina -> Días -> Ejercicios.
  - Selector de día de rutina desde la pantalla `Rutinas`.
  - Metadatos de superseries y drop-sets en el tracking de sets.
  - Lógica de PR global con modos por ejercicio (`global`, `fixed`, `opt_out`).
  - Resolución de configuración en cascada `Ejercicio -> Rutina -> Global` para defaults de entrenamiento.

## Scripts

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```

## Variables de entorno

Crear `.env.local` en raíz:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Estructura clave

- `/home/runner/work/Gym/Gym/src/lib/supabase.ts`: cliente Supabase
- `/home/runner/work/Gym/Gym/src/lib/queries.ts`: capa de acceso de datos
- `/home/runner/work/Gym/Gym/src/store/useWorkoutStore.ts`: estado local persistente
- `/home/runner/work/Gym/Gym/src/pages/Workout.tsx`: motor de entrenamiento
