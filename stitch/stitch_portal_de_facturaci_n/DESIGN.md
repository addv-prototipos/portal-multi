---
name: Premium Fiscal Portal
colors:
  surface: '#fbf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ee'
  surface-container: '#f0eee9'
  surface-container-high: '#eae8e3'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#44474f'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ec'
  outline: '#747780'
  outline-variant: '#c4c6d1'
  surface-tint: '#435e93'
  primary: '#001436'
  on-primary: '#ffffff'
  primary-container: '#03285b'
  on-primary-container: '#7691ca'
  inverse-primary: '#adc6ff'
  secondary: '#006874'
  on-secondary: '#ffffff'
  secondary-container: '#2ce6fd'
  on-secondary-container: '#00636e'
  tertiary: '#001a10'
  on-tertiary: '#ffffff'
  tertiary-container: '#003121'
  on-tertiary-container: '#00a578'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a41'
  on-primary-fixed-variant: '#29467a'
  secondary-fixed: '#98f0ff'
  secondary-fixed-dim: '#00daf1'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004f58'
  tertiary-fixed: '#42ffbf'
  tertiary-fixed-dim: '#00e1a4'
  on-tertiary-fixed: '#002115'
  on-tertiary-fixed-variant: '#005139'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
  carbon-blue: '#0B1320'
  ink-text: '#21261F'
  ink-soft: '#5B6158'
  surface-white: '#FFFFFF'
  border-warm: '#E3DFD4'
  status-warn: '#B4530C'
  status-error: '#B3261E'
typography:
  headline-xl:
    fontFamily: Source Serif 4
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Source Serif 4
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1280px
---

## Brand & Style

The design system is engineered to project **absolute trust, technical precision, and institutional reliability**. It targets a professional audience in the Mexican fiscal landscape, balancing the rigor of government compliance with the efficiency of modern SaaS.

The aesthetic follows a **Corporate Modern** style with a "warm-tech" twist. We intentionally move away from the sterile, cold blues of typical fintech by utilizing a "paper" base—a subtly warm background that evokes physical documentation and provides a softer reading experience for dense data. This is paired with high-contrast, deep navy surfaces and vibrant "technological" accents to signal innovation.

**Visual Principles:**
- **Editorial Credibility:** Utilizing high-contrast serif typography for headings to suggest the authority of a legal or financial publication.
- **Surface Integrity:** Impeccable white surfaces (cards and inputs) organized with strict 8px-based spacing.
- **Tactile Feedback:** Subtle shadows and soft corners that make the interface feel tangible and safe, rather than flat and digital.

## Colors

The palette is anchored by **Deep Blue (#03285B)**, representing institutional stability. **Electric Blue** acts as a secondary structural color for progress and navigation, while **Technological Green** is reserved exclusively for key actions and success states (the "Path of Value").

The canvas uses **#F6F4EF (Warm Neutral)** instead of pure gray, creating a sophisticated "legal bond" feel. Content lives on **Surface White** cards to maximize legibility and provide clear optical separation. Text hierarchy is managed via **Carbon Blue** for primary content and **Ink Soft** for metadata and secondary labels.

## Typography

This system employs a dual-typeface strategy to establish its "Editorial SaaS" identity. 

**Source Serif 4** is used for headlines. Its sturdy, traditional serifs provide the necessary authority for fiscal documentation. **Inter** is the functional workhorse, used for all UI elements, data inputs, and body text to ensure maximum legibility at small sizes and high information densities.

Large headlines (`headline-xl`, `headline-lg`) should use tighter letter spacing to maintain a premium feel. Labels for forms and table headers use `label-md` with uppercase styling to provide clear structural scaffolding for user data.

## Layout & Spacing

The layout is built on a **12-column fixed grid** for desktop, ensuring that complex data tables and fiscal forms don't become overly wide and unreadable. 

- **The 8px Grid:** All internal component dimensions, padding, and gap spacing must be multiples of 8px.
- **Density:** The "Panel Admin" uses a high-density spacing model (4px/8px gaps) to allow for data-heavy management, while the "CSF Flow" uses a relaxed spacing model (16px/24px gaps) to reduce cognitive load during sensitive document uploads.
- **Breakpoints:**
  - **Mobile (<768px):** 4-column fluid grid, 16px margins. Stacked form fields.
  - **Tablet (768px - 1024px):** 8-column fluid grid, 24px margins.
  - **Desktop (>1024px):** 12-column fixed grid, 1280px max-container width.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** and **Ambient Shadows**.

1.  **Floor:** The Warm Neutral (#F6F4EF) background acts as the lowest level.
2.  **Surface:** White (#FFFFFF) cards and containers sit one level above the floor. They feature a 1px border (#E3DFD4) and a very soft, diffused shadow: `0px 4px 12px rgba(11, 19, 32, 0.05)`.
3.  **Active/Floating:** Modals and dropdowns use a more pronounced shadow: `0px 12px 32px rgba(11, 19, 32, 0.12)` to clearly separate interactive layers.

Avoid heavy blacks in shadows; use a tinted **Carbon Blue** shadow at low opacity to keep the interface feeling clean and integrated with the brand palette.

## Shapes

The shape language is **Rounded**, signaling approachability without sacrificing professionalism. 

- **Standard Elements:** 0.5rem (8px) radius for buttons, inputs, and small cards.
- **Large Containers:** 1rem (16px) radius for main dashboard sections and major modal containers.
- **Form Controls:** Checkboxes and radio buttons should maintain a 4px and 100% (circular) radius respectively to provide familiar affordances.

## Components

- **Buttons:** Primary buttons use Deep Blue backgrounds with white text. Success actions (e.g., "Finalizar Trámite") use the Technological Green. Secondary buttons use a Deep Blue outline with a subtle hover fill.
- **Inputs:** Surfaces are pure white with a 1px border in #E3DFD4. On focus, the border transitions to Electric Blue (#05DBF2) with a 2px outer glow. Error states use #B3261E with accompanying assistive text.
- **CSF Stepper:** An elegant, horizontal line-and-circle indicator. Completed steps are Technological Green with a check icon; the active step has a double-ring Electric Blue border.
- **Data Tables:** Zebra-striping is forbidden. Use 1px horizontal dividers in #E3DFD4. Row hover states should use a splotch of #F6F4EF. Badges (Status) use low-saturation background tints (e.g., Soft Orange for "Pendiente") with high-contrast text.
- **Dropzone:** A dashed border in #05DBF2 with a subtle Electric Blue tint background. Upon file selection, transition to a "Loading" state with a linear progress bar using the primary Deep Blue.