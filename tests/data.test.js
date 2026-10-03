'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const BCF=require('../data.js');
const initial=()=>BCF.initialData();
const roster=initial().seasons['2026-2027'].roster;
function match(overrides={}){
  return {id:'4173',date:'2026-09-26',opponent:'Roncq US',venue:'home',for:60,against:50,
    periods:[{for:15,against:10},{for:15,against:15},{for:15,against:10},{for:15,against:15}],
    shots:{two:20,three:5,ftm:5,fta:8,fouls:15},players:[],...overrides};
}
test('trombinoscope : 11 joueuses (Leila retirée), coach exclu, saisons séparées',()=>{
  const d=initial();
  assert.equal(roster.length,11);
  assert.equal(roster.some(p=>p.last==='Crepin'),false);
  assert.equal(roster.find(p=>p.captain).id,'alexia');
  assert.equal(roster.some(p=>p.id==='leila'),false);
  assert.equal(d.seasons['2025-2026'].roster.length,0);
  for(const s of BCF.SEASONS) assert.equal(d.seasons[s].matches.length,0);
  assert.equal(BCF.validateData(d).seasons['2026-2027'].roster.length,11);
});
test('absence de données : pas de zéro inventé ni NaN',()=>{
  const s=BCF.summary([]);
  assert.equal(s.attack,null);assert.equal(s.ftPct,null);assert.equal(s.fouls,null);
  assert.equal(BCF.playerStats([],'alexia').pts,null);
  assert.ok(BCF.quarterStats([]).every(q=>q.bcf.value===null));
});
test('validation d’un match et indicateurs cohérents',()=>{
  const m=BCF.validateMatch(match(),roster);
  const s=BCF.summary([m]);
  assert.equal(s.attack,60);assert.equal(s.defense,50);assert.equal(s.wins,1);
  assert.equal(s.ftPct,62.5);assert.equal(s.fouls,15);
  assert.equal(s.two,20);assert.equal(s.three,5);
  assert.deepEqual(BCF.quarterStats([m]).map(q=>q.bcf.value),[15,15,15,15]);
});
test('moyennes pondérées LF et couverture des données manquantes',()=>{
  const a=BCF.validateMatch(match(),roster);
  const b=BCF.validateMatch(match({id:'b',shots:{two:25,three:0,ftm:10,fta:10,fouls:10}}),roster);
  const c=BCF.validateMatch(match({id:'c',shots:null,periods:null}),roster);
  const s=BCF.summary([a,b,c]);
  assert.equal(s.ftPct,100*15/18);assert.equal(s.fouls,12.5);assert.equal(s.shotCount,2);
  assert.equal(BCF.quarterStats([a,c])[0].bcf.value,15);
  assert.equal(BCF.quarterStats([a,c])[0].bcf.count,1);
  assert.equal(BCF.quarterStats([a,c],'ft_pct')[0].bcf.value,null);
});
test('pourcentage LF par période calculé avec les totaux',()=>{
  const a=match(),b=match({id:'b'});
  a.periods[0].bcf={ftm:1,fta:2,fouls:1};
  b.periods[0].bcf={ftm:9,fta:10,fouls:2};
  assert.equal(BCF.quarterStats([a,b],'ft_pct')[0].bcf.value,100*10/12);
  assert.equal(BCF.quarterStats([a,b],'fouls')[0].bcf.value,1.5);
  assert.equal(BCF.quarterStats([a,b],'ft_pct')[0].opp.value,null);
});
test('validation : scores, tirs, dates, types et doublons',()=>{
  for(const overrides of [
    {for:61}, {for:50}, {date:'2026-02-30'}, {for:'60'}, {for:-1},
    {periods:[]}, {shots:{two:20,three:5,ftm:5,fta:4,fouls:15}},
    {shots:{two:20,three:5,ftm:5,fta:8,fouls:'inconnu'}},
    {players:[{playerId:'inconnue',pts:2,min:null}]},
    {players:[{playerId:'alexia',pts:61,min:null}]},
    {players:[{playerId:'alexia',pts:1},{playerId:'alexia',pts:1}]},
    {players:[{playerId:'alexia',pts:2,min:41}]}
  ]) assert.throws(()=>BCF.validateMatch(match(overrides),roster));
  const d=initial();d.seasons['2026-2027'].matches=[match(),match()];
  assert.throws(()=>BCF.validateData(d),/double/);
});
test('statistiques individuelles : ne pas compter les absences comme zéro',()=>{
  const line={playerId:'alexia',pts:10,min:20,shots:{two:4,three:0,ftm:2,fta:3,fouls:1}};
  const a=BCF.validateMatch(match({players:[line]}),roster);
  const b=BCF.validateMatch(match({id:'b',players:[{playerId:'alexia',pts:0,min:null,shots:null}]}),roster);
  const c=BCF.validateMatch(match({id:'c'}),roster);
  const s=BCF.playerStats([a,b,c],'alexia');
  assert.equal(s.count,2);assert.equal(s.pts,5);assert.equal(s.min,20);
  assert.equal(s.two,4);assert.equal(s.ftm,2);assert.equal(s.fta,3);assert.equal(s.shotCount,1);
  assert.throws(()=>BCF.validateMatch(match({players:[{...line,pts:9}]}),roster),/points/);
});
test('prolongations distinctes et égalité réglementaire vérifiée',()=>{
  const m=BCF.validateMatch(match({for:65,against:60,shots:null,periods:[{for:15,against:15},{for:15,against:15},{for:15,against:15},{for:10,against:10},{for:10,against:5}],players:[{playerId:'alexia',pts:10,min:45,shots:null}]}),roster);
  assert.equal(BCF.quarterStats([m])[4].label,'PR 1');
  assert.equal(BCF.quarterStats([m])[4].bcf.value,10);
  m.periods[0].for=16;m.periods[4].for=9;
  assert.throws(()=>BCF.validateMatch(m,roster),/égalité/);
});
test('nomenclature : les trois types et les deux terrains',()=>{
  for(const type of ['feuillematch','resume','positiontir']){
    assert.deepEqual(BCF.parseFilename(`${type}_0059_DF2_A_4173_FLINES_LEZ_RACHES_BC_RONCQ_U_S.pdf`),{type,id:'4173',venue:'home',opponent:'RONCQ U S'});
    assert.equal(BCF.parseFilename(`${type}_0059_DF2_A_4173_RONCQ_U_S_FLINES_LEZ_RACHES_BC.pdf`).venue,'away');
  }
  for(const filename of ['test.pdf','resume_0059_DF2_A_4173_INCONNU_RONCQ.pdf','resume_0059_DF2_A_4173_RONCQ_FLINES_LEZ_RACHES_BC_LILLE.pdf','resume_0059_DF2_A_4173_FLINES_LEZ_RACHES_BC_FLINES_LEZ_RACHES_BC.pdf']){
    assert.throws(()=>BCF.parseFilename(filename));
  }
});
test('export/import : aller-retour des deux saisons et notes',()=>{
  const d=initial();d.seasons['2026-2027'].matches=[match()];
  d.seasons['2026-2027'].notes.Roncq='Priorité au rebond';
  d.seasons['2025-2026'].notes.Roncq='Ancienne saison';
  const restored=BCF.validateData(JSON.parse(JSON.stringify(d)));
  assert.equal(restored.seasons['2026-2027'].matches[0].for,60);
  assert.equal(restored.seasons['2025-2026'].matches.length,0);
  assert.notEqual(restored.seasons['2026-2027'].notes.Roncq,restored.seasons['2025-2026'].notes.Roncq);
  assert.throws(()=>BCF.validateData({version:1,seasons:{}}));
  d.seasons['2026-2027'].roster[0].photo='https://example.org/tracking.jpg';
  assert.equal(BCF.validateData(d).seasons['2026-2027'].roster[0].photo,'assets/laurette.jpg');
});
test('les noms de notes spéciaux sont conservés sans modifier les prototypes',()=>{
  const d=initial();
  d.seasons['2026-2027'].notes=JSON.parse('{"__proto__":"texte"}');
  const restored=BCF.validateData(d);
  assert.equal(restored.seasons['2026-2027'].notes.__proto__,'texte');
  assert.equal(Object.getPrototypeOf(restored.seasons['2026-2027'].notes),null);
});
