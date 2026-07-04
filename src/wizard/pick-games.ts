import { checkbox } from "@inquirer/prompts";
import pc from "picocolors";
import type { PickableItem } from "../config/custom-games.js";
import type { LaunchEntry } from "../config/schema.js";

export async function promptPickGames(pool: PickableItem[]): Promise<LaunchEntry[] | null> {
  if (pool.length === 0) {
    console.log(pc.yellow("No pickable games found for this profile."));
    return null;
  }

  const selectedIds = await checkbox({
    message: "Pick game(s) or app(s) to launch:",
    choices: pool.map((item) => ({
      name: item.name,
      value: item.pickId,
    })),
    validate: (value) => value.length > 0 || "Select at least one item",
  });

  const byId = new Map(pool.map((item) => [item.pickId, item.entry]));
  return selectedIds
    .map((id) => byId.get(id))
    .filter((entry): entry is LaunchEntry => Boolean(entry));
}
