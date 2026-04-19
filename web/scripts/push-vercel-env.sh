#!/usr/bin/env bash
# Push environment variables from web/.env.local to Vercel project (production).
# Run from web/ directory after `vercel link`.

set -u

ENV_FILE="${1:-.env.local}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ENV file not found: $ENV_FILE"
  exit 1
fi

# Keys to push — NEXT_PUBLIC_* are browser-safe, rest are server-only.
KEYS=(
  KITE_RPC_URL
  PRIVATE_KEY
  OPENROUTER_API_KEY
  OPENROUTER_MODEL
  OPENROUTER_FALLBACK_MODEL
  NEXT_PUBLIC_ATTRIBUTION_LEDGER
  ATTRIBUTION_LEDGER_DEPLOY_BLOCK
  NEXT_PUBLIC_AGENT_OPERATOR_ADDRESS
  NEXT_PUBLIC_ECOSYSTEM_FUND_ADDRESS
  NEXT_PUBLIC_KITE_EXPLORER
  KUTIP_USE_AA
  KUTIP_USE_SEMANTIC_SCHOLAR
  KUTIP_DEMO_MODE
)

while IFS='=' read -r key value; do
  [ -z "$key" ] && continue
  [[ "$key" =~ ^# ]] && continue
  for target in "${KEYS[@]}"; do
    if [ "$key" = "$target" ] && [ -n "$value" ]; then
      # remove & re-add so re-runs update the value
      vercel env rm "$key" production --yes > /dev/null 2>&1 || true
      printf "%s" "$value" | vercel env add "$key" production > /dev/null 2>&1 \
        && echo "+ $key" \
        || echo "! $key (failed)"
      break
    fi
  done
done < "$ENV_FILE"

echo "done."
