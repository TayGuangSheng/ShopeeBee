export interface AppErrorOptions {
  code: string;
  message: string;
  publicMessage?: string;
  retryable?: boolean;
  attempts?: number;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly publicMessage: string;
  public readonly retryable: boolean;
  public readonly attempts: number | undefined;
  public readonly cause: unknown | undefined;

  public constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = "AppError";
    this.code = options.code;
    this.publicMessage = options.publicMessage ?? "The request could not be completed.";
    this.retryable = options.retryable ?? false;
    this.attempts = options.attempts;
    this.cause = options.cause;
  }
}

export function asAppError(error: unknown, fallbackCode = "UNEXPECTED_ERROR"): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new AppError({
    code: fallbackCode,
    message,
    publicMessage: "Something went wrong while processing the link.",
    retryable: false,
    cause: error
  });
}
