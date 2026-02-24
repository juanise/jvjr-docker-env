import { processScript } from '../src/main.js';

processScript({
    command: 'start',
    template: 'jvjr',
    targetDirectory: process.env.INIT_CWD || process.cwd()
});
