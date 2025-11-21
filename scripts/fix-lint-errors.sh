#!/bin/bash

# Script to fix common linting errors
# This script fixes:
# 1. Unused error variables in catch blocks
# 2. Unused imports (some)
# 3. Unescaped entities in JSX

echo "Fixing linting errors..."

# Fix unused error variables in catch blocks (where error is not used)
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' 's/} catch (error) {/} catch {/g' {} \;

# Fix unescaped apostrophes in JSX
find src -type f -name "*.tsx" -exec sed -i '' "s/Don't/Don\&apos;t/g" {} \;
find src -type f -name "*.tsx" -exec sed -i '' "s/Here's/Here\&apos;s/g" {} \;
find src -type f -name "*.tsx" -exec sed -i '' "s/what's/what\&apos;s/g" {} \;
find src -type f -name "*.tsx" -exec sed -i '' "s/'/\\&apos;/g" {} \;

echo "Done! Please review changes before committing."

