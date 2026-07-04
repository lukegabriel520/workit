import cac from "cac";
import pc from "picocolors";
import { NotConfiguredError, ProfileNotFoundError, ValidationError } from "./errors.js";
import { parsePomoMinutes } from "./config/schema.js";
import { getConfigUnsafe, getProfile, requireInit } from "./config/store.js";
import { runPomodoro } from "./pomo/timer.js";
import { launchProfile } from "./spawn/launch-profile.js";
import { runInit, runReset, showConfig } from "./wizard/init.js";

const RESERVED_COMMANDS = new Set(["init", "pomo", "config", "reset", "help", "version"]);

export function createCli() {
  const cli = cac("workit");

  cli
    .command("init", "Run the setup wizard")
    .action(async () => {
      try {
        await runInit();
      } catch (error) {
        handleError(error);
      }
    });

  cli
    .command("reset", "Clear all configuration")
    .action(async () => {
      try {
        await runReset();
      } catch (error) {
        handleError(error);
      }
    });

  cli
    .command("pomo", "Start the pomodoro timer")
    .option("-m, --minutes <n>", "Override pomodoro length in minutes")
    .action(async (options: { minutes?: string }) => {
      try {
        const config = requireInit();
        const minutes = options.minutes
          ? parsePomoMinutes(options.minutes)
          : config.pomo;

        await runPomodoro(minutes);
      } catch (error) {
        handleError(error);
      }
    });

  cli
    .command("config", "Show current configuration")
    .action(async () => {
      try {
        await showConfig();
      } catch (error) {
        handleError(error);
      }
    });

  cli
    .command("[profile]", "Launch a profile")
    .option("--dry-run", "Preview launches without starting apps")
    .action(async (profileArg: string | undefined, options: { dryRun?: boolean }) => {
      try {
        const config = requireInit();
        const profileName = profileArg ?? config.defaultProfile;

        if (RESERVED_COMMANDS.has(profileName)) {
          throw new ProfileNotFoundError(profileName);
        }

        const profile = getProfile(profileName);
        await launchProfile(profile, profileName, { dryRun: options.dryRun });
      } catch (error) {
        handleError(error);
      }
    });

  cli.help();

  return cli;
}

function handleError(error: unknown): void {
  if (error instanceof NotConfiguredError) {
    console.error(pc.yellow(error.message));
    process.exit(1);
    return;
  }

  if (error instanceof ProfileNotFoundError) {
    const config = getConfigUnsafe();
    const available = Object.keys(config.profiles);
    console.error(pc.red(`Error: ${error.message}`));
    if (available.length > 0) {
      console.error(pc.dim(`Available profiles: ${available.join(", ")}`));
    }
    process.exit(1);
    return;
  }

  if (error instanceof ValidationError) {
    console.error(pc.red(`Error: ${error.message}`));
    console.error(pc.dim("Fix config.json or run `workit init` to reconfigure."));
    process.exit(1);
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(pc.red(`Error: ${message}`));
  process.exit(1);
}
