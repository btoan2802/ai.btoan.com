"""
inject_shuriken.py
Extracts the base64 MP4 block from shuriken_only.html
and injects it into naruto_ar.html as SHURIKEN_B64.
"""
import re, os

SRC  = r'd:\Game\ai\ai.btoan.com\Naruto-main\shuriken_only.html'
DEST = r'd:\Game\ai\ai.btoan.com\Naruto-main\naruto_ar.html'

print('Reading source HTML...')
with open(SRC, 'r', encoding='utf-8') as f:
    src_html = f.read()

# Find the data:video/mp4;base64,... inside a <source src="..."> tag
print('Finding base64 asset...')
m = re.search(r'<source\s+src="(data:video/mp4;base64,[A-Za-z0-9+/=]+)"', src_html)
if not m:
    print('ERROR: base64 source not found in shuriken_only.html')
    raise SystemExit(1)

b64_asset = m.group(1)
print(f'Found base64 asset: {len(b64_asset)} chars')

# Read destination
print('Reading naruto_ar.html...')
with open(DEST, 'r', encoding='utf-8') as f:
    dest_html = f.read()

# Replace placeholder
if '__SHURIKEN_B64__' not in dest_html:
    print('ERROR: __SHURIKEN_B64__ placeholder not found in naruto_ar.html')
    raise SystemExit(1)

dest_html = dest_html.replace('__SHURIKEN_B64__', b64_asset)
print('Injecting...')

with open(DEST, 'w', encoding='utf-8') as f:
    f.write(dest_html)

print('Done. naruto_ar.html updated with shuriken base64 asset.')
print(f'Final file size: {os.path.getsize(DEST):,} bytes')
