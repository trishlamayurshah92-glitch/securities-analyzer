import { createClient } from '@supabase/supabase-js'
import type { Request, Response, NextFunction } from 'express'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
)

export interface AuthRequest extends Request {
  userId: string
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ detail: 'Unauthorized' })
    return
  }
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ detail: 'Invalid or expired token' })
    console.log('[auth] token error', { error })
    return
  }
  ;(req as AuthRequest).userId = user.id
  next()
}
