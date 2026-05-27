import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Zap, BookOpen, Wallet } from 'lucide-react';
import MoneyEnginePanel from './MoneyEnginePanel';
import LedgerExplorer from './LedgerExplorer';
import BasketDashboard from './BasketDashboard';

/**
 * Unified financial control room — merges the previous three sibling tabs
 * (Money Engine, Καθολικό κινήσεων, Driver Basket) into a single screen
 * with internal sub-tabs. One place for everything money-related.
 */
export default function MoneyHub() {
  const [tab, setTab] = useState<'engine' | 'ledger' | 'basket'>('engine');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-xl flex items-center gap-2">
          <Wallet className="h-5 w-5 text-success" />
          Money Hub
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ενιαίο κέντρο ελέγχου: split engine, κινήσεις και Driver Basket σε ένα μέρος.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-3 w-full max-w-2xl">
          <TabsTrigger value="engine" className="gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Engine
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Καθολικό
          </TabsTrigger>
          <TabsTrigger value="basket" className="gap-1.5">
            <Wallet className="h-3.5 w-3.5" /> Basket
          </TabsTrigger>
        </TabsList>

        <TabsContent value="engine" className="mt-4"><MoneyEnginePanel /></TabsContent>
        <TabsContent value="ledger" className="mt-4"><LedgerExplorer /></TabsContent>
        <TabsContent value="basket" className="mt-4"><BasketDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}
