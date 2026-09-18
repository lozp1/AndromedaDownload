import re, base64

with open(r'C:\Users\f.paolo\Downloads\c7b9ee0a-49b0-4b8e-8230-4f55bcb62582.htm', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

idx = text.find('id=intro_svg')
if idx != -1:
    b64_start = text.find('base64,', idx) + 7
    b64_end = text.find('"', b64_start)
    raw_b64 = text[b64_start:b64_end]
    svg = base64.b64decode(raw_b64).decode('utf-8', errors='ignore')
    print('SVG length:', len(svg))
    with open(r'scratch\intro_animation.svg', 'w', encoding='utf-8') as out:
        out.write(svg)

    matches = re.findall(r'@keyframes\s+([a-zA-Z0-9_-]+)\s*\{([^}]+)\}', svg)
    for name, body in matches:
        print('=== Keyframe:', name)
        print(body[:200])

    classes = re.findall(r'\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}', svg)
    for cname, cbody in classes:
        if any(x in cname.lower() for x in ['circle', 'mask', 'scale', 'bg']):
            print(f'Class .{cname}: {cbody}')
