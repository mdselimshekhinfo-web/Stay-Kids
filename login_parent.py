import asyncio, json, urllib.request, websockets, time

async def run():
    try:
        req = urllib.request.urlopen('http://127.0.0.1:9223/json')
        targets = json.loads(req.read().decode('utf-8'))
        ws_url = next(t for t in targets if t['type'] == 'page')['webSocketDebuggerUrl']
        
        js = """
        (function() {
            const inputs = document.querySelectorAll('input');
            const email = Array.from(inputs).find(i => i.type === 'email');
            const pwd = Array.from(inputs).find(i => i.type === 'password');
            
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            
            if (email) {
                nativeInputValueSetter.call(email, 'mdselimshekh.info@gmail.com');
                email.dispatchEvent(new Event('input', { bubbles: true }));
            }
            if (pwd) {
                nativeInputValueSetter.call(pwd, 'Mdselim@121');
                pwd.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            const submit = document.querySelector('button[type="submit"]');
            if (submit) submit.click();
        })();
        """
        
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': js}}))
            print(await ws.recv())
    except Exception as e:
        print('Error:', e)

asyncio.run(run())
