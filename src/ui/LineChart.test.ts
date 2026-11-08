import { describe, expect, it } from 'vitest'
import { niceScale } from './LineChart'

describe('niceScale', () => {
  it('ticks redondos', () => {
    expect(niceScale(19, 26).ticks).toEqual([15, 20, 25, 30])
    expect(niceScale(30.8, 33.3)).toMatchObject({ lo: 30, hi: 34 })
    expect(niceScale(50, 50).ticks).toEqual([49, 50, 51])
  })
})
