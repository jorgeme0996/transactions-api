#!/usr/bin/env bash
set -euo pipefail

# Instala threagile de forma nativa (sin Docker).
#
# Por qué no Docker: la imagen threagile/threagile solo publica linux/amd64 y
# falla al emularse en Mac con Apple Silicon (ver README, sección Threagile).
#
# Por qué no basta "go install": el binario oficial (v0.9.1) depende de tres
# cosas que "go install" no provee y que en la imagen Docker sí vienen incluidas:
#   1. Un plugin nativo (.so) para el cálculo de RAA (Relative Attacker
#      Attractiveness), que go install no construye.
#   2. Los scripts render-data-flow-diagram.sh / render-data-asset-diagram.sh
#      (wrappers de `dot` de Graphviz) para generar los diagramas.
#   3. La ruta de archivos temporales está fijada en el código fuente a
#      /dev/shm, que no existe en macOS (sí en Linux). Se parchea a /tmp.
#   4. La plantilla background.pdf usada para el reporte en PDF.
#
# Este script deja todo instalado en ~/.threagile y ~/go/bin/threagile.

THREAGILE_VERSION="v0.9.1"
INSTALL_DIR="$HOME/.threagile"
BUILD_DIR="$(mktemp -d)"
trap 'rm -rf "$BUILD_DIR"' EXIT

command -v brew >/dev/null 2>&1 || { echo "Este script requiere Homebrew."; exit 1; }

echo "==> Instalando dependencias (go, graphviz)..."
brew list go >/dev/null 2>&1 || brew install go
brew list graphviz >/dev/null 2>&1 || brew install graphviz

echo "==> Instalando threagile ${THREAGILE_VERSION} vía go install..."
GOBIN="$HOME/go/bin" go install "github.com/threagile/threagile@${THREAGILE_VERSION}"

echo "==> Preparando fuente parchada para compilar el plugin RAA..."
mkdir -p "$BUILD_DIR/mod"
cd "$BUILD_DIR/mod"
go mod init threagile-build >/dev/null
go get "github.com/threagile/threagile@${THREAGILE_VERSION}" >/dev/null

SRC_CACHE="$(go env GOPATH)/pkg/mod/github.com/threagile/threagile@${THREAGILE_VERSION}"
PATCHED_SRC="$BUILD_DIR/threagile-src"
cp -R "$SRC_CACHE" "$PATCHED_SRC"
chmod -R u+w "$PATCHED_SRC"

# /dev/shm no existe en macOS; en Linux también funciona apuntando a /tmp.
sed -i.bak 's#const TempFolder = "/dev/shm"#const TempFolder = "/tmp"#' "$PATCHED_SRC/model/types.go"

echo "==> Compilando threagile (parchado) y el plugin RAA..."
cd "$PATCHED_SRC"
go build -o "$HOME/go/bin/threagile" .
go build -buildmode=plugin -o "$INSTALL_DIR/raa.so" ./raa/raa

echo "==> Instalando scripts de render y plantilla de fondo..."
mkdir -p "$INSTALL_DIR"
# -f: los archivos fuente en el cache de módulos de Go son de solo lectura, y ese
# permiso se copia con ellos; -f fuerza a reemplazar el destino si ya existe de
# una corrida anterior y quedó sin permiso de escritura.
cp -f "$SRC_CACHE/support/render-data-flow-diagram.sh" "$INSTALL_DIR/"
cp -f "$SRC_CACHE/support/render-data-asset-diagram.sh" "$INSTALL_DIR/"
cp -f "$SRC_CACHE/report/template/background.pdf" "$INSTALL_DIR/"
chmod u+w,+x "$INSTALL_DIR"/render-*.sh
chmod u+w "$INSTALL_DIR/background.pdf"

echo
echo "Listo. Agrega esto a tu shell si no está ya:"
echo '  export PATH="$HOME/.threagile:$HOME/go/bin:$PATH"'
echo
echo "Genera el reporte con:"
echo "  threagile -verbose -model docs/threat-model/threagile.yml -output docs/threat-model/report -raa-plugin \$HOME/.threagile/raa.so -background \$HOME/.threagile/background.pdf"
