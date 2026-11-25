import type { Exercise, Mesocycle, PlanDay, Session } from './types'

/**
 * Chequeo de integridad de los datos (D-84): referencias rotas y valores imposibles. Solo mira y cuenta: no arregla nada
 * (arreglar sin preguntar puede borrar algo que sí importaba). Puro: recibe los datos ya leídos.
 */
export type Severity = 'error' | 'aviso'

export interface Finding {
  code: string
  severity: Severity
  /** Qué pasa, en una línea. */
  message: string
  /** Hasta `MAX_DETAIL` casos concretos ("23/10 · id_del_ejercicio"). */
  detail: string[]
  /** Cuántos casos hay en total (puede ser más que los del detalle). */
  count: number
}

export const MAX_DETAIL = 8

export interface IntegrityInput {
  exercises: Pick<Exercise, 'id' | 'name' | 'archived'>[]
  planDays: PlanDay[]
  mesocycles: Pick<Mesocycle, 'id' | 'status' | 'nextPlan'>[]
  sessions: Pick<Session, 'id' | 'date' | 'planDayId' | 'mesocycleId' | 'status' | 'items' | 'exerciseIds'>[]
}

export function isValidISODate(d: unknown): boolean {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false
  const [y, m, day] = d.split('-').map(Number) as [number, number, number]
  const t = new Date(y, m - 1, day)
  return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === day
}

const ddmm = (d: string) => (isValidISODate(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : String(d))
const bad = (n: unknown) => typeof n === 'number' && (!Number.isFinite(n) || n < 0)

function finding(code: string, severity: Severity, message: string, cases: string[]): Finding[] {
  return cases.length ? [{ code, severity, message, detail: cases.slice(0, MAX_DETAIL), count: cases.length }] : []
}

export function checkIntegrity(d: IntegrityInput): Finding[] {
  const exIds = new Set(d.exercises.map((e) => e.id))
  const name = (id: string) => d.exercises.find((e) => e.id === id)?.name ?? id
  const planIds = new Set(d.planDays.map((p) => p.id))
  const mesoIds = new Set(d.mesocycles.map((m) => m.id))
  const sessions = [...d.sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  const missingInSessions: string[] = []
  const idsMismatch: string[] = []
  const badDate: string[] = []
  const noPlan: string[] = []
  const noMeso: string[] = []
  const badSets: string[] = []
  for (const s of sessions) {
    const label = `${ddmm(s.date)} · ${s.id}`
    if (!isValidISODate(s.date)) badDate.push(`${s.id} · "${s.date}"`)
    if (!planIds.has(s.planDayId)) noPlan.push(`${label} · ${s.planDayId}`)
    if (s.mesocycleId != null && !mesoIds.has(s.mesocycleId)) noMeso.push(`${label} · ${s.mesocycleId}`)
    const used = new Set<string>()
    for (const it of s.items) {
      used.add(it.exerciseId)
      for (const id of [it.exerciseId, ...(it.swappedFrom ? [it.swappedFrom] : [])]) if (!exIds.has(id)) missingInSessions.push(`${label} · ${id}`)
      for (const [i, set] of it.sets.entries()) {
        if (bad(set.weight) || bad(set.reps) || bad(set.minutes) || bad(set.rir)) badSets.push(`${label} · ${name(it.exerciseId)} · serie ${i + 1}`)
        else if (typeof set.reps === 'number' && !Number.isInteger(set.reps)) badSets.push(`${label} · ${name(it.exerciseId)} · serie ${i + 1} (reps no entera)`)
      }
    }
    const listed = new Set(s.exerciseIds)
    if (used.size !== listed.size || [...used].some((id) => !listed.has(id))) idsMismatch.push(label)
  }

  const inProgress = sessions.filter((s) => s.status === 'in_progress')
  const activeMesos = d.mesocycles.filter((m) => m.status === 'active')

  const planMissing: string[] = []
  const planDup: string[] = []
  const planArchived: string[] = []
  const checkPlan = (where: string, days: PlanDay[], out: { missing: string[]; dup: string[]; archived?: string[] }) => {
    for (const day of days) {
      const seen = new Set<string>()
      for (const it of day.items) {
        for (const id of [it.exerciseId, ...it.alt]) if (!exIds.has(id)) out.missing.push(`${where}${day.name} · ${id}`)
        if (out.archived && d.exercises.find((e) => e.id === it.exerciseId)?.archived) out.archived.push(`${where}${day.name} · ${name(it.exerciseId)}`)
        for (const id of [it.exerciseId, ...it.alt]) {
          if (seen.has(id)) out.dup.push(`${where}${day.name} · ${name(id)}`)
          seen.add(id)
        }
      }
    }
  }
  checkPlan('', d.planDays, { missing: planMissing, dup: planDup, archived: planArchived })
  const nextMissing: string[] = []
  const nextDup: string[] = []
  for (const m of d.mesocycles) if (m.nextPlan) checkPlan('bloque siguiente · ', m.nextPlan, { missing: nextMissing, dup: nextDup })

  return [
    ...finding('sesion-fecha', 'error', 'Sesiones con una fecha que no existe', badDate),
    ...finding('sesion-ejercicio', 'error', 'Sesiones con un ejercicio que ya no existe (el historial de ese ejercicio no se ve)', missingInSessions),
    ...finding('sesion-indice', 'error', 'Sesiones cuya lista de ejercicios no coincide con lo anotado (el historial por ejercicio puede no mostrarlas)', idsMismatch),
    ...finding('serie-valores', 'error', 'Series con valores imposibles (negativos, sin número o reps con decimales)', badSets),
    ...finding('mesociclo-activos', 'error', `Hay ${activeMesos.length} mesociclos activos (tiene que haber uno)`, activeMesos.length > 1 ? activeMesos.map((m) => m.id) : []),
    ...finding('plan-ejercicio', 'error', 'El plan tiene ejercicios que ya no existen', planMissing),
    ...finding('plan-repetido', 'error', 'El plan repite un ejercicio dentro de un mismo día (titular u opciones)', planDup),
    ...finding('sesion-abierta', 'aviso', `Hay ${inProgress.length} sesiones sin terminar (suele haber una a lo sumo)`, inProgress.length > 1 ? inProgress.map((s) => `${ddmm(s.date)} · ${s.id}`) : []),
    ...finding('sesion-plan', 'aviso', 'Sesiones de un día del plan que ya no existe', noPlan),
    ...finding('sesion-mesociclo', 'aviso', 'Sesiones de un mesociclo que ya no existe', noMeso),
    ...finding('plan-archivado', 'aviso', 'El plan usa un ejercicio archivado', planArchived),
    ...finding('siguiente-ejercicio', 'aviso', 'La plantilla del bloque siguiente tiene ejercicios que ya no existen (se descartan al empezar el bloque)', nextMissing),
    ...finding('siguiente-repetido', 'aviso', 'La plantilla del bloque siguiente repite un ejercicio dentro de un día', nextDup),
  ]
}
