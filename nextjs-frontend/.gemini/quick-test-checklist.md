# Quick Manual Testing Checklist
**Execute this checklist systematically at http://localhost:3000/chat**

---

## 🎯 CRITICAL PATH TESTS (Must Pass)

### 1. Sidebar Functionality ⭐
- [ ] **Logo Toggle**: Hover over logo → transforms to toggle icon
- [ ] **Collapse**: Click logo → sidebar collapses to icons only
- [ ] **Border**: Collapsed sidebar has thicker border (more visible)
- [ ] **Expand**: Click anywhere on collapsed sidebar → expands
- [ ] **User Menu**: Click avatar → dropdown shows theme switcher & sign out
- [ ] **Theme**: Toggle dark/light mode → works immediately

**Notes**: _______________________________________________

---

### 2. Agent System ⭐
- [ ] **Agent Button**: Click "Agents" in sidebar → navigates to /chat?agent=bioinformatics
- [ ] **Agent Selector**: Empty state shows agent dropdown in input area
- [ ] **Agent List**: Click dropdown → shows all agents (General, Bioinformatics, etc.)
- [ ] **Selection**: Select agent → updates URL and context
- [ ] **Agent Response**: Send "Explain DNA" with Bioinformatics agent → specialized response

**Notes**: _______________________________________________

---

### 3. Search Functionality ⭐
- [ ] **Keyboard**: Press Cmd+K (Mac) or Ctrl+K (Windows) → search dialog opens
- [ ] **Click**: Click "Search chats" in sidebar → dialog opens
- [ ] **Recent**: Empty search shows recent conversations
- [ ] **Search**: Type query → results filter in real-time
- [ ] **Navigate**: Click result → opens that chat
- [ ] **Close**: Press Escape → dialog closes

**Notes**: _______________________________________________

---

### 4. Message Streaming ⭐
- [ ] **Send**: Send message "Write a story about AI"
- [ ] **Stream**: Tokens appear progressively (not all at once)
- [ ] **Stop Button**: Stop button appears during streaming
- [ ] **Stop**: Click stop → streaming stops cleanly
- [ ] **Complete**: Full message preserved after stop

**Notes**: _______________________________________________

---

### 5. Database Persistence ⭐
- [ ] **Create**: Send several messages in a chat
- [ ] **Refresh**: Refresh page (F5)
- [ ] **Persist**: All messages still visible
- [ ] **Sidebar**: Chat appears in sidebar history
- [ ] **Navigate**: Click chat in sidebar → loads correctly
- [ ] **Timestamp**: Chat grouped correctly (Last 7 days, etc.)

**Notes**: _______________________________________________

---

## 🔧 FEATURE TESTS (Should Pass)

### 6. Model Selector
- [ ] **Open**: Click model selector in header → dropdown opens
- [ ] **Models**: All models listed (GPT-4o Mini, etc.)
- [ ] **Badges**: Capability badges visible (Think, Search, Image, Code)
- [ ] **Select**: Choose different model → selection persists
- [ ] **Cookie**: Refresh page → model selection remembered

**Notes**: _______________________________________________

---

### 7. Source Citations (if web search enabled)
- [ ] **Trigger**: Send "Latest CRISPR developments"
- [ ] **Sources**: Source citations panel appears
- [ ] **Favicons**: Website favicons load
- [ ] **Click**: Click source chip → opens in new tab
- [ ] **Expand**: Click to expand sources panel → all sources listed
- [ ] **Count**: Source count accurate

**Notes**: _______________________________________________

---

### 8. Artifacts (if code generation)
- [ ] **Generate**: Send "Create a React button component"
- [ ] **Panel**: Artifact panel appears on right
- [ ] **Syntax**: Code syntax highlighted
- [ ] **Copy**: Copy button works
- [ ] **Persist**: Refresh page → artifact still visible

**Notes**: _______________________________________________

---

### 9. Reasoning Display (if model supports)
- [ ] **Generate**: Use reasoning-capable model
- [ ] **Block**: Reasoning block appears with brain icon
- [ ] **Expand**: Click to expand → reasoning content shows
- [ ] **Markdown**: Content formatted properly
- [ ] **Collapse**: Click again → collapses smoothly

**Notes**: _______________________________________________

---

