const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const fs = require('fs');

const root = process.mainModule.paths[0].split('node_modules')[0].slice(0, -1);
console.log(root);
const map = new Map();

if (fs.existsSync(root + '/.env')) {

    function readTextFile(file)
    {
        var rawFile = new XMLHttpRequest();
        rawFile.open("GET", file, false);
        rawFile.onreadystatechange = function ()
        {
            if(rawFile.readyState === 4)
            {
                if(rawFile.status === 200 || rawFile.status == 0)
                {
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
    // console.log('The file exists.');
    // const config = require(root + '/.env');

    const object = mapToObj(map);
    fs.writeFile("DOCKER_APP_ENV_VARS.json", JSON.stringify(object), 'utf8', function (err) {
        if (err) {
            console.log("An error occured while writing JSON Object to File.");
            return console.log(err);
        }
        fs.copyFileSync('../entrypoint.sh', root + '/entrypoint2.sh', fs.constants.COPYFILE_EXCL);
        console.log("JSON file has been saved.");
    });

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
