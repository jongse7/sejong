import { handle } from "hono/vercel";
import app from "../src/index.js";

export const runtime = "edge";

export default handle(app);
