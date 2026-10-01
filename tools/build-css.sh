#!/usr/bin/env bash
# Rebuilds ../assets/css/site.css from tools/input.css + tailwind.config.js.
# Run it after adding a new Tailwind class to index.html, privacy.html, etc. or to assets/js/site.js.
# Needs Node (via nvm) and an internet connection the first time (it downloads tailwindcss@3).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$HERE/../assets/css/site.css"

# Node lives under nvm on this laptop
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
fi
command -v npx >/dev/null 2>&1 || { echo "build-css.sh: npx not found (install Node, e.g. via nvm)" >&2; exit 1; }

mkdir -p "$(dirname "$OUT")"
cd "$HERE"
TMP="$(mktemp "${TMPDIR:-/tmp}/site-css.XXXXXX")"
trap 'rm -f "$TMP"' EXIT

npx --yes tailwindcss@3 -c "$HERE/tailwind.config.js" -i "$HERE/input.css" -o "$TMP"

# Tailwind's base reset carries explanatory comments with web links. Drop those comments (keep the licence
# banner but without the "https://") so the shipped CSS contains no outside URLs at all.
perl -0pi -e 's{/\*((?:(?!\*/).)*?)\*/}{ my ($all,$b)=($&,$1); $b =~ m{https?://} ? ($b =~ /^\s*!/ ? do { (my $x=$all) =~ s{https?://}{}g; $x } : "") : $all }gse' "$TMP"

# Fail loudly if the result looks wrong
[ -s "$TMP" ] || { echo "build-css.sh: output is empty" >&2; exit 1; }
grep -q 'sage-' "$TMP" || { echo "build-css.sh: expected utilities missing from output (is the content glob finding the pages?)" >&2; exit 1; }

if grep -qE 'https?://' "$TMP"; then echo "build-css.sh: outside URL left in output" >&2; grep -nE 'https?://' "$TMP" | head >&2; exit 1; fi

cp "$TMP" "$OUT"
chmod 644 "$OUT"
echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
