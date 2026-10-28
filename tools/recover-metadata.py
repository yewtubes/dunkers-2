#!/usr/bin/env python3
"""Extract shipped IL2CPP v31 metadata and declaration indices (not C# bodies)."""
import json
from pathlib import Path
import struct

root = Path(__file__).resolve().parents[1]
manifest = json.loads((root / 'research/build-manifest.json').read_text())
data_file = next(root / item['file'] for item in manifest['files'] if item['file'].endswith('.data'))
data = data_file.read_bytes()
magic = b'UnityWebData1.0\0'
if not data.startswith(magic):
    raise SystemExit('Unknown Unity archive format')
pos = len(magic)
header_end = struct.unpack_from('<I', data, pos)[0]
pos += 4
metadata = None
while pos < header_end:
    offset, length, name_length = struct.unpack_from('<III', data, pos)
    pos += 12
    name = data[pos:pos + name_length].decode()
    pos += name_length
    if name == 'Il2CppData/Metadata/global-metadata.dat':
        metadata = data[offset:offset + length]
if metadata is None:
    raise SystemExit('IL2CPP metadata missing')
out = root / 'source-recovery'
out.mkdir(exist_ok=True)
(out / 'global-metadata.dat').write_bytes(metadata)
header = struct.unpack_from('<64I', metadata)
if header[0] != 0xFAB11BAF or header[1] != 31:
    raise SystemExit('Expected IL2CPP metadata version 31')

def text(index):
    offset = header[6] + index
    return metadata[offset:metadata.index(b'\0', offset)].decode()

types = []
for offset in range(header[40], header[40] + header[41], 88):
    row = struct.unpack_from('<16i8H2I', metadata, offset)
    fields = []
    methods = []
    for index in range(row[8], row[8] + row[18]):
        name, type_index, token = struct.unpack_from('<3I', metadata, header[24] + 12 * index)
        fields.append({'name': text(name), 'typeIndex': type_index, 'index': index})
    for index in range(row[9], row[9] + row[16]):
        method = struct.unpack_from('<7i4H', metadata, header[12] + 36 * index)
        methods.append({'name': text(method[0]), 'index': index, 'token': method[6]})
    types.append({'name': text(row[0]), 'namespace': text(row[1]), 'fields': fields, 'methods': methods})
(out / 'metadata-types.json').write_text(json.dumps(types, indent=2))
print(f'Recovered {len(metadata)} metadata bytes and {len(types)} declaration records.')
