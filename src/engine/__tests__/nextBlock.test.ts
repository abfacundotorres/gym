import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { planChanges, promoteVariant, resolveNextPlan, startDraft } from '../nextBlock'
import { applyProposals, reviewMesocycle } from '../periodization'
import { defaultSettings, type Exercise, type PlanDay, type Session, type SetEntry } from '../types'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e])) as Map<string, Exercise>
const meso = data.mesocycles[0]!

const plan = (): PlanDay[] => [
  { id: 'p', name: 'P', weekday: 1, items: [
    { exerciseId: 'row_low_cable', sets: 3, alt: ['row_chest_supported_45'] },
    { exerciseId: 'curl_cable_low', sets: 3, alt: [] },
    { exerciseId: 'incline_db_press', sets: 3, alt: [], optional: true },
  ] },
  { id: 'q', name: 'Q', weekday: 3, items: [{ exerciseId: 'curl_cable_low', sets: 3, alt: [] }] },
]
const usable = () => true

describe('plantilla del bloque siguiente (D-73)', () => {
  it('startDraft copia sin compartir referencias con el plan de hoy', () => {
    const cur = plan()
    const d = startDraft(cur)
    expect(d).toEqual(cur)
    d[0]!.items[0]!.sets = 6
    d[0]!.items[0]!.alt.push('x')
    expect(cur[0]!.items[0]).toEqual({ exerciseId: 'row_low_cable', sets: 3, alt: ['row_chest_supported_45'] })
  })

  it('promoteVariant: la elegida es titular y la anterior pasa a la cabeza de las alternativas', () => {
    const it = { exerciseId: 'a', sets: 3, alt: ['b', 'c'] }
    expect(promoteVariant(it, 'c')).toEqual({ exerciseId: 'c', sets: 3, alt: ['a', 'b'] })
    expect(promoteVariant(it, 'a')).toBe(it) // ya es la titular
  })

  describe('resolveNextPlan', () => {
    it('sin plantilla, el plan de hoy', () => {
      const cur = plan()
      expect(resolveNextPlan(cur, undefined, usable)).toBe(cur)
    })

    it('usa el día de la plantilla; un día que ella no trae queda como está y uno que ya no existe se ignora', () => {
      const cur = plan()
      const d = startDraft(cur)
      d[0]!.items[0]!.sets = 5
      const sinQ = d.filter((x) => x.id !== 'q')
      sinQ.push({ id: 'viejo', name: 'Viejo', weekday: 5, items: [{ exerciseId: 'curl_cable_low', sets: 2, alt: [] }] })
      const r = resolveNextPlan(cur, sinQ, usable)
      expect(r.map((x) => x.id)).toEqual(['p', 'q'])
      expect(r[0]!.items[0]!.sets).toBe(5)
      expect(r[1]).toBe(cur[1]) // el día que la plantilla no trae no se toca
    })

    it('descarta ejercicios que ya no existen o están archivados, y de las alternativas las inutilizables', () => {
      const d = startDraft(plan())
      const r = resolveNextPlan(plan(), d, (id) => id !== 'curl_cable_low' && id !== 'row_chest_supported_45')
      expect(r[0]!.items).toEqual([
        { exerciseId: 'row_low_cable', sets: 3, alt: [] },
        { exerciseId: 'incline_db_press', sets: 3, alt: [], optional: true },
      ])
      expect(r[1]!.items).toEqual([])
    })
  })

  describe('planChanges', () => {
    it('sin plantilla o igual al plan, nada', () => {
      expect(planChanges(plan(), undefined)).toEqual([])
      expect(planChanges(plan(), startDraft(plan()))).toEqual([])
    })

    it('series, variante titular y ejercicio que se saca, por ítem', () => {
      const d = startDraft(plan())
      d[0]!.items[0] = promoteVariant({ ...d[0]!.items[0]!, sets: 4 }, 'row_chest_supported_45')
      d[0]!.items.splice(1, 1) // se saca el curl del día p (sigue en q)
      expect(planChanges(plan(), d)).toEqual([
        { kind: 'variant', planDayId: 'p', exerciseId: 'row_low_cable', to: 'row_chest_supported_45' },
        { kind: 'sets', planDayId: 'p', exerciseId: 'row_low_cable', from: 3, to: 4 },
        { kind: 'removed', planDayId: 'p', exerciseId: 'curl_cable_low' },
      ])
    })

    it('el mismo ejercicio en otro día no se confunde con el que se sacó', () => {
      const d = startDraft(plan())
      d[1]!.items = [] // se saca el curl solo del día q
      const ch = planChanges(plan(), d)
      expect(ch).toEqual([{ kind: 'removed', planDayId: 'q', exerciseId: 'curl_cable_low' }])
    })

    it('un ejercicio que la plantilla trae y el plan de hoy ya no (se sacó después) figura como agregado (D-83)', () => {
      const current = plan()
      const d = startDraft(plan())
      current[0]!.items.splice(1, 1) // hoy se saca el curl del día p
      expect(planChanges(current, d)).toEqual([{ kind: 'added', planDayId: 'p', exerciseId: 'curl_cable_low' }])
    })
  })

  describe('la revisión propone encima de la plantilla', () => {
    const W = (weight: number, reps: number): SetEntry => ({ id: `s${weight}${reps}${Math.random()}`, type: 'W', weight, reps })
    const sessions: Session[] = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].map((date, i) => ({
      id: `x-${date}`, date, planDayId: 'p', mesocycleId: meso.id, note: '', startedAt: null, finishedAt: 1, status: 'finished', source: 'app',
      items: [
        { exerciseId: 'row_low_cable', sets: [W(50, 10), W(50, 10), W(50, 10)] },
        { exerciseId: 'curl_cable_low', sets: [W(40, 8 + i), W(40, 8 + i), W(40, 8 + i)] },
      ],
      exerciseIds: ['row_low_cable', 'curl_cable_low'],
    }))
    const settings = { ...defaultSettings(), kgPerBrick: 4.2 }
    const base = plan()

    it('sin plantilla es lo de siempre: rota el estancado y suma una serie al curl', () => {
      const r = reviewMesocycle(meso, sessions, ex, base, settings)
      expect(r.proposals).toContainEqual(expect.objectContaining({ kind: 'rotate', exerciseId: 'row_low_cable' }))
      expect(r.proposals).toContainEqual(expect.objectContaining({ kind: 'sets', exerciseId: 'curl_cable_low', from: 3, to: 4 }))
    })

    it('parte de las series de la plantilla (4 en el curl → propone 5) y no vuelve a rotar lo que ya rotaste', () => {
      const d = startDraft(base)
      for (const day of d) for (const i of day.items) if (i.exerciseId === 'curl_cable_low') i.sets = 4
      d[0]!.items[0] = promoteVariant(d[0]!.items[0]!, 'row_chest_supported_45')
      const r = reviewMesocycle(meso, sessions, ex, base, settings, [], d)
      expect(r.proposals).toContainEqual(expect.objectContaining({ kind: 'sets', exerciseId: 'curl_cable_low', from: 4, to: 5 }))
      expect(r.proposals.some((p) => p.kind === 'rotate' && p.exerciseId === 'row_low_cable' && !p.optional)).toBe(false)
      // y lo que se ve del bloque que termina sigue saliendo del plan de hoy
      expect(r.stalled).toEqual(['row_low_cable'])
    })

    it('al aplicar, la plantilla más lo aceptado: los cambios de la plantilla no se pierden', () => {
      const d = startDraft(base)
      d[0]!.items[1]!.sets = 6 // el curl del lunes, en la plantilla
      const r = reviewMesocycle(meso, sessions, ex, base, settings, [], d)
      const next = applyProposals(d, r.proposals.filter((p) => p.kind === 'rotate' && !p.optional))
      expect(next[0]!.items.find((i) => i.exerciseId === 'curl_cable_low')!.sets).toBe(6)
      expect(next[0]!.items[0]!.exerciseId).toBe('row_chest_supported_45') // lo aceptado (el estancado) se rotó
    })
  })
})
