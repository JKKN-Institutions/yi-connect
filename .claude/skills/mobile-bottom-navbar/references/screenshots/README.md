# Mobile Bottom Navbar - Visual Reference

This folder contains reference screenshots from the MyJKKN application showing the expected UI/UX patterns for the mobile bottom navbar.

## Screenshots

### 1. `myjkkn-dashboard.png`
**Main Dashboard View with Bottom Navbar**

Shows:
- Bottom navbar with 5 items: Overview, User Management, Applications, Application Hub, More
- Clean spacing and icon design
- Active state highlighting ("Overview" is active with primary color)
- Badge count on "More" button showing number of additional menu groups

**Key Features:**
- Responsive mobile view (400px width)
- Items evenly distributed across the navbar
- Clear visual hierarchy with icons + labels
- Active indicator below selected item

---

### 2. `myjkkn-submenu-dropdown.png`
**Submenu Dropdown Expanded**

Shows:
- Clicking on "Overview" expands submenu above the navbar
- Submenu displays in a 3-column grid layout
- Submenu items: "Dashboard" and "AI Assistant"
- Each item has icon + label
- Clean card-based design with rounded corners
- Active item highlighted with primary background color

**Key Features:**
- Submenu appears ABOVE navbar (not below)
- Grid layout (3 columns) for submenu items
- Icon-based navigation
- Backdrop overlay to focus attention on submenu
- Smooth animations on expand/collapse

---

### 3. `myjkkn-more-menu.png`
**More Menu Modal with Collapsible Groups**

Shows:
- Full-screen sheet modal titled "All Menus"
- Collapsible accordion sections for menu groups
- "Organization Management" group expanded showing 9 submenu items
- Each group header shows:
  - Group icon (left)
  - Group label (center)
  - Item count (right, e.g., "9")
  - Chevron indicator for expand/collapse state
- Submenu items in 3-column grid with icons + labels
- Items: Dashboard, Institutions, Degrees, Departments, Programs, Semesters, Sections, All Courses, Course Mappings

**Key Features:**
- Sheet slides up from bottom with rounded top corners
- All groups expanded by default (accordion with `type="multiple"`)
- Group headers with icon badges
- 3-column grid layout for submenu items
- Active item highlighting with primary color
- Scrollable content area with hidden scrollbar
- Clean spacing and visual hierarchy

---

## Design Patterns to Follow

When implementing this navbar in other applications, ensure:

### ✅ Bottom Navbar
1. **Layout**: 4-5 primary items + "More" button
2. **Spacing**: Even distribution across width
3. **Icons**: Lucide React icons (5x5, strokeWidth: 2-2.5)
4. **Labels**: 10px text below icon
5. **Active State**: Primary color + indicator line below
6. **Badge**: Show count on "More" button (red badge, top-right)

### ✅ Submenu Dropdown
1. **Position**: Above navbar (not below)
2. **Layout**: 3-column grid
3. **Items**: Icon + label in rounded cards
4. **Backdrop**: Semi-transparent overlay
5. **Animation**: Spring-based expand/collapse
6. **Max Height**: 50vh with scroll

### ✅ More Menu Modal
1. **Component**: Sheet from shadcn/ui (side="bottom")
2. **Height**: 80vh with rounded top (rounded-t-3xl)
3. **Title**: "All Menus" header
4. **Accordion**: Multiple type, all groups expanded by default
5. **Group Header**:
   - Icon badge (left, rounded-lg background)
   - Label (center, font-medium)
   - Count (right, text-xs muted)
   - Chevron (auto-added by AccordionTrigger)
6. **Submenu Grid**: 3-column layout with gap-2
7. **Scrollbar**: Hidden (scrollbarWidth: none, -webkit-scrollbar: none)
8. **Item Cards**: Icon + label, rounded-lg, primary highlight when active

---

## Implementation Checklist

When using this skill in a new application:

- [ ] Copy all component files from `assets/components/BottomNav/`
- [ ] Copy hook files from `assets/hooks/`
- [ ] Install dependencies (zustand, framer-motion, lucide-react)
- [ ] Install shadcn/ui components (sheet, accordion)
- [ ] Configure navigation structure in `lib/sidebarMenuLink.ts`
- [ ] Integrate BottomNavbar in layout with `pb-20` padding
- [ ] Test on mobile (< 1024px)
- [ ] Verify submenu dropdown appears ABOVE navbar
- [ ] Verify More menu matches accordion + grid pattern
- [ ] Verify active state highlighting works
- [ ] Verify state persists across page refreshes
- [ ] Test on real iOS/Android devices for safe area insets

---

## Common Issues & Solutions

### Issue: More menu shows flat list instead of accordion grid
**Cause:** Using outdated BottomNavMoreMenu component
**Solution:** Copy latest `bottom-nav-more-menu.tsx` from assets folder

### Issue: Submenu appears below navbar
**Cause:** Incorrect z-index or positioning
**Solution:** Ensure submenu has higher z-index and uses `border-t` positioning

### Issue: No icon grid, only text items
**Cause:** FlatMenuItem type missing icon property
**Solution:** Use updated types.ts with icon: LucideIcon

### Issue: Groups not expanded by default
**Cause:** Accordion defaultValue not set
**Solution:** `<Accordion type="multiple" defaultValue={groups.map(g => g.id)}>`

---

## Related Documentation

- `complete-implementation.md` - Full setup guide
- `component-reference.md` - API documentation
- `customization-guide.md` - Theme and styling
- `integration-guide.md` - Auth and layout integration
- `troubleshooting.md` - Common problems and fixes
