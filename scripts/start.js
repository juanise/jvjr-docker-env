const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require('fs');
const pathLib = require('path');

const root = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
console.log(root);
const map = new Map();

if (fs.existsSync(root + '/.env')) {

    function readTextFile(file) {
        var rawFile = new XMLHttpRequest();
        rawFile.open("GET", file, false);
        rawFile.onreadystatechange = function () {
            if(rawFile.readyState === 4) {
                if(rawFile.status === 200 || rawFile.status == 0) {
                    var allText = rawFile.responseText;
                    var lines = allText.split(/\r?\n/);
                    lines.forEach( (line) => {
                        console.log(line);
                        const appVar = line.substring(0, line.indexOf('='));

                        const useVar = appVar.match(/^VUE_APP_(.*)/)[1];
                        console.log(useVar);
                        console.log(appVar);
                        map.set(useVar, '$' + appVar);
                    });
                }
            }
        };
        rawFile.send(null);
    }
    readTextFile('file://' + root + '/.env');

    const build = '; node node_modules/jvjr-docker-env/scripts/build.js';
    const packageJson = require(root + '/package.json');

    if (packageJson && packageJson.scripts && packageJson.scripts) {
        if (packageJson.scripts.build && !packageJson.scripts.build.includes(build)) {
            packageJson.scripts.build = packageJson.scripts.build + build;

            writeFile(
                root + '/package.json',
                JSON.stringify(packageJson, null, 2),
                'Error writing build script on package.json');
        }

        const object = mapToObj(map);
        writeFile('DOCKER_APP_ENV_VARS.json',
            JSON.stringify(object,null, 2),
            'An error occured while writing JSON Object to File.');

        const entrypoint = pathLib.resolve(__dirname, '../entrypoint.sh');
        copyFile(entrypoint, root + '/jvjr-docker-env.sh')

    } else {
        console.log("Error, package.json not found, or scripts not found on package.json")
    }

}else {
    console.log('Error, no se ha encontrado el archivo de variables')
}

function mapToObj(inputMap) {
    let obj = {};

    inputMap.forEach(function(value, key){
        obj[key] = value
    });

    return obj;
}

function writeFile(path, json, errorMsg) {
    try {
        fs.writeFileSync(path, json);
    }catch (e) {
        console.log(errorMsg, e);
    }
}

function copyFile(source, destination){
    fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE);
}
