import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { Organization, ServerPack } from '../core';
import { usePlatform } from '../platform/PlatformContext';
import { APP_VERSION, AUTHOR, LINKS, ORIGINAL } from './about';
import { AI_KEY_SETTING, AI_KEY_URL } from './ai';
import {
  BackIcon,
  BookIcon,
  CloseIcon,
  GitHubIcon,
  HelpIcon,
  InfoIcon,
  KeyboardIcon,
  PaletteIcon,
  PinIcon,
  SettingsIcon,
  SparkIcon,
  WarnIcon,
} from './icons';
import { formatDate } from './lawBits';
import { MAX_OPACITY, MIN_OPACITY, type Theme } from './overlaySettings';
import { captureHotkey, hasModifier, hotkeyKeys } from './profile';
import { ServerEmblem } from './ServerMenu';
import type { Laws, LawsStatus } from './laws';
import type { Updates } from './updates';

const THEMES: { id: Theme; label: string }[] = [
  { id: 'solid', label: 'Сплошное' },
  { id: 'glass', label: 'Стекло' },
];

/** What a check from the settings found, beside its button. */
function updateNote(status: Updates['status']): string | null {
  switch (status.kind) {
    case 'checking':
      return 'Проверяю…';
    case 'latest':
      return 'Установлена последняя версия';
    case 'offline':
      return 'Нет связи с GitHub';
    case 'available':
    case 'failed':
      return `Доступна версия ${status.update.version}`;
    case 'installing':
      return 'Обновляю…';
    default:
      return null;
  }
}

/** What a check for newer laws found, beside its button. */
function lawsNote(status: LawsStatus): string | null {
  switch (status.kind) {
    case 'checking':
      return 'Проверяю…';
    case 'latest':
      return 'Законы актуальны';
    case 'offline':
      return 'Нет связи с GitHub';
    case 'updated':
      return 'Загружены новые законы';
    default:
      return null;
  }
}

/** One block of the settings, with its heading. */
function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="set" aria-label={title}>
      <h3 className="set__title">{title}</h3>
      <div className="set__rows">{children}</div>
    </section>
  );
}

/** A line of a block: what it is on the left, the value and the control on the right. */
function Row({ label, value, children }: { label: string; value?: ReactNode; children?: ReactNode }) {
  return (
    <div className="set__row">
      <span className="set__label">{label}</span>
      {value !== undefined && <span className="set__value">{value}</span>}
      <span className="sp" />
      {children}
    </div>
  );
}

/** The hotkey, changed right here: press the field, then the combination. */
function HotkeyField({ hotkey, onHotkey, onCapturing }: { hotkey: string; onHotkey: (accelerator: string) => void; onCapturing: (capturing: boolean) => void }) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  // While a hotkey is being recorded the current one must be released, or Windows swallows the keys.
  useEffect(() => onCapturing(listening), [listening, onCapturing]);
  useEffect(() => () => onCapturing(false), [onCapturing]);

  const record = (event: ReactKeyboardEvent) => {
    if (!listening) return;
    event.preventDefault();
    // Esc here only stops the recording: it must not step back through the overlay as well.
    event.stopPropagation();
    if (event.key === 'Escape') {
      setListening(false);
      return;
    }
    const result = captureHotkey(event);
    if (result.kind === 'waiting') return;
    if (result.kind === 'unsupported') {
      setUnsupported(true);
      return;
    }
    setUnsupported(false);
    setListening(false);
    if (result.accelerator !== hotkey) onHotkey(result.accelerator);
  };

  return (
    <>
      <div className="set__row">
        <span className="set__label">Открыть и скрыть оверлей</span>
        <span className="sp" />
        <button
          type="button"
          className={listening ? 'ob__hotkey set__hotkey ob__hotkey--listen' : 'ob__hotkey set__hotkey'}
          aria-label={`Горячая клавиша: ${listening ? 'нажмите сочетание' : hotkeyKeys(hotkey).join(' + ')}`}
          onClick={() => {
            setUnsupported(false);
            setListening(true);
          }}
          onBlur={() => setListening(false)}
          onKeyDown={record}
        >
          {listening ? (
            <span className="muted">Нажмите сочетание…</span>
          ) : (
            hotkeyKeys(hotkey).map((key) => (
              <span key={key} className="ob__key">
                {key}
              </span>
            ))
          )}
        </button>
      </div>
      <p className="set__hint">{listening ? 'Нажмите нужное сочетание. Esc — отмена.' : 'Нажмите на поле и задайте новое сочетание.'}</p>
      {unsupported && <p className="set__hint">Эту клавишу назначить нельзя: подойдут буквы, цифры, F1–F24, пробел.</p>}
      {!hasModifier(hotkey) && (
        <div className="warn" role="alert">
          <WarnIcon />
          <span>Без Ctrl, Alt или Shift клавиша может пересечься с управлением в игре.</span>
        </div>
      )}
    </>
  );
}

