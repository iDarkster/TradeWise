import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({
  path: resolve(process.cwd(), "../.env"),
});

// Import the app only after environment variables are loaded.
const { app } = await import("./app.js");
const { ConfigurationError, getConfig } = await import("./config/env.js");

try {
  const config = getConfig();

  app.listen(config.port, () => {
    console.log(
      `TradeWise API running at http://localhost:${config.port} (${config.nodeEnv})`,
    );
  });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error(error.message);
    process.exit(1);
  }

  throw error;
}
