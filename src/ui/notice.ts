// A notice to every installed copy, without a new version: a small file on the main branch of the repository,
// read with the laws. Empty, it says nothing. Written to tell players what they need to know — the move of
// ПРОТОКОЛ into РО Хелпер first of all.
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

export interface Notices {
  notice: Notice | null;
  dismiss: () => void;
  open: (url: string) => void;
}

/** The notice on GitHub: read at start and every few hours, like the laws — and not at all with the checks off. */
export function useNotice(): Notices {
  const platform = usePlatform();
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      if ((await platform.readSetting<boolean>(AUTO_KEY)) === false) return;
      const found = readNotice(await platform.download(NOTICE_URL).catch(() => ''));
      if (stopped) return;
      if (!found || (await platform.readSetting<string>(NOTICE_DISMISSED_KEY)) === found.id) return setNotice(null);
      setNotice(found);
      // Told over the game once, for those who seldom open the overlay.
      if ((await platform.readSetting<string>(NOTICE_TOASTED_KEY)) !== found.id) {
        await platform.writeSetting(NOTICE_TOASTED_KEY, found.id);
        void platform.showToast({ id: `notice-${found.id}`, title: found.title, ...(found.text ? { text: found.text } : {}) });
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
    if (!notice) return;
    void platform.writeSetting(NOTICE_DISMISSED_KEY, notice.id);
    setNotice(null);
  }, [notice, platform]);

  const open = useCallback((url: string) => void platform.openExternal(url), [platform]);
  return { notice, dismiss, open };
}
