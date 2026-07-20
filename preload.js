'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const invoke = (channel,payload) => ipcRenderer.invoke(channel,payload);
contextBridge.exposeInMainWorld('ikiForma',Object.freeze({
  listClubs: filters=>invoke('clubs:list',filters), clubFilters:()=>invoke('clubs:filters'),
  searchPlayers:(query,limit)=>invoke('players:search',{query,limit}),
  travelers:limit=>invoke('players:travelers',{limit}),
  playerFilters:()=>invoke('players:filters'), playerCatalog:filters=>invoke('players:catalog',filters),
  commonPlayers: payload=>invoke('players:common',payload), createRound:payload=>invoke('game:create-round',payload),
  createCountryRound:payload=>invoke('game:create-country-round',payload),
  createGrid:difficulty=>invoke('grid:create',{difficulty}),
  dataStatus:()=>invoke('data:status'), updateData:()=>invoke('data:update'), clearCache:()=>invoke('cache:clear'),
  openExternal:url=>invoke('external:open',url)
}));

