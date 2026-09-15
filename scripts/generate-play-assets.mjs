import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'store-assets');

const C = {
  ink: '#1C1917', ink2: '#292524', line: '#EFE9E3', bg: '#FAFAF9',
  orange: '#FF8A3D', deep: '#EA580C', bright: '#F97316', light: '#F4A125',
  peach: '#FFEDD5', cream: '#FFF7ED', muted: '#A8A29E', white: '#FFFFFF',
  good: '#16A34A',
};

const BG = `radial-gradient(1200px 700px at 88% -10%, rgba(255,138,61,.42), transparent 60%), radial-gradient(1000px 700px at -5% 115%, rgba(244,161,37,.20), transparent 55%), linear-gradient(165deg, #16130f 0%, #241505 48%, #100c08 100%)`;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

/* ---------- inline SVG logo ---------- */
const BAG = (size, color = '#fff', line = '#FF8A3D') => `<svg width="${size}" height="${size}" viewBox="0 0 64 64"><path d="M26 28 Q32 20 38 28" stroke="${color}" stroke-width="3.4" fill="none" stroke-linecap="round"/><rect x="19.5" y="27" width="25" height="22" rx="6.5" fill="${color}"/><path d="M23 35 H41" stroke="${line}" stroke-width="2.4" stroke-linecap="round"/></svg>`;

/* ---------- phone shell ---------- */
function phone(inner, { nav = false, wide = false } = {}) {
  const w = wide ? 500 : 470;
  const h = wide ? 1012 : 950;
  const navHTML = nav ? `<div class="pnav"><div class="nv on">◉</div><div class="nv">▤</div><div class="nv">▦</div><div class="nv">◎</div></div>` : '';
  return `
  <div class="ph" style="width:${w}px;height:${h}px">
    <div class="sb"><span>9:41</span><span class="island"></span><span>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="none"><rect x="0.5" y="0.5" width="11" height="11" rx="3" stroke="currentColor"/><rect x="13" y="3.5" width="3" height="5" rx="1.5" fill="currentColor"/><path d="M2.5 5.5H3.5M5 3.5V7.5" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 4.5h2M6.5 7h1.6" stroke="currentColor" stroke-width="1.1" opacity=".7"/></svg>
    </span></div>
    <div class="pscreen">${inner}</div>
    ${navHTML}
  </div>`;
}

const PHONE_CSS = `
.ph{border-radius:52px;background:#0c0a09;box-shadow:0 34px 80px rgba(0,0,0,.65),0 0 0 1px #3f3a35,0 0 0 10px #141210;overflow:hidden;display:flex;flex-direction:column;flex:none;position:relative}
.sb{height:44px;flex:none;display:flex;align-items:center;justify-content:space-between;padding:0 26px;color:#e7e5e4;font-size:15px;font-weight:600;background:#0c0a09}
.island{width:96px;height:28px;border-radius:20px;background:#050505;position:absolute;left:50%;top:8px;transform:translateX(-50%)}
.pscreen{flex:1;background:#FAFAF9;overflow:hidden;position:relative;display:flex;flex-direction:column}
.pnav{flex:none;height:74px;background:#fff;border-top:1px solid #EFE9E3;display:flex;padding-top:8px}
.pnav .nv{flex:1;text-align:center;font-size:18px;color:#A8A29E}
.pnav .nv.on{color:#EA580C}
.sp{flex:1;overflow:hidden;position:relative}
.bar{flex:none}
.realmini{display:flex;align-items:center;gap:9px;padding:6px 14px;flex:none}
.rm-i{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C);display:flex;align-items:center;justify-content:center;font-size:17px;flex:none}
.rm-b{flex:1;min-width:0}
.rm-b b{display:block;font-size:15px;color:#1C1917;letter-spacing:-.2px}
.rm-b span{font-size:11px;color:#888079}
.sea{margin:10px 16px;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #EFE9E3;border-radius:14px;padding:10px 13px;color:#888079;font-size:13px;flex:none}
.sht{display:flex;gap:7px;padding:0 16px 12px;flex:none}
.kee{display:flex;gap:7px;padding:0 16px 12px;flex:none}
.stx{color:#FFB03A}
.card{background:#fff;border:1px solid #EFE9E3;border-radius:18px;margin:0 14px 12px;overflow:hidden;box-shadow:0 6px 18px rgba(28,25,23,.05);flex:none}
.scard{background:#fff;border:1px solid #EFE9E3;border-radius:18px;padding:12px;margin:0 14px 12px;display:flex;gap:12px;align-items:center;flex:none}
.sth{width:54px;height:54px;border-radius:13px;background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C);display:flex;align-items:center;justify-content:center;font-size:26px;flex:none}
.sti{flex:1;min-width:0}
.sti b{display:block;font-size:14.5px;color:#1C1917}
.sti i{display:block;font-style:normal;font-size:11.5px;color:#888079;margin-top:2px}
.sti em{display:block;font-style:normal;font-size:11.5px;font-weight:700;margin-top:4px;color:#1C1917}
.mi{display:flex;align-items:center;gap:12px;padding:11px 14px;border-top:1px solid #F5F0EA;flex:none}
.mi:first-of-type{border-top:none}
.mi .mt{flex:1;min-width:0}
.mi .mt b{display:block;font-size:13.5px;color:#1C1917}
.mi .mt span{font-size:11px;color:#888079;display:block;margin-top:2px}
.pr{font-weight:800;font-size:13px;color:#1C1917;flex:none}
.adb{width:30px;height:30px;border-radius:10px;background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C);color:#fff;font-weight:800;font-size:17px;display:flex;align-items:center;justify-content:center;flex:none}
.tag{background:#FFEDD5;color:#EA580C;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:7px;margin-left:6px}
.grad{background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C)}
.s1{height:6px;border-radius:6px;background:#F3EDE6}
.s2{height:6px;border-radius:6px;background:#FFC9A3}
`;

/* ---------- map illustration ---------- */
function stylizedMap(labelA, labelB) {
  return `
  <div class="map">
    <div class="mroad r1"></div><div class="mroad r2"></div><div class="mroad r3"></div><div class="mroad r4"></div>
    <div class="mblk b1"></div><div class="mblk b2"></div><div class="mblk b3"></div>
    <div class="mpark"></div>
    <svg class="mroute" viewBox="0 0 700 980" preserveAspectRatio="none">
      <path d="M150 130 Q 320 260 200 380 T 330 560 T 480 700 T 600 900" fill="none" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="26" stroke-linecap="round" stroke-dasharray="2 30"/>
      <path d="M150 130 Q 320 260 200 380 T 330 560 T 480 700 T 600 900" fill="none" stroke="#EA580C" stroke-width="10" stroke-linecap="round"/>
    </svg>
    <div class="mmark a">${BAG(26, '#fff', '#FF8A3D')}</div>
    <div class="mmark b">🏠</div>
    <div class="mrider">🛵</div>
    <div class="mcrd">
      <b>${esc(labelA)}</b>
      <span>2,1 χλμ · 15:32</span>
      <div class="mbar"><i style="width:64%"></i></div>
    </div>
  </div>`;
}

const MAP_CSS = `
.map{position:absolute;inset:0;background:#EDEAE4;overflow:hidden}
.map .mblk{position:absolute;background:#D8D2C9;border-radius:10px}
.map .b1{width:120px;height:110px;left:60px;top:60px}
.map .b2{width:150px;height:120px;right:50px;top:330px}
.map .b3{width:130px;height:160px;left:70px;bottom:120px}
.map .mpark{position:absolute;right:40px;bottom:70px;width:170px;height:130px;background:#CFE3C2;border-radius:50%}
.map .mroad{position:absolute;background:#F7F4F0;box-shadow:0 0 0 1px #DDD7CE;border-radius:8px}
.map .r1{width:64px;height:140%;left:46%;top:-10%;transform:rotate(24deg)}
.map .r2{width:56px;height:150%;left:20%;top:-10%;transform:rotate(-38deg)}
.map .r3{width:52px;height:120%;right:-12%;top:20%;transform:rotate(58deg)}
.map .r4{width:48px;height:110%;left:18%;bottom:-5%;transform:rotate(108deg)}
.map .mroute{position:absolute;inset:0}
.map .mmark{position:absolute;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px rgba(0,0,0,.25)}
.map .mmark.a{background:linear-gradient(135deg,#F4A125,#EA580C);left:130px;top:118px;font-size:20px}
.map .mmark.b{background:#fff;right:74px;bottom:156px;font-size:20px;}
.map .mrider{position:absolute;left:256px;top:426px;font-size:34px;filter:drop-shadow(0 4px 8px rgba(0,0,0,.3));z-index:3}
.map .mcrd{position:absolute;left:16px;bottom:16px;right:16px;background:#fff;border-radius:18px;padding:14px 16px;box-shadow:0 14px 34px rgba(0,0,0,.22)}
.map .mcrd b{display:block;font-size:14px;color:#1C1917}
.map .mcrd span{font-size:11.5px;color:#888079}
.map .mbar{height:6px;border-radius:6px;background:#F3EDE6;margin-top:8px;overflow:hidden}
.map .mbar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#F4A125,#EA580C)}
`;

