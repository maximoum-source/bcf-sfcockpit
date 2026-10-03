const test=require('node:test');
const assert=require('node:assert/strict');
const BCF=require('../data');
const archive=require('../history-2025');
const historical=()=>BCF.mergeArchive(BCF.initialData(),archive).database;

test('22 rencontres réelles (19 détaillées + 3 résultats officiels) et 11 joueuses',()=>{
  const d=historical(),past=d.seasons['2025-2026'];
  assert.equal(past.matches.length,22);assert.equal(past.roster.length,11);
  assert.equal(past.matches.some(m=>m.id==='4108'),true);
  assert.equal(d.seasons['2026-2027'].roster.length,11);
  assert.equal(d.seasons['2026-2027'].matches.length,0);
  assert.equal(archive.manifest.length,19);
  for(const entry of archive.manifest){
    assert.equal(entry.files.length,3);
    assert.ok(entry.files.every(f=>/^[a-f0-9]{64}$/.test(f.sha256)));
  }
});
test('indicateurs exacts des documents, avec calcul des LF déduits de la méthodologie e-Marque',()=>{
  const s=BCF.summary(historical().seasons['2025-2026'].matches);
  assert.equal(s.wins,3);assert.equal(s.losses,19);
  assert.equal(s.attack,904/22);assert.equal(s.defense,1391/22);
  assert.equal(s.two,275);assert.equal(s.three,31);assert.equal(s.ftm,132);
  assert.equal(s.two*2+s.three*3+s.ftm,775);
  assert.equal(s.fta,230);assert.ok(Math.abs(s.ftPct - 57.39) < 0.1);assert.equal(s.ftCount,19);
  assert.equal(s.fouls,293/19);
});
test('scores individuels, tirs et périodes recoupés pour les 19 rencontres détaillées',()=>{
  const detailed=historical().seasons['2025-2026'].matches.filter(m=>m.periods!==null);
  assert.equal(detailed.length,19);
  for(const m of detailed){
    assert.equal(m.periods.reduce((s,p)=>s+p.for,0),m.for,m.id);
    assert.equal(m.periods.reduce((s,p)=>s+p.against,0),m.against,m.id);
    assert.equal(m.players.reduce((s,p)=>s+p.pts,0),m.for,m.id);
    assert.equal(m.opponentPlayers.reduce((s,p)=>s+p.pts,0),m.against,m.id);
    for(const [players,shots] of [[m.players,m.shots],[m.opponentPlayers,m.opponentShots]]){
      for(const k of ['two','three','ftm','fouls'])assert.equal(players.reduce((s,p)=>s+p.shots[k],0),shots[k],m.id+' '+k);
      assert.equal(players.reduce((s,p)=>s+p.shots.fta,0),shots.fta,m.id+' fta');
    }
    assert.equal(m.provenance.files.length,3);
  }
});
test('temps sources conservés mais cumuls incohérents exclus des moyennes',()=>{
  const matches=historical().seasons['2025-2026'].matches;
  assert.equal(matches.filter(m=>m.minutesReliable).length,7);
  const dechy=matches.find(m=>m.id==='4086');
  assert.equal(dechy.minutesReliable,false);
  assert.equal(Math.round(dechy.players.reduce((s,p)=>s+(p.min??0),0)*60),246*60+21);
  const s=BCF.playerStats([dechy],'hist-alexia-morival');
  assert.equal(s.min,null);assert.equal(s.pts,11);
  assert.equal(BCF.playerStats(matches,'hist-marie-kazmierowski').minuteCount,6);
});
test('merge additif et idempotent, notes et matchs existants jamais écrasés',()=>{
  const previous=BCF.initialData();
  previous.seasons['2026-2027'].roster[0].position='Meneuse';
  previous.seasons['2025-2026'].notes.Roncq='Note personnelle';
  previous.seasons['2025-2026'].matches=[{id:'4014',date:'2025-09-27',opponent:'Adversaire local',venue:'home',for:10,against:20,players:[]}];
  const result=BCF.mergeArchive(previous,archive);
  assert.equal(result.added,21);assert.deepEqual(result.conflicts,['4014']);
  assert.equal(result.database.seasons['2025-2026'].notes.Roncq,'Note personnelle');
  assert.equal(result.database.seasons['2026-2027'].roster[0].position,'Meneuse');
  assert.equal(result.database.seasons['2025-2026'].matches.find(m=>m.id==='4014').for,10);
  assert.equal(previous.seasons['2025-2026'].matches.length,1);
  const again=BCF.mergeArchive(result.database,archive);
  assert.equal(again.added,0);assert.deepEqual(again.database,result.database);
  again.database.seasons['2025-2026'].matches=again.database.seasons['2025-2026'].matches.filter(m=>m.id!=='4002');
  assert.equal(BCF.mergeArchive(again.database,archive).database.seasons['2025-2026'].matches.length,21);
});
test('statistiques partielles : pourcentage uniquement sur les paires LF connues',()=>{
  const emptyMatches=[];
  const known=BCF.validateMatch({id:'test',date:'2026-04-01',opponent:'Exemple',venue:'home',for:60,against:50,shots:{two:20,three:5,ftm:5,fta:10,fouls:null}},[]);
  const s=BCF.summary([...emptyMatches,known]);
  assert.equal(s.ftPct,50);assert.equal(s.ftCount,1);assert.equal(s.ftPairedMade,5);
  assert.equal(s.ftm,5);
  const matches=historical().seasons['2025-2026'].matches;
  assert.equal(BCF.quarterStats(matches,'ft_pct')[0].bcf.value,null);
});
test('nomenclatures réelles avec réserves et parenthèses',()=>{
  for(const entry of archive.manifest){
    for(const file of entry.files)assert.equal(BCF.parseFilename(file.name).id,entry.id);
  }
});
