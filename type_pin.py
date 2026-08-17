import asyncio
import json
import urllib.request
import websockets

async def fill_pin():
    try:
        req = urllib.request.urlopen("http://127.0.0.1:9222/json")
        data = req.read().decode('utf-8')
        targets = json.loads(data)
        page_target = next(t for t in targets if t['type'] == 'page')
        ws_url = page_target['webSocketDebuggerUrl']
        
        async with websockets.connect(ws_url) as ws:
            req_id = 1
            await ws.send(json.dumps({
                "id": req_id,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": """
                        (function() {
                            const inputs = document.querySelectorAll('input');
                            const input = Array.from(inputs).find(el => (el.placeholder && el.placeholder.includes('6-digit')) || el.maxLength === 6);
                            if (input) {
                                input.value = '537357';
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                
                                const btn = Array.from(document.querySelectorAll('button')).find(el => el.textContent.includes('Continue') || el.textContent.includes('Link Device'));
                                if (btn) btn.click();
                                return "Filled and clicked!";
                            }
                            return "Input not found!";
                        })()
                    """,
                    "returnByValue": True
                }
            }))
            resp = json.loads(await ws.recv())
            print("Result:", resp['result']['result'].get('value'))
    except Exception as e:
        print("Error:", e)

asyncio.run(fill_pin())
