/**
 * Unit tests for utility functions
 */

import { createEnvJsonMap, mapToObj, addScripts, removeScripts } from '../src/utils.js';

describe('createEnvJsonMap', () => {
    test('should parse Vue environment variables', () => {
        const input = 'VUE_APP_API_URL=http://localhost:3000\nVUE_APP_TITLE=MyApp';
        const result = createEnvJsonMap(input);

        expect(result.get('API_URL')).toBe('$VUE_APP_API_URL');
        expect(result.get('TITLE')).toBe('$VUE_APP_TITLE');
    });

    test('should parse React environment variables', () => {
        const input = 'REACT_APP_API_URL=http://localhost:3000\nREACT_APP_VERSION=1.0.0';
        const result = createEnvJsonMap(input);

        expect(result.get('API_URL')).toBe('$REACT_APP_API_URL');
        expect(result.get('VERSION')).toBe('$REACT_APP_VERSION');
    });

    test('should ignore comments', () => {
        const input = '# This is a comment\nVUE_APP_API_URL=http://localhost:3000';
        const result = createEnvJsonMap(input);

        expect(result.size).toBe(1);
        expect(result.has('API_URL')).toBe(true);
    });

    test('should handle variables without prefix', () => {
        const input = 'NODE_ENV=production\nPORT=3000';
        const result = createEnvJsonMap(input);

        expect(result.get('NODE_ENV')).toBe('$NODE_ENV');
        expect(result.get('PORT')).toBe('$PORT');
    });

    test('should handle empty input', () => {
        const result = createEnvJsonMap('');
        expect(result.size).toBe(0);
    });

    test('should handle mixed prefixes', () => {
        const input = 'VUE_APP_API_URL=http://api.com\nREACT_APP_VERSION=2.0\nNODE_ENV=production';
        const result = createEnvJsonMap(input);

        expect(result.get('API_URL')).toBe('$VUE_APP_API_URL');
        expect(result.get('VERSION')).toBe('$REACT_APP_VERSION');
        expect(result.get('NODE_ENV')).toBe('$NODE_ENV');
    });

    test('should handle values with equals sign', () => {
        const input = 'VUE_APP_CONNECTION_STRING=user=abc;pass=def';
        const result = createEnvJsonMap(input);

        expect(result.get('CONNECTION_STRING')).toBe('$VUE_APP_CONNECTION_STRING');
    });
});

describe('mapToObj', () => {
    test('should convert Map to Object', () => {
        const map = new Map([
            ['key1', 'value1'],
            ['key2', 'value2'],
            ['key3', 'value3']
        ]);
        const result = mapToObj(map);

        expect(result).toEqual({
            key1: 'value1',
            key2: 'value2',
            key3: 'value3'
        });
    });

    test('should handle empty Map', () => {
        const result = mapToObj(new Map());
        expect(result).toEqual({});
    });

    test('should handle special characters in keys', () => {
        const map = new Map([
            ['API_URL', '$VUE_APP_API_URL'],
            ['DB_HOST', '$REACT_APP_DB_HOST']
        ]);
        const result = mapToObj(map);

        expect(result.API_URL).toBe('$VUE_APP_API_URL');
        expect(result.DB_HOST).toBe('$REACT_APP_DB_HOST');
    });
});

describe('addScripts', () => {
    test('should prepend jvjr build to existing build script', () => {
        const scripts = {
            build: 'webpack --mode production'
        };
        const result = addScripts(scripts, 'jvjr --build');

        expect(result.build).toBe('jvjr --build && webpack --mode production');
        expect(result['jvjr-build']).toBe('jvjr --build');
    });

    test('should not duplicate if jvjr build already exists', () => {
        const scripts = {
            build: 'jvjr --build && webpack'
        };
        const result = addScripts(scripts, 'jvjr --build');

        expect(result.build).toBe('jvjr --build && webpack');
    });

    test('should create build script if not exists', () => {
        const scripts = {};
        const result = addScripts(scripts, 'jvjr --build');

        expect(result.build).toBe('jvjr --build');
        expect(result['jvjr-build']).toBe('jvjr --build');
    });

    test('should create build script if empty', () => {
        const scripts = {
            build: ''
        };
        const result = addScripts(scripts, 'jvjr --build');

        expect(result.build).toBe('jvjr --build');
    });
});

describe('removeScripts', () => {
    test('should remove jvjr build from existing build script', () => {
        const scripts = {
            build: 'jvjr --build && webpack --mode production',
            'jvjr-build': 'jvjr --build'
        };
        const result = removeScripts(scripts, 'jvjr --build');

        expect(result.build).toBe('webpack --mode production');
        expect(result['jvjr-build']).toBeUndefined();
    });

    test('should remove build script if only jvjr build remains', () => {
        const scripts = {
            build: 'jvjr --build',
            'jvjr-build': 'jvjr --build'
        };
        const result = removeScripts(scripts, 'jvjr --build');

        expect(result.build).toBeUndefined();
        expect(result['jvjr-build']).toBeUndefined();
    });

    test('should handle scripts without jvjr build', () => {
        const scripts = {
            build: 'webpack --mode production'
        };
        const result = removeScripts(scripts, 'jvjr --build');

        expect(result.build).toBe('webpack --mode production');
    });
});

describe('Environment parsing integration', () => {
    test('should parse complete .env file to JSON object', () => {
        const envContent = `# API Configuration
VUE_APP_API_URL=http://localhost:3000/api
VUE_APP_API_KEY=secret123

# App Settings
VUE_APP_TITLE=My Application
VUE_APP_DEBUG=true

# React Example
REACT_APP_VERSION=1.0.0`;

        const map = createEnvJsonMap(envContent);
        const result = mapToObj(map);

        expect(result).toEqual({
            API_URL: '$VUE_APP_API_URL',
            API_KEY: '$VUE_APP_API_KEY',
            TITLE: '$VUE_APP_TITLE',
            DEBUG: '$VUE_APP_DEBUG',
            VERSION: '$REACT_APP_VERSION'
        });
    });
});

