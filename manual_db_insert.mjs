const BASE = "https://ewsehvgwzczlshyoyhqf.supabase.co/rest/v1";
const EMAIL = "mdselimshekh.info@gmail.com";
const PASSWORD = "Mdselim@121";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2Vodmd3emN6bHNoeW95aHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTA2MjIsImV4cCI6MjA5OTY4NjYyMn0.kWqk1d-8mNt3mG5zwfaRC9RUgZt7WgEyRNrqn7frn-s";

async function run() {
  const loginRes = await fetch("https://ewsehvgwzczlshyoyhqf.supabase.co/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": ANON_KEY },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });
  const login = await loginRes.json();
  const token = login.access_token;
  const user = login.user;
  
  console.log("Logged in as:", user.id);
  
  const insertRes = await fetch(BASE + "/children", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json", 
      "apikey": ANON_KEY,
      "Authorization": "Bearer " + token,
      "Prefer": "return=representation"
    },
    body: JSON.stringify({
      id: "123e4567-e89b-12d3-a456-426614174001",
      parent_id: user.id,
      name: "Child Phone",
      device_name: "Emulator",
      battery_level: 100,
      is_online: true
    })
  });
  
  const insertText = await insertRes.text();
  console.log("Insert Result:", insertRes.status, insertText);
}
run();

