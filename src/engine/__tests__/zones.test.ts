import { describe, expect, it } from 'vitest'
import fixture from '../../data/__fixtures__/seed.fixture.json'
import { seedSchema } from '../../data/schemas'
import { seedToData } from '../../data/seedImport'
import { ZONES, type Exercise, type PlanAdjustment, type PlanDay, type ZoneIssue } from '../types'
import { activeZones, applyAdjustments, effectiveAdjustments, exerciseZones, lighterVariants, loadingItems, revertAdjustments, zoneLoad, zoneProposals } from '../zones'

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

describe('propuestas al plan por una zona (D-77)', () => {
  const plan = (): PlanDay[] => [
    { id: 'a', name: 'A', weekday: 1, items: [
      { exerciseId: 'lateral_raise_db', sets: 4, alt: [] }, // cuello: mucho, sin variante más liviana
      { exerciseId: 'pulldown_supine_close', sets: 3, alt: ['pulldown_neutral'] }, // cuello: algo
      { exerciseId: 'curl_incline_db', sets: 3, alt: [] }, // no carga el cuello
      { exerciseId: 'rear_delt_machine', sets: 2, alt: [] }, // mucho, pero ya está en 2 series
    ] },
    { id: 'b', name: 'B', weekday: 3, items: [{ exerciseId: 'lateral_raise_db', sets: 3, alt: [] }] },
  ]
  const exMap = (over: Record<string, Partial<Exercise>> = {}) => new Map([...ex].map(([id, e]) => [id, { ...e, ...(over[id] ?? {}) }]))
  const neck = [{ zone: 'neck' as const, severity: 'molestia' as const, since: '2026-11-20' }]
  const liviano = { pulldown_neutral: { zones: ['shoulder' as const] } } // corregido a mano: no carga el cuello

  it('variante que la carga menos si hay; si no, una serie menos donde la carga mucho; por día del plan', () => {
    const r = zoneProposals(plan(), exMap(liviano), neck)
    expect(r.map((p) => p.adjustment)).toEqual([
      { kind: 'sets', planDayId: 'a', exerciseId: 'lateral_raise_db', from: 4, to: 3 },
      { kind: 'swap', planDayId: 'a', from: 'pulldown_supine_close', to: 'pulldown_neutral' },
      { kind: 'sets', planDayId: 'b', exerciseId: 'lateral_raise_db', from: 3, to: 2 },
    ])
    expect(r.map((p) => [p.zone, p.exerciseId, p.load])).toEqual([['neck', 'lateral_raise_db', 'high'], ['neck', 'pulldown_supine_close', 'medium'], ['neck', 'lateral_raise_db', 'high']])
  })
  it('donde la carga solo algo y no hay variante más liviana, no propone (alcanza con el aviso); tampoco por debajo de 2 series', () => {
    const r = zoneProposals(plan(), exMap(), neck) // sin corregir, los jalones cargan lo mismo
    expect(r.some((p) => p.exerciseId === 'pulldown_supine_close')).toBe(false)
    expect(r.some((p) => p.exerciseId === 'rear_delt_machine')).toBe(false) // 2 series: no baja más
    expect(r.some((p) => p.exerciseId === 'curl_incline_db')).toBe(false) // no carga la zona
  })
  it('la variante puede ser cualquiera de la familia, no solo las opciones del plan, y sin archivadas', () => {
    const p = plan()
    p[0]!.items[1] = { exerciseId: 'pulldown_supine_close', sets: 3, alt: [] }
    expect(zoneProposals(p, exMap(liviano), neck).find((x) => x.exerciseId === 'pulldown_supine_close')!.adjustment).toEqual({ kind: 'swap', planDayId: 'a', from: 'pulldown_supine_close', to: 'pulldown_neutral' })
    expect(zoneProposals(p, exMap({ pulldown_neutral: { zones: ['shoulder'], archived: true } }), neck).some((x) => x.exerciseId === 'pulldown_supine_close')).toBe(false)
  })
  it('un ejercicio, una propuesta por día: la de la zona más urgente (dolor primero)', () => {
    const issues = [{ zone: 'neck' as const, severity: 'molestia' as const, startedOn: '2026-11-20' }, { zone: 'shoulder' as const, severity: 'dolor' as const, startedOn: '2026-11-22' }]
    const r = zoneProposals(plan(), exMap(), activeZones(issues))
    const lat = r.filter((p) => p.exerciseId === 'lateral_raise_db')
    expect(lat.map((p) => p.zone)).toEqual(['shoulder', 'shoulder']) // el deltoide lateral carga las dos; gana el dolor
  })
  it('no repite "una serie menos" donde ya se aplicó, y sin zonas activas no hay nada', () => {
    const aplicado: PlanAdjustment[] = [{ kind: 'sets', planDayId: 'a', exerciseId: 'lateral_raise_db', from: 4, to: 3 }]
    const p = applyAdjustments(plan(), aplicado)
    const r = zoneProposals(p, exMap(), neck, aplicado)
    expect(r.filter((x) => x.adjustment.kind === 'sets' && x.adjustment.planDayId === 'a' && x.exerciseId === 'lateral_raise_db')).toEqual([])
    expect(r.some((x) => x.adjustment.kind === 'sets' && x.adjustment.planDayId === 'b')).toBe(true) // el otro día sí
    expect(zoneProposals(plan(), exMap(), [])).toEqual([])
  })
})

