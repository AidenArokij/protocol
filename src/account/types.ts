/** The player signed in on this computer: what Discord says of them. */
export interface Account {
  id: string;
  /** Their Discord name. */
  name: string;
  /** Their Discord avatar, if they have one. */
  avatar?: string;
}

/** The signed-in player, kept in the settings: known at the next start without the internet. */
export const ACCOUNT_KEY = 'account';

/** Why a sign-in ended without an account. */
export class SignInError extends Error {
  constructor(
    readonly reason: 'cancelled' | 'unsupported' | 'failed',
    message?: string,
  ) {
    super(message ?? reason);
  }
}

/**
 * Accounts (2.1): signing in with Discord is optional for now; without it the helper works as before.
 * Behind this interface so the UI and its tests never touch Supabase.
 */
export interface Accounts {
  /** The signed-in player, or nobody. Needs no internet once signed in. */
  current(): Promise<Account | null>;
  /** Opens Discord in the browser and waits until the player comes back signed in; throws a `SignInError`. */
  signIn(): Promise<Account>;
  /** Gives up the sign-in under way: `signIn` then throws «cancelled». */
  cancelSignIn(): void;
  signOut(): Promise<void>;
}
