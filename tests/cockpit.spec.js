const {test,expect}=require('@playwright/test');
const BCF=require('../data.js');

test('accueil, effectif, profil et historique sans données inventées',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'Vue d’ensemble',exact:true})).toBeVisible();
  await expect(page.getByText('0 match renseigné',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Effectif & statistiques'}).click();
  await expect(page.locator('.player-card')).toHaveCount(11);
  await expect(page.locator('.player-card img')).toHaveCount(11);
  for(const image of await page.locator('.player-card img').all()){
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBeTruthy();
  }
  await page.getByLabel('Rechercher une joueuse').fill('Alexia');
  await expect(page.locator('.player-card')).toHaveCount(1);
  await page.locator('.player-card').click();
  await expect(page.getByRole('heading',{name:'Alexia Morival'})).toBeVisible();
  await expect(page.getByText('#14 · Capitaine')).toBeVisible();
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByLabel('Saison',{exact:true}).selectOption('2025-2026');
  await expect(page.locator('.player-card')).toHaveCount(11);
  expect(errors).toEqual([]);
});

async function fillMatch(page){
  await page.getByRole('button',{name:'+ Ajouter un match',exact:true}).first().click();
  await page.getByLabel('Identifiant / numéro FFBB').fill('4173');
  await page.getByLabel('Date',{exact:true}).fill('2026-09-26');
  await page.getByLabel('Adversaire',{exact:true}).fill('Roncq US');
  await page.getByLabel('Score final BCF',{exact:true}).fill('60');
  await page.getByLabel('Score final adverse',{exact:true}).fill('50');
}
test('saisie réelle, calculs, édition, suppression et persistance',async({page})=>{
  await page.goto('/');await fillMatch(page);
  await page.getByText('Quart-temps & prolongations',{exact:true}).click();
  for(let i=1;i<=4;i++){
    await page.getByLabel(`${i} points BCF`,{exact:true}).fill('15');
    await page.getByLabel(`${i} points adversaire`,{exact:true}).fill(i%2?'10':'15');
  }
  await page.getByText('Tirs et fautes de l’équipe',{exact:true}).click();
  for(const [label,value] of [['Paniers à 2 points','20'],['Paniers à 3 points','5'],['LF réussis','5'],['LF tentés','8'],['Fautes commises','15']]){
    await page.getByLabel(label,{exact:true}).fill(value);
  }
  await page.getByText('Statistiques individuelles',{exact:true}).click();
  await page.getByLabel('Alexia pts',{exact:true}).fill('10');
  await page.getByLabel('Alexia min',{exact:true}).fill('22.5');
  await page.getByRole('button',{name:'Enregistrer le match'}).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  await expect(page.getByText('1V – 0D',{exact:true})).toBeVisible();
  await expect(page.getByText('62,5 %',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByText('1V – 0D',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Effectif & statistiques'}).click();
  await page.getByRole('button',{name:'Vue statistiques'}).click();
  const row=page.getByRole('row').filter({hasText:'Alexia Morival'});
  await expect(row).toContainText('22,5');await expect(row).toContainText('10');
  await page.getByRole('link',{name:'Matchs & quart-temps'}).click();
  await expect(page.locator('.bar-chart')).toBeVisible();
  await page.locator('#venue').selectOption('away');
  await expect(page.getByText('0 match renseigné',{exact:true})).toBeVisible();
  await page.locator('#venue').selectOption('home');
  await page.getByRole('button',{name:'Consulter / modifier'}).click();
  await page.getByLabel('Score final BCF',{exact:true}).fill('61');
  await page.getByRole('button',{name:'Enregistrer le match'}).click();
  await expect(page.locator('#form-error')).toContainText('somme des périodes');
  await page.getByLabel('Score final BCF',{exact:true}).fill('60');
  await page.getByRole('button',{name:'Enregistrer le match'}).click();
  await page.getByRole('button',{name:'Consulter / modifier'}).click();
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'Supprimer ce match'}).click();
  await expect(page.getByText('0 match renseigné',{exact:true})).toBeVisible();
});

test('notes séparées par saison, échappement et avertissement non enregistré',async({page})=>{
  await page.goto('/#scouting');
  await page.getByRole('button',{name:'+ Ajouter un adversaire'}).click();
  await page.getByLabel('Nom de l’équipe').fill('Roncq <test>');
  await page.getByRole('button',{name:'Créer la fiche'}).click();
  await page.locator('#notes').fill('Priorité au rebond <script>alert(1)</script>');
  await page.getByRole('button',{name:'Enregistrer les notes'}).click();
  await page.reload();
  await expect(page.locator('#notes')).toHaveValue('Priorité au rebond <script>alert(1)</script>');
  await page.locator('#notes').fill('Note non enregistrée');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('link',{name:'Vue d’ensemble'}).click();
  await expect(page.locator('#notes')).toHaveValue('Note non enregistrée');
  await page.getByRole('button',{name:'Enregistrer les notes'}).click();
  await page.getByLabel('Saison',{exact:true}).selectOption('2025-2026');
  await expect(page.locator('#notes')).toHaveValue('');
  await page.getByLabel('Saison',{exact:true}).selectOption('2026-2027');
  await expect(page.locator('#notes')).toHaveValue('Note non enregistrée');
});

test('import atomique, refus des données invalides, sauvegarde exportée',async({page})=>{
  await page.goto('/#sources');
  const next=BCF.initialData();
  next.seasons['2025-2026'].matches.push({id:'test',date:'2025-10-01',opponent:'Orchies',venue:'away',for:50,against:60,players:[]});
  await page.locator('#import-file').setInputFiles({name:'saison.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(next))});
  await expect(page.getByRole('heading',{name:'Vérifier avant de restaurer'})).toBeVisible();
  await expect(page.getByText('2025-2026 : 0 joueuses, 1 matchs, 0 fiches de notes.')).toBeVisible();
  await page.getByRole('button',{name:'Confirmer le remplacement'}).click();
  await page.getByLabel('Saison',{exact:true}).selectOption('2025-2026');
  await page.getByRole('link',{name:'Vue d’ensemble'}).click();
  await expect(page.getByText('0V – 1D',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('0V – 1D',{exact:true})).toBeVisible();
  await page.locator('#import-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});
  await expect(page.getByRole('heading',{name:'Import refusé'})).toBeVisible();
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await expect(page.getByText('0V – 1D',{exact:true})).toBeVisible();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exporter',exact:false}).click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^bcf-sauvegarde/);
  const fs=require('node:fs');
  const exported=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  expect(exported.seasons['2025-2026'].matches[0].against).toBe(60);
});

test('nomenclature opérationnelle et page mobile sans débordement',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/#sources');
  await page.getByRole('button',{name:'Analyser le nom'}).click();
  await expect(page.locator('#filename-result')).toContainText('Domicile');
  await page.locator('#filename').fill('positiontir_0059_DF2_A_4173_RONCQ_U_S_FLINES_LEZ_RACHES_BC.pdf');
  await page.getByRole('button',{name:'Analyser le nom'}).click();
  await expect(page.locator('#filename-result')).toContainText('Extérieur');
  for(const route of ['overview','roster','matches','sources','scouting']){
    await page.goto('/#'+route);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
});

test('stockage corrompu signalé sans écrasement',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>localStorage.setItem('bcf-analytics-v1','corrompu'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('sauvegarde locale est illisible');
  await fillMatch(page);
  await page.getByRole('button',{name:'Enregistrer le match'}).click();
  await expect(page.locator('#form-error')).toContainText('Sauvegarde bloquée');
  expect(await page.evaluate(()=>localStorage.getItem('bcf-analytics-v1'))).toBe('corrompu');
});

test('bouton et interface d’import PDF e-Marque réservée à 2026/2027',async({page})=>{
  await page.goto('/#sources');
  await expect(page.getByRole('button',{name:'🏀 Importer des PDF e-Marque (2026/2027)'})).toBeVisible();
  await expect(page.getByText('Saison 2026/2027 : Glissez ou sélectionnez les 3 fichiers PDF FFBB d’une rencontre')).toBeVisible();
});

