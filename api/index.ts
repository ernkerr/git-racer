import { handle } from "hono/vercel";
import app from "../packages/server/src/app.js";

export const runtime = "nodejs";

const handler = handle(app);
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
