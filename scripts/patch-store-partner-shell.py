#!/usr/bin/env python3
import base64, pathlib
parts = sorted(pathlib.Path("scripts").glob("storeapp.b64.*"), key=lambda p: int(p.name.rsplit(".", 1)[-1]))
b64 = "".join(p.read_text().strip() for p in parts)
data = base64.b64decode(b64)
path = pathlib.Path("src/pages/StoreApp.tsx")
path.write_bytes(data)
print("wrote", path, len(data), "from", len(parts), "chunks")
