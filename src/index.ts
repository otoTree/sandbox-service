import express from 'express'
import 'dotenv/config'
import { SandboxManager } from '@anthropic-ai/sandbox-runtime'
import { PORT, sandboxConfig } from './config.js'
import { executeHandler } from './routes/execute.js'
import { healthHandler } from './routes/health.js'
import { bearerAuth } from './middleware/auth.js'

// --- Initialize app ---
const app = express()
app.use(express.json({ limit: '256kb' }))
app.use(bearerAuth)

// --- Routes ---
app.post('/execute', executeHandler)
app.get('/health', healthHandler)

// Start server
app.listen(PORT, async () => {
  try {
    await SandboxManager.initialize(sandboxConfig)
  } catch {
    // ignore init failure here; route will reattempt
  }
  console.log(`python-sandbox-service listening on :${PORT}`)
})