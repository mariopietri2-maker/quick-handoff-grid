import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  MessageSquareText,
  Gauge,
  FileText,
  Send,
  Wand2,
  Bot,
  Zap,
  TrendingUp,
  CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { tryConsumeAiCall, loadGuardrails, effective, getAiCallsToday } from '@/lib/cost-guardrails';
import { cn } from '@/lib/utils';

interface Props {
  ticketId: string;
  onUseReply: (text: string) => void;
  /** When set, "Αποστολή" posts immediately into the ticket chat. */
  onReplySent?: () => void;
  autoSuggest?: boolean;
}

type Action = 'suggest_reply' | 'send_reply' | 'summarize' | 'triage' | 'custom';

interface Triage {
  priority?: string;
  suggested_status?: string;
  reason?: string;
  next_action?: string;
}

const ACTION_BUTTONS: { action: Action; label: string; hint: string; icon: any; primary?: boolean }[] = [
  { action: 'suggest_reply', label: 'Πρόταση', hint: 'Πρόχειρο απάντησης', icon: MessageSquareText },
  { action: 'send_reply', label: 'Αποστολή', hint: 'Άμεση απάντηση', icon: Send, primary: true },
  { action: 'summarize', label: 'Σύνοψη', hint: 'Περίληψη ticket', icon: FileText },
  { action: 'triage', label: 'Triage', hint: 'Αξιολόγηση', icon: Gauge },
];

