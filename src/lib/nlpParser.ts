export interface ParsedLine {
  originalText: string;
  exerciseName: string;
  targetSets: number;
  targetReps: number | null;
}

export function parseRoutineText(text: string): ParsedLine[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: ParsedLine[] = [];
  
  // Soporta formatos como: "Sentadilla 4x8", "Press Militar 3 x 10", "Dominadas 4XMax"
  const regex = /^(.+?)\s+(\d+)\s*[xX]\s*([\d\w\-]+)$/i;

  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const [, name, sets, repsStr] = match;
      const targetReps = parseInt(repsStr, 10);
      
      results.push({
        originalText: line,
        exerciseName: name.trim(),
        targetSets: parseInt(sets, 10),
        // Si escribe "Max" o "Fallo", parseInt devolverá NaN, así que lo guardamos como null
        targetReps: isNaN(targetReps) ? null : targetReps 
      });
    } else {
      // Si el usuario escribe algo raro, lo capturamos como 1 serie para no romper la app
      results.push({
        originalText: line,
        exerciseName: line,
        targetSets: 1,
        targetReps: null
      });
    }
  }
  return results;
}