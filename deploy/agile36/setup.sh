#!/usr/bin/env bash
# One-time setup for the Agile36 Buzz team.
# Generates every secret and identity, writes both .env files, starts the
# relay, and registers the whole team as members.
#
# Safe to re-run: it refuses to overwrite an existing .env.

set -euo pipefail
cd "$(dirname "$0")"
AGILE36_DIR=$(pwd)
COMPOSE_DIR="$AGILE36_DIR/../compose"
IMAGE=agile36/buzz-agent:latest

step() { printf '\n\033[1m== %s\033[0m\n' "$*"; }
# The image's entrypoint is buzz-acp, so admin commands must override it.
keygen() { docker run --rm --entrypoint buzz-admin "$IMAGE" generate-key; }
# generate-key output: "Public key:  <hex>" / "Secret key:  <hex>" plus a help
# sentence that must NOT match — anchor to the exact labels.
pub_of() { awk '/^Public key:/ {print $NF}' <<<"$1"; }
sec_of() { awk '/^Secret key:/ {print $NF}' <<<"$1"; }

[ -f "$AGILE36_DIR/.env" ] && { echo "deploy/agile36/.env already exists — remove it to re-run setup."; exit 1; }
[ -f "$COMPOSE_DIR/.env" ] && { echo "deploy/compose/.env already exists — remove it to re-run setup."; exit 1; }

step "Building the agent image (first build compiles Rust — takes a while)"
# Plain docker build: compose would interpolate the whole file and demand
# .env values that don't exist until later in this script.
docker build -f "$AGILE36_DIR/Dockerfile.agents" -t "$IMAGE" "$AGILE36_DIR/../.."

step "Generating identities"
OWNER=$(keygen);  echo "  owner (Deadra)"
RELAY=$(keygen);  echo "  relay signing key"
# Parallel indexed arrays — macOS bash 3.2 has no associative arrays.
ROLES=(chief-of-staff sales developer tester social)
KEYS=()
for role in "${ROLES[@]}"; do
  KEYS+=("$(keygen)"); echo "  $role"
done

step "Writing deploy/compose/.env (relay stack)"
cat > "$COMPOSE_DIR/.env" <<EOF
BUZZ_IMAGE=ghcr.io/block/buzz:main
BUZZ_DOMAIN=localhost
RELAY_URL=ws://localhost:3000
BUZZ_MEDIA_BASE_URL=http://localhost:3000/media
BUZZ_MEDIA_SERVER_DOMAIN=localhost
BUZZ_CORS_ORIGINS=http://localhost:3000

# Local defaults: membership required (closed community), token auth off.
# For a public VPS, turn BUZZ_REQUIRE_AUTH_TOKEN back on.
BUZZ_REQUIRE_AUTH_TOKEN=false
BUZZ_REQUIRE_RELAY_MEMBERSHIP=true
BUZZ_ALLOW_NIP_OA_AUTH=true
BUZZ_AUTO_MIGRATE=true
BUZZ_GIT_CONFORMANCE_PROBE=true
RUST_LOG=buzz_relay=info,buzz_db=info,buzz_auth=info,buzz_pubsub=info,tower_http=info

RELAY_OWNER_PUBKEY=$(pub_of "$OWNER")
BUZZ_RELAY_PRIVATE_KEY=$(sec_of "$RELAY")
BUZZ_GIT_HOOK_HMAC_SECRET=$(openssl rand -hex 32)
POSTGRES_DB=buzz
POSTGRES_USER=buzz
POSTGRES_PASSWORD=$(openssl rand -hex 16)
REDIS_PASSWORD=$(openssl rand -hex 16)
BUZZ_S3_ACCESS_KEY=$(openssl rand -hex 8)
BUZZ_S3_SECRET_KEY=$(openssl rand -hex 16)
BUZZ_S3_BUCKET=buzz-media
BUZZ_HTTP_PORT=3000
EOF

step "Writing deploy/agile36/.env (team)"
{
  echo "# Run 'claude setup-token' on the host and paste the token here:"
  echo "CLAUDE_CODE_OAUTH_TOKEN="
  for i in "${!ROLES[@]}"; do
    var="KEY_$(tr 'a-z-' 'A-Z_' <<<"${ROLES[$i]}")"
    echo "$var=$(sec_of "${KEYS[$i]}")"
  done
} > "$AGILE36_DIR/.env"

step "Saving Deadra's identity → owner-identity.txt (import into the Buzz app, then delete this file)"
printf 'Owner keypair for the Buzz desktop/mobile app:\n%s\n' "$OWNER" > "$AGILE36_DIR/owner-identity.txt"
chmod 600 "$AGILE36_DIR/owner-identity.txt"

step "Starting the relay stack"
( cd "$COMPOSE_DIR" && ./run.sh start )

step "Registering team members on the relay"
source "$COMPOSE_DIR/.env"
# add-member writes straight to Postgres/Redis, then publishes the updated
# membership list signed with the relay key.
register() {
  docker run --rm --network buzz-prod_buzz-net --entrypoint buzz-admin \
    -e DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/$POSTGRES_DB" \
    -e REDIS_URL="redis://:$REDIS_PASSWORD@redis:6379" \
    -e BUZZ_RELAY_PRIVATE_KEY="$BUZZ_RELAY_PRIVATE_KEY" \
    "$IMAGE" add-member --pubkey "$1"
}
register "$(pub_of "$OWNER")"
for i in "${!ROLES[@]}"; do
  register "$(pub_of "${KEYS[$i]}")"
done

step "Done. Next steps"
cat <<'EOF'
  1. claude setup-token        → paste the token into deploy/agile36/.env
  2. docker compose -f compose.agents.yml up -d
  3. Open the Buzz app → Join a community → ws://localhost:3000
     Import your identity from owner-identity.txt, then DELETE that file.
EOF
