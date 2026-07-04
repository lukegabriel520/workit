import { confirm, select } from "@inquirer/prompts";
import pc from "picocolors";

export const BACK = "__workit_back__" as const;

export type BackOr<T> = T | typeof BACK;

export function isBack<T>(value: BackOr<T>): value is typeof BACK {
  return value === BACK;
}

export function backChoice<T extends string>() {
  return { name: pc.dim("← Back"), value: BACK as BackOr<T> };
}

export async function selectWithBack<T extends string>(
  config: Omit<Parameters<typeof select<BackOr<T>>>[0], "choices"> & {
    choices: Array<{ name: string; value: T; disabled?: boolean | string }>;
  },
): Promise<BackOr<T>> {
  return select<BackOr<T>>({
    ...config,
    choices: [...config.choices, backChoice<T>()],
  });
}

export async function confirmWithBack(
  config: Parameters<typeof confirm>[0],
): Promise<BackOr<boolean>> {
  return selectWithBack<boolean>({
    message: config.message,
    choices: [
      { name: "Yes", value: true },
      { name: "No", value: false },
    ],
  });
}
