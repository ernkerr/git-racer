import type { JWTPayload } from "./lib/jwt.js";

export type AppEnv = {
  Variables: {
    user: JWTPayload;
  };
};