describe('aplicar y deshacer cambios del plan', () => {
  const plan = (): PlanDay[] => [
    { id: 'a', name: 'A', weekday: 1, items: [
      { exerciseId: 'lateral_raise_db', sets: 4, alt: [] },
      { exerciseId: 'pulldown_supine_close', sets: 3, alt: ['pulldown_neutral'], optional: true },
    ] },
    { id: 'b', name: 'B', weekday: 3, items: [{ exerciseId: 'lateral_raise_db', sets: 3, alt: [] }] },
  ]
  const sets: PlanAdjustment = { kind: 'sets', planDayId: 'a', exerciseId: 'lateral_raise_db', from: 4, to: 3 }
  const swap: PlanAdjustment = { kind: 'swap', planDayId: 'a', from: 'pulldown_supine_close', to: 'pulldown_neutral' }

  it('cambiar la variante titular manda la anterior a las alternativas y no toca el resto; el plan original no se modifica', () => {
    const orig = plan()
    const r = applyAdjustments(orig, [swap])
    expect(r[0]!.items[1]).toEqual({ exerciseId: 'pulldown_neutral', sets: 3, alt: ['pulldown_supine_close'], optional: true })
    expect(r[0]!.items[0]).toEqual(orig[0]!.items[0])
    expect(r[1]).toBe(orig[1]) // el otro día, el mismo objeto
    expect(orig).toEqual(plan())
  })
  it('aplicar y deshacer vuelve exactamente al plan de antes, en cualquier combinación', () => {
    const todo = applyAdjustments(plan(), [sets, swap])
    expect(todo[0]!.items[0]!.sets).toBe(3)
    expect(revertAdjustments(todo, [sets, swap])).toEqual(plan())
  })
  it('deshacer respeta lo que se cambió después: series editadas o una variante que ya no es la titular no se tocan', () => {
    const todo = applyAdjustments(plan(), [sets, swap])
    const editado = JSON.parse(JSON.stringify(todo)) as PlanDay[]
    editado[0]!.items[0]!.sets = 5 // vos lo subiste a 5
    editado[0]!.items[1] = { ...editado[0]!.items[1]!, exerciseId: 'pulldown_pronated_wide' } // y cambiaste el titular por otro
    const r = revertAdjustments(editado, [sets, swap])
    expect(r[0]!.items[0]!.sets).toBe(5)
    expect(r[0]!.items[1]!.exerciseId).toBe('pulldown_pronated_wide')
    // si sacaste la variante original de las alternativas, tampoco se vuelve a ella
    const sinAlt = JSON.parse(JSON.stringify(todo)) as PlanDay[]
    sinAlt[0]!.items[1]!.alt = []
    expect(revertAdjustments(sinAlt, [swap])[0]!.items[1]!.exerciseId).toBe('pulldown_neutral')
  })
  it('cambios encadenados sobre el mismo ejercicio se deshacen del último al primero', () => {
    const dos: PlanAdjustment[] = [sets, { kind: 'sets', planDayId: 'a', exerciseId: 'lateral_raise_db', from: 3, to: 2 }]
    const hecho = applyAdjustments(plan(), dos)
    expect(hecho[0]!.items[0]!.sets).toBe(2)
    expect(revertAdjustments(hecho, dos)).toEqual(plan()) // 2 → 3 → 4
    // y con variantes: A → B y después B → C vuelven a A pasando por B
    const cadena: PlanAdjustment[] = [swap, { kind: 'swap', planDayId: 'a', from: 'pulldown_neutral', to: 'pulldown_pronated_wide' }]
    const p = plan()
    p[0]!.items[1]!.alt = ['pulldown_neutral', 'pulldown_pronated_wide']
    const hecha = applyAdjustments(p, cadena)
    expect(hecha[0]!.items[1]!.exerciseId).toBe('pulldown_pronated_wide')
    expect(revertAdjustments(hecha, cadena)[0]!.items[1]!.exerciseId).toBe('pulldown_supine_close')
  })

  it('un cambio sobre algo que ya cambió no hace nada y no cuenta como efectivo', () => {
    const viejo: PlanAdjustment = { kind: 'sets', planDayId: 'a', exerciseId: 'lateral_raise_db', from: 7, to: 6 }
    const otroDia: PlanAdjustment = { kind: 'sets', planDayId: 'no_existe', exerciseId: 'lateral_raise_db', from: 4, to: 3 }
    expect(applyAdjustments(plan(), [viejo, otroDia])).toEqual(plan())
    expect(effectiveAdjustments(plan(), [viejo, sets, otroDia, swap])).toEqual([sets, swap])
    // en orden: el segundo cambio de las mismas series ya no coincide después del primero
    expect(effectiveAdjustments(plan(), [sets, sets])).toEqual([sets])
  })
})
