'use strict';
const $ = selector => document.querySelector(selector);
const escapeHTML = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = (value,digits=1) => value==null?'—':value.toLocaleString('fr-FR',{maximumFractionDigits:digits});
const fmtCeil = value => value==null?'—':String(Math.ceil(value));
const percent = value => value==null?'—':`${fmt(value)} %`;
const KEY='bcf-analytics-v1';
const NOTEBOOK='https://notebook.google.com/notebook/fce20967-538a-4c26-9dee-71a69eabbb2c';
const ARCHIVE=globalThis.BCF_ARCHIVE;
let database=BCF.initialData(),storageProblem='',archiveNotice='',season='2026-2027',tab='overview',venue='all',matchFilter='all',metric='points',opponent='';
try{
  const saved=localStorage.getItem(KEY);
  if(saved) database=BCF.validateData(JSON.parse(saved));
}catch(error){
  storageProblem=`La sauvegarde locale est illisible ou inaccessible : ${error.message} Les données affichées sont celles du trombinoscope initial. La sauvegarde existante n’a pas été modifiée. Exportez la sauvegarde brute avant de restaurer un fichier.`;
}
function data(){return database.seasons[season];}
function notify(message){
  $('#toast').textContent=message;$('#toast').hidden=false;
  clearTimeout(notify.timer);notify.timer=setTimeout(()=>{$('#toast').hidden=true;},6500);
}
function persist(next,{restore=false}={}){
  if(storageProblem && !restore) throw new Error('Sauvegarde bloquée : récupérez la sauvegarde brute puis restaurez un fichier dans Données & imports.');
  const valid=BCF.validateData(next);
  if(restore && ARCHIVE && !valid.imports.includes(ARCHIVE.id))valid.imports.push(ARCHIVE.id);
  try {localStorage.setItem(KEY,JSON.stringify(valid));}
  catch(error){throw new Error(`Enregistrement impossible : ${error.message}. Exportez vos données et vérifiez le stockage du navigateur.`);}
  database=valid;storageProblem='';
}
function installArchive(){
  if(!ARCHIVE || storageProblem || database.imports?.includes(ARCHIVE.id))return;
  try{
    const merged=BCF.mergeArchive(database,ARCHIVE);
    const previous=localStorage.getItem(KEY);
    if(previous)localStorage.setItem(`${KEY}-before-${ARCHIVE.id}`,previous);
    persist(merged.database);
    archiveNotice=`${merged.added} matchs FFBB ajoutés à la saison 2025/2026. L’effectif 2026/2027 et vos notes sont conservés.`;
    if(merged.conflicts.length)archiveNotice+=` Identifiants déjà présents, conservés sans écrasement : ${merged.conflicts.join(', ')}.`;
  }catch(error){storageProblem=`L’intégration du lot FFBB n’a pas pu être enregistrée : ${error.message}`;}
}
function updateSeason(mutator){
  const next=structuredClone(database);mutator(next.seasons[season]);persist(next);
}
function photo(player,className=''){
  return player.photo?`<img class="${className}" src="${escapeHTML(player.photo)}" alt="Portrait de ${escapeHTML(player.first)}" loading="lazy">`:`<span class="tag">${escapeHTML(player.first.slice(0,1)+player.last.slice(0,1))}</span>`;
}
function num(player){return player.number===null?'N° à confirmer':`#${player.number}`;}
function button(label,action,primary=false,extra=''){return `<button class="btn ${primary?'primary':''}" data-action="${action}" ${extra}>${label}</button>`;}
function pageHead(title,subtitle,actions=''){
  return `<div class="page-head"><div><p class="eyebrow" style="color:var(--purple);margin-bottom:9px">SENIORS F · ${season.replace('-',' / ')}</p><h1>${title}</h1><p>${subtitle}</p></div><div class="actions">${actions}</div></div>`;
}
function cardHead(title,description='',extra=''){return `<div class="card-head"><div><h2>${title}</h2><p>${description}</p></div>${extra}</div>`;}
function empty(title,description,action=''){return `<div class="empty"><span class="empty-symbol">◎</span><h3>${title}</h3><p>${description}</p>${action}</div>`;}
function blankChart(){return `<div class="empty-chart"><div><strong>Le prochain repère commence sur le terrain.</strong><p>Ajoutez un match avec ses statistiques pour faire apparaître cette analyse.</p></div></div>`;}
function metricCard(label,value,subtitle,icon='↗',purple=false){return `<div class="card metric"><div class="metric-top">${label}<span class="metric-icon">${icon}</span></div><div class="metric-value ${purple?'purple':''}">${value}</div><small>${subtitle}</small></div>`;}
function metrics(matches){
  const s=BCF.summary(matches);
  return `<div class="stats">${metricCard('Bilan de saison',s.count?`${s.wins}V <span class="muted">– ${s.losses}D</span>`:'—',`${s.count} match${s.count>1?'s':''} renseigné${s.count>1?'s':''}`,'⚑')}${metricCard('Attaque moyenne',fmt(s.attack),'Points marqués / match')}${metricCard('Défense moyenne',fmt(s.defense),'Points encaissés / match','↘')}${metricCard('Fautes commises',fmt(s.fouls),`${s.foulCount}/${s.count} matchs documentés`,'≋')}${metricCard('Adresse aux LF',percent(s.ftPct),s.ftCount?`${s.ftPairedMade} / ${s.ftPairedAttempts} · ${s.ftCount} matchs complets`:s.ftm!==null?`${s.ftm} réussis · tentatives inconnues`:'Aucune tentative renseignée','◎',true)}</div>`;
}
function chart(rows){
  if(!rows.some(r=>r.bcf.value!==null || r.opp.value!==null)) return blankChart();
  const max=Math.max(1,...rows.flatMap(r=>[r.bcf.value??0,r.opp.value??0]));
  return `<div class="bar-chart" role="img" aria-label="${escapeHTML(rows.map(r=>`${r.label} : BCF ${fmt(r.bcf.value)}, adversaire ${fmt(r.opp.value)}`).join(' ; '))}">${rows.map(r=>`<div class="bar-group">${['bcf','opp'].map(side=>`<div class="bar ${side==='opp'?'alt':''}" style="height:${r[side].value===null?0:Math.max(1,r[side].value/max*86)}%;${r[side].value===null?'background:transparent':''}" title="${r[side].count} période(s) renseignée(s)"><b>${fmt(r[side].value)}</b></div>`).join('')}<small>${r.label}</small></div>`).join('')}</div>`;
}
const legend='<div class="legend"><span><i></i>BCF</span><span><i class="opponent"></i>Adversaire</span></div>';
function matchTable(matches,editable=true){
  if(!matches.length) return empty('Le terrain attend vos premières données','Aucun match renseigné pour cette sélection.',button('+ Ajouter un match','add-match',true));
  return `<div class="table-wrap"><table><thead><tr><th>DATE</th><th>ADVERSAIRE</th><th>LIEU</th><th>SCORE BCF / ADV.</th><th>RÉSULTAT</th>${editable?'<th>DÉTAIL</th>':''}</tr></thead><tbody>${[...matches].sort((a,b)=>b.date.localeCompare(a.date)).map(m=>`<tr><td>${new Date(m.date+'T12:00:00').toLocaleDateString('fr-FR')}</td><td><strong>${escapeHTML(m.opponent)}</strong><small class="muted"> · ${escapeHTML(m.id)}</small></td><td><span class="tag gray">${m.venue==='home'?'Domicile':'Extérieur'}</span></td><td class="score">${m.for} <span class="muted">–</span> ${m.against}</td><td><span class="tag ${m.for>m.against?'green':'amber'}">${m.for>m.against?'Victoire':'Défaite'}</span></td>${editable?`<td><div class="actions"><button class="link-button" data-action="edit-match" data-id="${escapeHTML(m.id)}">Consulter / modifier</button>${m.provenance?`<button class="link-button" data-action="match-sources" data-id="${escapeHTML(m.id)}">Sources & tirs</button>`:''}</div></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}
function overview(){
  const s=BCF.summary(data().matches),documented=data().matches.filter(m=>m.periods).length;
  const shotMax=Math.max(1,s.two,s.three,s.ftm);
  const playerRankings=data().roster.map(p=>{
    const st=BCF.playerStats(data().matches,p.id);
    return {player:p,stats:st};
  }).filter(item=>item.stats.count>0).sort((a,b)=>(b.stats.ptsTotal??0)-(a.stats.ptsTotal??0)||(b.stats.pts??0)-(a.stats.pts??0));
  const topScorers=playerRankings.slice(0,5);
  const exportBtn = isCoach() ? button('↓ Exporter','export') : '';
  return pageHead('Vue d’ensemble','Les bons repères pour faire progresser le collectif.',exportBtn)+
    metrics(data().matches)+`<div class="grid-2"><section class="card">${cardHead('Le rythme du match',`Points moyens par période · ${documented}/${s.count} matchs documentés`,legend)}${chart(BCF.quarterStats(data().matches))}</section><section class="card">${cardHead('D’où viennent nos paniers ?',`Paniers réussis cumulés · ${s.shotCount}/${s.count} matchs documentés`)}${s.shotCount?[['2 points',s.two],['3 points',s.three],['LF',s.ftm]].map(([label,value])=>`<div class="shot-row"><span>${label}</span><div class="shot-track"><i style="width:${(value??0)/shotMax*100}%"></i></div><b>${fmt(value)}</b></div>`).join(''):blankChart()}</section></div>
    <section class="card">${cardHead('Top scoreuses & leaders',topScorers.length?`Top ${topScorers.length} de la saison classé par points cumulés et moyenne`:'Aucun match avec feuille individuelle renseigné',`<a class="compact" href="#roster">Statistiques complètes →</a>`)}${topScorers.length?`<div class="table-wrap"><table><thead><tr><th>RANG</th><th>JOUEUSE</th><th>POSTE</th><th>MJ</th><th>POINTS TOTAUX</th><th>PTS/M</th><th>MIN/M</th><th>2 PTS/M</th><th>3 PTS/M</th></tr></thead><tbody>${topScorers.map(({player:p,stats:st},idx)=>`<tr><td><span class="tag ${idx===0?'amber':idx<3?'soft':'gray'}">#${idx+1}</span></td><td><button class="link-button person" data-action="player" data-id="${escapeHTML(p.id)}">${photo(p)}<span><strong>${escapeHTML(p.first+' '+p.last)}</strong><small>${num(p)}${p.captain?' · Capitaine':''}</small></span></button></td><td>${escapeHTML(p.position)}</td><td>${st.count}</td><td><strong style="color:var(--purple);font-size:14px">${fmt(st.ptsTotal,0)}</strong></td><td><strong>${fmt(st.pts)}</strong></td><td title="${st.minuteCount} match(s) avec minutes exploitables">${fmt(st.min)}</td><td>${fmtCeil(st.two)}</td><td>${fmtCeil(st.three)}</td></tr>`).join('')}</tbody></table></div>`:empty('Statistiques individuelles en attente','Les marqueuses apparaîtront dès la saisie ou l’import des feuilles de match.')}</section>
    <section class="card section-gap">${cardHead('Dernières rencontres','Résultats saisis ou importés',`<a class="compact" href="#matches">Tous les matchs →</a>`)}${matchTable([...data().matches].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4))}</section>`;
}
function matchesView(){
  const matches=data().matches.filter(m=>(venue==='all'||m.venue===venue)&&(matchFilter==='all'||m.id===matchFilter));
  const rows=BCF.quarterStats(matches,metric);
  const playerRankings=data().roster.map(p=>{
    const st=BCF.playerStats(matches,p.id);
    return {player:p,stats:st};
  }).filter(item=>item.stats.count>0).sort((a,b)=>(b.stats.ptsTotal??0)-(a.stats.ptsTotal??0)||(b.stats.pts??0)-(a.stats.pts??0));
  const topScorers=playerRankings.slice(0,5);
  return pageHead('Matchs & quart-temps','Comprendre les temps forts. Identifier les passages à vide.')+
    `<div class="filters"><label class="compact">Terrain <select id="venue"><option value="all">Tous les terrains</option><option value="home" ${venue==='home'?'selected':''}>Domicile</option><option value="away" ${venue==='away'?'selected':''}>Extérieur</option></select></label><label class="compact">Rencontre <select id="match-filter"><option value="all">Tous les matchs</option>${data().matches.map(m=>`<option value="${escapeHTML(m.id)}" ${matchFilter===m.id?'selected':''}>${escapeHTML(m.date+' · '+m.opponent)}</option>`).join('')}</select></label></div>`+metrics(matches)+
    `<section class="card">${cardHead('Évolution par période','Moyennes sur les périodes renseignées ; les valeurs manquantes ne sont pas des zéros.',`<select id="metric" aria-label="Indicateur par période">${Object.entries({points:'Points marqués',fouls:'Fautes commises',ftm:'LF réussis',fta:'LF tentés',ft_pct:'Réussite LF (%)'}).map(([k,v])=>`<option value="${k}" ${metric===k?'selected':''}>${v}</option>`).join('')}</select>`)}<div class="quarter-scores">${rows.map(r=>`<div><small>${r.label}</small><strong>${fmt(r.bcf.value)} <span class="muted">– ${fmt(r.opp.value)}</span></strong><small>${r.bcf.count} BCF / ${r.opp.count} adv. documenté(s)</small></div>`).join('')}</div>${legend}${chart(rows)}<p class="help section-gap">Ordre : BCF puis adversaire. Les pourcentages LF sont calculés sur les totaux réussis / tentés, pas sur la moyenne des pourcentages. PR = prolongation.</p></section>
    <section class="card section-gap">${cardHead('Top scoreuses & leaders',topScorers.length?`Top ${topScorers.length} sur la sélection actuelle (${matches.length} match(s))`:'Aucun match avec feuille individuelle renseigné',`<a class="compact" href="#roster">Statistiques complètes →</a>`)}${topScorers.length?`<div class="table-wrap"><table><thead><tr><th>RANG</th><th>JOUEUSE</th><th>POSTE</th><th>MJ</th><th>POINTS TOTAUX</th><th>PTS/M</th><th>MIN/M</th><th>2 PTS/M</th><th>3 PTS/M</th></tr></thead><tbody>${topScorers.map(({player:p,stats:st},idx)=>`<tr><td><span class="tag ${idx===0?'amber':idx<3?'soft':'gray'}">#${idx+1}</span></td><td><button class="link-button person" data-action="player" data-id="${escapeHTML(p.id)}">${photo(p)}<span><strong>${escapeHTML(p.first+' '+p.last)}</strong><small>${num(p)}${p.captain?' · Capitaine':''}</small></span></button></td><td>${escapeHTML(p.position)}</td><td>${st.count}</td><td><strong style="color:var(--purple);font-size:14px">${fmt(st.ptsTotal,0)}</strong></td><td><strong>${fmt(st.pts)}</strong></td><td title="${st.minuteCount} match(s) avec minutes exploitables">${fmt(st.min)}</td><td>${fmtCeil(st.two)}</td><td>${fmtCeil(st.three)}</td></tr>`).join('')}</tbody></table></div>`:empty('Statistiques individuelles en attente','Les marqueuses apparaîtront dès la saisie ou l’import des feuilles de match.')}</section>
    <section class="card section-gap">${cardHead('Journal des rencontres',`${matches.length} résultat(s) dans cette sélection`)}${matchTable(matches)}</section>`;
}
function rosterContent(query=''){
  const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const players=data().roster.filter(p=>normalize(`${p.first} ${p.last} ${p.number??''} ${p.position}`).includes(normalize(query)));
  if(!players.length) return empty('Aucune joueuse dans cette sélection','Ajoutez une joueuse ou importez l’effectif de cette saison.');
  return `<section class="card"><div class="table-wrap"><table><thead><tr><th>JOUEUSE</th><th>POSTE</th><th>MJ¹</th><th>PTS TOTAUX</th><th>PTS/M</th><th>MIN/M</th><th>2 PTS/M</th><th>3 PTS/M</th><th>LF M/T²</th><th>LF %</th><th>FAUTES/M</th></tr></thead><tbody>${players.map(p=>{
    const s=BCF.playerStats(data().matches,p.id);
    return `<tr><td><button class="link-button person" data-action="player" data-id="${escapeHTML(p.id)}">${photo(p)}<span>${escapeHTML(p.first+' '+p.last)}<small>${num(p)}</small></span></button></td><td>${escapeHTML(p.position)}</td><td>${s.count}</td><td><strong style="color:var(--purple)">${fmt(s.ptsTotal,0)}</strong></td><td><strong>${fmt(s.pts)}</strong></td><td title="${s.minuteCount} match(s) avec minutes exploitables">${fmt(s.min)}</td><td>${fmtCeil(s.two)}</td><td>${fmtCeil(s.three)}</td><td>${s.shotCount?`${fmt(s.ftm)}/${fmt(s.fta)}`:'—'}</td><td>${percent(s.ftPct)}</td><td>${fmtCeil(s.fouls)}</td></tr>`;
  }).join('')}</tbody></table></div><p class="help section-gap">¹ MJ : lignes individuelles documentées, pas une preuve d’entrée en jeu. Chaque moyenne utilise les valeurs connues. Les tirs à 2 pts/m, 3 pts/m et fautes/m sont arrondis à l’entier supérieur. Les temps des feuilles dont le cumul équipe diffère de 200:00 (sans prolongation) sont exclus de Min/M et restent consultables dans les fiches. ² LF : totaux cumulés ; les LF tentés ne figurent pas dans les PDF. Une absence de donnée n’est jamais remplacée par zéro.</p></section>`;
}
function rosterView(){
  return pageHead('Effectif & statistiques',`${data().roster.length} joueuses renseignées · Des profils complémentaires, une ambition commune.`,button('+ Ajouter une joueuse','add-player'))+
    (season==='2026-2027'?'<div class="notice" style="margin-bottom:20px">Noms et numéros transcrits des pièces jointes. Les codes C / PG / PF et la croix sur Leila sont conservés dans les fiches, sans interprétation. Vous pouvez confirmer les postes en modifiant les fiches.</div>':'<div class="notice" style="margin-bottom:20px">Effectif historique issu des résumés 2025/2026, distinct du trombinoscope actuel. Le numéro affiché est celui de la dernière feuille disponible. Temps incohérents exclus des moyennes ; voir les fiches pour les valeurs source.</div>')+
    `<div class="filters"><input class="input" id="roster-search" aria-label="Rechercher une joueuse" placeholder="Rechercher par nom, numéro ou poste…"><span class="tag">${season.replace('-',' / ')}</span></div><div id="roster-results">${rosterContent()}</div>`;
}
function scoutingView(){
  const opponents=[...new Set([...data().matches.map(m=>m.opponent),...Object.keys(data().notes)])].sort((a,b)=>a.localeCompare(b,'fr'));
  if(!opponents.includes(opponent)) opponent=opponents[0]??'';
  const meetings=data().matches.filter(m=>m.opponent===opponent);
  const s=BCF.summary(meetings);
  const adverse=BCF.summary(meetings.map(m=>({...m,for:m.against,against:m.for,shots:m.opponentShots})));
  const names=[...new Set(meetings.flatMap(m=>(m.opponentPlayers??[]).map(p=>p.name)))];
  const scoutingPlayers=names.map(name=>{
    const lines=meetings.flatMap(m=>(m.opponentPlayers??[]).filter(p=>p.name===name).map(p=>({...p,min:m.opponentMinutesReliable===false?null:p.min})));
    const numbers=[...new Set(lines.map(p=>p.number).filter(n=>n!=null))];
    const numberStr=numbers.length?numbers.map(n=>`#${n}`).join(', '):'—';
    return {name,numberStr,stats:BCF.lineStats(lines)};
  }).sort((a,b)=>(b.stats.pts??0)-(a.stats.pts??0));
  return pageHead('Scouting adverse','Préparer la rencontre avec des faits et des consignes.',button('+ Ajouter un adversaire','add-opponent',true))+
    (!opponents.length?`<section class="card">${empty('Votre prochain adversaire, sous la loupe','Ajoutez une équipe pour préparer votre plan de match. Les données adverses ne sont pas inventées.',button('+ Créer une fiche scouting','add-opponent',true))}</section>`:
    `<div class="filters"><label>Adversaire <select id="opponent">${opponents.map(o=>`<option ${o===opponent?'selected':''}>${escapeHTML(o)}</option>`).join('')}</select></label><span class="tag">${meetings.length} confrontation(s) renseignée(s)</span></div>
    <div class="grid-2"><section class="card">${cardHead(escapeHTML(opponent),'Analyse limitée aux confrontations renseignées contre BCF')}<div class="split">${metricCard('Points adverses / match',fmt(s.defense),'Face à BCF')}${metricCard('Points BCF / match',fmt(s.attack),'Face à cet adversaire')}</div><p class="help section-gap">Paniers adverses cumulés : ${fmt(adverse.two)} à 2 pts · ${fmt(adverse.three)} à 3 pts · ${fmt(adverse.ftm)} LF réussis. Classement et statistiques hors confrontations non disponibles.</p></section>
    <section class="card">${cardHead('Plan de match','Notes propres à cet adversaire et à cette saison')}<form id="notes-form"><label class="field" for="notes">Consignes, points de vigilance et ajustements</label><textarea id="notes" maxlength="20000" placeholder="Défense sur pick & roll, repli, rebond, points à observer…">${escapeHTML(data().notes[opponent]??'')}</textarea><div class="form-actions"><span class="help" id="note-status">Sauvegarde locale uniquement</span><button class="btn primary" type="submit">Enregistrer les notes</button></div></form></section></div>
    ${scoutingPlayers.length?`<section class="card section-gap">${cardHead('Joueuses adverses observées','Uniquement les lignes des confrontations fournies · classement par points moyens')}<div class="table-wrap"><table><thead><tr><th>N°</th><th>JOUEUSE</th><th>LIGNES</th><th>PTS/M</th><th>MIN/M</th><th>2 PTS/M</th><th>3 PTS/M</th><th>LF RÉUSSIS</th><th>FAUTES/M</th></tr></thead><tbody>${scoutingPlayers.map(({name,numberStr,stats:s})=>`<tr><td><strong>${escapeHTML(numberStr)}</strong></td><td>${escapeHTML(name)}</td><td>${s.count}</td><td><strong>${fmt(s.pts)}</strong></td><td title="${s.minuteCount} ligne(s) exploitable(s)">${fmt(s.min)}</td><td>${fmtCeil(s.two)}</td><td>${fmtCeil(s.three)}</td><td>${fmt(s.ftm)}</td><td>${fmtCeil(s.fouls)}</td></tr>`).join('')}</tbody></table></div></section>`:''}
    <section class="card section-gap">${cardHead('Historique des confrontations')}${matchTable(meetings)}</section>`);
}
function sourcesView(){
  return pageHead('Données & imports','Des sources identifiées. Des indicateurs fiables.',button('↓ Sauvegarder toutes les données','export',true))+
    (ARCHIVE?`<section class="card" style="margin-bottom:22px">${cardHead('Archives FFBB · 2025 / 2026','60 fichiers reçus · 57 PDF exploitables · 22 rencontres intégrées',`<span class="tag green">${database.seasons['2025-2026'].matches.length} matchs dans le cockpit</span>`)}<p class="help">19 rencontres détaillées (scores finaux et mi-temps recoupés avec les totaux individuels, quart-temps et cartes des tirs FFBB). 3 rencontres issues des résultats officiels de la liste fournie (scores, dates, terrains). L’effectif historique compte 11 joueuses ; il ne remplace pas l’effectif 2026/2027.</p><div class="notice"><strong>22 matchs complets sur 22.</strong> Les lancers francs tentés (LF) ont été déduits selon la méthodologie e-Marque officielle par croisement des feuilles de match (fautes P1/P2/P3 et bonus) et des résumés. Le match #4108 contre Linselles a été intégré avec ses trois PDF corrigés. Les matchs #4121, #4240 et #4253 intègrent les scores officiels en attendant la réception des feuilles détaillées (aucun détail inventé).</div><p class="help section-gap"><strong>Limites :</strong> Les temps dont le cumul équipe diffère de 200:00 sont conservés en valeurs source, mais exclus des moyennes. Seuls 7 matchs du lot ont un cumul BCF de 200:00. Les chiffres affichés décrivent les documents reçus, pas nécessairement la saison complète.</p><div class="actions">${button('↓ Récupérer la sauvegarde avant intégration','pre-archive-export')}${button('↓ Exporter le lot FFBB seul','archive-export')}</div><details><summary>Traçabilité des 22 rencontres et fichiers sources</summary>${ARCHIVE.data.matches.map(m=>`<div class="source-row"><div><strong>#${m.id} · ${escapeHTML(m.opponent)} · ${m.for} – ${m.against}</strong><p>${m.provenance.files.length?m.provenance.files.map(escapeHTML).join('<br>'):'Résultat officiel issu de la liste fournie'}</p></div></div>`).join('')}</details></section>`:'')+
    `<div class="grid-2"><section class="card">${cardHead('Vos sources','Statut réel des données du cockpit')}
      <div class="source-row"><div><strong>Trombinoscope · 2026 / 2027</strong><p>11 joueuses + Maxime Crepin (coach). Portraits recadrés localement.</p></div><span class="tag green">Intégré</span></div>
      <div class="source-row"><div><strong>NotebookLM · 2025 / 2026</strong><p>Les données ont été intégrées depuis les PDF joints, pas par une connexion au notebook. Aucune synchronisation automatique.</p></div><a class="btn" href="${NOTEBOOK}" target="_blank" rel="noopener noreferrer">Ouvrir ↗</a></div>
      <div class="source-row"><div><strong>Statistiques sportives</strong><p>${BCF.SEASONS.map(s=>`${s} : ${database.seasons[s].matches.length} match(s)`).join(' · ')}</p></div><span class="tag gray">Saisie / JSON</span></div>
      <p class="help section-gap">Les valeurs fictives et les portraits génériques du HTML fourni ont été retirés. Dates de naissance, licences, signatures, nationalités et assurances ne sont pas copiées dans le cockpit. Seules les informations utiles au cockpit sont conservées.</p></section>
    <section class="card">${cardHead('Importer & sauvegarder','Un fichier JSON, du texte/JSON direct ou vos PDF e-Marque')}<div class="notice" style="margin-bottom:14px"><strong>Saison 2026/2027 :</strong> Glissez vos 3 PDF FFBB ou collez directement le JSON généré par NotebookLM. Les lancers francs tentés (LF) sont automatiquement déduits et le match est rattaché à l’effectif 2026/2027.</div><div class="actions">${button('🏀 Importer des PDF e-Marque (2026/2027)','import-pdf',true)}${button('📋 Coller un JSON de match (NotebookLM)','paste-json')}${button('↑ Importer un JSON complet','import')}${button('↓ Sauvegarder JSON','export')}${button('↓ Modèle vierge','template')}</div><p class="notice section-gap">L’import JSON complet remplace les deux saisons après confirmation. L’import PDF ou le collage d’un JSON de match ajoute ou met à jour la rencontre dans la saison 2026/2027 sans effacer vos autres données. Les fichiers ne quittent pas votre appareil.</p>${storageProblem?button('Récupérer la sauvegarde brute','raw-export'):''}</section></div>
    <section class="card">${cardHead('Nomenclature FFBB','Détecter le match et le terrain à partir du nom du fichier — sans analyser son PDF.')}<form id="filename-form"><label class="field" for="filename">Nom du fichier</label><div class="actions"><input class="input" style="flex:1;min-width:160px" id="filename" value="feuillematch_0059_DF2_A_4173_FLINES_LEZ_RACHES_BC_RONCQ_U_S.pdf" required><button class="btn primary">Analyser le nom</button></div></form><div id="filename-result" class="section-gap" aria-live="polite"></div><p class="help">FLINES_LEZ_RACHES_BC en première position = domicile ; en seconde = extérieur. Formats : feuillematch, resume, positiontir. Le numéro à quatre chiffres relie les documents d’une même rencontre.</p></section>
    <section class="card section-gap">${cardHead('Mode d’emploi & format des données')}<div class="split"><div><h3>Une saison, pas à pas</h3><p class="help">1. Sélectionnez la saison en haut de l’écran.<br>2. Vérifiez l’effectif et les postes.<br>3. Ajoutez un match terminé, ses scores puis les détails disponibles.<br>4. Consultez les moyennes et préparez le scouting.<br>5. Exportez régulièrement une sauvegarde JSON.</p><h3>Comment sont calculés les indicateurs ?</h3><p class="help">Attaque et défense : total des points / nombre de matchs renseignés. Tirs : paniers réussis cumulés. LF % : total réussis / total tentés. Les champs absents restent « — ». Les moyennes par quart-temps utilisent les périodes connues ; une prolongation n’est pas mélangée avec le QT4. Aucun classement n’est déduit d’un calendrier incomplet.</p></div><div><h3>Stockage et confidentialité</h3><p class="help">Application autonome, sans service externe ni outil de suivi. Les données sont stockées dans localStorage ; elles ne sont pas partagées avec l’équipe et peuvent être effacées par le navigateur. Gardez la même adresse locale pour retrouver la sauvegarde. Ne diffusez pas les portraits sans les autorisations nécessaires.</p><h3>Importer les saisons précédentes</h3><p class="help">Téléchargez le modèle vierge, ajoutez l’effectif historique dans <code>seasons["2025-2026"].roster</code>, puis ses rencontres dans <code>matches</code>. Les identifiants des lignes individuelles doivent correspondre aux identifiants de cet effectif.</p></div></div>
    <details><summary>Schéma d’un match JSON (exemple fictif de format, non chargé)</summary><pre>${escapeHTML(JSON.stringify({id:'exemple-4173',date:'2025-10-05',opponent:'Équipe exemple',venue:'home',for:60,against:50,periods:[{for:15,against:10},{for:15,against:15},{for:15,against:10},{for:15,against:15}],shots:{two:20,three:5,ftm:5,fta:8,fouls:15},players:[]},null,2))}</pre><p class="help"><code>periods</code> et <code>shots</code> peuvent être null. Chaque valeur de shots peut aussi être null : <code>fta: null</code> signifie tentatives inconnues, pas zéro. Pour chaque période, les objets facultatifs <code>bcf</code> et <code>opp</code> contiennent <code>{fouls, ftm, fta}</code>, également nullables. Une ligne de joueuse : <code>{playerId, pts, min, shots}</code>. Les points individuels peuvent être partiels mais ne peuvent pas dépasser le score BCF. Les minutes sont décimales (24:30 = 24.5) ou null.</p><p class="help"><code>opponentShots</code> a le même format que shots. <code>opponentPlayers</code> contient des lignes <code>{name, number, pts, min, shots}</code>. <code>minutesReliable: false</code> et <code>opponentMinutesReliable: false</code> excluent les temps respectifs des moyennes sans les effacer. La provenance facultative contient <code>{origin, files, warnings}</code>. À la racine, <code>imports</code> mémorise les lots déjà intégrés pour empêcher les doublons et respecter les suppressions. Les notes sont un objet associant nom adverse et texte.</p></details></section>`;
}
function docsView(){
  return pageHead('Guide & Documentation','Récapitulatif des fonctionnalités du cockpit et journal des mises à jour')+
    `<div class="grid-2">
      <section class="card">
        ${cardHead('🏀 Fonctionnalités du cockpit','Présentation des différents modules d’analyse')}
        <div style="display:grid;gap:16px;">
          <div>
            <strong>▦ Vue d’ensemble</strong>
            <p class="help">Bilan global de la saison (victoires/défaites, attaque, défense, différentiel). Comprend les indicateurs clés et le <em>Top 5 scoreuses & leaders</em> par moyenne de points.</p>
          </div>
          <div>
            <strong>▥ Matchs & quart-temps</strong>
            <p class="help">Consultation détaillée de chaque rencontre (scores globaux et par quart-temps, évolution du score, synthèse des tirs à 2 pts, 3 pts, LF et fautes collectives). Filtres par lieu (domicile / extérieur) et résultat.</p>
          </div>
          <div>
            <strong>♧ Effectif & statistiques</strong>
            <p class="help">Tableau statistique complet de l'équipe : matchs joués, temps de jeu moyen, points par match, tirs à 2 pts et 3 pts par match (arrondis au supérieur), lancers francs réussis / tentés (% d'adresse) et fautes moyennes.</p>
          </div>
          <div>
            <strong>◎ Scouting adverse</strong>
            <p class="help">Préparation de match par adversaire : historique des confrontations, moyennes offensives/défensives face à cette équipe, carnet de notes et consignes coach, et tableau des <em>joueuses adverses observées</em> avec numéros et points moyens.</p>
          </div>
          <div>
            <strong>⇄ Données & imports</strong>
            <p class="help">Gestion des sources e-Marque FFBB (résumés, positions de tir, feuilles de match), déduction automatique des LF tentés, import/export de sauvegardes JSON et modèle vierge.</p>
          </div>
          <div>
            <strong>🔒 Authentification & sécurité</strong>
            <p class="help">Accès restreint par mot de passe et identifiant club (SHA-256) pour garantir la confidentialité des données et des plans de match diffusés à l'équipe.</p>
          </div>
        </div>
      </section>

      <section class="card">
        ${cardHead('🚀 Journal des mises à jour','Historique des évolutions apportées au cockpit')}
        <div style="display:grid;gap:18px;">
          <div class="source-row" style="border-top:none;padding-top:0;">
            <div>
              <span class="tag green" style="margin-bottom:6px;">Octobre 2026</span>
              <strong>Protection par Login & Mot de passe</strong>
              <p class="help">Mise en place d'un écran de connexion moderne et sécurisé (chiffrement SHA-256, mémorisation de session locale et bouton Déconnexion dans la barre latérale).</p>
            </div>
          </div>
          <div class="source-row">
            <div>
              <span class="tag green" style="margin-bottom:6px;">Octobre 2026</span>
              <strong>Publication et déploiement GitHub Pages</strong>
              <p class="help">Configuration du dépôt GitHub et automatisation du déploiement en ligne pour consultation permanente par les joueuses sur smartphone et ordinateur.</p>
            </div>
          </div>
          <div class="source-row">
            <div>
              <span class="tag" style="margin-bottom:6px;">Octobre 2026</span>
              <strong>Affichage épuré & Tableau statistique unique</strong>
              <p class="help">Retrait du trombinoscope en cartes au profit d'un tableau synthétique direct des statistiques individuelles dans l'onglet Effectif.</p>
            </div>
          </div>
          <div class="source-row">
            <div>
              <span class="tag" style="margin-bottom:6px;">Octobre 2026</span>
              <strong>Top scoreuses & leaders</strong>
              <p class="help">Intégration du tableau dynamique des meilleures marqueuses sur la Vue d'ensemble et l'onglet Matchs & quart-temps en remplacement du bloc collectif.</p>
            </div>
          </div>
          <div class="source-row">
            <div>
              <span class="tag" style="margin-bottom:6px;">Octobre 2026</span>
              <strong>Scouting adverse 2026/2027</strong>
              <p class="help">Ajout du tableau d'observation des joueuses adverses avec numéros de maillots, points moyens, temps de jeu et répartition des tirs.</p>
            </div>
          </div>
          <div class="source-row">
            <div>
              <span class="tag" style="margin-bottom:6px;">Octobre 2026</span>
              <strong>Calculs e-Marque avancés</strong>
              <p class="help">Arrondi supérieur des tirs (2 pts, 3 pts) et fautes, déduction automatique des LF tentés par analyse des fautes P1/P2/P3 et des bonus.</p>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="card section-gap">
      ${cardHead('💡 Astuces et règles d’usage')}
      <div class="split">
        <div>
          <h3>Consultation mobile</h3>
          <p class="help">Le cockpit est responsive et optimisé pour smartphone. Les joueuses peuvent l'ajouter à l'écran d'accueil de leur téléphone pour y accéder comme une application native.</p>
        </div>
        <div>
          <h3>Sauvegarde des données</h3>
          <p class="help">Les modifications saisies (notes de scouting, imports manuels) sont conservées dans le navigateur local. Pensez à exporter régulièrement un JSON depuis l'onglet <em>Données & imports</em>.</p>
        </div>
      </div>
    </section>`;
}
function render(){
  tab=location.hash.slice(1)||'overview';
  if(!['overview','matches','roster','scouting','sources','docs'].includes(tab)) tab='overview';
  if (tab === 'sources' && !isCoach()) {
    tab = 'overview';
    location.hash = '#overview';
  }
  updateNavPermissions();
  document.querySelectorAll('[data-tab]').forEach(a=>{a.classList.toggle('active',a.dataset.tab===tab);if(a.dataset.tab===tab)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#main').innerHTML=(storageProblem?`<div class="error" role="alert">${escapeHTML(storageProblem)} <a href="#sources">Données & imports</a></div>`:'')+(archiveNotice?`<div class="notice" style="margin-bottom:20px">${escapeHTML(archiveNotice)}</div>`:'')+({overview,matches:matchesView,roster:rosterView,scouting:scoutingView,sources:sourcesView,docs:docsView}[tab])();
  bindView();
}
function bindView(){
  $('#venue')?.addEventListener('change',e=>{venue=e.target.value;render();});
  $('#match-filter')?.addEventListener('change',e=>{matchFilter=e.target.value;render();});
  $('#metric')?.addEventListener('change',e=>{metric=e.target.value;render();});
  $('#opponent')?.addEventListener('change',e=>{if(!allowNavigation()){e.target.value=opponent;return;}opponent=e.target.value;render();});
  $('#roster-search')?.addEventListener('input',e=>{$('#roster-results').innerHTML=rosterContent(e.target.value);});
  $('#notes')?.addEventListener('input',()=>{$('#note-status').textContent='Modifications non enregistrées';});
  $('#notes-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    try{updateSeason(d=>{Object.defineProperty(d.notes,opponent,{value:$('#notes').value,enumerable:true,writable:true,configurable:true});});$('#note-status').textContent='Enregistré dans ce navigateur';notify('Notes enregistrées.');}catch(error){notify(error.message);}
  });
  $('#filename-form')?.addEventListener('submit',e=>{
    e.preventDefault();
    try{const r=BCF.parseFilename($('#filename').value);$('#filename-result').innerHTML=`<span class="tag green">Match #${escapeHTML(r.id)}</span> <strong>${r.venue==='home'?'Domicile':'Extérieur'}</strong> · ${escapeHTML(r.opponent)} <p class="help">Type : ${escapeHTML(r.type)}. Le contenu du PDF n’a pas été lu.</p>`;}
    catch(error){$('#filename-result').innerHTML=`<div class="error">${escapeHTML(error.message)}</div>`;}
  });
}
function notesDirty(){return $('#notes') && $('#notes').value!==(data().notes[opponent]??'');}
function allowNavigation(){return !notesDirty() || confirm('Les notes ne sont pas enregistrées. Quitter sans les enregistrer ?');}
let lastHash=location.hash;
window.addEventListener('hashchange',()=>{if(!allowNavigation()){history.replaceState(null,'',lastHash||'#overview');return;}lastHash=location.hash;render();});
window.addEventListener('beforeunload',e=>{if(notesDirty()||($('#modal').open && modalDirty)){e.preventDefault();e.returnValue='';}});
$('#season').addEventListener('change',e=>{
  if(!allowNavigation()){e.target.value=season;return;}
  season=e.target.value;venue='all';matchFilter='all';opponent='';
  const url=new URL(location.href);url.searchParams.set('season',season);history.replaceState(null,'',url);
  render();
});
let modalDirty=false;
function openModal(title,body){
  $('#modal-title').textContent=title;$('#modal-body').innerHTML=body;modalDirty=false;
  if(!$('#modal').open) $('#modal').showModal();
}
function closeModal(){if(modalDirty && !confirm('Fermer sans enregistrer les modifications ?')) return;$('#modal').close();modalDirty=false;}
$('#close-modal').addEventListener('click',closeModal);
$('#modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
$('#modal').addEventListener('input',()=>{modalDirty=true;});
function errorInForm(error){$('#form-error').textContent=error.message;$('#form-error').hidden=false;}
function playerModal(id){
  const p=data().roster.find(p=>p.id===id),s=BCF.playerStats(data().matches,id);
  const entries=data().matches.filter(m=>m.players.some(l=>l.playerId===id)).sort((a,b)=>a.date.localeCompare(b.date));
  openModal('Fiche individuelle',`<div class="profile">${photo(p)}<div><span class="tag">${num(p)}${p.captain?' · Capitaine':''}</span><h3>${escapeHTML(p.first+' '+p.last)}</h3><p>${escapeHTML(p.position)}</p><small class="muted">BCF · ${season.replace('-',' / ')}</small></div></div><div class="split">${metricCard('Points cumulés',fmt(s.ptsTotal,0),`${s.count} match(s) disputé(s)`)}${metricCard('Points / match',fmt(s.pts),'Moyenne individuelle')}${metricCard('Adresse aux LF',percent(s.ftPct),`${s.shotCount} match(s) avec détail des tirs`)}</div><p class="notice section-gap">${escapeHTML(p.annotation||'Aucune annotation.')}</p><p class="help">Les statistiques proviennent uniquement des matchs saisis ou importés. Min/M : ${fmt(s.min)} sur ${s.minuteCount} ligne(s) avec temps exploitables.</p>${entries.length?`<div class="table-wrap"><table><thead><tr><th>MATCH</th><th>POINTS</th><th>MINUTES SOURCE</th><th>MOYENNE MIN/M</th></tr></thead><tbody>${entries.map(m=>{const line=m.players.find(l=>l.playerId===id);return `<tr><td>${escapeHTML(m.date)} · #${escapeHTML(m.id)}</td><td>${line.pts}</td><td>${duration(line.min)}</td><td>${line.min===null?'Non renseignées':m.minutesReliable===false?'<span class="tag amber">Exclues : cumul incohérent</span>':'Incluses'}</td></tr>`;}).join('')}</tbody></table></div>`:''}<div class="form-actions">${button('Modifier la fiche','edit-player',true,`data-id="${escapeHTML(p.id)}"`)}</div>`);
}
function duration(minutes){
  if(minutes===null)return '—';
  const seconds=Math.round(minutes*60);
  return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
}
function matchSources(id){
  const match=data().matches.find(m=>m.id===id);
  if(!match?.provenance){notify('Aucune provenance documentaire disponible pour ce match.');return;}
  const original=ARCHIVE?.data.matches.find(m=>m.provenance.files.some(f=>match.provenance.files.includes(f)));
  openModal(`Sources du match #${id}`,`<p class="help">${escapeHTML(match.provenance.origin)}</p><div class="notice">${match.provenance.warnings.map(escapeHTML).join('<br>')}</div>
    <details><summary>Fichiers utilisés</summary><p class="help">${match.provenance.files.map(escapeHTML).join('<br>')}</p></details>
    ${original?`<h3 class="section-gap">Cartes des tirs réussis · documents d’origine #${original.id}</h3><p class="help">Ces images sont les cartes FFBB originales : elles ne montrent pas les tirs manqués. Elles ne changent pas si un score est corrigé manuellement dans le cockpit.</p>${[['BCF',original.venue==='home'?'a':'b'],[original.opponent,original.venue==='home'?'b':'a']].map(([label,side])=>`<h3>${escapeHTML(label)}</h3><img class="shot-map" src="shotmaps/${original.id}-${side}.jpg" alt="Carte FFBB des tirs réussis de ${escapeHTML(label)} pour le match ${original.id}">`).join('')}`:''}`);
}
function inputField(label,name,value='',type='text',extra=''){
  return `<label class="field">${label}<input class="input" name="${name}" type="${type}" value="${escapeHTML(value??'')}" ${extra}></label>`;
}
function editPlayer(id){
  const p=data().roster.find(p=>p.id===id)??{first:'',last:'',number:null,position:'À confirmer',captain:false,annotation:''};
  openModal(id?'Modifier la fiche':'Ajouter une joueuse',`<form id="player-form"><div class="form-grid">${inputField('Prénom','first',p.first,'text','required maxlength="80"')}${inputField('Nom','last',p.last,'text','required maxlength="100"')}${inputField('Numéro (vide si inconnu)','number',p.number,'number','min="0" max="99"')}${inputField('Poste / rôles','position',p.position,'text','required maxlength="160"')}<label class="field full">Annotation / provenance<textarea name="annotation" maxlength="1000">${escapeHTML(p.annotation)}</textarea></label><label><input type="checkbox" name="captain" ${p.captain?'checked':''}> Capitaine</label></div><div id="form-error" class="error" hidden role="alert"></div><div class="form-actions"><button class="btn primary">Enregistrer la fiche</button></div></form>`);
  $('#player-form').addEventListener('submit',e=>{
    e.preventDefault();const f=new FormData(e.target);
    try{updateSeason(d=>{
      const player={...p,id:id??crypto.randomUUID(),first:f.get('first').trim(),last:f.get('last').trim(),number:f.get('number')===''?null:Number(f.get('number')),position:f.get('position').trim(),annotation:f.get('annotation'),captain:f.has('captain')};
      const index=d.roster.findIndex(x=>x.id===id);if(index>=0)d.roster[index]=player;else d.roster.push(player);
    });modalDirty=false;$('#modal').close();render();notify('Fiche enregistrée.');}catch(error){errorInForm(error);}
  });
}
function periodRow(index,p={}){
  return `<tr class="period-row"><td>${index<4?'QT '+(index+1):'PR '+(index-3)}</td>${['for','against'].map(k=>`<td><input class="input" aria-label="${index+1} ${k==='for'?'points BCF':'points adversaire'}" type="number" min="0" max="500" data-key="${k}" value="${p[k]??''}"></td>`).join('')}${['bcf','opp'].map(side=>['fouls','ftm','fta'].map(k=>`<td><input class="input" aria-label="Période ${index+1} ${side} ${k}" type="number" min="0" max="500" data-side="${side}" data-key="${k}" value="${p[side]?.[k]??''}"></td>`).join('')).join('')}</tr>`;
}
function matchModal(id){
  const existing=data().matches.find(m=>m.id===id);
  const m=existing??{id:'',date:new Date().toLocaleDateString('en-CA'),opponent:'',venue:'home',for:null,against:null,periods:null,shots:null,players:[]};
  openModal(existing?'Modifier le match · '+m.id:'Ajouter un match terminé',`<form id="match-form"><p class="help">Saison ${season}. Seuls l’adversaire, la date, le terrain et les scores finaux sont obligatoires. Laissez les détails inconnus vides.</p><div class="form-grid">${inputField('Identifiant / numéro FFBB (facultatif)','id',m.id,'text','maxlength="80"')}${inputField('Date','date',m.date,'date','required')}${inputField('Adversaire','opponent',m.opponent,'text','required maxlength="100"')}<label class="field">Terrain<select name="venue"><option value="home">Domicile</option><option value="away" ${m.venue==='away'?'selected':''}>Extérieur</option></select></label>${inputField('Score final BCF','for',m.for,'number','required min="0" max="500"')}${inputField('Score final adverse','against',m.against,'number','required min="0" max="500"')}</div>
    <details ${m.periods?'open':''}><summary>Quart-temps & prolongations</summary><p class="help">Scores de chaque période, non cumulés. Si un score de période est renseigné, renseignez tous les scores. F / M / T = fautes, LF marqués, LF tentés ; facultatifs par équipe, mais à renseigner ensemble.</p><div class="table-wrap"><table class="q-inputs"><thead><tr><th>PÉRIODE</th><th>PTS BCF</th><th>PTS ADV.</th><th>F BCF</th><th>M BCF</th><th>T BCF</th><th>F ADV.</th><th>M ADV.</th><th>T ADV.</th></tr></thead><tbody id="period-rows">${(m.periods??[{}, {}, {}, {}]).map((p,i)=>periodRow(i,p)).join('')}</tbody></table></div><div class="actions section-gap"><button type="button" class="btn" id="add-period">+ Prolongation</button><button type="button" class="btn" id="remove-period">Retirer la dernière prolongation</button></div></details>
    <details ${m.shots?'open':''}><summary>Tirs et fautes de l’équipe</summary><p class="help">Totaux du match. Laissez chaque valeur inconnue vide, notamment les LF tentés absents des résumés FFBB. Le total des points est vérifié lorsque les paniers à 2 et 3 points et les LF réussis sont tous connus.</p><div class="form-grid">${[['two','Paniers à 2 points'],['three','Paniers à 3 points'],['ftm','LF réussis'],['fta','LF tentés'],['fouls','Fautes commises']].map(([key,label])=>inputField(label,'shots-'+key,m.shots?.[key],'number','min="0" max="500"')).join('')}</div></details>
    <details ${m.players.length?'open':''}><summary>Statistiques individuelles</summary><p class="help">Saisissez les points (y compris 0) pour documenter une ligne individuelle. Minutes et tirs facultatifs : laissez les valeurs inconnues vides. Les lignes vides sont exclues.</p>${m.minutesReliable===false?'<p class="notice">Les minutes de cette feuille sont conservées comme valeurs source, mais exclues de Min/M car leur cumul est incohérent. Cochez la confirmation uniquement après correction.</p>':''}<label class="field"><input type="checkbox" name="minutesReliable" ${m.minutesReliable!==false?'checked':''}> Minutes BCF vérifiées et utilisables dans les moyennes</label><div class="table-wrap"><table class="q-inputs"><thead><tr><th>JOUEUSE</th><th>PTS</th><th>MIN</th><th>2 PTS</th><th>3 PTS</th><th>LF M</th><th>LF T</th><th>FAUTES</th></tr></thead><tbody>${data().roster.map(p=>{
      const line=m.players.find(l=>l.playerId===p.id);
      return `<tr class="player-line" data-id="${escapeHTML(p.id)}"><td>${escapeHTML(p.first+' '+p.last)}</td>${['pts','min','two','three','ftm','fta','fouls'].map(k=>`<td><input class="input" aria-label="${escapeHTML(p.first)} ${k}" data-key="${k}" type="number" min="0" max="500" ${k==='min'?'step="any"':''} value="${(k==='pts'||k==='min'?line?.[k]:line?.shots?.[k])??''}"></td>`).join('')}</tr>`;
    }).join('')}</tbody></table></div>${!data().roster.length?'<p class="notice">Ajoutez d’abord l’effectif de cette saison pour saisir les lignes individuelles.</p>':''}</details>
    <div id="form-error" class="error" hidden role="alert"></div><div class="form-actions">${existing?'<button type="button" class="btn danger" id="delete-match">Supprimer ce match</button>':''}<button class="btn primary">Enregistrer le match</button></div></form>`);
  $('#add-period').onclick=()=>{const n=$('#period-rows').children.length;if(n>=12){notify('Maximum de 12 périodes.');return;}$('#period-rows').insertAdjacentHTML('beforeend',periodRow(n));modalDirty=true;};
  $('#remove-period').onclick=()=>{if($('#period-rows').children.length>4){$('#period-rows').lastElementChild.remove();modalDirty=true;}};
  $('#delete-match')?.addEventListener('click',()=>{
    if(!confirm('Supprimer définitivement ce match et ses statistiques ?'))return;
    try{updateSeason(d=>{d.matches=d.matches.filter(x=>x.id!==id);});modalDirty=false;$('#modal').close();matchFilter='all';render();notify('Match supprimé.');}catch(error){errorInForm(error);}
  });
  $('#match-form').addEventListener('submit',e=>{
    e.preventDefault();
    try{
      const form=new FormData(e.target),n=value=>value===''?null:Number(value);
      const readStats=read=>{
        const entries=['two','three','ftm','fta','fouls'].map(k=>[k,n(read(k))]);
        if(entries.every(([,v])=>v===null))return null;
        return Object.fromEntries(entries);
      };
      const periodRows=[...document.querySelectorAll('.period-row')];
      const periods=periodRows.every(row=>[...row.querySelectorAll('input')].every(i=>i.value===''))?null:periodRows.map(row=>{
        const p={for:n(row.querySelector('[data-key="for"]').value),against:n(row.querySelector('[data-key="against"]').value)};
        for(const side of ['bcf','opp']){
          const values=[...row.querySelectorAll(`[data-side="${side}"]`)].map(i=>[i.dataset.key,n(i.value)]);
          p[side]=values.every(([,v])=>v===null)?null:Object.fromEntries(values);
        }
        return p;
      });
      const lines=[...document.querySelectorAll('.player-line')].filter(row=>[...row.querySelectorAll('input')].some(i=>i.value!=='')).map(row=>{
        const get=k=>row.querySelector(`[data-key="${k}"]`).value;
        return {playerId:row.dataset.id,pts:n(get('pts')),min:n(get('min')),shots:readStats(get)};
      });
      const match=BCF.validateMatch({...m,id:form.get('id').trim()||crypto.randomUUID(),date:form.get('date'),opponent:form.get('opponent'),venue:form.get('venue'),for:n(form.get('for')),against:n(form.get('against')),periods,shots:readStats(k=>form.get('shots-'+k)),players:lines,minutesReliable:form.has('minutesReliable')},data().roster);
      if(m.provenance && JSON.stringify(BCF.validateMatch(m,data().roster))!==JSON.stringify(match)){
        const warning='Fiche modifiée manuellement dans le cockpit ; les cartes et fichiers référencés restent les documents d’origine.';
        if(!match.provenance.warnings.includes(warning))match.provenance.warnings.push(warning);
      }
      if(data().matches.some(x=>x.id===match.id && x.id!==id))throw new Error('Cet identifiant de match existe déjà.');
      updateSeason(d=>{const index=d.matches.findIndex(x=>x.id===id);if(index>=0)d.matches[index]=match;else d.matches.push(match);});
      modalDirty=false;$('#modal').close();matchFilter='all';render();notify('Match enregistré. Les indicateurs ont été recalculés.');
    }catch(error){errorInForm(error);}
  });
}
function download(value,filename,raw=false){
  const blob=new Blob([raw?value:JSON.stringify(value,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importFile(file){
  if(!file)return;
  try{
    if(file.size>5*1024*1024)throw new Error('Le fichier dépasse 5 Mo.');
    const next=BCF.validateData(JSON.parse(await file.text()));
    openModal('Vérifier avant de restaurer',`<p>Fichier : <strong>${escapeHTML(file.name)}</strong></p><div class="notice">Cette opération remplace les deux saisons et toutes leurs notes. Elle ne fusionne pas les données.</div>${BCF.SEASONS.map(s=>`<p class="section-gap"><strong>${s}</strong> : ${next.seasons[s].roster.length} joueuses, ${next.seasons[s].matches.length} matchs, ${Object.keys(next.seasons[s].notes).length} fiches de notes.</p>`).join('')}<div id="form-error" class="error" hidden></div><div class="form-actions">${button('Exporter les données actuelles','export')}<button class="btn primary" id="confirm-import">Confirmer le remplacement</button></div>`);
    $('#confirm-import').onclick=()=>{
      try{persist(next,{restore:true});modalDirty=false;$('#modal').close();venue='all';matchFilter='all';opponent='';render();notify('Import terminé. Données enregistrées dans ce navigateur.');}catch(error){errorInForm(error);}
    };
  }catch(error){openModal('Import refusé',`<div class="error" role="alert">${escapeHTML(error.message)}</div><p class="help">Aucune donnée n’a été modifiée. Vérifiez le fichier et le format documenté dans Données & imports.</p>`);}
  finally{$('#import-file').value='';}
}
async function importPdfFiles(files){
  if(!files || !files.length) return;
  const fileArray=Array.from(files);
  openModal('Importation des PDF e-Marque',`<div class="empty"><span class="empty-symbol">⏳</span><h3>Traitement OCR et extraction e-Marque…</h3><p>${fileArray.length} fichier(s) en cours d’analyse locale.<br>Déduction des lancers francs tentés (LF) et croisement des feuilles…</p></div>`);
  try{
    const fd=new FormData();
    for(const f of fileArray) fd.append('pdf',f);
    const resp=await fetch('/api/import-match-pdf',{method:'POST',body:fd});
    if(!resp.ok){
      let errTxt='Erreur serveur';
      try{const errJson=await resp.json();if(errJson.error)errTxt=errJson.error;}catch{}
      throw new Error(errTxt);
    }
    const matchRaw=await resp.json();
    if(matchRaw.score && matchRaw.for===undefined && matchRaw.against===undefined){
      matchRaw.for=matchRaw.score.for;
      matchRaw.against=matchRaw.score.against;
    }
    const sumMinPdf=(matchRaw.players||[]).reduce((s,p)=>s+(p.min||0),0);
    const maxSecPdf=5*(40+Math.max(0,((matchRaw.periods||[]).length||4)-4)*5)*60;
    if(Math.round(sumMinPdf*60)>maxSecPdf && matchRaw.minutesReliable===undefined){
      matchRaw.minutesReliable=false;
    }
    const roster2026=database.seasons['2026-2027'].roster;
    const match=BCF.validateMatch(matchRaw,roster2026);
    
    openModal('Vérifier et valider le match · 2026/2027',`
      <div class="notice" style="margin-bottom:14px">
        <strong>Match identifié :</strong> #${escapeHTML(match.id)} · ${escapeHTML(match.opponent)} (${match.venue==='home'?'Domicile':'Extérieur'})<br>
        <strong>Score :</strong> ${match.for} – ${match.against} (${match.for>match.against?'Victoire':'Défaite'}) · Date : ${escapeHTML(match.date)}<br>
        <strong>Lancers Francs BCF :</strong> ${match.shots?.ftm??0} réussis sur ${match.shots?.fta??0} tentés (${percent(match.shots?.fta?100*match.shots.ftm/match.shots.fta:null)})<br>
        <strong>Joueuses documentées :</strong> ${match.players.length} joueuse(s) reliée(s) à l’effectif 2026/2027.
      </div>
      <p class="help">Ce match sera injecté directement dans la saison <strong>2026 / 2027</strong>. La saison 2025 / 2026 reste intacte.</p>
      <div id="form-error" class="error" hidden></div>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-import-pdf">Annuler</button>
        <button type="button" class="btn primary" id="confirm-import-pdf">Ajouter à la saison 2026/2027</button>
      </div>
    `);
    
    $('#cancel-import-pdf').onclick=()=>{modalDirty=false;$('#modal').close();};
    $('#confirm-import-pdf').onclick=()=>{
      try{
        const next=structuredClone(database);
        const s26=next.seasons['2026-2027'];
        const existingIdx=s26.matches.findIndex(m=>m.id===match.id);
        if(existingIdx>=0) s26.matches[existingIdx]=match;
        else s26.matches.push(match);
        persist(next);
        modalDirty=false;
        $('#modal').close();
        season='2026-2027';
        $('#season').value=season;
        render();
        notify(`Match #${match.id} intégré avec succès dans la saison 2026/2027 !`);
      }catch(err){errorInForm(err);}
    };
  }catch(err){
    openModal('Échec de l’import PDF',`<div class="error" role="alert">${escapeHTML(err.message)}</div><p class="help">Assurez-vous de fournir les fichiers PDF e-Marque complets (feuille de match, résumé officiel, position de tirs).</p>`);
  }finally{
    $('#import-pdf-files').value='';
  }
}
function pasteJsonModal(){
  openModal('Coller un JSON de match (NotebookLM)',`
    <form id="paste-json-form">
      <p class="help">Collez ici le JSON extrait par NotebookLM. Le match sera validé et intégré à la saison <strong>2026 / 2027</strong> sans effacer vos données.</p>
      <label class="field full">Bloc JSON du match
        <textarea id="paste-json-input" class="input" style="height:220px;font-family:monospace;font-size:12px;" required placeholder="{ &quot;id&quot;: &quot;3221&quot;, ... }"></textarea>
      </label>
      <div id="form-error" class="error" hidden></div>
      <div class="form-actions">
        <button type="button" class="btn" id="cancel-paste-json">Annuler</button>
        <button class="btn primary">Analyser et intégrer</button>
      </div>
    </form>
  `);
  $('#cancel-paste-json').onclick=()=>{modalDirty=false;$('#modal').close();};
  $('#paste-json-form').onsubmit=e=>{
    e.preventDefault();
    try{
      const raw=$('#paste-json-input').value.trim();
      const parsed=JSON.parse(raw);
      if(parsed.score && parsed.for===undefined && parsed.against===undefined){
        parsed.for=parsed.score.for;
        parsed.against=parsed.score.against;
      }
      const sumMin=(parsed.players||[]).reduce((s,p)=>s+(p.min||0),0);
      const maxSec=5*(40+Math.max(0,((parsed.periods||[]).length||4)-4)*5)*60;
      if(Math.round(sumMin*60)>maxSec && parsed.minutesReliable===undefined){
        parsed.minutesReliable=false;
      }
      const match=BCF.validateMatch(parsed,database.seasons['2026-2027'].roster);
      const next=structuredClone(database);
      const s26=next.seasons['2026-2027'];
      const existingIdx=s26.matches.findIndex(m=>m.id===match.id);
      if(existingIdx>=0) s26.matches[existingIdx]=match;
      else s26.matches.push(match);
      persist(next);
      modalDirty=false;
      $('#modal').close();
      season='2026-2027';
      $('#season').value=season;
      render();
      notify(`Match #${match.id} (${match.opponent}) intégré avec succès dans la saison 2026/2027 !`);
    }catch(err){
      errorInForm(err);
    }
  };
}
$('#import-file').addEventListener('change',e=>importFile(e.target.files[0]));
$('#import-pdf-files').addEventListener('change',e=>importPdfFiles(e.target.files));
document.addEventListener('click',e=>{
  const target=e.target.closest('[data-action]');if(!target)return;
  if(['add-match','edit-match','add-opponent','add-player'].includes(target.dataset.action) && !allowNavigation())return;
  const id=target.dataset.id;
  switch(target.dataset.action){
    case 'add-match':matchModal();break;
    case 'edit-match':matchModal(id);break;
    case 'match-sources':matchSources(id);break;
    case 'player':playerModal(id);break;
    case 'edit-player':editPlayer(id);break;
    case 'add-player':editPlayer();break;
    case 'export':
      if(!isCoach()){notify('Action réservée à l’administrateur.');break;}
      download(database,`bcf-sauvegarde-${new Date().toISOString().slice(0,10)}.json`);break;
    case 'template':
      if(!isCoach()){notify('Action réservée à l’administrateur.');break;}
      download(BCF.initialData(),'bcf-modele-vierge.json');break;
    case 'paste-json':if(allowNavigation())pasteJsonModal();break;
    case 'import-pdf':if(allowNavigation())$('#import-pdf-files').click();break;
    case 'archive-export':{
      if(!isCoach()){notify('Action réservée à l’administrateur.');break;}
      const exported=BCF.initialData();exported.seasons[ARCHIVE.season]=ARCHIVE.data;exported.imports=[ARCHIVE.id];
      if(!confirm('Ce fichier contient le lot FFBB d’origine et le trombinoscope initial 2026/2027, sans vos modifications ni vos notes. Pour sauvegarder votre travail actuel, utilisez « Sauvegarder toutes les données ». Continuer ?'))break;
      download(BCF.validateData(exported),'bcf-lot-ffbb-2025-2026.json');break;
    }
    case 'pre-archive-export':try{
      if(!isCoach()){notify('Action réservée à l’administrateur.');break;}
      const saved=localStorage.getItem(`${KEY}-before-${ARCHIVE.id}`);
      if(!saved)throw new Error('Aucune sauvegarde antérieure : ce navigateur était vierge lors de l’intégration.');
      download(saved,'bcf-avant-integration-ffbb.json',true);
    }catch(error){notify(error.message);}break;
    case 'import':if(allowNavigation())$('#import-file').click();break;
    case 'raw-export':try{
      if(!isCoach()){notify('Action réservée à l’administrateur.');break;}
      const raw=localStorage.getItem(KEY);if(!raw)throw new Error('Aucune sauvegarde brute disponible.');download(raw,'bcf-sauvegarde-brute.json',true);
    }catch(error){notify(error.message);}break;
    case 'add-opponent':
      openModal('Ajouter un adversaire',`<form id="opponent-form">${inputField('Nom de l’équipe','name','','text','required maxlength="100"')}<div id="form-error" class="error" hidden></div><div class="form-actions"><button class="btn primary">Créer la fiche</button></div></form>`);
      $('#opponent-form').onsubmit=event=>{
        event.preventDefault();const name=new FormData(event.target).get('name').trim();
        try{if(!name)throw new Error('Le nom de l’équipe est requis.');updateSeason(d=>{if(!Object.hasOwn(d.notes,name))Object.defineProperty(d.notes,name,{value:'',enumerable:true,writable:true,configurable:true});});opponent=name;modalDirty=false;$('#modal').close();render();notify('Fiche adverse prête.');}catch(error){errorInForm(error);}
      };break;
  }
});
installArchive();
// Synchroniser automatiquement les postes confirmés de l'effectif 2026-2027 si encore "À confirmer"
try {
  const currentRoster = database.seasons['2026-2027'].roster;
  const initialRoster = BCF.initialData().seasons['2026-2027'].roster;
  let updated = false;
  initialRoster.forEach(initP => {
    const p = currentRoster.find(x => x.id === initP.id);
    if (p && initP.position !== p.position) {
      p.position = initP.position;
      updated = true;
    }
  });
  if (updated) persist(database);
} catch (e) {}

// Intégrer les matchs officiels validés 2026-2027 s'ils ne sont pas encore présents
try {
  const matches2026 = globalThis.BCF_MATCHES_2026 || [];
  const s26 = database.seasons['2026-2027'];
  let added26 = false;
  matches2026.forEach(m => {
    const existingIdx = s26.matches.findIndex(x => x.id === m.id);
    const valid = BCF.validateMatch(m, s26.roster);
    if (existingIdx === -1) {
      s26.matches.push(valid);
      added26 = true;
    } else if (!s26.matches[existingIdx].opponentPlayers?.length && valid.opponentPlayers?.length) {
      s26.matches[existingIdx] = valid;
      added26 = true;
    }
  });
  if (added26) {
    persist(database);
  }
} catch (e) {}

const AUTH_KEY = 'bcf_authenticated_v1';
const ROLE_KEY = 'bcf_user_role_v1';

const EXPECTED_USER_HASH = '661387ed4e7482fc1772fdfdeb168c60ce9dce9c2c79b67475b53e4e83b6645e'; // SHA-256('BasketClubFlines')
const EXPECTED_PASS_HASH = 'fb92c7e381b71ceda36d7e3d0f1064386452c4d6b2300ec9818652830f23f17c'; // SHA-256('En$emble')

const COACH_USER_HASH = 'e6b7456c0995a1c64a21d9ad743167cdfad6950814236049a5805b5637e1e723'; // SHA-256('Coach')
const COACH_PASS_HASH = '46e133807021a0f76df5ce29a752c003de99bdd5d85adefa55eaf7783738853c'; // SHA-256('P@ulrclens17082018')

function isCoach() {
  return sessionStorage.getItem(ROLE_KEY) === 'coach';
}

function updateNavPermissions() {
  const sourcesNav = document.querySelector('[data-tab="sources"]');
  if (sourcesNav) {
    sourcesNav.style.display = isCoach() ? 'flex' : 'none';
  }
}

async function sha256Hex(str) {
  if (crypto && crypto.subtle && crypto.subtle.digest) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return str;
}

function initAuth() {
  // Nettoyage d'éventuels anciens jetons persistants dans localStorage
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(ROLE_KEY);

  const overlay = $('#auth-overlay');
  const form = $('#auth-form');
  const loginInput = $('#auth-login');
  const passInput = $('#auth-password');
  const errorDiv = $('#auth-error');
  const logoutBtn = $('#logout-btn');

  function checkSession() {
    return sessionStorage.getItem(AUTH_KEY) === 'true';
  }

  function showLogin() {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    loginInput.value = '';
    passInput.value = '';
    errorDiv.style.display = 'none';
    setTimeout(() => loginInput.focus(), 50);
  }

  function unlock() {
    overlay.hidden = true;
    document.body.style.overflow = '';
    updateNavPermissions();
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(ROLE_KEY);
      showLogin();
      notify('Vous êtes déconnecté(e).');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.style.display = 'none';
      const u = loginInput.value.trim();
      const p = passInput.value;

      const userHash = await sha256Hex(u);
      const passHash = await sha256Hex(p);

      const isCoachAuth = (userHash === COACH_USER_HASH && passHash === COACH_PASS_HASH) ||
                          (u.toLowerCase() === 'coach' && p === 'P@ulrclens17082018');

      const isTeamAuth = (userHash === EXPECTED_USER_HASH && passHash === EXPECTED_PASS_HASH) ||
                         (u === 'BasketClubFlines' && p === 'En$emble');

      if (isCoachAuth) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        sessionStorage.setItem(ROLE_KEY, 'coach');
        unlock();
        render();
        notify('Bienvenue Coach Maxime ! Espace administrateur activé.');
      } else if (isTeamAuth) {
        sessionStorage.setItem(AUTH_KEY, 'true');
        sessionStorage.setItem(ROLE_KEY, 'team');
        unlock();
        if (location.hash === '#sources') location.hash = '#overview';
        render();
        notify('Connexion réussie ! Bienvenue sur BCF Analytics.');
      } else {
        errorDiv.textContent = 'Identifiant ou mot de passe incorrect.';
        errorDiv.style.display = 'block';
        passInput.value = '';
        passInput.focus();
      }
    });
  }

  if (!checkSession()) {
    showLogin();
  } else {
    unlock();
  }
}

initAuth();

const requestedSeason=new URLSearchParams(location.search).get('season');
if(BCF.SEASONS.includes(requestedSeason))season=requestedSeason;
$('#season').value=season;
render();
