const puppeteer = require('puppeteer-core');
const http = require('http');

http.get('http://127.0.0.1:9222/json', async (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', async () => {
    const targets = JSON.parse(data);
    const pageTarget = targets.find(t => t.type === 'page');
    if (!pageTarget) return console.error('No page target found');
    
    const browser = await puppeteer.connect({
      browserWSEndpoint: pageTarget.webSocketDebuggerUrl,
      defaultViewport: null
    });
    
    const pages = await browser.pages();
    const page = pages[0];
    console.log('Connected to:', await page.title());
    
    await page.click('button:has-text("Continue")');
    console.log('Clicked Continue');
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'child_pup.png' });
    
    await browser.disconnect();
  });
});
