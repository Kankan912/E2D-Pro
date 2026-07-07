# Rollback Procedure — E2D Connect Gateway

> **Audit Fix #49 / P2** — Documented rollback for Vercel + Supabase.

## 1. Frontend rollback (Vercel)

### 1.1 Via Vercel dashboard

1. Open project → **Deployments**.
2. Find the last known-good deployment.
3. Click the `...` menu → **Promote to Production**.
4. Confirm. Promotion is instant (CDN cache purge ~30s).

### 1.2 Via Vercel CLI

```bash
# List recent deployments
vercel ls

# Promote a specific deployment to production
vercel promote <deployment-url> --token $VERCEL_TOKEN
```

### 1.3 Via Git revert (preferred for code-level rollback)

```bash
git revert <bad-commit-sha>
git push origin main   # triggers CI → auto-deploy
```

## 2. Database rollback (Supabase migrations)

### 2.1 Reverse the latest migration

Each migration in `supabase/migrations/` should have a documented reverse.
For the remediation migration (`20260722000001_remediation_audit_p0_p1.sql`):

```sql
-- Reverse: drop the objects created by the remediation migration.
BEGIN;
DROP POLICY IF EXISTS "members-photos-insert" ON storage.objects;
DROP POLICY IF EXISTS "members-photos-update" ON storage.objects;
DROP POLICY IF EXISTS "members-photos-delete" ON storage.objects;
DROP POLICY IF EXISTS "members-photos-read" ON storage.objects;
DROP TABLE IF EXISTS public.contact_rate_limits CASCADE;
DROP TABLE IF EXISTS public.secret_configs CASCADE;
DROP TABLE IF EXISTS public.health_checks CASCADE;
-- (restore original policies from prior migration if needed)
COMMIT;
```

### 2.2 PITR restore (critical incident)

See `docs/BACKUP_RESTORE.md` §4.2.

## 3. Edge Functions rollback

```bash
# List deployed functions
supabase functions list

# Re-deploy a previous version from git
git checkout <previous-tag> -- supabase/functions/send-contact-notification/
supabase functions deploy send-contact-notification
```

## 4. Full rollback decision tree

| Incident | Action | RTO |
|---|---|---|
| Frontend bug | Vercel promote previous deploy | < 2 min |
| DB migration broke RLS | Reverse migration SQL | < 15 min |
| Data corruption | PITR restore to new instance | < 30 min |
| Edge function down | Re-deploy previous version | < 5 min |
| Full outage | PITR + redeploy frontend + edge functions | < 1 h |

## 5. Post-rollback checklist

- [ ] Health check returns 200: `curl https://api.../functions/health`
- [ ] Smoke test login flow (admin + member)
- [ ] Smoke test donation form
- [ ] Verify no data loss (row counts vs. pre-incident baseline)
- [ ] Notify stakeholders in Slack channel `#e2d-incidents`
- [ ] Schedule post-mortem within 48h
- [ ] Update `docs/INCIDENT_LOG.md` with timeline + root cause
