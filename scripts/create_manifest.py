#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXCLUDED_PARTS = {'.git', 'node_modules', 'dist', 'coverage'}
EXCLUDED_NAMES = {'MANIFEST.json'}

entries: list[dict[str, object]] = []
for path in sorted(ROOT.rglob('*')):
    if not path.is_file():
        continue
    relative = path.relative_to(ROOT)
    if any(part in EXCLUDED_PARTS for part in relative.parts):
        continue
    if path.name in EXCLUDED_NAMES or path.suffix in {'.zip'} or path.name.endswith('.zip.sha256'):
        continue
    content = path.read_bytes()
    entries.append({
        'path': relative.as_posix(),
        'bytes': len(content),
        'sha256': hashlib.sha256(content).hexdigest(),
    })

manifest = {
    'project': 'PulseFlow',
    'version': '1.0.1',
    'generatedBy': 'scripts/create_manifest.py',
    'fileCount': len(entries),
    'totalBytes': sum(int(entry['bytes']) for entry in entries),
    'files': entries,
}
(ROOT / 'MANIFEST.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f"Manifest written with {len(entries)} files.")
