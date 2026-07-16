'use strict';
function createHandlers(database) {
  return {
    'clubs:list': payload => database.listClubs(payload || {}),
    'clubs:filters': () => database.filters(),
    'players:search': payload => database.searchPlayers(payload?.query,payload?.limit),
    'players:travelers': payload => database.travelers(payload?.limit),
    'players:filters': () => database.playerFilters(),
    'players:catalog': payload => database.playerCatalog(payload || {}),
    'players:common': payload => database.commonPlayers(payload?.clubA,payload?.clubB,{ includeUnverified: false }),
    'game:create-round': payload => database.createRound(payload?.excludedPairs || [],payload?.difficulty || 'normal'),
    'game:create-country-round': payload => database.createCountryRound(payload?.excludedPairs || [],payload?.difficulty || 'normal'),
    'grid:create': payload => database.createGrid(payload?.difficulty || 'normal'),
    'data:status': () => database.status(),
    'data:update': () => ({ started:false, message:'Paketli temel veri çevrimdışı kullanıma hazır. Geliştirici güncellemesi için npm run data:update komutunu kullanın.' }),
    'cache:clear': () => ({ cleared:true })
  };
}
module.exports = { createHandlers };
