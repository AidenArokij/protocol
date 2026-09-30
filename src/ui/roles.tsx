import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount } from '../account/AccountContext';
import { capabilitiesOf, type Capability } from '../account/capabilities';
import type { MyRoles, PublicCard, RolesApi } from '../account/roles';
import type { Accounts } from '../account/types';
import type { Organization } from '../core';
import { usePlatform } from '../platform/PlatformContext';
import { PLAYER_KEY, type PlayerCard } from './player';
import { PROFILE_KEY, type Profile } from './profile';

/** The signed-in player's roles as last known here: shown offline too. */
const ROLES_CACHE_KEY = 'roles.mine';

export interface RolesControl {
  /** Where the player stands; null when signed out or not known yet. */
  mine: MyRoles | null;
  /** Asks the server again (after a request, or the admin's changes). */
  refresh(): Promise<void>;
  /** Sends the player's card again at once (after they changed it). */
  publish(): Promise<void>;
  api: RolesApi;
}

const RolesContext = createContext<RolesControl | null>(null);

/**
 * Roles for the signed-in player (ticket 15): their card goes to the server — their name, the game name and
 * position they gave, their server and faction — so the admin can find them; their roles and their leader
 * request come back. Both whenever they sign in and whenever the assistant is opened.
 */
export function RolesProvider({ accounts, children }: { accounts: Accounts; children: ReactNode }) {
  const platform = usePlatform();
  const { status } = useAccount();
  const account = status.kind === 'signed-in' ? status.account : null;
  const user = account?.id ?? null;
  const name = account?.name ?? '';
  const [mine, setMine] = useState<MyRoles | null>(null);
  const published = useRef('');

  useEffect(() => {
    if (!user) {
      setMine(null);
      return;
    }
    void platform.readSetting<MyRoles & { user: string }>(ROLES_CACHE_KEY).then((cached) => {
      if (cached?.user === user) setMine((now) => now ?? cached);
    });
  }, [platform, user]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const fresh = await accounts.roles.mine();
      setMine(fresh);
      await platform.writeSetting(ROLES_CACHE_KEY, { ...fresh, user });
    } catch {
      // Offline: what was known stays.
    }
  }, [accounts, platform, user]);

  const publish = useCallback(async () => {
    if (!user) return;
    const [profile, player] = await Promise.all([platform.readSetting<Profile>(PROFILE_KEY), platform.readSetting<PlayerCard>(PLAYER_KEY)]);
    const card: PublicCard = {
      name,
      ...(player?.gameName ? { gameName: player.gameName } : {}),
      ...(player?.position ? { position: player.position } : {}),
      ...(profile?.server ? { server: profile.server } : {}),
      ...(profile?.organization ? { organization: profile.organization } : {}),
    };
    const text = JSON.stringify(card);
    if (text === published.current) return;
    try {
      await accounts.roles.publish(card);
      published.current = text;
    } catch {
      // Offline: sent the next time.
    }
  }, [accounts, platform, user, name]);

  useEffect(() => {
    void publish();
    void refresh();
  }, [publish, refresh]);
  useEffect(
    () =>
      platform.onOverlayShown(() => {
        void publish();
        void refresh();
      }),
    [platform, publish, refresh],
  );

  return <RolesContext.Provider value={{ mine, refresh, publish, api: accounts.roles }}>{children}</RolesContext.Provider>;
}

/**
 * What the player may do at their server and faction (roadmap 1А): the interface shows by this, never by the
 * roles themselves. Without a place, only what does not depend on one (the admin's part).
 */
export function useCapabilities(place?: { server: string; organization?: Organization }): ReadonlySet<Capability> {
  const { status } = useAccount();
  const { mine } = useRoles();
  const signedIn = status.kind === 'signed-in';
  const server = place?.server ?? '';
  const organization = place?.organization;
  return useMemo(
    () => capabilitiesOf({ signedIn, roles: mine?.roles ?? [], admin: !!mine?.admin, server, organization }),
    [signedIn, mine, server, organization],
  );
}

export function useRoles(): RolesControl {
  const control = useContext(RolesContext);
  if (!control) throw new Error('useRoles must be used inside <RolesProvider>');
  return control;
}
