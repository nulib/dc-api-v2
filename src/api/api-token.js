const { apiTokenSecret, dcApiEndpoint } = require("../environment");
const jwt = require("jsonwebtoken");

class ApiToken {
  constructor(signedToken) {
    if (signedToken) {
      this.token = jwt.verify(signedToken, apiTokenSecret());
      this.token.entitlements = new Set(this.token.entitlements || []);
    } else {
      this.token = {
        iss: dcApiEndpoint(),
        exp: Math.floor(Number(new Date()) / 1000) + 12 * 60 * 60, // 12 hours
        iat: Math.floor(Number(new Date()) / 1000),
        entitlements: new Set(),
        isLoggedIn: false,
      };
    }
  }

  // manipulation – always return `this` for chaining

  user(user) {
    this.token = {
      ...this.token,
      sub: user?.uid,
      name: user?.displayName?.[0],
      email: user?.mail,
      isLoggedIn: !!user,
    };

    return this;
  }

  readingRoom() {
    this.token.isReadingRoom = true;
    return this;
  }

  superUser() {
    this.token.isSuperUser = true;
    return this;
  }

  // add, remove, and replace entitlements

  addEntitlement(entitlement) {
    this.token.entitlements.add(entitlement);

    return this;
  }

  entitlements(entitlements) {
    this.token = {
      ...this.token,
      entitlements: new Set(entitlements),
    };
    return this;
  }

  removeEntitlement(entitlement) {
    this.token.entitlements.delete(entitlement);
    return this;
  }

  // serialization methods

  userInfo() {
    const result = { ...this.token };
    delete result.entitlements;
    return result;
  }

  sign() {
    const result = {
      ...this.token,
      entitlements: [...this.token.entitlements],
    };
    return jwt.sign(result, apiTokenSecret());
  }

  // boolean checks

  hasEntitlement(entitlement) {
    return this.token.entitlements.has(entitlement);
  }

  isLoggedIn() {
    return this.token.isLoggedIn;
  }

  isReadingRoom() {
    return this.token.isReadingRoom;
  }

  isSuperUser() {
    return this.token.isSuperUser;
  }
}

module.exports = ApiToken;
