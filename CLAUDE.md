@AGENTS.md

## Pre-Packaging Secret Check
Before packaging this project for upload or handoff, verify `.env` and `supabase/functions/server/.env` do not contain real secrets — replace with placeholders or exclude the files. Also verify HMAC_SECRET / VITE_HMAC_SECRET are not left as the literal placeholder `<GENERATE_NEW_RANDOM_SECRET>` — confirm both are set to the same real random value before building or packaging.
