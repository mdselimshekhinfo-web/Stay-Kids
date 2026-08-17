import asyncio, json, urllib.request, websockets, time

async def run():
    try:
        req = urllib.request.urlopen('http://127.0.0.1:9223/json')
        targets = json.loads(req.read().decode('utf-8'))
        ws_url = next(t for t in targets if t['type'] == 'page')['webSocketDebuggerUrl']
        
        js = """
        (function() {
            const btns = document.querySelectorAll('button');
            const signinBtn = Array.from(btns).find(b => b.textContent.includes('Sign In') || b.textContent.includes('লগইন'));
            if (signinBtn) {
                signinBtn.click();
            }
        })();
        """
        
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': js}}))
            print("Sign In button clicked:", await ws.recv())
    except Exception as e:
        print('Error:', e)

asyncio.run(run())
