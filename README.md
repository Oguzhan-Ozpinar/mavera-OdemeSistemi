# Mavera Bagis ve Odeme Sistemi

Mobil odakli, headless bagis ve odeme MVP'si. Next.js arayuzu, Nkolay POS odeme/taksit/tekrarli odeme servisleri ve PocketBase islem kayitlari birlikte calisir.

## Hizli Kurulum

```bash
npm install
cp .env.example .env
npm run dev
```

Yerel adres: `http://localhost:3000`

Admin paneli: `http://localhost:3000/admin`

Varsayilan admin:

- Kullanici adi: `admin`
- Sifre: `admin123`

Production'da `ADMIN_USERNAME`, `ADMIN_PASSWORD` ve `ADMIN_SESSION_SECRET` mutlaka degistirilmelidir.

## Tek Docker Compose Kurulumu

Coolify ve production icin onerilen kurulum budur. Tek compose ile hem Next.js uygulamasi hem PocketBase kurulur.

```bash
cp .env.example .env
docker compose up -d --build
```

Servisler:

- `web`: Next.js uygulamasi, varsayilan port `3000`
- `pocketbase`: PocketBase, varsayilan port `8090`
- `pocketbase_data`: PocketBase verileri icin kalici volume

PocketBase ilk acilista otomatik superuser olusturur veya mevcut kullanicinin sifresini gunceller:

```bash
POCKETBASE_SUPERUSER_EMAIL=admin@example.com
POCKETBASE_SUPERUSER_PASSWORD=change-this-pocketbase-password
```

Next.js uygulamasi PocketBase'e internal Docker network uzerinden baglanir:

```bash
POCKETBASE_URL=http://pocketbase:8090
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=change-this-pocketbase-password
```

PocketBase koleksiyonlari `pb_migrations` icinden otomatik olusturulur:

- `donors`
- `transactions`
- `subscriptions`
- `payment_events`
- `iban_accounts`

PocketBase paneli:

```text
http://DOMAIN:8090/_/
```

Coolify'da PocketBase portunu disariya acmak istemezseniz `POCKETBASE_PORT` yayinini kaldirabilir veya sadece internal erisimde birakabilirsiniz. App icin internal `http://pocketbase:8090` yeterlidir.

## Nkolay Panelinden Alinacak Bilgiler

Nkolay canli panelinde su adrese gidin:

```text
https://paynkolay.nkolayislem.com.tr/Settings/IntegrationInformation
```

Sayfada `Entegrasyon Bilgileri` basligi altinda dort deger bulunur. Her satirda sagdaki `Goster` butonuna basip degeri kopyalayin.

1. Token (sx) Degeri
   - Ekrandaki aciklama: Odeme ve diger API cagrilarinda kimlik dogrulama amaciyla kullanilir.
   - `.env` alanlari:
     - `NKOLAY_SX`
   - Bu deger odeme, taksit sorgusu ve tekrarli odeme talimati icin kullanilir.

2. Iptal/Iade Degeri
   - Ekrandaki aciklama: Gerceklesmis bir odeme islemini iptal/iade etmek icin kullanilan dogrulama degeridir.
   - `.env` alanlari:
     - `NKOLAY_SX_CANCEL`
   - Simdiki MVP'de normal odeme iptal/iade ekrani yok; ileride CancelRefundPayment icin kullanilir.

3. Islem Listeleme Degeri
   - Ekrandaki aciklama: Gecmis odeme islemlerini sorgulamak, listelemek ve mutabakat icin kullanilan dogrulama degeridir.
   - `.env` alanlari:
     - `NKOLAY_SX_LIST`
   - Mutabakat, raporlama ve listeleme servisleri icin saklanir.

4. Merchant Secret Key
   - Ekrandaki aciklama: Tum API islemlerinde kullanilan gizli anahtardir.
   - `.env` alanlari:
     - `NKOLAY_SECRET_KEY`
   - Bu deger sadece server tarafinda tutulur, tarayiciya gonderilmez.

