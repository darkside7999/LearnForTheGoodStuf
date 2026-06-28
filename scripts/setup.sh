#!/usr/bin/env bash
#
# setup.sh — instala y activa la app en Linux/macOS en un solo paso.
#
#   1) Comprueba que tienes Node 22+ (necesario para node:sqlite).
#   2) Instala las dependencias (npm install).
#   3) Crea el archivo .env y te pide tu ANTHROPIC_API_KEY (se queda SOLO en tu
#      ordenador; no se sube a ningún lado).
#   4) Arranca la app en http://localhost:3001 (y por Tailscale).
#
# Uso:   bash scripts/setup.sh

set -e

cd "$(dirname "$0")/.."   # raíz del proyecto

echo ""
echo "  📰  LearnForTheGoodStuf — instalación"
echo "  -------------------------------------"

# --- 1) Comprobar Node ---------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "  ❌ No encuentro Node.js."
  echo "     Instala Node 22 LTS y vuelve a ejecutar este script."
  echo "     Opción fácil (nvm):"
  echo "       curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
  echo "       export NVM_DIR=\"\$HOME/.nvm\" && . \"\$NVM_DIR/nvm.sh\""
  echo "       nvm install 22 && nvm use 22"
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
echo "  • Node detectado: $(node -v)"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "  ❌ Necesitas Node 22 o superior (tienes la versión $NODE_MAJOR)."
  echo "     Con nvm:  nvm install 22 && nvm use 22"
  exit 1
fi

# Comprobar que node:sqlite está disponible (viene integrado en Node 22+).
if ! node -e "require('node:sqlite')" >/dev/null 2>&1; then
  echo "  ❌ Tu Node no expone 'node:sqlite'. Actualiza a Node 22 LTS más reciente:"
  echo "     nvm install 22 && nvm use 22"
  exit 1
fi
echo "  • node:sqlite disponible ✓"

# --- 2) Instalar dependencias --------------------------------------------------
echo "  • Instalando dependencias (npm install)…"
npm install --no-audit --no-fund

# --- 3) Configurar la clave de IA ---------------------------------------------
if [ -f .env ] && grep -q '^ANTHROPIC_API_KEY=.\+' .env; then
  echo "  • Ya existe .env con una clave. Lo dejo como está."
else
  echo ""
  echo "  Pega tu clave de Anthropic (ANTHROPIC_API_KEY)."
  echo "  La consigues en https://console.anthropic.com/  ·  Empieza por 'sk-ant-...'"
  echo "  (no se mostrará al escribir; se guarda solo en tu archivo .env local)"
  printf "  > Clave: "
  read -r -s APIKEY
  echo ""
  if [ -z "$APIKEY" ]; then
    echo "  ⚠️  No pegaste ninguna clave. Creo .env sin clave: la app arrancará pero"
    echo "      NO generará noticias hasta que la pongas. Puedes editar .env luego."
  fi
  cat > .env <<EOF
# Generado por scripts/setup.sh — este archivo NO se sube a git.
ANTHROPIC_API_KEY=${APIKEY}
PORT=3001
CLAUDE_MODEL=claude-sonnet-4-6
EOF
  echo "  • Archivo .env creado ✓"
fi

# --- 4) Arrancar ---------------------------------------------------------------
echo ""
echo "  ✅ Todo listo. Arrancando…"
echo "     Local:          http://localhost:3001"
echo "     Tailscale:      http://<tu-host-tailscale>:3001"
echo "     (Ctrl+C para parar)"
echo ""
exec npm start
