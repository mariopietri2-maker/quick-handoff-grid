import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { tryConsumeAiCall, loadGuardrails, effective } from '@/lib/cost-guardrails';

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

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-heading font-semibold text-sm">AI Υποστήριξη</p>
              <p className="text-[10px] text-muted-foreground">Πρόταση & αποστολή απάντησης</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="ai-auto" checked={autoOn} onCheckedChange={setAutoOn} />
            <Label htmlFor="ai-auto" className="text-[10px] text-muted-foreground cursor-pointer">
              Auto
            </Label>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => run('suggest_reply')}
            disabled={loading !== null}
            className="h-auto py-2 flex-col gap-1"
          >
            {loading === 'suggest_reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareText className="h-4 w-4" />}
            <span className="text-[10px]">Πρόταση</span>
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={() => run('send_reply')}
            disabled={loading !== null}
            className="h-auto py-2 flex-col gap-1"
          >
            {loading === 'send_reply' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="text-[10px]">Αποστολή</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run('summarize')}
            disabled={loading !== null}
            className="h-auto py-2 flex-col gap-1"
          >
            {loading === 'summarize' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            <span className="text-[10px]">Σύνοψη</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run('triage', { applyTriage: true })}
            disabled={loading !== null}
            className="h-auto py-2 flex-col gap-1"
          >
            {loading === 'triage' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
            <span className="text-[10px]">Triage</span>
          </Button>
        </div>

        <div className="flex gap-2">
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ρώτησε κάτι για το ticket..."
            rows={1}
            className="resize-none text-sm min-h-[36px]"
          />
          <Button
            size="sm"
            onClick={() => run('custom')}
            disabled={loading !== null || !customPrompt.trim()}
          >
            {loading === 'custom' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          </Button>
        </div>

        {result && (
          <div className="bg-card border rounded-lg p-3 space-y-2">
            {triage ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded border font-semibold ${priorityColor(triage.priority)}`}>
                    {triage.priority ?? '—'}
                  </span>
                  {triage.suggested_status && (
                    <span className="text-[10px] uppercase px-2 py-0.5 rounded border bg-muted text-muted-foreground">
                      → {triage.suggested_status}
                    </span>
                  )}
                </div>
                {triage.reason && <p className="text-xs"><span className="font-semibold">Λόγος:</span> {triage.reason}</p>}
                {triage.next_action && <p className="text-xs"><span className="font-semibold">Επόμενο βήμα:</span> {triage.next_action}</p>}
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{result}</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1 border-t">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copy}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Αντιγράφηκε' : 'Αντιγραφή'}
              </Button>
              {activeAction !== 'triage' && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      onUseReply(result);
                      toast.success('Προστέθηκε στο πεδίο μηνύματος');
                    }}
                  >
                    Χρήση ως πρόχειρο
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={loading !== null}
                    onClick={() => run('send_reply', { replyText: result })}
                  >
                    <Send className="h-3 w-3 mr-1" />
                    Στείλε τώρα
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
