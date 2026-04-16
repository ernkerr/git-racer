import { z } from "zod";

const githubUsername = z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/);

export const createChallengeSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: z.enum(["1v1", "team"]).default("1v1"),
    duration_preset: z.enum(["1day", "2days", "3days", "1week", "1quarter", "ongoing"]).default("1week"),
    include_today: z.boolean().default(true),
    opponents: z.array(githubUsername).min(1).max(49),
  })
  .refine(
    (d) => d.type !== "1v1" || d.opponents.length === 1,
    { message: "1v1 challenges must have exactly one opponent", path: ["opponents"] }
  );

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;

export const joinChallengeSchema = z.object({
  // No body needed — user is inferred from auth
});

export const usernameParamSchema = z.object({
  username: githubUsername,
});
