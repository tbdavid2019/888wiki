export const NOTEPAD_ICON_SVG = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="David888 Wiki Notepad">
  <defs>
    <linearGradient id="notepad-cover" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#faf6ed" />
      <stop offset="100%" stop-color="#f0e6d5" />
    </linearGradient>
    <linearGradient id="notepad-accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c8654b" />
      <stop offset="100%" stop-color="#a6442b" />
    </linearGradient>
    <linearGradient id="notepad-fold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#e2dacd" />
    </linearGradient>
    <filter id="soft-shadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#2c2a29" flood-opacity="0.18" />
    </filter>
  </defs>

  <g filter="url(#soft-shadow)">
    <!-- Main notebook base -->
    <rect x="64" y="40" width="384" height="432" rx="28" fill="url(#notepad-cover)" stroke="#d4c9b8" stroke-width="8" />
    
    <!-- Top header binding bar -->
    <rect x="64" y="40" width="384" height="76" rx="28" fill="url(#notepad-accent)" />
    <rect x="64" y="88" width="384" height="28" fill="url(#notepad-accent)" />
    
    <!-- Bottom corner fold -->
    <path d="M448 376v96l-96-96h68c15.464 0 28-12.536 28-28z" fill="url(#notepad-fold)" stroke="#c8bca9" stroke-width="6" stroke-linejoin="round" />
  </g>

  <!-- Binding spiral holes -->
  <g fill="#faf6ed" opacity="0.95">
    <circle cx="128" cy="78" r="14" />
    <circle cx="213" cy="78" r="14" />
    <circle cx="298" cy="78" r="14" />
    <circle cx="383" cy="78" r="14" />
  </g>

  <!-- Left margin indicator -->
  <rect x="108" y="148" width="8" height="272" rx="4" fill="#c8654b" opacity="0.45" />

  <!-- Clean lined notebook rules -->
  <g stroke="#d8cebe" stroke-width="8" stroke-linecap="round" opacity="0.9">
    <line x1="140" y1="184" x2="400" y2="184" />
    <line x1="140" y1="240" x2="400" y2="240" />
    <line x1="140" y1="296" x2="400" y2="296" />
    <line x1="140" y1="352" x2="340" y2="352" />
  </g>

  <!-- Lucide-inspired Edit Sparkle / Quill Accent -->
  <g fill="none" stroke="url(#notepad-accent)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">
    <path d="m280 290 80-80a14 14 0 0 1 20 20l-80 80-26 6 6-26z" fill="#ffffff" fill-opacity="0.9" />
    <path d="m345 225 20 20" />
  </g>
</svg>`
