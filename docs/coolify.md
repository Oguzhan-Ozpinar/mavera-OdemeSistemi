# Coolify Deploy

## App

- Build pack: Dockerfile
- Port: `3000`
- Healthcheck path: `/`
- Required env values: see `.env.example`

## PocketBase

PocketBase'i ayni project altinda ayri servis olarak yayinlayin. Next.js uygulamasina:

- `POCKETBASE_URL`
- `POCKETBASE_ADMIN_TOKEN`

degerlerini verin.

## Scheduled Task

Coolify scheduled task veya cron:

```bash
curl -X POST "$NEXT_PUBLIC_SITE_URL/api/cron/reconcile" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Onerilen siklik: gunde 1 kez, sabah saatlerinde.

## Admin CSV

```bash
curl "$NEXT_PUBLIC_SITE_URL/api/admin/transactions.csv" \
  -H "Authorization: Bearer $ADMIN_EXPORT_TOKEN" \
  -o mavera-transactions.csv
```
