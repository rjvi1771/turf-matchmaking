import { z } from 'zod';

const originListSchema = z
  .string()
  .min(1, 'CLIENT_ORIGIN cannot be empty')
  .refine(
    (val) =>
      !val
        .split(',')
        .map((s) => s.trim())
        .includes('*'),
    {
      message: 'CLIENT_ORIGIN cannot contain wildcard "*"',
    }
  )
  .transform((val) =>
    val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    MONGODB_URI: z
      .string()
      .min(1, 'MONGODB_URI is required')
      .refine(
        (uri) =>
          uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
        { message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://' }
      ),
    CLIENT_ORIGIN: originListSchema,
    TRUST_PROXY: z.preprocess(
      (val) => (val === undefined || val === '' ? undefined : val),
      z.coerce.number().int().min(0).optional()
    ),
    RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
    RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production' && data.TRUST_PROXY === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message: 'TRUST_PROXY must be set explicitly in production',
      });
    }
  })
  .transform((data) => ({
    ...data,
    TRUST_PROXY: data.TRUST_PROXY ?? 0,
  }));

export type Env = z.infer<typeof envSchema>;

export function validateEnv(rawEnv: Record<string, string | undefined>) {
  const result = envSchema.safeParse(rawEnv);
  if (!result.success) {
    const errorDetails = result.error.issues.map((issue) => {
      const varName = issue.path.join('.') || 'UNKNOWN_VAR';
      return `${varName}: ${issue.message}`;
    });
    return { success: false as const, errors: errorDetails };
  }
  return { success: true as const, data: result.data };
}

export function loadEnv(
  rawEnv: Record<string, string | undefined> = process.env
): Env {
  const result = validateEnv(rawEnv);
  if (!result.success) {
    console.error('Environment validation failed:');
    for (const err of result.errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }
  return result.data;
}
