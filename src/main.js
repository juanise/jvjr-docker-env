import chalk from 'chalk';
import fs from 'fs';
import ncp from 'ncp';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { createEnvJsonMap, mapToObj, addScripts, removeScripts } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const access = promisify(fs.access);
const readFile = promisify(fs.readFile);
const writeFileSync = fs.writeFileSync;
const copy = promisify(ncp);

async function copyTemplateFiles(options) {
    return copy(options.templateDirectory, options.targetDirectory, {
        clobber: false,
    });
}

export async function processScript(options) {
    options = {
        ...options,
        targetDirectory: options.targetDirectory || process.cwd(),
    };

    const pathname = __dirname;
    const templateDir = path.resolve(
        pathname,
        '../templates',
        options.template.toLowerCase()
    );
    options.templateDirectory = templateDir;

    try {
        await access(templateDir, fs.constants.R_OK);
        switch (options.command) {
            case 'start':
                await start(options);
                break;
            case 'build':
                await createDockerVars(options);
                break;
            case 'uninstall':
                await uninstall(options);
                break;
            default:
                console.error('%s Nothing to do', chalk.red.bold('ERROR'));
                process.exit(0);
                break;
        }

    } catch (err) {
        console.error('%s Invalid template name', chalk.red.bold('ERROR'));
        process.exit(0);
    }



    console.log('%s Project ready', chalk.green.bold('DONE'));
    return true;
};

async function start(options) {
    await createDockerVars(options);
    console.log('Copy project files');
    await copyTemplateFiles(options);
    await modifyDockerFile(options);
    await editPackageJSON(options, 'append');
}

function modifyDockerFile (options) {
    // console.log('modify', options.targetDirectory);
    const dockerfile = options.targetDirectory + '/Dockerfile-jvjr';
    // console.log('dockerfile', dockerfile);
    if (fs.existsSync(dockerfile)) {
        var dockerlines = fs.readFileSync(dockerfile, 'utf8').split(/\r?\n/);

        const npmrc = fs.existsSync(options.targetDirectory + '/.npmrc');
        const yarnrc = fs.existsSync(options.targetDirectory + '/.yarnrc');

        if (!npmrc) {
            deleteLine(dockerlines,'COPY .npmrc .');
        }
        if (!yarnrc) {
            deleteLine(dockerlines, 'COPY .yarnrc .');
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
        writeFileSync(dockerfile, newContent, "utf-8");
    }
}

function deleteLine(lines, lineToDelete) {
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

async function uninstall(options) {
    await deleteProjectFiles(options);
    await editPackageJSON(options, 'delete');
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
    var packageJson = JSON.parse(fs.readFileSync(options.targetDirectory + '/package.json', 'utf8'));
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
}

function deleteProjectFiles(options) {
    deleteFileIfExistsOnRoot(options, 'jvjr-entrypoint.sh');
    deleteFileIfExistsOnRoot(options, 'Dockerfile-jvjr');
    deleteFileIfExistsOnRoot(options, 'jvjr-env.json');
}

async function createDockerVars(options) {
    try {
        const envPath = options.targetDirectory + '/.env';

        // Check if .env file exists, create empty if not
        if (!fs.existsSync(envPath)) {
            console.log(chalk.yellow('Could not find ' + envPath + ' file' ));
            fs.writeFileSync(envPath, '');
            console.log(chalk.yellow('An empty .env file has been generated'));
        }

        // Read .env and create jvjr-env.json
        const allText = await readFile(envPath, 'utf8');
        const map = createEnvJsonMap(allText);
        const object = mapToObj(map);
        writeFileSync(options.targetDirectory + '/jvjr-env.json', JSON.stringify(object, null, 2), 'utf8');
    }catch (e) {
        console.error('%s An error occured while writing JSON Object to File. %s', chalk.red.bold('ERROR'), chalk.red(e.toString()));
        process.exit(0);
    }
}

function deleteFileIfExistsOnRoot (options, file) {
    var pathFile = options.targetDirectory + '/' + file;
    if (fs.existsSync(pathFile)) {
        console.log('Removing ' + file);
        fs.unlinkSync(pathFile);
    }
}
