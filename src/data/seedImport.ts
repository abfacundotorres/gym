// Conversión pura de seed.json → datos de la app. Sin Dexie, testeable.
import type { Exercise, Mesocycle, PlanDay, Session, SessionItem, SetEntry } from '../engine/types'
import type { BackupData, Seed } from './schemas'

const PLAN_DAY_INFO: Record<string, { name: string; weekday: number }> = {
  lunes_torso: { name: 'Lunes: Torso', weekday: 1 },
  martes_pierna_a: { name: 'Martes: Pierna A', weekday: 2 },
  jueves_full_body: { name: 'Jueves: Full body', weekday: 4 },
}
const WEEKDAY_PREFIX: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
}

export const SEED_MESOCYCLE: Mesocycle = {
  id: 'meso-2026-10-19',
  startDate: '2026-10-19',
  accumulationWeeks: 5,
  deloadWeeks: 1,
  status: 'active',
  notes: 'Creado al importar el seed (D-08). Editá la fecha de inicio si no es correcta.',
}

/** Correcciones confirmadas por Facu el 08/11 (D-09). */
function correctExercise(ex: Exercise): Exercise {
  const out = { ...ex }
  if (out.id === 'ohp_machine') delete out.note
  if (out.id === 'rear_delt_machine') {
    out.unit = 'per_hand'
    out.name = 'Deltoide posterior (mancuernas)'
    delete out.note
  }
  if (out.unit === 'minutes') out.cardio = true
  return out
}

function planDayFor(key: string, items: Seed['planTemplate'][string]): PlanDay {
  const info = PLAN_DAY_INFO[key] ?? { name: key, weekday: WEEKDAY_PREFIX[key.split('_')[0] ?? ''] ?? 1 }
  return {
    id: key,
    name: info.name,
    weekday: info.weekday,
    items: items.map((it) => ({
      exerciseId: it.ex,
      sets: it.sets,
      alt: it.alt ?? [],
      ...(it.optional ? { optional: true } : {}),
    })),
  }
}

function convertSession(s: Seed['sessions'][number], exercises: Map<string, Exercise>): Session {
  const id = `seed-${s.date}`
  const items: SessionItem[] = s.items.map((it, i) => {
    const ex = exercises.get(it.ex)
    let sets: SetEntry[]
    if (it.minutes != null) {
      sets = [{ id: `${id}-${i}-0`, type: 'W', weight: null, reps: null, minutes: it.minutes, doneAt: null }]
    } else {
      sets = (it.sets ?? []).map(([type, weight, reps, flag, rbp], j) => {
        const set: SetEntry = { id: `${id}-${i}-${j}`, type, weight, reps, doneAt: null }
        if (flag) set.flag = flag
        if (rbp != null) set.repsBeforePause = rbp
        if (ex?.unit === 'bricks' && !Number.isInteger(weight)) {
          set.note = 'Dato dudoso: la máquina no tiene medios ladrillos.'
        }
        return set
      })
    }
    const item: SessionItem = { exerciseId: it.ex, sets }
    if (it.note) item.note = it.note
    if (it.confidence) item.confidence = it.confidence
    return item
  })
  return {
    id,
    date: s.date,
    planDayId: s.day,
    mesocycleId: s.date >= SEED_MESOCYCLE.startDate ? SEED_MESOCYCLE.id : null,
    note: s.note ?? '',
    startedAt: null,
    finishedAt: null,
    status: 'finished',
    source: 'seed',
    items,
    exerciseIds: [...new Set(items.map((x) => x.exerciseId))],
  }
}

/** Marca como resueltas las notas que Facu ya aclaró (D-09). */
function resolveNote(note: string): string {
  if (/por lado.*militar/i.test(note)) return `${note} → Resuelto 08/11: militar por lado; deltoide posterior con mancuernas, peso por mano.`
  if (/ladrillos/i.test(note)) return `${note} No existen medios ladrillos.`
  return note
}

export class SeedReferenceError extends Error {}

export function seedToData(seed: Seed, now: number): BackupData {
  const exercises = seed.exercises.map((e) => correctExercise({ ...e } as Exercise))
  const byId = new Map(exercises.map((e) => [e.id, e]))

  const missing = new Set<string>()
  for (const items of Object.values(seed.planTemplate))
    for (const it of items) for (const id of [it.ex, ...(it.alt ?? [])]) if (!byId.has(id)) missing.add(id)
  for (const s of seed.sessions) for (const it of s.items) if (!byId.has(it.ex)) missing.add(it.ex)
  if (missing.size) throw new SeedReferenceError(`Ejercicios sin definir en el catálogo: ${[...missing].join(', ')}`)

  return {
    exercises,
    planDays: Object.entries(seed.planTemplate).map(([k, v]) => planDayFor(k, v)),
    mesocycles: [SEED_MESOCYCLE],
    sessions: seed.sessions.map((s) => convertSession(s, byId)),
    dayMarks: [],
    settings: null,
    dataQuality: { source: seed.source, notes: seed.dataQualityNotes.map(resolveNote), importedAt: now },
  }
}
