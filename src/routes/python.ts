import type { Request, Response } from 'express'
import { spawnSync } from 'child_process'
import * as path from 'path'
import { packageSchema } from '../types.js'

const venvPython = path.join(process.cwd(), process.env.PYTHON_VENV || 'python-venv/bin/python')

export async function listPackagesHandler(req: Request, res: Response) {
  try {
    const result = spawnSync(venvPython, ['-m', 'pip', 'list', '--format=json'], { encoding: 'utf8' })
    if (result.error) {
       throw result.error
    }
    if (result.status !== 0) {
        return res.status(500).json({ error: 'Failed to list packages', details: result.stderr })
    }
    const packages = JSON.parse(result.stdout)
    res.json({ packages })
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function managePackageHandler(req: Request, res: Response) {
    const parseResult = packageSchema.safeParse(req.body)
    if (!parseResult.success) {
        return res.status(400).json({ error: 'Invalid request', details: parseResult.error.format() })
    }
    
    const { action, packages } = parseResult.data
    
    try {
        const args = ['-m', 'pip', action, ...packages]
        if (action === 'uninstall') {
            args.push('-y') // Auto confirm
        }

        const result = spawnSync(venvPython, args, { encoding: 'utf8' })
        
        if (result.error) {
            throw result.error
        }
        
        if (result.status !== 0) {
             return res.status(500).json({ error: `Failed to ${action} packages`, details: result.stderr })
        }
        
        res.json({ message: `Successfully ${action}ed packages: ${packages.join(', ')}`, output: result.stdout })

    } catch (err) {
        res.status(500).json({ error: (err as Error).message })
    }
}
