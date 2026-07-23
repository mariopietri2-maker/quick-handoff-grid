#!/usr/bin/env bash
# Seed logo + cover photos for the 5 live Ioannina stores (Unsplash stock).
# Requires SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL in the environment.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

: "${VITE_SUPABASE_URL:?}"
: "${SUPABASE_SERVICE_ROLE_KEY:?}"

python3 - <<'PY'
import json, os, urllib.request

URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# store_id → (slug, unsplash logo id params already downloaded externally — use CDN)
# We fetch on the fly from Unsplash CDN.
MAPPING = [
  ("e42a746a-3e4c-46c7-8cc6-8bb6aa210b51", "asia",
   "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&h=800&q=80",
   "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=1600&h=900&q=80"),
  ("f6ceb4d5-0dbf-4cb6-b68c-e72a94c34079", "cafe",
   "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&h=800&q=80",
   "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=1600&h=900&q=80"),
  ("fef56384-7ac0-4a8c-9f9b-6bfa469f7ff0", "pizza",
   "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&h=800&q=80",
   "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1600&h=900&q=80"),
  ("e343d0ce-355a-4a9c-ba03-163d2453960e", "souvlaki",
   "https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=800&h=800&q=80",
   "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?auto=format&fit=crop&w=1600&h=900&q=80"),
  ("e1dbad50-18a7-4a27-87ae-438f6cceb600", "grill",
   "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&h=800&q=80",
   "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1600&h=900&q=80"),
]

def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "FreshDeliverySeed/1.0"})
    with urllib.request.urlopen(req) as resp:
        return resp.read()

def upload(path: str, data: bytes):
    req = urllib.request.Request(
        f"{URL}/storage/v1/object/store-images/{path}",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {KEY}",
            "apikey": KEY,
            "Content-Type": "image/jpeg",
            "x-upsert": "true",
        },
    )
    try:
        urllib.request.urlopen(req).read()
    except Exception:
        req.get_method = lambda: "PUT"  # type: ignore
        req2 = urllib.request.Request(
            f"{URL}/storage/v1/object/store-images/{path}",
            data=data,
            method="PUT",
            headers={
                "Authorization": f"Bearer {KEY}",
                "apikey": KEY,
                "Content-Type": "image/jpeg",
                "x-upsert": "true",
            },
        )
        urllib.request.urlopen(req2).read()

def public_url(path: str) -> str:
    return f"{URL}/storage/v1/object/public/store-images/{path}"

def patch(store_id: str, image_url: str, cover_url: str):
    payload = json.dumps({"image_url": image_url, "cover_image_url": cover_url}).encode()
    req = urllib.request.Request(
        f"{URL}/rest/v1/stores?id=eq.{store_id}",
        data=payload,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {KEY}",
            "apikey": KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
    )
    urllib.request.urlopen(req).read()

for sid, slug, logo_url, cover_url in MAPPING:
    print("seeding", slug, sid[:8])
    logo = fetch(logo_url)
    cover = fetch(cover_url)
    logo_path = f"{sid}/image-seed.jpg"
    cover_path = f"{sid}/cover-seed.jpg"
    upload(logo_path, logo)
    upload(cover_path, cover)
    patch(sid, public_url(logo_path), public_url(cover_path))
    print("  ok")

print("done")
PY
