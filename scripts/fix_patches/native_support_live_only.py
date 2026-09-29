#!/usr/bin/env python3
"""Native customer support: topics open live chat only (no tickets)."""
from pathlib import Path
import re

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
t = p.read_text()
old = """    /** Customer picks a problem first — urgent topics go to live chat, the rest become tickets. */
    fun selectSupportTopic(topic: String) {
        if (_state.value.userId == null) return
        if (topic in URGENT_TOPICS) {
            selectLiveChatTopic(topic)
        } else {
            _state.value = _state.value.copy(
                supportView = SupportView.Compose,
                ticketTopic = topic,
                ticketError = null,
            )
        }
    }"""
new = """    /** Customer picks a problem first — all topics open live chat (no tickets). */
    fun selectSupportTopic(topic: String) {
        if (_state.value.userId == null) return
        selectLiveChatTopic(topic)
    }"""
if old in t:
    t = t.replace(old, new)
    p.write_text(t)
    print('vm')
elif 'all topics open live chat' in t:
    print('vm ok')
else:
    print('vm miss')

p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SupportScreen.kt')
t = p.read_text()
t = t.replace(
    '/** A problem the customer picks before support (urgent topics open live chat, others tickets). */',
    '/** Problem the customer picks before live chat (becomes the chat title for support). */',
)
t = t.replace(
    '/** Emerald v2 — customer support: urgent live chat (wrong order) + async tickets (everything else). */',
    '/** Customer support: topic picker → live chat only (no tickets). */',
)
t = t.replace(
    '"Επείγοντα ανοίγουν ζωντανή συνομιλία · τα υπόλοιπα γίνονται αίτημα με γραπτή απάντηση."',
    '"Διάλεξε θέμα και άνοιξε ζωντανή συνομιλία με την υποστήριξη."',
)
t2 = re.sub(
    r'if \(tickets\.isNotEmpty\(\)\) \{[\s\S]*?onShowMyTickets[\s\S]*?\n        \}\n\n        (?=Text\("Τι πρόβλημα)',
    '',
    t,
    count=1,
)
if t2 != t:
    t = t2
    print('cta')
t = t.replace(
"""            SupportView.Topics -> TopicsView(
                tickets = state.tickets,
                onSelectTopic = onSelectTopic,
                onShowMyTickets = onShowMyTickets,
            )""",
"""            SupportView.Topics -> TopicsView(
                onSelectTopic = onSelectTopic,
            )""",
)
t = t.replace(
"""private fun ColumnScope.TopicsView(
    tickets: List<SupportTicketRow>,
    onSelectTopic: (String) -> Unit,
    onShowMyTickets: () -> Unit,
) {""",
"""private fun ColumnScope.TopicsView(
    onSelectTopic: (String) -> Unit,
) {""",
)
p.write_text(t)
print('screen done')
