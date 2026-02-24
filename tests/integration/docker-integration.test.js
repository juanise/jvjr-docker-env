/**
 * Integration Test - Real Vue and React apps with Docker
 *
 * This test creates minimal Vue and React projects, applies jvjr-docker-env,
 * and verifies environment variables work correctly.
 *
 * NOTE: This is an integration test that creates actual projects.
 * It requires Docker to be installed for full verification.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { jest } from '@jest/globals';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const INTEGRATION_DIR = path.resolve(PROJECT_ROOT, 'tests/integration/integration');

// Mock process.exit for module imports
let exitSpy;
beforeEach(() => {
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    // Clean integration directory
    if (fs.existsSync(INTEGRATION_DIR)) {
        fs.rmSync(INTEGRATION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(INTEGRATION_DIR, { recursive: true });
});

afterEach(() => {
    exitSpy.mockRestore();
});

function createMinimalVueProject(projectDir) {
    // Create minimal Vue 3 project structure
    const dirs = [
        'src',
        'public'
    ];
    dirs.forEach(d => fs.mkdirSync(path.join(projectDir, d), { recursive: true }));

    // package.json
    fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify({
            name: 'vue-test-app',
            version: '1.0.0',
            scripts: {
                build: 'vite build'
            }
        }, null, 2)
    );

    // .env file with test variables
    fs.writeFileSync(
        path.join(projectDir, '.env'),
        `# Vue App Environment Variables
VUE_APP_API_URL=http://localhost:3000/api
VUE_APP_API_KEY=dev-key-123
VUE_APP_TITLE=Vue Test Application
VUE_APP_DEBUG=true
`
    );

    // Minimal main.js
    fs.writeFileSync(
        path.join(projectDir, 'src/main.js'),
        `import { createApp } from 'vue';
import App from './App.vue';
createApp(App).mount('#app');
`
    );

    // Minimal App.vue that uses env vars
    fs.writeFileSync(
        path.join(projectDir, 'src/App.vue'),
        `<template>
  <div>
    <h1>{{ title }}</h1>
    <p>API: {{ apiUrl }}</p>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      title: process.env.VUE_APP_TITLE || 'Default',
      apiUrl: process.env.VUE_APP_API_URL || 'http://default'
    };
  }
};
</script>
`
    );

    // index.html
    fs.writeFileSync(
        path.join(projectDir, 'index.html'),
        `<!DOCTYPE html>
<html>
<head>
  <title>Vue Test</title>
</head>
<body>
  <div id="app"></div>
</body>
</html>
`
    );

    // vite.config.js
    fs.writeFileSync(
        path.join(projectDir, 'vite.config.js'),
        `export default {
  build: {
    outDir: 'dist'
  }
};
`
    );
}

function createMinimalReactProject(projectDir) {
    // Create minimal React project structure
    const dirs = [
        'src',
        'public'
    ];
    dirs.forEach(d => fs.mkdirSync(path.join(projectDir, d), { recursive: true }));

    // package.json
    fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify({
            name: 'react-test-app',
            version: '1.0.0',
            scripts: {
                build: 'react-scripts build'
            }
        }, null, 2)
    );

    // .env file with test variables
    fs.writeFileSync(
        path.join(projectDir, '.env'),
        `# React App Environment Variables
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_API_KEY=react-key-456
REACT_APP_TITLE=React Test Application
REACT_APP_VERSION=2.0.0
`
    );

    // Minimal index.js
    fs.writeFileSync(
        path.join(projectDir, 'src/index.js'),
        `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
`
    );

    // Minimal App.js that uses env vars
    fs.writeFileSync(
        path.join(projectDir, 'src/App.js'),
        `import React from 'react';

function App() {
  const apiUrl = process.env.REACT_APP_API_URL || 'http://default';
  const title = process.env.REACT_APP_TITLE || 'Default';

  return (
    <div>
      <h1>{title}</h1>
      <p>API: {apiUrl}</p>
    </div>
  );
}

export default App;
`
    );

    // index.html
    fs.writeFileSync(
        path.join(projectDir, 'public/index.html'),
        `<!DOCTYPE html>
<html>
<head>
  <title>React Test</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>
`
    );
}

function applyJvjrDockerEnv(projectDir) {
    // Run jvjr --start
    const result = execSync(
        `node ${path.join(PROJECT_ROOT, 'bin/jvjr')} --start`,
        { cwd: projectDir, encoding: 'utf-8' }
    );
    return result;
}

function verifyGeneratedFiles(projectDir) {
    // Verify all expected files exist
    const expectedFiles = [
        'Dockerfile-jvjr',
        'jvjr-entrypoint.sh',
        'jvjr-env.json'
    ];

    const results = {};
    expectedFiles.forEach(file => {
        const filePath = path.join(projectDir, file);
        results[file] = {
            exists: fs.existsSync(filePath),
            content: fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : null
        };
    });

    // Verify package.json was updated
    const packageJson = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf-8'));
    results.packageJson = packageJson;

    return results;
}

describe('Integration: Vue App with Docker', () => {
    test('should create Vue project and apply jvjr-docker-env', () => {
        const vueProjectDir = path.join(INTEGRATION_DIR, 'vue-test-app');

        // Create minimal Vue project
        createMinimalVueProject(vueProjectDir);

        // Apply jvjr-docker-env
        const result = applyJvjrDockerEnv(vueProjectDir);
        expect(result).toContain('DONE');

        // Verify generated files
        const files = verifyGeneratedFiles(vueProjectDir);

        expect(files['Dockerfile-jvjr'].exists).toBe(true);
        expect(files['Dockerfile-jvjr'].content).toContain('FROM node:24-alpine');
        expect(files['Dockerfile-jvjr'].content).toContain('FROM nginx:1.27-alpine');

        expect(files['jvjr-entrypoint.sh'].exists).toBe(true);
        expect(files['jvjr-entrypoint.sh'].content).toContain('#!/bin/sh');

        expect(files['jvjr-env.json'].exists).toBe(true);

        // Verify jvjr-env.json content
        const envJson = JSON.parse(files['jvjr-env.json'].content);
        expect(envJson).toEqual({
            API_URL: '$VUE_APP_API_URL',
            API_KEY: '$VUE_APP_API_KEY',
            TITLE: '$VUE_APP_TITLE',
            DEBUG: '$VUE_APP_DEBUG'
        });

        // Verify package.json scripts
        expect(files.packageJson.scripts.build).toContain('jvjr --build');
        expect(files.packageJson.scripts['jvjr-build']).toBe('jvjr --build');
    });

    test('should rebuild jvjr-env.json when --build is called', () => {
        const vueProjectDir = path.join(INTEGRATION_DIR, 'vue-rebuild-test');

        createMinimalVueProject(vueProjectDir);
        applyJvjrDockerEnv(vueProjectDir);

        // Modify .env file
        fs.writeFileSync(
            path.join(vueProjectDir, '.env'),
            `VUE_APP_API_URL=http://new-api.com
VUE_APP_TITLE=Updated Title
`
        );

        // Run jvjr --build
        execSync(
            `node ${path.join(PROJECT_ROOT, 'bin/jvjr')} --build`,
            { cwd: vueProjectDir, encoding: 'utf-8' }
        );

        // Verify jvjr-env.json was updated
        const envJson = JSON.parse(
            fs.readFileSync(path.join(vueProjectDir, 'jvjr-env.json'), 'utf-8')
        );

        expect(envJson).toEqual({
            API_URL: '$VUE_APP_API_URL',
            TITLE: '$VUE_APP_TITLE'
        });
    });
});

describe('Integration: React App with Docker', () => {
    test('should create React project and apply jvjr-docker-env', () => {
        const reactProjectDir = path.join(INTEGRATION_DIR, 'react-test-app');

        // Create minimal React project
        createMinimalReactProject(reactProjectDir);

        // Apply jvjr-docker-env
        const result = applyJvjrDockerEnv(reactProjectDir);
        expect(result).toContain('DONE');

        // Verify generated files
        const files = verifyGeneratedFiles(reactProjectDir);

        expect(files['Dockerfile-jvjr'].exists).toBe(true);
        expect(files['Dockerfile-jvjr'].content).toContain('FROM node:24-alpine');

        expect(files['jvjr-entrypoint.sh'].exists).toBe(true);

        expect(files['jvjr-env.json'].exists).toBe(true);

        // Verify jvjr-env.json content
        const envJson = JSON.parse(files['jvjr-env.json'].content);
        expect(envJson).toEqual({
            API_URL: '$REACT_APP_API_URL',
            API_KEY: '$REACT_APP_API_KEY',
            TITLE: '$REACT_APP_TITLE',
            VERSION: '$REACT_APP_VERSION'
        });

        // Verify package.json scripts
        expect(files.packageJson.scripts.build).toContain('jvjr --build');
    });
});

describe('Integration: Environment Variable Substitution', () => {
    test('Vue app should handle environment variable substitution pattern', () => {
        const vueProjectDir = path.join(INTEGRATION_DIR, 'vue-env-test');

        createMinimalVueProject(vueProjectDir);
        applyJvjrDockerEnv(vueProjectDir);

        const envJson = JSON.parse(
            fs.readFileSync(path.join(vueProjectDir, 'jvjr-env.json'), 'utf-8')
        );

        // Verify the pattern: variables are prefixed with $VUE_APP_
        expect(envJson.API_URL).toBe('$VUE_APP_API_URL');
        expect(envJson.API_KEY).toBe('$VUE_APP_API_KEY');
        expect(envJson.TITLE).toBe('$VUE_APP_TITLE');
        expect(envJson.DEBUG).toBe('$VUE_APP_DEBUG');
    });

    test('React app should handle environment variable substitution pattern', () => {
        const reactProjectDir = path.join(INTEGRATION_DIR, 'react-env-test');

        createMinimalReactProject(reactProjectDir);
        applyJvjrDockerEnv(reactProjectDir);

        const envJson = JSON.parse(
            fs.readFileSync(path.join(reactProjectDir, 'jvjr-env.json'), 'utf-8')
        );

        // Verify the pattern: variables are prefixed with $REACT_APP_
        expect(envJson.API_URL).toBe('$REACT_APP_API_URL');
        expect(envJson.API_KEY).toBe('$REACT_APP_API_KEY');
        expect(envJson.TITLE).toBe('$REACT_APP_TITLE');
        expect(envJson.VERSION).toBe('$REACT_APP_VERSION');
    });
});

describe('Integration: Dockerfile Verification', () => {
    test('Vue Dockerfile should have correct structure', () => {
        const vueProjectDir = path.join(INTEGRATION_DIR, 'vue-dockerfile-test');

        createMinimalVueProject(vueProjectDir);
        applyJvjrDockerEnv(vueProjectDir);

        const dockerfile = fs.readFileSync(
            path.join(vueProjectDir, 'Dockerfile-jvjr'),
            'utf-8'
        );

        // Verify Node.js 24
        expect(dockerfile).toMatch(/FROM node:\d+-alpine/);
        expect(dockerfile).toContain('WORKDIR /app');

        // Verify stages (AS is the canonical Dockerfile keyword casing)
        expect(dockerfile).toMatch(/AS build-stage/i);
        expect(dockerfile).toMatch(/AS production-stage/i);

        // Verify Nginx
        expect(dockerfile).toMatch(/FROM nginx:[\d.]+-alpine/);

        // Verify entrypoint
        expect(dockerfile).toContain('ENTRYPOINT [ "/jvjr-entrypoint.sh"');
    });

    test('React Dockerfile should have correct structure', () => {
        const reactProjectDir = path.join(INTEGRATION_DIR, 'react-dockerfile-test');

        createMinimalReactProject(reactProjectDir);
        applyJvjrDockerEnv(reactProjectDir);

        const dockerfile = fs.readFileSync(
            path.join(reactProjectDir, 'Dockerfile-jvjr'),
            'utf-8'
        );

        // Verify Node.js 24
        expect(dockerfile).toMatch(/FROM node:\d+-alpine/);

        // Verify Nginx
        expect(dockerfile).toMatch(/FROM nginx:[\d.]+-alpine/);
    });
});
