#!/usr/bin/env python3
from pathlib import Path

def must_replace(path, old, new, label):
    p = Path(path)
    t = p.read_text()
    if new[:40] in t and old not in t:
        print(label, 'already')
        return
    if old not in t:
        raise SystemExit(f'{label}: pattern missing')
    p.write_text(t.replace(old, new, 1))
    print(label, 'ok')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/data/DriverRepository.kt',
'''    suspend fun sendLiveChatMessage(driverId: String, senderId: String, message: String) {
        client.from("live_chat_messages").insert(
            buildJsonObject {
                put("driver_id", driverId)
                put("sender_id", senderId)
                put("sender_role", "driver")
                put("message", message)
            },
        )
    }''',
'''    suspend fun ensureDriverLiveChatSession(topic: String): String {
        return client.postgrest.rpc(
            "ensure_driver_live_chat_session",
            buildJsonObject { put("p_topic", topic) },
        ).decodeAs<String>()
    }

    suspend fun sendLiveChatMessage(
        driverId: String,
        senderId: String,
        message: String,
        topic: String? = null,
    ) {
        client.from("live_chat_messages").insert(
            buildJsonObject {
                put("driver_id", driverId)
                put("sender_id", senderId)
                put("sender_role", "driver")
                put("message", message)
                if (!topic.isNullOrBlank()) put("topic", topic)
            },
        )
    }''',
'DriverRepository')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverViewModel.kt',
'''    /** Opens live chat from the headphone flow, seeding the first message. */
    fun startLiveChat(initialMessage: String?) {
        openLiveChat()
        val msg = initialMessage?.trim()
        if (!msg.isNullOrBlank()) sendLiveChatMessage(msg)
    }''',
'''    /** Start live chat with required topic. Only SUPPORT can close (server-side). */
    fun startLiveChat(topic: String, initialMessage: String? = null) {
        val uid = _state.value.userId ?: return
        val topicTrim = topic.trim()
        if (topicTrim.isEmpty()) {
            _state.value = _state.value.copy(liveChatError = "Pick a topic")
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(liveChatLoading = true, liveChatError = null, liveChatOpen = true)
            runCatching {
                repo.ensureDriverLiveChatSession(topicTrim)
                val body = initialMessage?.trim().orEmpty().ifBlank { "Topic: $topicTrim" }
                repo.sendLiveChatMessage(uid, uid, body, topic = topicTrim)
                repo.fetchLiveChat(uid)
            }.onSuccess { msgs ->
                _state.value = _state.value.copy(liveChatMessages = msgs, liveChatLoading = false, supportOpen = true)
                startLiveChatSubscription(uid)
            }.onFailure { e ->
                _state.value = _state.value.copy(liveChatLoading = false, liveChatError = handleError("startLiveChat", e))
            }
        }
    }''',
'ViewModel.startLiveChat')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverViewModel.kt',
'''    fun openSupport() {
        _state.value = _state.value.copy(supportOpen = true)
        openLiveChat()
    }''',
'''    fun openSupport() {
        _state.value = _state.value.copy(supportOpen = true)
    }''',
'ViewModel.openSupport')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverShell.kt',
'onSendLiveChat: (String) -> Unit = {},',
'onStartLiveChat: (String, String) -> Unit = { _, _ -> },\n    onSendLiveChat: (String) -> Unit = {},',
'DriverShell.param')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/DriverShell.kt',
'''            SupportCenter(
                state = state,
                onBack = onCloseSupport,
                onSendLiveChat = onSendLiveChat,
''',
'''            SupportCenter(
                state = state,
                onBack = onCloseSupport,
                onStartLiveChat = onStartLiveChat,
                onSendLiveChat = onSendLiveChat,
''',
'DriverShell.call')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/support/SupportCenter.kt',
'''fun SupportCenter(
    state: DriverUiState,
    onBack: () -> Unit,
    onSendLiveChat: (String) -> Unit,
''',
'''fun SupportCenter(
    state: DriverUiState,
    onBack: () -> Unit,
    onStartLiveChat: (topic: String, message: String) -> Unit,
    onSendLiveChat: (String) -> Unit,
''',
'SupportCenter.sig')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/support/SupportCenter.kt',
'onLiveChat = { screen = "live" },',
'onLiveChat = { screen = "live-setup" },',
'SupportCenter.route')

