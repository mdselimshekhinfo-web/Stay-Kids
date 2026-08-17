import asyncio
import json
import urllib.request
import websockets

async def check_local_storage():
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
                    "expression": "localStorage.getItem('staykids_selected_role');",
                    "returnByValue": True
                }
            }))
            resp = json.loads(await ws.recv())
            print("Selected Role:", resp['result']['result'].get('value'))
            
            await ws.send(json.dumps({
                "id": 2,
                "method": "Runtime.evaluate",
                "params": {
                    "expression": "localStorage.clear(); location.reload();",
                    "returnByValue": True
                }
            }))
            try:
                resp2 = json.loads(await ws.recv())
            except Exception as e:
                pass
            print("Cleared and reloaded!")
    except Exception as e:
        print("Error:", e)

asyncio.run(check_local_storage())
