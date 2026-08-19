import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ewsehvgwzczlshyoyhqf.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c2Vodmd3emN6bHNoeW95aHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQxMTA2MjIsImV4cCI6MjA5OTY4NjYyMn0.kWqk1d-8mNt3mG5zwfaRC9RUgZt7WgEyRNrqn7frn-s";

const client = createClient(SUPABASE_URL, ANON_KEY);

async function run() {
  const channel = client.channel("webrtc-child-1");
  
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      console.log('Subscribed to channel. Sending action...');
      const action = { type: 'toggle-control', key: 'paused' };
      
      const result = await channel.send({
        type: 'broadcast',
        event: 'webrtc-signal',
        payload: { actionData: action }
      });
      console.log('Broadcast result:', result);
      
      setTimeout(() => process.exit(0), 1000);
    }
  });
}
run();
