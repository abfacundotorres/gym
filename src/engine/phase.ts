import { weekStart, type ISODate } from './dates'
import type { Mesocycle, Phase } from './types'

/**
 * Fases (D-69). La app no sabe si estás en déficit o superávit: la fase la declarás vos y solo cambia cómo se INTERPRETA
 * el progreso y qué se sugiere. No toca cargas ni series. Los números son heurísticas generales, no una prescripción.
 */
export const PHASES: Phase[] = ['bulk', 'cut', 'maintain']
export const PHASE_LABEL: Record<Phase, string> = { bulk: 'Bulk', cut: 'Cut', maintain: 'Mantenimiento' }
export const PHASE_HINT: Record<Phase, string> = {
  bulk: 'Se espera progresar. El motor se comporta como siempre.',
  cut: 'Mantener el rendimiento ya cuenta como progreso: estancarte o bajar un poco el e1RM no dispara alarmas, y el volumen objetivo baja a 80 %.',
  maintain: 'El motor se comporta como siempre.',
}

/** En cut, una baja de e1RM de hasta este % (en las últimas 3 exposiciones) se toma como ruido normal del déficit. */
export const CUT_REGRESSION_TOLERANCE = 0.05
/** En cut, el volumen objetivo semanal por músculo es este factor de los rangos de Ajustes. */
export const CUT_VOLUME_FACTOR = 0.8

/** Rango de series semanales por músculo para la fase (en medias series). Sin fase, bulk y mantenimiento: el de Ajustes. */
export function phaseVolumeTarget([lo, hi]: [number, number], phase: Phase | undefined): [number, number] {
  if (phase !== 'cut') return [lo, hi]
  const f = (v: number) => Math.round(v * CUT_VOLUME_FACTOR * 2) / 2
  return [f(lo), f(hi)]
}

/** Largo de bloque que se sugiere al elegir la fase (se aplica solo si lo aceptás). Heurística: en déficit se acumula más fatiga. */
export function phaseBlockSuggestion(phase: Phase): { accumulationWeeks: number; deloadWeeks: number } {
  return phase === 'cut' ? { accumulationWeeks: 4, deloadWeeks: 1 } : { accumulationWeeks: 5, deloadWeeks: 1 }
}

/** Fase de la semana que empieza `monday`: la del último mesociclo que ya había arrancado. */
export function phaseAt(mesocycles: Pick<Mesocycle, 'startDate' | 'phase'>[], monday: ISODate): Phase | undefined {
  const started = mesocycles.filter((m) => weekStart(m.startDate) <= monday).sort((a, b) => (a.startDate < b.startDate ? -1 : 1))
  return started.at(-1)?.phase
}
