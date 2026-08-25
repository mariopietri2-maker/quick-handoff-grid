from pathlib import Path

def main() -> None:
    p = Path("native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/home/HomeScreen.kt")
    t = p.read_text()
    if "Customer delivery pin so driver sees both ends" in t:
        print("already patched")
        return
    old = """        state.offers.take(2).forEach { o ->
            o.storeLat?.let { lat ->
                o.storeLng?.let { lng ->
                    add(MapMarker(lat, lng, o.storeName ?: "Offer", "#FF8A00"))
                }
            }
        }"""
    new = """        state.offers.take(2).forEach { o ->
            // Store (pickup) pin
            o.storeLat?.let { lat ->
                o.storeLng?.let { lng ->
                    add(MapMarker(lat, lng, o.storeName ?: "Κατάστημα", "#FF8A00"))
                }
            }
            // Customer delivery pin so driver sees both ends of the offer
            o.order.delivery_latitude?.let { lat ->
                o.order.delivery_longitude?.let { lng ->
                    add(MapMarker(lat, lng, "Πελάτης", "#276EF1"))
                }
            }
        }"""
    if old not in t:
        raise SystemExit("markers block not found")
    p.write_text(t.replace(old, new, 1))
    print("patched")

if __name__ == "__main__":
    main()
