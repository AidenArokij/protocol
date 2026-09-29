import { useState } from 'react';
import type { Organization, ServerPack } from '../core';
import { useAccount } from '../account/AccountContext';
import { useSyncStatus } from '../account/SyncContext';
import type { SyncStatus } from '../account/sync';
import type { Account, Provider } from '../account/types';

const PROVIDER_NAME: Record<Provider, string> = { discord: 'Discord', telegram: 'Telegram' };
import { DiscordIcon, ProfileIcon, ServerIcon, TelegramIcon } from './icons';

/**
 * The player's Discord avatar; without one, or when it can't be loaded (offline), their initials on a
 * gradient, as in the mockup.
 */
export function Avatar({ account, size, label }: { account: Account; size: number; label?: string }) {
  const [broken, setBroken] = useState(false);
  if (!account.avatar || broken) {
    const initials = account.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase() || '?';
    return (
      <span className="avatar avatar--initials" role={label ? 'img' : undefined} aria-label={label} style={{ width: size, height: size, fontSize: size * 0.36 }}>
        {initials}
      </span>
    );
  }
  return (
    <img
      className="avatar"
      src={account.avatar}
      alt={label ?? ''}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

/** The top of the settings' column: who is signed in, or that nobody is. Leads to the account block. */
export function AccountCard({ current, onSelect }: { current: boolean; onSelect: () => void }) {
  const { status } = useAccount();
  const account = status.kind === 'signed-in' ? status.account : null;
  return (
    <button className="setnav__account" type="button" aria-current={current ? 'true' : undefined} onClick={onSelect}>
      {account ? <Avatar account={account} size={36} /> : <span className="setnav__nobody"><ProfileIcon size={22} /></span>}
      <span className="setnav__who">
        <span className="setnav__name">{account ? account.name : 'Аккаунт'}</span>
        <span className="setnav__via">{account ? PROVIDER_NAME[account.via ?? 'discord'] : 'Вход не выполнен'}</span>
      </span>
    </button>
  );
}

/** «2 мин назад» */
function ago(iso: string, now = Date.now()): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} ч назад` : new Date(iso).toLocaleDateString('ru-RU');
}

/** As in the mockup: a dot and where the settings are with the account. */
function SyncLine({ status }: { status: SyncStatus }) {
  if (status.kind === 'off') return null;
  const text =
    status.kind === 'syncing'
      ? 'Синхронизирую…'
      : status.kind === 'synced'
        ? `Настройки, избранное и наборы закреплённого синхронизированы · ${ago(status.at)}`
        : 'Нет связи — изменения отправятся, когда появится интернет';
  return (
    <div className={`syncline syncline--${status.kind}`} role="status" aria-label="Синхронизация">
      <i />
      {text}
    </div>
  );
}

const FAILED = {
  failed: 'Не удалось войти. Проверьте интернет и попробуйте ещё раз.',
  unsupported: 'Вход работает только в самом хелпере, не в браузере.',
  expired: 'Время на вход вышло — нажмите ещё раз.',
  taken: 'Этот Telegram уже привязан к другому аккаунту.',
};
const WAITING: Record<Provider, string> = {
  discord: 'Подтвердите вход в браузере — он открылся в Discord.',
  telegram: 'Нажмите «Запустить» у бота в Telegram — он открылся сам.',
};

/**
 * The account, first in the settings. Signed in: the player's card of the mockup (avatar, name,
 * server · faction, how they signed in), joining Telegram to a Discord account, and signing out. Signed
 * out: signing in with Discord or Telegram, optional for now.
 */
export function AccountSection({ server, organization }: { server: ServerPack['server']; organization?: Organization }) {
  const { status, signIn, linkTelegram, cancelSignIn, signOut } = useAccount();
  const sync = useSyncStatus();
  const faction = organization && organization.id !== 'none' ? organization.name : 'Без организации';

  if (status.kind === 'signed-in') {
    const { account } = status;
    return (
      <>
        <div className="pcard">
          <Avatar account={account} size={52} label={`Аватар ${account.name}`} />
          <div className="pcard__who">
            <div className="pcard__name">{account.name}</div>
            <div className="pcard__meta">
              <ServerIcon id={server.id} size={14} />
              {server.name} · {faction}
            </div>
          </div>
          <span className="sp" />
          <span className="pcard__via" title={`Вход через ${PROVIDER_NAME[account.via ?? 'discord']}`}>
            {account.via === 'telegram' ? <TelegramIcon size={18} /> : <DiscordIcon size={18} />}
          </span>
        </div>
        {/* Telegram joins a Discord account, so either signs in to it. */}
        {account.via !== 'telegram' && (
          <div className="set__row">
            <TelegramIcon size={16} />
            {account.telegram ? (
              <span className="set__label">
                Telegram <b className="set__value">{account.telegram}</b> привязан — через него тоже можно войти
              </span>
            ) : status.linking ? (
              <>
                <span className="set__label">{WAITING.telegram}</span>
                <span className="sp" />
                <button className="settings__button" type="button" onClick={cancelSignIn}>
                  Отмена
                </button>
              </>
            ) : (
              <>
                <span className="set__label">Привяжите Telegram, чтобы входить и через него.</span>
                <span className="sp" />
                <button className="settings__button" type="button" onClick={linkTelegram}>
                  Привязать Telegram
                </button>
              </>
            )}
          </div>
        )}
        {status.error && (
          <p className="login__error" role="alert">
            {FAILED[status.error]}
          </p>
        )}
        <div className="set__row">
          <SyncLine status={sync} />
          <span className="sp" />
          <button className="settings__button" type="button" onClick={signOut}>
            Выйти
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="login">
      <p className="login__lead">Войдите, чтобы настройки, избранное и наборы закреплённого были с вами на любом компьютере.</p>
      {status.kind === 'signing-in' ? (
        <div className="login__wait">
          <span>{WAITING[status.provider]}</span>
          <button className="settings__button" type="button" onClick={cancelSignIn}>
            Отмена
          </button>
        </div>
      ) : (
        <>
          {status.kind === 'signed-out' && status.error && (
            <p className="login__error" role="alert">
              {FAILED[status.error]}
            </p>
          )}
          <button className="oauth oauth--discord" type="button" disabled={status.kind === 'loading'} onClick={() => signIn('discord')}>
            <DiscordIcon size={20} />
            Войти через Discord
          </button>
          <button className="oauth oauth--tg" type="button" disabled={status.kind === 'loading'} onClick={() => signIn('telegram')}>
            <TelegramIcon size={20} />
            Войти через Telegram
          </button>
        </>
      )}
      <small className="login__note">
        Вход по желанию: без него всё работает как раньше. Мы получим ник, аватар и почту из Discord или имя и ник из Telegram. После входа интернет не нужен.
      </small>
    </div>
  );
}
