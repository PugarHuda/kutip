#!/usr/bin/env bash
# Push all environment variables from web/.env.local to Vercel production.
# The .env.local is authoritative — it's already been filtered by
# `pnpm run env:sync` to only include web-safe keys.
#
# Run from web/ directory after `vercel link` + `vercel login`.

set -u

ENV_FILE="${1:-.env.local}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ENV file not found: $ENV_FILE"
  exit 1
fi

pushed=0
failed=0

# Keys that must be set on Vercel dashboard directly — different values for
# localhost vs production, skip the local overwrite.
SKIP_ON_PROD="NEXT_PUBLIC_SITE_URL ORCID_REDIRECT_URL"

while IFS='=' read -r key value; do
  [ -z "$key" ] && continue
  [[ "$key" =~ ^# ]] && continue
  [ -z "$value" ] && continue
  if [[ " $SKIP_ON_PROD " == *" $key "* ]]; then
    echo "- $key (skipped — set directly on Vercel)"
    continue
  fi

  # remove & re-add so re-runs update the value
  vercel env rm "$key" production --yes > /dev/null 2>&1 || true
  if printf "%s" "$value" | vercel env add "$key" production > /dev/null 2>&1; then
    echo "+ $key"
    pushed=$((pushed + 1))
  else
    echo "! $key (failed)"
    failed=$((failed + 1))
  fi
done < "$ENV_FILE"

echo "done. pushed=$pushed failed=$failed"
