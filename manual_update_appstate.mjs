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
  
  const getRes = await fetch(BASE + "/users?id=eq." + user.id, {
    method: "GET",
    headers: { 
      "apikey": ANON_KEY,
      "Authorization": "Bearer " + token
    }
  });
  const getJson = await getRes.json();
  console.log("Current user:", JSON.stringify(getJson));
  
  if (getJson.length > 0) {
      let state = getJson[0].app_state || {};
      state.children = [{
          id: "child-1",
          name: "Child Phone",
          device: "Emulator",
          location: "Unknown",
          battery: 100,
          online: true,
          protected: true
      }];
      state.child = state.children[0];
      state.activeChildId = "child-1";
      
      const updateRes = await fetch(BASE + "/users?id=eq." + user.id, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json", 
          "apikey": ANON_KEY,
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ app_state: state })
      });
      console.log("Update Result:", updateRes.status, await updateRes.text());
  }
}
run();
