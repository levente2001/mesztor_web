# MESZ-TOR webshop – kiegészítő fejlesztés

A felhasználó által 2026-11-26-án megadott négy eredeti HTML fájlra épülő fejlesztői verzió.

## Megőrzött régi működés

- **index.html**: eredeti elrendezés, színek, főoldali kártyák, Firebase-tartalom, slider, navigáció és analitika. Mindössze egy új „Webshop megnyitása” hivatkozás került a termékválaszték elé.
- **admin.html**: analitika, layout, email, tartalom, referenciák, beszállítók, slider, Firebase Auth, kijelentkezés és meglévő termékfeltöltés. A termékkezelést plusz webshopmezők és termékszerkesztés egészítik ki.
- **details.html**: a meglévő termékadatlap és email-ajánlatkérő gomb változatlan; Firestore-elsődleges betöltés került be a régi Realtime Database fallback elé, továbbá egy webshoplink.
- **login.html**: bájtra pontosan a feltöltött eredeti, változatlan fájl.

## Új webshop

A `shop.html` a már meglévő **Firestore `products`** kollekciót olvassa – nincs külön párhuzamos termékadatbázis. A meglévő termékek automatikusan **ajánlatkéréses** típussal láthatók, ha nincsen webshop módjuk beállítva.

Admin „Termékek” oldalon új mezők:
- `shopMode`: `quote` (ajánlatkérés, alapérték) vagy `purchase` (kosárba tehető)
- `price`: ár forintban – kosaras terméknél kötelező
- `stock`: opcionális készletmennyiség
- `category`: keresési/szűrési kategória
- `shopVisible`: megjelenés a webshopban

A régi `name`, `shortDescription`, `longDescription`, `imageDataUrl`, `createdAt` mezők változatlanok. Szerkesztéskor a Firestore `setDoc(...,{merge:true})` megőrzi az ismeretlen és régi mezőket is, a fotócsere opcionális.

A kosár `sessionStorage`-ban működik. A jelenlegi checkout az alapértelmezett **emailprogramban** nyitja meg a rendelési igény vagy ajánlatkérés összesítőjét. **Nem történik bankkártyás fizetés, adatbázis-rendelésfelvétel, automatikus rendelésvisszaigazolás, készletfoglalás, vagy automatikus készletcsökkentés.** Ezek éles webshophoz külön backend-integrációt, jogi szövegeket, tranzakciókezelést és tesztelést igényelnek.

## Adatbiztonság

Az eredeti admin-oldal Firebase Email/Password bejelentkezést használ, ezt megőriztük. **Firebase bejelentkezés önmagában nem adminjogosultság!** Éles használat előtt a Firestore és RTDB Security Rules szabályokkal ellenőrizni kell az adminjogosultságot (pl. admin custom claim) az összes írási útvonalon. Ne írj felül vakon meglévő Firebase Rules szabályokat; a régi analitika és tartalomkezelés megtartását is teszteld. A korábban használt `flymeto-696d0` Firebase projektet és adatokat semmi nem módosította automatikusan.

## Tesztelés

```bash
npm install
npm run build
npm run dev
```

Oldalak: `/index.html`, `/admin.html`, `/login.html`, `/details.html?id=<productId>`, `/shop.html`.

A deployon különösen ellenőrizd: Firebase Auth / Authorized domains, publikus Firestore olvasás, bejelentkezett admin termékírás, régi navigáció / tartalom / slider / analitika, régi termékek Firestore adatai, mobilfelület, levélküldő kliens támogatása, hiányzó lokális képfájlok.

A `master` ágat ez a fejlesztés **nem** módosítja. Csak külön Preview branch kerül telepítésre.
