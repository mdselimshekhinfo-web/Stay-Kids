import re

file_path = "src/AppChild.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# We want to replace 'if (role === "child")' with 'if (role === "child" && authenticated && ready)'
# But only in the useEffects between lines 250 and 600.
# Let's just do a string replacement for specific patterns.

replacements = [
    ('if (role === "child") {', 'if (role === "child" && authenticated && ready) {'),
    ('if (role === "child" && state.remote.mirrorStreamActive)', 'if (role === "child" && state.remote.mirrorStreamActive && authenticated && ready)'),
    ('if (role === "child" && !state.remote.mirrorStreamActive)', 'if (role === "child" && !state.remote.mirrorStreamActive && authenticated && ready)'),
    ('if (role === "child" && state.remote.audioActive)', 'if (role === "child" && state.remote.audioActive && authenticated && ready)'),
    ('if (role === "child" && !state.remote.audioActive)', 'if (role === "child" && !state.remote.audioActive && authenticated && ready)'),
    ('if (role === "child" && state.remote.alarmActive)', 'if (role === "child" && state.remote.alarmActive && authenticated && ready)'),
    ('if (role === "child" && !state.remote.alarmActive)', 'if (role === "child" && !state.remote.alarmActive && authenticated && ready)'),
    ('if (role === "child" && state.blockedApps)', 'if (role === "child" && state.blockedApps && authenticated && ready)'),
    ('if (role !== "child") return', 'if (role !== "child" || !authenticated || !ready) return'),
]

for old, new in replacements:
    content = content.replace(old, new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Replaced!")