/* ---------- caption / tile page ---------- */
function tilePage({ eyebrow, title, sub, chips, body, phoneOpts }) {
  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px}
body{font-family:'Segoe UI',system-ui,sans-serif;background:${BG};color:#FFF7ED;display:flex;flex-direction:column;align-items:center;overflow:hidden;position:relative}
.tileglow{position:absolute;width:760px;height:760px;border-radius:50%;background:rgba(255,138,61,.16);filter:blur(90px);top:-140px;left:50%;transform:translateX(-50%)}
.wrap{position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:space-between;padding:92px 60px 64px}
.eyebrow{display:inline-flex;align-items:center;gap:10px;border:1.5px solid rgba(255,138,61,.55);color:#FFB27A;border-radius:999px;padding:12px 26px;font-size:25px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
h1{font-size:62px;font-weight:800;letter-spacing:-1.5px;margin-top:26px;text-align:center;line-height:1.08}
.sub{margin-top:18px;font-size:29px;color:#D6CFC6;text-align:center;max-width:860px;line-height:1.35}
.chips{display:flex;gap:16px;margin-top:34px}
.chip{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:13px 24px;font-size:22px;font-weight:600;color:#FFF7ED}
.chip .ic{font-size:24px}
.phone-zone{position:relative;display:flex;align-items:center;justify-content:center}
.frog{position:absolute;z-index:3;background:#fff;border-radius:999px;padding:9px 15px;font-weight:800;color:#EA580C;font-size:14px;box-shadow:0 8px 20px rgba(0,0,0,.25)}
</style></head><body>
<div class="tileglow"></div>
<div class="wrap">
  <div>
    <div style="display:flex;justify-content:center"><span class="eyebrow">${eyebrow}</span></div>
    <h1>${title}</h1>
    <div class="sub">${sub}</div>
  </div>
  <div class="phone-zone">${body || ''}</div>
  <div class="chips">${chips.map((c) => `<div class="chip"><span class="ic">${c.ic}</span><span>${c.text}</span></div>`).join('')}</div>
</div>
</body></html>`;
}

function featurePage({ eyebrow, title, sub, right }) {
  return `<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1024px;height:500px}
body{font-family:'Segoe UI',system-ui,sans-serif;background:${BG};color:#FFF7ED;overflow:hidden;position:relative}
.tileglow{position:absolute;width:700px;height:700px;border-radius:50%;background:rgba(255,138,61,.20);filter:blur(80px);top:-260px;left:18%}
.left{position:absolute;left:74px;top:50%;transform:translateY(-50%);z-index:3;max-width:520px}
.logo{display:flex;align-items:center;gap:14px}
.logo .chip{background:linear-gradient(135deg,#F4A125,#EA580C);border-radius:18px;width:56px;height:56px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(234,88,12,.45)}
.logo .nm{font-size:34px;font-weight:800;letter-spacing:-.6px}
.eyebrow{display:inline-flex;align-items:center;gap:9px;border:1.5px solid rgba(255,138,61,.55);color:#FFB27A;border-radius:999px;padding:8px 18px;font-size:14px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-top:22px}
h1{font-size:42px;font-weight:800;letter-spacing:-1.2px;margin-top:16px;line-height:1.1}
.sub{margin-top:12px;font-size:18.5px;color:#D6CFC6;line-height:1.45;max-width:470px}
.play{display:inline-flex;align-items:center;gap:10px;margin-top:22px;background:#fff;color:#1C1917;border-radius:999px;padding:12px 22px;font-weight:800;font-size:16px;box-shadow:0 12px 28px rgba(0,0,0,.35)}
.play svg{width:15px;height:15px}
.right{position:absolute;right:-120px;top:50%;transform:translateY(-50%);z-index:2}
</style></head><body>
<div class="tileglow"></div>
<div class="left">
  <div class="logo"><div class="chip">${BAG(34, '#fff', '#FF8A3D')}</div><div class="nm">${eyebrow}</div></div>
  <h1>${title}</h1>
  <div class="sub">${sub}</div>
  <span class="play"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg> Google Play</span>
</div>
<div class="right">${right}</div>
</body></html>`;
}

/* ============================================================ copies */
const LIST = ['gr', 'en'];
const LP = { el: 'el', en: 'en' };

function L(app, lang, key, val) {
  const store = app === 'customer'
    ? { // customer
        gr: {
          brand: 'Fresh2GO', city: 'Ιωάννινα', search: 'Πίτσα, σουβλάκι, καφές…', banner: 'Δωρεάν παράδοση σήμερα', bannerSub: 'σε επιλεγμένα μαγαζιά της πόλης',
          promo: '🎁 Παίξε &amp; κέρδισε', add: '+',
          catAll: 'Όλα', cats: ['🍕 Πίτσα', '🥙 Σουβλάκι', '🍔 Burger', '🍟 Ψησταριά', '☕ Καφές'],
          stores: [
            ['Pizza Roma', '🍕', 'Ιταλική · 15–25 λεπτά · €2.00', '4.8', '−20%'],
            ['Souvlaki GR', '🥙', 'Ψησταριά · 20–30 λεπτά · €1.50', '4.6', 'Δωρεάν παρ.'],
            ['Burger Lab', '🍔', 'Burgers · 25–35 λεπτά · €2.50', '4.9', ''],
            ['Sushi Now', '🍣', 'Ασιατική · 30–40 λεπτά · €3.00', '4.7', ''],
          ],
          menu: [
            ['Μαργαρίτα', 'σάλτσα, μοτσαρέλα, βασιλικός', '€8.90'],
            ['Πεπερόνι', 'ντομάτα, μοτσαρέλα, πεπερόνι', '€10.50'],
            ['Ναπολιτάνα', 'αντσούγιες, κάπαρη, ελιές', '€11.90'],
          ],
          menuRest: ['Pizza Roma', '🍕', '★ 4.8 · 15–25 λεπτά · €2.00'],
          cart: ['Μαργαρίτα', 'Πεπερόνι', '€19.40'],
          track: ['Παραγγελία #2842', 'Ζωντανή παρακολούθηση'],
          pay: [
            ['💳 Κάρτα ·· 4242', 'Visa · Επιλεγμένη'],
            ['💵 Μετρητά', 'Κατά την παράδοση'],
          ],
          payTotal: ['Υποσύνολο', '€17.30', 'Παράδοση', '€1.50', 'Εξυπηρέτηση', '€0.99'],
          payBtn: 'Ασφαλής πληρωμή €19.79',
          sched: ['Σήμερα · 19:30', 'Σήμερα · 20:00', 'Σήμερα · 20:30', 'Αύριο · 13:00', 'Αύριο · 13:30', 'Αύριο · 14:00'],
          wheel: 'Ρόδα της τύχης', wheelSub: '1 στριφογύρισμα την ημέρα', spin: 'Γύρισε τη ρόδα',
        },
        en: {
          brand: 'Fresh2GO', city: 'Ioannina', search: 'Pizza, souvlaki, coffee…', banner: 'Free delivery today', bannerSub: 'at selected stores in town',
          promo: '🎁 Play &amp; win', add: '+',
          catAll: 'All', cats: ['🍕 Pizza', '🥙 Souvlaki', '🍔 Burger', '🍟 Grill', '☕ Coffee'],
          stores: [
            ['Pizza Roma', '🍕', 'Italian · 15–25 min · €2.00', '4.8', '−20%'],
            ['Souvlaki GR', '🥙', 'Grill · 20–30 min · €1.50', '4.6', 'Free deliver.'],
            ['Burger Lab', '🍔', 'Burgers · 25–35 min · €2.50', '4.9', ''],
            ['Sushi Now', '🍣', 'Asian · 30–40 min · €3.00', '4.7', ''],
          ],
          menu: [
            ['Margherita', 'sauce, mozzarella, basil', '€8.90'],
            ['Pepperoni', 'tomato, mozzarella, pepperoni', '€10.50'],
            ['Neapolitan', 'anchovies, capers, olives', '€11.90'],
          ],
          menuRest: ['Pizza Roma', '🍕', '★ 4.8 · 15–25 min · €2.00'],
          cart: ['Margherita', 'Pepperoni', '€19.40'],
          track: ['Order #2842', 'Live tracking'],
          pay: [
            ['💳 Card ·· 4242', 'Visa · Selected'],
            ['💵 Cash', 'On delivery'],
          ],
          payTotal: ['Subtotal', '€17.30', 'Delivery', '€1.50', 'Service', '€0.99'],
          payBtn: 'Secure payment €19.79',
          sched: ['Today · 19:30', 'Today · 20:00', 'Today · 20:30', 'Tomorrow · 13:00', 'Tomorrow · 13:30', 'Tomorrow · 14:00'],
          wheel: 'Wheel of fortune', wheelSub: '1 spin per day', spin: 'Spin the wheel',
        },
      }
    : { // driver
        gr: {
          brand: 'Fresh2GO Driver', online: 'Διαθέσιμος', onlineSub: 'Δέχεστε κλήσεις παραγγελιών',
          shiftH: '2ω 14λ', shiftO: '9', earned: '€42.50',
          offer: ['Νέα παραγγελία', 'Pizza Roma', 'Κάβουρα 12, Ιωάννινα', 'Οδός Αβέρωφ 22', '2,4 χλμ'], offerEarn: '€4.50', offerTime: '2:45', payAF: ['Αποδοχή', 'Άρνηση'],
          navLabel: ['Στροφή αριστερά σε 180 μέτρα', 'Φτάνετε σε 12 λεπτά'],
          wallToday: 'Σημερινά κέρδη', wallBal: '€87.20', wallNote: 'Τρ 9 Σεπ · €38.00', wallInvite: 'Κάλεσε φίλους', wallBonus: '+€5.00 ανά φίλο',
          homeTitle: 'Μάριος', homeSub: 'Διαθέσιμος για αποστολές',
        },
        en: {
          brand: 'Fresh2GO Driver', online: 'Available', onlineSub: 'Ready for new deliveries',
          shiftH: '2h 14m', shiftO: '9', earned: '€42.50',
          offer: ['New order', 'Pizza Roma', 'Kavoura 12, Ioannina', 'Averof 22, Ioannina', '2.4 km'], offerEarn: '€4.50', offerTime: '2:45', payAF: ['Accept', 'Decline'],
          navLabel: ['Turn left in 180 m', 'Arriving in 12 min'],
          wallToday: "Today's earnings", wallBal: '€87.20', wallNote: 'Tue 9 Sep · €38.00', wallInvite: 'Invite friends', wallBonus: '+€5.00 per friend',
          homeTitle: 'Marios', homeSub: 'Ready for deliveries',
        },
      };
  const chain = store[lang];
  const valArr = key.split('.');
  return valArr.reduce((o, k) => (o ? o[k] : undefined), chain) ?? val;
}

/* ---------- generic UI strings (localized) ---------- */
const UI_DICT = {
  gr: {
    dailyGame: 'ΣΗΜΕΡΙΝΟ ΠΑΙΧΝΙΔΙ', play: 'Παίξε →', seeAll: 'Δες όλα →',
    searchMenu: 'Αναζήτηση στο μενού…', topPicks: 'Κορυφαίες επιλογές', favs: 'Αγαπημένα',
    special: '🍕 Σπέσιαλ της ημέρας', checkoutCta: 'Πληρωμή →', menuTitle: 'Μενού',
    cooking: 'Μαγειρεύεται → 📍 Στον δρόμο', arrives: 'Φτάνει σε 20 λεπτά', onTheWay: '📍 Στον δρόμο',
    paymentTitle: 'Πληρωμή', total: 'Σύνολο', promoCode: 'Κωδικός προσφοράς', apply: 'Εφαρμογή', secureStripe: '🔒 Ασφαλής πληρωμή μέσω Stripe',
    nowSlot: '📅 Τώρα (σε ~30 λεπτά)', schedNote: 'Χρέωση παράδοσης €1.50 · δωρεάν πάνω από €15', schedTitle: 'Προγραμμάτισε',
    bookingHint: 'Κράτηση από +30 λεπτά έως ~6 ώρες · ελεύθερη ακύρωση έως 20 λεπτά πριν.',
    gamesTitle: '🎁 Παιχνίδια &amp; προσφορές', wheelTab: '🎰 Ρόδα', cardsTab: '🃏 Κάρτες', free: 'ΔΩΡΕΑΝ',
    deliverLabel: 'Παράδοση', restaurantLabel: 'Παραλαβή',
    hoursToday: 'Ώρες σήμερα', trips: 'Παραδόσεις', earnToday: 'Κέρδη', announcement: 'Ανακοίνωση:',
    surge: 'Αυξημένες αμοιβές απόψε 20:00–23:00',
    newOrder: 'Νέα παραγγελία', newOrderBadge: '🚀 ΝΕΑ ΠΑΡΑΓΓΕΛΙΑ', estTime: 'εκτιμώμενος χρόνος 22 λεπτά',
    tip: 'Η προσφορά λήγει αυτόματα σε 45 δευτερόλεπτα αν δεν απαντήσετε εγκαίρως.',
    store: 'Κατάστημα', customer: 'Πελάτης', min: '12 λεπτά', callLabel: '📞 Κάλεσέ με',
    walletTitle: '💰 Πορτοφόλι', availBalance: 'Διαθέσιμο υπόλοιπο', withdraw: 'Ανάληψη',
    recentPayments: 'Πρόσφατες πληρωμές', cardPayout: 'Μεταφορά καρτών', dailySettle: 'Ημερήσιος διακανονισμός',
    inviteShort: 'Καλεσμένοι', fee: 'Αμοιβή', tipLbl: 'Φιλοδώρημα', boost: 'Boost ωρών',
    referTitle: '🎁 Κάλεσε φίλους', referSub: 'Κέρδισε bonus για κάθε νέο οδηγό',
    referHero: '+€5.00 για εσάς, +€5.00 για τον φίλο σας', referHeroSub: 'Μόλις ο φίλος σας ολοκληρώσει την 1η παράδοση',
    progress: 'Πρόοδος', today: 'Σήμερα', thisMonth: 'Αυτόν τον μήνα', goal: 'Στόχος',
    progressHint: 'Έχεις 2 από τους 3 δρόμους που χρειάζονται για το bonus €15.00.',
    whatsappCta: '📤 Πρόσκληση μέσω WhatsApp',
  },
  en: {
    dailyGame: 'DAILY GAME', play: 'Play →', seeAll: 'View all →',
    searchMenu: 'Search the menu…', topPicks: 'Top picks', favs: 'Favorites',
    special: '🍕 Today’s special', checkoutCta: 'Checkout →', menuTitle: 'Menu',
    cooking: 'Preparing → 📍 On the way', arrives: 'Arrives in 20 min', onTheWay: '📍 On the way',
    paymentTitle: 'Payment', total: 'Total', promoCode: 'Promo code', apply: 'Apply', secureStripe: '🔒 Secure payment via Stripe',
    nowSlot: '📅 Now (in ~30 min)', schedNote: 'Delivery fee €1.50 · free over €15', schedTitle: 'Schedule',
    bookingHint: 'Book from +30 minutes up to ~6 hours · free cancellation up to 20 min before.',
    gamesTitle: '🎁 Games &amp; offers', wheelTab: '🎰 Wheel', cardsTab: '🃏 Cards', free: 'FREE',
    deliverLabel: 'Delivery', restaurantLabel: 'Pickup',
    hoursToday: 'Hours today', trips: 'Deliveries', earnToday: 'Earnings', announcement: 'Announcement:',
    surge: 'Surge fares tonight 20:00–23:00',
    newOrder: 'New order', newOrderBadge: '🚀 NEW ORDER', estTime: '~22 min estimated',
    tip: 'This offer auto-declines in 45 seconds if you do not respond in time.',
    store: 'Store', customer: 'Customer', min: '12 min', callLabel: '📞 Call me',
    walletTitle: '💰 Wallet', availBalance: 'Available balance', withdraw: 'Withdraw',
    recentPayments: 'Recent payments', cardPayout: 'Card payout', dailySettle: 'Daily settlement',
    inviteShort: 'Invited', fee: 'Fare', tipLbl: 'Tips', boost: 'Hourly boost',
    referTitle: '🎁 Invite friends', referSub: 'Earn a bonus for every new driver',
    referHero: '+€5.00 for you, +€5.00 for your friend', referHeroSub: 'Once your friend completes their 1st delivery',
    progress: 'Progress', today: 'Today', thisMonth: 'This month', goal: 'Goal',
    progressHint: 'You have 2 of the 3 invites needed for the €15.00 bonus.',
    whatsappCta: '📤 Invite via WhatsApp',
  },
};
const u = (lang, key) => UI_DICT[lang][key] ?? key;

/* ============================================================ screens */
function customerScreen(kind, lang) {
  const t = (k, v) => L('customer', lang, k, v);
  const s = (k, v) => L('driver', lang, k, v); // unused for customer
  if (kind === 'browse') {
    const cats = t('cats', []).map((c, i) => `<span class="kee ${i === 0 ? 'on' : ''}" style="flex:none;align-items:center;gap:4px;background:${i === 0 ? 'linear-gradient(135deg,#F4A125,#EA580C)' : '#fff'};color:${i === 0 ? '#fff' : '#1C1917'};border:1px solid #EFE9E3;border-radius:999px;padding:7px 13px;font-size:11.5px;font-weight:600">${c}</span>`).join('');
    const cards = t('stores', []).map(([nm, em, info, rt, deal]) => `
      <div class="scard">
        <div class="sth">${em}</div>
        <div class="sti"><b>${nm}</b><i>${info}</i><em><span class="stx">★ ${rt}</span>${deal ? `<span class="tag">${deal}</span>` : ''}</em></div>
        <span style="color:#D9D2C9;font-size:18px">♡</span>
      </div>`).join('');
    return `
    <div class="bar">
      <div class="realmini">
        <div class="rm-i">${BAG(20, '#fff', '#FF8A3D')}</div>
        <div class="rm-b"><b>${t('brand')}</b><span>📍 ${t('city')} ▾</span></div>
      </div>
      <div class="sea">◉ ${t('search')}</div>
      <div class="grad sht" style="margin:0 14px 12px;border-radius:18px;padding:14px;box-shadow:0 8px 18px rgba(234,88,12,.3)">
        <b style="font-size:14px;color:#fff;display:block">🧡 ${t('banner')}</b>
        <span style="font-size:11.5px;color:rgba(255,255,255,.92);display:block;margin-top:2px">${t('bannerSub')}</span>
      </div>
      <div class="kee" style="padding:0 16px 2px"><b style="font-size:14px;color:#1C1917;flex:none">${t('promo')}</b></div>
      <div class="kee" style="padding:6px 16px 10px;overflow:hidden;background:${C.ink};color:#fff;border-radius:16px;margin:0 14px 12px">
        <span style="font-size:26px;flex:none">🎰</span>
        <span style="flex:1"><em style="font-style:normal;font-size:10px;color:#f0b68a;font-weight:700">${u(lang, 'dailyGame')}</em><br><b style="font-size:13.5px;color:#fff">${t('wheel')}</b></span>
        <span class="grad" style="color:#fff;font-weight:800;font-size:11px;padding:7px 14px;border-radius:999px;flex:none">${u(lang, 'play')}</span>
      </div>
      <div class="kee"><b style="font-size:14px;color:#1C1917;flex:none">${t('city')}</b><span style="color:#EA580C;font-size:11.5px;font-weight:700;margin-left:auto">${u(lang, 'seeAll')}</span></div>
      <div class="kee" style="padding:0 16px 10px;overflow:hidden">${cats}</div>
    </div>
    <div class="sp" style="overflow:hidden;background:${C.bg}">${cards}</div>
    <div class="pnav" style="flex:none;height:64px;background:#fff;border-top:1px solid #EFE9E3;display:flex;padding-top:6px">
      <div class="nv on">🏠</div><div class="nv">🛍️</div><div class="nv">🎲</div><div class="nv">👤</div>
    </div>`;
  }
  if (kind === 'menu') {
    const menu = t('menu', []).map(([nm, ds, pr]) => `
      <div class="mi"><div class="mt"><b>${nm}</b><span>${ds}</span></div><span class="pr">${pr}</span><span class="adb">${t('add')}</span></div>`).join('');
    const [nm, em, info] = t('menuRest', []);
    return `
    <div class="bar" style="background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C);color:#fff">
      <div class="realmini" style="color:#fff">
        <span style="font-size:20px">‹</span>
        <div class="rm-b"><b style="color:#fff">${nm}</b><span style="color:rgba(255,255,255,.9)">${info}</span></div>
        <span style="font-size:24px">♡</span>
      </div>
      <div class="sea" style="margin:6px 14px 12px;background:#fff;border:none;color:#888079">🔍 ${u(lang, 'searchMenu')}</div>
    </div>
    <div class="sp" style="overflow:hidden;background:${C.bg}">
      <div class="kee" style="padding:14px 16px 8px"><b style="font-size:15px;color:#1C1917">${u(lang, 'topPicks')}</b><span class="tag" style="margin-left:8px">${u(lang, 'favs')}</span></div>
      <div class="scard" style="margin:0 14px 12px;background:${C.peach};border-color:#F5C9A8">
        <div class="sth" style="background:#fff">${em}</div>
        <div class="sti"><b>${nm}</b><i>${info}</i><em>${u(lang, 'special')}</em></div>
      </div>
      <div class="kee" style="padding:2px 16px 8px"><b style="font-size:15px;color:#1C1917">${u(lang, 'menuTitle')}</b></div>
      ${menu}
    </div>
    <div class="grad" style="flex:none;margin:0 auto 16px;width:440px;border-radius:16px;padding:14px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 10px 24px rgba(234,88,12,.4);color:#fff">
      <b style="font-size:14px;flex:1;color:#fff">${t('cart', '')[0]} + ${t('cart', '')[1]} · ${t('cart', '')[2]}</b>
      <span style="font-size:12.5px;background:rgba(255,255,255,.2);border-radius:999px;padding:4px 10px;font-weight:700">${u(lang, 'checkoutCta')}</span>
    </div>`;
  }
  if (kind === 'track') {
    return `
    <div class="bar" style="background:#fff;border-bottom:1px solid #EFE9E3">
      <div class="realmini">
        <span style="font-size:20px;color:#1C1917">‹</span>
        <div class="rm-b"><b style="font-size:14px">${t('track', '')[0]}</b><span>🛵 ⭐ Marios</span></div>
        <span class="tag" style="font-size:11px;background:${C.peach}">${u(lang, 'onTheWay')}</span>
      </div>
    </div>
    <div class="sp">
      ${stylizedMap(t('menuRest', '')[0], u(lang, 'deliverLabel'))}
      <div class="mcrd2" style="position:absolute;left:16px;right:16px;bottom:150px;background:#fff;border-radius:18px;padding:13px 16px;box-shadow:0 12px 30px rgba(0,0,0,.25);z-index:4">
        <b style="font-size:13.5px;color:#1C1917;display:block">${u(lang, 'cooking')}</b>
        <div style="display:flex;gap:5px;margin-top:9px">
          ${['📦', '🏍️', '🚪'].map((x, i) => `<span style="flex:1;text-align:center;background:${i < 2 ? '#FFF7ED' : '#fff'};border:1px solid ${i < 2 ? '#F5C9A8' : '#EFE9E3'};border-radius:9px;padding:7px 0;font-size:11.5px;font-weight:700;color:${i < 2 ? '#EA580C' : '#888079'}">${x}</span>`).join('')}
        </div>
      </div>
      <div style="position:absolute;left:16px;right:16px;bottom:16px;background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C);border-radius:18px;padding:14px 18px;color:#fff;box-shadow:0 12px 28px rgba(234,88,12,.4);z-index:5;display:flex;align-items:center">
        <b style="font-size:16px;color:#fff;flex:1">${u(lang, 'arrives')}</b>
        <span style="font-size:12px;background:rgba(255,255,255,.22);border-radius:999px;padding:5px 12px;font-weight:700">Marios 🛵</span>
      </div>
    </div>`;
  }
  if (kind === 'pay') {
    const rows = [
      [t('payTotal')[0], t('payTotal')[1]],
      [t('payTotal')[2], t('payTotal')[3]],
      [t('payTotal')[4], t('payTotal')[5]],
    ].map(([a, b]) => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12.5px;color:#57534E"><span>${a}</span><b style="color:#1C1917">${b}</b></div>`).join('');
    const methods = t('pay', []).map(([m, d], i) => `
      <div style="display:flex;align-items:center;gap:10px;background:${i === 0 ? C.peach : '#fff'};border:1px solid ${i === 0 ? '#F5C9A8' : '#EFE9E3'};border-radius:14px;padding:12px;margin-bottom:9px">
        <span style="font-size:20px">${m.split(' ')[0]}</span>
        <span style="flex:1"><b style="font-size:12.5px;color:#1C1917;display:block">${m.replace(/^[^\s]*\s/, '')}</b><span style="font-size:10.5px;color:#888079">${d}</span></span>
        <span style="width:18px;height:18px;border-radius:50%;border:2px solid ${i === 0 ? '#EA580C' : '#D6CFC7'};display:flex;align-items:center;justify-content:center">${i === 0 ? '<span style="width:8px;height:8px;border-radius:50%;background:#EA580C"></span>' : ''}</span>
      </div>`).join('');
    return `
    <div class="bar" style="background:#fff;border-bottom:1px solid #EFE9E3">
      <div class="realmini"><span style="font-size:20px;color:#1C1917">‹</span><div class="rm-b"><b style="font-size:14px">${u(lang, 'paymentTitle')}</b></div></div>
    </div>
    <div class="sp" style="background:${C.bg};padding:14px;overflow:hidden">
      <div style="background:#fff;border:1px solid #EFE9E3;border-radius:18px;padding:14px;margin-bottom:12px">
        <b style="font-size:13.5px;color:#1C1917;display:block;margin-bottom:6px">${t('menuRest', '')[0]} · Pizza</b>
        <div style="font-size:12.5px;color:#57534E;display:flex;justify-content:space-between;padding:4px 0"><span>${t('cart', '')[0]} + ${t('cart', '')[1]}</span><b style="color:#1C1917">${t('payTotal', '')[1]}</b></div>
        ${rows}
        <div style="border-top:1px dashed #E7DFD4;margin-top:4px;padding-top:8px;display:flex;justify-content:space-between"><b style="font-size:13.5px;color:#1C1917">${u(lang, 'total')}</b><b style="color:#EA580C;font-size:14px">€19.79</b></div>
      </div>
      ${methods}
      <div style="display:flex;align-items:center;gap:9px;background:#fff;border:1px solid #EFE9E3;border-radius:14px;padding:12px;margin-bottom:12px">
        <span style="font-size:17px">🎟️</span><span style="flex:1"><b style="font-size:12.5px;color:#1C1917">${u(lang, 'promoCode')}</b></span><span style="font-size:11px;color:#EA580C;font-weight:700">${u(lang, 'apply')}</span>
      </div>
      <div class="grad" style="border-radius:16px;padding:15px;color:#fff;text-align:center;box-shadow:0 10px 24px rgba(234,88,12,.4)"><b style="font-size:14px;color:#fff">${t('payBtn')}</b></div>
      <div style="text-align:center;font-size:10.5px;color:#A8A29E;margin-top:11px">${u(lang, 'secureStripe')}</div>
    </div>`;
  }
  if (kind === 'sched') {
    const slots = t('sched', []).map((s2, i) => `<span style="flex:none;background:${i === 0 ? 'linear-gradient(135deg,#F4A125,#EA580C)' : '#fff'};color:${i === 0 ? '#fff' : '#1C1917'};border:1px solid ${i === 0 ? 'transparent' : '#EFE9E3'};border-radius:12px;padding:10px 12px;font-size:12px;font-weight:700">${s2}</span>`).join('');
    return `
    <div class="bar" style="background:#fff;border-bottom:1px solid #EFE9E3">
      <div class="realmini"><span style="font-size:20px;color:#1C1917">‹</span><div class="rm-b"><b style="font-size:14px">${t('city', '')} · ${u(lang, 'deliverLabel')}</b></div></div>
    </div>
    <div class="sp" style="background:${C.bg};padding:16px;overflow:hidden">
      <div style="background:#fff;border:1px solid #EFE9E3;border-radius:18px;padding:15px;margin-bottom:12px">
        <b style="font-size:13.5px;color:#1C1917;display:block">${u(lang, 'nowSlot')}</b>
        <span style="font-size:11.5px;color:#888079;display:block;margin-top:3px">${u(lang, 'schedNote')}</span>
      </div>
      <b style="font-size:13.5px;color:#1C1917;display:block;margin-bottom:9px">${u(lang, 'schedTitle')}</b>
      <div style="display:flex;gap:8px;flex-wrap:wrap;overflow:hidden">${slots}</div>
      <div style="background:#FFF7ED;border:1px solid #F5C9A8;border-radius:14px;padding:12px;margin-top:14px;font-size:11.5px;color:#9A3412">⏰ ${u(lang, 'bookingHint')}</div>
    </div>`;
  }
  if (kind === 'games') {
    const colors = ['#FFB03A', '#FF8A3D', '#EA580C', '#F97316', '#C2410C', '#F4A125', '#FF8A3D', '#EA580C'];
    const labels = ['5%', '10%', u(lang, 'free'), '15%', '20%', '5%', '25%', '10%'];
    let conic = 'conic-gradient(';
    colors.forEach((c, i) => { conic += `${c} ${i * 45}deg ${i * 45 + 45}deg${i < colors.length - 1 ? ',' : ''}`; });
    conic += ')';
    const segs = labels.map((lb, i) => `<div style="position:absolute;top:0;left:0;right:0;bottom:0;transform:rotate(${i * 45 + 22.5}deg)"><span style="position:absolute;top:15px;left:50%;transform:translateX(-50%);color:#fff;font-weight:800;font-size:11px;text-shadow:0 1px 2px rgba(0,0,0,.3);white-space:nowrap">${lb}</span></div>`).join('');
    return `
    <div class="bar" style="background:#fff;border-bottom:1px solid #EFE9E3">
      <div class="realmini"><div class="rm-b"><b style="font-size:14px">${u(lang, 'gamesTitle')}</b></div></div>
    </div>
    <div class="sp" style="background:${C.bg};padding:16px;overflow:hidden">
      <div style="display:flex;background:#fff;border:1px solid #EFE9E3;border-radius:14px;padding:4px;margin-bottom:16px">
        <span style="flex:1;text-align:center;padding:9px;border-radius:10px;font-weight:700;font-size:12px;color:#fff;background:linear-gradient(135deg,#F4A125,#EA580C)">${u(lang, 'wheelTab')}</span>
        <span style="flex:1;text-align:center;padding:9px;border-radius:10px;font-weight:700;font-size:12px;color:#A8A29E">${u(lang, 'cardsTab')}</span>
      </div>
      <div style="background:#fff;border:1px solid #EFE9E3;border-radius:22px;padding:20px;text-align:center">
        <b style="font-size:15.5px;color:#1C1917;display:block">${t('wheel')}</b>
        <span style="font-size:11px;color:#888079;display:block;margin:4px 0 14px">${t('wheelSub')} · κέρδισε έκπτωση ή δωρεάν παράδοση</span>
        <div style="width:250px;height:250px;margin:0 auto;position:relative">
          <div style="position:absolute;inset:0;border-radius:50%;background:${conic};box-shadow:0 8px 26px rgba(234,88,12,.3),inset 0 0 0 8px #fff,inset 0 0 0 10px #EFE9E3">${segs}</div>
          <div style="position:absolute;top:-13px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:13px solid transparent;border-right:13px solid transparent;border-top:22px solid #EA580C;z-index:5"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center">${BAG(24, '#EA580C', '#FF8A3D')}</div>
        </div>
        <span class="grad" style="display:inline-block;background:linear-gradient(135deg,#F4A125,#FF8A3D,#EA580C);color:#fff;border-radius:999px;padding:12px 30px;font-weight:800;font-size:13px;margin-top:16px;box-shadow:0 8px 20px rgba(234,88,12,.35)">${t('spin')} 🎰</span>
      </div>
    </div>`;
  }
  return '';
}

function driverScreen(kind, lang) {
  const t = (k, v) => L('driver', lang, k, v);
  if (kind === 'online') {
    return `
    <div class="bar" style="background:${C.ink};color:#fff;padding:10px 0 0">
      <div class="realmini">
        <div class="rm-i" style="background:linear-gradient(135deg,#F4A125,#EA580C)">🛵</div>
        <div class="rm-b"><b style="color:#fff">${t('homeTitle')}</b><span style="color:#A8A29E">${t('homeSub')}</span></div>
      </div>
    </div>
    <div class="sp" style="background:linear-gradient(180deg,${C.ink} 0%,#1C1917 34%,${C.bg} 34%);overflow:hidden;position:relative">
      <div style="position:absolute;left:14px;right:14px;top:14px;">
        <div class="grad" style="border-radius:22px;padding:26px;text-align:center;position:relative;box-shadow:0 14px 34px rgba(234,88,12,.45)">
          <div style="width:106px;height:106px;border-radius:50%;background:#fff;margin:0 auto;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 8px rgba(255,255,255,.35)">
            <div style="width:74px;height:74px;border-radius:50%;background:linear-gradient(135deg,#F4A125,#EA580C);color:#fff;font-weight:800;font-size:12.5px;display:flex;align-items:center;justify-content:center">🛵 ${t('online')}</div>
          </div>
          <div style="margin-top:14px;font-size:24px;font-weight:800;color:#fff;letter-spacing:-.5px">${t('online')}</div>
          <div style="font-size:12px;color:rgba(255,255,255,.9);margin-top:3px">${t('onlineSub')}</div>
        </div>
        <div style="display:flex;gap:9px;margin-top:12px">
          ${[[`⏱️ ${t('shiftH')}`, u(lang, 'hoursToday')], [`🧾 ${t('shiftO')}`, u(lang, 'trips')], [`💰 ${t('earned')}`, u(lang, 'earnToday')]].map(([v, l2]) => `
          <div style="flex:1;background:#fff;border:1px solid #EFE9E3;border-radius:16px;padding:13px;text-align:center;box-shadow:0 6px 16px rgba(0,0,0,.05)">
            <b style="font-size:14.5px;color:#1C1917;display:block">${v}</b>
            <span style="font-size:10.5px;color:#888079">${l2}</span>
          </div>`).join('')}
        </div>
        <div style="background:#fff;border:1px solid #EFE9E3;border-radius:16px;padding:12px;margin-top:12px;display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">📢</span>
          <span style="flex:1;font-size:11.5px;color:#57534E"><b style="color:#1C1917">${u(lang, 'announcement')}</b> ${u(lang, 'surge')}</span>
        </div>
      </div>
    </div>`;
  }
  if (kind === 'offer') {
    const [mn] = t('offer', []);
    const [from, from2, to, dist] = [t('offer', '')[1], t('offer', '')[2], t('offer', '')[3], t('offer', '')[4]];
    const [acc, dec] = t('payAF', []);
    return `
    <div class="bar" style="background:#fff;border-bottom:1px solid #EFE9E3">
      <div class="realmini"><span style="font-size:20px;color:#1C1917">‹</span><div class="rm-b"><b style="font-size:14px">${u(lang, 'newOrder')}</b></div></div>
    </div>
    <div class="sp" style="background:${C.bg};padding:16px;overflow:hidden">
      <div style="background:#fff;border:1.5px solid #EA580C;border-radius:20px;padding:16px;box-shadow:0 12px 30px rgba(234,88,12,.16);position:relative">
        <span style="position:absolute;right:16px;top:16px;background:#FFEDD5;color:#EA580C;font-weight:800;font-size:10.5px;padding:4px 9px;border-radius:999px">−65%</span>
        <div style="display:flex;align-items:center;gap:9px">
          <span style="background:#FFEDD5;color:#EA580C;font-weight:800;font-size:10px;padding:4px 10px;border-radius:999px;letter-spacing:.1em">${u(lang, 'newOrderBadge')}</span>
          <span style="margin-left:auto;font-weight:800;color:#1C1917;font-size:18px"><svg width="34" height="34" viewBox="0 0 64 64" style="vertical-align:middle"><circle cx="32" cy="32" r="28" fill="none" stroke="#EA580C" stroke-width="7" stroke-dasharray="96 176" stroke-linecap="round" transform="rotate(-90 32 32)"/><text x="32" y="32" text-anchor="middle" dy="6" font-size="18" font-family="Segoe UI" font-weight="800" fill="#1C1917">${t('offerTime')}</text></svg></span>
        </div>
        <div style="margin-top:8px"><b style="font-size:16px;color:#1C1917">🍕 ${from}</b></div>
        <div style="font-size:11.5px;color:#57534E;display:flex;gap:10px;margin-top:12px">
          <span>🕐 ${from2}</span><span>→</span><span>📍 ${to}</span>
        </div>
        <div style="background:#FFF7ED;border-radius:12px;padding:10px;margin-top:12px;display:flex;align-items:center">
          <b style="font-size:20px;color:#EA580C;flex:1;letter-spacing:-.5px">${t('offerEarn')}</b>
          <span style="font-size:11.5px;color:#888079">${dist} · ${u(lang, 'estTime')}</span>
        </div>
      </div>
      <div style="display:flex;gap:11px;margin-top:16px">
        <span style="flex:1;text-align:center;background:#fff;border:1.5px solid #D6CFC7;color:#1C1917;border-radius:15px;padding:14px;font-weight:800;font-size:13.5px">${dec}</span>
        <span class="grad" style="flex:1;text-align:center;background:linear-gradient(135deg,#F4A125,#EA580C);color:#fff;border-radius:15px;padding:14px;font-weight:800;font-size:13.5px;box-shadow:0 10px 22px rgba(234,88,12,.4);flex:1">✅ ${acc}</span>
      </div>
      <div style="margin-top:14px;background:#fff;border:1px solid #EFE9E3;border-radius:14px;padding:10px 12px;display:flex;gap:8px;align-items:center;font-size:11px;color:#888079">
        <span>💡</span><span>${u(lang, 'tip')}</span>
      </div>
    </div>`;
  }
  if (kind === 'nav') {
    const [banner, eta] = t('navLabel', []);
    return `
    <div class="bar" style="background:#fff;border-bottom:1px solid #EFE9E3">
      <div class="realmini">
        <span style="font-size:20px;color:#1C1917">‹</span>
        <div class="rm-b"><b style="font-size:14px">🛵 ${t('homeTitle')}</b><span>🍕 → 🏠</span></div>
        <span class="tag" style="font-size:11px">● ${t('online')}</span>
      </div>
    </div>
    <div class="sp">
      ${stylizedMap(u(lang, 'store'), u(lang, 'customer'))}
      <div style="position:absolute;left:14px;right:14px;top:14px;background:#fff;border-radius:16px;padding:13px 16px;box-shadow:0 12px 30px rgba(0,0,0,.28);z-index:5;display:flex;align-items:center;gap:12px">
        <div class="grad" style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex:none">🧭</div>
        <div style="flex:1"><b style="font-size:14.5px;color:#1C1917;display:block">${banner}</b><span style="font-size:11px;color:#888079">↻ ${eta} · ${t('offer', '')[4]}</span></div>
      </div>
      <div style="position:absolute;left:14px;right:14px;bottom:16px;background:#fff;border-radius:18px;padding:13px 16px;box-shadow:0 12px 30px rgba(0,0,0,.3);z-index:5;display:flex;align-items:center;justify-content:space-between">
        <div><b style="font-size:14px;color:#1C1917;display:block">${t('offerEarn')} · ${u(lang, 'min')}</b><span style="font-size:11px;color:#888079">#2842 · ${t('offer', '')[1]}</span></div>
        <span class="grad" style="background:linear-gradient(135deg,#F4A125,#EA580C);color:#fff;border-radius:12px;padding:12px 18px;font-weight:800;font-size:12px">${u(lang, 'callLabel')}</span>
      </div>
    </div>`;
  }
  if (kind === 'wallet') {
    return `
    <div class="bar" style="background:${C.ink};color:#fff;padding-top:8px">
      <div class="realmini">
        <div class="rm-b"><b style="color:#fff">${u(lang, 'walletTitle')}</b><span style="color:#A8A29E">Marios · ${t('online')}</span></div>
      </div>
    </div>
    <div class="sp" style="background:${C.bg};padding:16px;overflow:hidden">
      <div class="grad" style="border-radius:20px;padding:20px;color:#fff;box-shadow:0 14px 34px rgba(234,88,12,.4)">
        <div style="font-size:12px;color:rgba(255,255,255,.9)">${t('wallToday')}</div>
        <div style="font-size:30px;font-weight:800;letter-spacing:-1px;margin-top:2px">€42.50</div>
        <div style="display:flex;gap:9px;margin-top:14px">
          ${[['€3+€0.50/χλμ', u(lang, 'fee')], ['+€1.20', u(lang, 'tipLbl')], ['€2.99', u(lang, 'boost')]].map(([v, l2]) => `
          <span style="flex:1;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:9px;text-align:center"><b style="font-size:12px;display:block">${v}</b><span style="font-size:9.5px;opacity:.9">${l2}</span></span>`).join('')}
        </div>
      </div>
      <div style="background:#fff;border:1px solid #EFE9E3;border-radius:18px;padding:14px;margin-top:14px;display:flex;align-items:center;gap:10px">
        <b style="font-size:14px;color:#1C1917;flex:1">${u(lang, 'availBalance')}</b>
        <b style="font-size:16px;color:#EA580C">${t('wallBal')}</b>
        <span style="background:${C.ink};color:#fff;border-radius:12px;padding:9px 16px;font-weight:800;font-size:11.5px">${u(lang, 'withdraw')}</span>
      </div>
      <div style="font-size:12px;color:#57534E;padding:13px 2px 6px"><b style="color:#1C1917">${u(lang, 'recentPayments')}</b></div>
      ${[['Σεπ 9', u(lang, 'cardPayout'), '€38.00'], ['Σεπ 8', u(lang, 'dailySettle'), '€41.00']].map(([d, nm, am]) => `
      <div style="background:#fff;border:1px solid #EFE9E3;border-radius:14px;padding:12px;margin-bottom:9px;display:flex;align-items:center;gap:10px">
        <span style="width:34px;height:34px;border-radius:10px;background:#FFF7ED;display:flex;align-items:center;justify-content:center;font-size:16px">💸</span>
        <span style="flex:1"><b style="font-size:12.5px;color:#1C1917;display:block">${nm}</b><span style="font-size:10.5px;color:#888079">${d}</span></span>
        <b style="font-size:12.5px;color:#1C1917">+${am}</b>
      </div>`).join('')}
      <div style="background:${C.peach};border:1px solid #F5C9A8;border-radius:16px;padding:13px;margin-top:4px;display:flex;align-items:center;gap:10px">
        <span style="font-size:20px">🎁</span>
        <span style="flex:1"><b style="font-size:12.5px;color:#1C1917;display:block">${u(lang, 'inviteShort')}</b><span style="font-size:10.5px;color:#9A3412">${t('wallBonus')}</span></span>
        <span class="grad" style="background:linear-gradient(135deg,#F4A125,#EA580C);color:#fff;border-radius:10px;padding:8px 13px;font-weight:800;font-size:11px">${u(lang, 'inviteShort')}</span>
      </div>
    </div>`;
  }
  if (kind === 'refer') {
    return `
    <div class="bar" style="background:${C.ink};color:#fff;padding-top:8px">
      <div class="realmini"><div class="rm-b"><b style="color:#fff">${u(lang, 'referTitle')}</b><span style="color:#A8A29E">${u(lang, 'referSub')}</span></div></div>
    </div>
    <div class="sp" style="background:${C.bg};padding:16px;overflow:hidden">
      <div class="grad" style="border-radius:20px;padding:22px;text-align:center;color:#fff;box-shadow:0 14px 34px rgba(234,88,12,.4)">
        <div style="font-size:40px">🛵</div>
        <div style="font-size:19px;font-weight:800;margin-top:6px">${u(lang, 'referHero')}</div>
        <div style="font-size:11.5px;opacity:.92;margin-top:4px">${u(lang, 'referHeroSub')}</div>
        <div style="display:inline-flex;align-items:center;gap:10px;background:#fff;color:#1C1917;border-radius:14px;padding:13px 20px;margin-top:16px;font-weight:800;font-size:15px;letter-spacing:1px">FRESH2GO-10</div>
      </div>
      <div style="background:#fff;border:1px solid #EFE9E3;border-radius:18px;padding:16px;margin-top:16px">
        <b style="font-size:13.5px;color:#1C1917;display:block;margin-bottom:10px">${u(lang, 'progress')}</b>
        <div style="display:flex;gap:8px;align-items:center">
          ${[2, 3, 5].map((n, i) => `<div style="flex:1;text-align:center;background:${i < 2 ? '#FFF7ED' : '#F3EDE6'};border:1px solid ${i < 2 ? '#F5C9A8' : '#EFE9E3'};border-radius:12px;padding:10px"><b style="font-size:15px;color:${i < 2 ? '#EA580C' : '#888079'}">${n}</b><span style="font-size:9.5px;color:#888079;display:block">${i === 0 ? u(lang, 'today') : i === 1 ? u(lang, 'thisMonth') : u(lang, 'goal')}</span></div>`).join('')}
        </div>
        <div style="font-size:11px;color:#888079;margin-top:12px;line-height:1.5">${u(lang, 'progressHint')}</div>
      </div>
      <span class="grad" style="display:flex;background:linear-gradient(135deg,#F4A125,#EA580C);color:#fff;border-radius:16px;padding:15px;font-weight:800;font-size:13.5px;justify-content:center;margin-top:16px;align-items:center;gap:8px;box-shadow:0 10px 24px rgba(234,88,12,.35)">${u(lang, 'whatsappCta')}</span>
    </div>`;
  }
  return '';
}

/* ============================================================ tiles */
const SHOTS = {
  customer: {
    gr: [
      { id: '01-browse', eyebrow: 'Παράγγειλε', title: 'Φαγητό από τα αγαπημένα σου μαγαζιά', sub: 'Ανακάλυψε εστιατόρια και ψητοπωλεία στην πόλη σου με αξιολογήσεις και ταχύτητα.', chips: [{ ic: '🔍', text: 'Αναζήτηση &amp; φίλτρα' }, { ic: '⭐', text: 'Πραγματικές αξιολογήσεις' }, { ic: '🎁', text: 'Καθημερινά παιχνίδια' }], kind: 'browse' },
      { id: '02-menu', eyebrow: 'Μενού', title: 'Κορυφαίες επιλογές σε ένα δευτερόλεπτο', sub: 'Κατέγραψε τηγανητά, πίτσες, σουβλάκια ή βίγκαν επιλογές και πρόσθεσε ό,τι θες.', chips: [{ ic: '🥘', text: 'Πλούσια μενού' }, { ic: '⚡', text: 'Γρήγορη παραγγελία' }, { ic: '💲', text: 'Διαφανείς τιμές' }], kind: 'menu' },
      { id: '03-track', eyebrow: 'Live tracking', title: 'Βλέπε τη διαδρομή του delivery σου', sub: 'Ζωντανή χάρτης για να ξέρεις πότε φτάνει το φαγητό σου, σε κάθε βήμα.', chips: [{ ic: '🗺️', text: 'Χάρτης σε πραγματικό χρόνο' }, { ic: '⏱️', text: 'Ακριβής χρόνος άφιξης' }, { ic: '🛵', text: 'Ονοματεπώνυμο οδηγού' }], kind: 'track' },
      { id: '04-pay', eyebrow: 'Πληρωμή', title: 'Πλήρωσε με κάρτα ή μετρητά', sub: 'Ασφαλής πληρωμή μέσω Stripe, δώρα-κουπόνια και αποθήκευση καρτών για 1-πάτημα επαναπαραγγελία.', chips: [{ ic: '💳', text: 'Visa · Mastercard' }, { ic: '💵', text: 'Μετρητά στην πόρτα' }, { ic: '🎟️', text: 'Κουπόνια &amp; προσφορές' }], kind: 'pay' },
      { id: '05-sched', eyebrow: 'Προγραμματισμός', title: 'Παράδοση όποτε εσύ θες', sub: 'Κλείσε slot από +30 λεπτά έως 6 ώρες μπροστά και άφησε τον προγραμματισμό σε εμάς.', chips: [{ ic: '📅', text: 'Κράτηση slot' }, { ic: '⏰', text: 'Σεβασμός ωραρίου' }, { ic: '🔄', text: 'Ακύρωση έως 20 λεπτά' }], kind: 'sched' },
      { id: '06-games', eyebrow: 'Παίξε &amp; κέρδισε', title: 'Δωρεάν παραδόσεις με λίγη τύχη', sub: 'Ρόδα της τύχης, μυστικές κάρτες και καθημερινά παιχνίδια με έπαθλα για την παραγγελία σου.', chips: [{ ic: '🎰', text: 'Ρόδα της τύχης' }, { ic: '🃏', text: 'Μυστικές κάρτες' }, { ic: '🎉', text: 'Έκπτωση ως 25%' }], kind: 'games' },
    ],
    en: [
      { id: '01-browse', eyebrow: 'Order', title: 'Food from your favorite spots', sub: 'Discover restaurants and grills near you with real ratings and fastest delivery.', chips: [{ ic: '🔍', text: 'Search &amp; filters' }, { ic: '⭐', text: 'Real ratings' }, { ic: '🎁', text: 'Daily games' }], kind: 'browse' },
      { id: '02-menu', eyebrow: 'Menu', title: 'Your top picks in one tap', sub: 'Browse pizzas, souvlaki, burgers or vegan options and add any item you like.', chips: [{ ic: '🥘', text: 'Rich menus' }, { ic: '⚡', text: 'Fast ordering' }, { ic: '💲', text: 'Clear pricing' }], kind: 'menu' },
      { id: '03-track', eyebrow: 'Live tracking', title: 'Follow your delivery live', sub: 'A real-time map shows exactly where your food is, every step of the way.', chips: [{ ic: '🗺️', text: 'Real-time map' }, { ic: '⏱️', text: 'Accurate ETA' }, { ic: '🛵', text: 'Your driver by name' }], kind: 'track' },
      { id: '04-pay', eyebrow: 'Payment', title: 'Pay by card or cash', sub: 'Secure Stripe checkout, promo codes and saved cards for effortless 1-tap reorders.', chips: [{ ic: '💳', text: 'Visa · Mastercard' }, { ic: '💵', text: 'Cash on delivery' }, { ic: '🎟️', text: 'Coupons &amp; deals' }], kind: 'pay' },
      { id: '05-sched', eyebrow: 'Schedule', title: 'Delivery whenever you want', sub: 'Book a slot from +30 minutes up to 6 hours ahead and let us handle the rest.', chips: [{ ic: '📅', text: 'Book a slot' }, { ic: '⏰', text: 'On-time promise' }, { ic: '🔄', text: 'Free cancel' }], kind: 'sched' },
      { id: '06-games', eyebrow: 'Play &amp; win', title: 'Free deliveries with some luck', sub: 'Spin the wheel, flip mystery cards and play daily games for discounts on your order.', chips: [{ ic: '🎰', text: 'Wheel of fortune' }, { ic: '🃏', text: 'Mystery cards' }, { ic: '🎉', text: 'Up to 25% off' }], kind: 'games' },
    ],
  },
  driver: {
    gr: [
      { id: '01-online', eyebrow: 'Online', title: 'Ξεκίνα τη βάρδια με ένα πάτημα', sub: 'Συνδεθείτε ως διαθέσιμος και δεχθείτε κλήσεις για νέες παραδόσεις στην πόλη.', chips: [{ ic: '🛵', text: 'Ένα tap online' }, { ic: '⏱️', text: 'Ώρες &amp; παραδόσεις' }, { ic: '💰', text: 'Κέρδη σε πραγματικό χρόνο' }], kind: 'online' },
      { id: '02-offer', eyebrow: 'Νέα προσφορά', title: 'Δέξου την προσφορά πριν το χρονόμετρο', sub: 'Δες αμοιβή, διαδρομή και χρόνο παράδοσης πριν αποφασίσεις – αυτόματη απόρριψη μετά το όριο.', chips: [{ ic: '⏳', text: 'Αντίστροφη μέτρηση' }, { ic: '🗺️', text: 'Διαδρομή &amp; χιλιόμετρα' }, { ic: '💰', text: 'Καθαρή αμοιβή' }], kind: 'offer' },
      { id: '03-nav', eyebrow: 'Πλοήγηση', title: 'Οδηγίες βήμα προς βήμα μέχρι την πόρτα', sub: 'Live χάρτης με αναλυτικές οδηγίες, ETA και κουμπί κλήσης για κάθε παράδοση.', chips: [{ ic: '🧭', text: 'Turn-by-turn' }, { ic: '⏱️', text: 'ETA κάθε στιγμή' }, { ic: '📞', text: 'Κλήση πελάτη' }], kind: 'nav' },
      { id: '04-wallet', eyebrow: 'Πορτοφόλι', title: 'Κέρδη και αναλήψεις από την εφαρμογή', sub: 'Βλέπε καθημερινά κέρδη, φιλοδωρήματα και αμοιβές και κάνε ανάληψη όποτε θες.', chips: [{ ic: '💎', text: 'Ημερήσια κέρδη' }, { ic: '💸', text: 'Γρήγορη ανάληψη' }, { ic: '💜', text: 'Φιλοδωρήματα' }], kind: 'wallet' },
      { id: '05-refer', eyebrow: 'Παραπομπές', title: 'Φέρε φίλους και κέρδισε μαζί', sub: '+€5 για εσένα και +€5 για κάθε φίλο που ξεκινά παραδόσεις με Fresh2GO Driver.', chips: [{ ic: '🤝', text: '+€5 &amp; +€5' }, { ic: '📤', text: 'Πρόσκληση WhatsApp' }, { ic: '🏆', text: 'Πρόοδος bonus' }], kind: 'refer' },
    ],
    en: [
      { id: '01-online', eyebrow: 'Online', title: 'Start your shift in one tap', sub: 'Go online as an available driver and get calls for new deliveries around town.', chips: [{ ic: '🛵', text: 'One tap online' }, { ic: '⏱️', text: 'Hours &amp; trips' }, { ic: '💰', text: 'Real-time earnings' }], kind: 'online' },
      { id: '02-offer', eyebrow: 'New offer', title: 'Accept before the clock runs out', sub: 'See the fare, route and delivery time before you decide — auto-decline when time is up.', chips: [{ ic: '⏳', text: 'Countdown timer' }, { ic: '🗺️', text: 'Route &amp; distance' }, { ic: '💰', text: 'Clear fare' }], kind: 'offer' },
      { id: '03-nav', eyebrow: 'Navigation', title: 'Turn-by-turn directions to the door', sub: 'A live map with detailed instructions, live ETA and a call button for every drop-off.', chips: [{ ic: '🧭', text: 'Turn-by-turn' }, { ic: '⏱️', text: 'Live ETA' }, { ic: '📞', text: 'Call customer' }], kind: 'nav' },
      { id: '04-wallet', eyebrow: 'Wallet', title: 'Your earnings, in your pocket', sub: 'Track daily earnings, tips and fares, and withdraw whenever you want — all in-app.', chips: [{ ic: '💎', text: 'Daily earnings' }, { ic: '💸', text: 'Fast payout' }, { ic: '💜', text: 'Tips included' }], kind: 'wallet' },
      { id: '05-refer', eyebrow: 'Referrals', title: 'Bring friends, win together', sub: 'Earn +€5 for you and +€5 for each friend who starts delivering with Fresh2GO Driver.', chips: [{ ic: '🤝', text: '+€5 &amp; +€5' }, { ic: '📤', text: 'WhatsApp invite' }, { ic: '🏆', text: 'Bonus progress' }], kind: 'refer' },
    ],
  },
};

const FEATURES = {
  customer: {
    gr: { eyebrow: 'Fresh2GO', title: 'Φρέσκο. Σε 2. Στην πόρτα σου.', sub: 'Παράγγειλε από τα αγαπημένα σου μαγαζιά στο Ιωάννινα, πλήρωσε με κάρτα ή μετρητά και δες την παράδοση ζωντανά στον χάρτη.' },
    en: { eyebrow: 'Fresh2GO', title: 'Fresh. In 2. At your door.', sub: 'Order from your favorite spots in Ioannina, pay by card or cash, and track your delivery live on the map.' },
  },
  driver: {
    gr: { eyebrow: 'Fresh2GO Driver', title: 'Κερδίζεις. Κάθε διαδρομή.', sub: 'Δέξου προσφορές, πλοήγηση βήμα-βήμα μέχρι την πόρτα και ημερήσια κέρδη με ανάληψη από την εφαρμογή.' },
    en: { eyebrow: 'Fresh2GO Driver', title: 'Earn. On every ride.', sub: 'Accept offers, follow turn-by-turn navigation to the door, and get daily earnings with instant withdrawal.' },
  },
};

async function main() {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = (await browser.newPage()).context().pages()[0];

  async function snap(html, w, h, outPath) {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(html, { waitUntil: 'load' });
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: w, height: h } });
    console.log('  ✓', outPath.replace(ROOT + '\\', ''));
  }

  const allCss = PHONE_CSS + MAP_CSS;
  for (const app of ['customer', 'driver']) {
    const dir = join(OUT, app, 'screenshots');
    mkdirSync(dir, { recursive: true });

    for (const lang of LIST) {
      for (const s of SHOTS[app][lang]) {
        const inner = app === 'customer' ? customerScreen(s.kind, lang) : driverScreen(s.kind, lang);
        const html = tilePage({
          eyebrow: s.eyebrow, title: s.title, sub: s.sub, chips: s.chips,
          body: phone(inner, { nav: false }),
        });
        await snap(html, 1080, 1920, join(dir, `${lang}-${s.id}.png`));
      }
    }

    const f = FEATURES[app][LIST[0]];
    const fhtml = featurePage({
      eyebrow: f.eyebrow, title: f.title, sub: f.sub,
      right: phone(app === 'customer' ? customerScreen('browse', LIST[0]) : driverScreen('online', LIST[0]), { nav: false, wide: true }),
    });
    await snap(fhtml, 1024, 500, join(OUT, app, 'feature-graphic-1024x500.png'));

    const f2 = FEATURES[app]['en'];
    const f2html = featurePage({
      eyebrow: f2.eyebrow, title: f2.title, sub: f2.sub,
      right: phone(app === 'customer' ? customerScreen('browse', 'en') : driverScreen('online', 'en'), { nav: false, wide: true }),
    });
    await snap(f2html, 1024, 500, join(OUT, app, 'feature-graphic-en-1024x500.png'));
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });