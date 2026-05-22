#!/bin/bash

# ============================================================================
# ZeusOS Worktree Setup Script
# ============================================================================
# Configures a new git worktree with all necessary local settings and hooks
# Run this after creating a new worktree with: git worktree add <path> <branch>
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Setting up ZeusOS worktree..."
echo

# ============================================================================
# 1. Configure git hooks path
# ============================================================================
echo "📌 Configuring git hooks..."
git config core.hooksPath .githooks
echo "✓ Git hooks path configured (.githooks)"
echo

# ============================================================================
# 2. Verify .env exists
# ============================================================================
echo "📌 Checking environment configuration..."
if [ ! -f "$PROJECT_ROOT/.env" ]; then
    echo "⚠️  .env file not found. Copying from main..."
    if [ -f "/Users/danielonzimai/Developer/zeusos/.env" ]; then
        cp /Users/danielonzimai/Developer/zeusos/.env "$PROJECT_ROOT/.env"
        echo "✓ .env copied"
    else
        echo "⚠️  Could not find main .env file. Please create .env manually."
        echo "   Example: cp /Users/danielonzimai/Developer/zeusos/.env .env"
    fi
else
    echo "✓ .env already exists"
fi
echo

# ============================================================================
# 3. Install dependencies
# ============================================================================
echo "📌 Installing dependencies..."
npm ci
echo "✓ Dependencies installed"
echo

# ============================================================================
# 4. Verify hooks are active
# ============================================================================
echo "📌 Verifying git hooks..."
if git config --get core.hooksPath | grep -q "\.githooks"; then
    echo "✓ Git hooks configured and active"

    # Test the hook
    if [ -x "$PROJECT_ROOT/.githooks/pre-commit" ]; then
        echo "✓ Pre-commit hook is executable"
    else
        echo "⚠️  Pre-commit hook is not executable. Fixing..."
        chmod +x "$PROJECT_ROOT/.githooks/pre-commit"
        echo "✓ Fixed hook permissions"
    fi
else
    echo "❌ Git hooks not configured. Please run: git config core.hooksPath .githooks"
fi
echo

# ============================================================================
# 5. Summary
# ============================================================================
echo "✨ Worktree setup complete!"
echo
echo "Protected branches (blocked by pre-commit hook):"
echo "  • main"
echo "  • master"
echo "  • phase-3e-delivery-workspace"
echo
echo "Workflow:"
echo "  1. Create feature branch: git switch -c feature/your-branch"
echo "  2. Make changes and commit"
echo "  3. Push and open PR: git push -u origin feature/your-branch && gh pr create"
echo
echo "Emergency bypass (use sparingly):"
echo "  ALLOW_DIRECT_COMMIT=1 git commit -m 'your message'"
echo
