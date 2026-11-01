import {test,expect} from '@playwright/test';
test.beforeEach(async({page})=>{await page.clock.install({time:new Date('2026-11-01T12:00:00Z')});await page.goto('/');});
test('desktop overview shows verified date and colour',async({page})=>{
 await expect(page.getByRole('heading',{name:'Blue bin',exact:true})).toBeVisible();
 await expect(page.getByText('Monday 2 November',{exact:true})).toBeVisible();
 await page.screenshot({path:'/tmp/eh27-desktop.png',fullPage:true});
});
test('mobile calendar, guide, export, preferences and 7pm setting',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Collection calendar',exact:true}).click();
 await page.getByLabel('Month').selectOption('2027-08');
 await expect(page.getByText('Grey bin',{exact:true})).toHaveCount(3);
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download calendar',exact:false}).click();
 expect((await downloadPromise).suggestedFilename()).toBe('EH27-Bins.ics');
 await page.getByRole('button',{name:'Bin guide',exact:true}).click();
 await expect(page.getByText('Garden waste only with a valid permit')).toBeVisible();
 await page.getByRole('button',{name:'Reminders',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:/Also remind me at 7pm/})).toBeChecked();
 await expect(page.getByText(/Have you kept the blue bin outside/)).toBeVisible();
 await page.getByRole('checkbox',{name:/Also remind me at 7pm/}).uncheck();
 await page.getByRole('checkbox',{name:'Blue',exact:true}).uncheck();
 await page.reload();
 await page.getByRole('button',{name:'Reminders',exact:true}).click();
 await expect(page.getByRole('checkbox',{name:'Blue',exact:true})).not.toBeChecked();
 await expect(page.getByRole('checkbox',{name:/Also remind me at 7pm/})).not.toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Grey bin',exact:true})).toBeVisible();
 await page.screenshot({path:'/tmp/eh27-mobile.png',fullPage:true});
});
test('service worker supports offline reload after first visit',async({page,context})=>{
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();await expect(page.getByRole('heading',{name:/One less thing/})).toBeVisible();
 await context.setOffline(true);await page.reload();
 await expect(page.getByRole('heading',{name:'Blue bin',exact:true})).toBeVisible();await context.setOffline(false);
});
test('API rejects arbitrary push destination and cross-origin writes',async({request})=>{
 const bad=await request.post('/api/subscribe',{headers:{Origin:'http://127.0.0.1:3100'},data:{subscription:{endpoint:'https://127.0.0.1/private',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}},preferences:{bins:['blue'],mode:'exact',time:'18:00',eveningCheck:true}}});expect(bad.status()).toBe(400);
 const cross=await request.post('/api/subscribe',{headers:{Origin:'https://other.example'},data:{}});expect(cross.status()).toBe(403);
 const health=await request.get('/api/health');expect((await health.json()).ok).toBe(true);
});
test('subscription API saves, validates updates and removes subscriptions',async({request})=>{
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/eh27-browser-test',keys:{p256dh:'a'.repeat(87),auth:'b'.repeat(22)}};
 const preferences={bins:['blue'],mode:'exact',time:'18:00',eveningCheck:true};
 const headers={Origin:'http://127.0.0.1:3100'};
 const saved=await request.post('/api/subscribe',{headers,data:{subscription,preferences}});expect(saved.status()).toBe(200);
 const invalid=await request.post('/api/subscribe',{headers,data:{subscription,preferences:{...preferences,bins:['purple']}}});expect(invalid.status()).toBe(400);
 const stolen=await request.post('/api/unsubscribe',{headers,data:{subscription:{...subscription,keys:{...subscription.keys,auth:'c'.repeat(22)}}}});expect(stolen.status()).toBe(403);
 const updated=await request.post('/api/subscribe',{headers,data:{subscription,preferences:{...preferences,eveningCheck:false}}});expect(updated.status()).toBe(200);
 const removed=await request.post('/api/unsubscribe',{headers,data:{subscription}});expect(removed.status()).toBe(200);
 const malformed=await request.get('/%zz');expect(malformed.status()).toBe(400);
});
