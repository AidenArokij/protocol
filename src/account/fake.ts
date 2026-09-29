import { SignInError, type Account, type Accounts } from './types';

export interface FakeAccounts extends Accounts {
  /** The browser comes back: signed in as this player, or failed. */
  finishSignIn(result: Account | 'failed'): void;
  readonly calls: string[];
}

/** Accounts in memory, for tests and the browser preview: a sign-in waits until `finishSignIn`. */
export function createFakeAccounts(signedIn: Account | null = null): FakeAccounts {
  let account = signedIn;
  let waiting: { resolve: (account: Account) => void; reject: (error: SignInError) => void } | null = null;
  const calls: string[] = [];
  return {
    calls,
    current: async () => account,
    signIn() {
      calls.push('signIn');
      return new Promise((resolve, reject) => {
        waiting = { resolve, reject };
      });
    },
    cancelSignIn() {
      calls.push('cancelSignIn');
      waiting?.reject(new SignInError('cancelled'));
      waiting = null;
    },
    async signOut() {
      calls.push('signOut');
      account = null;
    },
    finishSignIn(result) {
      if (result === 'failed') waiting?.reject(new SignInError('failed'));
      else {
        account = result;
        waiting?.resolve(result);
      }
      waiting = null;
    },
  };
}
