import asyncio, json, urllib.request, websockets, time, sys

async def run():
    try:
        req = urllib.request.urlopen('http://127.0.0.1:9222/json')
        targets = json.loads(req.read().decode('utf-8'))
        ws_url = next(t for t in targets if t['type'] == 'page')['webSocketDebuggerUrl']
        
        js = """
        (function() {
            const inputs = document.querySelectorAll('input');
            const pinInput = Array.from(inputs).find(i => i.placeholder && i.placeholder.includes('PIN'));
            if (pinInput) {
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeInputValueSetter.call(pinInput, '551364');
                pinInput.dispatchEvent(new Event('input', { bubbles: true }));
                
                setTimeout(() => {
                    const btns = document.querySelectorAll('button');
                    const continueBtn = Array.from(btns).find(b => b.textContent.includes('Continue'));
                    if (continueBtn) {
                        continueBtn.disabled = false;
                        continueBtn.click();
                    }
                }, 1000);
            } else {
                return "PIN input not found";
            }
            return "Injected";
        })();
        """
        
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({'id': 1, 'method': 'Runtime.evaluate', 'params': {'expression': js, 'returnByValue': True}}))
            print("Injection response:", await ws.recv())
            
            time.sleep(3)
            
            await ws.send(json.dumps({'id': 2, 'method': 'Runtime.evaluate', 'params': {
                'expression': 'document.body.innerHTML', 'returnByValue': True
            }}))
            resp = json.loads(await ws.recv())
            sys.stdout.buffer.write(resp.get('result', {}).get('result', {}).get('value', '').encode('utf-8'))
    except Exception as e:
        print('Error:', e)

asyncio.run(run())
