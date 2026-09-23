#!/usr/bin/env python3
"""Fix: after support closes a live chat, customer can start a new one."""
from pathlib import Path

def main() -> None:
    p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerViewModel.kt')
    t = p.read_text()
    old = '''    fun openSupport() {
        if (_state.value.supportOpen) return
        _state.value = _state.value.copy(supportOpen = true, supportView = SupportView.Topics)
        viewModelScope.launch {
            val uid = _state.value.userId ?: return@launch
            runCatching { repo.fetchMyTickets(uid) }
                .onSuccess { list -> _state.value = _state.value.copy(tickets = list) }
            val session = repo.getMyLiveChatSession()
            if (session != null && session.id != null) {
                val closed = session.status == "closed"
                _state.value = _state.value.copy(
                    supportView = SupportView.Live,
                    liveChatSessionId = session.id,
                    liveChatClosed = closed,
                    liveChatTopic = session.topic?.takeIf { it.isNotBlank() } ?: "Γενικό",
                    liveChatLoading = true,
                )
                fetchLiveChatHistory()
                if (!closed) startLiveChatSubscription(uid)
            }
        }
    }'''
    new = '''    fun openSupport() {
        if (_state.value.supportOpen) return
        // Always land on Topics so a previously closed chat does not block a new request.
        _state.value = _state.value.copy(
            supportOpen = true,
            supportView = SupportView.Topics,
            liveChatClosed = false,
            liveChatSessionId = null,
            liveChatTopic = null,
            liveChatError = null,
        )
        viewModelScope.launch {
            val uid = _state.value.userId ?: return@launch
            runCatching { repo.fetchMyTickets(uid) }
                .onSuccess { list -> _state.value = _state.value.copy(tickets = list) }
            // Resume only an OPEN session; closed ones stay history — user picks a new topic.
            val session = repo.getMyLiveChatSession()
            if (session != null && session.id != null && session.status != "closed") {
                _state.value = _state.value.copy(
                    supportView = SupportView.Live,
                    liveChatSessionId = session.id,
                    liveChatClosed = false,
                    liveChatTopic = session.topic?.takeIf { it.isNotBlank() } ?: "Γενικό",
                    liveChatLoading = true,
                )
                fetchLiveChatHistory()
                startLiveChatSubscription(uid)
            }
        }
    }'''
    if old in t:
        t = t.replace(old, new, 1)
        print('openSupport fixed')
    else:
        print('openSupport already fixed or pattern miss')

    old2 = '''    private fun selectLiveChatTopic(topic: String) {
        viewModelScope.launch {
            val sessionId = repo.ensureMyLiveChatSession(topic)
            _state.value = _state.value.copy(
                supportView = SupportView.Live,
                liveChatTopic = topic,
                liveChatSessionId = sessionId ?: _state.value.liveChatSessionId,
                liveChatClosed = false,
                liveChatError = null,
            )
            openLiveChat()
        }
    }'''
    new2 = '''    private fun selectLiveChatTopic(topic: String) {
        viewModelScope.launch {
            // ensure_my_live_chat_session creates a NEW open row when the last one is closed
            val sessionId = repo.ensureMyLiveChatSession(topic)
            if (sessionId.isNullOrBlank()) {
                _state.value = _state.value.copy(
                    liveChatError = "Δεν άνοιξε νέα συνομιλία. Δοκίμασε ξανά.",
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
    }'''
    if old2 in t:
        t = t.replace(old2, new2, 1)
        print('selectLiveChatTopic fixed')
    else:
        print('selectLiveChatTopic already fixed or pattern miss')
    p.write_text(t)

    p = Path('native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SupportScreen.kt')
    t = p.read_text()
    if 'import androidx.compose.material3.Button' not in t:
        t = t.replace(
            'import androidx.compose.material3.Icon',
            'import androidx.compose.material3.Button\nimport androidx.compose.material3.ButtonDefaults\nimport androidx.compose.material3.Icon',
        )
    old = '''    if (state.liveChatClosed) {
        Surface(
            color = FreshRoseSoft,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier\n                .fillMaxWidth()\n                .padding(top = 8.dp),
        ) {
            Row(
                Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(Icons.Outlined.Warning, contentDescription = null, tint = FreshRose, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "Η συνομιλία έκλεισε από την υποστήριξη. Ξεκίνα νέο αίτημα για να συνεχίσεις.",
                    style = MaterialTheme.typography.bodySmall,
                    color = FreshRose,
                )
            }
        }
    }'''
    new = '''    if (state.liveChatClosed) {
        Surface(
            color = FreshRoseSoft,
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier\n                .fillMaxWidth()\n                .padding(top = 8.dp),
        ) {
            Column(Modifier.padding(horizontal = 12.dp, vertical = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Warning, contentDescription = null, tint = FreshRose, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(
                        "Η συνομιλία έκλεισε από την υποστήριξη.",
                        style = MaterialTheme.typography.bodySmall,
                        color = FreshRose,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = onClearTopic,
                    colors = ButtonDefaults.buttonColors(containerColor = FreshGreen),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Ξεκίνα νέα συνομιλία", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }'''
    if old in t:
        t = t.replace(old, new, 1)
        print('closed CTA fixed')
    else:
        print('closed CTA already fixed or pattern miss')
    p.write_text(t)

if __name__ == '__main__':
    main()