## 📱 RESPONSIVE TESTS (Should Pass)

### 10. Mobile Layout
- [ ] **Resize**: Resize browser to 375px width
- [ ] **Hidden**: Sidebar hidden by default
- [ ] **Menu**: Hamburger menu visible in header
- [ ] **Open**: Click hamburger → sidebar opens as drawer
- [ ] **Overlay**: Overlay appears behind drawer
- [ ] **Close**: Click outside → drawer closes
- [ ] **Touch**: All buttons at least 40px (easy to tap)
- [ ] **Scroll**: No horizontal scroll

**Notes**: _______________________________________________

---

### 11. Desktop Layout
- [ ] **Resize**: Resize to 1920px width
- [ ] **Sidebar**: Sidebar visible by default
- [ ] **Header**: Clean header (no hamburger on desktop)
- [ ] **Layout**: Content uses full width appropriately
- [ ] **Spacing**: Proper margins and padding

**Notes**: _______________________________________________

---

## ⚠️ ERROR HANDLING (Should Pass)

### 12. Network Errors
- [ ] **Offline**: Disconnect network
- [ ] **Send**: Try to send message
- [ ] **Error**: Error toast appears
- [ ] **Message**: Error message is clear
- [ ] **Reconnect**: Reconnect network
- [ ] **Retry**: Message sends successfully

**Notes**: _______________________________________________

---

### 13. Edge Cases
- [ ] **Empty Input**: Try to send empty message → prevented
- [ ] **Long Message**: Send very long message (1000+ chars) → works
- [ ] **Special Chars**: Send message with emojis, symbols → renders correctly
- [ ] **Rapid Clicks**: Click send button rapidly → no duplicate messages
- [ ] **Concurrent**: Open search while streaming → no conflicts

**Notes**: _______________________________________________

---

## 🎨 UI/UX POLISH (Nice to Have)

### 14. Animations
- [ ] **Sidebar**: Sidebar collapse/expand smooth (200ms)
- [ ] **Dropdown**: Dropdowns animate smoothly
- [ ] **Messages**: New messages fade in
- [ ] **Hover**: Hover states work on all buttons
- [ ] **Focus**: Focus indicators visible

**Notes**: _______________________________________________

---

### 15. Accessibility
- [ ] **Keyboard**: Tab through all interactive elements
- [ ] **Focus**: Focus order logical
- [ ] **Labels**: All buttons have tooltips/labels
- [ ] **Contrast**: Text readable in both themes
- [ ] **Screen Reader**: ARIA labels present (check in DevTools)

**Notes**: _______________________________________________

---

## 📊 TEST SUMMARY

**Date**: ________________  
**Tester**: ________________  
**Browser**: ________________  
**Viewport**: ________________

### Results
- **Total Tests**: 15 categories
- **Passed**: _____ / 15
- **Failed**: _____ / 15
- **Blocked**: _____ / 15

### Critical Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Minor Issues Found
1. _______________________________________________
2. _______________________________________________
3. _______________________________________________

### Overall Status
- [ ] ✅ **READY FOR PRODUCTION** - All critical tests pass
- [ ] ⚠️ **NEEDS FIXES** - Some critical tests failed
- [ ] ❌ **NOT READY** - Major issues found

---

## 🔍 DEBUGGING TIPS

If something fails:
1. **Open DevTools** (F12)
2. **Check Console** for errors
3. **Check Network** tab for failed requests
4. **Check Application** tab → Local Storage, Cookies
5. **Take Screenshot** of the issue
6. **Note exact steps** to reproduce

---

## 📝 QUICK DATABASE CHECKS

Run these in your database tool:

```sql
-- Check recent chats
SELECT id, title, "createdAt", "userId" 
FROM "Chat" 
ORDER BY "createdAt" DESC 
LIMIT 10;

-- Check recent messages
SELECT id, role, content, "chatId", "createdAt"
FROM "Message"
ORDER BY "createdAt" DESC
LIMIT 20;

-- Check if sources are saved
SELECT id, content, "chatId"
FROM "Message"
WHERE content LIKE '%sources%'
LIMIT 5;
```

---

**Testing Complete!** 🎉

Next steps:
1. Review all failed tests
2. File bug reports for critical issues
3. Document workarounds
4. Re-test after fixes
