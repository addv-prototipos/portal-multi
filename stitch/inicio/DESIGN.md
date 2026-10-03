---
name: Fiscal Precision Audit
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#44474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c4c6ce'
  surface-tint: '#4a5f7f'
  primary: '#001229'
  on-primary: '#ffffff'
  primary-container: '#0f2744'
  on-primary-container: '#798fb1'
  inverse-primary: '#b2c8ed'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#1d0e00'
  on-tertiary: '#ffffff'
  tertiary-container: '#392100'
  on-tertiary-container: '#c57e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#b2c8ed'
  on-primary-fixed: '#021c39'
  on-primary-fixed-variant: '#324866'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  metric-numeral:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
  data-mono:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  gutter-desktop: 1.5rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

This design system establishes an authoritative, reliable, and high-velocity interface tailored for Mexican corporate fiscal compliance, CFDI 4.0 validation, and SAT audit reconciliation. It targets Chief Financial Officers, tax comptrollers, certified public accountants, and corporate audit teams who process high volumes of sensitive fiscal records under tight statutory deadlines.

The aesthetic fuses **Corporate / Modern** reliability with dense, institutional utility. The visual signature conveys institutional trust, regulatory rigour, and forensic clarity. Visual noise is eliminated in favor of clean structural lines, high-contrast data legibility, and unmistakable status messaging. Interactions favor rapid parsing, deterministic state cues, and frictionless data export.

## Colors

The palette balances institutional authority with immediate semantic feedback:

- **Primary (`#0f2744` - Deep Institutional Navy):** Used for persistent navigational chrome, authoritative table headers, primary CTAs, master metric numerals, and high-hierarchy text.
- **Secondary (`#10b981` - Emerald Green):** Signals validated audits, pristine SAT compliance, balanced ledgers, active timbrado stamps, and nominal fiscal health.
- **Tertiary (`#f59e0b` - Warm Amber):** Reserved for tax retention alerts, pending reconciliation variances, expiration warnings, and threshold cautions.
- **Critical / Purge (`#dc2626` - Deep Burgundy/Coral):** Applied strictly to audit deletions, cancelled invoices (CFDI cancelados), discrepancies in tax base, blacklist notices (Art. 69-B), and irreversible purge operations.
- **Neutral Base:** Grounded in a refined slate spectrum (`#0f172a` down to `#f8fafc`). Borders rely on `#e2e8f0` (Slate-200) to partition high-density data matrices without visual crowding.
- **Surfaces:** Pure white (`#ffffff`) for active workspaces and analysis cards, resting over an architectural canvas background of `#f1f5f9` (Slate-100) to mitigate eye fatigue during multi-hour reporting reviews.

## Typography

The type system prioritizes structural hierarchy and tabular scannability:

- **Headlines & Executive Metric KPIs:** Set in **Plus Jakarta Sans**. Its geometry delivers polished presence without feeling decorative, asserting authority across executive dashboards and audit summaries.
- **Body, Inputs & High-Density Tables:** Governed by **Inter**. Inter’s tall x-height, neutral letterforms, and optimized tabular figures ensure fiscal numbers, RFC IDs, UUIDs, and ledger amounts align reliably across dense multi-column views.
- **Numeric Alignment:** All numerical outputs, currency balances (MXN/USD), tax percentages, and dates must enforce tabular figures (`font-variant-numeric: tabular-nums`) to prevent optical wobble across comparisons.
- **Case Rhythms:** Metadata labels, column headers, and status titles use slight positive tracking (`0.02em` to `0.04em`) with standard capitalization or controlled uppercase for short tax identifiers (e.g., `RFC`, `CFDI`, `UUID`, `IVA`, `ISR`).

## Layout & Spacing

The layout is built on a 12-column fluid-hybrid grid optimized for screen widths from 1280px to 1920px, with strict baseline rhythm:

- **Desktop Execution (>= 1280px):** 12 columns with 24px (`1.5rem`) gutters and 32px (`2rem`) outer canvas margins. Left navigation rail is fixed at 260px (collapsible to 72px icon-only rail). The main content zone dynamically adapts to consume all remaining horizontal space, maximizing horizontal viewport for ledger tables.
- **Tablet / Responsive Views (768px - 1279px):** 8-column layout with 16px (`1rem`) gutters and 24px (`1.5rem`) margins. Navigation shifts to a collapsible off-canvas drawer. Data tables maintain horizontal scrolling with sticky primary identification columns (RFC / Folio Fiscal).
- **Mobile (<= 767px):** 4-column layout with 16px margins. Deep audit data tables convert into vertical card-based fiscal receipts with swipe actions for quick reconciliations.
- **Spacing Rhythm:** Structured on a 4px baseline unit. Component internal padding leans compact (`space-sm` to `space-md`) to ensure dense display of audit trails without vertical pagination overload.

## Elevation & Depth

Visual hierarchy is constructed through crisp boundaries, low-contrast structural borders, and targeted ambient drop-shadows:

