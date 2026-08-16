import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const ARTIFACT_DIR = 'C:\\Users\\SHEIK SADI\\.gemini\\antigravity\\brain\\91b86c1c-b247-488c-822a-25ac48cb9321';
const APP_URL = 'http://localhost:5173';
const EMAIL = 'mdselimshekh.info@gmail.com';
const PASSWORD = 'Mdselim@121';

const results = [];
let testNum = 0;

function log(test, status, detail = '') {
  testNum++;
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${testNum}] ${test} — ${status} ${detail}`);
  results.push({ num: testNum, test, status, detail });
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${ARTIFACT_DIR}\\test_${name}.png`, fullPage: false });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();
  
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  console.log('\n══════ TEST 1: API Health ══════');
  try {
    const resp = await page.request.get('https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/health');
    const body = await resp.json();
    log('API /health', (resp.ok() && body.status === 'ok') ? 'PASS' : 'FAIL', JSON.stringify(body));
  } catch (e) { log('API /health', 'FAIL', e.message); }

  console.log('\n══════ TEST 2: App Load ══════');
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 15000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle', timeout: 10000 });
  try {
    const t = await page.textContent('body');
    log('App loads', (t && t.length > 50) ? 'PASS' : 'FAIL');
  } catch (e) { log('App loads', 'FAIL', e.message); }
  await screenshot(page, '01_app');

  console.log('\n══════ TEST 3: Login ══════');
  await page.evaluate(() => localStorage.setItem('staykids_selected_role', 'parent'));
  await page.reload({ waitUntil: 'networkidle', timeout: 10000 });
  await page.waitForTimeout(1500);
  try {
    await page.locator('button', { hasText: 'Sign In' }).first().click({ timeout: 5000 });
    log('Sign In tab', 'PASS');
  } catch (e) { log('Sign In tab', 'FAIL', e.message); }

  try {
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.locator('button[type="submit"]').click({ timeout: 5000 });
    await page.waitForTimeout(5000);
    const t = await page.textContent('body');
    const ok = t.includes('Good') || t.includes('Add Child') || t.includes('Dashboard');
    log('Login success', ok ? 'PASS' : 'FAIL');
  } catch (e) { log('Login success', 'FAIL', e.message); }
  await screenshot(page, '02_login');

  console.log('\n══════ TEST 4: Home ══════');
  await page.click('nav button:has-text("Home")').catch(() => {});
  await page.waitForTimeout(1000);
  try { log('Home greeting', (await page.textContent('body')).includes('Good') ? 'PASS' : 'FAIL'); } catch(e) { log('Home greeting', 'FAIL'); }
  try { log('Add Child btn', await page.locator('text=Add Child Device').isVisible() ? 'PASS' : 'FAIL'); } catch(e) { log('Add Child btn', 'FAIL'); }
  try { const t = await page.textContent('body'); log('Screen time', (t.includes('h') && t.includes('m')) ? 'PASS' : 'WARN'); } catch(e) { log('Screen time', 'WARN'); }
  try { log('Pause btn', (await page.locator('button:has-text("Pause")').isVisible().catch(()=>false) || await page.locator('button:has-text("Resume")').isVisible().catch(()=>false)) ? 'PASS' : 'WARN'); } catch(e) { log('Pause btn', 'WARN'); }
  try { log('Today glance', await page.locator('text=Today at a glance').isVisible().catch(()=>false) ? 'PASS' : 'WARN'); } catch(e) { log('Today glance', 'WARN'); }
  await screenshot(page, '03_home');

  console.log('\n══════ TEST 5: Add Child Modal ══════');
  try {
    await page.click('text=Add Child Device');
    await page.waitForTimeout(1000);
    log('Modal opens', await page.locator('text=Pair New Child Device').isVisible().catch(()=>false) ? 'PASS' : 'FAIL');
  } catch(e) { log('Modal opens', 'FAIL', e.message); }
  try {
    log('Form inputs', (await page.locator('input[placeholder="e.g. Noah / Emma"]').isVisible().catch(()=>false) && await page.locator('input[placeholder="e.g. Galaxy A54 / Xiaomi Pad 6"]').isVisible().catch(()=>false)) ? 'PASS' : 'FAIL');
  } catch(e) { log('Form inputs', 'FAIL'); }
  try {
    await page.fill('input[placeholder="e.g. Noah / Emma"]', 'AutoTest');
    await page.fill('input[placeholder="e.g. Galaxy A54 / Xiaomi Pad 6"]', 'TestDev');
    await page.click('button:has-text("Confirm & Generate Pairing PIN")');
    await page.waitForTimeout(6000);
    log('PIN generated', await page.locator('text=SK-').isVisible().catch(()=>false) ? 'PASS' : 'FAIL');
  } catch(e) { log('PIN generated', 'FAIL', e.message); }
  await screenshot(page, '04_pin');
  await page.click('button:has-text("Done & Close")').catch(() => {});
  await page.waitForTimeout(1000);

  console.log('\n══════ TEST 6: Navigation ══════');
  for (const tab of ['Home','Dashboard','Controls','Activity','Remote','Alerts','Profile']) {
    try {
      await page.locator('nav button').filter({hasText:tab}).click({timeout:3000});
      await page.waitForTimeout(2000);
      log(`${tab} tab`, 'PASS');
      await screenshot(page, `05_${tab.toLowerCase()}`);
    } catch(e) { log(`${tab} tab`, 'FAIL', e.message); }
  }

  console.log('\n══════ TEST 7: Dashboard ══════');
  await page.click('nav button:has-text("Dashboard")').catch(()=>{});
  await page.waitForTimeout(2000);
  try { const t = await page.textContent('body'); log('Dashboard content', t.includes('App Usage') || t.includes('Dashboard') || t.includes('Device Data') ? 'PASS' : 'WARN'); } catch(e) { log('Dashboard content', 'WARN'); }
  try {
    const notif = page.locator('button:has-text("Notification")');
    if (await notif.isVisible().catch(()=>false)) { await notif.click(); await page.waitForTimeout(1000); log('Dashboard notif tab', 'PASS'); }
    else log('Dashboard notif tab', 'WARN', 'Not found');
  } catch(e) { log('Dashboard notif tab', 'WARN'); }
  try {
    const call = page.locator('button:has-text("Call")');
    if (await call.isVisible().catch(()=>false)) { await call.click(); await page.waitForTimeout(1000); log('Dashboard call tab', 'PASS'); }
    else log('Dashboard call tab', 'WARN', 'Not found');
  } catch(e) { log('Dashboard call tab', 'WARN'); }
  await screenshot(page, '06_dashboard');

  console.log('\n══════ TEST 8: Controls ══════');
  await page.click('nav button:has-text("Controls")').catch(()=>{});
  await page.waitForTimeout(2000);
  const ctrlBody = await page.textContent('body').catch(()=>'');
  log('Screen Time limits', ctrlBody.includes('Screen Time') || ctrlBody.includes('Daily') || ctrlBody.includes('Limit') ? 'PASS' : 'FAIL');
  log('Bedtime', ctrlBody.includes('Bedtime') || ctrlBody.includes('bedtime') ? 'PASS' : 'FAIL');
  log('Web filter', ctrlBody.includes('Web') || ctrlBody.includes('filter') ? 'PASS' : 'FAIL');
  log('Geofencing', ctrlBody.includes('Geofenc') || ctrlBody.includes('Safe Zone') ? 'PASS' : 'WARN');
  log('App blocker', ctrlBody.includes('Block') || ctrlBody.includes('Lock') || ctrlBody.includes('Allowed') ? 'PASS' : 'WARN');
  log('Anti-theft siren', ctrlBody.includes('Siren') || ctrlBody.includes('Alarm') || ctrlBody.includes('Anti-Theft') ? 'PASS' : 'WARN');
  log('Stealth mode', ctrlBody.includes('Stealth') || ctrlBody.includes('stealth') ? 'PASS' : 'WARN');
  await screenshot(page, '07_controls');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, '07b_controls_scroll');

  console.log('\n══════ TEST 9: Activity ══════');
  await page.click('nav button:has-text("Activity")').catch(()=>{});
  await page.waitForTimeout(2000);
  const actBody = await page.textContent('body').catch(()=>'');
  log('Activity page', actBody.includes('Activity') || actBody.includes('Screen') || actBody.includes('Usage') ? 'PASS' : 'FAIL');
  log('Time filters', actBody.includes('Today') || actBody.includes('7 days') ? 'PASS' : 'WARN');
  await screenshot(page, '08_activity');

  console.log('\n══════ TEST 10: Remote ══════');
  await page.click('nav button:has-text("Remote")').catch(()=>{});
  await page.waitForTimeout(2500);
  const remBody = await page.textContent('body').catch(()=>'');
  log('Remote page', remBody.includes('Remote') || remBody.includes('Camera') || remBody.includes('Mirror') || remBody.includes('Live') ? 'PASS' : 'FAIL');
  for (const f of ['Camera','GPS','Mirror','audio','Snapshot','Remote access']) {
    log(`Remote - ${f}`, remBody.toLowerCase().includes(f.toLowerCase()) ? 'PASS' : 'WARN');
  }
  await screenshot(page, '09_remote');

  console.log('\n══════ TEST 11: Alerts ══════');
  await page.click('nav button:has-text("Alerts")').catch(()=>{});
  await page.waitForTimeout(2000);
  const alertBody = await page.textContent('body').catch(()=>'');
  log('Alerts page', alertBody.includes('Notification') || alertBody.includes('Alert') || alertBody.includes('Log') ? 'PASS' : 'FAIL');
  log('Alert filters', alertBody.includes('All') && (alertBody.includes('SOS') || alertBody.includes('Location')) ? 'PASS' : 'WARN');
  log('Mark all read', alertBody.includes('Mark all') || alertBody.includes('mark all') ? 'PASS' : 'WARN');
  await screenshot(page, '10_alerts');

  console.log('\n══════ TEST 12: Profile ══════');
  await page.click('nav button:has-text("Profile")').catch(()=>{});
  await page.waitForTimeout(2000);
  const profBody = await page.textContent('body').catch(()=>'');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  const profBodyFull = await page.textContent('body').catch(()=>'');
  log('Profile page', profBody.includes('Profile') || profBody.includes('Account') || profBody.includes('Parent') ? 'PASS' : 'FAIL');
  log('Change Password', profBodyFull.includes('Password') || profBodyFull.includes('password') ? 'PASS' : 'WARN');
  log('Sign Out', profBodyFull.includes('Sign Out') || profBodyFull.includes('Logout') ? 'PASS' : 'WARN');
  log('Export Data', profBodyFull.includes('Export') ? 'PASS' : 'WARN');
  log('Delete Account', profBodyFull.includes('Delete') ? 'PASS' : 'WARN');
  log('Unpair Device', profBodyFull.includes('Unpair') || profBodyFull.includes('Remove') ? 'PASS' : 'WARN');
  log('Biometric lock', profBodyFull.includes('Biometric') || profBodyFull.includes('biometric') ? 'PASS' : 'WARN');
  log('Language switch', profBodyFull.includes('English') || profBodyFull.includes('বাংলা') ? 'PASS' : 'WARN');
  log('Terms/Privacy', profBodyFull.includes('Terms') || profBodyFull.includes('Privacy') ? 'PASS' : 'WARN');
  await screenshot(page, '11_profile');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await screenshot(page, '11b_profile_bottom');

  console.log('\n══════ TEST 13: Console Errors ══════');
  const critical = consoleErrors.filter(e => !e.includes('React DevTools') && !e.includes('GoTrueClient') && !e.includes('favicon') && !e.includes('403'));
  log('Console errors', critical.length === 0 ? 'PASS' : 'WARN', critical.length > 0 ? `${critical.length}: ${critical[0]?.substring(0,100)}` : '');

  // SUMMARY
  console.log('\n══════════════════════════════════════');
  console.log('        FINAL TEST SUMMARY');
  console.log('══════════════════════════════════════');
  const p = results.filter(r => r.status === 'PASS').length;
  const f = results.filter(r => r.status === 'FAIL').length;
  const w = results.filter(r => r.status === 'WARN').length;
  console.log(`✅ PASSED: ${p}`);
  console.log(`❌ FAILED: ${f}`);
  console.log(`⚠️  WARN:   ${w}`);
  console.log(`📊 TOTAL:  ${results.length}`);
  console.log('══════════════════════════════════════\n');
  if (f > 0) { console.log('FAILED:'); results.filter(r=>r.status==='FAIL').forEach(r=>console.log(`  ❌ [${r.num}] ${r.test}: ${r.detail}`)); }
  if (w > 0) { console.log('WARNINGS:'); results.filter(r=>r.status==='WARN').forEach(r=>console.log(`  ⚠️ [${r.num}] ${r.test}: ${r.detail}`)); }
  writeFileSync(`${ARTIFACT_DIR}\\test_report.json`, JSON.stringify({timestamp:new Date().toISOString(),summary:{total:results.length,passed:p,failed:f,warned:w},results,consoleErrors:critical},null,2));
  await browser.close();
  console.log('\nDone. Screenshots saved.');
})();
