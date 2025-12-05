import express from 'express'
import 'dotenv/config'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { PORT, sandboxConfig } from './config.js'
import { executeHandler } from './routes/execute.js'
import { healthHandler } from './routes/health.js'
import { createSessionHandler, destroySessionHandler, navigateHandler, actionHandler } from './routes/browser.js'
import { bearerAuth } from './middleware/auth.js'

// --- Initialize app ---
const app = express()
app.use(express.json({ limit: '256kb' }))
app.use(bearerAuth)

// --- Routes ---
app.post('/execute', executeHandler)
app.get('/health', healthHandler)

// Browser Routes
app.post('/browser/sessions', createSessionHandler)
app.delete('/browser/sessions/:id', destroySessionHandler)
app.post('/browser/sessions/:id/navigate', navigateHandler)
app.post('/browser/sessions/:id/action', actionHandler)

// Start server
app.listen(PORT, async () => {
  try {
    await SandboxManager.initialize(sandboxConfig)
  } catch {
    // ignore init failure here; route will reattempt
  }
  console.log(`python-sandbox-service listening on :${PORT}`)
})