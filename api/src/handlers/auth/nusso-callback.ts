import { serialize as cookieSerialize } from "cookie";
import { dcApiEndpoint } from "../../environment.ts";
import { ApiToken } from "../../api/api-token.ts";
import Honeybadger from "@honeybadger-io/js";
import type { Context } from "hono";
import type { AppEnv } from "../../types.ts";
import { getCookie } from "hono/cookie";

const BAD_DIRECTORY_SEARCH_FAULT =
  /Reason: ResponseCode 404 is treated as error/;

export const handler = async (c: Context<AppEnv>): Promise<Response> => {
  let returnPath = `${dcApiEndpoint()}/auth/whoami`;
  const redirectUrl = getCookie(c, "redirectUrl");
  if (redirectUrl) {
    returnPath = atob(decodeURIComponent(redirectUrl));
  }

  const user = await redeemSsoToken(c);
  if (user) {
    console.info("User", user.sub, "logged in via nusso");
    c.set("userToken", new ApiToken().user(user).provider("nusso"));
    return new Response(null, {
      status: 302,
      headers: {
        location: returnPath,
        "set-cookie": cookieSerialize("redirectUrl", "", {
          expires: new Date(1),
        }),
      },
    });
  }
  return new Response(null, { status: 400 });
};

async function invokeNuApi(
  path: string,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const url = new URL(process.env["NUSSO_BASE_URL"] ?? "");
  url.pathname = path;
  const resp = await fetch(url.toString(), {
    headers: { apikey: process.env["NUSSO_API_KEY"] ?? "", ...headers },
  });
  if (!resp.ok) {
    const error = new Error(`HTTP ${resp.status}`) as Error & {
      response: { data: unknown };
    };
    error.response = { data: await resp.json().catch(() => null) };
    throw error;
  }
  return await resp.json();
}

async function getNetIdFromToken(nusso: string): Promise<string | undefined> {
  const data = (await invokeNuApi("/agentless-websso/validateWebSSOToken", {
    webssotoken: nusso,
  })) as { netid?: string };
  return data?.netid;
}

interface NuUser {
  uid?: string;
  displayName?: string[];
  givenName?: string;
  mail?: string;
  eduPersonPrimaryAffiliation?: string;
  primaryAffiliation?: string;
}

function transform(user: NuUser): Record<string, unknown> {
  return {
    sub: user?.uid,
    name: user?.displayName?.[0],
    email: user?.mail,
    primaryAffiliation: user?.primaryAffiliation,
  };
}

async function redeemSsoToken(
  c: Context<AppEnv>,
): Promise<Record<string, unknown> | null> {
  const nusso = getCookie(c, "nusso");
  if (!nusso) return null;
  const netid = await getNetIdFromToken(nusso);
  if (netid) {
    try {
      const data = (await invokeNuApi(
        `/directory-search/res/netid/bas/${netid}`,
      )) as { results: NuUser[] };
      const user = fillInBlanks({ ...data.results[0], uid: netid });
      return transform(user);
    } catch (err) {
      const errWithData = err as Error & {
        code?: string;
        response?: { data?: { fault?: { faultstring?: string } } };
      };
      if (
        BAD_DIRECTORY_SEARCH_FAULT.test(
          errWithData?.response?.data?.fault?.faultstring ?? "",
        )
      ) {
        return transform(fillInBlanks({ uid: netid }));
      }
      await Honeybadger.notifyAsync(err as Error, {
        tags: ["auth", "upstream"],
      });
      console.error(errWithData.response?.data);
      return null;
    }
  } else {
    console.warn("NUSSO token could not be redeemed");
    return null;
  }
}

function fillInBlanks(response: NuUser): NuUser {
  const { uid, displayName, eduPersonPrimaryAffiliation, givenName, mail } =
    response;
  return {
    uid,
    givenName,
    displayName: ifEmpty(displayName, [uid as string]),
    mail: ifEmpty(mail, `${uid}@e.northwestern.edu`),
    primaryAffiliation: eduPersonPrimaryAffiliation,
  };
}

function ifEmpty<T>(val: T | undefined | null, replacement: T): T {
  return isEmpty(val) ? replacement : val!;
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (Array.isArray(val)) return val.every(isEmpty);
  return (val as string | unknown[]).length === 0;
}
