import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakePlatform } from '../platform/fake';
import { createSupabaseAccounts } from './supabase';
import { ACCOUNT_KEY, SignInError } from './types';

const auth = {
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
};
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth }) }));

const DISCORD_PAGE = 'https://evwyrdytojwxlvgqrkar.supabase.co/auth/v1/authorize?provider=discord';
const user = {
  id: 'user-1',
  user_metadata: { full_name: 'skyze', avatar_url: 'https://cdn.discordapp.com/avatars/1/a.png', custom_claims: { global_name: 'Skyze' } },
};

beforeEach(() => {
  vi.resetAllMocks();
  auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'discord', url: DISCORD_PAGE }, error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ data: { user, session: {} }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
});

/** Starts a sign-in and waits until the browser has been sent to Discord. */
async function startSignIn() {
  const platform = createFakePlatform();
  const accounts = createSupabaseAccounts(platform);
  const signingIn = accounts.signIn();
  await vi.waitFor(() => expect(platform.calls.some((c) => c.method === 'signInInBrowser')).toBe(true));
  return { platform, accounts, signingIn };
}

describe('accounts on Supabase', () => {
  it('signs in with Discord in the browser and remembers the player for the next start, offline', async () => {
    const { platform, signingIn } = await startSignIn();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: { redirectTo: 'http://127.0.0.1:47321/auth/callback', skipBrowserRedirect: true },
    });
    expect(platform.calls.find((c) => c.method === 'signInInBrowser')?.args).toEqual([DISCORD_PAGE]);

    platform.comeBackFromSignIn('code=abc-123');
    const account = { id: 'user-1', name: 'Skyze', avatar: 'https://cdn.discordapp.com/avatars/1/a.png' };
    await expect(signingIn).resolves.toEqual(account);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc-123');
    expect(platform.settings.get(ACCOUNT_KEY)).toEqual(account);

    // The next start knows the player without asking the server.
    auth.exchangeCodeForSession.mockClear();
    await expect(createSupabaseAccounts(platform).current()).resolves.toEqual(account);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('fails when the player refuses on Discord', async () => {
    const { platform, signingIn } = await startSignIn();
    platform.comeBackFromSignIn('error=access_denied&error_description=The+resource+owner+denied+the+request');
    await expect(signingIn).rejects.toMatchObject({ reason: 'failed', message: 'The resource owner denied the request' });
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(platform.settings.get(ACCOUNT_KEY)).toBeUndefined();
  });

  it('gives up when cancelled', async () => {
    const { accounts, signingIn } = await startSignIn();
    accounts.cancelSignIn();
    await expect(signingIn).rejects.toEqual(new SignInError('cancelled'));
  });

  it('signs out on this computer even when the server cannot be reached', async () => {
    const { platform, accounts, signingIn } = await startSignIn();
    platform.comeBackFromSignIn('code=abc-123');
    await signingIn;
    auth.signOut.mockRejectedValue(new Error('offline'));
    await accounts.signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    await expect(accounts.current()).resolves.toBeNull();
  });
});
