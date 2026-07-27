import re

with open('f:/Figma/Parental Control App/supabase/functions/server/index.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

helpers = '''
async function getProfile(email: string) {
  const { data } = await supabase.from('profiles').select('*').eq('email', email.toLowerCase()).single();
  if (data) return data;
  const { data: newProfile } = await supabase.from('profiles').insert({ email: email.toLowerCase(), full_name: email.split('@')[0] }).select().single();
  return newProfile;
}

async function getStateFromDB(email: string) {
  try {
    const profile = await getProfile(email);
    if (!profile) return JSON.parse(JSON.stringify(defaultState));

    const { data: children } = await supabase.from('children').select('*').eq('parent_id', profile.id);
    const state = JSON.parse(JSON.stringify(defaultState));

    if (children && children.length > 0) {
      state.children = children.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        device: ch.device_name,
        location: ch.last_location,
        battery: ch.battery_level,
        online: ch.is_online,
        coordinates: { lat: ch.latitude, lng: ch.longitude }
      }));
      state.child = state.children[0];
      state.activeChildId = state.child.id;
      
      state.perChild = {};
      for (const ch of children) {
        const { data: controls } = await supabase.from('device_controls').select('*').eq('child_id', ch.id).single();
        const { data: usage } = await supabase.from('app_usage').select('*').eq('child_id', ch.id).order('date', { ascending: false }).limit(1).single();
        const { data: alerts } = await supabase.from('alerts').select('*').eq('child_id', ch.id);
        const { data: blockedApps } = await supabase.from('blocked_apps').select('*').eq('child_id', ch.id);

        const chControls = controls ? {
          paused: controls.is_paused,
          limits: controls.limits_enabled,
          bedtime: controls.bedtime_enabled,
          filter: controls.web_filter_enabled
        } : state.controls;

        const chUsage = usage ? {
          minutes: usage.total_minutes,
          limit: controls?.daily_limit_minutes || 120,
          topApps: usage.top_apps || []
        } : state.usage;
        
        const chBlockedApps = blockedApps ? blockedApps.reduce((acc: any, curr: any) => ({...acc, [curr.package_name]: curr.is_blocked}), {}) : {};

        state.perChild[ch.id] = {
          controls: chControls,
          usage: chUsage,
          blockedApps: chBlockedApps,
        };
      }
      
      const activeData = state.perChild[state.activeChildId];
      if (activeData) {
         state.controls = activeData.controls;
         state.usage = activeData.usage;
         state.blockedApps = activeData.blockedApps;
      }
    }
    return state;
  } catch(e) {
    console.error(e);
    return JSON.parse(JSON.stringify(defaultState));
  }
}

async function saveStateToDB(email: string, state: any) {
  try {
    const profile = await getProfile(email);
    if (!profile || !state.children) return;

    for (const ch of state.children) {
      const perCh = state.perChild?.[ch.id];
      if (!perCh) continue;

      await supabase.from('children').upsert({
        id: ch.id,
        parent_id: profile.id,
        name: ch.name,
        device_name: ch.device,
        battery_level: ch.battery,
        is_online: ch.online,
        last_location: ch.location,
        latitude: ch.coordinates?.lat,
        longitude: ch.coordinates?.lng
      });

      await supabase.from('device_controls').upsert({
        child_id: ch.id,
        is_paused: perCh.controls?.paused || false,
        limits_enabled: perCh.controls?.limits || false,
        bedtime_enabled: perCh.controls?.bedtime || false,
        web_filter_enabled: perCh.controls?.filter || false,
        daily_limit_minutes: perCh.usage?.limit || 120
      });

      if (perCh.blockedApps) {
        for (const [pkg, blocked] of Object.entries(perCh.blockedApps)) {
          await supabase.from('blocked_apps').upsert({
            id: ch.id + '_' + pkg,
            child_id: ch.id,
            package_name: pkg,
            app_name: pkg,
            is_blocked: blocked
          });
        }
      }
    }
  } catch(e) {
    console.error('Failed to save to DB', e);
  }
}
'''

code = code.replace(
    'const supabase = createClient(supabaseUrl, supabaseKey);',
    'const supabase = createClient(supabaseUrl, supabaseKey);\n' + helpers
)

code = re.sub(
    r'const state = await kv\.get\(parentStateKey\);',
    r'const state = await getStateFromDB(authCtx.email);',
    code
)

code = re.sub(
    r'let state = \(await kv\.get\(parentStateKey\)\) \|\| JSON\.parse\(JSON\.stringify\(defaultState\)\);',
    r'let state = (await getStateFromDB(authCtx.email)) || JSON.parse(JSON.stringify(defaultState));',
    code
)

code = re.sub(
    r'await kv\.set\(parentStateKey, state\);',
    r'await kv.set(parentStateKey, state);\n    await saveStateToDB(authCtx.email, state);',
    code
)

with open('f:/Figma/Parental Control App/supabase/functions/server/index.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
print('Done!')
