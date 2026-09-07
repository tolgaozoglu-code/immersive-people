# Immersive People — Website + CMS

Eleventy (statik site) + Decap CMS. Tüm içerik `/admin` panelinden düzenlenir, her kayıt Git commit'i olarak siteye otomatik yansır. Backend ve veritabanı yok, Netlify free plan yeterli.

## Yayına alma (Cloudflare Pages)

Site Cloudflare Pages'te barınır, panel girişi GitHub hesabıyla yapılır. Ücretsiz plan yeterlidir.

### 1. GitHub OAuth uygulaması (panel girişi için)
GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
- Application name: `Immersive People CMS`
- Homepage URL: sitenin adresi (örn. `https://immersivepeople.co`)
- Authorization callback URL: `https://immersivepeople.co/api/callback`

Kaydet, **Client ID**'yi kopyala, **Generate a new client secret** ile bir secret üret ve kopyala.
Not: Site adresi değişirse (önce pages.dev, sonra alan adı) callback URL'i güncelle veya ikinci bir OAuth App aç.

### 2. Cloudflare Pages projesi
Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → `immersive-people` reposunu seç.
- Framework preset: None
- Build command: `npm run build`
- Build output directory: `_site`
- Environment variables (Production **ve** Preview için ayrı ayrı ekle):
  - `GITHUB_CLIENT_ID` = OAuth App'in Client ID'si
  - `GITHUB_CLIENT_SECRET` = üretilen secret
  - `NODE_VERSION` = `20`

Deploy et. Site `proje-adi.pages.dev` adresinde yayına girer, her `main` push'unda otomatik güncellenir.

### 3. Alan adı
Pages projesi → **Custom domains → Set up a domain** → `immersivepeople.co`.
Alan adı Cloudflare'de değilse verilen CNAME kaydını mevcut DNS panelinize girin; Cloudflare'deyse tek tıkla bağlanır. SSL otomatik gelir. MX kayıtlarına dokunmayın, mail etkilenmez.

### 4. Panel erişimi
`https://SITE/admin` → **Login with GitHub**. Panele girecek herkesin GitHub hesabı olmalı ve repoya yazma yetkisi verilmeli:
GitHub → repo → Settings → Collaborators → Add people (Write yetkisi).

## Görünüm

Varsayılan tema **Black**; panelden Site Settings → Theme ile Black / Light / Warm Color arasında değiştirilebilir. Display font **League Gothic** olarak kilitli (gerekirse `_data/appearance.json`). Hero fotoğrafı panelden Homepage → Hero → Hero Photo ile değiştirilir; hero düzeni sabittir, sadece foto değişir.

## Referans logoları (otomatik)

`scripts/fetch-logos.mjs` her build'de referans logolarını indirir ve References bölümüne yerleştirir. Netlify'da otomatik çalışır, elle iş yok. İndirilemeyen logo metin olarak görünür. Panelden bir referansa "Logo Image" yüklenirse o görsel her şeyin önüne geçer.

## Productions (The Library)

36 prodüksiyon, 8 dünyaya gruplu. Ana sayfada featured 6 kart + dünya chip'leri, /productions/ sayfasında tamamı, her biri /production/slug/ detay sayfası. Her prodüksiyonun kendine has üretilmiş keyart'ı var (assets/keyart/); panelden "Custom Image" yüklenirse keyart'ın yerine geçer. Bölümü tamamen kaldırmak için panelde Homepage → "Show Productions Section" kapatılır (detay sayfaları URL'de kalır ama siteden link verilmez).

## Panelden neler yönetiliyor

- **Site Settings**: iletişim maili, sosyal linkler, footer.
- **Homepage**: hero metinleri, quick link kartları, Why Partners, client listesi, Collective, kapanış CTA, navigasyon.
- **Insights**: yazı ekle/sil/düzenle, her yazı `/insights/slug/` sayfası olarak yayınlanır.
- **Productions**: 36 kayıt — başlık, tagline, synopsis, dünya, kategori, featured, sıra, görsel.

## Lokal geliştirme

```
npm install
npm start        # http://localhost:8080
```

Not: `/admin` paneli lokalde çalışmaz (Git Gateway canlı Netlify Identity ister). Lokalde denemek için `admin/config.yml` başına geçici olarak `local_backend: true` ekleyip ayrı terminalde `npx decap-server` çalıştır, yayına almadan önce satırı sil.

## Yapı

```
_data/          site.json, home.json (panelden düzenlenen JSON'lar)
_includes/      base.njk, insight.njk (şablonlar)
content/        insights/, work/ (koleksiyonlar, markdown)
admin/          Decap CMS panel + config.yml
assets/css/     style.css (3 tema + 3 font CSS variable ile)
index.njk       ana sayfa
```
