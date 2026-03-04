import { handle } from "hono/vercel";
import app from "../src/index.js";

const handler = handle(app);
export const runtime = "edge";

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
