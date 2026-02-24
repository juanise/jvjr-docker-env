/**
 * E2E tests for CLI commands
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_ENV_DIR = path.resolve(PROJECT_ROOT, 'tests/tmp/test-env');

// Helper to clean test directory
function cleanTestDir() {
    if (fs.existsSync(TEST_ENV_DIR)) {
        fs.rmSync(TEST_ENV_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_ENV_DIR, { recursive: true });
}

// Helper to run CLI command
function runCli(args, cwd = PROJECT_ROOT) {
    try {
        const output = execSync(`node ${path.join(PROJECT_ROOT, 'bin/jvjr')} ${args}`, {
            cwd,
            encoding: 'utf-8',
            stdio: 'pipe'
        });
        return { success: true, output };
    } catch (error) {
        return {
            success: false,
            output: error.stdout || '',
            error: error.stderr || error.message
        };
    }
}

describe('CLI E2E Tests', () => {
    beforeEach(() => {
        cleanTestDir();
    });

    afterEach(() => {
        cleanTestDir();
    });

    describe('jvjr --build command', () => {
        test('should generate jvjr-env.json from .env file', () => {
            // Create test .env file
            const envContent = `VUE_APP_API_URL=http://localhost:3000/api
VUE_APP_TITLE=Test App
REACT_APP_VERSION=1.0.0`;
            fs.writeFileSync(path.join(PROJECT_ROOT, '.env'), envContent);

            const result = runCli('--build');

            expect(result.success).toBe(true);
            expect(result.output).toContain('DONE');

            // Verify jvjr-env.json was created
            const envJsonPath = path.join(PROJECT_ROOT, 'jvjr-env.json');
            expect(fs.existsSync(envJsonPath)).toBe(true);

            const envJson = JSON.parse(fs.readFileSync(envJsonPath, 'utf-8'));
            expect(envJson.API_URL).toBe('$VUE_APP_API_URL');
            expect(envJson.TITLE).toBe('$VUE_APP_TITLE');
            expect(envJson.VERSION).toBe('$REACT_APP_VERSION');

            // Cleanup
            fs.unlinkSync(envJsonPath);
        });

        test('should create empty .env if not exists', () => {
            const envPath = path.join(PROJECT_ROOT, '.env');
            if (fs.existsSync(envPath)) {
                fs.unlinkSync(envPath);
            }

            const result = runCli('--build');

            expect(result.success).toBe(true);
            expect(fs.existsSync(envPath)).toBe(true);
            expect(fs.readFileSync(envPath, 'utf-8')).toBe('');
        });
    });

    describe('jvjr --start command', () => {
        test('should copy template files to target directory', () => {
            // Create minimal package.json in test dir
            const testPackageJson = {
                name: 'test-project',
                version: '1.0.0',
                scripts: {}
            };
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, 'package.json'),
                JSON.stringify(testPackageJson, null, 2)
            );

            // Create .env file
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, '.env'),
                'VUE_APP_API_URL=http://test.com'
            );

            const result = runCli(`--start`, TEST_ENV_DIR);

            expect(result.success).toBe(true);
            expect(result.output).toContain('DONE');

            // Verify files were created
            expect(fs.existsSync(path.join(TEST_ENV_DIR, 'Dockerfile-jvjr'))).toBe(true);
            expect(fs.existsSync(path.join(TEST_ENV_DIR, 'jvjr-entrypoint.sh'))).toBe(true);
            expect(fs.existsSync(path.join(TEST_ENV_DIR, 'jvjr-env.json'))).toBe(true);

            // Verify package.json was updated
            const updatedPackageJson = JSON.parse(
                fs.readFileSync(path.join(TEST_ENV_DIR, 'package.json'), 'utf-8')
            );
            expect(updatedPackageJson.scripts.build).toContain('jvjr --build');
        });

        test('should generate jvjr-env.json with correct format', () => {
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, 'package.json'),
                JSON.stringify({ name: 'test' }, null, 2)
            );
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, '.env'),
                'VUE_APP_API=http://api.com\nVUE_APP_KEY=secret'
            );

            runCli(`--start`, TEST_ENV_DIR);

            const envJson = JSON.parse(
                fs.readFileSync(path.join(TEST_ENV_DIR, 'jvjr-env.json'), 'utf-8')
            );

            expect(envJson).toEqual({
                API: '$VUE_APP_API',
                KEY: '$VUE_APP_KEY'
            });
        });
    });

    describe('jvjr --uninstall command', () => {
        test('should remove generated files', () => {
            // Setup: Create test project with jvjr files
            const testPackageJson = {
                name: 'test-project',
                version: '1.0.0',
                scripts: {
                    build: 'jvjr --build && webpack',
                    'jvjr-build': 'jvjr --build'
                }
            };
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, 'package.json'),
                JSON.stringify(testPackageJson, null, 2)
            );

            // Create jvjr files
            fs.writeFileSync(path.join(TEST_ENV_DIR, 'Dockerfile-jvjr'), '# test');
            fs.writeFileSync(path.join(TEST_ENV_DIR, 'jvjr-entrypoint.sh'), '#!/bin/bash');
            fs.writeFileSync(path.join(TEST_ENV_DIR, 'jvjr-env.json'), '{}');

            // Run uninstall
            const result = runCli(`--uninstall`, TEST_ENV_DIR);

            expect(result.success).toBe(true);
            expect(result.output).toContain('DONE');

            // Verify files were removed
            expect(fs.existsSync(path.join(TEST_ENV_DIR, 'Dockerfile-jvjr'))).toBe(false);
            expect(fs.existsSync(path.join(TEST_ENV_DIR, 'jvjr-entrypoint.sh'))).toBe(false);
            expect(fs.existsSync(path.join(TEST_ENV_DIR, 'jvjr-env.json'))).toBe(false);

            // Verify package.json scripts were cleaned
            const updatedPackageJson = JSON.parse(
                fs.readFileSync(path.join(TEST_ENV_DIR, 'package.json'), 'utf-8')
            );
            expect(updatedPackageJson.scripts.build).toBe('webpack');
            expect(updatedPackageJson.scripts['jvjr-build']).toBeUndefined();
        });

        test('should handle missing files gracefully', () => {
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, 'package.json'),
                JSON.stringify({ name: 'test', scripts: {} }, null, 2)
            );

            const result = runCli(`--uninstall`, TEST_ENV_DIR);

            expect(result.success).toBe(true);
        });
    });

    describe('Dockerfile verification', () => {
        test('should generate Dockerfile with Node 24', () => {
            fs.writeFileSync(
                path.join(TEST_ENV_DIR, 'package.json'),
                JSON.stringify({ name: 'test' }, null, 2)
            );

            runCli(`--start`, TEST_ENV_DIR);

            const dockerfile = fs.readFileSync(
                path.join(TEST_ENV_DIR, 'Dockerfile-jvjr'),
                'utf-8'
            );

            expect(dockerfile).toContain('FROM node:24-alpine');
            expect(dockerfile).toContain('FROM nginx:1.27-alpine');
        });
    });

    describe('EnvProvider module', () => {
        test('should be importable as ESM module', async () => {
            // Mock process.exit before importing
            const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
            const envProviderPath = path.join(PROJECT_ROOT, 'EnvProvider.js');
            const envModule = await import(envProviderPath);

            expect(envModule.default).toBeDefined();
            expect(typeof envModule.default.value).toBe('function');
            expect(typeof envModule.default.envVars).toBe('object');

            mockExit.mockRestore();
        });
    });

    describe('CLI entry point', () => {
        test('bin/jvjr should be executable ESM', () => {
            const binPath = path.join(PROJECT_ROOT, 'bin', 'jvjr');
            const content = fs.readFileSync(binPath, 'utf-8');

            expect(content).toContain('#!/usr/bin/env node');
            expect(content).toContain("import { cli } from '../src/cli.js'");
            expect(content).not.toContain('require');
        });
    });
});
