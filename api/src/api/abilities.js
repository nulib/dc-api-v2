// Add all user abilities to the API Token's entitlements claim
// The Abilities object maps abilities to functions that check
// if the user has that ability.

const Abilities = {
  "read:Public": () => true,
  "read:Published": () => true,
  "read:Institution": (user) =>
    user.isSuperUser() || user.isInstitution() || user.isReadingRoom(),
  "read:Private": (user) => user.isSuperUser() || user.isReadingRoom(),
  "read:Unpublished": (user) => user.isSuperUser(),
  chat: (user) => user.isLoggedIn(),
};

const addAbilities = (apiToken) => {
  for (const [ability, fn] of Object.entries(Abilities)) {
    if (fn(apiToken)) {
      apiToken.addAbility(ability);
    }
  }
  return apiToken;
};

module.exports = { addAbilities };
