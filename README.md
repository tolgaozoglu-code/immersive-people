# Immersive People — Website + CMS

Eleventy (statik site) + Decap CMS. Tüm içerik `/admin` panelinden düzenlenir, her kayıt Git commit'i olarak siteye otomatik yansır. Backend ve veritabanı yok, Netlify free plan yeterli.

## Yayına alma (Netlify)

1. Bu klasörü bir GitHub reposuna push et (branch adı `main` olmalı, `admin/config.yml` buna ayarlı).
2. Netlify → **Add new site → Import an existing project** → repoyu seç. Build ayarları `netlify.toml`'dan otomatik gelir (build: `npm run build`, publish: `_site`). Deploy et.
3. Netlify site panelinde **Site configuration → Identity → Enable Identity**.
4. Identity → **Registration**: "Invite only" seç.
5. Identity → **Services → Git Gateway → Enable Git Gateway**.
6. Identity → **Invite users** ile içerik girecek kişilerin mailini davet et. Davet maili linki siteye düşer, şifre belirlenir.
7. Panel: `https://SITE-ADRESI/admin/`

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
