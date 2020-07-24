#! /usr/bin/env node

const fs = require('fs');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const pathLib = require('path');

class Utils {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }

    createDockerFile() {
        const dockerfile = pathLib.resolve(__dirname, './Dockerfile-jvjr');
        if (fs.existsSync(dockerfile)) {
            var dockerlines = fs.readFileSync(dockerfile, 'utf8').split(/\r?\n/);
            const npmrc = fs.existsSync(this.rootDir + '/.npmrc');
            const yarnrc = fs.existsSync(this.rootDir + '/.yarnrc');

            if (!npmrc) {
                this.deleteLine(dockerlines,'COPY .npmrc .');
            }
            if (!yarnrc) {
                this.deleteLine(dockerlines, 'COPY .yarnrc .');
            }

            var linesToDelete = [];
            dockerlines.forEach((line, index, array) => {
                if (line === '') {
                    if (index < array.length - 1) {
                        if (array[index + 1] === ''){
                            linesToDelete.push(index);
                        }
                    } else if (index === array.length - 1 && array[index] === '') {
                        linesToDelete.push(index);
                    }
                }
            });
            linesToDelete = linesToDelete.sort((a, b) => b -a);
            linesToDelete.forEach((index) => dockerlines.splice(index, 1));
            const newContent = dockerlines.map((line) => {
                return line;
            }).join('\r\n');
            this.writeFile(this.rootDir + '/Dockerfile-jvjr', newContent, "Error writing Dockerfile-jvjr");
        }
    }

    deleteLine(lines, lineToDelete) {
        var deleteline = -1;
        lines.forEach((line, index) => {
            if (line === lineToDelete) {
                deleteline = index;
                return;
            }
        });
        if (deleteline !== -1) {
            lines[deleteline] = '';
        }
    }

    editPackageJSON() {
        const build = ' && node node_modules/jvjr-docker-env/scripts/build.js';
        const packageJson = require(this.rootDir + '/package.json');

        if (packageJson && packageJson.scripts && packageJson.scripts) {
            if (packageJson.scripts.build && !packageJson.scripts.build.includes(build)) {
                packageJson.scripts.build = packageJson.scripts.build + build;

                this.writeFile(
                    this.rootDir + '/package.json',
                    JSON.stringify(packageJson, null, 2),
                    'Error writing build script on package.json');
            }

        } else {
            console.warn("Error, package.json not found, or scripts not found on package.json")
        }
    }

    createDockerVars() {
        const map = new Map();

        this.readTextFile('file://' + this.rootDir + '/.env', (allText) => {
            var lines = allText.split(/\r?\n/);
            console.log(allText);
            lines.forEach( (line) => {
                if (!line.startsWith('#') && line.includes('=')) {
                    console.log(line);
                    const appVar = line.substring(0, line.indexOf('='));
                    var regex = line.startsWith('VUE_APP_') ? /^VUE_APP_(.*)/ :
                        (line.startsWith('REACT_APP_') ? /^REACT_APP_(.*)/ : /.*/);
                    const useVar = appVar.match(regex)[1];
                    console.log(useVar);
                    console.log(appVar);
                    map.set(useVar, '$' + appVar);
                }
            });
        });
        const object = this.mapToObj(map);
        this.writeFile(this.rootDir + '/jvjr-env.json',
            JSON.stringify(object,null, 2),
            'An error occured while writing JSON Object to File.');
    }

    mapToObj(inputMap) {
        let obj = {};

        inputMap.forEach(function(value, key){
            obj[key] = value
        });

        return obj;
    }

    readTextFile(file, callBack) {
        var rawFile = new XMLHttpRequest();
        rawFile.open("GET", file, false);
        rawFile.onreadystatechange = function () {
            if(rawFile.readyState === 4) {
                if(rawFile.status === 200 || rawFile.status == 0) {
                    const allText = rawFile.responseText;
                    callBack(allText);
                }
            }
        };
        rawFile.send(null);
    }

    writeFile(path, json, errorMsg) {
        try {
            fs.writeFileSync(path, json);
        }catch (e) {
            console.warn(errorMsg, e);
        }
    }

    copyFile(source, destination){
        try {
            fs.copyFileSync(source, destination, fs.constants.COPYFILE_FICLONE);
        }catch (e) {
            console.warn('Error on copy file ' + source + ' to ' + destination, e);
        }
    }

    copyFileToRoot(path, file) {
        const pathFile = path + file;
        const dest = pathLib.resolve(__dirname, pathFile);
         console.log('source', dest);
         console.log('destino', this.rootDir + '/' + file);
        this.copyFile(dest, this.rootDir + '/' + file);
    }

    deleteFileIfExistsOnRoot (file) {
        var pathFile = this.rootDir + '/' + file;
        if (fs.existsSync(pathFile)) {
            console.log('Removing ' + file);
            fs.unlinkSync(pathFile);
        }
    }
}

module.exports = Utils;
