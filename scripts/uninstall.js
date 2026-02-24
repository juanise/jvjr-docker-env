import { processScript } from '../src/main.js';

processScript({
    command: 'uninstall',
    template: 'jvjr',
    targetDirectory: process.cwd()
});
