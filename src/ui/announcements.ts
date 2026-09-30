import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import { LAWS_BASE } from './laws';
import { AUTO_KEY, CHECK_EVERY_MS } from './updates';

/**
 * A notice to every player without a release (ticket 26): the author adds it to `src/data/announcements.json`
 * on `main`, and installed copies fetch that file as they fetch the laws.
 */
export interface Announcement {
  /** Never reused: a closed announcement stays closed by it. */
  id: string;
  title?: string;
  text: string;
  /** A button under the text; only to a site the app may open. */
  link?: { label: string; url: string };
  /** The last day it is shown (YYYY-MM-DD), inclusive. */
  until?: string;
  /** For these servers only; for all without it. */
  servers?: string[];
}

export const ANNOUNCEMENTS_URL = `${LAWS_BASE}/announcements.json`;
/** The file as last fetched, shown offline too. */
const CACHE_KEY = 'announcements.cache';
/** The ones the player closed. */
const DISMISSED_KEY = 'announcements.dismissed';

/** Where a link may lead: the sites the app is allowed to open (src-tauri/capabilities/default.json). */
const LINKABLE = ['https://forum.russia.online/', 'https://github.com/skyyyzeee/', 'https://discord.gg/', 'https://t.me/'];

/** Today in the player's time zone, as the file writes days. */
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** What of the file is shown here: well-formed, not past its day, for this server, not closed; a link it may open. */
export function shown(list: unknown, server: string, dismissed: string[]): Announcement[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a): a is Announcement => !!a && typeof a.id === 'string' && typeof a.text === 'string')
    .filter((a) => !dismissed.includes(a.id))
    .filter((a) => !a.until || a.until >= today())
    .filter((a) => !Array.isArray(a.servers) || a.servers.includes(server))
    .map((a) => {
      const { link, ...rest } = a;
      const safe = link && typeof link.url === 'string' && typeof link.label === 'string' && LINKABLE.some((site) => link.url.startsWith(site));
      return safe ? { ...rest, link } : rest;
    });
}

/**
 * The announcement to show on the home screen, if any, and closing it. The file is fetched at start and every
 * few hours, as the laws, and only while the automatic checks are on.
 */
export function useAnnouncements(server: string): { current: Announcement | null; dismiss: (id: string) => void } {
  const platform = usePlatform();
  const [list, setList] = useState<unknown>(null);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    let stopped = false;
    void Promise.all([platform.readSetting<unknown>(CACHE_KEY), platform.readSetting<string[]>(DISMISSED_KEY)]).then(([cached, closed]) => {
      if (stopped) return;
      if (cached) setList((now: unknown) => now ?? cached);
      if (Array.isArray(closed)) setDismissed(closed);
    });
    const fetchNow = async () => {
      if ((await platform.readSetting<boolean>(AUTO_KEY)) === false) return;
      try {
        const file = JSON.parse(await platform.download(ANNOUNCEMENTS_URL)) as { announcements?: unknown };
        if (stopped) return;
        setList(file.announcements ?? []);
        await platform.writeSetting(CACHE_KEY, file.announcements ?? []);
      } catch {
        // Offline, or no file: what was fetched before stays.
      }
    };
    void fetchNow();
    const timer = setInterval(() => void fetchNow(), CHECK_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [platform]);

  const dismiss = useCallback(
    (id: string) => {
      setDismissed((now) => {
        const next = [...now, id];
        void platform.writeSetting(DISMISSED_KEY, next);
        return next;
      });
    },
    [platform],
  );

  return { current: shown(list, server, dismissed)[0] ?? null, dismiss };
}
