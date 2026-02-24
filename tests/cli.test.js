/**
 * Unit tests for cli.js
 *
 * Covers:
 *   - parseArgumentsIntoOptions: all flags and aliases map to the correct command.
 *   - Priority order: --install > --start > --build > --uninstall when combined.
 *   - Fallback to 'exit' when no flag is provided.
 *   - Unknown flags throw ARG_UNKNOWN_OPTION (arg library default).
 *   - cli() delegates resolved options to processScript.
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/main.js', () => ({
    processScript: jest.fn().mockResolvedValue(undefined)
}));

const { cli } = await import('../src/cli.js');
const { processScript } = await import('../src/main.js');

beforeEach(() => {
    processScript.mockClear();
});

// ---------------------------------------------------------------------------
// Long flags — each exercises a distinct branch of the ternary chain
// ---------------------------------------------------------------------------

describe('cli — long flags', () => {
    test('--install resolves to command "install"', async () => {
        await cli(['node', 'jvjr', '--install']);
        expect(processScript).toHaveBeenCalledWith({ command: 'install', template: 'jvjr' });
    });

    test('--start resolves to command "start"', async () => {
        await cli(['node', 'jvjr', '--start']);
        expect(processScript).toHaveBeenCalledWith({ command: 'start', template: 'jvjr' });
    });

    test('--build resolves to command "build"', async () => {
        await cli(['node', 'jvjr', '--build']);
        expect(processScript).toHaveBeenCalledWith({ command: 'build', template: 'jvjr' });
    });

    test('--uninstall resolves to command "uninstall"', async () => {
        await cli(['node', 'jvjr', '--uninstall']);
        expect(processScript).toHaveBeenCalledWith({ command: 'uninstall', template: 'jvjr' });
    });
});

// ---------------------------------------------------------------------------
// Short aliases — verifies arg library alias resolution for each mapping
// ---------------------------------------------------------------------------

describe('cli — short aliases', () => {
    test('-i resolves to command "install"', async () => {
        await cli(['node', 'jvjr', '-i']);
        expect(processScript).toHaveBeenCalledWith({ command: 'install', template: 'jvjr' });
    });

    test('-s resolves to command "start"', async () => {
        await cli(['node', 'jvjr', '-s']);
        expect(processScript).toHaveBeenCalledWith({ command: 'start', template: 'jvjr' });
    });

    test('-b resolves to command "build"', async () => {
        await cli(['node', 'jvjr', '-b']);
        expect(processScript).toHaveBeenCalledWith({ command: 'build', template: 'jvjr' });
    });

    test('-u resolves to command "uninstall"', async () => {
        await cli(['node', 'jvjr', '-u']);
        expect(processScript).toHaveBeenCalledWith({ command: 'uninstall', template: 'jvjr' });
    });
});

// ---------------------------------------------------------------------------
// Priority — ternary has a fixed order; combining flags must respect it
// ---------------------------------------------------------------------------

describe('cli — flag priority', () => {
    test('--install wins over --start when both are provided', async () => {
        await cli(['node', 'jvjr', '--install', '--start']);
        expect(processScript).toHaveBeenCalledWith({ command: 'install', template: 'jvjr' });
    });

    test('--start wins over --build when both are provided', async () => {
        await cli(['node', 'jvjr', '--start', '--build']);
        expect(processScript).toHaveBeenCalledWith({ command: 'start', template: 'jvjr' });
    });

    test('--build wins over --uninstall when both are provided', async () => {
        await cli(['node', 'jvjr', '--build', '--uninstall']);
        expect(processScript).toHaveBeenCalledWith({ command: 'build', template: 'jvjr' });
    });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('cli — edge cases', () => {
    test('no args resolves to command "exit"', async () => {
        await cli(['node', 'jvjr']);
        expect(processScript).toHaveBeenCalledWith({ command: 'exit', template: 'jvjr' });
    });

    test('unknown flag throws ARG_UNKNOWN_OPTION', async () => {
        await expect(cli(['node', 'jvjr', '--unknown'])).rejects.toThrow();
    });
});
