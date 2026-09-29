# 09: Вход через Discord (необязательный)

**What to build:** В профиле кнопка «Войти через Discord». После входа сессия запоминается, хелпер работает офлайн (Q12). Без входа всё работает как раньше.

**Blocked by:** 08

**Status:** done — ждёт проверки входа в установленной 2.1.0 (отладочную сборку блокирует Smart App Control)

Сделано: `src/account` (Supabase, PKCE, сессия в настройках), `src-tauri/src/sign_in.rs` (одноразовый слушатель 127.0.0.1:47321), `src/ui/ProfileView.tsx`, пункт «Профиль» (Ctrl+6) с аватаром. Настройки Supabase проверены: /authorize ведёт в Discord с нужным client_id и redirect_uri.
