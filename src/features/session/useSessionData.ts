import { useLiveQuery } from 'dexie-react-hooks'
import { getDB } from '../../data/db'

export function useSessionData(sessionId: string | undefined) {
  return useLiveQuery(async () => {
    if (!sessionId) return null
    const db = getDB()
    const session = await db.sessions.get(sessionId)
    if (!session) return null
    const plan = await db.planDays.get(session.planDayId)
    return { session, plan }
  }, [sessionId])
}
