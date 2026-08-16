import { chromium } from 'playwright';

(async () => {
  console.log("Starting Live E2E Connection Test...");
  const browser = await chromium.launch({ headless: true });
  const contextParent = await browser.newContext();
  const contextChild = await browser.newContext();

  const pageParent = await contextParent.newPage();
  const pageChild = await contextChild.newPage();

  console.log("Navigating to local dev server...");
  // Navigate both to the dev server (must be running on 5173)
  await pageParent.goto('http://localhost:5173/');
  await pageChild.goto('http://localhost:5173/');

  // Force roles via localStorage
  await pageParent.evaluate(() => { localStorage.setItem('staykids_selected_role', 'parent'); });
  await pageChild.evaluate(() => { localStorage.setItem('staykids_selected_role', 'child'); });

  await pageParent.reload();
  await pageChild.reload();

  console.log("Testing UI flow...");
  // Simulate Parent Login
  await pageParent.click('button:has-text("Continue")');
  await pageParent.waitForSelector('input[type="email"]');
  
  // Switch to Login mode
  await pageParent.click('button:has-text("Sign In")');
  
  await pageParent.fill('input[type="email"]', 'mdselimshekh.info@gmail.com');
  await pageParent.fill('input[type="password"]', 'Mdselim@121');
  await pageParent.click('button:has-text("Sign In to StayKids")');
  
  // Wait for dashboard and click Add Child
  await pageParent.waitForSelector('text=Add Child Device', { timeout: 15000 });
  await pageParent.click('button:has-text("Add Child Device")');

  // Wait for onboarding (Add Child form)
  await pageParent.waitForSelector('text=Pair New Child Device', { timeout: 15000 });
  await pageParent.fill('input[placeholder="e.g. Noah / Emma"]', 'Test Child ' + Math.floor(Math.random()*1000));
  await pageParent.fill('input[placeholder="e.g. Galaxy A54 / Xiaomi Pad 6"]', 'Pixel Emulator');
  await pageParent.click('button:has-text("Confirm & Generate Pairing PIN")');
  
  // Extract pairing code
  await pageParent.waitForSelector('.text-2xl.tracking-\\[\\.3em\\]');
  const fullPinText = await pageParent.textContent('.text-2xl.tracking-\\[\\.3em\\]');
  const code = fullPinText.replace(/[^0-9]/g, '');
  console.log(`Intercepted PIN: ${code}`);

  // Take Parent Screenshot
  await pageParent.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_parent.png' });

  console.log("Testing Child Pairing...");
  // Child App Side
  await pageChild.click('button:has-text("This is a child device")');
  await pageChild.click('button:has-text("Continue")');
  // Wait for the pin input and type the code
  await pageChild.waitForSelector('input[placeholder="Enter 6-digit PIN"]');
  await pageChild.fill('input[placeholder="Enter 6-digit PIN"]', code);
  
  await pageChild.click('button:has-text("Continue →")');
  
  console.log("Waiting for Dashboard Connections...");
  // Wait for dashboards to load showing successful connection
  await pageParent.waitForSelector('text=TestChild', { timeout: 15000 });
  await pageChild.waitForSelector('text=Your device is linked', { timeout: 15000 });
  
  await pageParent.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_parent_dashboard.png' });
  await pageChild.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_child_dashboard.png' });

  console.log("SUCCESS! Connection verified.");
  
  await pageParent.waitForTimeout(2000);
  await pageChild.waitForTimeout(2000);
  
  await pageParent.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_parent_success.png' });
  await pageChild.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_child_success.png' });

  await browser.close();
})().catch(async e => {
  console.error("Test failed:", e);
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => { localStorage.setItem('staykids_selected_role', 'parent'); });
    await page.reload();
    await page.click('button:has-text("Continue")');
    await page.waitForSelector('input[type="email"]');
    await page.click('button:has-text("Sign In")');
    await page.fill('input[type="email"]', 'mdselimshekh.info@gmail.com');
    await page.fill('input[type="password"]', 'Mdselim@121');
    await page.click('button:has-text("Sign In to StayKids")');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321\\live_parent.png' });
    await browser.close();
  } catch (err) {
    console.error("Screenshot failed:", err);
  }
  process.exit(1);
});
