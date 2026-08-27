#!/usr/bin/env bash
# Build the PWA and rsync it to the host configured in .env.
#
#   ./scripts/deploy.sh              # bump patch version, build, deploy
#   ./scripts/deploy.sh --no-bump    # deploy the current version as-is
#   ./scripts/deploy.sh --dry-run    # show what rsync would transfer
#   ./scripts/deploy.sh minor        # bump minor instead of patch
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"

BUMP="patch"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --no-bump)          BUMP="" ;;
    --dry-run)          DRY_RUN=1 ;;
    patch|minor|major)  BUMP="$arg" ;;
    *) echo "Unknown argument: $arg" >&2; exit 1 ;;
  esac
done

if [ ! -f .env ]; then
  echo "No .env found. Copy .env.example to .env and fill in DEPLOY_HOST/DEPLOY_PATH." >&2
  exit 1
fi
# shellcheck disable=SC1091
set -a; . ./.env; set +a

: "${DEPLOY_HOST:?DEPLOY_HOST is not set in .env}"
: "${DEPLOY_PATH:?DEPLOY_PATH is not set in .env}"
DEPLOY_DELETE="${DEPLOY_DELETE:-1}"

if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 >/dev/null 2>&1 || true
fi

# Refuse to ship a dirty tree: the deployed build should be reproducible from
# a commit. --dry-run is exempt so you can preview at any time.
if [ "$DRY_RUN" -eq 0 ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "Working tree is dirty — commit or stash before deploying." >&2
  git status --short >&2
  exit 1
fi

if [ -n "$BUMP" ] && [ "$DRY_RUN" -eq 0 ]; then
  echo "==> Bumping version ($BUMP)"
  yarn node scripts/bump-version.mjs "$BUMP"
fi

VERSION="$(node -p "require('./package.json').version")"

# The privacy policy is a Play Console requirement and ships with the site.
echo
echo "==> Rendering privacy policy"
yarn node scripts/gen-privacy.mjs

echo
echo "==> Building $VERSION"
yarn build

# A PWA that 404s its own service worker is worse than one that never had it.
for required in dist/index.html dist/sw.js dist/manifest.webmanifest dist/privacy/index.html; do
  [ -f "$required" ] || { echo "Build incomplete: $required is missing." >&2; exit 1; }
done

RSYNC_ARGS=(-rlptz --human-readable --checksum)
[ "$DEPLOY_DELETE" = "1" ] && RSYNC_ARGS+=(--delete)
[ "$DRY_RUN" -eq 1 ] && RSYNC_ARGS+=(--dry-run --itemize-changes)
[ -n "${DEPLOY_PORT:-}" ] && RSYNC_ARGS+=(-e "ssh -p ${DEPLOY_PORT}")
# shellcheck disable=SC2206
[ -n "${DEPLOY_RSYNC_OPTS:-}" ] && RSYNC_ARGS+=(${DEPLOY_RSYNC_OPTS})

echo
echo "==> Syncing to ${DEPLOY_HOST}:${DEPLOY_PATH}"
# Trailing slash on the source: copy the CONTENTS of dist/, not dist itself.
rsync "${RSYNC_ARGS[@]}" dist/ "${DEPLOY_HOST}:${DEPLOY_PATH}/"

if [ "$DRY_RUN" -eq 1 ]; then
  echo
  echo "Dry run — nothing was transferred."
  exit 0
fi

if [ -n "$BUMP" ]; then
  git -C "$ROOT" add package.json
  git -C "$ROOT" commit -q -m "chore(release): v${VERSION}"
  echo "Committed chore(release): v${VERSION}"
fi

echo
echo "Deployed ${VERSION}${DEPLOY_URL:+ → $DEPLOY_URL}"
