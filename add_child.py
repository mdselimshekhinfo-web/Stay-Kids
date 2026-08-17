import asyncio, json, urllib.request, websockets, sys, time

async def run():
    try:
        req = urllib.request.urlopen('http://127.0.0.1:9223/json')
        targets = json.loads(req.read().decode('utf-8'))
        ws_url = next(t for t in targets if t['type'] == 'page')['webSocketDebuggerUrl']
        async with websockets.connect(ws_url) as ws:
            # Click "Add Child Device"
            js1 = '''
            (function() {
                const btns = document.querySelectorAll('button');
                const addBtn = Array.from(btns).find(b => b.textContent.includes('Add Child Device'));
                if (addBtn) addBtn.click();
            })();
            '''
            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': js1}}))
            await ws.recv()
            
            # Wait a bit for the PIN to be generated
            time.sleep(3)
            
            # Read the HTML again
            await ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {
                'expression': 'document.body.innerHTML', 'returnByValue': True
            }}))
            resp = json.loads(await ws.recv())
            sys.stdout.buffer.write(resp.get('result', {}).get('result', {}).get('value', '').encode('utf-8'))
    except Exception as e:
        print('Error:', e)

asyncio.run(run())
