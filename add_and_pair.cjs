const fs = require('fs');

async function addAndPairChild() {
  const email = 'mdselimshekh.info@gmail.com';
  const password = 'Mdselim@121';

  console.log("Logging in parent...");
  let res = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
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
  
  res = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/action", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({
      type: "add-child",
      newChild: {
        id: childId,
        name: "Test Child " + Date.now().toString().slice(-4),
        device: "Emulator"
      }
    })
  });
  data = await res.json();
  console.log("Add child result:", data.error ? data.error : "Success");

  console.log("Generating pairing PIN...");
  res = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/functions/v1/server/pairing/generate", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify({ childId })
  });
  data = await res.json();
  console.log("Pairing PIN generated:", data.pin);
  fs.writeFileSync('current_pin.txt', data.pin);
}

addAndPairChild();
