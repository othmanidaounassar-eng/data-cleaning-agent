#!/usr/bin/env bash
# ---------------------------------------------------------------
# OQZARO – Oracle Cloud deployment script
# Run ONCE on the OCI Ubuntu VM as root / sudo.
# ---------------------------------------------------------------
set -euo pipefail

PROJECT_DIR="/opt/oqzaro"
GITHUB_REPO="https://github.com/othmanidaounassar-eng/data-cleaning-agent.git"
COMPOSE_FILE="docker-compose.yml"

echo "=============================="
echo "  OQZARO Oracle Cloud Deploy"
echo "=============================="

# ---- 1. System dependencies ----
echo "[1/6] Installing Docker & Docker Compose..."
apt-get update -qq
apt-get install -y -qq curl git ufw

if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
fi
systemctl enable docker && systemctl start docker

if ! docker compose version &>/dev/null; then
    echo "Installing Docker Compose plugin..."
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
        -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
fi

echo "  Docker: $(docker --version)"
echo "  Compose: $(docker compose version)"

# ---- 2. UFW firewall ----
echo "[2/6] Configuring firewall..."
ufw allow 22/tcp   >/dev/null 2>&1 || true
ufw allow 80/tcp   >/dev/null 2>&1 || true
ufw allow 443/tcp  >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

# ---- 3. Clone / pull project ----
echo "[3/6] Fetching project..."
if [ -d "$PROJECT_DIR/.git" ]; then
    cd "$PROJECT_DIR"
    git pull --ff-only || true
else
    rm -rf "$PROJECT_DIR"
    git clone "$GITHUB_REPO" "$PROJECT_DIR"
    cd "$PROJECT_DIR"
fi

# ---- 4. Environment file ----
echo "[4/6] Preparing .env..."
if [ ! -f .env ]; then
    cp .env.oracle.example .env
    # Generate a random SECRET_KEY if not set
    if grep -q "CHANGE_ME" .env 2>/dev/null; then
        NEW_KEY=$(openssl rand -hex 32)
        sed -i "s/CHANGE_ME_TO_RANDOM_64_CHARS/$NEW_KEY/" .env
    fi
    echo ""
    echo "  *** .env created from template. Edit it now: ***"
    echo "      nano $PROJECT_DIR/.env"
    echo ""
    echo "  Required: GROQ_API_KEY"
    echo "  Optional: TELEGRAM_BOT_TOKEN, SITE_DOMAIN"
    echo ""
fi

# ---- Safety checks ----
echo "[4b/6] Verifying secrets..."
if grep -q "CHANGE_ME" .env 2>/dev/null; then
    echo "  ❌ ERROR: .env still contains placeholders (CHANGE_ME)."
    echo "     Set a real SECRET_KEY before deploying."
    exit 1
fi
if grep -qE "^GROQ_API_KEY=[\"']?$" .env 2>/dev/null; then
    echo "  ⚠️  WARNING: GROQ_API_KEY is empty."
    echo "      Generate a key at https://console.groq.com/keys and update .env."
    echo "      The backend will run in fallback (no-AI) mode until a valid key is set."
fi
if ! grep -qE "^GROQ_API_KEY=[\"']?gsk_[A-Za-z0-9_-]+[\"']?$" .env 2>/dev/null; then
    echo "  ⚠️  WARNING: GROQ_API_KEY does not look like a valid gsk_ key."
    echo "      The backend will run in fallback (no-AI) mode until a valid key is set."
fi

# ---- 5. Build and start ----
echo "[5/6] Building and starting containers..."
docker compose -f "$COMPOSE_FILE" build --no-cache
docker compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "[6/6] Waiting for backend health..."
for i in $(seq 1 30); do
    if docker exec oqzaro-backend curl -sf http://localhost:8000/health >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

# ---- Done ----
PUBLIC_IP=$(curl -s http://169.254.169.254/opc/v1/instance/metadata/public_ip 2>/dev/null || echo "YOUR_PUBLIC_IP")

echo ""
echo "=============================="
echo "  DEPLOYMENT COMPLETE"
echo "=============================="
echo ""
echo "  Frontend:  http://$PUBLIC_IP"
echo "  Backend:   http://$PUBLIC_IP:8000/docs"
echo "  Health:    http://$PUBLIC_IP/health"
echo ""
echo "  To view logs:"
echo "    docker compose -f $COMPOSE_FILE logs -f"
echo ""
echo "  To update (after git pull):"
echo "    cd $PROJECT_DIR && docker compose up -d --build"
echo ""
