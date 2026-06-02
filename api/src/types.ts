import type { ApiToken } from "./api/api-token.ts";

export type AppEnv = {
  Variables: {
    userToken: ApiToken;
  };
};
