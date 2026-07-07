# 🚀 Démarrage en local — E2D Connect Gateway v4.0 (Multi-Association)

## Quick Start (3 étapes)

### Étape 1 — Installer
```bash
bun install
```

### Étape 2 — Exécuter la migration SQL
1. Va sur https://supabase.com/dashboard
2. Sélectionne ton projet
3. Menu gauche → SQL Editor
4. Ouvre `migrations_a_executer/E2D_TOUT_EN_UN.sql` dans VS Code
5. Sélectionne tout (Ctrl+A) → Copie (Ctrl+C)
6. Colle dans le SQL Editor (Ctrl+V)
7. Clique Run
8. Résultat attendu : "Success" + 12+ fonctions créées

### Étape 3 — Démarrer
```bash
bun run dev
```

Ouvre http://localhost:8080 dans ton navigateur.

## Gestion Multi-Association

### Pour le super_admin
- Un sélecteur d'association apparaît dans le header du dashboard
- Sélectionner une association → les données se rafraîchissent
- La sélection est persistée (localStorage)

### Pour les autres rôles
- L'association est déterminée automatiquement par le profil utilisateur
- Aucun switch possible (sécurité)

## En cas de problème

### Page sans style (moche)
```bash
Remove-Item -Recurse -Force node_modules
bun install
bun run dev
```
Puis Ctrl+F5 dans le navigateur.

### Erreur SQL
Copie-colle le message exact.

## Identifiants Supabase
Déjà configurés dans `src/integrations/supabase/client.ts` (hardcodés). Aucun `.env` à créer.

## Documentation
- `CAHIER_DES_CHARGES_PROJET_COMPLET.md` — Cahier des charges v4.0 (multi-association)
- `docs/POST_REVIEW_CHANGES.md` — Changelog des corrections
- `docs/DEPLOYMENT_CHECKLIST.md` — Checklist pré-production
