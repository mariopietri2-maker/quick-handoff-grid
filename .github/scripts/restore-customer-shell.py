  from pathlib import Path
  p = Path("native-customer/app/src/main/java/com/freshdelivery/nativecustomer/ui/CustomerShell.kt")
  c = p.read_text()
  c = c.replace('"Fresh"', '"Fresh Delivery"', 1)
  old = '''                Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Outlined.LocationOn,
                contentDescription = null,
                tint = UberInk,
                modifier = Modifier.size(18.dp),
            )
            Spacer(Modifier.width(4.dp))
            Text(
                text = state.deliveryAddress.ifBlank { "Επίλεξε διεύθυνση παράδοσης" },
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }'''
  new = '''                Text(
            "Fresh Delivery",
            style = MaterialTheme.typography.labelMedium,
            color = UberGreen,
            fontWeight = FontWeight.Bold,
        )
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Outlined.LocationOn,
                contentDescription = null,
                tint = UberInk,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(6.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    "Παράδοση τώρα",
                    style = MaterialTheme.typography.labelMedium,
                    color = UberMuted,
                )
                Text(
                    text = state.deliveryAddress.ifBlank { "Επίλεξε διεύθυνση" },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }'''
  if old in c:
      c = c.replace(old, new, 1)
      print("address polish ok")
  old2 = '''        store.address?.let {
    Text(
        it,
        style = MaterialTheme.typography.bodySmall,
        color = UberMuted,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}
Spacer(Modifier.height(6.dp))
Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
    MetaPill(if (store.is_active == false) "Κλειστό" else "Ανοιχτό")
    MetaPill("Παράδοση")
}'''
  new2 = '''        Text(
    buildString {
        append(if (store.is_active == false) "Κλειστό" else "★ 4.8")
        append("  ·  25–40 λεπτά  ·  Παράδοση")
    },
    style = MaterialTheme.typography.bodyMedium,
    color = UberMuted,
    maxLines = 1,
    overflow = TextOverflow.Ellipsis,
)
store.address?.let {
    Text(
        it,
        style = MaterialTheme.typography.bodySmall,
        color = UberMuted,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
    )
}'''
  if old2 in c:
      c = c.replace(old2, new2, 1)
      print("card polish ok")
  c = c.replace(
      ".height(height.dp)\n            .background(UberSurface),",
      ".height(height.dp)\n            .clip(RoundedCornerShape(16.dp))\n            .background(UberSurface),",
      1,
  )
  c = c.replace("StoreHeroImage(store.image_url, height = 168)", "StoreHeroImage(store.image_url, height = 184)", 1)
  p.write_text(c)
  print("bytes", len(c))