Ayrica Nkolay panelinde veya destek ekibiyle su bilgileri dogrulayin:

- `MerchantCustomerNo` / alt uye is yeri numarasi varsa `NKOLAY_MERCHANT_CUSTOMER_NO` alanina yazin.
- Test ortaminda `NKOLAY_BASE_URL=https://paynkolaytest.nkolayislem.com.tr` kullanilir.
- Canli ortamda `NKOLAY_BASE_URL=https://paynkolay.nkolayislem.com.tr` veya Nkolay'in verdigi canli API base URL olmalidir.
- Taksit sorgu, Payment API ve RecurringPaymentCreate/List/Cancel yetkilerinin aktif oldugunu teyit edin.

Nkolay destek ekibine soyle iletilebilir:

```text
Next.js server-side entegrasyon icin Settings > IntegrationInformation sayfasindaki su bilgileri alinacak:
- Token (sx) Degeri
- Iptal/Iade Degeri
- Islem Listeleme Degeri
- Merchant Secret Key

Ayrica su yetkilerin aktif olmasini rica ediyoruz:
- Payment API
- PaymentInstallments API
- RecurringPaymentCreate/List/Cancel API
- 3D callback success/fail URL izinleri
```

Canli callback URL'leri:

```text
https://DOMAIN/api/nkolay/callback/success
https://DOMAIN/api/nkolay/callback/fail
```

## Environment

Temel alanlar:

```bash
NEXT_PUBLIC_SITE_URL=https://DOMAIN
NEXT_PUBLIC_BRAND_NAME=Mavera
NEXT_PUBLIC_BRAND_LOGO_URL=https://DOMAIN/logo.png
NEXT_PUBLIC_BRAND_COLOR=#047857

NKOLAY_BASE_URL=https://paynkolaytest.nkolayislem.com.tr
NKOLAY_SX=
NKOLAY_SX_LIST=
NKOLAY_SX_CANCEL=
NKOLAY_SECRET_KEY=
NKOLAY_MERCHANT_CUSTOMER_NO=
NKOLAY_CURRENCY_NUMBER=949
NKOLAY_DEFAULT_INSTALMENTS=12

POCKETBASE_URL=http://pocketbase:8090
POCKETBASE_ADMIN_TOKEN=
POCKETBASE_ADMIN_EMAIL=admin@example.com
POCKETBASE_ADMIN_PASSWORD=change-this-pocketbase-password
POCKETBASE_SUPERUSER_EMAIL=admin@example.com
POCKETBASE_SUPERUSER_PASSWORD=change-this-pocketbase-password
POCKETBASE_VERSION=0.38.0
POCKETBASE_PORT=8090
WEB_PORT=3000

TURNSTILE_SECRET_KEY=
CRON_SECRET=
ADMIN_EXPORT_TOKEN=
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
ADMIN_SESSION_SECRET=
```

Nkolay endpoint env'leri `.env.example` icinde hazir gelir. Nkolay farkli path vermezse degistirmeyin.

## Nkolay Akisi

Odeme akisi dogrudan Nkolay API'leri ile calisir:

- Taksit sorgusu: `NKOLAY_INSTALLMENTS_ENDPOINT`
- Odeme: `NKOLAY_PAYMENT_ENDPOINT`
- Tekrarli odeme talimati: `NKOLAY_RECURRING_CREATE_ENDPOINT`
- Tekrarli odeme mutabakati: `NKOLAY_RECURRING_LIST_ENDPOINT`
- Tekrarli odeme iptali: `NKOLAY_RECURRING_CANCEL_ENDPOINT`

Taksit akisi:

1. Kartin ilk 8 hanesi girilince `/api/donations/installments` calisir.
2. Server Nkolay `PaymentInstallments` servisine gider.
3. Donen `EncodedValue` ve taksit sayisi UI'da listelenir.
4. Odeme sirasinda secili taksit `installmentNo` ve `EncodedValue` ile Nkolay'a gonderilir.

