import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SignInError, type Account, type Accounts } from './types';

/** Where the player is with their account. */
export type AccountStatus =
  | { kind: 'loading' }
  | { kind: 'signed-out'; error?: SignInError['reason'] }
  | { kind: 'signing-in' }
  | { kind: 'signed-in'; account: Account };

export interface AccountControl {
  status: AccountStatus;
  signIn(): void;
  cancelSignIn(): void;
  signOut(): void;
}

const AccountContext = createContext<AccountControl | null>(null);

export function AccountProvider({ accounts, children }: { accounts: Accounts; children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    void accounts.current().then((account) => {
      if (active) setStatus(account ? { kind: 'signed-in', account } : { kind: 'signed-out' });
    });
    return () => {
      active = false;
    };
  }, [accounts]);

  const signIn = useCallback(() => {
    setStatus({ kind: 'signing-in' });
    accounts.signIn().then(
      (account) => setStatus({ kind: 'signed-in', account }),
      (error: unknown) => {
        const reason = error instanceof SignInError ? error.reason : 'failed';
        setStatus(reason === 'cancelled' ? { kind: 'signed-out' } : { kind: 'signed-out', error: reason });
      },
    );
  }, [accounts]);
  const cancelSignIn = useCallback(() => accounts.cancelSignIn(), [accounts]);
  const signOut = useCallback(() => {
    void accounts.signOut().then(() => setStatus({ kind: 'signed-out' }));
  }, [accounts]);

  const control = useMemo(() => ({ status, signIn, cancelSignIn, signOut }), [status, signIn, cancelSignIn, signOut]);
  return <AccountContext.Provider value={control}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountControl {
  const control = useContext(AccountContext);
  if (!control) throw new Error('useAccount must be used inside <AccountProvider>');
  return control;
}
