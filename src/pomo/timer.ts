import pc from "picocolors";

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function renderLine(label: string, remainingSeconds: number): void {
  process.stdout.write(`\r${label} ${formatTime(remainingSeconds)}   `);
}

function renderFallbackLine(label: string, remainingSeconds: number): void {
  console.log(`${label} ${formatTime(remainingSeconds)}`);
}

export function runPomodoro(minutes: number): Promise<void> {
  const totalMs = minutes * 60 * 1000;
  const endTime = Date.now() + totalMs;
  const isTTY = Boolean(process.stdout.isTTY);
  const label = pc.bold(pc.yellow("Pomodoro"));

  if (isTTY) {
    process.stdout.write("\x1Bc");
  } else {
    console.log(pc.yellow(`Pomodoro (${minutes} min) — non-interactive mode`));
  }

  return new Promise((resolve) => {
    let interval: ReturnType<typeof setInterval> | undefined;

    const cleanup = (message?: string): void => {
      if (interval) {
        clearInterval(interval);
      }
      if (message) {
        if (isTTY) {
          process.stdout.write("\n");
        }
        console.log(message);
      }
      resolve();
    };

    const onSigint = (): void => {
      process.removeListener("SIGINT", onSigint);
      cleanup(pc.dim("\nPomodoro cancelled."));
      process.exit(130);
    };

    process.on("SIGINT", onSigint);

    const tick = (): void => {
      const remainingMs = endTime - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));

      if (isTTY) {
        renderLine(label, remainingSeconds);
      } else {
        renderFallbackLine(label, remainingSeconds);
      }

      if (remainingMs <= 0) {
        process.removeListener("SIGINT", onSigint);
        if (interval) {
          clearInterval(interval);
        }
        if (isTTY) {
          process.stdout.write("\n");
        }
        process.stdout.write("\x07");
        console.log(pc.green("Pomodoro complete! Time for a break."));
        resolve();
      }
    };

    tick();
    interval = setInterval(tick, 1000);
  });
}
