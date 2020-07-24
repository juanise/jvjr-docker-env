const fs = require('fs');
const Utils = require('../Utils');
const utils = new Utils(process.mainModule.paths[0].split('node_modules')[0].slice(0, -1));



if (fs.existsSync(utils.rootDir + '/.env')) {

    utils.createDockerVars();
    copyBuildFiles();

}else {
    console.warn('.env file not found, jvjr-docker-env will do nothing')
}

function copyBuildFiles() {
    utils.copyFileToRoot('./', 'jvjr-entrypoint.sh');
    // utils.copyFileToRoot(utils.root, '/jvjr-env.json');
}


