import { type SandboxRuntimeConfig } from '@anthropic-ai/sandbox-runtime'

export const PORT = process.env.PORT ? Number(process.env.PORT) : 8080
export const AUTH_TOKEN = process.env.AUTH_TOKEN || 'dev'
//console.log("[AUTH_TOKEN] ",AUTH_TOKEN)

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