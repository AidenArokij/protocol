# 15: Экран администратора и заявки лидеров

**What to build:** Экран «Администратор» виден только автору: поиск игрока, выдача и снятие роли «лидер» фракции на сервере. Заявки «я лидер» из хелпера одобряются там же (Q21).

**Blocked by:** —

**Status:** done — ждёт SQL `20260930000000_roles.sql` и строки в `admins`

Сделано: таблицы admins / profiles / roles / leader_requests с RLS и `decide_leader_request` (`supabase/migrations/20260930000000_roles.sql`); `src/account/roles.ts` (RolesApi), Supabase и fake; `src/ui/roles.tsx` (карточка игрока уходит при входе и открытии ассистента, роли — обратно, кэш на офлайн); заявка «Я лидер фракции» в аккаунте (`LeaderRequest.tsx`), значок «Лидер» в карточке, раздел «Администратор» в настройках (`AdminView.tsx`): заявки, поиск игрока, выдать/снять лидера. Тесты: `src/ui/Admin.test.tsx`.
