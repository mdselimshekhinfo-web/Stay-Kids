import asyncio, json, urllib.request, websockets, time

async def run():
    try:
        req = urllib.request.urlopen('http://127.0.0.1:9223/json')
        targets = json.loads(req.read().decode('utf-8'))
        ws_url = next(t for t in targets if t['type'] == 'page')['webSocketDebuggerUrl']
        
        js = """
        (function() {
            const inputs = document.querySelectorAll('.fixed input');
            if (inputs.length >= 2) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                
                nativeInputValueSetter.call(inputs[0], 'Test Child');
                inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                
                nativeInputValueSetter.call(inputs[1], 'Test Device');
                inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
                
                const submit = document.querySelector('.fixed button[type="submit"]');
                if (submit) submit.click();
            }
        })();
        """
        
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': js}}))
            await ws.recv()
            
            time.sleep(3)
            
            await ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {
                'expression': 'document.body.innerHTML', 'returnByValue': True
            }}))
            resp = json.loads(await ws.recv())
            sys.stdout.buffer.write(resp.get('result', {}).get('result', {}).get('value', '').encode('utf-8'))
    except Exception as e:
        print('Error:', e)

asyncio.run(run())
