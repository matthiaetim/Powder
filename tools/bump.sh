#!/bin/sh
# Setzt die Versionsnummer in src/constants.js und sw.js. Aufruf: tools/bump.sh 0.2.0
set -e
[ -n "$1" ] || { echo "Aufruf: tools/bump.sh <version>"; exit 1; }
cd "$(dirname "$0")/.."
sed -i '' "s/^export const VERSION = '.*';/export const VERSION = '$1';/" src/constants.js
sed -i '' "s/^const VERSION = '.*';/const VERSION = '$1';/" sw.js
grep -n "VERSION = " src/constants.js sw.js
