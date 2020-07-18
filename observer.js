const chokidar = require('chokidar');
const EventEmitter = require('events').EventEmitter;
const readLastLines = require('read-last-lines');

class Observer extends EventEmitter {
    constructor() {
        super();
    }

    watchFile(targetFile) {
        try {
            console.log(
                `[${new Date().toLocaleString()}] Watching for file changes on: ${targetFile}`
            );

            var watcher = chokidar.watch(targetFile, { persistent: true });

            watcher.on('change', async filePath => {
                console.log(
                    `[${new Date().toLocaleString()}] ${filePath} has been updated.`
                );

                // Get update content of file, in this case is one line
                var updateContent = await readLastLines.read(filePath, 1);

                // emit an event when the file has been updated
                this.emit('file-updated', { message: updateContent });
            });
        } catch (error) {
            console.log(error);
        }
    }
}

module.exports = Observer;
// const observer = require('../observer');
// observer.watchFile(root + '/.env');