export function SupportAIPanel({
  ticketId,
  onUseReply,
  onReplySent,
  autoSuggest = true,
}: Props) {
  const [loading, setLoading] = useState<Action | null>(null);
  const [result, setResult] = useState('');
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [autoOn, setAutoOn] = useState(autoSuggest);
  const suggestedFor = useRef<string | null>(null);

  const aiToday = getAiCallsToday();
  const cap = effective(loadGuardrails()).aiDailyCallCap;

  const run = async (action: Action, opts?: { applyTriage?: boolean; replyText?: string }) => {
    // Sending an already-generated draft does not consume another AI credit.
    const needsAi = !(action === 'send_reply' && (opts?.replyText || result).trim());
    if (needsAi) {
      const gate = tryConsumeAiCall();
      if (!gate.ok) {
        toast.error(gate.reason ?? 'AI μπλοκαρισμένο');
        return;
      }
    }
    setLoading(action);
    setActiveAction(action === 'send_reply' ? 'suggest_reply' : action);
    if (action !== 'send_reply') setResult('');
    try {
      const preferCheap = effective(loadGuardrails()).aiPreferCheapModel;
      const { data, error } = await supabase.functions.invoke('support-ai', {
        body: {
          ticketId,
          action,
          customPrompt: action === 'custom' ? customPrompt : undefined,
          preferCheap,
          apply: opts?.applyTriage === true,
          replyText: action === 'send_reply' ? (opts?.replyText || result || undefined) : undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const text = (data as any).result ?? '';
      setResult(text);
      if (action === 'send_reply') {
        toast.success('Η AI απάντηση στάλθηκε στο ticket');
        onReplySent?.();
      }
    } catch (e: any) {
      toast.error(e.message ?? 'Σφάλμα AI');
    } finally {
      setLoading(null);
    }
  };

  // Auto-draft when agent opens a ticket (once per ticket id).
  useEffect(() => {
    if (!autoOn || !ticketId) return;
    if (suggestedFor.current === ticketId) return;
    suggestedFor.current = ticketId;
    void run('suggest_reply');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, autoOn]);

  const copy = async () => {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  let triage: Triage | null = null;
  if (activeAction === 'triage' && result) {
    try {
      const cleaned = result.replace(/```json\n?|```/g, '').trim();
      triage = JSON.parse(cleaned);
    } catch {
      // not JSON
    }
  }

  const priorityColor = (p?: string) => {
    switch (p) {
      case 'critical':
      case 'sos':
        return 'bg-red-500/10 text-red-700 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/30';
      case 'medium':
      case 'normal':
        return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30';
      default:
        return 'bg-green-500/10 text-green-700 border-green-500/30';
    }
  };

  const statusColor = (s?: string) => {
    switch (s) {
      case 'open':
        return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
      case 'in_progress':
        return 'bg-orange-500/10 text-orange-700 border-orange-500/30';
      case 'resolved':
        return 'bg-green-500/10 text-green-700 border-green-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const hasResult = !!result.trim();

  return (
    <div className="flex flex-col min-h-0">
      {/* Quick actions */}
      <div className="p-3 space-y-2.5">
        <p className="text-[10px] uppercase tracking-wider font-heading font-bold text-muted-foreground flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-primary" /> Γρήγορες ενέργειες
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ACTION_BUTTONS.map(({ action, label, hint, icon: Icon, primary }) => (
            <button
              key={action}
              onClick={() => run(action)}
              disabled={loading !== null}
              className={cn(
                'group rounded-xl border p-2.5 text-left transition-all disabled:opacity-50 disabled:pointer-events-none',
                primary
                  ? 'border-transparent bg-primary text-primary-foreground shadow-primary hover:brightness-105'
                  : 'bg-card hover:border-primary/40 hover:shadow-sm',
              )}
            >
              {loading === action ? (
                <Loader2 className={cn('h-4 w-4 animate-spin', primary ? '' : 'text-primary')} />
              ) : (
                <Icon className={cn('h-4 w-4', primary ? '' : 'text-primary')} />
              )}
              <span className={cn('block text-[12px] font-semibold mt-1.5 leading-none', primary ? 'text-primary-foreground' : '')}>
                {label}
              </span>
              <span className={cn('block text-[9.5px] mt-1 leading-none', primary ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Custom prompt */}
      <div className="px-3 pb-1">
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ring/40">
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ρώτησε κάτι για το ticket..."
            rows={2}
            className="resize-none text-sm border-0 focus-visible:ring-0 shadow-none min-h-[52px]"
          />
          <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-2 py-1.5">
            <span className="text-[9.5px] text-muted-foreground flex items-center gap-1">
              <Bot className="h-3 w-3" /> Context ticket + προφίλ
            </span>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => run('custom')}
              disabled={loading !== null || !customPrompt.trim()}
            >
              {loading === 'custom' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Ερώτηση
            </Button>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="px-3 pb-2 flex-1 min-h-0">
        {hasResult ? (
          <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-3 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider font-heading font-bold text-primary flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                {activeAction === 'summarize'
                  ? 'Σύνοψη'
                  : activeAction === 'triage'
                    ? 'Αξιολόγηση triage'
                    : 'Πρόχειρο απάντησης'}
              </p>
              {loading === activeAction && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            {triage ? (
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={cn('inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded-md border font-semibold', priorityColor(triage.priority))}>
                    <Gauge className="h-3 w-3" /> {triage.priority ?? '—'}
                  </span>
                  {triage.suggested_status && (
                    <span className={cn('inline-flex items-center gap-1 text-[10px] uppercase px-2 py-0.5 rounded-md border font-semibold', statusColor(triage.suggested_status))}>
                      <CheckCheck className="h-3 w-3" /> {triage.suggested_status}
                    </span>
                  )}
                </div>
                {triage.reason && (
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold text-foreground">Λόγος: </span>
                    <span className="text-muted-foreground">{triage.reason}</span>
                  </p>
                )}
                {triage.next_action && (
                  <p className="text-xs leading-relaxed">
                    <span className="font-semibold text-foreground">Επόμενο βήμα: </span>
                    <span className="text-muted-foreground">{triage.next_action}</span>
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{result}</p>
            )}

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/60">
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={copy}>
                {copied ? <Check className="h-3 w-3 mr-1 text-success" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Αντιγράφηκε' : 'Αντιγραφή'}
              </Button>
              {activeAction !== 'triage' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => {
                      onUseReply(result);
                      toast.success('Προστέθηκε στο πεδίο μηνύματος');
                    }}
                  >
                    Χρήση ως πρόχειρο
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={loading !== null}
                    onClick={() => run('send_reply', { replyText: result })}
                  >
                    {loading === 'send_reply' ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                    Στείλε τώρα
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-3 text-center">
            {loading === 'suggest_reply' || loading === 'summarize' || loading === 'triage' || loading === 'custom' ? (
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                Το AI επεξεργάζεται το ticket...
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground py-1">
                Οι προτάσεις του AI θα εμφανίζονται εδώ.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer — auto toggle + usage meter */}
      <div className="shrink-0 border-t px-3 py-2 flex items-center justify-between gap-2 bg-muted/20">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Switch id="ai-auto" checked={autoOn} onCheckedChange={setAutoOn} className="scale-90" />
          <span className="text-[10px] font-semibold text-muted-foreground leading-none">Auto</span>
        </label>
        <span className="text-[9.5px] text-muted-foreground flex items-center gap-1 tabular-nums">
          <TrendingUp className="h-3 w-3" />
          AI σήμερα: {aiToday} / {cap}
        </span>
      </div>
    </div>
  );
}
