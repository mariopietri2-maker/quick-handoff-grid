# Store Printing — fresh2go

Δελτίο κουζίνας 80mm (`PrintOrderTicket`) + ρυθμίσεις (`PrinterSettings`).
Το δελτίο κουζίνας ΔΕΝ είναι τιμολόγιο — το fiscal block τυπώνεται μόνο
όταν η παραγγελία έχει εκδοθεί μέσω παρόχου (βλ. `FISCAL_INVOICING.md`).

## 1. Browser dialog (default, παντού)

Το κουμπί «Εκτύπωση» ανοίγει το διάλογο του browser. Δουλεύει με κάθε
USB/network εκτυπωτή που βλέπει το OS του τερματικού.

## 2. Αυτόματη εκτύπωση χωρίς διάλογο (kiosk — προτείνεται)

Στο τερματικό του καταστήματος, τρέξε τον Chrome με:

```sh
chrome --kiosk-printing --kiosk https://freshdelivery.app/store
```

Τότε το «Αυτόματη εκτύπωση» (στις Ρυθμίσεις → Εκτυπωτής) τυπώνει αθόρυβα
μόλις η παραγγελία γίνει αποδεκτή. Όρισε τον 80mm ως default printer
και μέγεθος χαρτιού 80mm × απεριόριστο.

## 3. Native / ESC-POS (μελλοντικό)

- Store app με Star/Epson ePOS SDK, ή
- ESC/POS Bluetooth/USB thermal printer μέσω native bridge.

## Δοκιμή

Ρυθμίσεις καταστήματος → Εκτυπωτής → «Δοκιμαστική εκτύπωση».
