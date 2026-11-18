#!/bin/sh
# Bundles src/ into one self-contained page: public/index.html
set -e
mkdir -p public
out=public/index.html
{
echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Development Appraisals</title><style>'
cat src/style.css
echo '</style></head><body><div id="app"></div><script>'
sed '/^if (typeof module/d' src/engine.js
sed '/^if (typeof module/d' src/samples.js
cat src/app.js
echo '</script></body></html>'
} > "$out"
echo "built $out ($(wc -c < "$out") bytes)"
