const {test,expect}=require('@playwright/test');
const BCF=require('../data');

test('saison historique, cartes et scouting visibles et persistants',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/?season=2025-2026');
  await expect(page.getByLabel('Saison',{exact:true})).toHaveValue('2025-2026');
  await expect(page.getByText('3V – 19D',{exact:true})).toBeVisible();
  await expect(page.getByText('41,1',{exact:true})).toBeVisible();
  await expect(page.getByText('63,2',{exact:true})).toBeVisible();
  await expect(page.getByText('132 / 230 · 19 matchs complets',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText('3V – 19D',{exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Matchs & quart-temps'}).click();
  await page.locator('#match-filter').selectOption('4014');
  await expect(page.locator('.quarter-scores')).toContainText('8 – 18');
  await page.getByRole('button',{name:'Sources & tirs'}).click();
  await expect(page.getByRole('heading',{name:'Sources du match #4014'})).toBeVisible();
  await expect(page.locator('.shot-map')).toHaveCount(2);
  for(const image of await page.locator('.shot-map').all()){
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(i=>i.complete&&i.naturalWidth>0)).toBeTruthy();
  }
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('link',{name:'Effectif & statistiques'}).click();
  await page.getByLabel('Rechercher une joueuse').fill('Alexia');
  await page.locator('.player-card').click();
  await expect(page.getByText('Exclues : cumul incohérent').first()).toBeVisible();
  await page.getByRole('button',{name:'Fermer',exact:true}).click();
  await page.getByRole('link',{name:'Scouting adverse'}).click();
  await page.locator('#opponent').selectOption('RONCQ U S');
  await expect(page.getByRole('row').filter({hasText:'Eudoxie Guetiere'})).toContainText('17');
  await page.getByRole('link',{name:'Données & imports'}).click();
  await expect(page.getByText('22 matchs complets sur 22.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('migration de la sauvegarde existante sans toucher aux notes et à 2026/2027',async({page})=>{
  const previous=BCF.initialData();
  previous.seasons['2026-2027'].notes.Roncq='Conserver cette consigne';
  previous.seasons['2026-2027'].roster[0].number=3;
  await page.goto('/');
  await page.evaluate(value=>localStorage.setItem('bcf-analytics-v1',JSON.stringify(value)),previous);
  await page.reload();
  const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('bcf-analytics-v1')));
  expect(stored.seasons['2025-2026'].matches).toHaveLength(22);
  expect(stored.seasons['2026-2027'].notes.Roncq).toBe('Conserver cette consigne');
  expect(stored.seasons['2026-2027'].roster[0].number).toBe(3);
  const backup=await page.evaluate(()=>JSON.parse(localStorage.getItem('bcf-analytics-v1-before-ffbb-2025-2026-20260926-lf')));
  expect(backup).toEqual(previous);
});

test('éditer un match historique conserve tirs partiels, adversaires et provenance',async({page})=>{
  await page.goto('/?season=2025-2026#matches');
  await page.locator('#match-filter').selectOption('4002');
  await page.getByRole('button',{name:'Consulter / modifier'}).click();
  await page.getByRole('button',{name:'Enregistrer le match'}).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  const m=await page.evaluate(()=>JSON.parse(localStorage.getItem('bcf-analytics-v1')).seasons['2025-2026'].matches.find(m=>m.id==='4002'));
  expect(m.shots.fta).toBe(16);
  expect(m.opponentPlayers).toHaveLength(9);
  expect(m.provenance.files).toHaveLength(3);
  expect(m.minutesReliable).toBe(false);
  expect(m.players[0].min).toBe(24+43/60);
  await page.locator('#match-filter').selectOption('4002');
  await page.getByRole('button',{name:'Consulter / modifier'}).click();
  page.once('dialog',d=>d.accept());
  await page.getByRole('button',{name:'Supprimer ce match'}).click();
  await page.reload();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('bcf-analytics-v1')).seasons['2025-2026'].matches.length)).toBe(21);
});
