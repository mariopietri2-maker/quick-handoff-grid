/** Store partner helper FAQ (Greek). */
export type StoreFaqItem = { id: string; question: string; answer: string };

export const STORE_HELPER_FAQ: StoreFaqItem[] = [
  {
    id: 'printer-width',
    question: 'Ο εκτυπωτής κόβει τις τιμές',
    answer:
      'Ρυθμίσεις εκτυπωτή → Πλάτος χαρτιού: 58mm για στενό, 80mm για φαρδύ. Κάθε κατάστημα έχει δική του ρύθμιση. Μετά δοκιμαστική εκτύπωση.',
  },
  {
    id: 'accept-order',
    question: 'Πώς δέχομαι παραγγελία;',
    answer:
      'Live παραγγελίες → Νέες → Αποδοχή και χρόνος προετοιμασίας. Αν χτυπάει πολλές χωρίς απάντηση, μπορεί να ενεργοποιηθεί αυτόματη αποδοχή (Auto-accept).',
  },
  {
    id: 'fresh2go-delivery',
    question: 'Παράδοση Fresh2GO ή κατάστημα;',
    answer:
      'Στις ρυθμίσεις/admin fulfilment: platform = Παράδοση Fresh2GO (οδηγοί πλατφόρμας). store = δικοί σου διανομείς.',
  },
  {
    id: 'promo-badge',
    question: 'Πώς φαίνεται προσφορά στην εφαρμογή;',
    answer:
      'Ρυθμίσεις καταστήματος → promo badge (π.χ. -20% ή 1+1). Εμφανίζεται στο «Προσφορές τώρα».',
  },
];
