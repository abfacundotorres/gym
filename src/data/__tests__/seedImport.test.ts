import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import fixture from '../__fixtures__/seed.fixture.json'
import { parseImportText } from '../backup'
import { seedSchema } from '../schemas'
import { seedToData } from '../seedImport'

const NOW = 1_762_600_000_000
const data = seedToData(seedSchema.parse(fixture), NOW)
const session = (date: string) => data.sessions.find((s) => s.date === date)!
const item = (date: string, ex: string) => session(date).items.find((i) => i.exerciseId === ex)!

describe('seedToData', () => {
  it('importa catálogo y plan completos', () => {
    expect(data.exercises).toHaveLength(22)
    expect(data.planDays.map((d) => [d.id, d.weekday])).toEqual([
      ['lunes_torso', 1], ['martes_pierna_a', 2], ['jueves_full_body', 4],
    ])
    expect(data.planDays[0]!.items[1]).toEqual({ exerciseId: 'row_chest_supported_45', sets: 3, alt: ['row_low_cable'] })
    expect(data.planDays[1]!.items.at(-1)).toMatchObject({ exerciseId: 'stair_climber', optional: true })
  })

  it('aplica las correcciones confirmadas (D-09)', () => {
    const rear = data.exercises.find((e) => e.id === 'rear_delt_machine')!
    expect(rear.unit).toBe('per_hand')
    expect(rear.name).toBe('Deltoide posterior (mancuernas)')
    expect(rear.note).toBeUndefined()
    const ohp = data.exercises.find((e) => e.id === 'ohp_machine')!
    expect(ohp.unit).toBe('per_side')
    expect(ohp.note).toBeUndefined()
  })

  it('convierte tuplas en series con marca y reps antes de la pausa', () => {
    const rdl = item('2026-10-22', 'rdl_barbell')
    expect(rdl.sets[2]).toEqual({ id: 'seed-2026-10-22-0-2', type: 'W', weight: 30, reps: 10, flag: 'rp', repsBeforePause: 8, doneAt: null })
    expect(item('2026-11-02', 'bench_flat_barbell').confidence).toBe('baja')
  })

  it('mantiene reps null tal cual (no se inventan)', () => {
    const lat = item('2026-11-05', 'lateral_raise_db')
    expect(lat.sets.every((s) => s.reps === null)).toBe(true)
  })

  it('cardio en minutos (D-10) y medio ladrillo marcado como dudoso', () => {
    expect(item('2026-10-20', 'stair_climber').sets).toEqual([
      { id: 'seed-2026-10-20-5-0', type: 'W', weight: null, reps: null, minutes: 33, doneAt: null },
    ])
    expect(item('2026-11-03', 'leg_extension').sets[0]!.note).toMatch(/medios ladrillos/)
  })

  it('sesiones con id determinístico, mesociclo y exerciseIds', () => {
    const s = session('2026-11-05')
    expect(s.id).toBe('seed-2026-11-05')
    expect(s.mesocycleId).toBe('meso-2026-10-19')
    expect(s.exerciseIds).toContain('walking_lunge_db')
    expect(data.dataQuality?.notes.length).toBeGreaterThan(0)
  })

  it('rechaza referencias a ejercicios inexistentes', () => {
    const bad = structuredClone(fixture) as typeof fixture
    bad.sessions[0]!.items[0]!.ex = 'no_existe'
    const r = parseImportText(JSON.stringify(bad), NOW)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/no_existe/)
  })
})

// Solo local: valida el seed real si está en la raíz (no se commitea, D-06).
const real = new URL('../../../seed.json', import.meta.url)
describe.runIf(existsSync(real))('seed.json real', () => {
  it('parsea completo: 9 sesiones', () => {
    const r = parseImportText(readFileSync(real, 'utf8'), NOW)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.sessions).toHaveLength(9)
  })
})

describe('notas de calidad', () => {
  it('marca como resueltas las dudas ya aclaradas', () => {
    expect(data.dataQuality!.notes.some((n) => n.includes('Resuelto 08/11'))).toBe(true)
  })
})
