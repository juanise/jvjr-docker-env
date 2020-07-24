// const fs = require('fs');
//
// const Utils = require('../Utils');
// const utils = new Utils(process.mainModule.paths[0].split('node_modules')[0].slice(0, -1));
// //
// // const root = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
//
// if (fs.existsSync(utils.rootDir + '/.env')) {
//
//     utils.createDockerVars();
//     utils.editPackageJSON();
//     utils.createDockerFile();
//
// }else {
//     console.log('Error, no se ha encontrado el archivo de variables')
// }

const { processScript } = require('../src/main');

processScript({
    command: 'start',
    template: 'jvjr',
    targetDirectory: process.mainModule.paths[0].split('node_modules')[0].slice(0, -1)
});
