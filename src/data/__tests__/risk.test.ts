import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createDB, type GymDB } from '../db'
import { dismissRisk, riskKey } from '../riskRepo'

let db: GymDB
let n = 0
afterEach(() => db?.delete())

describe('descartar un aviso de patrón (D-75)', () => {
  it('queda guardado por aviso, es idempotente y no afecta a otros', async () => {
    db = createDB(`risk-${n++}`)
    expect(await db.meta.get(riskKey('fail-session:s1'))).toBeUndefined()
    await dismissRisk(db, 'fail-session:s1')
    await dismissRisk(db, 'fail-session:s1')
    expect((await db.meta.get('risk:fail-session:s1'))!.value).toBe(true)
    expect(await db.meta.get(riskKey('fail-session:s2'))).toBeUndefined()
    expect(await db.meta.where('key').startsWith('risk:').count()).toBe(1)
  })
})