- **Structural Outlines:** Every executive card, data table frame, and split pane uses a uniform 1px solid border in `#e2e8f0` (Slate-200). Borders establish immediate boundary confidence without visual bulk.
- **Layer 0 (Canvas Base):** `#f1f5f9` (Slate-100), flat with zero elevation.
- **Layer 1 (Card & Content Containers):** `#ffffff` surface, bounded by 1px `#e2e8f0` and an ambient shadow: `0 1px 3px 0 rgba(15, 39, 68, 0.04), 0 1px 2px -1px rgba(15, 39, 68, 0.02)`. The shadow is tinted with the institutional navy hue to tie the elevation directly into the brand world.
- **Layer 2 (Hover States & Dropdown Menus):** `0 4px 6px -1px rgba(15, 39, 68, 0.07), 0 2px 4px -2px rgba(15, 39, 68, 0.04)`.
- **Layer 3 (Modals, Slide-over Audit Drawers, Sticky Toolbars):** `0 20px 25px -5px rgba(15, 39, 68, 0.12), 0 8px 10px -6px rgba(15, 39, 68, 0.05)`, accompanied by a deep navy backdrop scrim (`#0f2744` at 40% opacity with 2px backdrop blur).

## Shapes

The design system applies a disciplined, semi-structured geometric treatment (**Level 1: Soft**). 

- **Containers & Executive Cards:** Radiused at `0.375rem` (6px) or `0.5rem` (8px). This creates crisp alignment while avoiding aggressive industrial corners.
- **Buttons, Form Inputs, and Dropdown Controls:** Standardized at `0.375rem` (6px), sustaining a focused, tool-grade feel.
- **Pills, Status Badges & Tab Counters:** High-curvature radius (`9999px` / full pill) to immediately distinguish categorical meta-tags and numeric alerts from actionable input structures.

## Components

### Buttons
- **Primary:** Background `#0f2744`, text `#ffffff`, hover `#1e3a5f`, active `#0a1b30`. Focus ring: 2px offset with `#0f2744` at 40% opacity.
- **Secondary / Outline:** Background `#ffffff`, border 1px solid `#e2e8f0`, text `#0f2744`, hover background `#f8fafc` and border `#cbd5e1`.
- **Destructive (Audit Purge / Revocation):** Background `#dc2626`, text `#ffffff`, hover `#b91c1c`. Secondary variant: text `#dc2626`, border `#fecaca`, hover background `#fef2f2`.
- **Dimensions:** Compact height: 32px for table micro-actions; default height: 38px for form controls and standard headers.

### Elevated Pills & Status Badges
- **Verified / Compliant:** Background `#ecfdf5`, border 1px solid `#a7f3d0`, text `#065f46`. Leading 6px filled emerald dot indicator.
- **Pending / Warning:** Background `#fffbeb`, border 1px solid `#fde68a`, text `#92400e`. Leading 6px amber dot.
- **Discrepancy / Cancelled:** Background `#fef2f2`, border 1px solid `#fecaca`, text `#991b1b`. Leading 6px burgundy dot.
- **Neutral / Draft:** Background `#f1f5f9`, border 1px solid `#e2e8f0`, text `#475569`.

### Tabs with Badge Counters
- Horizontal arrangement with an active underline (2px `#0f2744`) or enclosed segmented pill group.
- **Badge Counter:** Sits inline right of tab label. Inactive tabs display badge with background `#e2e8f0`, text `#475569`. Active tab displays badge with background `#0f2744`, text `#ffffff`. Fully rounded edges (`9999px`), padding 2px 8px, font size 11px bold.

### Form Inputs & Selectors
- Background `#ffffff`, border 1px solid `#cbd5e1`, font size 13px, height 38px, padding 0 12px.
- Focus state: border-color `#0f2744`, box-shadow `0 0 0 3px rgba(15, 39, 68, 0.12)`.
- Error state: border-color `#dc2626`, box-shadow `0 0 0 3px rgba(220, 38, 38, 0.12)`.

### Checkboxes & Radios
- Size: 16px by 16px, border 1.5px solid `#cbd5e1`. Checkbox radius: 3px; Radio: full round.
- Checked state: background `#0f2744`, checkmark/inner dot in `#ffffff`.
- Indeterminate state: horizontal white dash on `#0f2744` background.

### Cards & Executive Metric Blocks
- Background `#ffffff`, border 1px solid `#e2e8f0`, padding 16px or 20px, subtle navy-tinted ambient shadow.
- Header contains title in `title-lg`, optional auxiliary date range, and trailing action icon.
- Content zone highlights key summary metric in `metric-numeral` accompanied by positive/negative trend pills.

### Rich Data Tables
- **Header:** Sticky positioning, background `#f8fafc`, text uppercase `label-sm` in `#475569`, border-bottom 1px solid `#cbd5e1`, column cell height 36px.
- **Rows:** Cell height 44px (default) or 36px (condensed audit mode). Border-bottom 1px solid `#e2e8f0`. Hover state triggers `#f8fafc`. Alternating row striping is disabled in favor of clear hover feedback.
- **Numeric & ID Cells:** Set in tabular figures and `data-mono` for RFCs, SAT certificate serials, and UUIDs.
- **Controls Strip:** Anchored above the table header. Contains fuzzy search input (CFDI/RFC), multi-select status chip filters, date-picker range selector, and secondary export buttons (`Exportar XML ZIP`, `Descargar Excel (XLSX)`, `Generar Póliza PDF`).