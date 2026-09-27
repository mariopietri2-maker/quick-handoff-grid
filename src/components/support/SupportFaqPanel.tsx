import { useState } from 'react';
import { ChevronDown, Bot } from 'lucide-react';
import { SUPPORT_FAQ } from '@/lib/support-faq';
import { STORE_HELPER_FAQ } from '@/lib/store-helper-faq';
import { cn } from '@/lib/utils';

type Mode = 'customer' | 'store';

export function SupportFaqPanel({ mode = 'customer', className }: { mode?: Mode; className?: string }) {
  const items =
    mode === 'store'
      ? STORE_HELPER_FAQ.map((x) => ({ id: x.id, question: x.question, answer: x.answer }))
      : SUPPORT_FAQ.map((x) => ({ id: x.id, question: x.question, answer: x.answer }));
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className={cn('rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2', className)}>
      <div className="flex items-center gap-2 text-sm font-heading font-bold">
        <Bot className="h-4 w-4 text-orange-600" />
        Συχνές ερωτήσεις
        <span className="text-[10px] font-normal text-muted-foreground ml-auto">Bot</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <li key={item.id} className="rounded-lg bg-background border border-border/50 overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-xs font-semibold hover:bg-muted/50"
                onClick={() => setOpenId(open ? null : item.id)}
              >
                <span className="flex-1">{item.question}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
                  {item.answer}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
