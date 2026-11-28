# Stripe Checkout integráció – MESZ-TOR

Ez az új, külön `feature/stripe-checkout-20261126` fejlesztői ág **csak a webshopot** módosítja, valamint új Vercel API-függvényeket és egy fizetési visszajelző oldalt ad hozzá. A főoldal (`index.html`), régi admin (`admin.html`), termékadatlap (`details.html`) és bejelentkezés (`login.html`) **nem változik** a korábbi webshopos verzióhoz képest.

## Funkciók

- A vásárló a `shop.html` kosarából a Stripe által üzemeltetett, bankkártyás Checkout felületre jut.
- A szerver a **Firestore `products` kollekcióból** ellenőrzi a terméket, árat, láthatóságot, rendelhetőséget és elérhető készletet. A böngészőtől csak a termékazonosítót és a darabszámot fogadja el.
- A fizetések HUF-ban történnek. A Firestore-ban tárolt ár forintban értendő, a Stripe REST API-nál **100-szoros szorzó** szükséges a HUF terhelésekhez.
- A Checkout Session létrehozásakor a szerver egy `stripe_orders/{sessionId}` dokumentumot hoz létre, benne a termékek rögzített árával, mennyiségével és az állapottal.
- Az `api/stripe-webhook.js` ellenőrzi a Stripe aláírását és a fizetés összegét/pénznemét, majd `paid` / `pending` / `failed` / `expired` státuszt rögzít.
- Az `api/payment-status.js` Stripe-ból ellenőrizve mutatja a visszaigazoló oldalon a fizetés állapotát.
- Az ajánlatkéréses termékek továbbra is e-mailesek. A kosárnál a korábbi **e-mailes rendelési igény** lehetőség is megmarad.
- **Fizetett rendelések csak személyes átvételre**, szállítási díj/szállítási cím/automatikus futárrendelés nélkül. A Stripe számlázási adatok megadását kéri.

## Kötelező környezeti változók (Vercel → Project → Settings → Environment Variables)

Csak **Preview** környezethez, lehetőleg csak a `feature/stripe-checkout-20261126` ághoz add hozzá ezeket:

1. `STRIPE_SECRET_KEY` — **Stripe test-mode** titkos kulcs: `sk_test_...`
2. `STRIPE_WEBHOOK_SECRET` — a **Preview** webhook endpoint `whsec_...` aláírási titka
3. `FIREBASE_SERVICE_ACCOUNT_JSON` — a `flymeto-696d0` Firebase-projekt **service account** JSON-fájljának teljes tartalma, egyetlen környezeti változóként. A kulcs nem kerülhet GitHubra vagy a böngészőbe.

A Firebase-projekthez megfelelő jogosultságú service account szükséges. Lehetőleg külön, legkisebb jogosultságú fiókot hozz létre, amely képes a Firestore termékeket olvasni és a `stripe_orders` dokumentumokat létrehozni/módosítani. Vercelen a JSON-érték maradjon titkos (encrypted/sensitive). Ne küldd el a kulcsokat chatben.

A Stripe Dashboard **Developers / Workbench → Webhooks / Event destinations** résznél állítsd be a következő HTTPS endpointot:

`https://<PREVIEW_HOST>/api/stripe-webhook`

Az események: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Másold át az ehhez az endpointhoz tartozó `whsec_...` aláírási titkot a Vercel **Preview** környezeti változóba. A Preview endpoint linkje csak a tesztelésre szolgál; az éles hosthoz külön webhook végpont és **külön éles** `sk_live_` / `whsec_` kulcs szükséges.

**A környezeti változók mentése után új Preview deployment szükséges**, mert a korábbi build és serverless runtime nem veszi át automatikusan őket.

## Tesztelés

```bash
npm install
npm run build
```

1. Az adminban legyen legalább egy `shopMode=purchase`, pozitív egész forint-árú, `shopVisible !== false` termék a Firestore `products` kollekcióban.
2. Próbálj fizetést tesztmódban a Stripe hivatalos 4242-es tesztkártyájával. **Ne használj valódi kártyát teszteléshez.**
3. Ellenőrizd a visszaigazoló oldalt, a Stripe tesztfizetéseket és a Firestore `stripe_orders` bejegyzés `paid` státuszát.
4. Próbálj meg módosított árral és ajánlatkéréses termékkel API-hívást küldeni: a szervernek a Firestore eredeti értékét kell figyelembe vennie, illetve elutasítania a nem rendelhető terméket.
5. Teszteld a megszakított és sikertelen fizetést, hibás webhook-aláírást és a duplikált Stripe eseményeket.
6. Teszteld az eredeti főoldalt, admint, bejelentkezést és a termékadatlapokat desktopon és mobilon.

## Élesítés előtti további követelmények

- Érvényes **Stripe kereskedői fiók**, helyes jogi vállalkozási adatok és árazás.
- A termékáraknak a fogyasztónak ténylegesen fizetendő, megfelelően adózott összegnek kell lenniük; az automatikus áfa- és számlázási integráció **nincs implementálva**.
- **ÁSZF, adatkezelési tájékoztató, elállási tájékoztató** és az átvétel módjának megjelenítése szükséges.
- A jelenlegi készletellenőrzés nem foglal készletet, és nem csökkenti automatikusan az értéket. Fizetős, valós készletkezeléshez tranzakciós foglalás/levonás és visszatérítés/hibakezelés szükséges.
- Nincs automatikus e-mailes rendelésvisszaigazolás, raktári feldolgozás, számlakibocsátás vagy átvételi adminpanel.
- A Firebase termékadatok adminjogosultságait **Firestore Security Rules** segítségével kell védetté tenni. A jelenlegi adminbejelentkezés önmagában nem igazolja a szerveroldali adminszerepkört.
- A teljes fizetési folyamatot manuálisan is végig kell tesztelni **test módban**, a megfelelő titkok beállítása után. Sikeres Vercel build nem helyettesíti a fizetés működési tesztjét.

**Egyelőre sem éles Stripe-kulcsot, sem terhelést, sem Production deployt nem állítottunk be.**

**Éles fizetés biztonsági kapcsoló:** a szerver kifejezetten elutasítja a `sk_live_...` kulccsal indított kéréseket, amíg a `STRIPE_ENABLE_LIVE=true` környezeti változó nincs beállítva. Ezt csak a teljes tesztelés, céges Stripe-aktiválás, adózási/jogi tájékoztatás, rendelésfeldolgozás és szerveroldali jogosultságellenőrzés után állítsd be a Production környezetben. A Preview alatt maradjon kikapcsolva.
