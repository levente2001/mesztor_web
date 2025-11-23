# MeszTor Web – Lokális fejlesztői környezet

Ez a repository egy statikus weboldalt tartalmaz (`index.html` és `admin.html`).  

---

## 1. Előfeltételek

### 1.1 Node.js + npm

Szükséges:

- **Node.js (LTS verzió)**  
- **npm** (a Node.js része)

Telepítés:

- Letöltés: https://nodejs.org  
  Válaszd az LTS verziót (ajánlott fejlesztéshez).

Telepítés után ellenőrzés terminálban / parancssorban:

    node -v
    npm -v

Ha mindkét parancs verziószámot ad vissza, a Node.js + npm rendben van.

---

### 1.2 Git

A projekt klónozásához szükséges.

- Letöltés: https://git-scm.com/downloads
- Telepítés után ellenőrzés:

    git --version

Ha verziószámot ad vissza, a Git telepítve van.

---

## 2. Projekt klónozása

Válassz egy mappát, ahova a projekt kerülni fog, majd:

    git clone https://github.com/levente2001/mesztor_web.git
    cd mesztor_web

A repo gyökerében ekkor legalább ezeknek a fájloknak kell látszódniuk:

- `index.html`
- `admin.html`
- `package.json`

---

## 3. Node.js alapú dev környezet beállítása

    npm instal

## 4. **Node.js + Vite** segítségével a következő módon tudod lokálisan futtatni

- `npm run dev` → localhost dev szerver
- `npm run dev:index` → `index.html` automatikus megnyitása
- `npm run dev:admin` → `admin.html` automatikus megnyitása
