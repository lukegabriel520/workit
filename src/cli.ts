import cac from "cac";
import pc from "picocolors";
import { NotConfiguredError, ProfileNotFoundError, ValidationError } from "./errors.js";
import { getProfilePickPool, profileHasPickPool } from "./config/pick-pool.js";
import { getConfigUnsafe, getProfile, requireInit, setConfig } from "./config/store.js";
import { launchProfile } from "./spawn/launch-profile.js";
import { runInit, runDelete, runRename, runReset, showConfig } from "./wizard/init.js";
import { promptPickGames } from "./wizard/pick-games.js";

const RESERVED_COMMANDS = new Set([
  "init",
  "config",
  "reset",
  "rename",
  "delete",
  "list",
  "default",
  "help",
  "version",
]);

export async function resolveExtraApps(
  profile: import("./config/schema.js").Profile,
  profileName: string,
  options: { pick?: boolean; noPick?: boolean },
): Promise<import("./config/schema.js").LaunchEntry[] | null> {
  const hasPool = profileHasPickPool(profile);
  const shouldPrompt = hasPool && !options.noPick;

  if (options.pick && !hasPool) {
    console.error(pc.yellow(
      `Profile "${profileName}" has no catalog games or custom folder. Run \`workit init\` to add them.`,
    ));
    process.exit(1);
    return null;
  }

  if (!shouldPrompt) {
    return [];
  }

  const pool = getProfilePickPool(profile);
  const picked = await promptPickGames(pool);
  if (!picked || picked.length === 0) {
    console.log(pc.dim("Nothing selected. Exiting."));
    return null;
  }
  return picked;
}

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
    .command("list", "List profile names")
    .action(async () => {
      try {
        const config = requireInit();
        const names = Object.keys(config.profiles);
        if (names.length === 0) {
          console.log(pc.dim("No profiles configured."));
          return;
        }
        for (const name of names) {
          const marker = name === config.defaultProfile ? pc.cyan(" (default)") : "";
          console.log(`${name}${marker}`);
        }
      } catch (error) {
        handleError(error);
      }
    });

  cli
    .command("default <profileName>", "Set the default profile")
    .action(async (profileName: string) => {
      try {
        const config = requireInit();
        if (!config.profiles[profileName]) {
          throw new ProfileNotFoundError(profileName);
        }
        setConfig({ defaultProfile: profileName });
        console.log(pc.green(`✓ Default profile set to "${profileName}".`));
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
    .option("--pick", "Choose catalog / custom-folder apps to launch (default when pool exists)")
    .option("--no-pick", "Launch pinned apps only; skip the launch picker")
    .action(async (
      profileArg: string | undefined,
      options: { dryRun?: boolean; pick?: boolean; noPick?: boolean },
    ) => {
      try {
        const config = requireInit();
        const profileName = profileArg ?? config.defaultProfile;

        if (RESERVED_COMMANDS.has(profileName)) {
          throw new ProfileNotFoundError(profileName);
        }

        const profile = getProfile(profileName);
        const extraApps = await resolveExtraApps(profile, profileName, options);
        if (extraApps === null) {
          return;
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
