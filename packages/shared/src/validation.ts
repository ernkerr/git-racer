import { z } from "zod";

const githubUsername = z.string().min(1).max(39).regex(/^[a-zA-Z0-9-]+$/);

export const createChallengeSchema = z
  .object({
    name: z.string().min(1).max(100),
    type: z.enum(["1v1", "team"]).default("1v1"),
    duration_type: z.enum(["fixed", "ongoing", "goal"]).default("fixed"),
    refresh_period: z.enum(["daily", "weekly", "ongoing"]).default("weekly"),
    opponents: z.array(githubUsername).min(1).max(49),
    end_date: z.string().datetime().optional(),
    goal_target: z.number().int().positive().optional(),
    goal_metric: z.string().max(50).optional(),
  })
  .refine(
    (d) => d.duration_type !== "fixed" || d.end_date,
    { message: "end_date is required for fixed-duration challenges", path: ["end_date"] }
  )
  .refine(
    (d) => d.duration_type !== "goal" || (d.goal_target && d.goal_metric),
    { message: "goal_target and goal_metric are required for goal-based challenges", path: ["goal_target"] }
  )
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
