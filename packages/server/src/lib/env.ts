import { z } from "zod";

const envSchema = z.object({
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_APP_TOKEN: z.string().optional(),
  CRON_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  JWT_EXPIRY: z.string().default("7d"),
  API_URL: z.string().url().default("http://localhost:3000"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  NODE_ENV: z.string().default("production"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

/**
 * Lazily-validated environment variables.
 * Proxy defers parsing until first access so the module can be imported
 * without immediately crashing (useful for type-only imports in tests).
 * Throws on first access if any required variable is missing.
 */
export const env: Env = new Proxy({} as Env, {
  get(_, prop: string) {
    if (!_env) {
      const result = envSchema.safeParse(process.env);
      if (!result.success) {
        const fields = result.error.flatten().fieldErrors;
        console.error("Invalid environment variables:", JSON.stringify(fields));
        throw new Error("Missing env vars: " + Object.keys(fields).join(", "));
      }
      _env = result.data;
    }
    return _env[prop as keyof Env];
  },
});
