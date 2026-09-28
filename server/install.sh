#!/usr/bin/env bash
# Sets up the ПРОТОКОЛ AI server on a fresh Ubuntu 24.04, as root:
#   curl -fsSL https://raw.githubusercontent.com/AidenArokij/protocol/main/server/install.sh | bash
# Then give it the AI key:  bash /opt/protocol/set-key.sh
# Running it again updates the server and keeps the settings and the key.
set -euo pipefail

REPO=https://raw.githubusercontent.com/AidenArokij/protocol/main/server
DIR=/opt/protocol

. /etc/os-release
if [ "${ID:-}" != "ubuntu" ] || [ "${VERSION_ID%%.*}" -lt 24 ]; then
  echo "Нужна Ubuntu 24.04 (у вас: ${PRETTY_NAME:-неизвестно}). Переустановите сервер с Ubuntu 24.04 в панели хостинга и запустите снова."
  exit 1
fi

echo "== Программы: Node.js и Caddy (HTTPS)"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs caddy curl ufw >/dev/null
node --version

echo "== Сервер ПРОТОКОЛА в $DIR"
id protocol >/dev/null 2>&1 || useradd --system --home "$DIR" --shell /usr/sbin/nologin protocol
mkdir -p "$DIR"
curl -fsSL "$REPO/server.mjs" -o "$DIR/server.mjs"
curl -fsSL "$REPO/set-key.sh" -o "$DIR/set-key.sh"
curl -fsSL "$REPO/env.example" -o "$DIR/env.example"
[ -f "$DIR/.env" ] || cp "$DIR/env.example" "$DIR/.env"
chown -R protocol:protocol "$DIR"
chmod 600 "$DIR/.env"

cat > /etc/systemd/system/protocol-ai.service <<EOF
[Unit]
Description=ПРОТОКОЛ AI server
After=network-online.target

[Service]
User=protocol
WorkingDirectory=$DIR
EnvironmentFile=$DIR/.env
ExecStart=/usr/bin/node $DIR/server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "== Адрес и HTTPS"
IP=$(curl -fsS4 https://api.ipify.org || hostname -I | awk '{print $1}')
DOMAIN="${IP//./-}.sslip.io"
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  encode gzip
  reverse_proxy 127.0.0.1:8787 {
    header_up X-Forwarded-For {remote_host}
  }
}
EOF

ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

systemctl daemon-reload
systemctl enable caddy >/dev/null 2>&1
systemctl restart caddy
systemctl enable protocol-ai >/dev/null 2>&1
if grep -q '^AI_API_KEY=.\+' "$DIR/.env"; then
  systemctl restart protocol-ai
  echo "== Готово: сервер работает."
else
  echo "== Почти готово. Теперь вставьте ключ ProxyAPI:  bash $DIR/set-key.sh"
fi
echo
echo "Адрес сервера ПРОТОКОЛА:  https://$DOMAIN"
echo "Пришлите этот адрес в чат — он пойдёт в программу."
