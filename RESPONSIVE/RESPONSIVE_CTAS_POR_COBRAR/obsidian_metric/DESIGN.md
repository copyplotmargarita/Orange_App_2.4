---
name: Obsidian Metric
colors:
  surface: '#10131c'
  surface-dim: '#10131c'
  surface-bright: '#363943'
  surface-container-lowest: '#0b0e16'
  surface-container-low: '#181b24'
  surface-container: '#1c1f28'
  surface-container-high: '#272a33'
  surface-container-highest: '#32343e'
  on-surface: '#e0e2ee'
  on-surface-variant: '#c1c7d3'
  inverse-surface: '#e0e2ee'
  inverse-on-surface: '#2d303a'
  outline: '#8b919d'
  outline-variant: '#414751'
  surface-tint: '#a4c9ff'
  primary: '#a4c9ff'
  on-primary: '#00315d'
  primary-container: '#4d93e5'
  on-primary-container: '#002a51'
  inverse-primary: '#0060ac'
  secondary: '#4ae183'
  on-secondary: '#003919'
  secondary-container: '#06bb63'
  on-secondary-container: '#00431f'
  tertiary: '#efc209'
  on-tertiary: '#3c2f00'
  tertiary-container: '#cea700'
  on-tertiary-container: '#4e3e00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d4e3ff'
  primary-fixed-dim: '#a4c9ff'
  on-primary-fixed: '#001c39'
  on-primary-fixed-variant: '#004883'
  secondary-fixed: '#6bfe9c'
  secondary-fixed-dim: '#4ae183'
  on-secondary-fixed: '#00210c'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#ffe084'
  tertiary-fixed-dim: '#eec209'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#574500'
  background: '#10131c'
  on-background: '#e0e2ee'
  surface-variant: '#32343e'
typography:
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  gutter: 12px
  margin-mobile: 16px
---

## Brand & Style

The design system is engineered for high-performance sales monitoring and financial data density. It adopts a **Corporate / Modern** style with a focus on technical precision and utilitarian efficiency. The aesthetic is defined by a deep atmospheric dark mode that reduces eye strain during long periods of data analysis.

The brand personality is authoritative and reliable, utilizing a "system-first" approach where information hierarchy is the primary driver of the visual language. This is achieved through strict tonal layering and a sophisticated use of semantic color for status indicators (financial gains, transaction states). On mobile, this translates to a compact, "cockpit-like" experience where every pixel is optimized for legibility.

## Colors

The palette is rooted in a deep navy/obsidian foundation to provide high contrast for critical data points.

- **Primary (Blue):** Used for primary actions and highlights. Extracted from the "Ventas del Día" header.
- **Secondary (Green):** Reserved for positive financial indicators, successful statuses, and growth metrics.
- **Neutral/Background:** A multi-layered set of dark blues. The base background is nearly black, while surfaces (cards, rows) use a lighter navy to create depth.
- **Text:** High-output white for primary data (prices, names) and muted slate-gray for labels and metadata to minimize visual noise.

## Typography

This design system uses **Hanken Grotesk** for its clean, professional geometry and excellent legibility in dark environments. For numerical values and technical metadata, **JetBrains Mono** is utilized to ensure tabular alignment and clarity of figures.

- **Scale:** The mobile scale is tight. Headlines are capped at 24px to ensure dashboard titles don't consume excessive vertical space.
- **Data Emphasis:** Bold weights are applied to currency values and primary identifiers (like customer names) to allow for quick scanning.
- **Metadata:** Captions and table headers use an uppercase, tracked-out style to differentiate them from actionable data.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for high-density information. On mobile, the system shifts from a wide multi-column table to a stacked card or "list-table" hybrid.

- **Density:** We utilize a 4px baseline grid. Padding within data rows is kept to a minimum (8px-12px) to maximize the number of visible transactions per screen.
- **Safe Zones:** A 16px outer margin is maintained for all mobile screens. 
- **Grouping:** Related data points (e.g., Total $ and Total Bs) should be grouped vertically in mobile views to maintain the horizontal constraints of the device.

## Elevation & Depth

Depth is achieved through **Tonal Layers** rather than heavy shadows. In a dark dashboard, shadows can often appear muddy; instead, we use luminosity to signify elevation.

1.  **Level 0 (Base):** `#0F111A` — The application canvas.
2.  **Level 1 (Cards/Rows):** `#1E2230` — Used for the main data containers and list items.
3.  **Level 2 (Inlay/Input):** `#141721` — Used for recessed areas like search bars or inner dashboard segments.
4.  **Accents:** Subtle 1px borders using `#2A2F3E` are used to define boundaries between data cells without adding bulk.

## Shapes

The design system uses a **Soft (0.25rem)** roundedness. This subtle rounding maintains the professional, "engineered" feel of the dashboard while preventing it from appearing too aggressive or dated. 

- **Buttons & Tags:** Use the base 4px (0.25rem) radius.
- **Outer Containers:** Larger cards may use an 8px radius to create a clear container hierarchy.
- **Status Pills:** Can optionally use a full-round (pill) shape to distinguish them from actionable buttons.

## Components

### Buttons
- **Primary:** Solid blue background with white text. 
- **Secondary/Ghost:** 1px border using the primary color or text color, with no fill. Used for "Ver Detalle" or "Volver".
- **Density:** Mobile buttons have a minimum touch target of 44px but a visual height of 32px for data-heavy views.

### Data Cards (Mobile Table Replacement)
Instead of a horizontal table, transactions are represented as cards. 
- **Header:** Timestamp and Status Pill.
- **Content:** Primary name and amount in bold.
- **Footer:** Secondary metadata (Tienda/Vendedor) in muted text.

### Status Indicators
- Small chips with subtle background tints and high-contrast text (e.g., a dark green background with bright green text for "CONTADO").

### Input Fields
- Dark, recessed backgrounds (`#141721`) with 1px borders that highlight on focus. Labels sit above the field in `label-caps` style.

### Metric Tiles
- Horizontal scrolling or 2-column grid at the top of the dashboard. Features a small label, a large primary value, and an optional sparkline or trend percentage.