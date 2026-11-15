import { pathToFileURL } from "node:url";
import { ConfigurationError, getConfig } from "../config/env.js";
import { ValidationFailure } from "../utils/validation.js";
import { promptText, TerminalPrompter } from "./prompt.js";
import {
  administratorExists,
  bootstrapAdministrator,
  BootstrapError,
  describeDatabaseTarget,
} from "./bootstrapAdmin.service.js";

/**
 * Interactive administrator bootstrap command.
 *
 * Run with `npm run admin:bootstrap`.
 *
 * The password is never accepted as a command-line argument and is read
 * without echo. No credential material is written to the log.
 */

async function main(): Promise<void> {
  let config;

  try {
    config = getConfig();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  }

  const target = describeDatabaseTarget(config.databaseUrl);

  console.log("TradeWise administrator bootstrap");
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Target database: ${target.database} (${target.user}@${target.host}:${target.port})`);

  if (config.isProduction) {
    console.log("");
    console.log("This will run against a production database.");

    const confirmation = await promptText(
      `Type the database name ("${target.database}") to continue: `,
      { input: process.stdin, output: process.stdout },
    );

    if (confirmation.trim() !== target.database) {
      console.error("Confirmation did not match the target database. Nothing was changed.");
      process.exitCode = 1;
      return;
    }
  }

  if (await administratorExists()) {
    console.error(
      "An administrator account already exists. Bootstrap is refused; nothing was changed.",
    );
    process.exitCode = 1;
    return;
  }

  console.log("");

  const prompter = new TerminalPrompter({
    input: process.stdin,
    output: process.stdout,
  });

  let email: string;
  let username: string;
  let fullName: string;
  let password: string;
  let passwordConfirmation: string;

  try {
    email = await prompter.ask("Email: ");
    username = await prompter.ask("Username: ");
    fullName = await prompter.ask("Full name: ");
    password = await prompter.askSecret("Password: ");
    passwordConfirmation = await prompter.askSecret("Confirm password: ");
  } finally {
    prompter.close();
  }

  try {
    const result = await bootstrapAdministrator({
      email,
      username,
      fullName,
      password,
      passwordConfirmation,
    });

    console.log("");
    console.log(`Administrator "${result.username}" (${result.email}) was created.`);
  } catch (error) {
    if (error instanceof ValidationFailure) {
      console.error("The administrator details are not valid:");

      for (const [field, message] of Object.entries(error.fields)) {
        console.error(`  - ${field}: ${message}`);
      }

      process.exitCode = 1;
      return;
    }

    if (error instanceof BootstrapError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }

    throw error;
  }
}

/** Only runs the interactive command when the file is executed directly. */
function isMainModule(): boolean {
  const entry = process.argv[1];

  if (!entry) return false;

  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  main()
    .catch((error: unknown) => {
      console.error("The administrator could not be created:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      const { prisma } = await import("../lib/prisma.js");
      await prisma.$disconnect();
    });
}
