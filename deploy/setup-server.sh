#!/bin/bash
# Run this ONCE on your EC2 instance to prepare the server.
# After this, all subsequent deploys happen automatically via GitHub Actions.
set -e

REPO_URL="https://github.com/YOUR_ORG/YOUR_REPO.git"  # update this
APP_DIR="/var/www/ad-astra"

# ── 1. Install Node.js 20 ──────────────────────────────────────
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 2. Install PM2 ────────────────────────────────────────────
echo "Installing PM2..."
sudo npm install -g pm2

# ── 3. Install Nginx ──────────────────────────────────────────
echo "Installing Nginx..."
sudo apt-get update && sudo apt-get install -y nginx

# ── 4. Clone the repository ───────────────────────────────────
echo "Cloning repository..."
sudo mkdir -p "$APP_DIR"
sudo chown "$USER:$USER" "$APP_DIR"
git clone "$REPO_URL" "$APP_DIR"

# ── 5. Create backend .env file ───────────────────────────────
echo "Creating backend .env (edit this with your actual values)..."
cat > "$APP_DIR/backend/.env" <<EOF
PORT=4000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
NODE_ENV=production
EOF

echo ""
echo "⚠️  Edit $APP_DIR/backend/.env with your real DATABASE_URL before continuing."
echo "    Press Enter when done..."
read

# ── 6. Build backend ──────────────────────────────────────────
echo "Building backend..."
cd "$APP_DIR/backend"
npm ci
npm run build
npx prisma generate
npx prisma migrate deploy

# ── 7. Build frontend ─────────────────────────────────────────
echo "Building frontend..."
cd "$APP_DIR"
npm ci
NEXT_PUBLIC_API_URL=https://ad-astra.openschools.space/api npm run build

# ── 8. Start processes with PM2 ───────────────────────────────
echo "Starting services..."
cd "$APP_DIR"
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | sudo bash   # auto-start on reboot

# ── 9. Install Nginx config ───────────────────────────────────
echo "Configuring Nginx..."
sudo cp "$APP_DIR/deploy/nginx.conf" /etc/nginx/sites-available/ad-astra
sudo ln -sf /etc/nginx/sites-available/ad-astra /etc/nginx/sites-enabled/ad-astra
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✓ Server setup complete!"
echo ""
echo "Next steps:"
echo "  1. Add DNS A record: ad-astra.openschools.space → $(curl -s ifconfig.me)"
echo "  2. Wait for DNS to propagate, then run:"
echo "     sudo apt-get install -y certbot python3-certbot-nginx"
echo "     sudo certbot --nginx -d ad-astra.openschools.space"
echo "  3. Add GitHub secrets (EC2_HOST, EC2_USER, EC2_SSH_KEY, EC2_APP_DIR)"
echo "     EC2_APP_DIR should be: $APP_DIR"
