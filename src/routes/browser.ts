import { Request, Response } from 'express'
import { BrowserManager } from '../services/browser-manager.js'
import { createSessionSchema, navigateSchema, actionSchema } from '../types.js'

export const createSessionHandler = async (req: Request, res: Response) => {
  try {
    const body = createSessionSchema.parse(req.body)
    const sessionId = await BrowserManager.getInstance().createSession(body)
    res.json({ sessionId })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}

export const destroySessionHandler = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    await BrowserManager.getInstance().destroySession(id)
    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}

export const navigateHandler = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const body = navigateSchema.parse(req.body)
    const result = await BrowserManager.getInstance().navigate(id, body.url, body.waitUntil)
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}

export const actionHandler = async (req: Request, res: Response) => {
  const { id } = req.params
  try {
    const body = actionSchema.parse(req.body)
    const result = await BrowserManager.getInstance().performAction(id, body.action, body.selector, body.value, body.script, body.x, body.y)
    res.json(result)
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
