## Driver Happiness Features Plan

### 1. Database Changes (Single Migration)
- **`driver_wallets`** table: balance, pending, withdrawn amounts per driver
- **`wallet_transactions`** table: withdrawal requests, earning credits
- **`wait_time_bonuses`** table: track arrival time at store, bonus calculated
- **`support_tickets`** table: emergency/help requests with photo URLs
- **`demand_zones`** table: grid zones with order count, driver count, bonus multiplier
- **`driver_referrals`** table: referrer, referred driver, bonus earned, status

### 2. Live Wallet Dashboard (`DriverWallet.tsx`)
- Show today's earnings, tips, ready-to-withdraw balance
- "Cash Out" button (creates withdrawal request)
- Transaction history list
- Real-time updates via Supabase realtime on `wallet_transactions`

### 3. Transparency on Order Offers
- Update `OrderOfferCard.tsx` to show:
  - Mini-map with full route (store → customer)
  - Total estimated distance & time
  - Guaranteed payout breakdown (base + per-km rate)

### 4. Wait-Time Bonus Timer
- Update `ActiveDelivery.tsx`:
  - Timer starts when driver marks "arrived at store"
  - After 10 min, show accumulating delay bonus (€0.10/min)
  - Bonus auto-added to earnings on delivery completion

### 5. Priority Support Button
- Floating "Help" button on driver app (all screens)
- Opens modal with:
  - One-tap "Emergency" call/chat
  - Photo upload for issue reporting
  - Quick-select issue categories

### 6. Power Hour Heatmap
- Overlay on driver map showing demand density
- Color-coded zones (green → red based on demand/supply ratio)
- Bonus indicator per zone

### 7. Driver Referral System
- Referral code generation
- Track referrals and bonus payouts
- Simple UI in driver profile

### Implementation Order
1. Migration (all tables at once)
2. Wallet + Earnings dashboard
3. Order offer transparency
4. Wait-time bonus
5. Support button
6. Heatmap
7. Referral system
