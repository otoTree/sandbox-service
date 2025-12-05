import { z } from 'zod'

export const executeSchema = z.object({
  code: z.string().min(1, 'code is required'),
  timeoutMs: z.number().int().min(1).max(120000).optional(),
  // Optional upload configuration: when provided, the service will
  // collect files generated in the execution working directory and
  // upload them to the specified file service.
  fileUploadUrl: z.string().url().optional(),
  uploadToken: z.string().min(1).optional(),
  public: z.boolean().optional(),
})

export type ExecuteRequest = z.infer<typeof executeSchema>
