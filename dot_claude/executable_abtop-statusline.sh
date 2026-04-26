#!/bin/bash
# abtop StatusLine hook — writes rate limit data for abtop to read.
# Installed by: abtop --setup
INPUT=$(cat)
python3 -c "
import sys, json, time, os
data = json.loads(sys.argv[1])
rl = data.get('rate_limits')
if not rl:
    sys.exit(0)
out = {'source': 'claude', 'updated_at': int(time.time())}
fh = rl.get('five_hour')
if fh:
    out['five_hour'] = {'used_percentage': fh.get('used_percentage', 0), 'resets_at': fh.get('resets_at', 0)}
sd = rl.get('seven_day')
if sd:
    out['seven_day'] = {'used_percentage': sd.get('used_percentage', 0), 'resets_at': sd.get('resets_at', 0)}
home = os.path.expanduser('~')
with open(os.path.join(home, '.claude', 'abtop-rate-limits.json'), 'w') as f:
    json.dump(out, f)
" "$INPUT" 2>/dev/null
