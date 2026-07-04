import { checkbox, confirm, input, select } from "@inquirer/prompts";
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
  return selectWithBack<"yes" | "no">({
    message: config.message,
    choices: [
      { name: "Yes", value: "yes" },
      { name: "No", value: "no" },
    ],
  }).then((answer) => {
    if (isBack(answer)) {
      return BACK;
    }
    return answer === "yes";
  });
}

type InputConfig = Parameters<typeof input>[0];

export async function inputWithBack(
  config: InputConfig,
  options: { allowSkip?: boolean } = {},
): Promise<BackOr<string>> {
  const allowSkip = options.allowSkip ?? true;
  const choices: Array<{ name: string; value: "enter" | "skip" }> = [
    { name: "Enter a value", value: "enter" },
  ];
  if (allowSkip) {
    choices.push({ name: "Leave blank / skip", value: "skip" });
  }

  const action = await selectWithBack<"enter" | "skip">({
    message: config.message,
    choices,
  });

  if (isBack(action)) {
    return BACK;
  }

  if (action === "skip") {
    return "";
  }

  return input(config);
}

export async function checkboxWithBack<T extends string>(
  config: Parameters<typeof checkbox<T>>[0],
): Promise<BackOr<T[]>> {
  const selected = await checkbox(config);

  const review = await selectWithBack<"continue" | "retry">({
    message: `${selected.length} item(s) selected`,
    choices: [
      { name: "Continue", value: "continue" },
      { name: "← Back (change selection)", value: "retry" },
    ],
  });

  if (isBack(review)) {
    return BACK;
  }

  if (review === "retry") {
    return checkboxWithBack(config);
  }

  return selected;
}
