# Политика конфиденциальности

Редакция от 28 сентября 2026 года. Относится к программе ПРОТОКОЛ для Windows.

## Коротко

ПРОТОКОЛ не собирает данные о вас. В нём нет аккаунтов, аналитики, рекламы и телеметрии. Всё, что вы настраиваете, остаётся на вашем компьютере. В интернет программа обращается за обновлениями — к GitHub (это можно отключить) — и, только когда вы сами просите ИИ-разбор, к Google Gemini.

## Что хранится на компьютере

- Настройки: сервер, организация, горячая клавиша, прозрачность, положение окон.
- Ваш ключ Gemini для ИИ-разбора, если вы его ввели.
- Ваши данные для документов (ФИО, звание, должность), если вы их ввели.
- Избранное и недавние статьи.
- Последняя просмотренная версия законов (для экрана «Что изменилось»), последняя запущенная версия программы (для «Что нового») и версия обновления, отложенная кнопкой «Позже».
- Законы, скачанные с GitHub, — в папке `laws` рядом с настройками.
- Если включить «Запускать вместе с Windows», программа добавляет себя в автозагрузку вашей учётной записи Windows (раздел реестра `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`); выключите — запись удалится.

- История ИИ-разборов: ваши вопросы и ответы ИИ, последние 30 на каждом сервере. Удаляется по одному или вся сразу: 🕘 → «Очистить историю».

Всё это лежит в файле `%APPDATA%\com.aidenarokij.protocol\settings.json`. Служебные файлы окна (WebView2) — в `%LOCALAPPDATA%\com.aidenarokij.protocol`. Никуда не передаются, кроме ключа Gemini, который уходит в Google вместе с вопросом (см. ниже). Записи голоса программа не сохраняет. При удалении программы отметьте «Удалить данные приложения» — установщик сотрёт обе папки.

## Что уходит в интернет

**ИИ-разбор.** Когда вы задаёте вопрос ИИ, программа отправляет в Google Gemini (`generativelanguage.googleapis.com`) с вашим ключом: текст вопроса, предыдущие вопросы и ответы этого разговора и тексты статей законов, найденных по вопросу. Не пишите в вопросе ничего личного. Как Google обращается с этими данными, описано в [условиях Gemini API](https://ai.google.dev/gemini-api/terms) и [политике конфиденциальности Google](https://policies.google.com/privacy). Без вашего вопроса программа в Google не обращается; без ключа ИИ-разбор не работает.

**Документы.** Когда вы составляете документ, в Google Gemini уходят ваше описание ситуации, ваши данные для документов (ФИО, звание, должность) и тексты найденных статей.

**Голосовой вопрос.** Микрофон включается только когда вы нажмёте 🎤 или клавишу вопроса поверх игры (по умолчанию Alt + W), и выключается, когда вы нажмёте ещё раз или отпустите клавишу (и в любом случае через минуту). Запись отправляется в Google Gemini с вашим ключом, чтобы превратить речь в текст, и сразу забывается программой; дальше текст идёт в ИИ-разбор как обычный вопрос.

**Проверка обновлений.** При запуске и раз в 6 часов программа запрашивает файл с номером последней версии: `https://github.com/AidenArokij/protocol/releases/latest/download/latest.json`. Если вы нажмёте «Обновить», она скачает установщик новой версии оттуда же. В запросах нет ничего о вас, кроме того, без чего не работает интернет: GitHub видит IP-адрес и технические заголовки запроса, как при открытии любой страницы. Как GitHub обращается с этими данными, описано в [его политике конфиденциальности](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Автоматическую проверку можно выключить: «Настройки» → «Проверять обновления автоматически». Тогда программа не обращается к GitHub, пока вы сами не нажмёте «Проверить обновления».

**Обновление законов.** С той же периодичностью и при нажатии «Проверить законы» программа запрашивает с GitHub файл со сведениями о свежих законах: `https://raw.githubusercontent.com/AidenArokij/protocol/main/src/data/manifest.json`, — а если законы вашего сервера новее встроенных, скачивает их оттуда же (`…/src/data/<сервер>.json`) и сохраняет в `%APPDATA%\com.aidenarokij.protocol\laws`. В запросах нет ничего о вас. Выключается тем же переключателем «Проверять обновления автоматически».

**Ссылки.** «Тема на форуме», «Что нового», GitHub и страница получения ключа открываются в вашем браузере и только когда вы на них нажмёте. Дальше действуют правила этих сайтов.

Больше программа ничего не отправляет. Законы встроены в неё и работают без интернета; скачанные с GitHub лишь заменяют встроенные, когда те устарели.

## Клавиатура, буфер обмена и игра

- Программа регистрирует в Windows только выбранную вами горячую клавишу и не записывает другие нажатия. Текст в строке поиска не сохраняется; запоминаются только открытые статьи — в списке недавних.
- В буфер обмена программа записывает обвинение, только когда вы нажмёте «Скопировать» или <kbd>Ctrl</kbd>+<kbd>C</kbd>. Содержимое буфера она не читает.
- Программа не читает и не изменяет память игры и не внедряется в её процесс. Она лишь запоминает, какое окно было активным, чтобы вернуть ему фокус, когда оверлей скрывается.

## Изменения

Новая редакция политики выходит вместе с программой и публикуется в этом файле; история изменений видна в [репозитории](https://github.com/AidenArokij/protocol/commits/main/PRIVACY.md).

## Связь

Вопросы — в [issues на GitHub](https://github.com/AidenArokij/protocol/issues). Автор — AidenArokij. ПРОТОКОЛ основан на программе РО Хелпер (автор skyze).

---

## English

**Privacy policy of ПРОТОКОЛ (PROTOCOL) for Windows, as of 28 September 2026.**

PROTOCOL does not collect data about you: no accounts, analytics, ads or telemetry.

- **Stored locally only:** settings (server, organisation, hotkey, transparency, window positions), your Gemini key if you entered one, favourite and recent articles, the last seen version of the laws and a postponed update version — in `%APPDATA%\com.aidenarokij.protocol\settings.json`; WebView2 files in `%LOCALAPPDATA%\com.aidenarokij.protocol`. The last 30 AI conversations per server are kept locally and can be cleared in the app; voice recordings are not kept. The uninstaller removes both folders when "Delete the application data" is checked.
- **Voice question:** the microphone records only between two presses of 🎤 (a minute at most); the recording goes to Google Gemini with your key to be written down as text.
- **AI analysis:** only when you ask, the app sends your question, the earlier turns of the conversation and the texts of the law articles found for it to Google Gemini (`generativelanguage.googleapis.com`) with your key ([Gemini API terms](https://ai.google.dev/gemini-api/terms), [Google Privacy Policy](https://policies.google.com/privacy)).
- **Updates:** at start and every 6 hours the app fetches `https://github.com/AidenArokij/protocol/releases/latest/download/latest.json` and the laws manifest from the same repository, and downloads the new installer when you click "Update". No personal data is sent; GitHub sees your IP address and standard request headers ([GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement)). Automatic checks can be turned off in the settings.
- **Keyboard, clipboard, game:** only the hotkey you choose is registered with Windows; other keystrokes are not recorded. The clipboard is written only when you copy a charge and is never read. The app does not read or modify game memory or inject into the game; it only remembers the active window to give it the focus back.

Contact: [GitHub issues](https://github.com/AidenArokij/protocol/issues).
