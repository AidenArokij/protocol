// A notice to every installed copy, without a new version: a small file on the main branch of the repository,
// read with the laws. Empty, it says nothing. Without one, the built-in farewell: ПРОТОКОЛ 3.0 is the last version,
// everything new is in Кремлёвский Ассистент.
import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import { AUTO_KEY, CHECK_EVERY_MS } from './updates';

export const NOTICE_URL = 'https://raw.githubusercontent.com/AidenArokij/protocol/main/notice.json';
/** The notice closed with the cross: not shown again until a notice with another id. */
export const NOTICE_DISMISSED_KEY = 'notice.dismissed';
/** The notice told over the game: each one is told there once. */
export const NOTICE_TOASTED_KEY = 'notice.toasted';

export interface Notice {
  /** A new id shows the notice again, even to those who closed the last one. */
  id: string;
  title: string;
  text?: string;
  /** A button that opens a page in the browser — where to download РО Хелпер, say. */
  link?: { label: string; url: string };
}

/** The file's notice, or none: an empty file, a broken one, or a link that is no https address says nothing. */
export function readNotice(raw: string): Notice | null {
  try {
    const o = JSON.parse(raw) as Partial<Notice> | null;
    if (!o || typeof o.id !== 'string' || !o.id || typeof o.title !== 'string' || !o.title) return null;
    const link = o.link && typeof o.link.label === 'string' && typeof o.link.url === 'string' && /^https:\/\//.test(o.link.url) ? o.link : undefined;
    return { id: o.id, title: o.title, ...(typeof o.text === 'string' && o.text ? { text: o.text } : {}), ...(link ? { link } : {}) };
  } catch {
    return null;
  }
}

/**
 * ПРОТОКОЛ 3.0 is the last version: everything new is in Кремлёвский Ассистент. Built in, so it is said with the
 * checks off and offline too; a notice from GitHub, when there is one, is shown instead of it.
 */
export const FAREWELL: Notice = {
  id: 'farewell',
  title: 'ПРОТОКОЛ больше не обновляется — всё новое в «Кремлёвском Ассистенте»',
  text: 'Тот же поиск по законам, калькулятор и ИИ-разбор — и дальше они развиваются только там. ПРОТОКОЛ продолжит работать, но новых версий не будет.',
  link: { label: 'Скачать Кремлёвский Ассистент', url: 'https://github.com/skyyyzeee/ro-helper/releases/latest' },
};
/** When the farewell was closed: it comes back after a few days, until the player moves. */
export const FAREWELL_DISMISSED_KEY = 'farewell.dismissedAt';
export const FAREWELL_AGAIN_MS = 3 * 24 * 60 * 60 * 1000;

export interface Notices {
  notice: Notice | null;
  dismiss: () => void;
  open: (url: string) => void;
}

/** The notice on GitHub: read at start and every few hours, like the laws — and not at all with the checks off. */
export function useNotice(): Notices {
  const platform = usePlatform();
  const [remote, setRemote] = useState<Notice | null>(null);
  const [farewell, setFarewell] = useState(false);
  const notice = remote ?? (farewell ? FAREWELL : null);

  useEffect(() => {
    let stopped = false;
    /** Told over the game once, for those who seldom open the overlay. */
    const toast = async (told: Notice) => {
      if ((await platform.readSetting<string>(NOTICE_TOASTED_KEY)) === told.id) return;
      await platform.writeSetting(NOTICE_TOASTED_KEY, told.id);
      void platform.showToast({ id: `notice-${told.id}`, title: told.title, ...(told.text ? { text: told.text } : {}) });
    };
    const check = async () => {
      const closed = (await platform.readSetting<number>(FAREWELL_DISMISSED_KEY)) ?? 0;
      const again = Date.now() - closed >= FAREWELL_AGAIN_MS;
      if (stopped) return;
      setFarewell(again);
      const auto = (await platform.readSetting<boolean>(AUTO_KEY)) !== false;
      const found = auto ? readNotice(await platform.download(NOTICE_URL).catch(() => '')) : null;
      if (stopped) return;
      if (found && (await platform.readSetting<string>(NOTICE_DISMISSED_KEY)) !== found.id) {
        setRemote(found);
        await toast(found);
      } else {
        setRemote(null);
        if (again) await toast(FAREWELL);
      }
    };
    const first = setTimeout(() => void check(), 0);
    const timer = setInterval(() => void check(), CHECK_EVERY_MS);
    return () => {
      stopped = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [platform]);

  const dismiss = useCallback(() => {
    if (remote) {
      void platform.writeSetting(NOTICE_DISMISSED_KEY, remote.id);
      setRemote(null);
    } else if (farewell) {
      void platform.writeSetting(FAREWELL_DISMISSED_KEY, Date.now());
      setFarewell(false);
    }
  }, [remote, farewell, platform]);

  const open = useCallback((url: string) => void platform.openExternal(url), [platform]);
  return { notice, dismiss, open };
}
