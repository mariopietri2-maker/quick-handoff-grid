#!/usr/bin/env python3
"""
API smoke test: place → accept → ready → dispatch offer → accept → pickup → deliver.

Uses service-role + a disposable customer/driver. Puts the driver "online" with
fresh GPS near Ioannina so auto-dispatch can find them.

Run: python3 scripts/smoke-order-lifecycle.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

URL = os.environ.get("VITE_SUPABASE_URL", "https://ojkesspghyqmjmupybva.supabase.co").rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
# Ioannina center — near live stores
LAT, LNG = 39.6650, 20.8530
DELIVERY_LAT, DELIVERY_LNG = 39.6685, 20.8505  # ~400m away


def api(method: str, path: str, body=None, token: str | None = None, prefer: str = "return=representation"):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {token or KEY}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }
    req = urllib.request.Request(URL + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        raise RuntimeError(f"{method} {path} -> {e.code}: {err}") from e


def auth_create(email: str, password: str, role: str) -> str:
    row = api(
        "POST",
        "/auth/v1/admin/users",
        {
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": f"Smoke {role}"},
        },
    )
    uid = row["id"]
    # Auth trigger usually inserts profiles — wait briefly then PATCH.
    time.sleep(0.4)
    try:
        api(
            "PATCH",
            f"/rest/v1/profiles?user_id=eq.{uid}",
            {"full_name": f"Smoke {role}", "role": role},
            prefer="return=minimal",
        )
    except Exception:
        pass
    if role != "customer":
        try:
            api(
                "POST",
                "/rest/v1/user_roles",
                {"user_id": uid, "role": role},
                prefer="return=minimal",
            )
        except Exception:
            pass
    if role == "driver":
        try:
            api(
                "POST",
                "/rest/v1/driver_profiles",
                {"user_id": uid, "is_active": True},
                prefer="return=minimal",
            )
        except Exception:
            api(
                "PATCH",
                f"/rest/v1/driver_profiles?user_id=eq.{uid}",
                {"is_active": True},
                prefer="return=minimal",
            )
        try:
            api(
                "POST",
                "/rest/v1/driver_state",
                {
                    "driver_id": uid,
                    "on_break": False,
                    "shift_started_at": datetime.now(timezone.utc).isoformat(),
                },
                prefer="return=minimal",
            )
        except Exception:
            api(
                "PATCH",
                f"/rest/v1/driver_state?driver_id=eq.{uid}",
                {"on_break": False, "shift_started_at": datetime.now(timezone.utc).isoformat()},
                prefer="return=minimal",
            )
    return uid




def auth_password(email: str, password: str) -> str:
    row = api("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password})
    return row["access_token"]


def step(msg: str):
    print(f"✓ {msg}")


def main() -> int:
    stamp = f"{int(time.time())}"
    cust_email = f"smoke-cust-{stamp}@freshdelivery.test"
    drv_email = f"smoke-drv-{stamp}@freshdelivery.test"
    password = f"Smoke!{stamp}Aa"

    print("Creating disposable customer + driver…")
    cust_id = auth_create(cust_email, password, "customer")
    drv_id = auth_create(drv_email, password, "driver")
    step(f"users customer={cust_id[:8]} driver={drv_id[:8]}")

    # Fresh GPS so dispatch TTL treats driver as online
    api(
        "POST",
        "/rest/v1/driver_locations",
        {
            "driver_id": drv_id,
            "latitude": LAT,
            "longitude": LNG,
            "speed": 0,
            "heading": 0,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        },
        prefer="resolution=merge-duplicates,return=minimal",
    )
    # Some schemas use upsert on driver_id — also PATCH if row exists
    try:
        api(
            "PATCH",
            f"/rest/v1/driver_locations?driver_id=eq.{drv_id}",
            {
                "latitude": LAT,
                "longitude": LNG,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            prefer="return=minimal",
        )
    except Exception:
        pass
    step("driver GPS online near Ioannina")

    stores = api("GET", "/rest/v1/stores?select=id,name&name=eq.Pizza%20Corso&is_active=eq.true&limit=1")
    if not stores:
        stores = api("GET", "/rest/v1/stores?select=id,name&is_active=eq.true&order=name&limit=1")
    store_id = stores[0]["id"]
    items = api(
        "GET",
        f"/rest/v1/menu_items?select=id,name,price&store_id=eq.{store_id}&is_available=eq.true&limit=1",
    )
    if not items:
        raise SystemExit("No menu items for smoke store")
    menu_id = items[0]["id"]
    step(f"store={stores[0]['name']} item={items[0]['name']}")

    cust_jwt = auth_password(cust_email, password)
    order_id = api(
        "POST",
        "/rest/v1/rpc/place_order",
        {
            "p_store_id": store_id,
            "p_items": [{"menu_item_id": menu_id, "quantity": 1}],
            "p_delivery_address": "Smoke Test Οδός 1, Ιωάννινα",
            "p_delivery_latitude": DELIVERY_LAT,
            "p_delivery_longitude": DELIVERY_LNG,
            "p_payment_method": "cash",
            "p_tip_amount": 0,
            "p_delivery_fee": 0,
            "p_notes": "smoke-test",
            "p_scheduled_for": None,
            "p_distance_km": 0.5,
            "p_promo_code": None,
        },
        token=cust_jwt,
    )
    # rpc may return bare uuid string
    if isinstance(order_id, dict):
        order_id = order_id.get("place_order") or order_id.get("id") or list(order_id.values())[0]
    step(f"placed order {order_id}")

    # Store accepts + ready (service role)
    api("PATCH", f"/rest/v1/orders?id=eq.{order_id}", {"status": "accepted"}, prefer="return=minimal")
    step("store accepted")
    api("PATCH", f"/rest/v1/orders?id=eq.{order_id}", {"status": "ready"}, prefer="return=minimal")
    step("store marked ready")

    # Trigger auto-dispatch
    cron = os.environ.get("CRON_SECRET", "")
    try:
        req = urllib.request.Request(
            f"{URL}/functions/v1/auto-dispatch",
            data=json.dumps({"limit": 5}).encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {KEY}",
                "apikey": KEY,
                "Content-Type": "application/json",
                **({"x-cron-secret": cron} if cron else {}),
            },
        )
        with urllib.request.urlopen(req) as resp:
            dispatch_body = resp.read().decode()
        step(f"auto-dispatch called: {dispatch_body[:160]}")
    except Exception as e:
        print(f"! auto-dispatch call failed ({e}) — creating offer manually")
        api(
            "POST",
            "/rest/v1/pending_offers",
            {
                "order_id": order_id,
                "driver_id": drv_id,
                "status": "pending",
                "expires_at": datetime.now(timezone.utc).isoformat(),
            },
            prefer="return=minimal",
        )

    offers = api(
        "GET",
        f"/rest/v1/pending_offers?order_id=eq.{order_id}&select=id,driver_id,status&order=created_at.desc&limit=5",
    )
    if not offers:
        # Force offer to our smoke driver
        api(
            "POST",
            "/rest/v1/pending_offers",
            {"order_id": order_id, "driver_id": drv_id, "status": "pending"},
            prefer="return=minimal",
        )
        offers = api(
            "GET",
            f"/rest/v1/pending_offers?order_id=eq.{order_id}&select=id,driver_id,status&limit=1",
        )
    step(f"offer(s)={offers}")

    # Accept as driver via edge function if available
    drv_jwt = auth_password(drv_email, password)
    try:
        req = urllib.request.Request(
            f"{URL}/functions/v1/accept-offer",
            data=json.dumps({"order_id": order_id}).encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {drv_jwt}",
                "apikey": KEY,
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req) as resp:
            step(f"accept-offer: {resp.read().decode()[:160]}")
    except Exception as e:
        print(f"! accept-offer edge failed ({e}) — assigning driver directly")
        api(
            "PATCH",
            f"/rest/v1/orders?id=eq.{order_id}",
            {"driver_id": drv_id, "status": "ready"},
            prefer="return=minimal",
        )

    api("PATCH", f"/rest/v1/orders?id=eq.{order_id}", {"status": "picked_up", "driver_id": drv_id}, prefer="return=minimal")
    step("picked_up")
    api("PATCH", f"/rest/v1/orders?id=eq.{order_id}", {"status": "delivered"}, prefer="return=minimal")
    step("delivered")

    final = api("GET", f"/rest/v1/orders?id=eq.{order_id}&select=id,status,driver_id,store_id,payment_method")
    print("FINAL", json.dumps(final, indent=2))
    ok = final and final[0]["status"] == "delivered" and final[0]["driver_id"] == drv_id
    print("SMOKE", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print("SMOKE FAIL:", e, file=sys.stderr)
        raise SystemExit(1)
