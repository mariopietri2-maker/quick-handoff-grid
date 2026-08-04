PLACEHOLDER
@Composable
private fun TurnByTurnBanner(instruction: String, distanceMeters: Int?, modifier: Modifier = Modifier) {
    if (instruction.isBlank()) return
    Surface(
        modifier = modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
        shape = RoundedCornerShape(12.dp),
        color = Color(0xFF111111),
        shadowElevation = 6.dp,
    ) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("↗", fontSize = 22.sp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier = Modifier.weight(1f)) {
                Text(instruction, color = Color.White, fontWeight = FontWeight.Bold, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (distanceMeters != null && distanceMeters > 0) {
                    val dist = if (distanceMeters >= 1000) String.format("%.1f km", distanceMeters / 1000.0) else "$distanceMeters m"
                    Text(dist, color = Color(0xFF06C167), style = MaterialTheme.typography.labelMedium)
                }
            }
        }
    }
}
