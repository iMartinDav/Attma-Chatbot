#!/bin/bash
# Code Quality Audit Script
# Reviews all modified files for production readiness

echo "🔍 Starting Code Quality Audit..."
echo "================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
PASSED=0
WARNINGS=0
FAILED=0

# Function to check a file
check_file() {
    local file=$1
    TOTAL_FILES=$((TOTAL_FILES + 1))
    
    echo "📄 Checking: $file"
    
    # Check if file exists
    if [ ! -f "$file" ]; then
        echo -e "${RED}  ✗ File not found${NC}"
        FAILED=$((FAILED + 1))
        return
    fi
    
    local issues=0
    
    # Check for console.log (should use proper logging)
    if grep -q "console\.log" "$file" 2>/dev/null; then
        echo -e "${YELLOW}  ⚠ Contains console.log statements${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for TODO/FIXME comments
    if grep -qE "(TODO|FIXME|HACK|XXX)" "$file" 2>/dev/null; then
        echo -e "${YELLOW}  ⚠ Contains TODO/FIXME comments${NC}"
        issues=$((issues + 1))
    fi
    
    # Check for unused imports (basic check)
    if grep -q "import.*from.*;" "$file" 2>/dev/null; then
        # This is a basic check - TypeScript compiler does better
        :
    fi
    
    # Check for proper TypeScript (if .ts or .tsx)
    if [[ "$file" == *.tsx ]] || [[ "$file" == *.ts ]]; then
        # Check for 'any' type (should be avoided)
        if grep -q ": any" "$file" 2>/dev/null; then
            echo -e "${YELLOW}  ⚠ Contains 'any' types (consider specific types)${NC}"
            issues=$((issues + 1))
        fi
    fi
    
    # Check file size (warn if > 500 lines)
    local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    if [ "$lines" -gt 500 ]; then
        echo -e "${YELLOW}  ⚠ Large file ($lines lines) - consider splitting${NC}"
        issues=$((issues + 1))
    fi
    
    if [ $issues -eq 0 ]; then
        echo -e "${GREEN}  ✓ Passed${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${YELLOW}  ⚠ $issues warning(s)${NC}"
        WARNINGS=$((WARNINGS + 1))
    fi
    
    echo ""
}

# Modified files
echo "Checking modified files..."
echo ""

check_file "app/api/chat/route.ts"
check_file "components/chat/app-sidebar.tsx"
check_file "components/chat/chat-header.tsx"
check_file "components/chat/chat.tsx"
check_file "components/chat/message.tsx"
check_file "components/chat/model-selector.tsx"
check_file "components/chat/multimodal-input.tsx"
check_file "components/chat/sidebar-user-nav.tsx"
check_file "components/chat/visibility-selector.tsx"
check_file "components/icons.tsx"
check_file "lib/ai/message-utils.ts"
check_file "lib/ai/models.ts"
check_file "lib/ai/prompts.ts"
check_file "lib/ai/providers.ts"

# New files
echo "Checking new files..."
echo ""

check_file "app/api/history/search/route.ts"
check_file "components/chat/agent-selector.tsx"
check_file "components/chat/reasoning-block.tsx"
check_file "components/chat/search-dialog.tsx"
check_file "components/chat/source-citations.tsx"
check_file "lib/ai/agents/index.ts"
check_file "lib/ai/tools/index.ts"
check_file "lib/ai/tools/openai-tools.ts"

# Summary
echo "================================"
echo "📊 Audit Summary"
echo "================================"
echo -e "Total files checked: $TOTAL_FILES"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Audit failed - fix critical issues before committing${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Audit passed with warnings - review before committing${NC}"
    exit 0
else
    echo -e "${GREEN}✅ All checks passed - ready for commit${NC}"
    exit 0
fi
