#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest_path = ROOT / 'MANIFEST.json'
if not manifest_path.is_file():
    raise SystemExit('MANIFEST.json does not exist. Run scripts/create_manifest.py first.')

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
errors: list[str] = []
for entry in manifest.get('files', []):
    relative = Path(str(entry['path']))
    path = ROOT / relative
    if not path.is_file():
        errors.append(f'Missing: {relative.as_posix()}')
        continue
    content = path.read_bytes()
    actual_hash = hashlib.sha256(content).hexdigest()
    if actual_hash != entry['sha256']:
        errors.append(f'Hash mismatch: {relative.as_posix()}')
    if len(content) != entry['bytes']:
        errors.append(f'Size mismatch: {relative.as_posix()}')

if errors:
    print('\n'.join(errors))
    raise SystemExit(f'Manifest verification failed with {len(errors)} error(s).')
print(f"Manifest verification passed for {manifest['fileCount']} files.")
