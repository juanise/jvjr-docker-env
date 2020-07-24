import arg from 'arg';
import { processScript } from './main';

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--start': Boolean,
			'--build': Boolean,
			'--uninstall': Boolean,
			'-s': '--start',
			'-b': '--build',
			'-u': '--uninstall',
		},
		{
			argv: rawArgs.slice(2),
		}
	);
	return {
		command: args['--start'] ? 'start' : (args['--build'] ? 'build' : (args['--uninstall'] ? 'uninstall' : 'exit')),
		template: 'jvjr'
	};
}

export async function cli(args) {
    let options = parseArgumentsIntoOptions(args);
    if (options.command !== undefined) {
        console.log(options);
        await processScript(options);
    }
}
