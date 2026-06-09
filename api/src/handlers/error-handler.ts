import Honeybadger from "@honeybadger-io/js";

export const handleError = async (err: Error) => {
  console.error("[api.handleError]", err.stack ?? err);
  if (err.cause instanceof Error) {
    console.error("[cause]", err.cause.stack ?? err.cause);
  }

  if (Honeybadger.config?.enableUncaught) {
    await Honeybadger.notifyAsync(err);
  }
};
