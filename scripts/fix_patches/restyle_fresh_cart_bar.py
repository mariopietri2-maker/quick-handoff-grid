#!/usr/bin/env python3
import re
from pathlib import Path
p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
t = p.read_text()
new_bar = """@Composable
private fun FreshCartBar(
    count: Int,
    total: Double,
    onClick: () -> Unit,
    minOrder: Double = 0.0,
) {
    val needMore = minOrder > 0 && total < minOrder
    val progress = if (minOrder > 0) (total / minOrder).toFloat().coerceIn(0f, 1f) else 1f
    Column(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        if (needMore) {
            Surface(
                color = Color.White,
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 8.dp)
                    .shadow(6.dp, RoundedCornerShape(16.dp)),
            ) {
                Column(Modifier.padding(horizontal = 14.dp, vertical = 10.dp)) {
                    Text(
                        "\u03a0\u03c1\u03cc\u03c3\u03b8\u03b5\u03c3\u03b5 \u20ac%.2f \u03b3\u03b9\u03b1 \u03b5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03b7 \u03c0\u03b1\u03c1\u03b1\u03b3\u03b3\u03b5\u03bb\u03af\u03b1".format(minOrder - total),
                        color = FreshInk,
                        fontWeight = FontWeight.SemiBold,
                        style = MaterialTheme.typography.labelLarge,
                    )
                    Spacer(Modifier.height(8.dp))
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(FreshChip),
                    ) {
                        Box(
                            Modifier
                                .fillMaxWidth(progress)
                                .height(5.dp)
                                .clip(RoundedCornerShape(3.dp))
                                .background(FreshGreen),
                        )
                    }
                }
            }
        }
        Box(
            Modifier
                .fillMaxWidth()
                .height(54.dp)
                .shadow(10.dp, RoundedCornerShape(14.dp))
                .clip(RoundedCornerShape(14.dp))
                .background(FreshGreen)
                .clickable(onClick = onClick),
        ) {
            Row(
                Modifier
                    .fillMaxSize()
                    .padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.White),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        "$count",
                        color = FreshGreenDark,
                        fontWeight = FontWeight.Bold,
                        fontSize = 15.sp,
                    )
                }
                Text(
                    "\u039a\u03b1\u03bb\u03ac\u03b8\u03b9",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 17.sp,
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                )
                Text(
                    "%.2f\u20ac".format(total),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(end = 6.dp),
                )
            }
        }
    }
}
"""
pat = re.compile(
    r"@Composable\nprivate fun FreshCartBar\([\s\S]*?\n\}\n(?=\n@Composable\nprivate fun )",
    re.M,
)
m = pat.search(t)
if not m:
    print("FreshCartBar pattern miss")
else:
    t = t[: m.start()] + new_bar + "\n" + t[m.end() :]
    p.write_text(t)
    print("FreshCartBar restyled eFood layout")
