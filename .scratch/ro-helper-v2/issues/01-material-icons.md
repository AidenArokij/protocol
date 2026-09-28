# 01: Иконки Material Symbols Rounded

**What to build:** Один стиль иконок по всему хелперу. Нужные иконки Material Symbols Rounded (около 40, Apache 2.0) встроены в программу как SVG и не грузятся из интернета. Ими заменяются все иконки из `src/ui/icons.tsx`, появляются значки фракций.

**Blocked by:** —

**Status:** done

- [x] Иконки берутся из пакета Material Symbols при сборке скриптом, в программу попадают только используемые
- [x] `icons.tsx` отдаёт те же компоненты, что и раньше, но на Material Symbols Rounded: интерфейс меняет вид, не меняя кода экранов
- [x] Значок у каждой организации всех трёх серверов (МВД, ГИБДД, ФСБ, ФСО, Армия, СК, Прокуратура, Суд, Правительство, Больница, СМИ/Вести, Адвокатура, Дума, ОПГ, Без организации)
- [x] Лицензия Material Symbols указана в «О программе» и README
- [x] Тесты проходят, размер сборки не вырос больше чем на 100 КБ

## Comments

2026-09-28 — сделано.

- Иконки берутся из dev-зависимости `@material-symbols/svg-400` скриптом `node scripts/icons.mjs`. Он пишет пути 42 иконок в `src/ui/symbols.ts` (24 КБ исходника).
- `icons.tsx` сохранил прежние компоненты (SearchIcon, PinIcon…), новые: ChevronDownIcon, DocumentsIcon, CalculatorIcon, MemoIcon, ProfileIcon, PaletteIcon, OrganizationIcon.
- Звезда избранного — два пути (контур и заливка), CSS показывает нужный (`.icon-on` / `.icon-off`).
- Значки организаций: МВД local_police, ГИБДД traffic, ФСБ security, ФСО verified_user, Армия military_tech, СК policy, Прокуратура gavel, Суд balance, Правительство account_balance, Дума how_to_vote, Больница local_hospital, Вести/СМИ newspaper, Адвокатура cases, ОПГ skull, «Без организации» person.
- GitHub и Discord остались своими (в Material Symbols нет логотипов брендов).
