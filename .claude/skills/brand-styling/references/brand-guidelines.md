# Brand Guidelines & Design System

## Table of Contents
1. [Brand Colors](#brand-colors)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Components](#components)
5. [Responsive Design](#responsive-design)
6. [Accessibility](#accessibility)

---

## Brand Colors

### Primary Color Palette

#### Primary Green (#0b6d41)
```
Primary:        #0b6d41  RGB(11, 109, 65)
Primary Light:  #0f8f56  (For dark mode backgrounds)
Primary Dark:   #085032  (For hover states)
Primary Lighter:#d4f1e4  (For backgrounds and subtle highlights)

Opacity Variants:
- 10%: rgba(11, 109, 65, 0.1)  - Subtle backgrounds
- 20%: rgba(11, 109, 65, 0.2)  - Hover states
- 50%: rgba(11, 109, 65, 0.5)  - Overlays
- 80%: rgba(11, 109, 65, 0.8)  - Semi-transparent elements
```

**Usage:**
- Primary buttons and call-to-action elements
- Active navigation items
- Links and interactive elements
- Success states and confirmations
- Brand headers and hero sections
- Progress indicators

**Don't Use For:**
- Large background areas (use lighter variants)
- Body text (use gray tones instead)
- Error or warning messages

#### Secondary Yellow (#ffde59)
```
Secondary:        #ffde59  RGB(255, 222, 89)
Secondary Light:  #ffea9a  (For hover states)
Secondary Dark:   #e6c64d  (For active states)
Secondary Darker: #ccae3d  (For text on light backgrounds)

Opacity Variants:
- 10%: rgba(255, 222, 89, 0.1)  - Subtle highlights
- 20%: rgba(255, 222, 89, 0.2)  - Background accents
- 50%: rgba(255, 222, 89, 0.5)  - Overlays
- 80%: rgba(255, 222, 89, 0.8)  - Badges
```

**Usage:**
- Secondary buttons and actions
- Badges and tags
- Warning messages and alerts
- Highlighted text backgrounds
- Accent elements and decorations
- Special offers or promotions

**Don't Use For:**
- Primary navigation
- Large text blocks
- Critical error messages

#### Background Cream (#fbfbee)
```
Background:       #fbfbee  RGB(251, 251, 238)
Background Light: #ffffff  (For cards and elevated surfaces)
Background Dark:  #f5f5e0  (For subtle sections)

Dark Mode Equivalent:
Background:       #1a1a1a  (Primary dark background)
Background Light: #242424  (Elevated surfaces)
Background Dark:  #121212  (Deeper backgrounds)
```

**Usage:**
- Page backgrounds in light mode
- Card backgrounds
- Modal and dialog backgrounds
- Subtle section dividers

### Semantic Colors

#### Success (Green)
```
Success:         #0b6d41  (Uses primary green)
Success Light:   #d4f1e4
Success Dark:    #085032
```

#### Error (Red)
```
Error:           #dc2626  RGB(220, 38, 38)
Error Light:     #fecaca
Error Dark:      #991b1b
Dark Mode Error: #f87171
```

#### Warning (Orange-Yellow)
```
Warning:         #f59e0b  RGB(245, 158, 11)
Warning Light:   #fef3c7
Warning Dark:    #b45309
Dark Mode Warning: #fbbf24
```

#### Info (Blue)
```
Info:            #3b82f6  RGB(59, 130, 246)
Info Light:      #dbeafe
Info Dark:       #1e40af
Dark Mode Info:  #60a5fa
```

### Neutral Colors (Gray Scale)

#### Light Theme
```
Gray 50:   #fafafa  - Subtle backgrounds
Gray 100:  #f5f5f5  - Light backgrounds
Gray 200:  #e5e5e5  - Borders and dividers
Gray 300:  #d4d4d4  - Disabled states
Gray 400:  #a3a3a3  - Placeholder text
Gray 500:  #737373  - Secondary text
Gray 600:  #525252  - Body text
Gray 700:  #404040  - Emphasized text
Gray 800:  #262626  - Headings
Gray 900:  #171717  - Primary text
```

#### Dark Theme
```
Gray 50:   #fafafa  - Primary text
Gray 100:  #f5f5f5  - Headings
Gray 200:  #e5e5e5  - Emphasized text
Gray 300:  #d4d4d4  - Body text
Gray 400:  #a3a3a3  - Secondary text
Gray 500:  #737373  - Placeholder text
Gray 600:  #525252  - Disabled states
Gray 700:  #404040  - Borders and dividers
Gray 800:  #262626  - Light backgrounds
Gray 900:  #171717  - Subtle backgrounds
```

### Color Contrast Guidelines

All color combinations must meet WCAG AA standards:
- **Normal Text**: Minimum contrast ratio of 4.5:1
- **Large Text** (18pt+ or 14pt+ bold): Minimum 3:1
- **UI Components**: Minimum 3:1 against adjacent colors

**Approved Combinations:**
- Primary (#0b6d41) on White (#ffffff): 6.8:1 ✓
- Primary (#0b6d41) on Background (#fbfbee): 6.5:1 ✓
- Secondary Dark (#ccae3d) on White: 4.7:1 ✓
- White on Primary (#0b6d41): 6.8:1 ✓
- White on Secondary: 1.3:1 ✗ (Use Secondary Dark for text)

---

## Typography

### Font Families

#### Primary Font: Inter (Sans-serif)
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

**Use for:**
- Body text
- UI elements
- Forms and inputs
- Buttons
- Navigation

**Weights Available:**
- Light (300)
- Regular (400) - Default for body text
- Medium (500) - Emphasized text
- Semi-Bold (600) - Subheadings
- Bold (700) - Strong emphasis

#### Heading Font: Poppins (Sans-serif)
```css
font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

**Use for:**
- Page titles (h1)
- Section headings (h2, h3)
- Card titles
- Hero text
- Marketing content

**Weights Available:**
- Regular (400)
- Medium (500)
- Semi-Bold (600) - Default for headings
- Bold (700) - Emphasis

#### Monospace Font: Fira Code
```css
font-family: 'Fira Code', 'Courier New', Courier, monospace;
```

**Use for:**
- Code snippets
- Technical data
- IDs and reference numbers
- Terminal output

### Type Scale

#### Desktop (Base: 16px)
```
Display:     text-5xl  (48px / 3rem)     Line-height: 1.1    Letter-spacing: -0.02em
Hero:        text-4xl  (36px / 2.25rem) Line-height: 1.2    Letter-spacing: -0.01em
H1:          text-3xl  (30px / 1.875rem) Line-height: 1.2   Letter-spacing: -0.01em
H2:          text-2xl  (24px / 1.5rem)  Line-height: 1.3    Letter-spacing: -0.005em
H3:          text-xl   (20px / 1.25rem) Line-height: 1.4    Letter-spacing: normal
H4:          text-lg   (18px / 1.125rem) Line-height: 1.4   Letter-spacing: normal
Body:        text-base (16px / 1rem)    Line-height: 1.6    Letter-spacing: normal
Small:       text-sm   (14px / 0.875rem) Line-height: 1.5   Letter-spacing: normal
Caption:     text-xs   (12px / 0.75rem) Line-height: 1.4    Letter-spacing: 0.01em
```

#### Mobile (Base: 16px - scales down slightly)
```
Display:     text-4xl  (36px)  responsive
Hero:        text-3xl  (30px)  responsive
H1:          text-2xl  (24px)  responsive
H2:          text-xl   (20px)  responsive
H3:          text-lg   (18px)  responsive
H4:          text-base (16px)  same
Body:        text-base (16px)  same
Small:       text-sm   (14px)  same
Caption:     text-xs   (12px)  same
```

### Typography Hierarchy Examples

#### Page Title Pattern
```tsx
<h1 className="text-3xl md:text-4xl font-bold font-poppins text-gray-900 dark:text-gray-50 mb-2">
  Page Title
</h1>
<p className="text-base text-gray-600 dark:text-gray-400">
  Subtitle or description
</p>
```

#### Section Heading Pattern
```tsx
<h2 className="text-2xl font-semibold font-poppins text-gray-800 dark:text-gray-100 mb-4">
  Section Title
</h2>
```

#### Card Title Pattern
```tsx
<h3 className="text-xl font-medium text-gray-900 dark:text-gray-50 mb-2">
  Card Title
</h3>
<p className="text-sm text-gray-600 dark:text-gray-400">
  Card description
</p>
```

#### Body Text Pattern
```tsx
<p className="text-base leading-relaxed text-gray-700 dark:text-gray-300">
  Body content with comfortable reading line-height.
</p>
```

### Text Styling Guidelines

1. **Line Length**: Optimal 65-75 characters per line for body text
   ```tsx
   <div className="max-w-prose mx-auto">
     <p>Long form content...</p>
   </div>
   ```

2. **Line Height**:
   - Body text: `leading-relaxed` (1.6)
   - Headings: `leading-tight` (1.2-1.3)
   - UI elements: `leading-normal` (1.5)

3. **Letter Spacing**:
   - Tight for large headings: `tracking-tight`
   - Normal for body: `tracking-normal`
   - Wide for uppercase labels: `tracking-wide`

4. **Text Alignment**:
   - Left-align body text (default)
   - Center headings only for hero sections
   - Never justify text (causes awkward spacing)

---

## Spacing & Layout

### Spacing Scale (4px base unit)

```
Tailwind Class  Pixels  Rem     Usage
0               0px     0       No spacing
px              1px     -       Borders
0.5             2px     0.125   Subtle spacing
1               4px     0.25    Tight spacing
1.5             6px     0.375
2               8px     0.5     Small gaps
3               12px    0.75
4               16px    1       Default spacing
5               20px    1.25
6               24px    1.5     Medium spacing
7               28px    1.75
8               32px    2       Large spacing
10              40px    2.5
12              48px    3       Section spacing
16              64px    4       Large sections
20              80px    5
24              96px    6       Hero spacing
```

### Common Spacing Patterns

#### Component Internal Spacing
```tsx
// Small component (button, badge)
<div className="px-3 py-1.5">

// Medium component (card, form field)
<div className="p-4 md:p-6">

// Large component (modal, section)
<div className="p-6 md:p-8 lg:p-10">
```

#### Gap Between Elements
```tsx
// Tight group (form labels and inputs)
<div className="space-y-2">

// Normal group (list items)
<div className="space-y-4">

// Sections
<div className="space-y-6 md:space-y-8">

// Major sections
<div className="space-y-12 md:space-y-16">
```

#### Container Padding
```tsx
// Standard page container
<div className="container mx-auto px-4 sm:px-6 lg:px-8">

// Full-width section with padding
<section className="px-4 py-8 md:px-6 md:py-12 lg:px-8 lg:py-16">
```

### Layout Grid System

#### Grid Columns
```tsx
// Auto-responsive grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">

// Fixed proportions
<div className="grid grid-cols-12 gap-4">
  <div className="col-span-12 md:col-span-8">Main</div>
  <div className="col-span-12 md:col-span-4">Sidebar</div>
</div>
```

#### Flexbox Layouts
```tsx
// Horizontal layout with gap
<div className="flex items-center gap-4">

// Space between items
<div className="flex items-center justify-between">

// Wrapped responsive layout
<div className="flex flex-wrap gap-2 md:gap-4">
```

### Container Widths

```tsx
// Maximum widths for content
max-w-screen-sm   640px   - Narrow content
max-w-screen-md   768px   - Forms, articles
max-w-screen-lg   1024px  - Standard pages
max-w-screen-xl   1280px  - Wide layouts
max-w-screen-2xl  1536px  - Very wide layouts

// Prose content
max-w-prose       65ch    - Optimal reading width
```

---

## Components

### Buttons

#### Primary Button
```tsx
<button className="
  bg-primary hover:bg-primary-dark
  text-white font-medium
  px-6 py-3 rounded-lg
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  active:scale-95
  dark:bg-primary-light dark:hover:bg-primary
">
  Primary Action
</button>
```

#### Secondary Button
```tsx
<button className="
  bg-secondary hover:bg-secondary-light
  text-gray-900 font-medium
  px-6 py-3 rounded-lg
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed
  active:scale-95
">
  Secondary Action
</button>
```

#### Outline Button
```tsx
<button className="
  border-2 border-primary text-primary
  hover:bg-primary hover:text-white
  font-medium px-6 py-3 rounded-lg
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
  dark:border-primary-light dark:text-primary-light
  dark:hover:bg-primary-light dark:hover:text-gray-900
">
  Outline Action
</button>
```

#### Ghost Button
```tsx
<button className="
  text-primary hover:bg-primary/10
  font-medium px-4 py-2 rounded-lg
  transition-all duration-200
  focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
  dark:text-primary-light dark:hover:bg-primary-light/10
">
  Ghost Action
</button>
```

#### Button Sizes
```tsx
// Small
<button className="px-3 py-1.5 text-sm rounded-md">

// Medium (default)
<button className="px-6 py-3 text-base rounded-lg">

// Large
<button className="px-8 py-4 text-lg rounded-xl">
```

### Cards

#### Basic Card
```tsx
<div className="
  bg-white dark:bg-gray-800
  border border-gray-200 dark:border-gray-700
  rounded-lg shadow-sm
  p-6
  hover:shadow-md transition-shadow duration-200
">
  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-50 mb-2">
    Card Title
  </h3>
  <p className="text-gray-600 dark:text-gray-400">
    Card content goes here
  </p>
</div>
```

#### Elevated Card
```tsx
<div className="
  bg-white dark:bg-gray-800
  rounded-xl shadow-lg
  p-6 md:p-8
  hover:shadow-xl hover:-translate-y-1
  transition-all duration-300
">
  {/* Card content */}
</div>
```

#### Bordered Card with Accent
```tsx
<div className="
  bg-white dark:bg-gray-800
  border-l-4 border-primary
  rounded-r-lg
  p-6
  shadow-sm
">
  {/* Card content */}
</div>
```

### Form Elements

#### Text Input
```tsx
<input
  type="text"
  className="
    w-full px-4 py-2
    bg-white dark:bg-gray-900
    border border-gray-300 dark:border-gray-600
    rounded-md
    text-gray-900 dark:text-gray-100
    placeholder-gray-500 dark:placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
    disabled:opacity-50 disabled:cursor-not-allowed
    transition-all duration-200
  "
  placeholder="Enter text..."
/>
```

#### Textarea
```tsx
<textarea
  className="
    w-full px-4 py-2
    bg-white dark:bg-gray-900
    border border-gray-300 dark:border-gray-600
    rounded-md
    text-gray-900 dark:text-gray-100
    placeholder-gray-500 dark:placeholder-gray-400
    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
    resize-vertical
    min-h-[100px]
  "
  placeholder="Enter description..."
/>
```

#### Select Dropdown
```tsx
<select className="
  w-full px-4 py-2
  bg-white dark:bg-gray-900
  border border-gray-300 dark:border-gray-600
  rounded-md
  text-gray-900 dark:text-gray-100
  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
  cursor-pointer
">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

#### Checkbox
```tsx
<label className="flex items-center space-x-2 cursor-pointer">
  <input
    type="checkbox"
    className="
      w-5 h-5
      border-gray-300 dark:border-gray-600
      rounded
      text-primary
      focus:ring-2 focus:ring-primary
      cursor-pointer
    "
  />
  <span className="text-gray-700 dark:text-gray-300">
    Checkbox label
  </span>
</label>
```

### Badges & Tags

```tsx
// Success badge
<span className="
  inline-flex items-center
  px-3 py-1 rounded-full
  text-sm font-medium
  bg-green-100 text-green-800
  dark:bg-green-900/30 dark:text-green-400
">
  Success
</span>

// Warning badge
<span className="
  inline-flex items-center
  px-3 py-1 rounded-full
  text-sm font-medium
  bg-yellow-100 text-yellow-800
  dark:bg-yellow-900/30 dark:text-yellow-400
">
  Warning
</span>

// Primary badge
<span className="
  inline-flex items-center
  px-3 py-1 rounded-full
  text-sm font-medium
  bg-primary/10 text-primary
  dark:bg-primary-light/10 dark:text-primary-light
">
  Primary
</span>
```

### Alerts

```tsx
// Success Alert
<div className="
  bg-green-50 dark:bg-green-900/20
  border-l-4 border-green-500
  p-4 rounded-r-md
">
  <p className="text-sm text-green-800 dark:text-green-400">
    Success message here
  </p>
</div>

// Error Alert
<div className="
  bg-red-50 dark:bg-red-900/20
  border-l-4 border-red-500
  p-4 rounded-r-md
">
  <p className="text-sm text-red-800 dark:text-red-400">
    Error message here
  </p>
</div>

// Warning Alert
<div className="
  bg-yellow-50 dark:bg-yellow-900/20
  border-l-4 border-yellow-500
  p-4 rounded-r-md
">
  <p className="text-sm text-yellow-800 dark:text-yellow-400">
    Warning message here
  </p>
</div>

// Info Alert
<div className="
  bg-blue-50 dark:bg-blue-900/20
  border-l-4 border-blue-500
  p-4 rounded-r-md
">
  <p className="text-sm text-blue-800 dark:text-blue-400">
    Info message here
  </p>
</div>
```

---

## Responsive Design

### Breakpoints Reference

```
sm:   640px   @media (min-width: 640px)
md:   768px   @media (min-width: 768px)
lg:   1024px  @media (min-width: 1024px)
xl:   1280px  @media (min-width: 1280px)
2xl:  1536px  @media (min-width: 1536px)
```

### Mobile-First Approach

```tsx
// Start with mobile, scale up
<div className="
  w-full           // Mobile: full width
  sm:w-auto       // Small+: auto width
  md:w-1/2        // Medium+: half width
  lg:w-1/3        // Large+: third width
">
```

### Common Responsive Patterns

#### Stacked to Horizontal Layout
```tsx
<div className="
  flex flex-col       // Mobile: vertical stack
  sm:flex-row        // Small+: horizontal
  gap-4
">
```

#### Responsive Grid
```tsx
<div className="
  grid
  grid-cols-1        // Mobile: 1 column
  sm:grid-cols-2     // Small: 2 columns
  lg:grid-cols-3     // Large: 3 columns
  xl:grid-cols-4     // XL: 4 columns
  gap-4 md:gap-6     // Responsive gap
">
```

#### Hide/Show Elements
```tsx
// Show on mobile, hide on desktop
<div className="block lg:hidden">

// Hide on mobile, show on desktop
<div className="hidden lg:block">
```

#### Responsive Text
```tsx
<h1 className="
  text-2xl sm:text-3xl md:text-4xl lg:text-5xl
  leading-tight
">
  Responsive Heading
</h1>
```

#### Responsive Spacing
```tsx
<section className="
  px-4 py-8
  sm:px-6 sm:py-10
  md:px-8 md:py-12
  lg:px-10 lg:py-16
">
```

### Touch Target Guidelines

- Minimum touch target: 44x44px (iOS) / 48x48px (Android)
- Add adequate spacing between touch targets (at least 8px)
- Increase button padding on mobile

```tsx
<button className="
  px-4 py-2      // Desktop
  sm:px-6 sm:py-3  // Larger on desktop
  min-h-[44px]   // Ensure minimum touch target
">
```

---

## Accessibility

### Color Contrast

All text must meet WCAG AA standards:
- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- Interactive elements: 3:1 against surrounding colors

### Focus States

Always provide visible focus indicators:
```tsx
<button className="
  focus:outline-none
  focus:ring-2 focus:ring-primary focus:ring-offset-2
  dark:focus:ring-offset-gray-900
">
```

### Keyboard Navigation

- Ensure all interactive elements are keyboard accessible
- Maintain logical tab order
- Provide skip links for navigation

```tsx
// Skip to main content
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

### Screen Reader Support

```tsx
// Visually hidden but accessible to screen readers
<span className="sr-only">Loading...</span>

// ARIA labels for icon buttons
<button aria-label="Close modal">
  <X className="w-5 h-5" />
</button>

// ARIA live regions for dynamic content
<div aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Semantic HTML

Use appropriate HTML elements:
- `<button>` for actions
- `<a>` for navigation
- `<nav>` for navigation sections
- `<main>` for main content
- `<header>` and `<footer>` for page structure
- Proper heading hierarchy (h1 → h2 → h3)

---

## Performance Best Practices

### Font Loading
```css
/* Use font-display: swap for custom fonts */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap');
```

### Image Optimization
- Use Next.js Image component for automatic optimization
- Provide appropriate sizes for different viewports
- Use WebP format with fallbacks

### CSS Optimization
- Leverage Tailwind's tree-shaking
- Minimize custom CSS
- Use CSS containment for complex components

### Animation Performance
- Use CSS transforms and opacity for animations
- Prefer `transition` over `animation` for simple state changes
- Use `will-change` sparingly

```tsx
<div className="
  transition-transform duration-200
  hover:scale-105
">
```

---

## Quick Reference Cheat Sheet

### Common Color Classes
```
Text:        text-gray-900 dark:text-gray-50
Background:  bg-white dark:bg-gray-800
Border:      border-gray-200 dark:border-gray-700
Primary:     bg-primary text-white
Secondary:   bg-secondary text-gray-900
Success:     text-green-600 bg-green-50
Error:       text-red-600 bg-red-50
Warning:     text-yellow-600 bg-yellow-50
```

### Common Layout Patterns
```tsx
Container:   mx-auto max-w-7xl px-4 sm:px-6 lg:px-8
Section:     py-12 md:py-16 lg:py-20
Card:        rounded-lg shadow-sm p-6
Grid:        grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
Flex:        flex items-center justify-between gap-4
```

### Common Typography
```tsx
H1:          text-3xl md:text-4xl font-bold font-poppins
H2:          text-2xl md:text-3xl font-semibold font-poppins
H3:          text-xl font-medium
Body:        text-base leading-relaxed
Small:       text-sm text-gray-600 dark:text-gray-400
```

---

**Last Updated:** 2025-01-16
**Version:** 1.0.0
