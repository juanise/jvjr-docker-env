#!/bin/sh
#fichero donde tenemos las variables que queremos sustituir en tiempo de ejecucion
#vars=`pwd`'DOCKER_APP_ENV_VARS'
vars=$(eval cat DOCKER_APP_ENV_VARS.json | sed "s/{//g; s/}//g; s/'//g; s/,//g; s/\"//g; s/\\$//g" | sed -rn '/\S/p' | cut -d':' -f2 | sed -e 's/^[[:space:]]*//; s/[[:space:]]*$//');
echo $vars
# recorremos los ficheros donde vamos a realizar las sustituciones
for file in /usr/share/nginx/html/js/app.*.js;
do
  if [ ! -f $file.tmpl.js ]; then
    cp $file $file.tmpl.js
  fi
  # Sustituimos todas las variables que tenemos en DOCKER_APP_ENV_VARS
    printf %s "$vars" | while IFS= read -r line || [ -n "$line" ]; do
      eval content=\$$line
      if [ ! "$content" = '' ];
      then
        envsubst '$'"$line" < $file.tmpl.js > $file;
        cp $file $file.tmpl.js;
      fi
    done

done

echo "Starting Nginx"
nginx -g 'daemon off;'
