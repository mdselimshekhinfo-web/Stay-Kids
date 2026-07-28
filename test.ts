import { createClient } from "npm:@supabase/supabase-js";
const url = Deno.env.get("SUPABASE_URL") || "https://ewsehvgwzczlshyoyhqf.supabase.co";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabase = createClient(url, key);
const { data, error } = await supabase.from("profiles").select("*").limit(1);
console.log(JSON.stringify({data, error}));
