import { ProviderCapabilities } from "../environment.ts";
import type { ApiToken } from "./api-token.ts";

const Scopes: Record<string, (user: ApiToken) => boolean> = {
  "read:Public": () => true,
  "read:Published": () => true,
  "read:Institution": (user) =>
    user.isSuperUser() || user.isInstitution() || user.isReadingRoom(),
  "read:Private": (user) => user.isSuperUser() || user.isReadingRoom(),
  "read:Unpublished": (user) => user.isSuperUser(),
  chat: (user) =>
    (user.isLoggedIn() &&
      (
        ProviderCapabilities()[user.token.provider as string] as
          | string[]
          | undefined
      )?.includes("chat")) ||
    user.isSuperUser(),
};

export const addScopes = (apiToken: ApiToken): ApiToken => {
  for (const [scope, fn] of Object.entries(Scopes)) {
    if (fn(apiToken)) {
      apiToken.addScope(scope);
    }
  }
  return apiToken;
};
