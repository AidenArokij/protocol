declare const __APP_VERSION__: string;

/** This build's version, from package.json. */
export const APP_VERSION = __APP_VERSION__;

export const AUTHOR = 'AidenArokij';

export const LINKS = {
  repository: 'https://github.com/AidenArokij/protocol',
};

/**
 * ПРОТОКОЛ's own AI server: it holds the AI key, so players need none (server/ in the repository). Not yet
 * running — set once the server is up.
 */
export const AI_SERVER = 'https://protocol-ai.invalid';

/** ПРОТОКОЛ grew out of РО Хелпер: its author and code are credited in the app, as the MIT licence asks. */
export const ORIGINAL = {
  name: 'РО Хелпер',
  author: 'skyze',
  repository: 'https://github.com/skyyyzeee/ro-helper',
};

/** The GitHub release page of a version: what is new in it. */
export const releaseUrl = (version: string) => `${LINKS.repository}/releases/tag/v${version}`;
