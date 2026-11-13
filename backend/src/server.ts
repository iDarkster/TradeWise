
import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({
  path: resolve(process.cwd(), "../.env"),
});

// Import the app only after environment variables are loaded.
const { app } = await import("./app.js");

const PORT = Number(process.env.PORT ?? 5001);

app.listen(PORT, () => {
  console.log(`TradeWise API running at http://localhost:${PORT}`);
});
