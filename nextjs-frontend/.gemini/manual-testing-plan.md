# Manual Testing Plan - Comprehensive Feature Validation

**Date**: 2026-01-02  
**Tester**: Senior QA Review  
**Build**: Post-Sidebar Refinement  
**Environment**: Development (localhost:3000)

---

## Test Execution Strategy

### Scope

1. **New AI SDK Features** - Streaming, reasoning, artifacts
2. **Sidebar UI/UX** - Toggle, collapse, responsive
3. **Agent System** - Agent selection, routing, specialized responses
4. **Search Functionality** - Command+K, history search, results
5. **Database Persistence** - Chat history, messages, metadata
6. **Source Citations** - Web search sources, display
7. **Artifacts** - Code generation, rendering, interactions
8. **Responsive Design** - Mobile, tablet, desktop

### Test Levels

- ✅ **Smoke Tests**: Critical path functionality
- ✅ **Integration Tests**: Component interactions
- ✅ **E2E Tests**: Complete user workflows
- ✅ **Regression Tests**: Existing features still work

---

## Test Cases

### 1. SIDEBAR UI/UX TESTS

#### TC-001: Sidebar Toggle (Desktop)

**Priority**: P0 (Critical)  
**Steps**:

1. Open http://localhost:3000/chat
2. Verify sidebar is expanded by default
3. Hover over Attma logo - verify it transforms to toggle icon
4. Click logo - verify sidebar collapses
5. Click anywhere on collapsed sidebar - verify it expands
6. Click toggle button in sidebar header - verify collapse

**Expected**:

- Logo transforms smoothly on hover
- Sidebar animates collapse/expand (200ms)
- Collapsed state shows icons only
- Border is stronger when collapsed (border-r-2)
- All interactions work without errors

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-002: Sidebar Mobile Behavior

**Priority**: P0 (Critical)  
**Steps**:

1. Resize browser to mobile width (<768px)
2. Verify sidebar is hidden
3. Click hamburger menu in header
4. Verify sidebar opens as drawer overlay
5. Click outside drawer - verify it closes
6. Select a chat - verify drawer closes

**Expected**:

- Sidebar renders as Sheet (drawer) on mobile
- Overlay appears behind drawer
- Drawer slides in from left
- Clicking outside closes drawer
- Navigation works correctly

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-003: User Dropdown Menu

**Priority**: P1 (High)  
**Steps**:

1. Click user avatar in sidebar footer
2. Verify dropdown opens with theme switcher and sign out
3. Toggle dark/light mode
4. Verify theme changes persist
5. Click avatar when collapsed - verify sidebar expands (not dropdown)

**Expected**:

- Dropdown shows theme switcher
- Theme toggle works immediately
- Sign out option visible
- Collapsed state: click expands sidebar first

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 2. AGENT SYSTEM TESTS

#### TC-004: Agent Selection

**Priority**: P0 (Critical)  
**Steps**:

1. Start new chat
2. Click "Agents" button in sidebar
3. Verify navigation to /chat?agent=bioinformatics
4. Verify agent selector shows in empty state
5. Click agent dropdown - verify all agents listed
6. Select "General" agent
7. Select "Bioinformatics" agent

**Expected**:

- Agent selector displays current agent
- Dropdown shows all available agents
- Selection updates URL parameter
- Agent context applied to conversation
- Icons and descriptions display correctly

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-005: Agent-Specific Responses

**Priority**: P1 (High)  
**Steps**:

1. Select "Bioinformatics" agent
2. Send message: "Explain RNA sequencing"
3. Verify response is bioinformatics-focused
4. Check for specialized terminology
5. Switch to "General" agent
6. Send same message
7. Compare responses

**Expected**:

- Bioinformatics agent uses domain-specific language
- Response quality appropriate for agent type
- Agent context maintained throughout conversation
- Switching agents works without errors

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 3. SEARCH FUNCTIONALITY TESTS

#### TC-006: Command+K Search

**Priority**: P1 (High)  
**Steps**:

1. Press Cmd+K (or Ctrl+K on Windows)
2. Verify search dialog opens
3. Type search query: "test"
4. Verify results filter in real-time
5. Click a result - verify navigation to chat
6. Press Escape - verify dialog closes

**Expected**:

- Dialog opens with keyboard shortcut
- Search is debounced (300ms)
- Results update as you type
- Clicking result navigates correctly
- Recent chats shown when empty
- Dialog closes on Escape

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-007: Search API Integration

