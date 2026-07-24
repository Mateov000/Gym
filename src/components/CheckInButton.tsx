import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsRight } from 'lucide-react'

export default function CheckInButton({ 
  isCompleted, 
  onClick 
}: { 
  isCompleted: boolean
  onClick: () => void 
}) {
  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  // Escuchar cuando el componente padre resetea el botón para la siguiente serie
  useEffect(() => {
    if (!isCompleted) {
      setDragX(0)
    }
  }, [isCompleted])

  // Lógica de movimiento
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || isCompleted || !trackRef.current || !thumbRef.current) return

    const trackRect = trackRef.current.getBoundingClientRect()
    const thumbRect = thumbRef.current.getBoundingClientRect()
    
    // Restamos el ancho del botón móvil para que choque con el borde derecho y no se salga
    const maxDrag = trackRect.width - thumbRect.width - 8 // 8px de margen
    
    // Calculamos la nueva posición siguiendo el dedo/mouse
    let newX = e.clientX - trackRect.left - (thumbRect.width / 2)
    
    // Aplicamos límites físicos para que no salga del carril
    newX = Math.max(0, newX)
    newX = Math.min(newX, maxDrag)
    
    setDragX(newX)
  }

  // Lógica al soltar el botón
  const handlePointerUp = () => {
    if (!isDragging || isCompleted) return
    setIsDragging(false)

    if (!trackRef.current || !thumbRef.current) return
    const maxDrag = trackRef.current.getBoundingClientRect().width - thumbRef.current.getBoundingClientRect().width - 8

    // Umbral del 70%: Si pasa de aquí, completamos la serie
    if (dragX > maxDrag * 0.70) {
      setDragX(maxDrag) // Lo pegamos al final derecho
      onClick() // Disparamos el guardado
    } else {
      // Si no cruzó la meta, el "resorte" lo devuelve a cero
      setDragX(0)
    }
  }

  // --- ESTADO 2: SERIE COMPLETADA ---
  if (isCompleted) {
    return (
      <div className="w-full bg-emerald-500 text-zinc-950 font-bold p-4 h-16 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all duration-300 animate-in zoom-in-95">
        <Check size={28} />
        <span className="text-lg">¡Completada!</span>
      </div>
    )
  }

  // --- ESTADO 1: LISTO PARA DESLIZAR ---
  return (
    <div 
      ref={trackRef}
      // touch-none evita que el navegador haga scroll en la página mientras deslizas
      className="relative w-full h-16 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex items-center justify-center select-none touch-none shadow-inner"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp} // Por si el dedo se sale del área
    >
      {/* Texto de fondo */}
      <span className="text-zinc-500 font-medium z-0 pl-10 tracking-wide text-sm">
        Desliza para completar
      </span>

      {/* Rastro de color semitransparente que sigue al botón */}
      <div 
        className="absolute left-0 top-0 bottom-0 bg-emerald-500/10 z-0"
        style={{ 
          width: `${dragX + 32}px`, 
          transition: isDragging ? 'none' : 'width 0.3s ease-out' 
        }}
      />

      {/* El control deslizante (Thumb) */}
      <div 
        ref={thumbRef}
        onPointerDown={() => setIsDragging(true)}
        style={{ 
          transform: `translateX(${dragX}px)`, 
          // Si está arrastrando desactivamos la transición para que se sienta instantáneo. 
          // Si soltó, activamos la transición para el efecto resorte.
          transition: isDragging ? 'none' : 'transform 0.3s ease-out' 
        }}
        className="absolute left-1 w-14 h-14 bg-emerald-500 hover:bg-emerald-400 rounded-xl flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-colors"
      >
        <ChevronsRight className="text-zinc-950 w-8 h-8" />
      </div>
    </div>
  )
}