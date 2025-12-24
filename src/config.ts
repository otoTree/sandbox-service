import { type SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime'

export const PORT = process.env.PORT ? Number(process.env.PORT) : 8080
export const AUTH_TOKEN = process.env.AUTH_TOKEN || 'dev'
//console.log("[AUTH_TOKEN] ",AUTH_TOKEN)

// Browser Configuration
export const BROWSER_CONFIG = {
  maxSessions: process.env.MAX_BROWSER_SESSIONS ? Number(process.env.MAX_BROWSER_SESSIONS) : 10,
  sessionTimeout: process.env.BROWSER_SESSION_TIMEOUT ? Number(process.env.BROWSER_SESSION_TIMEOUT) : 600000, // 10 mins
  headless: process.env.BROWSER_HEADLESS !== 'false', // default true
  viewport: {
    width: process.env.BROWSER_VIEWPORT_WIDTH ? Number(process.env.BROWSER_VIEWPORT_WIDTH) : 1280,
    height: process.env.BROWSER_VIEWPORT_HEIGHT ? Number(process.env.BROWSER_VIEWPORT_HEIGHT) : 720,
  },
  device: process.env.BROWSER_DEVICE ? process.env.BROWSER_DEVICE as 'desktop' | 'mobile' : 'desktop'
}

// Minimal secure-by-default sandbox config
export const sandboxConfig: SandboxRuntimeConfig = {
  network: {
    allowedDomains: [],
    deniedDomains: [],
    allowLocalBinding: false,
  },
  filesystem: {
    denyRead: ['~/.ssh'],
    allowWrite: ['.', '/tmp'],
    denyWrite: ['.env', 'secrets/'],
  },
  // Enable weaker nested sandbox for unprivileged Docker-like environments
  enableWeakerNestedSandbox: true,
}