#!/usr/bin/env bash
# Writes deploy/SHA256SUMS for the files the site serves. Run before tagging a release:
#   bash deploy/make-sums.sh
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
find $(cat deploy/FILES) -type f ! -name '.*' | LC_ALL=C sort | xargs sha256sum > deploy/SHA256SUMS
echo "deploy/SHA256SUMS: $(wc -l < deploy/SHA256SUMS) files"
