#!/usr/bin/env bash
# Asks for the AI API key (ProxyAPI) and keeps it only here, in /opt/protocol/.env — then starts the server.
# The key is not shown on the screen while you paste it.
set -euo pipefail
ENV=/opt/protocol/.env

read -rsp "Вставьте ключ ProxyAPI (его не будет видно) и нажмите Enter: " KEY
echo
KEY=$(printf '%s' "$KEY" | tr -d '[:space:]')
if [ -z "$KEY" ]; then
  echo "Ключ пустой — ничего не изменено."
  exit 1
fi

# Replace the line, whatever was there before.
grep -v '^AI_API_KEY=' "$ENV" > "$ENV.part" || true
printf 'AI_API_KEY=%s\n' "$KEY" >> "$ENV.part"
mv "$ENV.part" "$ENV"
chown protocol:protocol "$ENV"
chmod 600 "$ENV"

systemctl restart protocol-ai
sleep 2
if systemctl is-active --quiet protocol-ai; then
  echo "Ключ сохранён, сервер ПРОТОКОЛА работает."
else
  echo "Сервер не запустился. Покажите вывод этой команды в чате:  journalctl -u protocol-ai -n 30"
fi
