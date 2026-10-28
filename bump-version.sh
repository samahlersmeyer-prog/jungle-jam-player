#!/bin/sh
# Run before pushing a change so installed copies of the app update themselves.
v=$(date +%Y%m%d%H%M%S)
sed -i.bak "s/<meta name=\"app-version\" content=\"[^\"]*\">/<meta name=\"app-version\" content=\"$v\">/" index.html && rm -f index.html.bak
printf '{ "v": "%s" }\n' "$v" > version.json
echo "version $v"
