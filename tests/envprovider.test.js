/**
 * Unit tests for EnvProvider module
 *
 * Tests the EnvProvider class which provides runtime access to environment variables
 * defined in jvjr-env.json and process.env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DIR = path.resolve(PROJECT_ROOT, 'tests/tmp/test-envprovider');

// Helper to clean test directory
function cleanTestDir() {
    if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Save and restore original process.cwd
let originalCwd;
let originalEnvVars = {};

beforeEach(() => {
    // Save original cwd
    originalCwd = process.cwd();

    // Save and clear relevant env vars
    ['VUE_APP_TEST', 'VUE_APP_API', 'REACT_APP_TEST', 'REACT_APP_API'].forEach(key => {
        originalEnvVars[key] = process.env[key];
        delete process.env[key];
    });

    // Clean test directory and set as cwd
    cleanTestDir();
    process.chdir(TEST_DIR);

    // Clear Jest module cache to get fresh EnvProvider instance
    jest.resetModules();
});

afterEach(() => {
    // Restore original cwd
    process.chdir(originalCwd);

    // Restore original env vars
    Object.keys(originalEnvVars).forEach(key => {
        if (originalEnvVars[key] !== undefined) {
            process.env[key] = originalEnvVars[key];
        } else {
            delete process.env[key];
        }
    });

    // Clean test directory
    if (fs.existsSync(TEST_DIR)) {
        fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
});

describe('EnvProvider.value()', () => {
    test('should return VUE_APP_* values from process.env', async () => {
        // Create jvjr-env.json
        const envJson = {
            API_URL: '$VUE_APP_API_URL',
            TITLE: '$VUE_APP_TITLE'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        // Set process.env values
        process.env.VUE_APP_API_URL = 'http://test-api.com';
        process.env.VUE_APP_TITLE = 'Test App';

        // Import EnvProvider fresh
        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('API_URL')).toBe('http://test-api.com');
        expect(EnvProvider.value('TITLE')).toBe('Test App');
    });

    test('should return REACT_APP_* values from process.env', async () => {
        const envJson = {
            API_URL: '$REACT_APP_API_URL',
            VERSION: '$REACT_APP_VERSION'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        process.env.REACT_APP_API_URL = 'http://react-api.com';
        process.env.REACT_APP_VERSION = '2.0.0';

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('API_URL')).toBe('http://react-api.com');
        expect(EnvProvider.value('VERSION')).toBe('2.0.0');
    });

    test('should return literal value if not prefixed with $VUE_APP_ or $REACT_APP_', async () => {
        const envJson = {
            NODE_ENV: 'production',
            PORT: '3000',
            API_KEY: 'hardcoded-key-123'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('NODE_ENV')).toBe('production');
        expect(EnvProvider.value('PORT')).toBe('3000');
        expect(EnvProvider.value('API_KEY')).toBe('hardcoded-key-123');
    });

    test('should return undefined for missing keys', async () => {
        const envJson = { API_URL: '$VUE_APP_API_URL' };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('NONEXISTENT_KEY')).toBeUndefined();
    });

    test('should return undefined if value is falsy', async () => {
        const envJson = {
            EMPTY_KEY: '',
            NULL_KEY: null
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('EMPTY_KEY')).toBeUndefined();
        expect(EnvProvider.value('NULL_KEY')).toBeUndefined();
    });

    test('should return undefined if env var is not set in process.env', async () => {
        const envJson = {
            API_URL: '$VUE_APP_API_URL',
            API_KEY: '$REACT_APP_API_KEY'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        // Don't set process.env values
        delete process.env.VUE_APP_API_URL;
        delete process.env.REACT_APP_API_KEY;

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('API_URL')).toBeUndefined();
        expect(EnvProvider.value('API_KEY')).toBeUndefined();
    });

    test('should handle mixed literal and env var values', async () => {
        const envJson = {
            LITERAL_VALUE: 'static-value',
            VUE_VALUE: '$VUE_APP_DYNAMIC',
            REACT_VALUE: '$REACT_APP_REACT',
            NODE_ENV: 'production'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        process.env.VUE_APP_DYNAMIC = 'dynamic-vue';
        process.env.REACT_APP_REACT = 'dynamic-react';

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.value('LITERAL_VALUE')).toBe('static-value');
        expect(EnvProvider.value('VUE_VALUE')).toBe('dynamic-vue');
        expect(EnvProvider.value('REACT_VALUE')).toBe('dynamic-react');
        expect(EnvProvider.value('NODE_ENV')).toBe('production');
    });

    test('should work when jvjr-env.json does not exist yet', async () => {
        // Don't create jvjr-env.json - simulating first run
        const EnvProvider = (await import('../EnvProvider.js')).default;

        // envVars should be empty object
        expect(EnvProvider.envVars).toEqual({});

        // value() should return undefined for any key
        expect(EnvProvider.value('ANY_KEY')).toBeUndefined();
    });
});

describe('EnvProvider.envVars', () => {
    test('should return the jvjr-env.json object', async () => {
        const envJson = {
            API_URL: '$VUE_APP_API_URL',
            TITLE: '$VUE_APP_TITLE',
            VERSION: '1.0.0'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.envVars).toEqual(envJson);
        expect(Object.keys(EnvProvider.envVars)).toHaveLength(3);
    });

    test('should return empty object when jvjr-env.json does not exist', async () => {
        // Don't create jvjr-env.json
        const EnvProvider = (await import('../EnvProvider.js')).default;

        expect(EnvProvider.envVars).toEqual({});
        expect(Object.keys(EnvProvider.envVars)).toHaveLength(0);
    });

    test('should be a static property (same instance across imports)', async () => {
        const envJson = { TEST: '$VUE_APP_TEST' };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        const EnvProvider1 = (await import('../EnvProvider.js')).default;
        const EnvProvider2 = (await import('../EnvProvider.js')).default;

        expect(EnvProvider1.envVars).toBe(EnvProvider2.envVars);
    });
});

describe('EnvProvider integration', () => {
    test('should handle complete workflow: env vars from jvjr-env.json and process.env', async () => {
        // Create realistic jvjr-env.json
        const envJson = {
            API_URL: '$VUE_APP_API_URL',
            API_KEY: '$VUE_APP_API_KEY',
            DEBUG: 'true',
            VERSION: '1.0.0',
            BUILD_TIME: '$REACT_APP_BUILD_TIME'
        };
        fs.writeFileSync(
            path.join(TEST_DIR, 'jvjr-env.json'),
            JSON.stringify(envJson, null, 2)
        );

        // Set process.env
        process.env.VUE_APP_API_URL = 'https://api.example.com';
        process.env.VUE_APP_API_KEY = 'sk-test-12345';
        process.env.REACT_APP_BUILD_TIME = '2024-01-15T10:30:00Z';

        const EnvProvider = (await import('../EnvProvider.js')).default;

        // Test all values
        expect(EnvProvider.value('API_URL')).toBe('https://api.example.com');
        expect(EnvProvider.value('API_KEY')).toBe('sk-test-12345');
        expect(EnvProvider.value('DEBUG')).toBe('true'); // Literal
        expect(EnvProvider.value('VERSION')).toBe('1.0.0'); // Literal
        expect(EnvProvider.value('BUILD_TIME')).toBe('2024-01-15T10:30:00Z');

        // Verify envVars
        expect(EnvProvider.envVars).toEqual(envJson);
    });
});
