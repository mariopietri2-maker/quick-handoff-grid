# Fiscal Invoicing — Fresh Meal

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

1. Επιλογή παρόχου + credentials στα Supabase secrets (ποτέ στο repo).
2. Ενημέρωση `invoice_provider_config` (`provider`, `enabled = true`).
3. Υλοποίηση του `callProvider()` στο `supabase/functions/issue-invoice/index.ts`
   (σήμαναν το σημείο με σχόλιο).
4. `supabase functions deploy issue-invoice` + `supabase db push`
   (για το migration `20260904130000_order_invoices.sql`).

## Σημειώσεις

- Idempotent: ξανακάλεσμα για ήδη `issued` επιστρέφει την υπάρχουσα γραμμή.
- Η αρίθμηση ανήκει πάντα στον πάροχο — ποτέ `INV-`/`DRV-` timestamps.
- Το platform delivery reporting (Ν.5073/2023, `aade-submit-delivery`)
  είναι ξεχωριστή υποχρέωση και δεν αντικαθιστά την τιμολόγηση.
