#!/bin/bash
# Fix ESM imports by adding .js extensions to relative imports

# Process all .js files in dist
find dist -name "*.js" -type f | while read file; do
    # Add .js to imports that don't already have .js extension
    # Single quotes
    sed -i -E "s|from '(\./[^']+)'|from '\1.js'|g; s|from '(\.\./[^']+)'|from '\1.js'|g" "$file"
    # Double quotes
    sed -i -E 's|from "(\./[^"]+)"|from "\1.js"|g; s|from "(\.\./[^"]+)"|from "\1.js"|g' "$file"
    # Remove double .js.js if we accidentally added it
    sed -i "s|\.js\.js|.js|g" "$file"
done

echo "Fixed ESM imports in dist/"
