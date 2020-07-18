console.log("uninstall");
const fs = require('fs');
const root = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
const packageJson = require(root + '/package.json');
if (packageJson && packageJson.scripts && packageJson.scripts.build){
    const build = '; node node_modules/jvjr-docker-env/scripts/build.js';
    packageJson.scripts.build = packageJson.scripts.build.replace(build, '');
    fs.writeFile(root + '/package.json',
        JSON.stringify(packageJson, null, 2),
        'utf8',
        (err) => {
            if (err) {
                console.log("Error");

            }
        });
}
fs.unlinkSync(root + '/jvjr-docker-env.sh');



