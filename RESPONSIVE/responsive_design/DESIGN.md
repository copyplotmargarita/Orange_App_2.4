---
name: Responsive Design
colors:
  surface: '#121318'
  surface-dim: '#121318'
  surface-bright: '#38393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1b20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#c3c6d2'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#8d909b'
  outline-variant: '#434750'
  surface-tint: '#acc7ff'
  primary: '#c0d4ff'
  on-primary: '#002f67'
  primary-container: '#94b8ff'
  on-primary-container: '#1e4787'
  inverse-primary: '#385e9e'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#ffcd64'
  on-tertiary: '#402d00'
  tertiary-container: '#e1b14a'
  on-tertiary-container: '#5f4400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#1b4585'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffdea2'
  tertiary-fixed-dim: '#f1bf57'
  on-tertiary-fixed: '#261900'
  on-tertiary-fixed-variant: '#5c4200'
  background: '#121318'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
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
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Hanken Grotesk
    fontSize: 10px
    fontWeight: '700'
    lineHeight: 12px
  price-lg:
    fontFamily: Hanken Grotesk
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 12px
  margin-mobile: 16px
  margin-desktop: 24px
  card-padding: 16px
  input-height: 48px
---

## Brand & Style

This design system is engineered for high-velocity sales and inventory management. The aesthetic is **Corporate Modern** with a focus on data density and operational clarity. It utilizes a deep, immersive dark mode to reduce eye strain during prolonged use, punctuated by high-vibrancy accents that draw attention to critical financial data.

The personality is professional, efficient, and precise. It balances a tech-forward feel with the reliability required for financial transactions. By utilizing subtle tonal layering instead of heavy shadows, the UI maintains a clean, architectural structure suitable for complex, multi-step workflows.

## Colors

The palette is anchored by a deep navy **Background** and slightly lighter **Surface** tones to create a clear visual hierarchy of containers. 

- **Primary (Light Blue):** Reserved for primary action buttons, focused states, and active navigation indicators. It provides high contrast against the dark background without the harshness of pure white.
- **Secondary (Vibrant Green):** Exclusively used for "success" states, price points, and positive monetary values to ensure they are immediately scannable.
- **Neutrals:** A range of slates and grays handle borders, secondary text, and inactive states. 
- **Surface Tiers:** Use `#1e293b` for standard cards and `#334155` for high-emphasis interactive elements like input fields or selected states.

## Typography

This design system uses **Hanken Grotesk** across all roles to maintain a sharp, contemporary, and highly legible interface. The type scale is optimized for data density.

- **Headlines:** Use bold weights for page titles and section headers to anchor the layout.
- **Labels:** Small, all-caps or high-weight labels are used for metadata (e.g., "TASA BCV", "FECHA") to provide context without competing with the primary data.
- **Numerical Data:** Price points use `price-lg` with the secondary green color to ensure financial figures are the most prominent elements on the page.

## Layout & Spacing

The layout follows a **fluid grid** model optimized for high-density information display. The rhythm is based on a 4px baseline grid.

- **Margins:** 16px on mobile devices, scaling to 24px on larger screens.
- **Gaps:** A compact 12px gutter is used between cards and list items to maximize the number of visible items.
- **Vertical Rhythm:** Elements are tightly grouped by context (e.g., product image, name, and price) with 4-8px internal spacing, while distinct sections are separated by 24px.
- **Mobile Reflow:** On mobile, complex 4-column product grids reflow to a 2-column grid to maintain tap target sizes and image clarity.

## Elevation & Depth

This system avoids traditional shadows in favor of **Tonal Layers** and **Low-Contrast Outlines**.

- **Level 0 (Background):** `#0f172a` — the base canvas.
- **Level 1 (Cards/Containers):** `#1e293b` — used for the main content areas. These should have a subtle 1px border of `#334155` to define edges.
- **Level 2 (Interactive/Focus):** `#334155` — used for input fields and buttons in their resting state.
- **Active State:** Primary actions use a solid fill of the primary color, effectively "lifting" the element through color contrast rather than shadow.

## Shapes

The shape language uses **Rounded** geometry to soften the technical nature of the sales data.

- **Standard Radius:** 8px (0.5rem) for cards, input fields, and primary buttons.
- **Small Radius:** 4px for tags, chips, and nested inner elements.
- **Interactive Elements:** Maintain consistent corner radii across inputs and buttons to create a cohesive "row" feel when they are adjacent.

## Components

### Buttons
- **Primary:** Solid `#94b8ff` fill with dark navy text. Rounded (8px). 
- **Secondary/Ghost:** Transparent fill with a `#334155` border.
- **Icon Buttons:** Circular or slightly rounded squares used for "Add", "Delete", or "Edit" actions within lists.

### Input Fields
- Dark grey background (`#1e293b`) with a subtle border. 
- Labels are placed above the field in `label-sm` style.
- Focus state: Border changes to `#94b8ff` with a subtle outer glow.

### Cards
- **Product Cards:** Feature a top-aligned image on a white or light gray inner-container, followed by product details on the dark surface.
- **Summary Cards:** Located at the bottom of the screen, these use a semi-transparent blur or solid `#1e293b` to stick to the viewport.

### Chips & Status
- Use small, high-contrast pills for stock levels (e.g., "4 Litro", "38 Unidad"). Text should be the secondary green or a muted blue.

### Lists
- Items are separated by a 1px line of `#334155`. 
- High-density layout: Quantity, Name, and Price are aligned for quick horizontal scanning.