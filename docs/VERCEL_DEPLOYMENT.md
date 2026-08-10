# Deploy pe Vercel - Ghid Complet

## 🚀 Pasii Rapizi (5 minute)

### 1. Mergi pe Vercel
```
https://vercel.com/new
```

### 2. Conectează GitHub
- Click butonul "GitHub" 
- Autentifică-te cu contul GitHub
- Autorizează Vercel să acceseze repositoriile

### 3. Selectează Repository
```
https://github.com/robertoiosifrbt-rgb/blank-canvas-studio
```
- Apasă pe repo
- Click "Import"

### 4. Configurare Deploy

**Setări implicite sunt OK, dar verifica:**

- **Project Name**: `tasks-and-calendar` (poate fi orice)
- **Root Directory**: `./` (lasă așa)
- **Framework Preset**: Vercel detectează automat `Vite`
- **Build Command**: `npm run build` ✅
- **Output Directory**: `dist` ✅
- **Environment Variables**: (nu sunt necesare pentru această app)

### 5. Apasă "Deploy"

✅ Gata! Asteptă ~60 secunde și aplicația va fi LIVE! 🎉

---

## 📊 După Deploy

### Linkul Tău
```
https://tasks-and-calendar.vercel.app
```
(sau similar, Vercel o să-ți dea linkul exact)

### Verifică că funcționează
1. Deschide linkul
2. Testează Tasks (adaugă, șterge, completează)
3. Testează Calendar (navighează lunile)
4. Schimbă limba EN ↔ RO

---

## ⚙️ Configurare Avansată (Opțional)

### Custom Domain

1. În dashboard Vercel, mergi la **Settings**
2. **Domains** tab
3. Adaugă domeniu tău (ex: `tasks.example.com`)
4. Urmează instrucțiunile DNS

### Environment Variables

Dacă adaugi backend API mai târziu:

1. Settings → Environment Variables
2. Adaugă: `VITE_API_URL=https://api.example.com`
3. Deploy se va rebuilda automat

### Preview URLs

Vercel creează automat:
- **Production**: https://tasks-and-calendar.vercel.app (din `production` branch)
- **Preview**: URL unic pentru fiecare PR din `main`

---

## 🔄 Auto-Deploy

Vercel deploy-ează automat când:
- Push pe `production` branch → Production live
- Push pe `main` branch → Preview URL

Fără a trebui să faci nimic! ✨

---

## 📱 Testare pe Mobile

Mergi pe linkul Vercel din telefonul tău și verifica:
- ✅ Layout responsive
- ✅ Tasks funcționează
- ✅ Calendar se vede bine
- ✅ Limba se schimbă

---

## ❌ Troubleshooting

### Deploy Failed?

```
Cauze comune:
1. Build error - Vercel va arăta logul exact
2. Node version mismatch - Vercel folosește Node 18+
3. Missing dependencies - Vercel rulează npm install

Soluție: Check build log în dashboard Vercel
```

### App nu se încarcă?

1. Refresh pagina (Ctrl+F5)
2. Clear cache (DevTools → Application → Clear Storage)
3. Asteptă 2-3 minute (CDN se propagă)

### localStorage nu funcționează?

Ar trebui să funcționeze pe Vercel. Verifica:
1. Browser DevTools → Application → Storage
2. Nu ești în Private/Incognito mode
3. Browser permite localStorage

---

## 📈 Monitoring

### Vercel Dashboard
- **Deployments**: Istoric all deployment-urilor
- **Analytics**: Performance metrics
- **Logs**: Errors și warnings
- **Functions**: Serverless functions (dacă vrei API)

---

## 🔐 Securitate

### Vercel Oferă
- ✅ HTTPS automat (SSL gratuit)
- ✅ DDoS protection
- ✅ WAF (Web Application Firewall)
- ✅ Auto-scaling

---

## 💰 Pricing

**FREE tier (perfect pentru tine)**:
- ✅ Deploy nelimitate
- ✅ Custom domains
- ✅ HTTPS
- ✅ Analytics
- ✅ 100GB bandwidth/lună
- ✅ Suport comunitate

---

## 📌 Passo dopo passo cu Screenshots

### Step 1: Vercel Home
```
https://vercel.com
Click "New Project" (buton verde)
```

### Step 2: Import Git
```
Selectează GitHub
Autentifică-te
```

### Step 3: Select Repository
```
Caută: "blank-canvas-studio"
Click pe repo
```

### Step 4: Configure
```
Lasă setările default
Review environment
```

### Step 5: Deploy
```
Click butonul "Deploy" (albastru mare)
Asteptă spinnerul
```

### Step 6: Success! 🎉
```
Vei vedea: "Congratulations! Your project has been successfully deployed"
Click pe linkul tău pentru a vedea aplicația LIVE
```

---

## 🎯 Următorii Pași

După deploy pe Vercel:

1. **Redenumește repo-ul** (când GitHub se recuperează)
   - Settings → Repository name → `tasks-and-calendar`

2. **Adaugă README cu link**
   ```markdown
   # Tasks & Calendar
   
   Live app: https://tasks-and-calendar.vercel.app
   ```

3. **Setează Production Branch**
   - Vercel Settings → Git → Production Branch → `production`

4. **Activează Auto-Deploy**
   - Vercel va deploy automat pe fiecare push

---

## 📞 Support

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Status**: https://www.vercelstatus.com/
- **Community**: https://discord.gg/vercel

---

## ✅ Checklist Deploy

- [ ] Repository pe GitHub
- [ ] Codul compilează local (`npm run build`)
- [ ] Mergi pe vercel.com
- [ ] Conectezi GitHub
- [ ] Selectezi repository
- [ ] Apesi Deploy
- [ ] Astepți 60 secunde
- [ ] Testezi aplicația pe link-ul Vercel
- [ ] Verifici Tasks și Calendar pe mobile
- [ ] Verifici ambele limbi (EN/RO)

**Felicitări! Aplicația ta este LIVE! 🚀**
