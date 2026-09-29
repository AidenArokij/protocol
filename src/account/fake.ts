import { SignInError, type Account, type Accounts } from './types';

export interface FakeAccounts extends Accounts {
  /** The sign-in or the joining under way ends: signed in as this player, or failed for this reason. */
  finishSignIn(result: Account | SignInError['reason']): void;
  /** «signIn:discord», «linkTelegram», «signOut»… in order. */
  readonly calls: string[];
}

/** Accounts in memory, for tests: a sign-in waits until `finishSignIn`. */
export function createFakeAccounts(signedIn: Account | null = null): FakeAccounts {
  let account = signedIn;
  let waiting: { resolve: (account: Account) => void; reject: (error: SignInError) => void } | null = null;
  const calls: string[] = [];
  const wait = () =>
    new Promise<Account>((resolve, reject) => {
      waiting = { resolve, reject };
    });
  return {
    calls,
    current: async () => account,
    signIn(provider) {
      calls.push(`signIn:${provider}`);
      return wait();
    },
    linkTelegram() {
      calls.push('linkTelegram');
      return wait();
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
      if (typeof result === 'string') waiting?.reject(new SignInError(result));
      else {
        account = result;
        waiting?.resolve(result);
      }
      waiting = null;
    },
  };
}
