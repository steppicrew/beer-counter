#!/usr/bin/env bash
# Build the Android app.
#
#   ./scripts/build-android.sh            # release .aab (Play Console upload)
#   ./scripts/build-android.sh apk        # release .apk (sideload/testing)
#   ./scripts/build-android.sh debug      # debug .apk
#
# Signing is optional: drop android/keystore.properties in place (see
# android/keystore.properties.example) and the release build is signed.
# Without it Gradle still produces an unsigned artefact.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
TARGET="${1:-bundle}"

# --- toolchain -------------------------------------------------------------
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)"
  fnm use 22 >/dev/null 2>&1 || true
fi

# Gradle 8.11 / AGP 8.7 do not support JDK 25+; prefer an installed JDK 21.
if [ -z "${JAVA_HOME:-}" ] || ! "$JAVA_HOME/bin/java" -version 2>&1 | grep -qE '"(17|21)'; then
  for candidate in /usr/lib/jvm/java-21-openjdk /usr/lib/jvm/java-17-openjdk; do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi
echo "JAVA_HOME=${JAVA_HOME:-<system default>}"
"${JAVA_HOME:-/usr}/bin/java" -version 2>&1 | head -1

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  echo "ANDROID_HOME / ANDROID_SDK_ROOT is not set." >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
VERSION_CODE="$(node -p "require('./package.json').androidVersionCode")"
echo "Building Steppi's Beer Counter ${VERSION} (versionCode ${VERSION_CODE})"

# --- web build -------------------------------------------------------------
echo
echo "==> Building web assets"
yarn build

# .env may override the application id (see ANDROID_APP_ID).
yarn node scripts/sync-app-id.mjs

echo
echo "==> Syncing into the native project"
yarn cap sync android

# Launcher icons are derived from the SVG master, and `cap sync` does not
# touch them — regenerate so an icon change always reaches the APK.
yarn node scripts/gen-assets.mjs >/dev/null

# --- native build ----------------------------------------------------------
echo
case "$TARGET" in
  bundle) GRADLE_TASK="bundleRelease" ;;
  apk)    GRADLE_TASK="assembleRelease" ;;
  debug)  GRADLE_TASK="assembleDebug" ;;
  *)
    echo "Unknown target \"$TARGET\" — use bundle, apk or debug." >&2
    exit 1
    ;;
esac

echo "==> Gradle :app:${GRADLE_TASK}"
(cd android && ./gradlew --no-daemon "app:${GRADLE_TASK}")

# --- collect ---------------------------------------------------------------
# Stale artefacts from an earlier (possibly unsigned) build must not be picked
# up: bundleRelease does not rebuild APKs, so an old one can linger here.
rm -f android/app/build/outputs/apk/release/*.apk.stale
mkdir -p "$ROOT/build-output"
shopt -s nullglob
for artefact in \
  android/app/build/outputs/bundle/release/*.aab \
  android/app/build/outputs/apk/release/*.apk \
  android/app/build/outputs/apk/debug/*.apk
do
  base="$(basename "$artefact")"
  case "$base" in
    *.aab) dest="$ROOT/build-output/beer-counter-${VERSION}.aab" ;;
    *)     dest="$ROOT/build-output/${base}" ;;
  esac
  cp "$artefact" "$dest"
  echo "  → ${dest#"$ROOT"/}  ($(du -h "$dest" | cut -f1))"
done

# --- verify signing --------------------------------------------------------
# Play rejects an unsigned upload, and an unsigned build otherwise fails only
# at the end of a long manual upload.
if [ "$TARGET" != "debug" ]; then
  if [ -f "$ROOT/android/keystore.properties" ]; then
    for artefact in "$ROOT/build-output/beer-counter-${VERSION}.aab"; do
      [ -f "$artefact" ] || continue
      if unzip -l "$artefact" | grep -qiE 'META-INF/.*\.(RSA|DSA|EC)'; then
        echo "  signed: $(basename "$artefact")"
      else
        echo "  ERROR: $(basename "$artefact") is NOT signed." >&2
        exit 1
      fi
    done

    APK="$ROOT/build-output/beer-counter-release-${VERSION}.apk"
    if [ -f "$APK" ] && command -v apksigner >/dev/null 2>&1; then
      if apksigner verify "$APK" >/dev/null 2>&1; then
        echo "  signed: $(basename "$APK")"
      else
        echo "  ERROR: $(basename "$APK") is NOT signed." >&2
        exit 1
      fi
    fi
  else
    echo
    echo "  NOTE: android/keystore.properties is absent — artefacts are UNSIGNED"
    echo "        and Play Console will reject them. See the .example file."
  fi
fi

echo
echo "Done. Release notes for Play Console:"
echo "  yarn release-notes"
