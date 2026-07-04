import pc from "picocolors";
import type { LaunchEntry, Profile } from "../config/schema.js";
import { formatDryRunLine, launchEntry, buildBrowserLaunchArgs, type SpawnResult } from "./launch.js";

function buildLaunchArgs(entry: LaunchEntry, profile: Profile): string[] {
  if (entry.attachUrls && profile.urls.length > 0) {
    return buildBrowserLaunchArgs(profile.urls);
  }
  return [];
}

function printResult(result: SpawnResult): void {
  if (result.skipped) {
    console.log(pc.dim(`– ${result.name}: skipped (empty path)`));
    return;
  }
  if (result.success) {
    console.log(pc.green(`✓ ${result.name} launched`));
  } else {
    console.error(pc.red(`✗ ${result.name}: ${result.error ?? "Failed to launch"}`));
  }
}

export async function launchProfile(
  profile: Profile,
  profileName: string,
  options: { dryRun?: boolean; extraApps?: LaunchEntry[] } = {},
): Promise<void> {
  const { dryRun = false, extraApps = [] } = options;
  const label = dryRun ? "Dry run" : "Starting session";
  console.log(pc.cyan(`${label}: ${profileName}\n`));

  const activeApps = [...profile.apps, ...extraApps].filter((app) => app.path?.trim());

  if (activeApps.length === 0) {
    console.log(pc.yellow("No apps configured with paths in this profile."));
    return;
  }

  if (dryRun) {
    for (const app of activeApps) {
      const extraArgs = buildLaunchArgs(app, profile);
      console.log(pc.dim(`[dry-run] Would launch: ${formatDryRunLine(app, extraArgs)}`));
    }
    console.log(pc.green(`\nDry run complete: ${activeApps.length} app(s) would launch.`));
    return;
  }

  const results = await Promise.allSettled(
    activeApps.map((app) => launchEntry(app, buildLaunchArgs(app, profile))),
  );

  for (const settled of results) {
    if (settled.status === "fulfilled") {
      printResult(settled.value);
    } else {
      console.error(pc.red(`✗ Launch failed: ${settled.reason}`));
    }
  }

  const spawnResults = results
    .filter((r): r is PromiseFulfilledResult<SpawnResult> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((r) => !r.skipped);

  const successCount = spawnResults.filter((r) => r.success).length;
  const total = spawnResults.length;

  console.log(
    pc.green(`\nSession started: ${successCount}/${total} app(s) launched.`),
  );
}