/** The player's Gemini key for the AI analysis: kept in the settings file on this computer, shown only as a mask. */
function AiKeyField() {
  const platform = usePlatform();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    void platform.readSetting<string>(AI_KEY_SETTING).then((value) => setSaved(!!value?.trim()));
  }, [platform]);
  const save = (event: FormEvent) => {
    event.preventDefault();
    const value = key.trim();
    if (!value) return;
    void platform.writeSetting(AI_KEY_SETTING, value).then(() => {
      setSaved(true);
      setKey('');
      setNote('Ключ сохранён');
    });
  };
  const remove = () =>
    void platform.writeSetting(AI_KEY_SETTING, '').then(() => {
      setSaved(false);
      setNote('Ключ удалён');
    });
  return (
    <>
      <Row label="Ключ Gemini" value={saved === null ? '…' : saved ? 'сохранён' : 'не задан'}>
        {saved && (
          <button className="settings__button" type="button" onClick={remove}>
            Удалить
          </button>
        )}
      </Row>
      <form className="set__row presets__form" onSubmit={save}>
        <input
          className="presets__input"
          type="password"
          aria-label="Ключ Gemini"
          placeholder={saved ? 'Вставьте новый ключ, чтобы заменить' : 'Вставьте ключ: AIza…'}
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setNote(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' && key) {
              e.stopPropagation();
              setKey('');
            }
          }}
        />
        <button className="settings__button" type="submit" disabled={!key.trim()}>
          Сохранить
        </button>
      </form>
      {note && (
        <span className="settings__note" role="status">
          {note}
        </span>
      )}
      <p className="set__hint">
        Ключ бесплатный, у каждого игрока свой. Он хранится только на этом компьютере.{' '}
        <button className="link" type="button" onClick={() => void platform.openExternal(AI_KEY_URL)}>
          Получить ключ на aistudio.google.com
        </button>
      </p>
    </>
  );
}

/** A switch, as in the settings of Windows: on or off, with what it does under it. */
function Switch({ label, hint, on, disabled, onChange }: { label: string; hint?: string; on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <>
      <div className="set__row">
        <span className="set__label set__label--strong">{label}</span>
        <span className="sp" />
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          disabled={disabled}
          className={on ? 'switch switch--on' : 'switch'}
          onClick={() => onChange(!on)}
        >
          <span className="switch__knob" />
        </button>
      </div>
      {hint && <p className="set__hint">{hint}</p>}
    </>
  );
}

/** «Запускать вместе с Windows»: asked of Windows itself, so it shows what really happens at logon. */
function AutostartSwitch() {
  const platform = usePlatform();
  const [on, setOn] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    void platform.getAutostart().then(setOn, () => setOn(false));
  }, [platform]);
  const available = platform.kind !== 'browser';
  return (
    <>
      <Switch
        label="Запускать вместе с Windows"
        hint={
          available
            ? 'ПРОТОКОЛ запустится при входе в Windows и будет ждать в трее — откройте его горячей клавишей.'
            : 'Работает только в установленной программе.'
        }
        on={!!on}
        disabled={on === null || !available}
        onChange={(next) => {
          setFailed(false);
          setOn(next);
          platform.setAutostart(next).catch(() => {
            setOn(!next);
            setFailed(true);
          });
        }}
      />
      {failed && (
        <div className="warn" role="alert">
          <WarnIcon />
          <span>Windows не дал изменить автозапуск. Попробуйте ещё раз.</span>
        </div>
      )}
    </>
  );
}

