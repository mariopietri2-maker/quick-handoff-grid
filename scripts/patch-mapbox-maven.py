import re, sys

path = sys.argv[1]
text = open(path).read()
block = """\n        maven {
            url = 'https://api.mapbox.com/downloads/v2/releases/maven'
            authentication { basic(BasicAuthentication) }
            credentials {
                username = 'mapbox'
                password = project.findProperty('MAPBOX_DOWNLOADS_TOKEN') ?: System.getenv('MAPBOX_DOWNLOADS_TOKEN') ?: ''
            }
        }"""
pat = re.compile(r"(allprojects\s*\{\s*\n\s*repositories\s*\{\s*\n)(.*?)(\n\s*\}\s*\n\s*\})", re.DOTALL)
m = pat.search(text)
if not m:
    print("WARN: could not find allprojects.repositories block in %s" % path)
    sys.exit(0)
text = text[:m.end(1)] + m.group(2) + block + text[m.end(2):]
open(path, "w").write(text)
print("patched mapbox maven repo -> %s" % path)
