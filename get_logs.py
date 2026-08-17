import asyncio
import json
import urllib.request
import websockets

async def get_logs():
    try:
        req = urllib.request.urlopen("http://127.0.0.1:9222/json")
        data = req.read().decode('utf-8')
        targets = json.loads(data)
        page_target = next(t for t in targets if t['type'] == 'page')
        ws_url = page_target['webSocketDebuggerUrl']
        
        async with websockets.connect(ws_url) as ws:
            await ws.send(json.dumps({"id": 1, "method": "Runtime.enable"}))
            await ws.send(json.dumps({"id": 2, "method": "Network.enable"}))
            
            # Type PIN again to trigger it
            await ws.send(json.dumps({
                "id": 3,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": """
                        (function() {
                            const inputs = document.querySelectorAll('input');
                            const input = Array.from(inputs).find(el => (el.placeholder && el.placeholder.includes('6-digit')) || el.maxLength === 6);
                            if (input) {
                                input.value = '451902';
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                
                                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Continue') || el.textContent.includes('Link Device'));
                                if (btn) btn.click();
                            }
                        })()
                    """
                }
            }))
            
            # Read events for 5 seconds
            try:
                while True:
                    msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    data = json.loads(msg)
                    if data.get('method') == 'Runtime.consoleAPICalled':
                        args = data['params']['args']
                        texts = []
                        for arg in args:
                            if 'value' in arg:
                                texts.append(str(arg['value']))
                            else:
                                texts.append(arg.get('description', ''))
                        print("CONSOLE:", " ".join(texts))
                    elif data.get('method') == 'Runtime.exceptionThrown':
                        print("EXCEPTION:", data['params']['exceptionDetails'])
                    elif data.get('method') == 'Network.responseReceived':
                        resp = data['params']['response']
                        print(f"NETWORK: {resp['status']} {resp['url']}")
            except asyncio.TimeoutError:
                print("Done collecting logs")
    except Exception as e:
        print("Error:", e)

asyncio.run(get_logs())
