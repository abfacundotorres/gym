import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { ZONES, type Exercise, type ZoneIssue } from '../types'
import { activeZones, exerciseZones, lighterVariants, loadingItems, zoneLoad } from '../zones'

const data = seedToData(seedSchema.parse(fixture), 0)
const ex = new Map(data.exercises.map((e) => [e.id, e])) as Map<string, Exercise>
const E = (id: string) => ex.get(id)!

describe('cuánto carga un ejercicio cada zona (D-76)', () => {
  it('mucho si la zona tiene un músculo primario suyo, algo si es secundario, nada si no', () => {
    expect(zoneLoad(E('bench_flat_barbell'), 'shoulder')).toBe('high') // pecho: primario
    expect(zoneLoad(E('bench_flat_barbell'), 'elbow')).toBe('medium') // tríceps: secundario
    expect(zoneLoad(E('bench_flat_barbell'), 'knee')).toBeNull()
    expect(zoneLoad(E('lateral_raise_db'), 'neck')).toBe('high') // deltoide lateral
    expect(zoneLoad(E('pulldown_supine_close'), 'neck')).toBe('medium') // espalda alta secundaria
    expect(zoneLoad(E('rdl_barbell'), 'lower_back')).toBe('medium')
    expect(zoneLoad(E('rdl_barbell'), 'hip')).toBe('medium')
    expect(zoneLoad(E('hack_squat'), 'knee')).toBe('high')
    expect(zoneLoad(E('calf_press'), 'ankle')).toBe('high')
  })
  it('un músculo primario gana sobre uno secundario de la misma zona', () => {
    // la fila baja: espalda alta primaria, deltoide posterior secundario; ambos en cuello → mucho
    expect(zoneLoad(E('row_low_cable'), 'neck')).toBe('high')
  })
  it('la muñeca no se deduce de nada, y el cardio tampoco', () => {
    expect(ZONES.filter((z) => z !== 'wrist').every((z) => data.exercises.some((e) => zoneLoad(e, z) != null))).toBe(true)
    expect(data.exercises.every((e) => zoneLoad(e, 'wrist') == null)).toBe(true)
    expect(ZONES.every((z) => zoneLoad(E('stair_climber'), z) == null)).toBe(true)
    // un cardio con músculos cargados tampoco se deduce
    expect(zoneLoad({ ...E('hack_squat'), cardio: true }, 'knee')).toBeNull()
  })
  it('si se corrigieron a mano, manda esa lista (mucho) y no los músculos', () => {
    const corregido = { ...E('rdl_barbell'), zones: ['neck' as const] }
    expect(zoneLoad(corregido, 'neck')).toBe('high')
    expect(zoneLoad(corregido, 'lower_back')).toBeNull() // los músculos ya no cuentan
    expect(exerciseZones(corregido)).toEqual(['neck'])
    expect(zoneLoad({ ...E('rdl_barbell'), zones: [] }, 'lower_back')).toBeNull() // "ninguna" es una respuesta válida
    expect(zoneLoad({ ...E('stair_climber'), zones: ['knee' as const] }, 'knee')).toBe('high') // incluso el cardio, si se asignó
  })
  it('exerciseZones: las deducidas, en el orden de ZONES', () => {
    expect(exerciseZones(E('incline_db_press'))).toEqual(['shoulder', 'elbow'])
  })
})

