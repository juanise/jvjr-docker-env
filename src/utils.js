/**
 * Utility functions for jvjr-docker-env
 * Exported for testing purposes
 */

/**
 * Parse .env file content and create a Map of environment variables
 * @param {string} allText - Content of .env file
 * @returns {Map} Map with variable names and their values
 */
export function createEnvJsonMap(allText) {
    const map = new Map();
    var lines = allText.split(/\r?\n/);
    lines.forEach((line) => {
        if (!line.startsWith('#') && line.includes('=')) {
            const appVar = line.substring(0, line.indexOf('='));
            var regex = line.startsWith('VUE_APP_') ? /^VUE_APP_(.*)/ :
                (line.startsWith('REACT_APP_') ? /^REACT_APP_(.*)/ : /.*/);

            const expRes = appVar.match(regex);
            const useVar = expRes[1] || expRes[0];
            map.set(useVar, '$' + appVar);
        }
    });
    return map;
}

/**
 * Convert a Map to a plain Object
 * @param {Map} inputMap - Map to convert
 * @returns {Object} Plain object with same key-value pairs
 */
export function mapToObj(inputMap) {
    let obj = {};
    inputMap.forEach(function(value, key){
        obj[key] = value
    });
    return obj;
}

/**
 * Add jvjr scripts to package.json scripts object
 * @param {Object} scripts - Existing scripts from package.json
 * @param {string} jvjrBuild - The jvjr build command string
 * @returns {Object} Updated scripts object
 */
export function addScripts(scripts, jvjrBuild){
    if (scripts.hasOwnProperty('build') && scripts.build.trim().length > 0) {
        if (!scripts.build.includes(jvjrBuild)) {
            const build = scripts.build;
            scripts.build = jvjrBuild + ' && ' + build;
        }
    } else {
        scripts.build = jvjrBuild;
    }
    scripts['jvjr-build'] = jvjrBuild;
    return scripts;
}

/**
 * Remove jvjr scripts from package.json scripts object
 * @param {Object} scripts - Existing scripts from package.json
 * @param {string} jvjrBuild - The jvjr build command string to remove
 * @returns {Object} Updated scripts object
 */
export function removeScripts(scripts, jvjrBuild) {
    console.log('Removing scripts from package.json');
    if (scripts.hasOwnProperty('build')) {
        var build = scripts.build;
        var regex = new RegExp(`(${jvjrBuild})(\\s+&&\\s+)?`, 'g');
        build = build.replace(regex, '');
        scripts.build = build;
        if (build.length <= 0) {
            delete scripts.build;
        }
    }
    delete scripts['jvjr-build'];
    return scripts;
}
