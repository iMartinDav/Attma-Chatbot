# Code Review Findings - Icon Management

## ❌ CRITICAL ISSUE: Inline SVGs Instead of Centralized Icons

### Problem
Multiple components have inline SVG icons instead of using the centralized `components/icons.tsx` file. This violates the project's icon management pattern and creates:
- Code duplication
- Maintenance burden
- Inconsistent styling
- Larger bundle size

### Files with Inline SVGs
1. ✅ `components/chat/agent-selector.tsx` - **FIXED**
2. ❌ `components/chat/app-sidebar.tsx` - **NEEDS FIX**
3. ❌ `components/chat/chat-header.tsx` - **NEEDS FIX**
4. ❌ `components/chat/search-dialog.tsx` - **NEEDS FIX**

### Required Actions

#### 1. Add Missing Icons to `components/icons.tsx`
Need to add:
- `NewChatIcon`
- `SearchIcon`
- `BrainIcon` (Agents)
- `SidebarToggleIcon`
- `MenuIcon` (Hamburger)
- `ChevronUpIcon`
- `LogOutIcon`

#### 2. Update Components to Import Icons
All components must import from `@/components/icons` instead of defining inline SVGs.

### Pattern to Follow

**❌ WRONG** (Current):
```tsx
const NewChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path d="..."/>
  </svg>
);
```

**✅ CORRECT** (Should be):
```tsx
import { NewChatIcon } from '@/components/icons';

// Use directly
<NewChatIcon />
```

### Impact
- **Severity**: Medium
- **Effort**: 2-3 hours to fix all files
- **Risk**: Low (straightforward refactor)

### Next Steps
1. Add all missing icons to `icons.tsx`
2. Update `app-sidebar.tsx` to use centralized icons
3. Update `chat-header.tsx` to use centralized icons
4. Update `search-dialog.tsx` to use centralized icons
5. Remove all inline SVG definitions
6. Test all components still render correctly

---

## Status
- [x] Identified issue
- [x] Fixed agent-selector.tsx
- [ ] Fix app-sidebar.tsx
- [ ] Fix chat-header.tsx
- [ ] Fix search-dialog.tsx
- [ ] Verify all icons render
- [ ] Run manual tests