describe('zonas con molestia activa', () => {
  const issue = (zone: ZoneIssue['zone'], severity: ZoneIssue['severity'], startedOn: string, resolvedOn?: string): ZoneIssue => ({ id: `${zone}${startedOn}${severity}`, zone, severity, startedOn, ...(resolvedOn ? { resolvedOn } : {}) })
  it('agrupa por zona: la intensidad mayor y la fecha más vieja; las resueltas no cuentan', () => {
    const r = activeZones([issue('neck', 'molestia', '2026-11-20'), issue('neck', 'dolor', '2026-11-22'), issue('knee', 'molestia', '2026-11-10', '2026-11-12'), issue('hip', 'molestia', '2026-11-01')])
    expect(r).toEqual([
      { zone: 'neck', severity: 'dolor', since: '2026-11-20' },
      { zone: 'hip', severity: 'molestia', since: '2026-11-01' },
    ])
  })
  it('la fecha más vieja gana aunque venga después, y el dolor no se pierde por el orden', () => {
    const r = activeZones([issue('neck', 'dolor', '2026-11-22'), issue('neck', 'molestia', '2026-11-20')])
    expect(r).toEqual([{ zone: 'neck', severity: 'dolor', since: '2026-11-20' }])
  })
  it('orden: dolor primero y, a igual intensidad, la más vieja', () => {
    const r = activeZones([issue('knee', 'molestia', '2026-11-10'), issue('hip', 'molestia', '2026-11-01'), issue('neck', 'dolor', '2026-11-20')])
    expect(r.map((z) => z.zone)).toEqual(['neck', 'hip', 'knee'])
  })
  it('sin molestias o todas resueltas, nada', () => {
    expect(activeZones([])).toEqual([])
    expect(activeZones([issue('neck', 'molestia', '2026-11-20', '2026-11-24')])).toEqual([])
  })
})

describe('qué ejercicios de la sesión cargan la zona', () => {
  const item = (exerciseId: string, skipped = false) => ({ exerciseId, skipped })
  it('los que la cargan mucho primero, después los que la cargan algo, en el orden de la sesión', () => {
    const items = [item('rdl_barbell'), item('pulldown_supine_close'), item('lateral_raise_db'), item('curl_incline_db'), item('rear_delt_machine')]
    const r = loadingItems(items, ex, 'neck')
    expect(r.map((x) => [x.item.exerciseId, x.load])).toEqual([['lateral_raise_db', 'high'], ['rear_delt_machine', 'high'], ['pulldown_supine_close', 'medium']])
  })
  it('no cuenta los salteados ni los desconocidos', () => {
    expect(loadingItems([item('lateral_raise_db', true), item('no_existe')], ex, 'neck')).toEqual([])
  })
})

describe('variantes que cargan menos una zona', () => {
  const press = E('ohp_barbell')
  const maquina = { ...E('ohp_machine'), zones: ['shoulder' as const] } // corregida: no carga el cuello
  const neutro = E('pulldown_neutral')
  it('solo las de la misma familia que la cargan menos que la actual', () => {
    const family = [press, maquina, neutro]
    // el press de barra, corregido para cargar el cuello; la máquina no
    const barra = { ...press, zones: ['neck' as const, 'shoulder' as const] }
    expect(lighterVariants(barra, 'neck', [barra, maquina, neutro]).map((v) => v.exercise.id)).toEqual(['ohp_machine'])
    // sin corregir, las dos cargan lo mismo (deducido por músculos): no hay una más liviana
    expect(lighterVariants(press, 'neck', [press, E('ohp_machine')])).toEqual([])
    expect(lighterVariants(barra, 'knee', family)).toEqual([]) // ninguna carga más la rodilla
  })
  it('sin archivadas ni la actual; las del plan primero; mayor carga al final', () => {
    const base = { ...press, zones: ['neck' as const] }
    const a = { ...E('ohp_machine'), id: 'a', name: 'B ninguna', zones: [] as never[] }
    const b = { ...E('ohp_machine'), id: 'b', name: 'A ninguna', zones: [] as never[] }
    const c = { ...E('ohp_machine'), id: 'c', name: 'Archivada', zones: [] as never[], archived: true }
    const alguna = { ...E('ohp_machine'), id: 'd', name: 'Alguna', primary: [], secondary: ['upper_back' as const], zones: undefined }
    const family = [base, a, b, c, alguna]
    // sin plan: las que no la cargan primero (por nombre) y la de carga media al final; la archivada y la actual afuera
    expect(lighterVariants(base, 'neck', family).map((v) => v.exercise.id)).toEqual(['b', 'a', 'd'])
    // con las opciones del plan, esas primero
    expect(lighterVariants(base, 'neck', family, ['d']).map((v) => v.exercise.id)).toEqual(['d', 'b', 'a'])
  })
})
