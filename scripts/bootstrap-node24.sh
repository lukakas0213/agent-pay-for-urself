#!/usr/bin/env bash

set -euo pipefail

NODE_VERSION="${NODE_VERSION:-24.18.0}"
PNPM_VERSION="${PNPM_VERSION:-9.15.9}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOOLS_DIR="$ROOT_DIR/.local-tools"

case "$(uname -m)" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

NODE_DIR="$TOOLS_DIR/node-v${NODE_VERSION}-linux-${ARCH}"
NODE_TARBALL="node-v${NODE_VERSION}-linux-${ARCH}.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"

mkdir -p "$TOOLS_DIR/bin" "$TOOLS_DIR/corepack"

if [ ! -x "$NODE_DIR/bin/node" ]; then
  curl -fsSL "$NODE_URL" -o "$TOOLS_DIR/$NODE_TARBALL"
  tar -xJf "$TOOLS_DIR/$NODE_TARBALL" -C "$TOOLS_DIR"
  rm -f "$TOOLS_DIR/$NODE_TARBALL"
fi

"$NODE_DIR/bin/corepack" enable --install-directory "$TOOLS_DIR/bin"
COREPACK_HOME="$TOOLS_DIR/corepack" \
  "$NODE_DIR/bin/corepack" prepare "pnpm@${PNPM_VERSION}" --activate

cat <<OUT
Local toolchain is ready.

Use this in the current shell:
export PATH="$ROOT_DIR/.local-tools/bin:$NODE_DIR/bin:\$PATH"

Then run:
pnpm install
OUT
