// Add all user scopes to the API Token's entitlements claim
// The Scopes object maps scopes to functions that check
// if the user has that scope.

const Scopes = {
  "read:Public": () => true,
  "read:Published": () => true,
  "read:Institution": (user) =>
    user.isSuperUser() || user.isInstitution() || user.isReadingRoom(),
  "read:Private": (user) => user.isSuperUser() || user.isReadingRoom(),
  "read:Unpublished": (user) => user.isSuperUser(),
  chat: (user) => user.isLoggedIn(),
};

const addScopes = (apiToken) => {
  for (const [scope, fn] of Object.entries(Scopes)) {
    if (fn(apiToken)) {
      apiToken.addScope(scope);
    }
  }
  return apiToken;
};

module.exports = { addScopes };
