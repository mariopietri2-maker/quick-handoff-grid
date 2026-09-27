/** Customer-facing FAQ for support bot / pre-chat help. Greek first. */
export type SupportFaqItem = {
  id: string;
  keywords: string[];
  question: string;
  answer: string;
};

export const SUPPORT_FAQ: SupportFaqItem[] = [
  {
    id: 'order-status',
    keywords: ['παραγγελ', 'πού είναι', 'status', 'tracking', 'παρακολούθηση'],
    question: 'Πού είναι η παραγγελία μου;',
    answer:
      'Άνοιξε Παραγγελίες → πάτα την ενεργή παραγγελία → Παρακολούθηση. Θα δεις κατάστημα, οδηγό (όταν ανατεθεί) και κατάσταση.',
  },
  {
    id: 'delivery-who',
    keywords: ['ποιος παραδίδει', 'fresh2go', 'οδηγός', 'delivery'],
    question: 'Ποιος παραδίδει;',
    answer:
      'Αν στο κατάστημα γράφει «Παράδοση Fresh2GO», παραδίδει οδηγός Fresh2GO. Αν γράφει «Παράδοση καταστήματος», παραδίδει το ίδιο το μαγαζί.',
  },
  {
    id: 'address',
    keywords: ['διεύθυνση', 'address', 'τοποθεσία'],
    question: 'Πώς αλλάζω διεύθυνση;',
    answer:
      'Αρχική → πάτα τη διεύθυνση πάνω από την αναζήτηση → επίλεξε ή πρόσθεσε νέα διεύθυνση στην περιοχή Ιωαννίνων.',
  },
  {
    id: 'payment',
    keywords: ['πληρωμή', 'κάρτα', 'μετρητά', 'payment'],
    question: 'Τρόποι πληρωμής;',
    answer: 'Ανάλογα με το κατάστημα: μετρητά στον διανομέα και/ή κάρτα όπου είναι ενεργό.',
  },
  {
    id: 'cancel',
    keywords: ['ακύρωση', 'cancel', 'ακυρώ'],
    question: 'Μπορώ να ακυρώσω;',
    answer:
      'Πριν το αποδεχτεί το κατάστημα, συνήθως μπορείς από Παραγγελίες. Μετά την αποδοχή, γράψε στο live chat για βοήθεια.',
  },
];

export function matchSupportFaq(message: string): SupportFaqItem | null {
  const q = message.toLowerCase().normalize('NFC');
  for (const item of SUPPORT_FAQ) {
    if (item.keywords.some((k) => q.includes(k.toLowerCase()))) return item;
  }
  return null;
}
