console.log("Uninstall");

const { processScript } = require('../src/main');

processScript({
    command: 'uninstall',
    template: 'jvjr',
    targetDirectory: process.mainModule.paths[0].split('node_modules')[0].slice(0, -1)
});

