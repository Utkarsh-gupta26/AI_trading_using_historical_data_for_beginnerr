/**
 * js/icons.js — Monochrome SVG Icon Library for AIOT
 * Clean, single-color vector glyphs using currentColor.
 */
'use strict';

const AIOT_ICONS = {
  // Navigation & Core Features
  markets: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-6"/><circle cx="7" cy="16" r="1.5"/><circle cx="11" cy="12" r="1.5"/><circle cx="15" cy="16" r="1.5"/><circle cx="20" cy="10" r="1.5"/></svg>`,
  chart: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="5" width="4" height="14" rx="1"/><path d="M5 2v3m0 14v3"/><rect x="10" y="8" width="4" height="8" rx="1"/><path d="M12 4v4m0 8v4"/><rect x="17" y="3" width="4" height="12" rx="1"/><path d="M19 1v2m0 12v4"/></svg>`,
  watchlist: `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
  positions: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v3"/><path d="M12 12v3m-3-1.5h6"/></svg>`,
  risk: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 3v18m-9-6l9-3 9 3M5 18a4 4 0 0 0 6 0m4 0a4 4 0 0 0 6 0"/><circle cx="12" cy="3" r="1"/></svg>`,
  plan: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6m-6 4h6m-6 4h4"/><path d="M9 3v2m6-2v2"/></svg>`,
  journal: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M8 7h8m-8 4h6"/></svg>`,
  logs: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>`,
  analytics: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>`,
  habits: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2a9 9 0 0 0-9 9c0 3.6 2.2 6.7 5.3 8 .4.2.7.5.7.9v.6a1.5 1.5 0 0 0 1.5 1.5h3a1.5 1.5 0 0 0 1.5-1.5v-.6c0-.4.3-.7.7-.9 3.1-1.3 5.3-4.4 5.3-8a9 9 0 0 0-9-9z"/><path d="M9 10h6m-6 3h4"/></svg>`,
  global: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  regime: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  calendar: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  news: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1m0 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2m2 13H9"/><path d="M7 8h6m-6 4h6m-6 4h4"/></svg>`,
  breadth: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>`,
  prediction: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>`,
  scanner: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5 12a10 10 0 0 1 14 0m-11 3a6 6 0 0 1 8 0m-5 3a2 2 0 0 1 2 0"/><line x1="12" y1="20" x2="12" y2="23"/><circle cx="12" cy="19" r="1"/></svg>`,
  backtest: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M9 3h6m-4 0v6l-5 8a2 2 0 0 0 1.7 3h8.6a2 2 0 0 0 1.7-3l-5-8V3"/></svg>`,
  replay: `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="11 19 2 12 11 5 11 19"/><polygon points="22 19 13 12 22 5 22 19"/></svg>`,
  ai: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M8 15h8"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/></svg>`,
  settings: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,

  // UI Actions & Tooling
  search: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  bell: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  chat: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  close: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  send: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,
  check: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>`,
  refresh: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  table: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>`,
  cards: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`,
  arrowUp: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
  arrowDown: `<svg class="svg-icon" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
  externalLink: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  chevronLeft: `<svg class="svg-icon" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>`,
  sparkle: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12 2l2.4 7.4L22 12l-7.6 2.6L12 22l-2.4-7.4L2 12l7.6-2.6z"/></svg>`
};

// Global helper to render an icon
window.renderIcon = function(name, extraClass = '') {
  const svg = AIOT_ICONS[name];
  if (!svg) return '';
  if (extraClass) {
    return svg.replace('class="svg-icon"', `class="svg-icon ${extraClass}"`);
  }
  return svg;
};
