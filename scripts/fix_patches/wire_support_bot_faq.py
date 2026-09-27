#!/usr/bin/env python3
from pathlib import Path
import re
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/SupportScreen.kt")
t = p.read_text()
if "fun BotFaqSection" in t:
    print("already")
    raise SystemExit(0)
faq = '''
@Composable
private fun BotFaqSection() {
    val items = listOf(
        "\u03a0\u03bf\u03cd \u03b5\u03af\u03bd\u03b1\u03b9 \u03b7 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1 \u03bc\u03bf\u03c5;" to "\u0386\u03bd\u03bf\u03b9\u03be\u03b5 \u03a0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b5\u03c2 \u2192 \u03c0\u03ac\u03c4\u03b1 \u03c4\u03b7\u03bd \u03b5\u03bd\u03b5\u03c1\u03b3\u03ae \u2192 \u03a0\u03b1\u03c1\u03b1\u03ba\u03bf\u03bb\u03bf\u03cd\u03b8\u03b7\u03c3\u03b7.",
        "\u03a0\u03bf\u03b9\u03bf\u03c2 \u03c0\u03b1\u03c1\u03b1\u03b4\u03af\u03b4\u03b5\u03b9;" to "\u00ab\u03a0\u03b1\u03c1\u03ac\u03b4\u03bf\u03c3\u03b7 Fresh2GO\u00bb = \u03bf\u03b4\u03b7\u03b3\u03cc\u03c2 \u03c0\u03bb\u03b1\u03c4\u03c6\u03cc\u03c1\u03bc\u03b1\u03c2.",
        "\u03a0\u03ce\u03c2 \u03b1\u03bb\u03bb\u03ac\u03b6\u03c9 \u03b4\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7;" to "\u0391\u03c1\u03c7\u03b9\u03ba\u03ae \u2192 \u03c0\u03ac\u03c4\u03b1 \u03c4\u03b7 \u03b4\u03b9\u03b5\u03cd\u03b8\u03c5\u03bd\u03c3\u03b7.",
        "\u03a4\u03c1\u03cc\u03c0\u03bf\u03b9 \u03c0\u03bb\u03b7\u03c1\u03c9\u03bc\u03ae\u03c2;" to "\u039c\u03b5\u03c4\u03c1\u03b7\u03c4\u03ac \u03ba\u03b1\u03b9/\u03ae \u03ba\u03ac\u03c1\u03c4\u03b1.",
        "\u039c\u03c0\u03bf\u03c1\u03ce \u03bd\u03b1 \u03b1\u03ba\u03c5\u03c1\u03ce\u03c3\u03c9;" to "\u03a0\u03c1\u03b9\u03bd \u03b1\u03c0\u03bf\u03b4\u03bf\u03c7\u03ae \u00b7 \u03bc\u03b5\u03c4\u03ac live chat.",
    )
    var openIdx by remember { mutableStateOf(-1) }
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("\u03a3\u03c5\u03c7\u03bd\u03ad\u03c2 \u03b5\u03c1\u03c9\u03c4\u03ae\u03c3\u03b5\u03b9\u03c2", fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall)
        Text("Bot", style = MaterialTheme.typography.labelSmall, color = FreshMuted)
        items.forEachIndexed { i, pair ->
            val q = pair.first
            val a = pair.second
            Surface(
                onClick = { openIdx = if (openIdx == i) -1 else i },
                color = FreshSurface,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(q, fontWeight = FontWeight.SemiBold, style = MaterialTheme.typography.bodySmall)
                    if (openIdx == i) {
                        Spacer(Modifier.height(6.dp))
                        Text(a, style = MaterialTheme.typography.bodySmall, color = FreshMuted)
                    }
                }
            }
        }
    }
}

'''
marker = "private fun ColumnScope.TopicsView("
if marker not in t:
    raise SystemExit("MISS TopicsView")
t = t.replace(marker, faq + marker, 1)
t2, n = re.subn(
    r'(color = FreshMuted,\n        \)\n        Spacer\(Modifier\.height\(6\.dp\)\)\n        SUPPORT_TOPICS\.forEach)',
    r'color = FreshMuted,\n        )\n        Spacer(Modifier.height(10.dp))\n        BotFaqSection()\n        Spacer(Modifier.height(10.dp))\n        SUPPORT_TOPICS.forEach',
    t,
    count=1,
)
if n == 0:
    print("call miss")
else:
    t = t2
    print("call ok")
p.write_text(t)
print("done")
