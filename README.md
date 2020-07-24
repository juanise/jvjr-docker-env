# jvjr-docker-env

Change env variables when run your docker image of your Vue app

## Installing

```
npm install jvjr-docker-env
```

This will install jvjr-docker-env as dependency, and will add a Dockerfile-jvjr example, a script jvjr-docker-env.sh and a json file with env variables from .env file into your project base directory.
Dockerfile-jvjr is a functional Dockerfile example to a basic Vue project, you ca use it as is.
The script jvjr-docker-env.sh as you can see into Dockerfile-jvjr will be the entrypoint. 
The json file with env variables will be used by jvjr-docker-env library.

## Usage
If we have this .env file:
```
VUE_APP_WEB_SERVICE=http://192.168.12.28
```
jvjr-docker-env will generate a json file like this:
```
{
    "WEB_SERVICE"="$VUE_APP_WEB_SERVICE"
}
```

So you can use it on your code: 

```
import ConfigProvider from 'jvjr-docker-env';

export default class MyClass {
    private webService: any;
    constructor() {
        this.webService = ConfigProvider.value('WEB_SERVICE');
    }
} 
```
And after build your docker image, if you set env var for example on your docker run
```
docker run -d --name example -e VUE_APP_WEB_SERVICE=locahost example:latest
```
webService value will be localhost.
But if you din't set VUE_APP_WEB_SERVICE, wevService value will be http://192.168.12.28



