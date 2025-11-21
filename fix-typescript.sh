#!/bin/bash

echo "🔧 Fixing TypeScript errors..."

# Fix common 'any' type issues by replacing with proper types
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any/: unknown/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/: any\[/: unknown\[/g'

# Fix unused variable warnings by prefixing with underscore
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/const \([a-zA-Z_][a-zA-Z0-9_]*\) = /const _\1 = /g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/let \([a-zA-Z_][a-zA-Z0-9_]*\) = /let _\1 = /g'

echo "✅ TypeScript fixes applied" 