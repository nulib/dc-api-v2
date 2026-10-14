import type { ApiToken } from "./api/api-token.ts";

export type AppEnv = {
  Variables: {
    format: string | undefined;
    userToken: ApiToken;
  };
};
