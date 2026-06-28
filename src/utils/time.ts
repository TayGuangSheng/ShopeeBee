import { AppError } from "./errors.js";

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code = "TIMEOUT"
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new AppError({
          code,
          message: `Operation timed out after ${timeoutMs}ms`,
          publicMessage: "The Shopee affiliate dashboard took too long to respond.",
          retryable: true
        })
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}
