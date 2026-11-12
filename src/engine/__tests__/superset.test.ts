import { describe, expect, it } from 'vitest'
import { groupError, groupItems, groupView, ungroupItems } from '../superset'
import type { PlanDay, Session, SessionItem, SetEntry } from '../types'

const W = (n: number): SetEntry[] => Array.from({ length: n }, (_, i) => ({ id: `s${i}`, type: 'W', weight: 10, reps: 10 }))
const item = (exerciseId: string, sets = 0, extra: Partial<SessionItem> = {}): SessionItem => ({ exerciseId, sets: W(sets), ...extra })
const ids = (items: SessionItem[]) => items.map((i) => i.exerciseId)

describe('armar una superserie', () => {
  const items = [item('a'), item('b'), item('c'), item('d'), item('e')]

  it('pide entre 2 y 3 ejercicios distintos', () => {
    expect(groupError(items, [1])).toMatch(/entre 2 y 3/)
    expect(groupError(items, [0, 1, 2, 3])).toMatch(/entre 2 y 3/)
    expect(groupError(items, [1, 1])).toMatch(/repetidos/)
    expect(groupError(items, [1, 9])).toMatch(/no existe/)
    expect(groupError(items, [1, 2])).toBeNull()
    expect(groupError(items, [0, 2, 4])).toBeNull()
  })
  it('no agrupa salteados ni ya agrupados', () => {
    expect(groupError([item('a', 0, { skipped: true }), item('b')], [0, 1])).toMatch(/salteado/)
    expect(groupError([item('a', 0, { group: 'g' }), item('b')], [0, 1])).toMatch(/ya está/)
  })
  it('deja el grupo contiguo, en su orden, en el lugar del primero', () => {
    expect(ids(groupItems(items, [1, 3, 4], 'g'))).toEqual(['a', 'b', 'd', 'e', 'c'])
    expect(ids(groupItems(items, [4, 1], 'g'))).toEqual(['a', 'b', 'e', 'c', 'd']) // el orden de la selección no importa
    expect(ids(groupItems(items, [0, 1], 'g'))).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
  it('marca solo a los del grupo y conserva sus series; no modifica el original', () => {
    const withSets = [item('a', 2), item('b'), item('c', 1)]
    const out = groupItems(withSets, [0, 2], 'g')
    expect(out.map((i) => i.group)).toEqual(['g', 'g', undefined])
    expect(out[0]!.sets).toHaveLength(2)
    expect(withSets.every((i) => i.group === undefined)).toBe(true)
  })
  it('rechaza una selección inválida', () => {
    expect(() => groupItems(items, [1], 'g')).toThrow(/entre 2 y 3/)
  })
  it('deshacer deja sueltos a los del grupo, con sus series, sin tocar a los demás', () => {
    const grouped = groupItems([item('a'), item('b', 2), item('c'), item('d', 0, { group: 'otro' })], [1, 2], 'g')
    const out = ungroupItems(grouped, 'g')
    expect(out.every((i) => i.group === undefined || i.group === 'otro')).toBe(true)
    expect(out.find((i) => i.exerciseId === 'b')!.sets).toHaveLength(2)
    expect(out.find((i) => i.exerciseId === 'd')!.group).toBe('otro')
    expect('group' in out[1]!).toBe(false)
  })
})

describe('estado de la superserie', () => {
  // El caso real: lateral 4 series, posterior 3 y curl 3.
  const plan: PlanDay = { id: 'p', name: 'Día', weekday: 4, items: [
    { exerciseId: 'a', sets: 3, alt: [] },
    { exerciseId: 'lat', sets: 4, alt: [] },
    { exerciseId: 'post', sets: 3, alt: [] },
    { exerciseId: 'curl', sets: 3, alt: [] },
  ] }
  const session = (items: SessionItem[], extra: Partial<Session> = {}): Session =>
    ({ id: 's', date: '2026-11-12', planDayId: 'p', mesocycleId: null, note: '', startedAt: 1, finishedAt: null, status: 'in_progress', source: 'app', exerciseIds: items.map((i) => i.exerciseId), items, ...extra }) as Session
  const g = (lat: number, post: number, curl: number) => [item('a'), item('lat', lat, { group: 'g' }), item('post', post, { group: 'g' }), item('curl', curl, { group: 'g' })]

  it('un ejercicio suelto no tiene superserie', () => {
    expect(groupView(session(g(0, 0, 0)), plan, 0)).toBeNull()
  })
  it('empieza en la ronda 1 de 4 con los tres pendientes', () => {
    const v = groupView(session(g(0, 0, 0)), plan, 2)!
    expect(v).toMatchObject({ group: 'g', indexes: [1, 2, 3], pending: [1, 2, 3], round: 1, rounds: 4, complete: false })
  })
  it('la ronda avanza con la menor cantidad de series hechas entre los pendientes', () => {
    expect(groupView(session(g(2, 2, 2)), plan, 1)!.round).toBe(3)
  })
  it('cada uno completa las suyas: la 4.ª ronda es solo del lateral', () => {
    const v = groupView(session(g(3, 3, 3)), plan, 1)!
    expect(v.pending).toEqual([1])
    expect(v.round).toBe(4)
    expect(v.complete).toBe(false)
  })
  it('está completa cuando todos hicieron sus series', () => {
    const v = groupView(session(g(4, 3, 3)), plan, 1)!
    expect(v.complete).toBe(true)
    expect(v.pending).toEqual([])
    expect(v.round).toBe(4)
  })
  it('una serie más hecha por uno no desordena: la ronda sigue al que va más atrás', () => {
    expect(groupView(session(g(2, 1, 2)), plan, 1)!.round).toBe(2)
  })
  it('en deload se usan las series reducidas', () => {
    const v = groupView(session(g(2, 2, 2), { deload: true }), plan, 1)!
    expect(v.rounds).toBeLessThan(4)
  })
})
