import { chromium, Browser, BrowserContext, Page } from 'playwright'
import { FingerprintGenerator } from 'fingerprint-generator'
import { FingerprintInjector } from 'fingerprint-injector'
import { v4 as uuidv4 } from 'uuid'
import { createHttpProxyServer } from '@anthropic-ai/sandbox-runtime/dist/sandbox/http-proxy.js'
import { sandboxConfig, BROWSER_CONFIG } from '../config.js'

interface Session {
  id: string
  context: BrowserContext
  page: Page
  lastActive: number
  queue: Promise<any>
}

export class BrowserManager {
  private static instance: BrowserManager
  private browser: Browser | null = null
  private sessions: Map<string, Session> = new Map()
  private fingerprintGenerator = new FingerprintGenerator()
  private fingerprintInjector = new FingerprintInjector()
  private proxyServer: any = null
  private proxyPort: number = 0

  private constructor() {
    setInterval(() => this.cleanupStaleSessions(), 60 * 1000)
  }

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager()
    }
    return BrowserManager.instance
  }

  private async startProxy() {
    if (this.proxyServer) return;
    
    this.proxyServer = createHttpProxyServer({
        filter: (port: number, host: string) => {
            const { allowedDomains, deniedDomains } = sandboxConfig.network || {};
            
            // Check denied domains first
            if (deniedDomains && deniedDomains.length > 0) {
                if (deniedDomains.some(d => host === d || host.endsWith('.' + d))) return false;
            }
            
            // Check allowed domains if specified
            if (allowedDomains && allowedDomains.length > 0) {
                const isAllowed = allowedDomains.some(d => host === d || host.endsWith('.' + d));
                if (!isAllowed) return false;
            }
            
            return true;
        }
    })
    
    return new Promise<void>((resolve) => {
        this.proxyServer.listen(0, '127.0.0.1', () => {
            this.proxyPort = (this.proxyServer.address() as any).port
            console.log(`Browser Proxy started on port ${this.proxyPort}`)
            resolve()
        })
    })
  }

  private async ensureBrowser() {
    if (!this.browser) {
      await this.startProxy()
      
      console.log('Launching Browser...')
      this.browser = await chromium.launch({
        headless: BROWSER_CONFIG.headless,
        proxy: { server: `http://127.0.0.1:${this.proxyPort}` },
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
      })
    }
  }

  async createSession(options?: { device?: 'desktop' | 'mobile', viewport?: { width: number, height: number } }) {
    await this.ensureBrowser()
    if (this.sessions.size >= BROWSER_CONFIG.maxSessions) throw new Error('Max sessions limit reached')

    const fingerprint = this.fingerprintGenerator.getFingerprint({
        devices: options?.device === 'mobile' ? ['mobile'] : ['desktop'],
        operatingSystems: ['macos', 'windows', 'linux'],
    })

    const context = await this.browser!.newContext({
        viewport: options?.viewport || fingerprint.fingerprint.screen,
        userAgent: fingerprint.fingerprint.navigator.userAgent,
        locale: fingerprint.fingerprint.navigator.language,
    })

    await this.fingerprintInjector.attachFingerprintToPlaywright(context, fingerprint)
    const page = await context.newPage()
    const id = uuidv4()
    
    const session: Session = { id, context, page, lastActive: Date.now(), queue: Promise.resolve() }
    this.sessions.set(id, session)
    return id
  }

  async destroySession(id: string) {
      const session = this.sessions.get(id)
      if (session) {
          await session.context.close().catch(() => {})
          this.sessions.delete(id)
      }
  }

  getSession(id: string) {
      const session = this.sessions.get(id)
      if (session) session.lastActive = Date.now()
      return session
  }

  private cleanupStaleSessions() {
      const now = Date.now()
      for (const [id, session] of this.sessions.entries()) {
          if (now - session.lastActive > BROWSER_CONFIG.sessionTimeout) {
              console.log(`Cleaning up stale session ${id}`)
              this.destroySession(id)
          }
      }
  }

  async navigate(id: string, url: string, waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit') {
    const session = this.getSession(id)
    if (!session) throw new Error('Session not found')
    
    return this.enqueue(session, async () => {
        await session.page.goto(url, { waitUntil })
        const buffer = await session.page.screenshot()
        const screenshot = buffer.toString('base64')
        return { url: session.page.url(), screenshot }
    })
  }

  async performAction(id: string, action: string, selector?: string, value?: string, script?: string, x?: number, y?: number) {
      const session = this.getSession(id)
      if (!session) throw new Error('Session not found')

      return this.enqueue(session, async () => {
          let result = null
          if (selector) {
              try {
                  await session.page.waitForSelector(selector, { timeout: 5000 })
              } catch (e) {
                  // ignore timeout, let action fail if needed
              }
          }

          switch (action) {
              case 'click':
                  if (x !== undefined && y !== undefined) {
                      await session.page.mouse.click(x, y)
                  } else if (selector) {
                      await session.page.click(selector)
                  } else {
                      throw new Error('Selector or coordinates (x, y) required for click')
                  }
                  break
              case 'fill':
                  if (!selector || value === undefined) throw new Error('Selector and value required for fill')
                  await session.page.fill(selector, value)
                  break
              case 'type':
                  if (!selector || value === undefined) throw new Error('Selector and value required for type')
                  await session.page.type(selector, value)
                  break
              case 'screenshot':
                  // just screenshot
                  break
              case 'evaluate':
                  if (!script) throw new Error('Script required for evaluate')
                  result = await session.page.evaluate(script)
                  break
              case 'press':
                   if (!selector || !value) throw new Error('Selector and key (value) required for press')
                   await session.page.press(selector, value)
                   break
              case 'scroll':
                  if (selector) {
                      await session.page.locator(selector).scrollIntoViewIfNeeded()
                  } else if (x !== undefined && y !== undefined) {
                      await session.page.mouse.wheel(x, y)
                  } else {
                      await session.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
                  }
                  break
              default:
                  throw new Error(`Unknown action: ${action}`)
          }
          
          const buffer = await session.page.screenshot()
          const screenshot = buffer.toString('base64')
          return { result, screenshot }
      })
  }

  private enqueue<T>(session: Session, task: () => Promise<T>): Promise<T> {
      const next = session.queue.then(() => task()).catch(err => {
          throw err
      })
      session.queue = next.catch(() => {}) // suppress error for next task
      return next
  }
}
