const fs = require('fs');
const crypto = require('crypto');

const HMAC_SECRET = "b71c22d744b4c73f30d07e6027a054db68700940562e6e3c1a8d46e270a25dc9";

function generateHmacSignature(payload, timestamp) {
  const key = crypto.createSecretKey(Buffer.from(HMAC_SECRET));
  const dataToSign = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(dataToSign);
  return hmac.digest('hex');
}

async function run() {
  const email = 'mdselimshekh.info@gmail.com';
  const password = 'Mdselim@121';

  let timestamp = Date.now().toString();
  let payload = JSON.stringify({ email, password });
  let signature = generateHmacSignature(payload, timestamp);

  console.log("Logging in parent...");
  let res = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/auth/login", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "X-Request-Timestamp": timestamp,
      "X-Request-Signature": signature
    },
    body: payload
  });
  let data = await res.json();
  if (data.error) {
    console.error("Login failed:", data.error);
    return;
  }
  const token = data.token;
  console.log("Login successful.");

  const childId = "child-" + Date.now();
  console.log("Adding new child: " + childId);
  
  timestamp = Date.now().toString();
  payload = JSON.stringify({
    type: "add-child",
    newChild: {
      id: childId,
      name: "Test Child " + Date.now().toString().slice(-4),
      device: "Emulator",
      battery: 100,
      online: true
    }
  });
  signature = generateHmacSignature(payload, timestamp);

  res = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/action", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      "X-Request-Timestamp": timestamp,
      "X-Request-Signature": signature
    },
    body: payload
  });
  data = await res.json();
  console.log("Add child result:", data.error ? data.error : "Success");

  console.log("Generating pairing PIN...");
  timestamp = Date.now().toString();
  payload = JSON.stringify({ childId });
  signature = generateHmacSignature(payload, timestamp);

  res = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/pairing/generate", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token,
      "X-Request-Timestamp": timestamp,
      "X-Request-Signature": signature
    },
    body: payload
  });
  data = await res.json();
  console.log("Pairing PIN generated:", data.pin);
  fs.writeFileSync('current_pin.txt', data.pin);
}

run();
