# MESZ-TOR vegyes webshop – fejlesztői ág

A master ág és az eredeti dizájn megőrzésével hozzáadott oldalak:

- `shop.html`: publikus termékkatalógus, keresés, kategória, kosár / ajánlatkérés
- `products-admin.html`: védett termék CRUD, termékkép feltöltéssel
- `admin.html`: bejelentkezési és adminjogosultsági ellenőrzés, webshop menüpont
- `index.html`: webshop link, adminPreview csak ellenőrzött adminnal
- `vite.config.js`: mind a négy oldal bekerül a Vite buildbe

## Közvetlen rendelés jelenlegi jelentése

A kosaras termékeknél **rendelési igény** kerül a `shop/orders` alá. Ez **nem online bankkártyás fizetés**, nincs bekötve számlázás, szállítás vagy automatikus e-mail-visszaigazolás. Az ajánlatkérés ugyanitt `type: quote`. Éles élesítés előtt rendelésfeldolgozás, értesítés, adatkezelési nyilatkozat, ÁSZF, szállítási és elállási tájékoztató szükséges.

## Kötelező Firebase teendők élesítés előtt

**Fontos: A Firebase Security Rules szabályokat ez a PR nem módosítja a Firebase Console-ban!** A csak kliensoldali belépés **nem** adatbázisvédelem. A meglévő Firebase projekt (`flymeto-696d0`) egyéb adatait és szabályait előbb mentsd el, és ellenőrizd, hogy más alkalmazás használja-e.

1. Firebase Console → Authentication → Sign-in method → Email/Password engedélyezés.
2. Authentication → Users: admin felhasználó létrehozása; azonosítsd az UID-ját.
3. Realtime Database → Data: hozz létre `admins/<UID>` = **boolean true** értéket (nem string).
4. Firebase Admin SDK-val **szerveroldalról** állítsd a felhasználó custom claim-jét `{ admin: true }` értékre, majd jelentkezz ki és vissza; a Storage-szabály ehhez kötött. Sose tegyél service account kulcsot a frontendbe vagy a repóba.
5. Firebase Realtime Database Rules: egyesítsd a létező szabályokkal a következő jogosultságokat. Ne írd felül vakon a teljes `rules` gyökeret: a korábbi analitika, referenciák és beállítások működését ellenőrizni kell.
   - `admins/$uid`: csak az érintett bejelentkezett felhasználó olvashatja a saját adminjelölését; kliensoldali írás tiltva.
   - `shop/products`: nyilvánosan olvasható; írni, módosítani, törölni kizárólag `auth != null && auth.token.admin === true` esetén lehessen.
   - `shop/orders/$orderId`: a publikus vásárlók **csak új** rendelési igényt hozhassanak létre, megfelelő méret- és mezővalidálással; csak admin olvashasson, frissíthessen, törölhessen.
   - `settings/layoutBoards`, `settings/email`, `content/sections`, `references`: írás csak adminnak, ha az adott írási útvonalnak jelenleg sincs más legitim szerkesztője.
   - `analytics/sessions`: a jelenlegi látogatottsági logika külön jogosultságot igényel; őrizd meg a működését, és korlátozd a kliens által írható mezőket.
6. Firebase Storage Rules: `shop/products/{productId}/{fileName}` útvonalon az olvasás publikus lehet, **írás/törlés csak `request.auth.token.admin == true`**, kép típusa image/jpeg, image/png vagy image/webp, maximum 5 MB. A fájlnév és MIME típus validálását a szabályokban is végezd el.
7. A publikus `shop/orders` kliensoldali írás spam- és manipulációveszélyes. Éles, fizetős rendeléshez javasolt Cloud Function / szerveroldali rendelés API, App Check és rate limit; ott a szerver számolja újra az árakat és a készletet.
8. Az oldal jelenleg közvetlenül Realtime Database-be ír, így tranzakciós készletcsökkentés még nincs. Ne ígérj garantált készletfoglalást.

## Fejlesztői teszt

```bash
npm install
npm run dev
# http://localhost:5173/index.html
# http://localhost:5173/shop.html
# http://localhost:5173/admin.html
# http://localhost:5173/products-admin.html
npm run build
```

**Telepítés / élesítés előtt** tesztelendő: admin login és kijelentkezés; nem-admin hozzáférés; jogosulatlan API-írás tiltása; a meglévő analitika / tartalomszerkesztés / referenciák; mobilnézet; kép feltöltés, rendelés és ajánlatkérés, hibás hálózat, dupla rendelés.

Nem került sor fizetési szolgáltatás vagy Firebase Rules automatikus élesítésére.
