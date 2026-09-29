import { createClient, type SupportedStorage, type User } from '@supabase/supabase-js';
import type { PlatformAdapter } from '../platform/types';
import { ACCOUNT_KEY, SignInError, type Account, type Accounts } from './types';

/** The helper's Supabase project. The publishable key is meant for the app itself: the database's rules guard the data. */
export const SUPABASE_URL = 'https://evwyrdytojwxlvgqrkar.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_MjdXihRRpYCnP-ZFZPczkw_mi2nv_Q5';

/** What Discord's profile, as Supabase keeps it, says of the player. */
export function accountOf(user: User): Account {
  const meta = user.user_metadata ?? {};
  const name = meta.custom_claims?.global_name ?? meta.full_name ?? meta.name ?? meta.user_name ?? 'Игрок';
  return { id: user.id, name, ...(meta.avatar_url ? { avatar: meta.avatar_url } : {}) };
}

/**
 * Accounts on Supabase, signed in with Discord in the player's own browser. The browser comes back to a
 * one-off listener of the app on this computer with a code, traded here for a session (PKCE: the code is
 * worthless without the secret this app keeps). The session lives in the app's settings.
 */
export function createSupabaseAccounts(platform: PlatformAdapter): Accounts {
  const storage: SupportedStorage = {
    getItem: async (key) => (await platform.readSetting<string>(`auth:${key}`)) ?? null,
    setItem: (key, value) => platform.writeSetting(`auth:${key}`, value),
    removeItem: (key) => platform.writeSetting(`auth:${key}`, null),
  };
  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { flowType: 'pkce', storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });

  return {
    current: async () => (await platform.readSetting<Account | null>(ACCOUNT_KEY)) ?? null,

    async signIn() {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: platform.signInRedirect, skipBrowserRedirect: true },
      });
      if (error || !data.url) throw new SignInError('failed', error?.message);
      const back = new URLSearchParams(
        await platform.signInInBrowser(data.url).catch((e: unknown) => {
          const message = e instanceof Error ? e.message : String(e);
          throw new SignInError(message === 'cancelled' || message === 'unsupported' ? message : 'failed', message);
        }),
      );
      const code = back.get('code');
      if (!code) throw new SignInError('failed', back.get('error_description') ?? back.get('error') ?? undefined);
      const exchanged = await client.auth.exchangeCodeForSession(code);
      if (exchanged.error) throw new SignInError('failed', exchanged.error.message);
      const account = accountOf(exchanged.data.user);
      await platform.writeSetting(ACCOUNT_KEY, account);
      return account;
    },

    cancelSignIn: () => void platform.cancelSignIn(),

    async signOut() {
      // Signed out on this computer even offline: the session is forgotten here whatever the server says.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
      await platform.writeSetting(ACCOUNT_KEY, null);
    },
  };
}
