const chalk = require('chalk');
const fs  = require('fs');
const ncp = require('ncp');
const path = require('path');
const { promisify }  = require('util');

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFileSync = fs.writeFileSync;
const copy = promisify(ncp);

async function copyTemplateFiles(options) {
    console.log(options.templateDirectory);
    console.log(options.targetDirectory);
    return copy(options.templateDirectory, options.targetDirectory, {
        clobber: false,
    });
}

module.exports.processScript = async function processScript(options) {
    options = {
        ...options,
        targetDirectory: options.targetDirectory || process.cwd(),
    };
    console.log('tagetDirectory', options.targetDirectory);
    // const currentFileUrl = import.meta.url;
    const currentFileUrl = path.resolve(__dirname, './main.js');
    console.log('currentFile', currentFileUrl);
    console.log('dirname',path.resolve(__dirname, './main.js'));
    const templateDir = path.resolve(
        new URL('file://' + currentFileUrl).pathname,
        '../../templates',
        options.template.toLowerCase()
    );
    options.templateDirectory = templateDir;

    try {
        await access(templateDir, fs.constants.R_OK);
        switch (options.command) {
            case 'start':
                await createDockerVars(options);
                console.log('Copy project files');
                await copyTemplateFiles(options);
                await editPackageJSON(options, 'append');
                break;
            case 'build':
                await createDockerVars(options);
                break;
            case 'uninstall':
                await deleteProjectFiles(options);
                await editPackageJSON(options, 'delete');
                break;
            default:
                console.error('%s Nothing to do', chalk.red.bold('ERROR'));
                process.exit(1);
                break;
        }

    } catch (err) {
        console.error('%s Invalid template name', chalk.red.bold('ERROR'));
        process.exit(1);
    }



    console.log('%s Project ready', chalk.green.bold('DONE'));
    return true;
};

function start() {

}

Object.prototype.hasOwnNestedProperty = function(propertyPath){
    if(!propertyPath) {
        return false;
    }

    var properties = propertyPath.split('.');
    var obj = this;

    for (var i = 0; i < properties.length; i++) {
        var prop = properties[i];

        if(!obj || !obj.hasOwnProperty(prop)){
            return false;
        } else {
            obj = obj[prop];
        }
    }

    return true;
};

function editPackageJSON(options, addOrDelete) {
    const jvjrBuild = 'jvjr --build';
    var packageJson = require(options.targetDirectory + '/package.json');
    var { scripts } = packageJson;
    if (scripts) {
        if (addOrDelete === 'append') {
            scripts = addScripts(scripts, jvjrBuild);
        }else if (addOrDelete === 'delete') {
            scripts = removeScripts(scripts, jvjrBuild);
        }
        packageJson = {
            ... packageJson,
            scripts
        };
        writeFileSync(options.targetDirectory + '/package.json', JSON.stringify(packageJson, null, 2), 'utf8');
    }
    // if (packageJson && packageJson.scripts && packageJson.scripts) {
    //     if (packageJson.scripts.build && !packageJson.scripts.build.includes(build)) {
    //         packageJson.scripts.build = packageJson.scripts.build + build;
    //
    //         this.writeFile(
    //             this.rootDir + '/package.json',
    //             JSON.stringify(packageJson, null, 2),
    //             'Error writing build script on package.json');
    //     }
    //
    // } else {
    //     console.warn("Error, package.json not found, or scripts not found on package.json")
    // }
}

function deleteProjectFiles(options) {
    deleteFileIfExistsOnRoot(options, 'jvjr-entrypoint.sh');
    deleteFileIfExistsOnRoot(options, 'Dockerfile-jvjr');
    deleteFileIfExistsOnRoot(options, 'jvjr-env.json');
}

function removeScripts(scripts, jvjrBuild) {
    console.log('Removing scripts from package.json');
    if (scripts.hasOwnProperty('build')) {
        var build = scripts.build;
        var regex = new RegExp(`(\\s+&&\\s+)?(${jvjrBuild})`, 'g');
        console.log(regex);
        console.log(build.match(regex));
        build = build.replace(regex, '');
        scripts.build = build;
        if (build.length <= 0) {
            delete scripts.build;
        }
    }
    delete scripts['jvjr-build'];
    return scripts;


}

function addScripts(scripts, jvjrBuild){
    if (scripts.hasOwnProperty('build') && scripts.build.trim().length > 0) {
        if (!scripts.build.includes(jvjrBuild)) {
            const build = scripts.build;
            scripts.build = build + ' && ' + jvjrBuild;
        }
    } else {
        scripts.build = jvjrBuild;
        console.log('no hay build');
    }
    scripts['jvjr-build'] = jvjrBuild;
    return scripts;
}

async function createDockerVars(options) {
    try {
        console.log(options.targetDirectory);
        const allText = await readFile(options.targetDirectory + '/.env', 'utf8');
        console.log('se lee el fichero .env');
        const map = createEnvJsonMap(allText);
        console.log('Mapa creado de .env', map);
        const object = mapToObj(map);
        console.log('Se transforma a objecto');
        writeFileSync(options.targetDirectory + '/jvjr-env.json', JSON.stringify(object, null, 2), 'utf8');
    }catch (e) {
        console.error('%s An error occured while writing JSON Object to File. Is there any .env file?', chalk.red.bold('ERROR'));
        process.exit(1);
    }
}

function createEnvJsonMap(allText) {
    const map = new Map();
    var lines = allText.split(/\r?\n/);
    console.log(allText);
    lines.forEach((line) => {
        if (!line.startsWith('#') && line.includes('=')) {
            console.log(line);
            const appVar = line.substring(0, line.indexOf('='));
            var regex = line.startsWith('VUE_APP_') ? /^VUE_APP_(.*)/ :
                (line.startsWith('REACT_APP_') ? /^REACT_APP_(.*)/ : /.*/);

            const expRes = appVar.match(regex);
            const useVar = expRes[1] || expRes[0];
            console.log(useVar);
            console.log(appVar);
            map.set(useVar, '$' + appVar);
        }
    });
    console.log('El mapa en createeNV', map);
    return map;
}

function mapToObj(inputMap) {
    let obj = {};

    inputMap.forEach(function(value, key){
        obj[key] = value
    });

    return obj;
}
function deleteFileIfExistsOnRoot (options, file) {
    var pathFile = options.targetDirectory + '/' + file;
    if (fs.existsSync(pathFile)) {
        console.log('Removing ' + file);
        fs.unlinkSync(pathFile);
    }
}
