const { addAbilities } = require("./abilities");
const {
  apiTokenSecret,
  dcApiEndpoint,
  devTeamNetIds,
} = require("../environment");
const jwt = require("jsonwebtoken");

const InstitutionProviders = ["nusso"];

function emptyToken() {
  return {
    iss: dcApiEndpoint(),
    exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60, // 12 hours
    iat: Math.floor(Number(new Date()) / 1000),
    abilities: new Set(),
    entitlements: new Set(),
    isLoggedIn: false,
  };
}

class ApiToken {
  constructor(signedToken) {
    if (signedToken) {
      try {
        this.token = jwt.verify(signedToken, apiTokenSecret());
      } catch {
        this.token = emptyToken();
        this.expire();
      }
      this.token.abilities = new Set(this.token.abilities || []);
      this.token.entitlements = new Set(this.token.entitlements || []);
    } else {
      this.token = emptyToken();
    }
    addAbilities(this);
  }

  // manipulation – always return `this` for chaining

  user(user) {
    this.token = {
      ...this.token,
      ...user,
      isLoggedIn: !!user,
      isDevTeam: !!user && user?.sub && devTeamNetIds().includes(user?.sub),
    };
    addAbilities(this);
    return this.update();
  }

  provider(provider) {
    this.token = {
      ...this.token,
      provider: provider,
    };
    addAbilities(this);
    return this.update();
  }

  readingRoom() {
    this.token.isReadingRoom = true;
    addAbilities(this);
    return this;
  }

  superUser() {
    this.token.isSuperUser = true;
    addAbilities(this);
    return this;
  }

  // add, remove, and replace entitlements

  addAbility(ability) {
    if (this.token.abilities.has(ability)) {
      return this;
    }
    this.token.abilities.add(ability);
    return this.update();
  }

  addEntitlement(entitlement) {
    if (this.token.entitlements.has(entitlement)) {
      return this;
    }
    this.token.entitlements.add(entitlement);
    return this.update();
  }

  entitlements(entitlements) {
    this.token = {
      ...this.token,
      entitlements: new Set(entitlements),
    };
    return this.update();
  }

  removeAbility(ability) {
    if (this.token.abilities.has(ability)) {
      this.token.abilities.delete(ability);
      return this.update();
    }
    return this;
  }

  removeEntitlement(entitlement) {
    if (this.token.entitlements.has(entitlement)) {
      this.token.entitlements.delete(entitlement);
      return this.update();
    }
    return this;
  }

  expire() {
    this._shouldExpire = true;
    return this.update();
  }

  expireAt(dateTime) {
    this.token.exp = Math.floor(Number(dateTime) / 1000);
  }

  update() {
    this._updated = true;
    return this;
  }

  // serialization methods

  userInfo() {
    const result = { ...this.token };
    delete result.abilities;
    delete result.entitlements;
    return result;
  }

  sign() {
    const result = {
      ...this.token,
      abilities: [...this.token.abilities],
      entitlements: [...this.token.entitlements],
    };
    return jwt.sign(result, apiTokenSecret());
  }

  // boolean checks

  hasEntitlement(entitlement) {
    return this.token.entitlements.has(entitlement);
  }

  // alias for hasEntitlement
  can(action) {
    return this.token.abilities.has(action);
  }

  isDevTeam() {
    return !!this.token.isDevTeam;
  }

  isLoggedIn() {
    return !!this.token.isLoggedIn;
  }

  isInstitution() {
    return InstitutionProviders.includes(this.token.provider);
  }

  isReadingRoom() {
    return !!this.token.isReadingRoom;
  }

  isSuperUser() {
    return !!this.token.isSuperUser;
  }

  shouldExpire() {
    return !!this._shouldExpire;
  }

  updated() {
    return !!this._updated;
  }
}

module.exports = ApiToken;
