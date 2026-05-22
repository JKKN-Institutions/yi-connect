#!/bin/bash
# BUG-002 Verification Script
# Tests EC Member access to /member-requests

set -e

SESSION="ec-verify"
BASE_URL="https://yi-connect-app.vercel.app"
BROWSER_USE="$HOME/.local/bin/browser-use"

echo "=========================================="
echo "BUG-002 Verification: EC Member Access"
echo "=========================================="

# Step 1: Open browser
echo ""
echo "[1/6] Opening browser at login page..."
$BROWSER_USE -s $SESSION open "$BASE_URL/login" --headed
sleep 3

# Step 2: Get state to find EC Member login button
echo ""
echo "[2/6] Getting page state..."
$BROWSER_USE -s $SESSION state

echo ""
echo ">>> MANUAL ACTION REQUIRED <<<"
echo "Look for 'EC Member' demo login button index in the state output above."
echo "Enter the element index to click, or 'skip' to navigate manually:"
read -r CLICK_INDEX

if [ "$CLICK_INDEX" != "skip" ]; then
    echo "Clicking element $CLICK_INDEX..."
    $BROWSER_USE -s $SESSION click "$CLICK_INDEX"
    sleep 3
fi

# Step 3: Take screenshot of dashboard
echo ""
echo "[3/6] Taking screenshot of dashboard..."
$BROWSER_USE -s $SESSION screenshot
echo "Screenshot saved. Check if logged in as EC Member."

# Step 4: Navigate to member-requests
echo ""
echo "[4/6] Navigating to /member-requests (THE CRITICAL TEST)..."
$BROWSER_USE -s $SESSION navigate "$BASE_URL/member-requests"
sleep 3

# Step 5: Get state and screenshot
echo ""
echo "[5/6] Taking screenshot of member-requests page..."
$BROWSER_USE -s $SESSION screenshot

echo ""
echo "Getting page state to verify URL..."
$BROWSER_USE -s $SESSION state

# Step 6: Cleanup
echo ""
echo "[6/6] Test complete. Close browser session? (y/n)"
read -r CLOSE

if [ "$CLOSE" == "y" ]; then
    $BROWSER_USE -s $SESSION close
    echo "Session closed."
else
    echo "Session kept open: $SESSION"
    echo "Close manually with: $BROWSER_USE -s $SESSION close"
fi

echo ""
echo "=========================================="
echo "VERIFICATION RESULTS"
echo "=========================================="
echo ""
echo "If page loaded /member-requests successfully = BUG PRESENT"
echo "If redirected to /unauthorized = BUG FIXED"
echo ""
