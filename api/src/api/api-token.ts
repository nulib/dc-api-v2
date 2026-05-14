import { jwtVerify, SignJWT } from "jose";
import { addScopes } from "./scopes.ts";
import {
  apiTokenSecret,
  dcApiEndpoint,
  devTeamNetIds,
} from "../environment.ts";

const InstitutionProviders = ["nusso"];

export interface TokenPayload {
  iss?: string;
  sub?: string;
  exp: number;
  iat: number;
  scopes: Set<string>;
  entitlements: Set<string>;
  isLoggedIn: boolean;
  isReadingRoom?: boolean;
  isSuperUser?: boolean;
  isDevTeam?: boolean;
  isInstitution?: boolean;
  provider?: string;
  [key: string]: unknown;
}

function emptyToken(): TokenPayload {
  return {
    iss: dcApiEndpoint(),
    exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60,
    iat: Math.floor(Number(new Date()) / 1000),
    scopes: new Set(),
    entitlements: new Set(),
    isLoggedIn: false,
  };
}

export class ApiToken {
  token: TokenPayload;
  private _updated = false;
  private _shouldExpire = false;

  constructor(payload?: TokenPayload) {
    this.token = payload ?? emptyToken();
  }

  static async create(signedToken?: string): Promise<ApiToken> {
    if (!signedToken) {
      const instance = new ApiToken();
      addScopes(instance);
      return instance;
    }
    let payload: TokenPayload;
    try {
      const { payload: p } = await jwtVerify(
        signedToken,
        new TextEncoder().encode(apiTokenSecret()),
      );
      payload = p as unknown as TokenPayload;
    } catch {
      const instance = new ApiToken();
      instance.expire();
      return instance;
    }
    payload.scopes = new Set((payload.scopes as unknown as string[]) ?? []);
    payload.entitlements = new Set(
      (payload.entitlements as unknown as string[]) ?? [],
    );
    const instance = new ApiToken(payload);
    addScopes(instance);
    return instance;
  }

  // manipulation – always return `this` for chaining

  user(user: Record<string, unknown>): this {
    this.token = {
      ...this.token,
      ...user,
      isLoggedIn: !!user?.sub,
      isDevTeam: !!user?.sub && devTeamNetIds().includes(user?.sub as string),
    };
    addScopes(this);
    return this.update();
  }

  provider(provider: string): this {
    this.token = {
      ...this.token,
      provider: provider,
      isInstitution: InstitutionProviders.includes(provider),
    };
    addScopes(this);
    return this.update();
  }

  readingRoom(): this {
    this.token.isReadingRoom = true;
    addScopes(this);
    return this;
  }

  superUser(): this {
    this.token.isSuperUser = true;
    addScopes(this);
    return this;
  }

  // add, remove, and replace scopes/entitlements

  addScope(scope: string): this {
    if (this.token.scopes.has(scope)) {
      return this;
    }
    this.token.scopes.add(scope);
    return this.update();
  }

  addEntitlement(entitlement: string): this {
    if (this.token.entitlements.has(entitlement)) {
      return this;
    }
    this.token.entitlements.add(entitlement);
    return this.update();
  }

  entitlements(entitlements: string[]): this {
    this.token = {
      ...this.token,
      entitlements: new Set(entitlements),
    };
    return this.update();
  }

  removeScope(scope: string): this {
    if (this.token.scopes.has(scope)) {
      this.token.scopes.delete(scope);
      return this.update();
    }
    return this;
  }

  removeEntitlement(entitlement: string): this {
    if (this.token.entitlements.has(entitlement)) {
      this.token.entitlements.delete(entitlement);
      return this.update();
    }
    return this;
  }

  expire(): this {
    this._shouldExpire = true;
    return this.update();
  }

  expireAt(dateTime: Date | number): void {
    this.token.exp = Math.floor(Number(dateTime) / 1000);
  }

  update(): this {
    this._updated = true;
    return this;
  }

  // serialization methods

  userInfo(): Record<string, unknown> {
    const result: Record<string, unknown> = { ...this.token };
    result.scopes = [...this.token.scopes];
    delete result.entitlements;
    return result;
  }

  async sign(): Promise<string> {
    const result = {
      ...this.token,
      scopes: [...this.token.scopes],
      entitlements: [...this.token.entitlements],
    };
    return await new SignJWT(result as Record<string, unknown>)
      .setProtectedHeader({ alg: "HS256" })
      .sign(new TextEncoder().encode(apiTokenSecret()));
  }

  // boolean checks

  hasEntitlement(entitlement: string): boolean {
    return this.token.entitlements.has(entitlement);
  }

  can(action: string): boolean {
    return this.token.scopes.has(action);
  }

  isDevTeam(): boolean {
    return !!this.token.isDevTeam;
  }

  isLoggedIn(): boolean {
    return !!this.token.isLoggedIn;
  }

  isInstitution(): boolean {
    return !!this.token.isInstitution;
  }

  isReadingRoom(): boolean {
    return !!this.token.isReadingRoom;
  }

  isSuperUser(): boolean {
    return !!this.token.isSuperUser;
  }

  shouldExpire(): boolean {
    return !!this._shouldExpire;
  }

  updated(): boolean {
    return !!this._updated;
  }
}

export default ApiToken;