must_replace(
'native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/support/SupportCenter.kt',
'''                    "live" -> LiveChatPanel(
                        state = state,
                        onSend = onSendLiveChat,
                    )
''',
'''                    "live-setup" -> LiveChatTopicSetup(
                        busy = state.liveChatLoading,
                        error = state.liveChatError,
                        onBack = { screen = "menu" },
                        onStart = { topic, msg ->
                            onStartLiveChat(topic, msg)
                            screen = "live"
                        },
                    )
                    "live" -> LiveChatPanel(
                        state = state,
                        onSend = onSendLiveChat,
                    )
''',
'SupportCenter.branch')

sc = Path('native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/support/SupportCenter.kt')
t = sc.read_text()
if 'private fun LiveChatTopicSetup' not in t:
    setup = '''
private data class DriverHelpTopic(val id: String, val label: String)

private val DRIVER_HELP_TOPICS = listOf(
    DriverHelpTopic("order_issue", "Order issue"),
    DriverHelpTopic("payment", "Payment / cash"),
    DriverHelpTopic("app_bug", "App problem"),
    DriverHelpTopic("store_call", "Store call (N/K)"),
    DriverHelpTopic("account", "Account / documents"),
    DriverHelpTopic("other", "Other"),
)

@Composable
private fun LiveChatTopicSetup(
    busy: Boolean,
    error: String?,
    onBack: () -> Unit,
    onStart: (topic: String, message: String) -> Unit,
) {
    val cs = MaterialTheme.colorScheme
    var selected by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf("") }
    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(bottom = 24.dp)) {
        Text("Before live chat", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text("Pick a topic and write a short message so support can help faster.", style = MaterialTheme.typography.bodyMedium, color = cs.onSurfaceVariant)
        Spacer(Modifier.height(16.dp))
        Text("Topic", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(8.dp))
        DRIVER_HELP_TOPICS.forEach { topic ->
            val active = selected == topic.id
            Row(
                Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(14.dp))
                    .background(if (active) FreshGreen.copy(alpha = 0.15f) else cs.surface)
                    .border(1.dp, if (active) FreshGreen else cs.outline.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                    .clickable { selected = topic.id }.padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) { Text(topic.label, modifier = Modifier.weight(1f), fontWeight = if (active) FontWeight.Bold else FontWeight.Medium) }
        }
        Spacer(Modifier.height(16.dp))
        Text("Message", fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.height(6.dp))
        OutlinedTextField(value = message, onValueChange = { message = it }, modifier = Modifier.fillMaxWidth(), minLines = 3, maxLines = 5, placeholder = { Text("Describe the issue...") })
        if (!error.isNullOrBlank()) { Spacer(Modifier.height(8.dp)); Text(error, color = FreshError, style = MaterialTheme.typography.bodySmall) }
        Spacer(Modifier.height(16.dp))
        Button(onClick = { val topic = selected ?: return@Button; onStart(topic, message.trim()) }, enabled = selected != null && !busy, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) {
            if (busy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp, color = cs.onPrimary) else Text("Start live chat", fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.height(8.dp))
        Text("Only support can close the conversation.", style = MaterialTheme.typography.labelSmall, color = cs.onSurfaceVariant)
    }
}

'''
    marker = '@Composable\nprivate fun LiveChatPanel'
    if marker not in t:
        raise SystemExit('LiveChatPanel marker missing')
    sc.write_text(t.replace(marker, setup + marker, 1))
    print('SupportCenter.ui ok')
else:
    print('SupportCenter.ui already')

print('ALL DONE')
