#!/bin/sh

dist_js_dir="$1"; shift
js_file_prefix="$1"; shift
SCRIPTPATH="$( cd "$(dirname "$0")" >/dev/null 2>&1 ; pwd -P )"

vars=$(eval cat $SCRIPTPATH/jvjr-env.json | sed "s/{//g; s/}//g; s/'//g; s/,//g; s/\"//g; s/\\$//g" | sed -rn '/\S/p' | cut -d':' -f2 | sed -e 's/^[[:space:]]*//; s/[[:space:]]*$//');
echo "VARIABLES: \n$vars";
for file in $dist_js_dir/$js_file_prefix.*.js;
do
  if [ ! -f $file.tmpl.js ]; then
    cp $file $file.tmpl.js
  fi
  printf %s "$vars" | while IFS= read -r line || [ -n "$line" ]; do
    eval content=\$$line;
    echo "CONTENT: $line : $content";
    if [ ! "$content" = '' ];
    then
      envsubst '$'"$line" < $file.tmpl.js > $file;
      cp $file $file.tmpl.js;
    fi
  done

done

echo "Starting"
exec "$@"
