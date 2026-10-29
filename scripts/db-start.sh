#!/usr/bin/env bash
# Démarrage de la stack Supabase locale avec les services utiles au projet.
# - realtime ET mailpit INCLUS (suivi temps réel dispatch + capture d'e-mails de dev)
# - storage, studio, analytics… exclus (non utilisés, allourdissent la machine)
set -euo pipefail
cd "$(dirname "$0")/.."

EXCLUSIONS=(
  -x logflare
  -x vector
  -x studio
  -x storage-api
  -x imgproxy
  -x edge-runtime
  -x supavisor
  -x postgres-meta
)

if npx supabase status >/dev/null 2>&1; then
  echo "Stack déjà démarrée — arrêt puis redémarrage pour appliquer les services…"
  npx supabase stop
fi

npx supabase start "${EXCLUSIONS[@]}"
npx supabase status
