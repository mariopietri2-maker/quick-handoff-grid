import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Zap, BookOpen, Wallet, Send } from 'lucide-react';
import MoneyEnginePanel from './MoneyEnginePanel';
import LedgerExplorer from './LedgerExplorer';
import BasketDashboard from './BasketDashboard';
import BufferDistributor from './BufferDistributor';

/**
 * Unified financial control room — engine, buffer distribution, ledger, basket.
 */
export default function MoneyHub() {
  const [tab, setTab] = useState<'engine' | 'buffer' | 'ledger' | 'basket'>('engine');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-xl flex items-center gap-2">
          <Wallet className="h-5 w-5 text-success" />
          Money Hub
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ενιαίο κέντρο ελέγχου: split engine, buffer διανομές, κινήσεις και Driver Basket.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid grid-cols-4 w-full max-w-3xl">
          <TabsTrigger value="engine" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Engine</TabsTrigger>
          <TabsTrigger value="buffer" className="gap-1.5"><Send className="h-3.5 w-3.5" /> Buffer</TabsTrigger>
          <TabsTrigger value="ledger" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Καθολικό</TabsTrigger>
          <TabsTrigger value="basket" className="gap-1.5"><Wallet className="h-3.5 w-3.5" /> Basket</TabsTrigger>
        </TabsList>

        <TabsContent value="engine" className="mt-4"><MoneyEnginePanel /></TabsContent>
        <TabsContent value="buffer" className="mt-4"><BufferDistributor /></TabsContent>
        <TabsContent value="ledger" className="mt-4"><LedgerExplorer /></TabsContent>
        <TabsContent value="basket" className="mt-4"><BasketDashboard /></TabsContent>
      </Tabs>
    </div>
  );
}

