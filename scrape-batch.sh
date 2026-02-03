#!/bin/bash
# Extract og:image from a URL
url="$1"
curl -sL --max-time 10 "$url" 2>/dev/null | grep -oi 'og:image"[^>]*content="[^"]*"' | head -1 | sed 's/.*content="\([^"]*\)".*/\1/'