**Priority**: P1 (High)  
**Steps**:

1. Open search dialog
2. Type query that matches existing chat
3. Verify API call to /api/history/search
4. Check network tab for correct request
5. Verify response format
6. Test with no results
7. Test with special characters

**Expected**:

- API endpoint returns correct data
- Response includes: id, title, createdAt
- Empty results handled gracefully
- Special characters don't break search
- Error handling works

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 4. AI SDK & STREAMING TESTS

#### TC-008: Message Streaming

**Priority**: P0 (Critical)  
**Steps**:

1. Send a message: "Write a long story about AI"
2. Observe streaming behavior
3. Verify tokens appear progressively
4. Check for smooth rendering
5. Verify stop button appears
6. Click stop mid-stream
7. Verify stream stops cleanly

**Expected**:

- Tokens stream in real-time
- No flickering or layout shifts
- Stop button functional
- Partial response preserved
- No console errors

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-009: Reasoning Display

**Priority**: P1 (High)  
**Steps**:

1. Use a model with reasoning (e.g., GPT-4o with thinking)
2. Send complex query
3. Verify reasoning block appears
4. Click to expand reasoning
5. Verify markdown rendering
6. Check streaming indicator during reasoning

**Expected**:

- Reasoning block displays with brain icon
- Collapsible/expandable
- Markdown renders correctly
- Streaming indicator shows during generation
- Content formatted properly

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-010: Artifacts Generation

**Priority**: P1 (High)  
**Steps**:

1. Send: "Create a React component for a button"
2. Verify artifact panel appears
3. Check code syntax highlighting
4. Verify copy button works
5. Test with multiple artifacts
6. Verify artifact persistence in DB

**Expected**:

- Artifact renders in side panel
- Code highlighted correctly
- Copy to clipboard works
- Multiple artifacts handled
- Artifacts saved to database
- Artifacts load on page refresh

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 5. SOURCE CITATIONS TESTS

#### TC-011: Web Search Sources

**Priority**: P1 (High)  
**Steps**:

1. Send: "What are the latest developments in CRISPR?"
2. Verify web search is triggered
3. Check for source citations panel
4. Verify favicons load
5. Click source chip - verify opens in new tab
6. Expand sources panel
7. Verify all sources listed

**Expected**:

- Sources display with favicons
- Source chips are clickable
- External links open in new tab
- Panel expands/collapses smoothly
- Duplicate sources removed
- Source count accurate

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-012: Source Panel Interactions

**Priority**: P2 (Medium)  
**Steps**:

1. Generate response with sources
2. Verify collapsed preview shows first 3
3. Click to expand
4. Verify all sources listed
5. Hover over source - check hover state
6. Verify source metadata (title, URL)

**Expected**:

- Preview shows 3 sources + count
- Expansion animated smoothly
- All sources accessible
- Hover effects work
- Metadata displays correctly

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 6. DATABASE PERSISTENCE TESTS

#### TC-013: Chat History Persistence

**Priority**: P0 (Critical)  
**Steps**:

1. Create new chat
2. Send multiple messages
3. Refresh page
4. Verify messages persist
5. Navigate away and back
6. Check sidebar history
7. Verify chat appears in correct time group

**Expected**:

- All messages saved to DB
- Messages load on refresh
- Chat appears in sidebar
- Grouped correctly (Last 7 days, etc.)
- Timestamps accurate
- No data loss

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-014: Message Metadata Storage

**Priority**: P1 (High)  
**Steps**:

1. Send message with agent selected
2. Generate response with sources
3. Create artifact
4. Check database for:
   - Agent ID
   - Source URLs
   - Artifact content
   - Reasoning data
5. Verify all metadata persists

**Expected**:

- Agent ID saved with message
- Sources stored correctly
- Artifacts in database
- Reasoning preserved
- Metadata retrievable

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-015: Chat Visibility Persistence

**Priority**: P1 (High)  
**Steps**:

1. Create chat
2. Set visibility to "Public"
3. Refresh page
4. Verify visibility persists
5. Change to "Private"
6. Verify update saves
7. Check database record

**Expected**:

- Visibility setting saves
- Persists across refreshes
- Updates correctly
- Database reflects changes
- No race conditions

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 7. MODEL SELECTOR TESTS

#### TC-016: Model Selection

