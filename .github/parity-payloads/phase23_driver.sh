#!/bin/bash
set -euo pipefail
HS=native-driver/app/src/main/java/com/freshdelivery/nativedriver/ui/home/HomeScreen.kt
if [ -f "$HS" ] && ! grep -q 'fun TurnByTurnBanner' "$HS"; then
  printf '\n' >> "$HS"
  printf '@Composable\n' >> "$HS"
  printf 'private fun TurnByTurnBanner(instruction: String, distanceMeters: Int?, modifier: Modifier = Modifier) {\n' >> "$HS"
  printf '    if (instruction.isBlank()) return\n' >> "$HS"
  printf '    Surface(\n' >> "$HS"
  printf '        modifier = modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),\n' >> "$HS"
  printf '        shape = RoundedCornerShape(12.dp),\n' >> "$HS"
  printf '        color = Color(0xFF111111),\n' >> "$HS"
  printf '        shadowElevation = 6.dp,\n' >> "$HS"
  printf '    ) {\n' >> "$HS"
  printf '        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {\n' >> "$HS"
  printf '            Text("↗", fontSize = 22.sp)\n' >> "$HS"
  printf '            Spacer(Modifier.width(12.dp))\n' >> "$HS"
  printf '            Column(Modifier = Modifier.weight(1f)) {\n' >> "$HS"
  printf '                Text(instruction, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)\n' >> "$HS"
  printf '                if (distanceMeters != null && distanceMeters > 0) {\n' >> "$HS"
  printf '                    val dist = if (distanceMeters >= 1000) String.format("%%.1f km", distanceMeters / 1000.0) else "$distanceMeters m"\n' >> "$HS"
  printf '                    Text(dist, color = Color(0xFF06C167), style = MaterialTheme.typography.labelMedium)\n' >> "$HS"
  printf '                }\n' >> "$HS"
  printf '            }\n' >> "$HS"
  printf '        }\n' >> "$HS"
  printf '    }\n' >> "$HS"
  printf '}\n' >> "$HS"
  echo Driver TurnByTurnBanner appended
else
  echo Driver banners ok
fi
for f in native-customer/app/build.gradle.kts native-customer/app/build.gradle; do
  [ -f "$f" ] && sed -i 's/versionName *= *"[^"]*"/versionName = "2.5.0-native"/' "$f" && sed -i 's/versionCode *= *[0-9]*/versionCode = 250/' "$f" && echo bumped $f || true
done
for f in native-driver/app/build.gradle.kts native-driver/app/build.gradle; do
  [ -f "$f" ] && sed -i 's/versionName *= *"[^"]*"/versionName = "2.3.0-native"/' "$f" && sed -i 's/versionCode *= *[0-9]*/versionCode = 230/' "$f" && echo bumped $f || true
done
