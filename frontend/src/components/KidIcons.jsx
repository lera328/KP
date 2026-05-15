/**
 * Минималистичные SVG-иконки в стиле Lucide.
 * Используются для детского интерфейса (1.5px stroke).
 */

const baseProps = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconHome = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M3 12 12 3l9 9" />
    <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
  </svg>
);

export const IconCalendar = (props) => (
  <svg {...baseProps} {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
  </svg>
);

export const IconPalette = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3.5 3H16a2 2 0 0 0-2 2c0 .5.2 1 .5 1.5.3.5.5 1 .5 1.5 0 1-1 1-3 1Z" />
    <circle cx="7.5" cy="10.5" r="1" fill="currentColor" />
    <circle cx="11.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="16" cy="10" r="1" fill="currentColor" />
  </svg>
);

export const IconTrophy = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
    <path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3" />
  </svg>
);

export const IconPlus = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconArrowRight = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const IconLogout = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const IconClock = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

export const IconWallet = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
    <path d="M3 7v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9H7a2 2 0 0 1-2-2" />
    <circle cx="16" cy="14" r="1.25" fill="currentColor" />
  </svg>
);

export const IconUsers = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20c0-2.5-1.7-4.6-4-5.5" />
  </svg>
);

export const IconCheck = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M5 12l4 4 10-10" />
  </svg>
);

export const IconSearch = (props) => (
  <svg {...baseProps} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

export const IconLayers = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 3 3 8l9 5 9-5-9-5Z" />
    <path d="M3 13l9 5 9-5" />
    <path d="M3 18l9 5 9-5" />
  </svg>
);

export const IconChart = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M3 3v18h18" />
    <path d="M7 14l4-4 3 3 5-6" />
  </svg>
);

export const IconBell = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
    <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
  </svg>
);

export const IconAlert = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M12 3 2 21h20L12 3Z" />
    <path d="M12 10v5M12 18h.01" />
  </svg>
);

export const IconRefresh = (props) => (
  <svg {...baseProps} {...props}>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    <path d="M3 21v-5h5" />
  </svg>
);

export const KID_ICONS = {
  home: IconHome,
  calendar: IconCalendar,
  palette: IconPalette,
  trophy: IconTrophy,
  clock: IconClock,
  wallet: IconWallet,
  users: IconUsers,
  layers: IconLayers,
  chart: IconChart,
  bell: IconBell,
  alert: IconAlert,
  refresh: IconRefresh,
};
