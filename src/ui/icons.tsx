import { SYMBOLS, type SymbolName } from './symbols';

/**
 * Icons of the whole app: Material Symbols Rounded (see scripts/icons.mjs), drawn in the current text colour.
 * The brand marks (GitHub, Discord) are their own.
 */
function Symbol({ name, size }: { name: SymbolName; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
      <path d={SYMBOLS[name]} />
    </svg>
  );
}

type Size = { size?: number };
const icon = (name: SymbolName, fallback: number) => ({ size = fallback }: Size) => <Symbol name={name} size={size} />;

export const SearchIcon = icon('search', 20);
export const MenuIcon = icon('menu', 20);
export const SettingsIcon = icon('settings', 19);
export const BackIcon = icon('arrow_back', 18);
export const PlusIcon = icon('add', 18);
export const CheckIcon = icon('check', 18);
export const ChevronLeftIcon = icon('chevron_left', 16);
export const ChevronRightIcon = icon('chevron_right', 16);
export const ChevronDownIcon = icon('keyboard_arrow_down', 16);
export const WarnIcon = icon('warning', 17);
export const ExternalIcon = icon('open_in_new', 13);
/** Filled star for wanted levels. */
export const StarIcon = icon('star-fill', 12);
export const ArrowRightIcon = icon('arrow_forward', 22);
export const PinIcon = icon('keep', 18);
export const CloseIcon = icon('close', 18);
export const DownloadIcon = icon('download', 18);
export const GripIcon = icon('drag_indicator', 14);
export const KeyboardIcon = icon('keyboard', 18);
export const ResizeIcon = icon('resize', 12);
export const PagesIcon = icon('view_carousel', 14);
/** Short form of a card: the lines drawn together. */
export const CompactIcon = icon('unfold_less', 14);
export const DocumentsIcon = icon('description', 20);
export const CalculatorIcon = icon('calculate', 20);
export const MemoIcon = icon('sticky_note_2', 20);
export const ProfileIcon = icon('account_circle', 20);
export const PaletteIcon = icon('palette', 18);

/** Star for favourites: outlined, and filled when its button is on (`.fav--on`). */
export const FavoriteIcon = ({ size = 20 }: Size) => (
  <svg width={size} height={size} viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true">
    <path className="icon-off" d={SYMBOLS.star} />
    <path className="icon-on" d={SYMBOLS['star-fill']} />
  </svg>
);

/** The badge of an organisation, by its id in the server's organizations.json. */
const ORGANIZATION_SYMBOLS: Record<string, SymbolName> = {
  mvd: 'local_police',
  gibdd: 'traffic',
  fsb: 'security',
  fso: 'verified_user',
  army: 'military_tech',
  sk: 'policy',
  prosecutor: 'gavel',
  court: 'balance',
  government: 'account_balance',
  duma: 'how_to_vote',
  hospital: 'local_hospital',
  news: 'newspaper',
  media: 'newspaper',
  advocate: 'cases',
  opg: 'skull',
  none: 'person',
};

/** The icon of an organisation; one without a badge of its own gets a person. */
export const organizationSymbol = (id: string): SymbolName => ORGANIZATION_SYMBOLS[id] ?? 'person';

export const OrganizationIcon = ({ id, size = 18 }: { id: string } & Size) => <Symbol name={organizationSymbol(id)} size={size} />;

/** The GitHub mark. */
export const GitHubIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"
    />
  </svg>
);

/** The Discord mark. */
export const DiscordIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.62-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 5.99 3.03.08.08 0 0 0 .09-.03c.46-.63.87-1.3 1.22-2a.08.08 0 0 0-.04-.1 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.12l.37-.3a.07.07 0 0 1 .08 0c3.93 1.8 8.18 1.8 12.06 0a.07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.88.9a.08.08 0 0 0-.04.1c.36.7.78 1.36 1.23 2a.08.08 0 0 0 .08.02 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.05c.5-5.18-.84-9.68-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z"
    />
  </svg>
);
