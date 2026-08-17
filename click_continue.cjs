const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  console.log('Connected to page:', await page.title());
  
  // Click the Continue button
  await page.click('button:has-text("Continue")');
  console.log('Clicked Continue');
  
  await new Promise(r => setTimeout(r, 2000));
  await page.screenshot({ path: 'child_playwright_1.png' });
  console.log('Screenshot saved to child_playwright_1.png');
  
  await browser.close();
})();
