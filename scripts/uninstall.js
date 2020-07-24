console.log("Uninstall");
// console.log(require.main);
// const Utils = require('../Utils');
// const utils = new Utils(process.mainModule.paths[0].split('node_modules')[0].slice(0, -1));
// const packageJson = require(utils.rootDir + '/package.json');
// console.log(require);
// if (packageJson && packageJson.scripts && packageJson.scripts.build){
//     console.log('Removing script from package.json');
//     const build = ' && node node_modules/jvjr-docker-env/scripts/build.js';
//     if (packageJson.scripts.build.includes(build)) {
//         packageJson.scripts.build = packageJson.scripts.build.replace(build, '');
//         utils.writeFile(utils.rootDir + '/package.json',
//             JSON.stringify(packageJson, null, 2),
//             'Error, removing script from package.json');
//     }
// }
// utils.deleteFileIfExistsOnRoot('jvjr-entrypoint.sh');
// utils.deleteFileIfExistsOnRoot('Dockerfile-jvjr');
// utils.deleteFileIfExistsOnRoot('jvjr-env.json');

const { processScript } = require('../src/main');

processScript({
    command: 'uninstall',
    template: 'jvjr',
    targetDirectory: process.mainModule.paths[0].split('node_modules')[0].slice(0, -1)
});

