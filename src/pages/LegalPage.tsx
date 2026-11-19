import { useParams, Link, Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Shield, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/hooks/useAuth";

type LegalKey = "terms" | "privacy" | "refunds";

const COMPANY = {
  name: "Fresh2GO",
  legal: "Fresh2GO",
  responsible: "Mario Pietri",
  afm: "152193390",
  email: "support@fresh2go.gr",
  address: "Ιωάννινα, Ελλάδα",
  site: "https://fresh2go.gr",
};

const CONTENT: Record<LegalKey, { icon: any; el: { title: string; updated: string; sections: { h: string; p: string }[] }; en: { title: string; updated: string; sections: { h: string; p: string }[] } }> = {
  terms: {
    icon: FileText,
    el: {
      title: "Όροι Χρήσης",
      updated: "Τελευταία ενημέρωση: Νοέμβριος 2026",
      sections: [
        { h: "1. Ταυτότητα παρόχου", p: `Η πλατφόρμα ${COMPANY.name} (εφεξής «η Πλατφόρμα») διατίθεται μέσω του ${COMPANY.site} και των εφαρμογών για κινητά. Υπεύθυνος / σε επιμέλεια: ${COMPANY.responsible}. Α.Φ.Μ.: ${COMPANY.afm}. Περιοχή δραστηριότητας: κυρίως Ιωάννινα και όποια άλλη περιοχή ανακοινωθεί στην Πλατφόρμα. Επικοινωνία: ${COMPANY.email}.` },
        { h: "2. Αντικείμενο", p: `Η ${COMPANY.name} παρέχει διαδικτυακή υπηρεσία διαμεσολάβησης για προβολή καταστημάτων, ηλεκτρονική παραγγελία και συντονισμό παράδοσης όπου διατίθεται. Η Πλατφόρμα δεν είναι ο παραγωγός/πωλητής των προϊόντων των καταστημάτων, εκτός αν ρητά αναφέρεται διαφορετικά.` },
        { h: "3. Αποδοχή όρων", p: "Με την εγγραφή, σύνδεση ή χρήση της Πλατφόρμας δηλώνετε ότι είστε τουλάχιστον 18 ετών (ή έχετε νόμιμη συναίνεση όπου απαιτείται), αποδέχεστε τους παρόντες Όρους και την Πολιτική Απορρήτου και ότι τα στοιχεία σας είναι αληθή. Αν δεν συμφωνείτε, μην χρησιμοποιείτε την Πλατφόρμα." },
        { h: "4. Λογαριασμός χρήστη", p: "Απαιτείται λογαριασμός με email, ονοματεπώνυμο και κινητό τηλέφωνο. Είστε υπεύθυνοι για την ασφάλεια των κωδικών σας. Μπορούμε να περιορίσουμε ή να απενεργοποιήσουμε λογαριασμό σε περίπτωση παραβίασης όρων, απάτης ή κατάχρησης." },
        { h: "5. Παραγγελίες", p: "Η παραγγελία υποβάλλεται μέσω της Πλατφόρμας προς το επιλεγμένο κατάστημα. Η αποδοχή γίνεται από το κατάστημα (ή σύμφωνα με τις ρυθμίσεις της Πλατφόρμας). Τιμές, διαθεσιμότητα, χρόνοι και ελάχιστη παραγγελία εμφανίζονται πριν την ολοκλήρωση και μπορεί να αλλάζουν." },
        { h: "6. Τιμές, χρεώσεις και πληρωμές", p: "Μπορεί να ισχύουν κόστος παράδοσης, ελάχιστη παραγγελία, προμήθειες ή προσφορές, όπως αναγράφονται πριν την ολοκλήρωση. Πληρωμή: μετρητά και/ή ηλεκτρονικά μέσα όπου διατίθενται." },
        { h: "7. Παράδοση", p: "Οι χρόνοι παράδοσης είναι εκτιμήσεις και δεν αποτελούν εγγύηση. Ο πελάτης οφείλει ακριβή διεύθυνση και διαθεσιμότητα παραλαβής. Αδυναμία παράδοσης λόγω εσφαλμένων στοιχείων ή απουσίας μπορεί να επιφέρει χρέωση σύμφωνα με την πολιτική παραγγελίας." },
        { h: "8. Καταστήματα και οδηγοί", p: "Τα καταστήματα είναι ανεξάρτητες επιχειρήσεις. Ευθύνη για ποιότητα, σύνθεση, αλλεργιογόνα και συμμόρφωση τροφίμων φέρει το κατάστημα, εκτός όπου ο νόμος ορίζει διαφορετικά. Οι οδηγοί/διανομείς λειτουργούν στο πλαίσιο συνεργασίας με την Πλατφόρμα ή το κατάστημα." },
        { h: "9. Προσφορές και κουπόνια", p: "Προσφορές, κωδικοί και τυχόν παιχνίδια ισχύουν με τους ειδικούς όρους κάθε προσφοράς. Μπορούν να ανακληθούν ή να τροποποιηθούν. Κατάχρηση οδηγεί σε ακύρωση οφέλους." },
        { h: "10. Υποχρεώσεις χρήστη", p: "Απαγορεύεται ενδεικτικά: ψευδή στοιχεία ή παραγγελίες, κακόβουλη χρήση ή παρεμβολή στα συστήματα, παρενόχληση καταστημάτων/οδηγών/προσωπικού, χρήση για παράνομους σκοπούς." },
        { h: "11. Διανοητική ιδιοκτησία", p: `Λογότυπα, σήματα, λογισμικό και περιεχόμενο ${COMPANY.name} ανήκουν στον πάροχο ή στους δικαιούχους.` },
        { h: "12. Περιορισμός ευθύνης", p: "Στο μέγιστο βαθμό που επιτρέπει ο νόμος, η Πλατφόρμα παρέχεται «ως έχει». Δεν ευθυνόμαστε για καθυστερήσεις ή σφάλματα που οφείλονται σε κατάστημα, δίκτυα τρίτων, ανωτέρα βία ή εσφαλμένα στοιχεία χρήστη. Δεν θίγονται αναγκαστικά δικαιώματα καταναλωτή." },
        { h: "13. Προσωπικά δεδομένα", p: `Η επεξεργασία δεδομένων γίνεται σύμφωνα με την Πολιτική Απορρήτου της ${COMPANY.name} και τον GDPR / ν. 4624/2019.` },
        { h: "14. Τροποποιήσεις", p: "Μπορούμε να ενημερώνουμε τους παρόντες όρους. Η συνέχιση χρήσης μετά τη δημοσίευση συνιστά αποδοχή, εκτός αν ο νόμος απαιτεί ρητή συναίνεση." },
        { h: "15. Εφαρμοστέο δίκαιο", p: "Εφαρμοστέο δίκαιο: Ελληνικό, με επιφύλαξη κανόνων προστασίας καταναλωτή." },
        { h: "16. Επικοινωνία", p: `Για παράπονα ή αιτήματα: ${COMPANY.email} · ${COMPANY.site}. Υπεύθυνος: ${COMPANY.responsible} — Α.Φ.Μ. ${COMPANY.afm}.` },
      ],
    },
    en: {
      title: "Terms of Use",
      updated: "Last updated: November 2026",
      sections: [
        { h: "1. Provider identity", p: `The ${COMPANY.name} platform (the "Platform") is available at ${COMPANY.site} and related mobile apps. Responsible person: ${COMPANY.responsible}. Tax ID (Α.Φ.Μ.): ${COMPANY.afm}. Main area: Ioannina, Greece. Contact: ${COMPANY.email}.` },
        { h: "2. Scope", p: `${COMPANY.name} provides an online intermediation service for browsing stores, placing orders and coordinating delivery where available.` },
        { h: "3. Acceptance", p: "By registering, signing in or using the Platform you accept these Terms and the Privacy Policy. If you disagree, do not use the Platform." },
        { h: "4. User account", p: "An account with email, full name and mobile phone is required. You are responsible for credential security." },
        { h: "5. Orders", p: "Orders are submitted via the Platform to the selected store. Prices, availability and times are shown before checkout." },
        { h: "6. Prices and payments", p: "Delivery fees, minimum order or offers may apply as shown before checkout. Payment: cash and/or electronic methods where available." },
        { h: "7. Delivery", p: "Delivery times are estimates. Customers must provide an accurate address and be available to receive." },
        { h: "8. Stores and drivers", p: "Stores are independent businesses. Food quality and compliance responsibility lies with the store, except where law provides otherwise." },
        { h: "9. Offers and coupons", p: "Offers and codes are subject to each offer's specific terms and may be changed or withdrawn." },
        { h: "10. User obligations", p: "Prohibited: false details or orders, malicious use, harassment, illegal use." },
        { h: "11. Intellectual property", p: `${COMPANY.name} logos, software and content belong to the provider or rights holders.` },
        { h: "12. Limitation of liability", p: "To the maximum extent permitted by law, the Platform is provided 'as is'. Mandatory consumer rights are not affected." },
        { h: "13. Personal data", p: `Processing is governed by the ${COMPANY.name} Privacy Policy and GDPR / Greek Law 4624/2019.` },
        { h: "14. Changes", p: "We may update these Terms. Continued use after publication constitutes acceptance unless law requires explicit consent." },
        { h: "15. Governing law", p: "Greek law applies, subject to consumer protection rules." },
        { h: "16. Contact", p: `${COMPANY.email} · ${COMPANY.site} · ${COMPANY.responsible} — Tax ID ${COMPANY.afm}.` },
      ],
    },
  },
  privacy: {
    icon: Shield,
    el: {
      title: "Πολιτική Απορρήτου",
      updated: "Τελευταία ενημέρωση: Νοέμβριος 2026",
      sections: [
        { h: "1. Υπεύθυνος επεξεργασίας", p: `${COMPANY.name}. Υπεύθυνος: ${COMPANY.responsible}. Α.Φ.Μ.: ${COMPANY.afm}. Διεύθυνση: ${COMPANY.address}. Email: ${COMPANY.email}.` },
        { h: "2. Δεδομένα που συλλέγουμε", p: "Ενδεικτικά: όνομα, email, τηλέφωνο, διευθύνσεις παράδοσης, ιστορικό παραγγελιών, δεδομένα πληρωμής μέσω παρόχου, δεδομένα συσκευής/χρήσης, τοποθεσία όταν την ενεργοποιείτε για παράδοση." },
        { h: "3. Σκοποί και νομική βάση", p: "Εκτέλεση σύμβασης (λογαριασμός, παραγγελίες, παράδοση), έννομο συμφέρον (βελτίωση υπηρεσίας, ασφάλεια, πρόληψη απάτης), νομική υποχρέωση (φορολογία), συναίνεση όπου απαιτείται (π.χ. marketing)." },
        { h: "4. Αποδέκτες", p: "Καταστήματα και οδηγοί στο μέτρο που απαιτείται για την παραγγελία/παράδοση, πάροχοι φιλοξενίας/πληρωμών/μηνυμάτων, και αρχές όπου επιβάλλεται από τον νόμο. Δεν πωλούμε δεδομένα σε τρίτους." },
        { h: "5. Χρόνος διατήρησης", p: "Διατηρούμε δεδομένα όσο διαρκεί ο λογαριασμός και για όσο απαιτείται για παραγγελίες, υποστήριξη και φορολογικές/νομικές υποχρεώσεις, και στη συνέχεια διαγραφή ή ανωνυμοποίηση." },
        { h: "6. Δικαιώματά σας (GDPR)", p: `Πρόσβαση, διόρθωση, διαγραφή, περιορισμός, φορητότητα, εναντίωση και ανάκληση συναίνεσης. Αίτημα: ${COMPANY.email}. Δικαίωμα καταγγελίας στην Αρχή Προστασίας Δεδομένων (www.dpa.gr).` },
        { h: "6α. Διαγραφή λογαριασμού και δεδομένων", p: `Μπορείτε να ζητήσετε διαγραφή λογαριασμού και σχετικών δεδομένων από το προφίλ ή με email στο ${COMPANY.email} (θέμα: «Διαγραφή λογαριασμού»). Εντός 30 ημερών διαγράφουμε ή ανωνυμοποιούμε, με εξαίρεση αρχεία που πρέπει να τηρηθούν για φορολογικούς/νομικούς λόγους.` },
        { h: "7. Cookies", p: "Χρησιμοποιούμε απαραίτητα cookies συνεδρίας και προαιρετικά analytics. Μπορείτε να τα περιορίσετε από τις ρυθμίσεις του browser." },
        { h: "8. Ασφάλεια", p: `Εφαρμόζουμε κατάλληλα τεχνικά και οργανωτικά μέτρα. Αναφέρετε ύποπτη δραστηριότητα στο ${COMPANY.email}.` },
        { h: "9. Παιδιά", p: "Η υπηρεσία δεν απευθύνεται σε άτομα κάτω των 18 ετών." },
      ],
    },
    en: {
      title: "Privacy Policy",
      updated: "Last updated: November 2026",
      sections: [
        { h: "1. Controller", p: `${COMPANY.name}. Responsible: ${COMPANY.responsible}. Tax ID: ${COMPANY.afm}. Address: ${COMPANY.address}. Email: ${COMPANY.email}.` },
        { h: "2. Data we collect", p: "Including name, email, phone, delivery addresses, order history, payment data via providers, device/usage data, and location when enabled for delivery." },
        { h: "3. Purposes and legal bases", p: "Contract performance, legitimate interests (security, fraud prevention, improvement), legal obligation, and consent where required." },
        { h: "4. Recipients", p: "Stores and drivers as needed for the order/delivery, hosting/payment/messaging providers, and authorities where required by law. We do not sell personal data." },
        { h: "5. Retention", p: "While the account is active and as needed for orders, support, tax/legal duties, then delete or anonymize." },
        { h: "6. Your rights (GDPR)", p: `Access, rectification, erasure, restriction, portability, objection and withdrawal of consent. Requests: ${COMPANY.email}. Complaints: Hellenic DPA (www.dpa.gr).` },
        { h: "6a. Account and data deletion", p: `Request deletion from profile or email ${COMPANY.email} (subject: "Account deletion"). Within 30 days we delete or anonymize, except records we must keep for tax or legal reasons.` },
        { h: "7. Cookies", p: "Essential session cookies and optional analytics. You can limit them in browser settings." },
        { h: "8. Security", p: `Appropriate technical and organisational measures. Report suspicious activity to ${COMPANY.email}.` },
        { h: "9. Children", p: "The service is not directed at persons under 18." },
      ],
    },
  },
  refunds: {
    icon: RefreshCw,
    el: {
      title: "Πολιτική Επιστροφών & Ακυρώσεων",
      updated: "Τελευταία ενημέρωση: Νοέμβριος 2026",
      sections: [
        { h: "1. Γενικά", p: `Η ${COMPANY.name} διευκολύνει παραγγελίες μεταξύ πελατών και καταστημάτων. Ακυρώσεις και επιστροφές εξετάζονται κατά περίπτωση.` },
        { h: "2. Φύση προϊόντων", p: "Τα τρόφιμα είναι αναλώσιμα και κατά κανόνα εξαιρούνται από το δικαίωμα υπαναχώρησης 14 ημερών, με επιφύλαξη ειδικών διατάξεων προστασίας καταναλωτή." },
        { h: "3. Ακύρωση από πελάτη", p: "Πριν την αποδοχή από το κατάστημα, η ακύρωση είναι συνήθως δυνατή από την εφαρμογή. Μετά την αποδοχή ή κατά την προετοιμασία/παράδοση, μπορεί να μην είναι διαθέσιμη ή να υπόκειται σε χρέωση." },
        { h: "4. Ζητήματα ποιότητας / λάθος παραγγελία", p: `Επικοινωνήστε άμεσα μέσω της εφαρμογής ή στο ${COMPANY.email} με στοιχεία παραγγελίας. Θα συντονίσουμε με το κατάστημα για εύλογη λύση (αντικατάσταση, μερική/ολική επιστροφή κ.λπ.).` },
        { h: "5. Επιστροφές χρημάτων", p: "Για ηλεκτρονικές πληρωμές, εγκεκριμένες επιστροφές γίνονται στο αρχικό μέσο πληρωμής εντός των προθεσμιών παρόχου/τράπεζας." },
        { h: "6. Επικοινωνία", p: `${COMPANY.email} · ${COMPANY.site} · Υπεύθυνος: ${COMPANY.responsible} (Α.Φ.Μ. ${COMPANY.afm}).` },
      ],
    },
    en: {
      title: "Refunds & Cancellations",
      updated: "Last updated: November 2026",
      sections: [
        { h: "1. General", p: `${COMPANY.name} facilitates orders between customers and stores. Cancellations and refunds are handled case by case.` },
        { h: "2. Nature of goods", p: "Food is perishable and generally exempt from the 14-day withdrawal right, subject to mandatory consumer protection rules." },
        { h: "3. Customer cancellation", p: "Before store acceptance, cancellation is usually available in the app. After acceptance, it may be unavailable or subject to a charge." },
        { h: "4. Quality issues / wrong order", p: `Contact us promptly in the app or at ${COMPANY.email}. We will coordinate with the store for a reasonable remedy.` },
        { h: "5. Refunds", p: "Approved electronic refunds go to the original payment method within provider/bank timelines." },
        { h: "6. Contact", p: `${COMPANY.email} · ${COMPANY.site} · ${COMPANY.responsible} (Tax ID ${COMPANY.afm}).` },
      ],
    },
  },
};

export default function LegalPage() {
  const { doc } = useParams<{ doc: string }>();
  const { lang: language } = useI18n();
  const { profile } = useAuth();
  const key = doc as LegalKey;

  if (!CONTENT[key]) return <Navigate to="/" replace />;

  const data = CONTENT[key];
  const lang = (language === "en" ? "en" : "el") as "el" | "en";
  const c = data[lang];
  const Icon = data.icon;

  const roleHome: Record<string, { path: string; el: string; en: string }> = {
    customer: { path: "/order", el: "Παραγγελία", en: "Order" },
    store:    { path: "/store",  el: "Κατάστημα", en: "Store" },
    driver:   { path: "/driver", el: "Οδηγός",    en: "Driver" },
    m:        { path: "/driver", el: "Οδηγός",    en: "Driver" },
    admin:    { path: "/admin",  el: "Διαχείριση", en: "Admin" },
    support:  { path: "/support", el: "Υποστήριξη", en: "Support" },
  };
  const home = (profile?.role && roleHome[profile.role]) || { path: "/", el: "Αρχική", en: "Home" };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to={home.path}><ArrowLeft className="h-4 w-4 mr-1" />{home[lang]}</Link>
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <h1 className="font-heading font-bold text-lg">{c.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-xs text-muted-foreground mb-6">{c.updated}</p>
        <Card>
          <CardContent className="pt-6 space-y-6">
            {c.sections.map((s, i) => (
              <section key={i}>
                <h2 className="font-heading font-semibold text-base mb-2">{s.h}</h2>
                <p className="text-sm text-foreground/80 leading-relaxed">{s.p}</p>
              </section>
            ))}
            {key === "privacy" && (
              <section id="delete-account" className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <h2 className="font-heading font-semibold text-base mb-2">
                  {lang === "el" ? "Διαγραφή λογαριασμού" : "Delete your account"}
                </h2>
                <p className="text-sm text-foreground/80 leading-relaxed mb-3">
                  {lang === "el"
                    ? "Χρησιμοποιήστε τον παρακάτω σύνδεσμο για να ζητήσετε τη διαγραφή του λογαριασμού σας και όλων των συσχετισμένων δεδομένων."
                    : "Use the link below to request deletion of your account and all associated data."}
                </p>
                <a
                  href={`mailto:${COMPANY.email}?subject=Account%20deletion%20request&body=Please%20delete%20my%20Fresh2GO%20account%20and%20associated%20data.`}
                  className="inline-flex items-center text-sm font-semibold text-primary underline underline-offset-4"
                >
                  {lang === "el" ? "Αίτημα διαγραφής λογαριασμού" : "Request account deletion"}
                </a>
                <p className="text-xs text-muted-foreground mt-3">
                  {COMPANY.email} · {COMPANY.site}/legal/privacy#delete-account
                </p>
              </section>
            )}
          </CardContent>
        </Card>

        <nav className="mt-6 flex flex-wrap gap-2 justify-center">
          {(["terms", "privacy", "refunds"] as LegalKey[]).filter(k => k !== key).map(k => (
            <Button key={k} asChild variant="outline" size="sm">
              <Link to={`/legal/${k}`}>{CONTENT[k][lang].title}</Link>
            </Button>
          ))}
        </nav>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {COMPANY.name} · {COMPANY.responsible} · Α.Φ.Μ. {COMPANY.afm} · {COMPANY.email}
        </p>
      </main>
    </div>
  );
}
