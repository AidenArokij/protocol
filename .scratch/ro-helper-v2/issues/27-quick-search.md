# 27: Быстрый поиск по отдельной клавише

**What to build:** Вторая горячая клавиша (своя, настраивается рядом с основной) открывает не весь ассистент, а только поиск: строка и результаты, переключение на ИИ. Основная клавиша по-прежнему открывает ассистент целиком.

**Decisions (owner, 30.09.2026):**
- A bar of its own at the top centre of the screen, like the Windows / Spotlight search: the field, a «Законы | ИИ» switch, up to 6–8 results under it — the game stays in view.
- → or a click opens the article in the bar itself; Enter puts it into the calculator, as in the assistant; Esc steps back, then closes. The whole assistant is not needed.
- Default key Alt+S (beside Alt+Q for the assistant and Alt+W for a question by voice), changed in «Клавиши».

**Who:** skyze's agent.

**Blocked by:** —

**Status:** done — ждёт проверки в установленной сборке

Сделано: окно `quick` (`src-tauri/src/quick.rs`: создаётся скрытым, показ сверху по центру экрана ассистента, скрытие с возвратом фокуса игре, высота по содержимому), клавиша в ассистенте (`registerQuickHotkey`, настройка `quick.hotkey`, по умолчанию Alt+S, в «Клавиши»), `src/ui/QuickSearch.tsx` (законы сервера игрока, до 8 результатов, → статья в полосе, Enter — в калькулятор ассистента, Tab — ИИ: вопрос открывается в ассистенте; Esc назад/скрыть; скрывается, когда игрок щёлкает мимо). Просьбы полосы ассистент выполняет через событие `quick-request`. Превью: `?quick`.
