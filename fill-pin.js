import { chromium } from 'playwright';

(async () => {
  try {
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const contexts = browser.contexts();
    const page = contexts[0].pages()[0];
    
    console.log("Connected to WebView!");
    
    // The PIN input is typically an input with maxLength=6 or placeholder containing "6-digit"
    await page.waitForSelector('input[placeholder*="6-digit"]', { timeout: 5000 });
    console.log("Found PIN input!");
    
    await page.type('input[placeholder*="6-digit"]', '537357', { delay: 100 });
    console.log("Typed PIN.");
    
    await page.click('button:has-text("Continue")');
    console.log("Clicked Continue.");
    
    await page.waitForTimeout(5000);
    console.log("Done waiting. Checking if URL changed or if we are on Step 2");
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();