**Priority**: P1 (High)  
**Steps**:

1. Click model selector in header
2. Verify all models listed
3. Check for capability badges (Think, Search, Image, Code)
4. Select different model
5. Verify selection persists
6. Send message with new model
7. Verify correct model used

**Expected**:

- All configured models appear
- Capabilities displayed correctly
- Selection saves to cookie
- Model change takes effect
- No errors on switch

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 8. RESPONSIVE DESIGN TESTS

#### TC-017: Mobile Layout

**Priority**: P0 (Critical)  
**Steps**:

1. Test on mobile viewport (375px)
2. Verify header layout
3. Check input field sizing
4. Test message bubbles
5. Verify touch targets (min 40px)
6. Test sidebar drawer
7. Check all interactive elements

**Expected**:

- Layout doesn't break
- No horizontal scroll
- Touch targets adequate
- Text readable
- Images scale properly
- All features accessible

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-018: Tablet Layout

**Priority**: P2 (Medium)  
**Steps**:

1. Test on tablet viewport (768px)
2. Verify sidebar behavior
3. Check responsive breakpoints
4. Test both orientations

**Expected**:

- Smooth transition at breakpoint
- Sidebar behavior appropriate
- Layout optimized for tablet
- No UI glitches

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 9. ERROR HANDLING TESTS

#### TC-019: Network Errors

**Priority**: P1 (High)  
**Steps**:

1. Disconnect network
2. Try to send message
3. Verify error handling
4. Reconnect network
5. Retry message
6. Verify recovery

**Expected**:

- Error message displayed
- User informed of issue
- Retry mechanism works
- No data loss
- Graceful degradation

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-020: API Errors

**Priority**: P1 (High)  
**Steps**:

1. Trigger API error (invalid input)
2. Verify error toast appears
3. Check error message clarity
4. Verify chat state preserved
5. Test recovery

**Expected**:

- Error caught and handled
- User-friendly message
- State not corrupted
- Can continue using app
- Error logged properly

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

### 10. PERFORMANCE TESTS

#### TC-021: Large Chat History

**Priority**: P2 (Medium)  
**Steps**:

1. Load chat with 100+ messages
2. Measure load time
3. Test scrolling performance
4. Verify virtual scrolling (if implemented)
5. Check memory usage

**Expected**:

- Load time < 2 seconds
- Smooth scrolling
- No memory leaks
- Efficient rendering
- No lag

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

#### TC-022: Concurrent Operations

**Priority**: P2 (Medium)  
**Steps**:

1. Stream a long response
2. Open search dialog mid-stream
3. Switch agents
4. Change model
5. Verify no conflicts

**Expected**:

- Operations don't interfere
- No race conditions
- State remains consistent
- No crashes
- Smooth UX

**Status**: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## Test Execution Checklist

### Pre-Test Setup

- [ ] Database seeded with test data
- [ ] All environment variables set
- [ ] Docker containers running
- [ ] Browser DevTools open
- [ ] Network tab monitoring
- [ ] Console cleared

### During Testing

- [ ] Document all bugs found
- [ ] Take screenshots of issues
- [ ] Note console errors
- [ ] Check network requests
- [ ] Monitor performance
- [ ] Test edge cases

### Post-Test

- [ ] Summarize results
- [ ] File bug reports
- [ ] Update test cases
- [ ] Document workarounds
- [ ] Verify fixes

---

## Bug Report Template

```
**Bug ID**: BUG-XXX
**Severity**: Critical | High | Medium | Low
**Test Case**: TC-XXX
**Environment**: Browser, OS, Viewport

**Steps to Reproduce**:
1.
2.
3.

**Expected Result**:

**Actual Result**:

**Screenshots/Logs**:

**Workaround**:

**Status**: Open | In Progress | Fixed | Won't Fix
```

---

## Success Criteria

### Must Pass (P0)

- All sidebar interactions work
- Agent selection functional
- Message streaming works
- Database persistence verified
- No critical errors

### Should Pass (P1)

- Search fully functional
- Sources display correctly
- Artifacts render properly
- Mobile responsive
- Error handling works

### Nice to Have (P2)

- Performance optimal
- All edge cases handled
- Animations smooth
- Accessibility perfect

---

**Test Plan Status**: Ready for Execution  
**Estimated Time**: 2-3 hours for complete suite  
**Next Step**: Execute tests systematically
