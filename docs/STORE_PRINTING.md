# Store Printing — fresh2go

Δελτίο κουζίνας 80mm (`PrintOrderTicket`) + ρυθμίσεις (`PrinterSettings`).
Το δελτίο κουζίνας ΔΕΝ είναι τιμολόγιο — το fiscal block τυπώνεται μόνο
όταν η παραγγελία έχει εκδοθεί μέσω παρόχου (βλ. `FISCAL_INVOICING.md`).

## 1. Διάλογος browser (default, παντού)

Το κουμπί «Εκτύπωση» ανοίγει το διάλογο του browser. Δουλεύει με κάθε
USB/network εκτυπωτή που βλέπει το OS του τερματικού.

## 2. Απευθείας ESC/POS (Bluetooth / USB) — αθόρυβη εκτύπωση

Ρυθμίσεις → Εκτυπωτής → τρόπος εκτύπωσης **«Απευθείας (ESC/POS)»** και
σύνδεσε τον θερμικό εκτυπωτή:

- **USB** — Web Serial (Chrome/Edge desktop). Παράδειγμα: Xprinter, Recit,
  Alpha, budget 58/80mm USB thermal.
- **Bluetooth** — Web Bluetooth GATT. Λειτουργεί **μόνο** με εκτυπωτές που
  εκθέτουν BLE write characteristic (προφίλ `FF00/FF02`, `FFE0/FFE1` ή custom
  UUIDs). Το κλασικό SPP Bluetooth δεν είναι προσβάσιμο από τους browsers —
  για τέτοιους εκτυπωτές χρησιμοποίησε USB ή τον διάλογο εκτύπωσης.

Όταν υπάρχει σύνδεση, η εκτύπωση (χειροκίνητη και αυτόματη σε αποδοχή) γίνεται
αθόρυβα με ESC/POS (`src/lib/escpos.ts`, CP737 ελληνικά). Αν δεν υπάρχει
σύνδεση ή ο τρόπος είναι «Διάλογος browser», η εφαρμογή επιστρέφει στον κλασικό
διάλογο. Οι προτιμήσεις αποθηκεύονται σε αυτή τη συσκευή (localStorage).

Κομμάτια:
- `src/lib/escpos.ts` — encoder ESC/POS + CP737.
- `src/lib/printer-devices.ts` — σύνδεση/αποστολή USB (Web Serial) & BLE (Web Bluetooth).
- `src/lib/print-order-escpos.ts` — αναπαραγωγή του δελτίου σε ESC/POS bytes.
- `src/lib/printer-prefs.ts` — mode, χαρτί 58/80mm, baud, BLE προφίλ.

## 3. Αυτόματη εκτύπωση χωρίς διάλογο

- Με συνδεδεμένο εκτυπωτή (Απευθείας) τυπώνει αθόρυβα μόλις αποδεχθεί η
  παραγγελία.
- Εναλλακτικά, kiosk Chrome:

```sh
chrome --kiosk-printing --kiosk https://freshdelivery.app/store
```

Όρισε τον 80mm ως default printer και μέγεθος χαρτιού 80mm × απεριόριστο.

## Δοκιμή

Ρυθμίσεις καταστήματος → Εκτυπωτής → «Δοκιμαστική εκτύπωση». Όταν η σύνδεση
είναι ενεργή, στέλνει απευθείας ESC/POS στον εκτυπωτή.