/** Keys as keycaps: «Ctrl» «C». */
function KeyCaps({ keys }: { keys: string[] }) {
  return (
    <span className="keycaps">
      {keys.map((key) => (
        <span key={key} className="keycap">
          {key}
        </span>
      ))}
    </span>
  );
}

type SectionId = 'main' | 'ai' | 'look' | 'pins' | 'laws' | 'keys' | 'faq' | 'about';

/** The menu on the left, as in SinSet-like helpers: every section of the settings a click away. */
const SECTIONS: { id: SectionId; label: string; icon: (props: { size?: number }) => ReactNode }[] = [
  { id: 'main', label: 'Основное', icon: SettingsIcon },
  { id: 'ai', label: 'Ответы ИИ', icon: SparkIcon },
  { id: 'look', label: 'Внешний вид', icon: PaletteIcon },
  { id: 'pins', label: 'Закреплённые', icon: PinIcon },
  { id: 'laws', label: 'Законы и обновления', icon: BookIcon },
  { id: 'keys', label: 'Клавиши', icon: KeyboardIcon },
  { id: 'faq', label: 'Частые вопросы', icon: HelpIcon },
  { id: 'about', label: 'О программе', icon: InfoIcon },
];

/** One section of the settings, where the menu scrolls to. */
function Section({ id, title, children }: { id: SectionId; title: string; children: ReactNode }) {
  return (
    <section id={`settings-${id}`} className="settings__section" aria-label={title}>
      {children}
    </section>
  );
}

/** Keys of the overlay itself; the hotkey is shown apart, as the user set it. */
const KEYS: [string[], string][] = [
  [['↑', '↓'], 'выбрать статью в списке'],
  [['Enter'], 'добавить статью в калькулятор или убрать; в ИИ-разборе — спросить ИИ'],
  [['→'], 'открыть статью целиком'],
  [['Ctrl', 'C'], 'скопировать обвинение из калькулятора'],
  [['Esc'], 'шаг назад; на главном экране — скрыть ПРОТОКОЛ'],
  [['Backspace'], 'в пустом поиске — искать во всех документах, а не в одном'],
];

const FAQ: [string, string][] = [
  [
    'Где взять ключ для ИИ и сколько это стоит?',
    'Бесплатно: откройте aistudio.google.com/apikey, войдите в аккаунт Google, нажмите «Create API key» и вставьте ключ в «Ответы ИИ» → «Ключ Gemini». У каждого игрока свой ключ; у бесплатного есть ограничение на число вопросов в минуту.',
  ],
  [
    'ИИ может ошибиться?',
    'Может: он пересказывает найденные статьи своими словами. Поэтому каждая статья в ответе открывается по клику — перед серьёзным RP-решением прочитайте её сами. Статей, которых нет в законах сервера, ИИ не видит и ссылаться на них не должен.',
  ],
  [
    'ПРОТОКОЛ не видно поверх игры',
    'В игре должен быть «Оконный без рамки» (GTA V → «Графика» → «Тип экрана»): поверх полноэкранного режима Windows другие окна не показывает.',
  ],
  [
    'Как спрятать ПРОТОКОЛ со стрима или записи?',
    'Включите «Режим стримера» в «Основном»: вам окно видно, а в OBS, Discord и на скриншотах его не будет.',
  ],
  [
    'Откуда законы и насколько они свежие?',
    'Законы, уставы и правила взяты с форума Russia Online и обновляются сами, без новой версии программы. Дата — в «Законы и обновления» → «Актуально на»; что поменялось — «Что изменилось в законах».',
  ],
  ['Как обновить программу?', 'Сама: когда выйдет новая версия, ПРОТОКОЛ предложит обновиться. Проверить вручную — «Законы и обновления» → «Проверить обновления».'],
];

/** «1 карточка», «3 карточки», «5 карточек». */
function cardsLabel(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 0) return 'Ничего не закреплено';
  if (mod10 === 1 && mod100 !== 11) return `${n} карточка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} карточки`;
  return `${n} карточек`;
}

