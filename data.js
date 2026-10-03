(function (root) {
  'use strict';
  const SEASONS = ['2026-2027', '2025-2026'];
  const roster = [
    ['laurette','Laurette','Bosiak',9,'Intérieur (C)','Annotation manuscrite : C.'],
    ['anelene','Anelene','Constant',12,'Ailière forte / pivot (AF, PF)','Annotation manuscrite : Ai, AF.'],
    ['amandine','Amandine','Desmulier',6,'Ailière / ailière forte (Ai, AF)','Annotation manuscrite : PG, Ai.'],
    ['emilie','Emilie','Duval',15,'Meneuse / ailière forte / intérieur (PG, AF, C)','Annotation manuscrite : PG, Ai, AF.'],
    ['camille','Camille','Fauvergue',10,'Intérieur / pivot (C, PF)','Annotation manuscrite : C, PF.'],
    ['marie','Marie','Kazmierowski',4,'Ailière / ailière forte (Ai, AF)','Annotation manuscrite : Ai, AF.'],
    ['oceane','Oceane','Lenoir',8,'Meneuse / ailière / ailière forte (PG, Ai, AF)','Annotation manuscrite : PG, Ai.'],
    ['celia','Celia','Maux',7,'Meneuse / ailière (PG, Ai)','Annotation manuscrite : PG, Ai.'],
    ['ines','Ines','Mbuy Kabuaya-Diondo',13,'Meneuse / ailière / ailière forte (PG, Ai, AF)','Annotation manuscrite : PG, Ai.'],
    ['alexia','Alexia','Morival',14,'Intérieur / pivot (C, PF)','Annotation manuscrite : C, PF (CAP).'],
    ['clara','Clara','Morival',11,'Ailière / ailière forte (Ai, AF)','Annotation manuscrite : AF, PF.']
  ].map(([id,first,last,number,position,annotation]) => ({id,first,last,number,position,annotation,captain:id==='alexia',photo:`assets/${id}.jpg`}));
  function initialData() {
    return {version:1,seasons:{'2026-2027':{roster:structuredClone(roster),matches:[],notes:{}},'2025-2026':{roster:[],matches:[],notes:{}}}};
  }
  function assert(test,message) { if (!test) throw new Error(message); }
  function text(value,label,max=160) {
    assert(typeof value==='string' && value.trim().length>0 && value.length<=max,`${label} : texte requis (maximum ${max} caractères).`);
    return value.trim();
  }
  function number(value,label,max=500,nullable=false) {
    if (nullable && value===null) return null;
    assert(Number.isInteger(value) && value>=0 && value<=max,`${label} : entier entre 0 et ${max} requis.`);
    return value;
  }
  function validateShots(value,label) {
    if (value===null || value===undefined) return null;
    const result={};
    for(const key of ['two','three','ftm','fta','fouls']) result[key]=number(value[key],`${label} / ${key}`,500,true);
    assert(result.fta===null || result.ftm===null || result.ftm<=result.fta,`${label} : LF réussis supérieurs aux LF tentés.`);
    return Object.values(result).every(v=>v===null)?null:result;
  }
  function shotPoints(shots) {
    return shots && ['two','three','ftm'].every(k=>shots[k]!==null)?shots.two*2+shots.three*3+shots.ftm:null;
  }
  function validateProvenance(value) {
    if(value==null)return null;
    assert(value && typeof value==='object','Provenance invalide.');
    assert(Array.isArray(value.files) && value.files.length<=10,'Liste de sources invalide.');
    assert(Array.isArray(value.warnings) && value.warnings.length<=20,'Avertissements invalides.');
    return {origin:text(value.origin,'Origine'),files:value.files.map(f=>text(f,'Fichier source',250)),warnings:value.warnings.map(w=>text(w,'Avertissement',1000))};
  }
  function validateMatch(value,players) {
    assert(value && typeof value==='object','Match invalide.');
    const id=text(value.id,'Identifiant match',80);
    const date=text(value.date,'Date',10);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10)===date,'Date de match invalide.');
    const opponent=text(value.opponent,'Adversaire',100);
    assert(['home','away'].includes(value.venue),'Lieu : home ou away requis.');
    const forScore=number(value.for,'Score BCF'),against=number(value.against,'Score adverse');
    assert(forScore!==against,'Un match terminé ne peut pas être nul : renseignez les prolongations.');
    let periods=null;
    if(value.periods!=null){
      assert(Array.isArray(value.periods) && value.periods.length>=4 && value.periods.length<=12,'Renseignez quatre quart-temps, puis les prolongations éventuelles.');
      periods=value.periods.map((p,i)=>{
        assert(p && typeof p==='object',`Période ${i+1} invalide.`);
        const result={for:number(p.for,`Période ${i+1} BCF`),against:number(p.against,`Période ${i+1} adverse`)};
        for(const side of ['bcf','opp']) {
          result[side]=null;
          if(p[side]!=null) {
            result[side]={};
            for(const k of ['fouls','ftm','fta']) result[side][k]=number(p[side][k],`Période ${i+1} / ${side} / ${k}`,500,true);
            assert(result[side].fta===null || result[side].ftm===null || result[side].ftm<=result[side].fta,'LF de période incohérents.');
          }
        }
        return result;
      });
      assert(periods.reduce((s,p)=>s+p.for,0)===forScore && periods.reduce((s,p)=>s+p.against,0)===against,'La somme des périodes doit correspondre au score final.');
      if(periods.length>4){
        let a=0,b=0;
        periods.forEach((p,i)=>{a+=p.for;b+=p.against;if(i>=3 && i<periods.length-1) assert(a===b,'Une prolongation doit être précédée d’une égalité.');});
      }
    }
    const shots=validateShots(value.shots,'Statistiques BCF');
    if(shotPoints(shots)!==null) assert(shotPoints(shots)===forScore,'Les tirs BCF ne correspondent pas au score final.');
    const lines=value.players??[];
    assert(Array.isArray(lines) && lines.length<=100,'Statistiques individuelles invalides.');
    const seen=new Set();
    const playerLines=lines.map(line=>{
      assert(line && typeof line==='object','Ligne joueuse invalide.');
      const playerId=text(line.playerId,'Identifiant joueuse',80);
      assert(players.some(p=>p.id===playerId),`Joueuse inconnue : ${playerId}. Importez son effectif avec ses matchs.`);
      assert(!seen.has(playerId),'Joueuse en double dans un match.'); seen.add(playerId);
      const pts=number(line.pts,'Points joueuse');
      const min=line.min??null;
      assert(min===null || (typeof min==='number' && Number.isFinite(min) && min>=0 && min<=40+Math.max(0,(periods?.length??4)-4)*5),'Minutes invalides (renseignez les périodes pour une prolongation).');
      const detail=validateShots(line.shots,'Tirs joueuse');
      if(shotPoints(detail)!==null) assert(shotPoints(detail)===pts,'Les tirs d’une joueuse ne correspondent pas à ses points.');
      return {playerId,pts,min,shots:detail};
    });
    assert(playerLines.reduce((s,p)=>s+p.pts,0)<=forScore,'Les points individuels dépassent le score BCF.');
    if(shots) for(const k of ['two','three','ftm','fta','fouls']) if(shots[k]!==null) assert(playerLines.reduce((s,p)=>s+(p.shots?.[k]??0),0)<=shots[k],`Total individuel ${k} supérieur au total BCF.`);
    if(shots && periods) for(const k of ['ftm','fta','fouls']) if(shots[k]!==null && periods.every(p=>p.bcf?.[k]!=null)) assert(periods.reduce((s,p)=>s+p.bcf[k],0)===shots[k],`Total par période ${k} différent du total BCF.`);
    const opponentShots=validateShots(value.opponentShots,'Statistiques adverses');
    if(shotPoints(opponentShots)!==null) assert(shotPoints(opponentShots)===against,'Les tirs adverses ne correspondent pas au score final.');
    const opponentLines=value.opponentPlayers??[];
    assert(Array.isArray(opponentLines) && opponentLines.length<=100,'Effectif adverse invalide.');
    const opponentPlayers=opponentLines.map(p=>{
      const detail=validateShots(p.shots,'Tirs adverses individuels'),pts=number(p.pts,'Points adverses individuels');
      const min=p.min??null;
      assert(min===null || (typeof min==='number' && Number.isFinite(min) && min>=0 && min<=40+Math.max(0,(periods?.length??4)-4)*5),'Minutes adverses invalides.');
      if(shotPoints(detail)!==null) assert(shotPoints(detail)===pts,'Points adverses individuels incohérents.');
      return {name:text(p.name,'Nom adverse',160),number:number(p.number,'Numéro adverse',99,true),pts,min,shots:detail};
    });
    assert(new Set(opponentPlayers.map(p=>p.name)).size===opponentPlayers.length,'Joueuse adverse en double.');
    assert(opponentPlayers.reduce((s,p)=>s+p.pts,0)<=against,'Les points individuels adverses dépassent le score adverse.');
    if(opponentShots) for(const k of ['two','three','ftm','fta','fouls']) if(opponentShots[k]!==null) assert(opponentPlayers.reduce((s,p)=>s+(p.shots?.[k]??0),0)<=opponentShots[k],`Total individuel adverse ${k} supérieur au total adverse.`);
    for(const flag of ['minutesReliable','opponentMinutesReliable']) assert(value[flag]===undefined || typeof value[flag]==='boolean',`${flag} doit être un booléen.`);
    const maximumTeamSeconds=5*(40+Math.max(0,(periods?.length??4)-4)*5)*60;
    if(value.minutesReliable!==false) assert(Math.round(playerLines.reduce((s,p)=>s+(p.min??0),0)*60)<=maximumTeamSeconds,'Cumul de minutes BCF supérieur au temps disponible : corrigez les minutes ou excluez-les des moyennes.');
    if(value.opponentMinutesReliable!==false) assert(Math.round(opponentPlayers.reduce((s,p)=>s+(p.min??0),0)*60)<=maximumTeamSeconds,'Cumul de minutes adverses supérieur au temps disponible.');
    return {id,date,opponent,venue:value.venue,for:forScore,against,periods,shots,players:playerLines,opponentShots,opponentPlayers,
      minutesReliable:value.minutesReliable??true,opponentMinutesReliable:value.opponentMinutesReliable??true,provenance:validateProvenance(value.provenance)};
  }
  function validateData(value) {
    assert(value && value.version===1 && value.seasons && typeof value.seasons==='object','Format attendu : { version: 1, seasons: { … } }.');
    assert(Object.keys(value.seasons).length===2 && SEASONS.every(s=>Object.hasOwn(value.seasons,s)),'Les deux saisons 2026-2027 et 2025-2026 sont requises.');
    assert(value.imports===undefined || (Array.isArray(value.imports) && value.imports.length<=100),'Historique des imports invalide.');
    const result={version:1,imports:(value.imports??[]).map(i=>text(i,'Lot importé')),seasons:{}};
    for(const season of SEASONS){
      const data=value.seasons[season];
      assert(data && Array.isArray(data.roster) && data.roster.length<=100,'Effectif invalide (100 personnes maximum).');
      const ids=new Set();
      const players=data.roster.map(p=>{
        assert(p && typeof p==='object','Fiche joueuse invalide.');
        const id=text(p.id,'Identifiant joueuse',80);
        assert(!ids.has(id),'Identifiant joueuse en double.');ids.add(id);
        assert(typeof p.captain==='boolean','Le champ captain doit être un booléen.');
        const known=roster.find(r=>r.id===id && r.first===p.first && r.last===p.last);
        return {id,first:text(p.first,'Prénom',80),last:text(p.last,'Nom',100),number:number(p.number,'Numéro',99,true),position:text(p.position,'Poste'),annotation:typeof p.annotation==='string'?p.annotation.slice(0,1000):'',captain:p.captain,photo:known?known.photo:null};
      });
      assert(Array.isArray(data.matches) && data.matches.length<=1000,'Liste de matchs invalide (1 000 maximum).');
      const matchIds=new Set();
      const matches=data.matches.map(m=>{
        const match=validateMatch(m,players);
        assert(!matchIds.has(match.id),'Identifiant match en double.');matchIds.add(match.id);return match;
      });
      assert(data.notes && typeof data.notes==='object' && !Array.isArray(data.notes),'Notes invalides.');
      const notes=Object.create(null);
      for(const [key,note] of Object.entries(data.notes)){
        text(key,'Adversaire',100);
        assert(typeof note==='string' && note.length<=20000,'Note trop longue (20 000 caractères maximum).');
        notes[key]=note;
      }
      result.seasons[season]={roster:players,matches,notes};
    }
    return result;
  }
  function summary(matches) {
    const count=matches.length;
    const withShots=matches.filter(m=>m.shots);
    const known=k=>withShots.filter(m=>m.shots[k]!=null);
    const total=k=>known(k).length?known(k).reduce((s,m)=>s+m.shots[k],0):null;
    const freeThrows=withShots.filter(m=>m.shots.ftm!==null && m.shots.fta!==null);
    const ftMade=freeThrows.reduce((s,m)=>s+m.shots.ftm,0),ftAttempts=freeThrows.reduce((s,m)=>s+m.shots.fta,0);
    return {count,wins:matches.filter(m=>m.for>m.against).length,losses:matches.filter(m=>m.for<m.against).length,
      attack:count?matches.reduce((s,m)=>s+m.for,0)/count:null,defense:count?matches.reduce((s,m)=>s+m.against,0)/count:null,
      shotCount:withShots.length,two:total('two'),three:total('three'),ftm:total('ftm'),fta:total('fta'),
      foulCount:known('fouls').length,ftCount:freeThrows.length,ftPairedMade:ftMade,ftPairedAttempts:ftAttempts,
      fouls:known('fouls').length?total('fouls')/known('fouls').length:null,ftPct:ftAttempts?100*ftMade/ftAttempts:null};
  }
  function quarterStats(matches,metric='points'){
    const count=Math.max(4,...matches.map(m=>m.periods?.length??0));
    return Array.from({length:count},(_,i)=>{
      const periods=matches.map(m=>m.periods?.[i]).filter(Boolean);
      const calc=side=>{
        const list=metric==='points'?periods:periods.filter(p=>metric==='ft_pct'?p[side]?.ftm!=null && p[side]?.fta!=null:p[side]?.[metric]!=null);
        if(!list.length) return {value:null,count:0};
        if(metric==='ft_pct'){
          const made=list.reduce((s,p)=>s+p[side].ftm,0),attempted=list.reduce((s,p)=>s+p[side].fta,0);
          return {value:attempted?100*made/attempted:null,count:list.length};
        }
        return {value:list.reduce((s,p)=>s+(metric==='points'?p[side==='bcf'?'for':'against']:p[side][metric]),0)/list.length,count:list.length};
      };
      return {label:i<4?`QT ${i+1}`:`PR ${i-3}`,bcf:calc('bcf'),opp:calc('opp')};
    });
  }
  function playerStats(matches,id){
    const lines=matches.flatMap(m=>m.players.filter(p=>p.playerId===id).map(p=>({...p,min:m.minutesReliable===false?null:p.min})));
    return lineStats(lines);
  }
  function lineStats(lines){
    const shots=lines.filter(p=>p.shots),minutes=lines.filter(p=>p.min!=null);
    const known=k=>shots.filter(p=>p.shots[k]!=null);
    const sum=k=>known(k).length?known(k).reduce((s,p)=>s+p.shots[k],0):null;
    const average=k=>known(k).length?sum(k)/known(k).length:null;
    const paired=shots.filter(p=>p.shots.ftm!==null && p.shots.fta!==null);
    const attempts=paired.reduce((s,p)=>s+p.shots.fta,0);
    const totalPts=lines.length?lines.reduce((s,p)=>s+p.pts,0):0;
    return {count:lines.length,minuteCount:minutes.length,ptsTotal:totalPts,pts:lines.length?totalPts/lines.length:null,min:minutes.length?minutes.reduce((s,p)=>s+p.min,0)/minutes.length:null,
      shotCount:shots.length,two:average('two'),three:average('three'),
      ftm:sum('ftm'),fta:sum('fta'),ftPct:attempts?100*paired.reduce((s,p)=>s+p.shots.ftm,0)/attempts:null,fouls:average('fouls')};
  }
  function mergeArchive(value,archive){
    const next=validateData(value);
    if(next.imports.includes(archive.id)) return {database:next,added:0,conflicts:[]};
    assert(SEASONS.includes(archive.season),'Saison du lot inconnue.');
    const candidate=initialData();candidate.seasons[archive.season]=archive.data;
    const incoming=validateData(candidate).seasons[archive.season],target=next.seasons[archive.season];
    const conflicts=[];
    for(const p of incoming.roster) if(!target.roster.some(r=>r.id===p.id))target.roster.push(p);
    let added=0;
    for(const m of incoming.matches){
      if(target.matches.some(r=>r.id===m.id)){conflicts.push(m.id);continue;}
      target.matches.push(m);added++;
    }
    next.imports.push(archive.id);
    return {database:validateData(next),added,conflicts};
  }
  function parseFilename(filename){
    const match=/^(feuillematch|resume|positiontir)_(\d{4})_([A-Z0-9]+)_([A-Z0-9]+)_(\d{4})_(.+)\.pdf$/i.exec(filename.trim());
    assert(match,'Nom non reconnu. Exemple : feuillematch_0059_DF2_A_4173_FLINES_LEZ_RACHES_BC_RONCQ_U_S.pdf');
    const teams=match[6].toUpperCase(),club='FLINES_LEZ_RACHES_BC';
    assert(teams.split(club).length===2,'Le nom doit contenir exactement une équipe FLINES_LEZ_RACHES_BC.');
    const home=teams.startsWith(club+'_'),away=teams.endsWith('_'+club);
    assert(home||away,'Position du club non reconnue.');
    const opponent=home?teams.slice(club.length+1):teams.slice(0,-club.length-1);
    assert(/^[A-Z0-9()][A-Z0-9()_-]*$/.test(opponent),'Nom adverse invalide.');
    return {type:match[1].toLowerCase(),id:match[5],venue:home?'home':'away',opponent:opponent.replaceAll('_',' ')};
  }
  const api={SEASONS,initialData,validateData,validateMatch,summary,quarterStats,playerStats,lineStats,mergeArchive,parseFilename};
  if(typeof module!=='undefined' && module.exports) module.exports=api;
  else root.BCF=api;
})(globalThis);
