# Fiscal Invoicing — fresh2go

> Τα HTML "Τιμολόγια ΦΠΑ" στα admin panels είναι **εσωτερικές καταστάσεις**,
> όχι φορολογικά παραστατικά. Νόμιμη έκδοση = πιστοποιημένος πάροχος
> (EpsilonNet / SoftOne / Prosvasis / IMPACT …) + διαβίβαση myDATA.

## Ροή

1. Παραγγελία → `delivered`.
2. Κάλεσμα `issue-invoice` edge function με `{ order_id, issuer_role }`
   (`platform` | `store` | `driver`).
3. Η function δημιουργεί/βρίσκει γραμμή στο `order_invoices` (unique ανά
   order + issuer) και καλεί τον πάροχο.
4. Ο πάροχος εκδίδει (δικιά του αρίθμηση/υπογραφή/myDATA) και επιστρέφει
   number + ΜΑΡΚ + UID + QR → αποθηκεύονται στη γραμμή (`issued`).
5. Η απόδειξη 80mm τυπώνει το fiscal block (ΜΑΡΚ/UID/QR) όταν υπάρχει.

## Ποιος τιμολογεί ποιον (να το κλειδώσει λογιστής)

- Κατάστημα → πελάτη (απόδειξη λιανικής, ταμειακή/πάροχος καταστήματος).
- Πλατφόρμα → κατάστημα (προμήθεια).
- Οδηγός → πλατφόρμα (αμοιβή).

## Τι μένει για να δουλέψει

1. Σύμβαση με Epsilon Digital + credentials στα Supabase secrets (ποτέ στο repo):
   `EPSILON_API_KEY` (ή `EPSILON_SUBSCRIPTION_KEY`, ή `EPSILON_EMAIL`/`EPSILON_PASSWORD`),
   προαιρετικά `EPSILON_API_URL`, για δοκιμές `EPSILON_DRY_RUN=true`.
2. Admin → Οικονομικά → **Epsilon Τιμολόγηση**: επίλεξε provider `epsilon`,
   περιβάλλον (sandbox/production), Company/Branch/Σειρά, issue path από το
   Swagger (`beta-api.epsilonnet.gr`), ενεργοποίηση = ON, Αποθήκευση.
3. Χειροκίνητη έκδοση από το ίδιο panel (Order ID + εκδότης) ή αυτόματα όταν
   η παραγγελία γίνεται `delivered`.
4. `supabase functions deploy issue-invoice` + `supabase db push`
   (migrations `20260904130000_order_invoices.sql`, `20260904140000_epsilon_invoicing.sql`).

## Σημειώσεις

- Idempotent: ξανακάλεσμα για ήδη `issued` επιστρέφει την υπάρχουσα γραμμή.
- Η αρίθμηση ανήκει πάντα στον πάροχο — ποτέ `INV-`/`DRV-` timestamps.
- Το platform delivery reporting (Ν.5073/2023, `aade-submit-delivery`)
  είναι ξεχωριστή υποχρέωση και δεν αντικαθιστά την τιμολόγηση.
