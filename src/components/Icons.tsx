export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    leaf: (
      <>
        <path d="M20 4C11 3 3 8 6 16c8 5 14-3 14-12Z" />
        <path d="m4 21 12-12" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    family: (
      <>
        <rect x="8" y="3" width="8" height="5" rx="1" />
        <path d="M12 8v5M4 13h16M4 13v3m8-3v3m8-3v3" />
        <rect x="1" y="16" width="6" height="5" rx="1" />
        <rect x="9" y="16" width="6" height="5" rx="1" />
        <rect x="17" y="16" width="6" height="5" rx="1" />
      </>
    ),
    ancestors: (
      <>
        <path d="M12 21v-7M4 10h16M4 10V6m16 4V6m-8 8v-4" />
        <circle cx="4" cy="3" r="2" />
        <circle cx="20" cy="3" r="2" />
        <circle cx="12" cy="21" r="2" />
      </>
    ),
    descendants: (
      <>
        <path d="M12 3v7M4 14h16M4 14v4m16-4v4m-8-8v4" />
        <circle cx="4" cy="21" r="2" />
        <circle cx="20" cy="21" r="2" />
        <circle cx="12" cy="3" r="2" />
      </>
    ),
    path: (
      <>
        <circle cx="4" cy="5" r="2" />
        <circle cx="20" cy="19" r="2" />
        <path d="M6 5h9a4 4 0 0 1 0 8H9a3 3 0 0 0 0 6h9" />
      </>
    ),
    arrow: (
      <>
        <path d="M4 12h16m-6-6 6 6-6 6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4m10-4v4M3 11h18" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    book: (
      <>
        <path d="M12 5v16M12 5C9 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-4-1-7-1-10 1Z" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.leaf}
    </svg>
  );
}
