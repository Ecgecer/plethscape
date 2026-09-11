import {test,expect} from '@playwright/test';
test('intro plays once, settles, replays and is easy to skip',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:390,height:844});await page.goto('/');
 const demo=page.locator('.intro-demo');await expect(demo).toBeVisible({timeout:60000});
 await page.screenshot({path:'artifacts/intro-mobile.png'});
 await expect(demo).toContainText('Now add movement.',{timeout:12000});
 await expect(demo).toBeHidden({timeout:12000});
 await page.reload();await expect(page.locator('#signal-workspace')).toBeVisible({timeout:60000});await expect(demo).toBeHidden();
 await page.getByRole('button',{name:'Open menu',exact:true}).click();await page.getByRole('button',{name:'Replay demo',exact:true}).click();await expect(demo).toBeVisible();await page.getByRole('button',{name:'Skip demo'}).click();await expect(demo).toBeHidden();
});
test('shared URLs and reduced motion avoid automatic animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await expect(page.locator('.intro-demo')).toContainText('One heartbeat. Many ways',{timeout:60000});await page.getByRole('button',{name:'Explore',exact:true}).click();await expect(page.locator('.intro-demo')).toBeHidden();
 await page.goto('/?site=wrist');await expect(page.locator('#signal-workspace')).toBeVisible({timeout:60000});await expect(page.locator('.intro-demo')).toBeHidden();
});