/** Saving what is pinned now as a set, under a name or the next free one. */
function PresetForm({ disabled, placeholder, onSave }: { disabled: boolean; placeholder: string; onSave: (name: string) => void }) {
  const [name, setName] = useState('');
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    onSave(name);
    setName('');
  };
  return (
    <form className="set__row presets__form" onSubmit={save}>
      <input
        className="presets__input"
        type="text"
        aria-label="Название набора"
        placeholder={placeholder}
        value={name}
        maxLength={40}
        disabled={disabled}
        onChange={(e) => setName(e.target.value)}
        // Esc in the field clears it, not the settings.
        onKeyDown={(e) => {
          if (e.key === 'Escape' && name) {
            e.stopPropagation();
            setName('');
          }
        }}
      />
      <button className="settings__button" type="submit" disabled={disabled} title={disabled ? 'Сначала закрепите статьи' : undefined}>
        Сохранить набор
      </button>
    </form>
  );
}

export interface SettingsViewProps {
  backLabel: string;
  onBack: () => void;
  pack: ServerPack;
  organization?: Organization;
  /** Opens the choice of server, and of organisation, each on its own screen. */
  onServer: () => void;
  onOrganization: () => void;
  /** The first-launch steps again: server, organisation and hotkey in a row. */
  onEditProfile: () => void;
  hotkey: string;
  onHotkey: (accelerator: string) => void;
  onCapturing: (capturing: boolean) => void;
  opacity: number;
  onOpacity: (value: number) => void;
  theme: Theme;
  onTheme: (theme: Theme) => void;
  /** Streamer mode: the app left out of screen capture. */
  streamer: boolean;
  onStreamer: (on: boolean) => void;
  /** Cards pinned over the game: how many, and unpinning them all at once. */
  pinned: number;
  onUnpinAll: () => void;
  /** Saved sets of pinned cards, what the next one is called unless named, and saving, showing, deleting one. */
  presets: { id: string; name: string; count: number }[];
  nextPresetName: string;
  onSavePreset: (name: string) => void;
  onApplyPreset: (id: string) => void;
  onDeletePreset: (id: string) => void;
  /** Opens «Что изменилось» for the recent updates of the laws. */
  onChanges: () => void;
  updates: Updates;
  onPrivacy: () => void;
  /** Checking GitHub for newer laws, without a new version of the app. */
  laws?: Pick<Laws, 'status' | 'check'>;
  /** Opens what is new in every version. */
  onHistory: () => void;
}

