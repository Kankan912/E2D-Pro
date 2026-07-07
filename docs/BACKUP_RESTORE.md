# Backup & Restore Procedure — E2D Connect Gateway

> **Audit Fix #22 / P2** — Documented and testable backup/restore.

## 1. Supabase managed backups (automatic)

Supabase provides **Point-in-Time Recovery (PITR)** on Pro plan and above:

- **Frequency:** continuous WAL archiving (every ~5 min).
- **Retention:** 7 days (Pro), 30 days (Team/Enterprise).
- **Recovery point:** any timestamp within retention window.

### Trigger a restore (PITR)

```bash
# Via Supabase CLI
supabase db restore --point-in-time "2026-07-20T10:30:00Z"

# Or via dashboard: Project → Database → Backups → Restore
```

## 2. Manual logical backup (daily cron)

A GitHub Actions cron job runs nightly and dumps the DB to a compressed SQL file stored in a private S3-compatible bucket.

```yaml
# .github/workflows/backup.yml
name: Daily backup
on:
  schedule:
    - cron: "0 2 * * *"  # 02:00 UTC daily
  workflow_dispatch:
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - name: pg_dump
        run: |
          PGPASSWORD=${{ secrets.DB_PASSWORD }} pg_dump \
            --host ${{ secrets.DB_HOST }} \
            --username ${{ secrets.DB_USER }} \
            --dbname postgres \
            --format=custom \
            --compress=9 \
            --file=e2d-backup-$(date +%Y%m%d).dump
      - name: Upload to S3
        run: aws s3 cp e2d-backup-*.dump s3://${{ secrets.BACKUP_BUCKET }}/$(date +%Y/%m/%d)/
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## 3. Storage buckets backup

The 5 buckets (`members-photos`, `justificatifs`, `match-medias`, `site-images`, `donations`) are backed up via `supabase storage` CLI:

```bash
for bucket in members-photos justificatifs match-medias site-images donations; do
  supabase storage cp -r "$bucket" "./backup/$bucket" --recursive
done
```

## 4. Restore procedure (tested monthly on staging)

### 4.1 Logical restore (from `.dump`)

```bash
# 1. Create a fresh staging DB
supabase db reset --linked

# 2. Restore
pg_restore --host $DB_HOST --username $DB_USER --dbname postgres \
  --clean --if-exists --jobs=4 e2d-backup-20260720.dump

# 3. Verify row counts
psql -c "SELECT 'membres', count(*) FROM membres UNION ALL
         SELECT 'cotisations', count(*) FROM cotisations UNION ALL
         SELECT 'prets', count(*) FROM prets;"
```

### 4.2 PITR restore (production incident)

1. Open Supabase dashboard → Project → Database → Backups.
2. Click "Restore" → choose timestamp.
3. Confirm. The cluster is restored to a NEW instance (the original is preserved).
4. Update DNS / app env to point to the new instance.
5. Verify health: `curl https://api.e2d.../functions/health`.

## 5. Restore testing (monthly)

- **Frequency:** first Monday of each month, on staging.
- **Owner:** DevOps Lead.
- **Procedure:** restore the latest daily backup to staging, run smoke tests, verify row counts match production (±5%).
- **Sign-off:** recorded in `docs/BACKUP_TEST_LOG.md`.

## 6. Retention policy

| Backup type | Retention | Storage |
|---|---|---|
| PITR (Supabase) | 7-30 days | Supabase managed |
| Daily logical dump | 90 days | S3 (Glacier after 30d) |
| Weekly snapshot | 1 year | S3 Glacier Deep Archive |
| Storage buckets | 90 days | S3 |

## 7. RPO / RTO objectives

- **RPO (Recovery Point Objective):** ≤ 5 minutes (PITR).
- **RTO (Recovery Time Objective):** ≤ 1 hour (logical restore) / ≤ 15 min (PITR).
