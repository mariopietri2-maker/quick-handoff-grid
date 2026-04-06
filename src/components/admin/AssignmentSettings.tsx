import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';

export default function AssignmentSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base">Λειτουργία Ανάθεσης Οδηγών</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-sm">Αποδοχή / Απόρριψη</span>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs" variant="outline">Ενεργό</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Οι οδηγοί λαμβάνουν προσφορές παραγγελιών και έχουν 60 δευτερόλεπτα να αποδεχτούν ή να απορρίψουν.
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-heading font-semibold text-muted-foreground">Πώς λειτουργεί</p>
          <ul className="text-xs text-muted-foreground space-y-1.5">
            <li className="flex items-start gap-2">
              <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              Νέες παραγγελίες εμφανίζονται σε όλους τους διαθέσιμους οδηγούς ως προσφορές
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
              Ο πρώτος οδηγός που αποδέχεται αναλαμβάνει την παραγγελία
            </li>
            <li className="flex items-start gap-2">
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-red-500" />
              Σε απόρριψη ή λήξη χρόνου (60δ), η προσφορά παραμένει διαθέσιμη
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
