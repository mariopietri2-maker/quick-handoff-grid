#!/usr/bin/env python3
from pathlib import Path

p = Path("src/components/support/LiveChatThread.tsx")
t = p.read_text()
changed = False
if "onReopen" not in t:
    t = t.replace(
        "  disabled?: boolean;\n  title?: string;",
        "  disabled?: boolean;\n  onReopen?: () => void;\n  title?: string;",
    )
    t = t.replace(
        "  disabled = false,\n  title,\n  subtitle,\n  className,\n}: LiveChatThreadProps) {",
        "  disabled = false,\n  onReopen,\n  title,\n  subtitle,\n  className,\n}: LiveChatThreadProps) {",
    )
    t = t.replace(
        "  const [sending, setSending] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);",
        "  const [sending, setSending] = useState(false);\n  const [sessionClosed, setSessionClosed] = useState(false);\n  const scrollRef = useRef<HTMLDivElement>(null);",
    )
    t = t.replace(
        "  const topic = messages.find((m) => m.topic)?.topic ?? null;\n\n  useEffect(() => {\n    if (!participantId) return;",
        "  const topic = messages.find((m) => m.topic)?.topic ?? null;\n  const effectivelyDisabled = disabled || sessionClosed;\n\n  useEffect(() => {\n    if (!participantId) return;",
    )
    changed = True

if "setSessionClosed(status === 'closed')" not in t:
    marker = "  useEffect(() => {\n    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });\n  }, [messages]);"
    effect = """
  useEffect(() => {
    if (!participantId) return;
    let active = true;
    const applyStatus = (status: string | null | undefined) => {
      if (!active) return;
      setSessionClosed(status === 'closed');
    };
    const loadSession = async () => {
      let q: any = (supabase as any)
        .from('live_chat_sessions')
        .select('id, status, closed_at')
        .order('created_at', { ascending: false })
        .limit(1);
      if (driverId) q = q.eq('driver_id', driverId);
      else if (storeId) q = q.eq('store_id', storeId);
      else q = q.eq('customer_id', customerId);
      const { data } = await q.maybeSingle();
      applyStatus((data as { status?: string } | null)?.status ?? null);
    };
    void loadSession();
    const filter = driverId
      ? `driver_id=eq.${driverId}`
      : storeId
        ? `store_id=eq.${storeId}`
        : `customer_id=eq.${customerId}`;
    const channel = supabase
      .channel(`live-session-${participantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_chat_sessions', filter },
        (payload) => {
          const row = (payload.new ?? payload.old) as { status?: string } | null;
          if (row?.status) applyStatus(row.status);
          else void loadSession();
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [driverId, customerId, storeId, participantId]);

"""
    if marker in t:
        t = t.replace(marker, effect + marker)
        changed = True

t2 = t.replace(
    "if (!msg || !user || !participantId || sending || sendingRef.current || disabled) return;",
    "if (!msg || !user || !participantId || sending || sendingRef.current || effectivelyDisabled) return;",
)
if t2 != t:
    t = t2
    changed = True

if "errText.includes('closed')" not in t:
    t = t.replace(
        """    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(msg);
      return;
    }""",
        """    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(msg);
      const errText = String(error.message || error).toLowerCase();
      if (errText.includes('closed') || errText.includes('κλειστ')) {
        setSessionClosed(true);
      }
      return;
    }""",
    )
    changed = True

if "Ξεκίνα νέα συνομιλία" not in t:
    t = t.replace(
        """      {disabled ? (
        <div className="shrink-0 border-t bg-card p-3 text-center text-xs text-muted-foreground">
          Συνομιλία κλειστή — μόνο για ανάγνωση.
        </div>
      ) : (""",
        """      {effectivelyDisabled ? (
        <div className="shrink-0 border-t bg-card p-3 space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            Η συνομιλία έκλεισε από την υποστήριξη — μόνο για ανάγνωση.
          </p>
          {onReopen && (viewerRole === 'customer' || viewerRole === 'driver' || viewerRole === 'store') && (
            <Button type="button" className="w-full h-10 text-sm font-bold" onClick={() => onReopen()}>
              Ξεκίνα νέα συνομιλία
            </Button>
          )}
        </div>
      ) : (""",
    )
    changed = True

p.write_text(t)
print("LiveChatThread", "changed" if changed else "noop")

bp = Path("src/components/customer/CustomerSupportButton.tsx")
bt = bp.read_text()
if "liveTopic" not in bt:
    bt = bt.replace(
        "const [view, setView] = useState<'menu' | 'category' | 'tickets' | 'chat' | 'live'>('menu');",
        "const [view, setView] = useState<'menu' | 'category' | 'tickets' | 'chat' | 'live'>('menu');\n  const [liveTopic, setLiveTopic] = useState<string | null>(null);",
    )
if "const openLive" not in bt:
    bt = bt.replace(
        """  const reset = () => {
    setCategory(null);
    setDescription('');
    setActiveTicket(null);
    setView('menu');
  };""",
        """  const reset = () => {
    setCategory(null);
    setDescription('');
    setActiveTicket(null);
    setLiveTopic(null);
    setView('menu');
  };

  const openLive = (topicKey?: string | null) => {
    setLiveTopic(topicKey ?? null);
    setView('live');
  };""",
    )
bt = bt.replace("onClick={() => setView('live')}", "onClick={() => openLive(null)}")
bt = bt.replace(
    "onClick={() => { setCategory(c); setView(c.urgent ? 'live' : 'category'); }}",
    "onClick={() => { setCategory(c); openLive(c.key); }}",
)
bt = bt.replace("onClick={() => setView('tickets')}", "onClick={() => openLive(null)}")
bt = bt.replace(
    '<CustomerLiveChat orderId={orderId} className="h-[62vh]" />',
    '<CustomerLiveChat orderId={orderId} topic={liveTopic} className="h-[62vh]" />',
)
bt = bt.replace(
    """                <p className="text-[10px] uppercase tracking-wider font-heading font-bold text-muted-foreground mb-2 px-1">
                  Νέο αίτημα
                </p>""",
    """                <p className="text-[10px] uppercase tracking-wider font-heading font-bold text-muted-foreground mb-2 px-1">
                  Ζωντανή συνομιλία — διάλεξε θέμα
                </p>""",
)
bp.write_text(bt)
print("SupportButton ok")
print("done")