/** The settings screen: what the helper works with, how it looks, the laws, updates and the app itself. */
export function SettingsView({
  backLabel,
  onBack,
  pack,
  organization,
  onServer,
  onOrganization,
  onEditProfile,
  hotkey,
  onHotkey,
  onCapturing,
  opacity,
  onOpacity,
  theme,
  onTheme,
  streamer,
  onStreamer,
  pinned,
  onUnpinAll,
  presets,
  nextPresetName,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  onChanges,
  updates,
  onPrivacy,
  laws,
  onHistory,
}: SettingsViewProps) {
  const platform = usePlatform();
  const transparency = Math.round((1 - opacity) * 100);
  const checking = updates.status.kind === 'checking' || updates.status.kind === 'installing';
  const [active, setActive] = useState<SectionId>('main');
  const bodyRef = useRef<HTMLDivElement>(null);

  // The section being read lights up in the menu as the settings scroll.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (seen) setActive(seen.target.id.replace('settings-', '') as SectionId);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    body.querySelectorAll('.settings__section').forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  const go = (id: SectionId) => {
    setActive(id);
    // Not every environment scrolls (the tests' has no layout): the menu still marks the section.
    void bodyRef.current?.querySelector(`#settings-${id}`)?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  };

  return (
    <div className="settings settings--nav" role="group" aria-label="Настройки">
      <aside className="settings__side">
        <button className="back" type="button" onClick={onBack}>
          <BackIcon />
          <span>{backLabel}</span>
        </button>
        <div className="settings__who">
          <ServerEmblem id={pack.server.id} name={pack.server.name} size={36} />
          <span className="settings__who-text">
            <b>{pack.server.name}</b>
            <span>{organization && organization.id !== 'none' ? organization.name : 'без организации'}</span>
          </span>
        </div>
        <nav className="settings__menu" aria-label="Разделы настроек">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              className={active === section.id ? 'settings__link settings__link--on' : 'settings__link'}
              aria-current={active === section.id ? 'true' : undefined}
              onClick={() => go(section.id)}
            >
              <section.icon size={18} />
              <span>{section.label}</span>
            </button>
          ))}
        </nav>
        <span className="settings__version">v{APP_VERSION}</span>
      </aside>

      <div className="settings__body" ref={bodyRef}>
      <h2 className="art__title">Настройки</h2>

      <Section id="main" title="Основное">
      <Block title="Сервер и организация">
        <Row label="Сервер" value={pack.server.name}>
          <button className="settings__button" type="button" aria-label="Сменить сервер" onClick={onServer}>
            Сменить
          </button>
        </Row>
        <Row label="Организация" value={organization?.name ?? 'не выбрана'}>
          <button className="settings__button" type="button" onClick={onOrganization}>
            Сменить
          </button>
        </Row>
        <p className="set__hint">Законы и устав вашей организации идут первыми в поиске.</p>
      </Block>

      <Block title="Горячая клавиша">
        <HotkeyField hotkey={hotkey} onHotkey={onHotkey} onCapturing={onCapturing} />
      </Block>

      <Block title="Запуск и стрим">
        <AutostartSwitch />
        <Switch
          label="Режим стримера"
          hint="Окно ПРОТОКОЛА и закреплённые карточки видно вам, но не видно в OBS, Discord и на записи экрана."
          on={streamer}
          onChange={onStreamer}
        />
      </Block>
      </Section>

      <Section id="ai" title="Ответы ИИ">
      <Block title="Ключ Gemini">
        <AiKeyField />
      </Block>
      <Block title="Как отвечает ИИ">
        <p className="set__hint">
          ИИ читает только статьи, которые поиск нашёл в законах вашего сервера, и ссылается только на них — каждую можно открыть
          из ответа. Он помнит разговор — можно уточнять, — а прошлые разборы хранятся в 🕘 «Истории». Ответ можно разобрать с
          другой стороны: Государство, Гражданский, Адвокат, Крайм. Вопрос можно задать голосом: 🎤 в строке поиска.
        </p>
      </Block>
      </Section>

      <Section id="look" title="Внешний вид">
      <Block title="Внешний вид">
        <div className="set__row">
          <span className="set__label">Оформление</span>
          <span className="sp" />
          <div className="tabs" role="radiogroup" aria-label="Оформление">
            {THEMES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={theme === option.id}
                className={theme === option.id ? 'tabs__btn tabs__btn--on' : 'tabs__btn'}
                onClick={() => onTheme(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <p className="set__hint">
          {theme === 'solid' ? 'Тёмная панель с красным акцентом: читается на любом фоне.' : 'Игра просвечивает сквозь панель, как в РО Хелпер.'}
        </p>
        {theme === 'glass' && (
          <>
            <label className="set__row">
              <span className="set__label">Прозрачность фона</span>
              <span className="sp" />
              <span className="settings__value">{transparency}%</span>
            </label>
            <input
              className="settings__slider"
              type="range"
              aria-label="Прозрачность фона"
              min={Math.round((1 - MAX_OPACITY) * 100)}
              max={Math.round((1 - MIN_OPACITY) * 100)}
              step={1}
              value={transparency}
              onChange={(e) => onOpacity(1 - Number(e.target.value) / 100)}
            />
          </>
        )}
        {platform.kind !== 'browser' && (
          <button className="settings__button" type="button" onClick={() => void platform.resetWindowBounds()}>
            Сбросить положение окна
          </button>
        )}
      </Block>
      </Section>

      <Section id="pins" title="Закреплённые">
      <Block title="Закреплено поверх игры">
        <Row label={cardsLabel(pinned)}>
          {pinned > 0 && (
            <button className="settings__button" type="button" onClick={onUnpinAll}>
              Открепить всё
            </button>
          )}
        </Row>
        <p className="set__hint">Карточки перетаскиваются за шапку; брошенная на другую встаёт к ней с той стороны, куда её бросили.</p>

        <h4 className="set__sub">Наборы</h4>
        {presets.length > 0 ? (
          <ul className="presets" aria-label="Наборы закреплённых">
            {presets.map((preset) => (
              <li key={preset.id} className="presets__row">
                <span className="presets__name">{preset.name}</span>
                <span className="set__label">{cardsLabel(preset.count)}</span>
                <span className="sp" />
                <button className="settings__button" type="button" aria-label={`Показать набор «${preset.name}»`} onClick={() => onApplyPreset(preset.id)}>
                  Показать
                </button>
                <button className="x" type="button" aria-label={`Удалить набор «${preset.name}»`} title="Удалить набор" onClick={() => onDeletePreset(preset.id)}>
                  <CloseIcon size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="set__hint">Сохраните то, что закреплено сейчас, — «Патруль», «Обыск», — и возвращайте всё одной кнопкой.</p>
        )}
        <PresetForm disabled={pinned === 0} placeholder={nextPresetName} onSave={onSavePreset} />
      </Block>
      </Section>

      <Section id="laws" title="Законы и обновления">
      <Block title="Законы">
        <Row label="Актуально на" value={formatDate(pack.version)} />
        <button className="settings__button" type="button" onClick={onChanges}>
          Что изменилось в законах
        </button>
        {laws && (
          <div className="set__row">
            <button className="settings__button" type="button" disabled={laws.status.kind === 'checking'} onClick={laws.check}>
              Проверить законы
            </button>
            <span className="settings__note" role="status" aria-label="Проверка законов">
              {lawsNote(laws.status)}
            </span>
          </div>
        )}
        <p className="set__hint">Новые законы приходят с GitHub сами, без обновления программы.</p>
      </Block>

      <Block title="Обновления">
        <div className="set__row">
          <button className="settings__button" type="button" disabled={checking} onClick={updates.check}>
            Проверить обновления
          </button>
          <span className="settings__note" role="status">
            {updateNote(updates.status)}
          </span>
        </div>
        <label className="set__row settings__check">
          <input type="checkbox" checked={updates.auto} onChange={(e) => updates.setAuto(e.target.checked)} />
          <span>Проверять обновления автоматически</span>
        </label>
      </Block>
      </Section>

      <Section id="keys" title="Клавиши">
      <Block title="Клавиши">
        <table className="keys">
          <tbody>
            <tr>
              <td>
                <KeyCaps keys={hotkeyKeys(hotkey)} />
              </td>
              <td>открыть и скрыть ПРОТОКОЛ поверх игры</td>
            </tr>
            {KEYS.map(([keys, what]) => (
              <tr key={what}>
                <td>
                  <KeyCaps keys={keys} />
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Block>
      </Section>

      <Section id="faq" title="Частые вопросы">
      <Block title="Частые вопросы">
        {FAQ.map(([question, answer]) => (
          <details key={question} className="faq">
            <summary>{question}</summary>
            <p className="set__hint">{answer}</p>
          </details>
        ))}
      </Block>
      <Block title="Настройки игры">
        <p className="set__hint">
          <b>Тип экрана — «Оконный без рамки»</b> (GTA V → «Графика»): поверх полноэкранного режима Windows других окон не
          показывает, и хелпера не будет видно.
        </p>
        <p className="set__hint">
          <b>«Отключение звука при потере фокуса» — «Выкл»</b> (GTA V → «Аудио»): иначе, пока открыт хелпер, игра глушит
          звук.
        </p>
      </Block>
      </Section>

      <Section id="about" title="О программе">
      <Block title="О программе">
        <div className="set__row settings__about">
          <span>
            ПРОТОКОЛ {APP_VERSION} · автор {AUTHOR}
          </span>
          <span className="sp" />
          <button className="icon-btn icon-btn--sm" type="button" aria-label="GitHub" title="GitHub" onClick={() => void platform.openExternal(LINKS.repository)}>
            <GitHubIcon />
          </button>
        </div>
        <p className="set__hint">
          Основано на{' '}
          <button className="link" type="button" onClick={() => void platform.openExternal(ORIGINAL.repository)}>
            {ORIGINAL.name}
          </button>{' '}
          — автор {ORIGINAL.author}, лицензия MIT. Поиск, калькулятор, карточки и базу законов сделал он; ИИ-разбор добавлен в ПРОТОКОЛЕ.
        </p>
        <div className="set__row set__links">
          <button className="link" type="button" onClick={onPrivacy}>
            Политика конфиденциальности
          </button>
          <button className="link" type="button" onClick={onHistory}>
            История версий
          </button>
          <span className="sp" />
          <button className="link" type="button" onClick={onEditProfile}>
            Настроить заново
          </button>
        </div>
      </Block>
      </Section>
      </div>
    </div>
  );
}
