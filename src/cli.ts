import cac from "cac";
import pc from "picocolors";
import { NotConfiguredError, ProfileNotFoundError, ValidationError } from "./errors.js";
import { getProfilePickPool, profileHasPickPool } from "./config/pick-pool.js";
import { getConfigUnsafe, getProfile, requireInit } from "./config/store.js";
import { launchProfile } from "./spawn/launch-profile.js";
import { runInit, runDelete, runRename, runReset, showConfig } from "./wizard/init.js";
import { promptPickGames } from "./wizard/pick-games.js";

const RESERVED_COMMANDS = new Set(["init", "config", "reset", "rename", "delete", "help", "version"]);

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
    .command("rename <oldName> <newName>", "Rename a profile")
    .action(async (oldName: string, newName: string) => {
      try {
        await runRename(oldName, newName);
      } catch (error) {
        handleError(error);
      }
    });

  cli
    .command("delete <profileName>", "Delete a profile")
    .action(async (profileName: string) => {
      try {
        requireInit();
        await runDelete(profileName);
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
    .option("--pick", "Choose catalog / custom-folder games to launch")
    .action(async (
      profileArg: string | undefined,
      options: { dryRun?: boolean; pick?: boolean },
    ) => {
      try {
        const config = requireInit();
        const profileName = profileArg ?? config.defaultProfile;

        if (RESERVED_COMMANDS.has(profileName)) {
          throw new ProfileNotFoundError(profileName);
        }

        const profile = getProfile(profileName);
        let extraApps: import("./config/schema.js").LaunchEntry[] = [];

        if (options.pick) {
          if (!profileHasPickPool(profile)) {
            console.error(pc.yellow(
              `Profile "${profileName}" has no catalog games or custom folder. Run \`workit init\` to add them.`,
            ));
            process.exit(1);
            return;
          }

          const pool = getProfilePickPool(profile);
          const picked = await promptPickGames(pool);
          if (!picked || picked.length === 0) {
            console.log(pc.dim("Nothing selected. Exiting."));
            return;
          }
          extraApps = picked;
        } else if (profileHasPickPool(profile)) {
          console.log(pc.dim(
            `Tip: This profile has pickable games. Use \`workit ${profileName} --pick\` to choose which to launch.`,
          ));
        }

        await launchProfile(profile, profileName, {
          dryRun: options.dryRun,
          extraApps,
        });
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
