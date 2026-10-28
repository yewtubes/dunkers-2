#!/usr/bin/env python3
"""Re-download only the four public build files and verify their recorded hashes."""
import hashlib
import json
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'research/build-manifest.json').read_text())
for item in manifest['files']:
    target = root / item['file']
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == item['sha256']:
        print('Verified', target.name)
        continue
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(target.suffix + '.download')
    subprocess.run(['curl', '-fLSs', '--max-time', '180', '-o', str(temporary), item['url']], check=True)
    if temporary.stat().st_size != item['bytes'] or hashlib.sha256(temporary.read_bytes()).hexdigest() != item['sha256']:
        temporary.unlink()
        raise SystemExit('Build changed or download corrupted: ' + target.name)
    temporary.replace(target)
    print('Downloaded and verified', target.name)
