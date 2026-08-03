---
name: Pro-Fin Dark System
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c3c6d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8d90a0'
  outline-variant: '#434655'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002a78'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#0053db'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffb596'
  on-tertiary: '#581e00'
  tertiary-container: '#bc4800'
  on-tertiary-container: '#ffede6'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbcd'
  tertiary-fixed-dim: '#ffb596'
  on-tertiary-fixed: '#360f00'
  on-tertiary-fixed-variant: '#7d2d00'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-sm:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
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
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 40px
  gutter: 16px
---

## Brand & Style

This design system is built for high-efficiency financial management and administrative clarity. The brand personality is **utilitarian, professional, and authoritative**, utilizing a deep-space aesthetic to reduce eye strain during prolonged usage.

The visual style is a blend of **Corporate Modern** and **Tonal Minimalism**. It avoids unnecessary ornamentation, focusing on data hierarchy and actionable elements. The emotional response is one of control and reliability, achieved through a structured grid, high-contrast typography for critical values, and a systematic use of depth to separate navigation from content.

## Colors

The palette is anchored by a deep obsidian background to establish the dark mode environment. 

- **Primary**: A vibrant blue used exclusively for primary actions and highlights (e.g., "Cargar Pago").
- **Surface**: Subtle variations of dark navy and charcoal are used to create containment fields for cards and tables.
- **Data Accents**: Success states (like paid amounts) use emerald greens, while warning or high-priority items utilize soft ambers or reds (though primary focus remains on the blue accent).
- **Typography**: Pure white is reserved for headers and critical figures. Muted slate-gray is used for metadata, labels, and secondary information to create a clear information architecture.

## Typography

The system uses **Hanken Grotesk** for headlines to provide a sharp, contemporary professional feel. **Inter** handles all body copy and UI labels for maximum legibility at small sizes. **JetBrains Mono** is optionally applied to numeric strings (Invoices, IDs, Dates) to ensure tabular alignment and easy scanning of figures.

**Hierarchy Rules:**
- Large currency values use `display-lg` for immediate visibility.
- Table headers use `label-caps` with a secondary color to distinguish from the data rows.
- Document types (e.g., "PRESUPUESTO") are emphasized with semi-bold weights.

## Layout & Spacing

The design follows a **fixed-fluid hybrid grid**. The main content container is centered with a max-width for desktop viewing, while inner table structures are fluid.

- **Vertical Rhythm**: A strict 4px base unit is used. 16px (md) is the standard padding for cards and list items.
- **Density**: The system maintains a "Compact" density for data tables, allowing more rows to be visible without scrolling.
- **Breakpoints**: 
  - **Mobile (<768px)**: Cards stack vertically; table transforms into a list view; margins reduce to 16px.
  - **Desktop (>1024px)**: Full horizontal table layout with 40px external margins.

## Elevation & Depth

Depth is communicated through **Tonal Layering** rather than traditional shadows. 

1. **Level 0 (Background)**: The base canvas (#0B0E14).
2. **Level 1 (Cards/Tables)**: Slightly lighter surface (#161B22) with a 1px subtle border (#2D333B).
3. **Level 2 (Modals/Dropdowns)**: Highest surface contrast with a soft, 15% opacity black shadow to create separation.

Interactive rows use a "hover highlight" state where the background color lightens by 2-3% or adds a subtle blue left-border accent.

## Shapes

The shape language is **Soft and Precise**. 

- **Primary Radius**: 4px to 6px (Standard). This applies to buttons, input fields, and small cards.
- **Large Radius**: 8px (Large containers/Main content blocks).
- **Interactive Elements**: Buttons maintain a subtle roundedness (Soft) to look professional yet modern. Do not use pill shapes for functional buttons; reserve them for status badges (chips) only.

## Components

### Buttons
- **Primary**: Solid blue background (#2563EB) with white text. No gradient.
- **Secondary/Ghost**: Transparent background with a 1px border (#2D333B) and white text.
- **Sizing**: Small (28px height) for table actions; Medium (40px) for global actions.

### Tables
- **Header**: Sticky top, dark grey background, uppercase labels.
- **Rows**: Separated by 1px horizontal dividers (#21262D). No vertical dividers between columns to maintain a clean look.
- **Cells**: Numeric data is right-aligned; text data is left-aligned.

### Status Chips
- Small, uppercase, high-contrast labels. Use background tints (e.g., 10% opacity blue background for "CREDITO") to provide color coding without overwhelming the UI.

### Input Fields
- Dark-filled backgrounds with a subtle border. On focus, the border transitions to primary blue with a 2px outer glow.

### Cards (Summary)
- Used for high-level metrics (e.g., Total Pending). Includes a thick primary-color accent on the left or top edge to denote importance.