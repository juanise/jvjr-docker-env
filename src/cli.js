import arg from 'arg';
import { processScript } from './main';

function parseArgumentsIntoOptions(rawArgs) {
	const args = arg(
		{
			'--install': Boolean,
			'--start': Boolean,
			'--build': Boolean,
			'--uninstall': Boolean,
			'-i': '--install',
			'-s': '--start',
			'-b': '--build',
			'-u': '--uninstall',
		},
		{
			argv: rawArgs.slice(2),
		}
	);
	return {
		command: args['--install'] ? 'install' : (args['--start'] ? 'start' : (args['--build'] ? 'build' : (args['--uninstall'] ? 'uninstall' : 'exit'))),
		template: 'jvjr'
	};
}

export async function cli(args) {
    let options = parseArgumentsIntoOptions(args);
    if (options.command !== undefined) {
        await processScript(options);
    }
}
