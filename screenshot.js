import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  await page.goto('http://localhost:5173/');
  await page.evaluate(() => { localStorage.setItem('staykids_selected_role', 'parent'); });
  await page.reload();
  
  await page.click('button:has-text("Continue")');
  await page.waitForSelector('input[type="email"]');
  
  await page.click('button:has-text("Sign In")');
  await page.fill('input[type="email"]', 'mdselimshekh.info@gmail.com');
  await page.fill('input[type="password"]', 'Mdselim@121');
  await page.click('button:has-text("Sign In to StayKids")');
  
  await page.waitForTimeout(3000);
  await page.click('text=Add Child Device').catch(() => {});
  
  await page.waitForTimeout(2000);
  await page.fill('input[placeholder="e.g. Noah / Emma"]', 'Test Child ' + Math.floor(Math.random()*1000)).catch(() => {});
  await page.fill('input[placeholder="e.g. Galaxy A54 / Xiaomi Pad 6"]', 'Pixel Emulator').catch(() => {});
  await page.click('button:has-text("Confirm & Generate Pairing PIN")').catch(() => {});
  
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\add_child_error.png' });
  
  await page.click('button:has-text("Done & Close")').catch(() => {});
  
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_parent_dashboard.png' });
  
  await browser.close();
})()
