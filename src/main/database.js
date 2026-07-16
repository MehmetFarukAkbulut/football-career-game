'use strict';
const { DatabaseSync } = require('node:sqlite');
const { normalizeText, canonicalPair } = require('../shared/normalize');

class AppError extends Error {
  constructor(code, message) { super(message); this.name = 'AppError'; this.code = code; }
}

class FootballDatabase {
  constructor(file, options = {}) {
    this.db = new DatabaseSync(file, { readOnly: options.readOnly !== false });
    this.db.exec('PRAGMA foreign_keys=ON; PRAGMA query_only=ON;');
  }
  close() { this.db.close(); }
  status() {
    const counts = {};
    for (const table of ['clubs','players','player_clubs']) counts[table] = this.db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count;
    counts.verifiedFirstTeam = this.db.prepare('SELECT COUNT(*) count FROM player_clubs WHERE verified_first_team=1').get().count;
    counts.unverified = counts.player_clubs - counts.verifiedFirstTeam;
    const version = this.db.prepare("SELECT value FROM metadata WHERE key='version'").get()?.value || 'bilinmiyor';
    const updatedAt = this.db.prepare("SELECT value FROM metadata WHERE key='updated_at'").get()?.value || null;
    return { ready: true, version, updatedAt, counts, offline: true };
  }
  listClubs(filters = {}) {
    const where = [], params = [];
    if (filters.country) { where.push('country=?'); params.push(filters.country); }
    if (filters.league) { where.push('league=?'); params.push(filters.league); }
    if (filters.gamePool) where.push('active_game_pool=1');
    if (filters.query && normalizeText(filters.query).length >= 2) { where.push('(normalized_name LIKE ? OR aliases_json LIKE ?)'); const q = `%${normalizeText(filters.query)}%`; params.push(q,q); }
    return this.db.prepare(`SELECT id,slug,name,country,league,logo_url logo,wikidata_id wikidataId FROM clubs ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY country,league,name LIMIT 5000`).all(...params);
  }
  filters() {
    return { countries: this.db.prepare('SELECT DISTINCT country FROM clubs ORDER BY country').all().map(x=>x.country), leagues: this.db.prepare('SELECT DISTINCT league,country FROM clubs ORDER BY country,league').all() };
  }
  searchPlayers(query, limit = 12) {
    const q = normalizeText(query);
    if (q.length < 2) return [];
    return this.db.prepare(`SELECT id,name,birth_date birthDate,photo_url photo,
      (SELECT COUNT(DISTINCT pc.club_id) FROM player_clubs pc WHERE pc.player_id=players.id AND pc.verified_first_team=1) clubCount,
      (SELECT GROUP_CONCAT(name,' • ') FROM (SELECT DISTINCT c.name FROM player_clubs pc JOIN clubs c ON c.id=pc.club_id WHERE pc.player_id=players.id AND pc.verified_first_team=1 ORDER BY c.name)) clubs
      FROM players WHERE normalized_name LIKE ? OR normalized_name LIKE ?
      ORDER BY clubCount DESC,(SELECT COALESCE(SUM(pc.appearances),0) FROM player_clubs pc WHERE pc.player_id=players.id AND pc.verified_first_team=1) DESC,CASE WHEN normalized_name LIKE ? THEN 0 ELSE 1 END,name LIMIT ?`)
      .all(`${q}%`, `% ${q}%`, `${q}%`, Math.min(Math.max(Number(limit)||12,1),50));
  }
  travelers(limit = 100) {
    return this.db.prepare(`SELECT p.id,p.name,p.birth_date birthDate,p.photo_url photo,COUNT(DISTINCT pc.club_id) clubCount,GROUP_CONCAT(DISTINCT c.name) clubs
      FROM players p JOIN player_clubs pc ON pc.player_id=p.id AND pc.verified_first_team=1 JOIN clubs c ON c.id=pc.club_id
      GROUP BY p.id,p.name,p.birth_date,p.photo_url HAVING clubCount>1 ORDER BY clubCount DESC,p.name LIMIT ?`).all(Math.min(Math.max(Number(limit)||100,1),250));
  }
  playerFilters() {
    return { nationalities: this.db.prepare("SELECT nationality,COUNT(*) count FROM players WHERE nationality IS NOT NULL AND TRIM(nationality)<>'' GROUP BY nationality ORDER BY nationality").all() };
  }
  playerCatalog(filters = {}) {
    const where=["EXISTS(SELECT 1 FROM player_clubs pc WHERE pc.player_id=p.id AND pc.verified_first_team=1)"],params=[];
    const query=normalizeText(filters.query);
    if(query){where.push("(p.normalized_name LIKE ? OR EXISTS(SELECT 1 FROM player_clubs pc JOIN clubs c ON c.id=pc.club_id WHERE pc.player_id=p.id AND pc.verified_first_team=1 AND c.normalized_name LIKE ?))");params.push(`%${query}%`,`%${query}%`);}
    if(filters.nationality){where.push('p.nationality=?');params.push(String(filters.nationality));}
    if(Number.isInteger(Number(filters.clubId))&&Number(filters.clubId)>0){where.push('EXISTS(SELECT 1 FROM player_clubs selected_pc WHERE selected_pc.player_id=p.id AND selected_pc.club_id=? AND selected_pc.verified_first_team=1)');params.push(Number(filters.clubId));}
    const sort={clubs:'clubCount DESC,p.name',name:'p.name',appearances:'appearances DESC,p.name',birth:'p.birth_date DESC,p.name'}[filters.sort]||'appearances DESC,p.name';
    const page=Math.max(Number(filters.page)||1,1),pageSize=Math.min(Math.max(Number(filters.pageSize)||100,12),100),offset=(page-1)*pageSize;
    const base=`FROM players p WHERE ${where.join(' AND ')}`;
    const total=this.db.prepare(`SELECT COUNT(*) count ${base}`).get(...params).count;
    const players=this.db.prepare(`SELECT p.id,p.name,p.birth_date birthDate,p.nationality,p.photo_url photo,
      (SELECT COUNT(DISTINCT pc.club_id) FROM player_clubs pc WHERE pc.player_id=p.id AND pc.verified_first_team=1) clubCount,
      (SELECT COALESCE(SUM(pc.appearances),0) FROM player_clubs pc WHERE pc.player_id=p.id AND pc.verified_first_team=1) appearances,
      (SELECT GROUP_CONCAT(name,' • ') FROM (SELECT DISTINCT c.name FROM player_clubs pc JOIN clubs c ON c.id=pc.club_id WHERE pc.player_id=p.id AND pc.verified_first_team=1 ORDER BY c.name)) clubs
      ${base} ORDER BY ${sort} LIMIT ? OFFSET ?`).all(...params,pageSize,offset);
    return {players,total,page,pages:Math.max(1,Math.ceil(total/pageSize)),pageSize};
  }
  countryClubPlayers(nationality,clubId) {
    const id=Number(clubId);if(!nationality||!Number.isInteger(id))throw new AppError('INVALID_INPUT','Geçerli ülke ve kulüp seçin.');
    const club=this.db.prepare('SELECT id,name,league,country,logo_url logo FROM clubs WHERE id=?').get(id);if(!club)throw new AppError('CLUB_NOT_FOUND','Kulüp bulunamadı.');
    const players=this.db.prepare(`SELECT p.id,p.name,p.birth_date birthDate,p.nationality,p.photo_url photo,pc.start_date periodsA,pc.end_date periodsB,1 verified
      FROM players p JOIN player_clubs pc ON pc.player_id=p.id AND pc.club_id=? AND pc.verified_first_team=1 WHERE p.nationality=? ORDER BY p.name`).all(id,String(nationality));
    return {clubs:[{id:`country:${nationality}`,name:String(nationality),league:'Vatandaşlık',country:'Ülke'},club],players,count:players.length,verifiedCount:players.length,candidateCount:0,pairKey:`country:${nationality}:${id}`};
  }
  createCountryRound(excludedPairs=[],difficulty='normal') {
    const excluded=new Set(excludedPairs);
    const rows=this.db.prepare(`SELECT p.nationality,pc.club_id,COUNT(DISTINCT p.id) answer_count FROM players p JOIN player_clubs pc ON pc.player_id=p.id AND pc.verified_first_team=1 JOIN clubs c ON c.id=pc.club_id AND c.active_game_pool=1 WHERE p.nationality IS NOT NULL AND TRIM(p.nationality)<>'' GROUP BY p.nationality,pc.club_id`).all();
    let candidates=rows.filter(x=>!excluded.has(`country:${x.nationality}:${x.club_id}`));if(difficulty==='easy')candidates=candidates.filter(x=>x.answer_count>=6);else if(difficulty==='hard')candidates=candidates.filter(x=>x.answer_count<=2);else candidates=candidates.filter(x=>x.answer_count>=2);
    if(!candidates.length)throw new AppError('NO_ROUND','Seçilen ayarlara uygun ülke-kulüp çifti kalmadı.');
    const picked=candidates[Math.floor(Math.random()*candidates.length)],result=this.countryClubPlayers(picked.nationality,picked.club_id);
    return {...result,difficulty:picked.answer_count>=6?'kolay':picked.answer_count<=2?'zor':'normal'};
  }
  commonPlayers(clubA, clubB, options = {}) {
    const a = Number(clubA), b = Number(clubB);
    if (!Number.isInteger(a) || !Number.isInteger(b)) throw new AppError('INVALID_INPUT','Geçerli iki kulüp seçin.');
    if (a === b) throw new AppError('SAME_CLUB','Aynı kulüp iki kez seçilemez.');
    const clubs = this.db.prepare('SELECT id,name,league,country,logo_url logo FROM clubs WHERE id IN (?,?) ORDER BY CASE id WHEN ? THEN 0 ELSE 1 END').all(a,b,a);
    if (clubs.length !== 2) throw new AppError('CLUB_NOT_FOUND','Kulüp verisi eşleştirilemedi. Yerel veriyi güncelleyin.');
    const verifiedClause = options.includeUnverified ? '' : 'AND pc1.verified_first_team=1 AND pc2.verified_first_team=1';
    const players = this.db.prepare(`SELECT p.id,p.name,p.birth_date birthDate,p.photo_url photo,
      GROUP_CONCAT(DISTINCT COALESCE(pc1.start_date,'?') || '–' || COALESCE(pc1.end_date,'devam')) periodsA,
      GROUP_CONCAT(DISTINCT COALESCE(pc2.start_date,'?') || '–' || COALESCE(pc2.end_date,'devam')) periodsB,
      MAX(CASE WHEN pc1.verified_first_team=1 AND pc2.verified_first_team=1 THEN 1 ELSE 0 END) verified,
      GROUP_CONCAT(DISTINCT pc1.data_source) || ' / ' || GROUP_CONCAT(DISTINCT pc2.data_source) dataSources
      FROM players p JOIN player_clubs pc1 ON pc1.player_id=p.id AND pc1.club_id=?
      JOIN player_clubs pc2 ON pc2.player_id=p.id AND pc2.club_id=?
      WHERE 1=1 ${verifiedClause}
      GROUP BY p.id,p.name,p.birth_date,p.photo_url ORDER BY name`).all(a,b);
    const verifiedCount = players.filter(player=>player.verified===1).length;
    return { clubs, players, count: players.length, verifiedCount, candidateCount: players.length-verifiedCount, source: 'Yerel SQLite', pairKey: canonicalPair(a,b) };
  }
  createRound(excludedPairs = [], difficulty = 'normal') {
    const excluded = new Set(excludedPairs);
    const rows = this.db.prepare(`SELECT pc1.club_id a,pc2.club_id b,COUNT(DISTINCT pc1.player_id) answer_count
      FROM player_clubs pc1 JOIN player_clubs pc2 ON pc1.player_id=pc2.player_id AND pc1.club_id<pc2.club_id
      JOIN clubs a ON a.id=pc1.club_id AND a.active_game_pool=1 JOIN clubs b ON b.id=pc2.club_id AND b.active_game_pool=1
      WHERE pc1.verified_first_team=1 AND pc2.verified_first_team=1 GROUP BY pc1.club_id,pc2.club_id`).all();
    let candidates = rows.filter(r => !excluded.has(canonicalPair(r.a,r.b)));
    if (difficulty === 'easy') candidates = candidates.filter(r=>r.answer_count>=6);
    if (difficulty === 'hard') candidates = candidates.filter(r=>r.answer_count<=3);
    if (!candidates.length) throw new AppError('NO_ROUND','Seçilen ayarlara uygun yeni kulüp çifti kalmadı.');
    const picked = candidates[Math.floor(Math.random()*candidates.length)];
    return { ...this.commonPlayers(picked.a,picked.b,{includeUnverified:false}), difficulty: picked.answer_count >= 6 ? 'kolay' : picked.answer_count <= 3 ? 'zor' : 'normal' };
  }
  createGrid(difficulty = 'normal') {
    const minAnswers=difficulty==='easy'?3:difficulty==='normal'?2:1,knownOnly=difficulty==='easy'?'AND a.wikidata_id IS NOT NULL AND b.wikidata_id IS NOT NULL':'';
    const pairs=this.db.prepare(`SELECT pc1.club_id a,pc2.club_id b,COUNT(DISTINCT pc1.player_id) answer_count FROM player_clubs pc1 JOIN player_clubs pc2 ON pc1.player_id=pc2.player_id AND pc1.club_id<pc2.club_id
      JOIN clubs a ON a.id=pc1.club_id AND a.active_game_pool=1 JOIN clubs b ON b.id=pc2.club_id AND b.active_game_pool=1
      WHERE pc1.verified_first_team=1 AND pc2.verified_first_team=1 ${knownOnly} GROUP BY pc1.club_id,pc2.club_id HAVING answer_count>=?`).all(minAnswers);
    const neighbors=new Map(),link=(a,b)=>{if(!neighbors.has(a))neighbors.set(a,new Set());neighbors.get(a).add(b);};for(const {a,b} of pairs){link(a,b);link(b,a);}
    const ids=[...neighbors.keys()].filter(id=>neighbors.get(id).size>=5);let rows,cols;
    for(let attempt=0;attempt<10000&&!cols;attempt++){rows=[...ids].sort(()=>Math.random()-.5).slice(0,3);if(new Set(rows).size<3)continue;const common=[...neighbors.get(rows[0])].filter(id=>!rows.includes(id)&&neighbors.get(rows[1])?.has(id)&&neighbors.get(rows[2])?.has(id));if(common.length>=3)cols=common.sort(()=>Math.random()-.5).slice(0,3);}
    if(!cols)throw new AppError('NO_GRID','Dokuz geçerli eşleşme içeren yeni bir ızgara oluşturulamadı.');
    const clubRows=this.db.prepare('SELECT id,name,logo_url logo,league,country FROM clubs WHERE id IN (?,?,?)').all(...rows),clubCols=this.db.prepare('SELECT id,name,logo_url logo,league,country FROM clubs WHERE id IN (?,?,?)').all(...cols);
    const ordered=(list,order)=>order.map(id=>list.find(c=>c.id===id));
    const cells=[];for(const row of rows)for(const col of cols)cells.push({key:`${row}:${col}`,row,col,answers:this.commonPlayers(row,col,{includeUnverified:false}).players});
    return {rows:ordered(clubRows,rows),cols:ordered(clubCols,cols),cells};
  }
}
module.exports = { FootballDatabase, AppError };
