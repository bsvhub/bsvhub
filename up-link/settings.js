/* ═══════════════════════════════════════════════════════════════
   settings.js — Global Configuration Object
   ═══════════════════════════════════════════════════════════════

   PURPOSE:  Single source of truth for all configurable parameters.
             Theme colours, typography, layout grid, responsive
             breakpoints, field limits, categories, languages,
             blockchain parameters, CDN URLs, tip amounts.

   INPUTS:   None (static config).

   OUTPUTS:  window.SETTINGS — global config object read by all modules.

   DEPENDS:  None (loads first, before all other JS).

   NOTES:    Extracted verbatim from up-link.html lines 26-441.
             Rule 05: this IS the user config menu.
             Change values here to retheme/reconfigure the entire app.
             Also bootstraps the App namespace so onchain.js / offline.js
             can register capabilities before app-core.js loads.
   ═══════════════════════════════════════════════════════════════ */

// Bootstrap App namespace — must exist before onchain.js / offline.js load
var App = {};
App.Capabilities = { offline: false, onchain: false };

var SETTINGS = {

  /* ─── THEME: COLOURS ─────────────────────────────────────────────
     These control every colour on the page.
     Change these to completely re-skin the design.
     ─────────────────────────────────────────────────────────────── */

  // Main background colour (the dark base behind everything)
  BG_COLOUR: '#0d0a1a',

  // Background gradient — the 3-colour sweep across the whole page
  // Format: "colour1, colour2, colour3" — goes diagonally top-left to bottom-right
  BG_GRADIENT_COLOURS: '#555555, #6a0dad, #001f54',

  // Gradient direction in degrees (135 = diagonal top-left → bottom-right)
  BG_GRADIENT_ANGLE: 135,

  // Panel background — the dark glass behind each box
  PANEL_BG: 'rgba(25, 25, 25, 0.85)',

  // Primary gold/amber colour — used for labels, buttons, highlights
  AMBER: '#EAB300',

  // Dimmed amber — used for less important labels
  AMBER_DIM: '#9a7800',

  // Accent colour — the bold orange used for borders and warnings
  ACCENT_COLOUR: '#ff5733',

  // Gold — used for tip amounts and fee displays
  GOLD: '#ffcc66',

  // Yellow highlight — used for hover tooltips
  HIGHLIGHT: '#fada4e',

  // Default text colour (light lavender)
  TEXT_COLOUR: '#d4d0e0',

  // Dimmed text — for secondary info and placeholders
  TEXT_DIM: 'rgba(200,200,200,0.6)',

  // Mandatory field colour — blood orange for required field labels
  MANDATORY: '#e84420',

  // Success green — used for "connected", "loaded", checkmarks
  GREEN: '#00cc44',

  // Soft blue — for subtle info highlights
  BLUE_SOFT: 'rgba(135,206,235,0.8)',

  // Border colour — the dark blue outline around panels
  BORDER: '#2e3f66',

  // Border with opacity — used for internal dividers
  BORDER_FAINT: 'rgba(46,63,102,0.7)',

  // Input field background
  INPUT_BG: 'rgba(15,10,30,0.9)',


  /* ─── THEME: TYPOGRAPHY ──────────────────────────────────────────
     Font family and base sizes. Change the font to re-style text.
     ─────────────────────────────────────────────────────────────── */

  // Main font — used everywhere (must be monospace for the terminal look)
  FONT_FAMILY: "'JetBrains Mono', 'Courier New', monospace",

  // Base font size in pixels (everything scales from this)
  FONT_SIZE_BASE: 14,

  // Global letter spacing in pixels
  LETTER_SPACING: 1,


  /* ─── LAYOUT: SHELL & GRID ──────────────────────────────────────
     The shell is the master box that holds everything.
     The grid splits the middle area into 6 panels (3 rows × 2 cols).
     ─────────────────────────────────────────────────────────────── */

  // Shell aspect ratio — width:height (26:18 = slightly wide rectangle)
  SHELL_ASPECT_W: 26,
  SHELL_ASPECT_H: 18,

  // Gap between all panels and bars (in pixels)
  GRID_GAP: 2,

  // Grid column split — "13fr 13fr" means equal halves (50/50)
  // Try "10fr 16fr" to make left column narrower
  GRID_COLUMNS: '13fr 13fr',

  // Grid row heights — row1 : row2 : row3 proportions
  // "11fr 9fr 10fr" means: row1 tallest, row2 shortest, row3 middle
  GRID_ROWS: '11fr 9fr 10fr',

  // Panel blur effect strength (higher = more frosted glass)
  PANEL_BLUR: 2,


  /* ─── LAYOUT: RESPONSIVE SCALING ─────────────────────────────────
     These prevent the UI from being tiny on big monitors.
     Each breakpoint bumps up the font size and caps the height.
     ─────────────────────────────────────────────────────────────── */

  // Breakpoint 1: screens wider than this get bigger text
  SCALE_BP1_WIDTH: 1600,    // pixels
  SCALE_BP1_FONT: 16,       // font size at this breakpoint
  SCALE_BP1_MAX_H: 1050,    // max shell height in pixels

  // Breakpoint 2: even larger screens
  SCALE_BP2_WIDTH: 2200,
  SCALE_BP2_FONT: 18,
  SCALE_BP2_MAX_H: 1280,

  // Breakpoint 3: ultra-wide / 4K monitors
  SCALE_BP3_WIDTH: 3000,
  SCALE_BP3_FONT: 22,
  SCALE_BP3_MAX_H: 1700,

  // Mobile breakpoint — below this width, switch to single-column layout
  MOBILE_BREAKPOINT: 680,


  /* ─── CONTENT: TITLE BAR ─────────────────────────────────────────
     The top bar text and version label.
     ─────────────────────────────────────────────────────────────── */

  // Title text shown in the top-left (first part is gold, second part is orange)
  TITLE_PREFIX: 'WEB3',
  TITLE_SUFFIX: 'DIR',
  TITLE_DIVIDER: ' // ',

  // Logo font size
  LOGO_FONT_SIZE: 20,

  // Logo letter spacing
  LOGO_LETTER_SPACING: 3,


  /* ─── CONTENT: STATUS BAR ────────────────────────────────────────
     The bottom bar messages and version label.
     ─────────────────────────────────────────────────────────────── */

  // Right-side label in the status bar (per screen)
  STATUSBAR_LABEL_S1: 'UP-LINK // SUBMIT v2.4',
  STATUSBAR_LABEL_S2: 'UP-LINK // SUBMIT v2.4',
  STATUSBAR_LABEL_S3: 'UP-LINK // VIEW v2.4',

  // Default status message when page first loads
  STATUSBAR_DEFAULT_MSG: 'READY // CONNECT WALLET TO BEGIN',


  /* ─── CONTENT: PANEL LABELS ──────────────────────────────────────
     The amber headers inside each panel. Change text here to rename panels.
     ─────────────────────────────────────────────────────────────── */

  LABEL_DETAILS: 'APP DETAILS',
  LABEL_ICON: 'ICON UPLOAD',
  LABEL_DESC: 'DESCRIPTION',
  LABEL_DEV: 'DEVELOPER',
  LABEL_FEATURES: 'FEATURES',
  LABEL_TRANSMIT: 'TRANSMIT',


  /* ─── CONTENT: CATEGORIES ────────────────────────────────────────
     Unified category array — mutually exclusive, one selected at a time.
     Each entry can define: subcategories, mandatory fields, overrides.
     Add/remove categories here — UI auto-adjusts (always 2 rows).
     ─────────────────────────────────────────────────────────────── */
  CATEGORIES: [
    { value: 'bsvhub', label: 'BSVHUB.IO', color: '#EAB300', bg: 'rgba(234,179,0,0.07)', border: 'rgba(234,179,0,0.4)',
      default: true,
      mandatory: ['name', 'url', 'subcategory', 'description'],
      subcategories: ['tool','app','wallet','exchange','market','info','dev.','social media',
        { value: 'app idea', mandatory: ['description'], overrides: { MAX_DESC_CHARS: 1024 } }
      ]
    },
    { value: 'game',           label: 'GAME',  color: '#F0997B', bg: 'rgba(216,90,48,0.15)',   border: 'rgba(216,90,48,0.6)',
      subcategories: ['action','rpg','strategy','puzzle','simulation','sports','adventure','card','casual'] },
    { value: 'app',            label: 'APP',   color: '#AFA9EC', bg: 'rgba(127,119,221,0.15)', border: 'rgba(127,119,221,0.6)',
      subcategories: ['productivity','social','utility','education','health','news','travel','lifestyle'] },
    { value: 'website',        label: 'WEB',   color: '#85B7EB', bg: 'rgba(55,138,221,0.15)',  border: 'rgba(55,138,221,0.6)',
      subcategories: ['blog','portfolio','news','community','directory','landing','ecommerce'] },
    { value: 'marketplace',    label: 'MKT',   color: '#EF9F27', bg: 'rgba(186,117,23,0.15)',  border: 'rgba(186,117,23,0.6)',
      subcategories: ['nft','digital','physical','art','music','collectibles','gaming-items'] },
    { value: 'media',          label: 'MEDIA', color: '#ED93B1', bg: 'rgba(212,83,126,0.15)',  border: 'rgba(212,83,126,0.6)',
      subcategories: ['video','audio','podcast','streaming','music','photography','animation'] },
    { value: 'developer',      label: 'DEV',   color: '#5DCAA5', bg: 'rgba(29,158,117,0.15)',  border: 'rgba(29,158,117,0.6)',
      subcategories: ['library','api','sdk','tooling','documentation','open-source','testing'] },
    { value: 'finance',        label: 'FIN',   color: '#97C459', bg: 'rgba(99,153,34,0.15)',   border: 'rgba(99,153,34,0.6)',
      subcategories: ['wallet','exchange','defi','payments','analytics','trading','lending'] },
    { value: 'publishing',     label: 'PUB',   color: '#5DCAA5', bg: 'rgba(0,204,68,0.10)',    border: 'rgba(0,204,68,0.45)',
      subcategories: ['blog','magazine','ebook','newsletter','whitepaper'] },
    { value: 'infrastructure', label: 'INFRA', color: 'rgba(0,229,255,0.9)', bg: 'rgba(0,229,255,0.08)', border: 'rgba(0,229,255,0.4)',
      subcategories: ['node','indexer','api','storage','oracle','bridge','monitoring'] },
    { value: 'adult',          label: 'ADULT', color: '#F09595', bg: 'rgba(226,75,74,0.12)',   border: 'rgba(226,75,74,0.6)',
      subcategories: ['content','social','gaming'] },
  ],
  MAX_SUBCATEGORIES: 3,

  /* ─── CONTENT: SCREENSHOTS ───────────────────────────────────────
     Screenshot slots 2-5 in the icon panel slot strip.
     ─────────────────────────────────────────────────────────────── */
  MAX_SCREENSHOTS: 4,
  MAX_SCREENSHOT_BYTES: 262144,


  /* ─── LAYOUT: PANEL FONT CAPS ────────────────────────────────────
     Maximum font size (px) for each panel's auto-scaling system.
     Panels not listed here are uncapped (scale up to 28px max).
     Set a value to null to remove a cap and let it scale freely.
     Panel IDs: panel-titlebar, panel-icon, panel-details,
                panel-desc, panel-dev, panel-feat, panel-tx,
                panel-statusbar
     ─────────────────────────────────────────────────────────────── */
  PANEL_FONT_CAPS: {
    'panel-titlebar':  16,   // Title bar       (top row)
    'panel-icon':      14,   // Icon Design
    'panel-details':   null, // App Details     — uncapped
    'panel-desc':      16,   // Description
    'panel-dev':       12,   // Developer
    'panel-feat':      null, // Features        — uncapped
    'panel-tx':        22,   // Transmit
    'panel-statusbar': 14,   // Status bar      (bottom row)
  },


  /* ─── CONTENT: LANGUAGES ─────────────────────────────────────────
     The dropdown options in the language selector.
     ─────────────────────────────────────────────────────────────── */

  LANGUAGES: [
    { value: 'zh', label: 'ZH — CHINESE',    default: false },
    { value: 'en', label: 'EN — ENGLISH',    default: true  },
    { value: 'fr', label: 'FR — FRENCH',     default: false },
    { value: 'de', label: 'DE — GERMAN',     default: false },
    { value: 'ja', label: 'JA — JAPANESE',   default: false },
    { value: 'pl', label: 'PL — POLISH',     default: false },
    { value: 'pt', label: 'PT — PORTUGUESE', default: false },
    { value: 'ru', label: 'RU — RUSSIAN',    default: false },
    { value: 'es', label: 'ES — SPANISH',    default: false },
  ],

  // Max number of languages a user can select at once
  MAX_LANGUAGES: 5,


  /* ─── CONTENT: STATUS OPTIONS ────────────────────────────────────
     The dropdown options and their associated colours in the preview.
     ─────────────────────────────────────────────────────────────── */

  STATUSES: [
    { value: 'alpha',      label: 'ALPHA',      colour: '#ff5733'              },
    { value: 'beta',       label: 'BETA',       colour: '#ffcc66'              },
    { value: 'live',       label: 'LIVE',       colour: '#00cc44'              },
    { value: 'deprecated', label: 'DEPRECATED', colour: 'rgba(255,255,255,0.3)' },
    { value: 'delisted',   label: 'DELISTED',   colour: '#ff3c3c'              },
  ],


  /* ─── LIMITS: FIELD CONSTRAINTS ──────────────────────────────────
     Maximum lengths for text fields and features.
     These enforce limits in the UI and show in the gauges.
     ─────────────────────────────────────────────────────────────── */

  // App name max characters
  MAX_NAME_CHARS: 64,

  // URL max characters (2048 is the practical web standard)
  MAX_URL_CHARS: 2048,
  MAX_TOR_CHARS: 256,
  MAX_BSV_CHARS: 256,

  // Tags field max characters
  MAX_TAGS_CHARS: 128,

  // Description textarea max characters
  MAX_DESC_CHARS: 256,

  // Bio textarea max characters
  MAX_BIO_CHARS: 128,

  // Max characters in a single word (no spaces). Words longer than this
  // are blocked. Underscores count as spaces and do NOT break this rule.
  MAX_WORD_LENGTH: 64,

  // Number of feature slots (each gets its own input)
  MAX_FEATURES: 6,

  // Max characters per single feature
  MAX_FEATURE_CHARS: 128,

  // Max characters across ALL features combined
  MAX_FEATURES_COMBINED: 256,

  // Version field max characters (XXX.XXX.XXX)
  MAX_VERSION_CHARS: 11,

  // Abbreviation field max characters
  MAX_ABBR_CHARS: 16,

  // Twitter handle max characters
  MAX_TWITTER_CHARS: 32,

  // GitHub URL max characters
  MAX_GITHUB_CHARS: 128,

  // Alt text max characters
  MAX_ALT_CHARS: 64,


  /* ─── LIMITS: ICON CONSTRAINTS ───────────────────────────────────
     Rules for uploaded icon files.
     ─────────────────────────────────────────────────────────────── */

  // Max icon file size in bytes (131072 = 128kb)
  MAX_ICON_BYTES: 131072,

  // Accepted file types for the browse dialog
  ICON_ACCEPT: '.svg,.png,.webp,.avif,image/svg+xml,image/png,image/webp,image/avif',
  SS_ACCEPT:   '.png,.jpg,.jpeg,.webp,.avif,image/png,image/jpeg,image/webp,image/avif',

  // Default icon background colour (shown in the preview square)
  ICON_DEFAULT_BG: 'red',

  // Default icon foreground colour
  ICON_DEFAULT_FG: 'blue',

  // Whether BG colour is enabled by default (checked)
  ICON_BG_ENABLED: false,

  // Whether FG colour is enabled by default (unchecked = no gradient by default)
  ICON_FG_ENABLED: false,

  // Default alpha (opacity) for icon background gradient
  ICON_DEFAULT_ALPHA: 1,

  // Default zoom level for icon
  ICON_DEFAULT_ZOOM: 1,

  // Zoom slider range
  ICON_ZOOM_MIN: 0.5,
  ICON_ZOOM_MAX: 2,
  ICON_ZOOM_STEP: 0.05,

  // Alpha slider range
  ICON_ALPHA_MIN: 0,
  ICON_ALPHA_MAX: 1,
  ICON_ALPHA_STEP: 0.05,


  /* ─── NETWORK: BSV TRANSACTION ───────────────────────────────────
     Blockchain-related constants for the MAP protocol transaction.
     ─────────────────────────────────────────────────────────────── */

  // Fallback fee estimate in satoshis (used when wallet.js estimate unavailable)
  BASE_FEE_SATS: 20,

  // Protocol identifier written to every MAP transaction
  PROTOCOL_PREFIX: 'up-link',

  // Protocol version
  PROTOCOL_VERSION: '1',

  // Network label shown in the Transmit panel
  NETWORK_LABEL: 'BSV MAINNET',

  // Protocol label shown in the Transmit panel
  PROTOCOL_LABEL: 'MAP v1',

  // Tip preset amounts in BSV (shown as checkbox options)
  TIP_AMOUNTS: [0.001, 0.01, 0.1, 1],
  TIP_ADDRESS: '1HK9fJFQ4ViawZvoPMqJpL2B6Z1P7f3XWd',


  /* ─── NETWORK: CDN ENDPOINTS ─────────────────────────────────────
     URLs used to fetch on-chain images (icon + screenshots).
     {txid} is replaced with the full txid_suffix string.
     ─────────────────────────────────────────────────────────────── */

  CDN_URLS: [
    'https://ordinals.gorillapool.io/content/{txid}',
    'https://ordfs.network/{txid}',
    'https://1satordinals.com/content/{txid}',
  ],

  // Timeout for fetch attempts in milliseconds
  FETCH_TIMEOUT_MS: 6000,

  // Timeout for image load attempts in milliseconds
  IMG_LOAD_TIMEOUT_MS: 8000,

  // Timeout for display-only image attempts
  IMG_DISPLAY_TIMEOUT_MS: 7000,


  /* ─── PREVIEW: CARD TILE ─────────────────────────────────────────
     Dimensions for the BSVHub-style icon tile in the preview overlay.
     ─────────────────────────────────────────────────────────────── */

  // Icon tile size in the preview card (pixels)
  PREVIEW_TILE_SIZE: 160,

  // Icon tile border radius (pixels) — higher = more rounded
  PREVIEW_TILE_RADIUS: 20,

  // Icon tile border width (pixels)
  PREVIEW_TILE_BORDER: 4,


  /* ─── WALLET: MOCK DATA ──────────────────────────────────────────
     Placeholder data for the mock wallet connection.
     [BSV-HOOK] Replace these with real wallet SDK calls.
     ─────────────────────────────────────────────────────────────── */

  // Mock paymail shown when "connected"
  MOCK_PAYMAIL: 'yourname@handcash.io',

  // Mock display paymail (uppercase for status bar)
  MOCK_PAYMAIL_DISPLAY: 'YOURNAME@HANDCASH.IO',
};