Nkolay hosted form dokumanindaki `instalments` alani `NKOLAY_DEFAULT_INSTALMENTS=12` ile korunur. API odemede secili taksit ayrica `installmentNo` ve `EncodedValue` ile gonderilir.

Tekrarli odeme:

- Nkolay dokumanina gore `Instalment` en fazla 12 olabilir.
- `InstalmentPeriod` 30 gun olarak gonderilir.
- Bu nedenle canli tekrarli odeme aylik calisir.
- Admin panelinden talimat iptal edilebilir.

## PocketBase

PocketBase compose icinde `pocketbase` servisi olarak calisir. Koleksiyonlar `pb_migrations` ile otomatik olusturulur. Koleksiyon detaylari:

```text
docs/pocketbase-collections.md
```

Ana koleksiyonlar:

- `donors`
- `transactions`
- `subscriptions`
- `payment_events`
- `iban_accounts`

Kart numarasi ve CVV PocketBase'e yazilmaz.

## Admin Paneli

Admin paneli linklenmez; dogrudan `/admin` yazilarak acilir.

Panelde:

- Bugun tamamlanan toplam
- Bu ay tamamlanan toplam
- Basarisiz odeme sayisi
- Tekrarli odeme sayisi
- Odeme durumlari
- Nkolay hata kodlari ve mesajlari
- Taksit sayisi
- Bagis notu
- Nkolay event loglari
- CSV indirme
- Tekrarli odeme iptali

CSV:

```bash
curl https://DOMAIN/api/admin/transactions.csv \
  -H "Authorization: Bearer $ADMIN_EXPORT_TOKEN" \
  -o mavera-transactions.csv
```

Admin panelinden indirirken token gerekmez; admin cookie yeterlidir.

## Marka ve Link Parametreleri

`.env` icinden `NEXT_PUBLIC_BRAND_NAME`, `NEXT_PUBLIC_BRAND_LOGO_URL` ve `NEXT_PUBLIC_BRAND_COLOR` degerleriyle logo, kullanici/dernek adi ve tek renkli tema degistirilebilir.

Bagis linkleri tutar ve notu otomatik doldurabilir:

- `?t=100` tutari 100 TL doldurur, kullanici degistirebilir.
- `?kt=100` tutari 100 TL doldurur ve kilitler.
- `?n=kurban` notu doldurur, kullanici degistirebilir.
- `?kn=kurban` notu doldurur ve kilitler.

Ornek:

```text
https://DOMAIN/?kt=1000&kn=kurban
```

## Coolify

Bu repo tek `docker-compose.yml` ile deploy edilecek sekilde hazirlandi.

Coolify ayarlari:

- Build pack: Docker Compose
- Compose file: `docker-compose.yml`
- App port: `3000`
- Environment: `.env.example` alanlarini doldurun.
- PocketBase volume: `pocketbase_data`
- PocketBase admin paneli gerekiyorsa `8090` portunu yayinlayin.

Cron icin Coolify scheduled task:

```bash
curl -X POST https://DOMAIN/api/cron/reconcile \
  -H "Authorization: Bearer $CRON_SECRET"
```

Onerilen siklik: gunde 1 kez.

## Test

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Bu local ortamda `.next` cache izin sorunu olursa alternatif build klasoruyle test edilebilir:

```bash
NEXT_DIST_DIR=.next-verify npm run build
```

## Guvenlik Notlari

- Kart numarasi ve CVV PocketBase veya uygulama loglarina yazilmaz.
- Nkolay ve PocketBase anahtarlari sadece server-side environment degiskenlerinde tutulur.
- Yurt disi kartlarda 2D cekim sadece `ENABLE_FOREIGN_CARD_2D=true` ise ve kullanici checkbox'i isaretlediyse aktif olur.
- Production'da `TURNSTILE_SECRET_KEY`, `CRON_SECRET`, `ADMIN_EXPORT_TOKEN`, `ADMIN_SESSION_SECRET` ve admin sifresi bos/varsayilan birakilmamalidir.