describe('createEnvJsonMap edge cases', () => {
    test('should handle multiline values', () => {
        // Note: createEnvJsonMap only stores the reference ($VUE_APP_*),
        // not the actual multiline value. The value would be in .env file.
        const input = 'VUE_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA2Z2\n-----END RSA PRIVATE KEY-----"';
        const result = createEnvJsonMap(input);

        // The function stores the reference, not the actual multiline value
        expect(result.has('PRIVATE_KEY')).toBe(true);
        expect(result.get('PRIVATE_KEY')).toBe('$VUE_APP_PRIVATE_KEY');
    });

    test('should handle values with = sign inside', () => {
        const input = 'VUE_APP_CONNECTION_STRING=user=admin;password=pass123;server=localhost';
        const result = createEnvJsonMap(input);

        expect(result.get('CONNECTION_STRING')).toBe('$VUE_APP_CONNECTION_STRING');
    });

    test('should handle multiple = signs in value', () => {
        const input = 'VUE_APP_EQUATION=a=b=c=d';
        const result = createEnvJsonMap(input);

        // Only splits on first =
        expect(result.get('EQUATION')).toBe('$VUE_APP_EQUATION');
    });

    test('should handle UTF-8 characters (accents, emojis)', () => {
        const input = `VUE_APP_TITLE=Título con Ñ y Ç
VUE_APP_EMOJI=🚀🎉✨
VUE_APP_UMLAUT=Über Küß
REACT_APP_CYRILLIC=Привет Мир`;

        const result = createEnvJsonMap(input);

        expect(result.get('TITLE')).toBe('$VUE_APP_TITLE');
        expect(result.get('EMOJI')).toBe('$VUE_APP_EMOJI');
        expect(result.get('UMLAUT')).toBe('$VUE_APP_UMLAUT');
        expect(result.get('CYRILLIC')).toBe('$REACT_APP_CYRILLIC');
    });

    test('should handle file with only comments', () => {
        const input = `# This is a comment
# Another comment
# VUE_APP_SHOULD_NOT=parse
# REACT_APP_ALSO_NOT=parse`;

        const result = createEnvJsonMap(input);

        expect(result.size).toBe(0);
    });

    test('should handle empty lines and whitespace', () => {
        const input = `

VUE_APP_FIRST=value1

VUE_APP_SECOND=value2


VUE_APP_THIRD=value3

`;

        const result = createEnvJsonMap(input);

        expect(result.size).toBe(3);
        expect(result.get('FIRST')).toBe('$VUE_APP_FIRST');
        expect(result.get('SECOND')).toBe('$VUE_APP_SECOND');
        expect(result.get('THIRD')).toBe('$VUE_APP_THIRD');
    });

    test('should handle values with quotes (single and double)', () => {
        const input = `VUE_APP_SINGLE='quoted value'
VUE_APP_DOUBLE="double quoted"
VUE_APP_NO_QUOTES=unquoted`;

        const result = createEnvJsonMap(input);

        expect(result.get('SINGLE')).toBe('$VUE_APP_SINGLE');
        expect(result.get('DOUBLE')).toBe('$VUE_APP_DOUBLE');
        expect(result.get('NO_QUOTES')).toBe('$VUE_APP_NO_QUOTES');
    });

    test('should handle special characters in keys', () => {
        const input = `VUE_APP_API_URL_2=http://backup.com
REACT_APP_DB_HOST=localhost
NODE_ENV=production`;

        const result = createEnvJsonMap(input);

        expect(result.get('API_URL_2')).toBe('$VUE_APP_API_URL_2');
        expect(result.get('DB_HOST')).toBe('$REACT_APP_DB_HOST');
        expect(result.get('NODE_ENV')).toBe('$NODE_ENV');
    });

    test('should handle CRLF and LF line endings', () => {
        const inputCRLF = 'VUE_APP_TEST1=value1\r\nVUE_APP_TEST2=value2\r\n';
        const inputLF = 'VUE_APP_TEST1=value1\nVUE_APP_TEST2=value2\n';

        const resultCRLF = createEnvJsonMap(inputCRLF);
        const resultLF = createEnvJsonMap(inputLF);

        expect(resultCRLF.size).toBe(2);
        expect(resultLF.size).toBe(2);
        expect(resultCRLF.get('TEST1')).toBe('$VUE_APP_TEST1');
        expect(resultLF.get('TEST1')).toBe('$VUE_APP_TEST1');
    });
});

describe('Stress tests', () => {
    test('should handle 1000+ environment variables', () => {
        let input = '';
        for (let i = 0; i < 1000; i++) {
            input += `VUE_APP_VAR_${i}=value_${i}\n`;
        }

        const result = createEnvJsonMap(input);

        expect(result.size).toBe(1000);
        expect(result.get('VAR_0')).toBe('$VUE_APP_VAR_0');
        expect(result.get('VAR_999')).toBe('$VUE_APP_VAR_999');
    });

    test('should handle very long values', () => {
        const longValue = 'a'.repeat(10000);
        const input = `VUE_APP_LONG_VALUE=${longValue}`;

        const result = createEnvJsonMap(input);

        expect(result.get('LONG_VALUE')).toBe('$VUE_APP_LONG_VALUE');
    });

    test('should handle very long keys', () => {
        const longKey = 'VERY_LONG_KEY_NAME_' + 'x'.repeat(200);
        const input = `VUE_APP_${longKey}=value`;

        const result = createEnvJsonMap(input);

        expect(result.has(longKey)).toBe(true);
    });
});
