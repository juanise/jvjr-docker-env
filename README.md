# jvjr-docker-env

Change env variables when run your docker image of your Vue/React app

## Installing

```
npm install jvjr-docker-env
```

This will install jvjr-docker-env as dependency, and will add a Dockerfile-jvjr functional example, a script jvjr-entrypoint.sh and jvjr-env.json file with env variables from .env file into your project base directory.

 - Dockerfile-jvjr is a functional Dockerfile example to a basic Vue project, you ca use it as is.
 - The script jvjr-docker-env.sh as you can see into Dockerfile-jvjr will be the entrypoint. 
 - The jvjr-env.json file with env variables will be used by jvjr-docker-env library.
 
If you change env file and need to regenerate jvjr-env.json:
```
npm run script jvjr-build
```
This action will be added to build script on your package.json. 

## Usage
If we have this .env file:
```
VUE_APP_WEB_SERVICE=http://192.168.12.28
VUE_APP_OTHER=http://localhost
```
jvjr-docker-env will generate a jvjr-env.json file like this:
```
{
    "WEB_SERVICE"="$VUE_APP_WEB_SERVICE",
    "OTHER"="$OTHER"
}
```

So you can use it on your code: 

```
import EnvProvider from 'jvjr-docker-env';

export default class MyClass {
    private webService: any;
    constructor() {
        this.webService = EnvProvider.value('WEB_SERVICE');
    }
} 
```

Before you build your docker image, probably you need to modify Dockerfile-jvjr file.
You need to tell jvjr-entrypoint.sh where is dist directory and the prefix of *js files.

For example:
```
COPY --from=build-stage /app/<my dist dir> /usr/share/nginx/html

COPY --from=build-stage /app/jvjr-entrypoint.sh /
COPY --from=build-stage /app/jvjr-env.json /
RUN chmod +x /jvjr-entrypoint.sh

EXPOSE 80

ENTRYPOINT [ "/jvjr-entrypoint.sh", "/usr/share/nginx/html/<path to js files>", "<prefix of your js files>" ]
```
 - \<my dist dir>, usually 'dist' or 'build'
 - \<path to js files>, usually 'js' or 'static/js'
 - \<prefix of your js files>, usually 'app' or 'main'

After you build your docker image, if you set env var for example in your docker run command line
```
docker run -d --name example -e VUE_APP_WEB_SERVICE=locahost example:latest
```
then webService value will be localhost.

But if you din't set VUE_APP_WEB_SERVICE, wevService value will be http://192.168.12.28, which is the one we have into .env file.
 




