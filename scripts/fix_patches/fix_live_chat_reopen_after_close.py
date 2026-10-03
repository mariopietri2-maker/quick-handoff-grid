#!/usr/bin/env python3
"""After support closes live chat, customer must start a fresh open session."""
from pathlib import Path

vm = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt")
t = vm.read_text()

old_clear = '''    /** Back to the topic picker (closes the active chat/ticket, keeps the support screen open). */
    fun clearSupportTopic() {
        closeLiveChat()
        cancelTicketSubscriptions()
        _state.value = _state.value.copy(
            supportView = SupportView.Topics,
            liveChatTopic = null,
            liveChatSessionId = null,
            liveChatClosed = false,
            ticketTopic = null,
            activeTicket = null,
            ticketMessages = emptyList(),
            ticketError = null,
        )
    }
'''

new_clear = '''    /** Back to the topic picker (closes the active chat/ticket, keeps the support screen open). */
    fun clearSupportTopic() {
        startNewLiveConversation()
    }

    /**
     * Support closed the session — fully reset local state so the customer can
     * pick a topic and open a brand-new open session (ensure_my_live_chat_session).
     */
    fun startNewLiveConversation() {
        liveChatJob?.cancel()
        liveChatJob = null
        liveChatSessionJob?.cancel()
        liveChatSessionJob = null
        cancelTicketSubscriptions()
        _state.value = _state.value.copy(
            supportView = SupportView.Topics,
            liveChatTopic = null,
            liveChatSessionId = null,
            liveChatClosed = false,
            liveChatMessages = emptyList(),
            liveChatLoading = false,
            liveChatSubscribed = false,
            liveChatError = null,
            ticketTopic = null,
            activeTicket = null,
            ticketMessages = emptyList(),
            ticketError = null,
        )
    }
'''

if old_clear in t:
    t = t.replace(old_clear, new_clear)
    print("clearSupportTopic -> startNewLiveConversation")
elif "fun startNewLiveConversation" in t:
    print("already has startNewLiveConversation")
else:
    print("clearSupportTopic pattern miss")

old_select = '''    private fun selectLiveChatTopic(topic: String) {
        viewModelScope.launch {
            // ensure_my_live_chat_session creates a NEW open row when the last one is closed
            val sessionId = repo.ensureMyLiveChatSession(topic)
            if (sessionId.isNullOrBlank()) {
                _state.value = _state.value.copy(
                    liveChatError = "\u0394\u03b5\u03bd \u03ac\u03bd\u03bf\u03b9\u03be\u03b5 \u03bd\u03ad\u03b1 \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1. \u0394\u03bf\u03ba\u03af\u03bc\u03b1\u03c3\u03b5 \u03be\u03b1\u03bd\u03ac.",
                    supportView = SupportView.Topics,
                )
                return@launch
            }
            _state.value = _state.value.copy(
                supportView = SupportView.Live,
                liveChatTopic = topic,
                liveChatSessionId = sessionId,
                liveChatClosed = false,
                liveChatError = null,
            )
            openLiveChat()
        }
    }
'''

new_select = '''    private fun selectLiveChatTopic(topic: String) {
        viewModelScope.launch {
            // Cancel any closed-session subscription before opening a new one
            liveChatJob?.cancel()
            liveChatJob = null
            liveChatSessionJob?.cancel()
            liveChatSessionJob = null

            // ensure_my_live_chat_session creates a NEW open row when the last one is closed
            val sessionId = repo.ensureMyLiveChatSession(topic)
            if (sessionId.isNullOrBlank()) {
                _state.value = _state.value.copy(
                    liveChatError = "\u0394\u03b5\u03bd \u03ac\u03bd\u03bf\u03b9\u03be\u03b5 \u03bd\u03ad\u03b1 \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1. \u0394\u03bf\u03ba\u03af\u03bc\u03b1\u03c3\u03b5 \u03be\u03b1\u03bd\u03ac.",
                    supportView = SupportView.Topics,
                    liveChatClosed = false,
                )
                return@launch
            }
            // Confirm server prefers an open session
            val session = runCatching { repo.getMyLiveChatSession() }.getOrNull()
            val closed = session?.status == "closed"
            if (closed) {
                _state.value = _state.value.copy(
                    liveChatError = "\u0397 \u03c0\u03c1\u03bf\u03b7\u03b3\u03bf\u03cd\u03bc\u03b5\u03bd\u03b7 \u03c3\u03c5\u03bd\u03bf\u03bc\u03b9\u03bb\u03af\u03b1 \u03b5\u03af\u03bd\u03b1\u03b9 \u03ba\u03bb\u03b5\u03b9\u03c3\u03c4\u03ae. \u0394\u03bf\u03ba\u03af\u03bc\u03b1\u03c3\u03b5 \u03be\u03b1\u03bd\u03ac.",
                    supportView = SupportView.Topics,
                    liveChatClosed = true,
                )
                return@launch
            }
            _state.value = _state.value.copy(
                supportView = SupportView.Live,
                liveChatTopic = topic,
                liveChatSessionId = sessionId,
                liveChatClosed = false,
                liveChatError = null,
                liveChatMessages = emptyList(),
            )
            openLiveChat()
        }
    }
'''

if old_select in t:
    t = t.replace(old_select, new_select)
    print("selectLiveChatTopic updated")
elif "Confirm server prefers an open session" in t:
    print("selectLiveChatTopic already")
else:
    print("selectLiveChatTopic pattern miss")

# Session realtime: only mark closed when status is closed; do not overwrite an intentional reopen
old_sess = '''                flow.collect { _ ->
                    val session = runCatching { repo.getMyLiveChatSession() }.getOrNull()
                    if (session != null) {
                        _state.value = _state.value.copy(
                            liveChatSessionId = session.id,
                            liveChatClosed = session.status == "closed",
                            liveChatTopic = session.topic?.takeIf { it.isNotBlank() } ?: _state.value.liveChatTopic,
                        )
                    }
                }
'''
new_sess = '''                flow.collect { _ ->
                    val session = runCatching { repo.getMyLiveChatSession() }.getOrNull()
                    if (session != null) {
                        // Prefer open; if server still reports closed while user is on Topics, ignore
                        val isClosed = session.status == "closed"
                        if (isClosed && _state.value.supportView == SupportView.Topics) {
                            return@collect
                        }
                        _state.value = _state.value.copy(
                            liveChatSessionId = session.id,
                            liveChatClosed = isClosed,
                            liveChatTopic = session.topic?.takeIf { it.isNotBlank() } ?: _state.value.liveChatTopic,
                        )
                    }
                }
'''
if old_sess in t:
    t = t.replace(old_sess, new_sess)
    print("session subscription updated")
elif "Prefer open; if server still reports closed" in t:
    print("session sub already")
else:
    print("session sub pattern miss")

vm.write_text(t)
print("done")
