/**
 * E2E Test: Docker Container Restart Bug Fix (Solution A)
 *
 * Verifies that the /app-source/ immutable copy (Solution A) fixes the bug where
 * containers using PUBLIC_PATH would crash on restart, requiring the image to be
 * deleted and re-run.
 *
 * ROOT CAUSE (pre-fix)
 *   modifyPublicPath() permanently mutated the container's writable layer:
 *     - sed -i patched index.html in-place
 *     - mv "$base_dir"/* moved all assets into a subdirectory
 *   On the second start, ENTRYPOINT still referenced the original paths
 *   (/usr/share/nginx/html/index.html, /usr/share/nginx/html/js/app.main.js)
 *   which no longer existed → entrypoint crashed.
 *
 * SOLUTION A
 *   Dockerfile: COPY --from=build-stage /app/dist /app-source  (read-only, never touched)
 *   Entrypoint Step 0: rm -rf /usr/share/nginx/html/* && cp -r /app-source/. /usr/share/nginx/html/
 *   Result: every container start begins from a pristine, unmodified copy.
 *
 * Requires: Docker daemon running.
 * Timeout: 300s (build + multiple docker start/stop cycles).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const BUILD_DIR = path.resolve(PROJECT_ROOT, 'tests/integration/docker-restart');
const IMAGE_PREFIX = 'jvjr-restart-test';

// ---------------------------------------------------------------------------
// Infrastructure helpers
// ---------------------------------------------------------------------------

function checkDockerAvailable() {
    try {
        execSync('docker info', { stdio: 'ignore', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

const DOCKER_AVAILABLE = checkDockerAvailable();

function runCli(args, cwd) {
    return execSync(
        `node ${path.join(PROJECT_ROOT, 'bin/jvjr')} ${args}`,
        { cwd, encoding: 'utf-8', timeout: 10000 }
    );
}

// jvjr --start prepends "jvjr --build && " to the build script.
// jvjr is a host tool, not installed inside Docker, so restore to "sh build.sh".
function fixBuildScriptForDocker(projectDir) {
    const pkgPath = path.join(projectDir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    pkg.scripts.build = 'sh build.sh';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
}

function dockerBuild(imageTag, contextDir) {
    return execSync(
        `docker build -t ${imageTag} -f Dockerfile-jvjr .`,
        { cwd: contextDir, encoding: 'utf-8', timeout: 180000 }
    );
}

function dockerRmi(imageTag) {
    try {
        execSync(`docker rmi -f ${imageTag}`, { stdio: 'ignore', timeout: 15000 });
    } catch { /* ignore */ }
}

function dockerRmContainer(containerName) {
    try {
        execSync(`docker rm -f ${containerName}`, { stdio: 'ignore', timeout: 10000 });
    } catch { /* ignore */ }
}

function imageExists(imageTag) {
    try {
        execSync(`docker image inspect ${imageTag}`, { stdio: 'ignore', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

function containerIsRunning(containerName) {
    try {
        const out = execSync(
            `docker inspect --format='{{.State.Running}}' ${containerName}`,
            { encoding: 'utf-8', timeout: 5000 }
        );
        return out.trim() === 'true';
    } catch {
        return false;
    }
}

// Run a named container in detached mode and wait for it to be running.
function dockerRunDetached(imageTag, containerName, envVars) {
    const envFlags = Object.entries(envVars)
        .map(([k, v]) => `-e "${k}=${v}"`)
        .join(' ');
    execSync(
        `docker run -d --name ${containerName} ${envFlags} ${imageTag}`,
        { encoding: 'utf-8', timeout: 30000 }
    );
    // Allow entrypoint + nginx startup time.
    execSync('sleep 3', { timeout: 8000 });
}

function dockerExec(containerName, cmd) {
    return execSync(
        `docker exec ${containerName} sh -c "${cmd}"`,
        { encoding: 'utf-8', timeout: 15000 }
    );
}

// ---------------------------------------------------------------------------
// Minimal project factory
// ---------------------------------------------------------------------------

function createMinimalVueProject(projectDir, envVars) {
    fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });

    fs.writeFileSync(
        path.join(projectDir, 'package.json'),
        JSON.stringify({
            name: 'restart-test-app',
            version: '1.0.0',
            scripts: { build: 'sh build.sh' }
        }, null, 2)
    );

    const envContent = Object.entries(envVars)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n') + '\n';
    fs.writeFileSync(path.join(projectDir, '.env'), envContent);

    // build.sh creates dist/ with $VUE_APP_* literal placeholders for envsubst.
    const jsContent = Object.keys(envVars)
        .map(k => `${k.replace(/^VUE_APP_/, '').toLowerCase()}:"$${k}"`)
        .join(',');

    fs.writeFileSync(
        path.join(projectDir, 'build.sh'),
        [
            '#!/bin/sh',
            'mkdir -p dist/js',
            `printf 'window.config={${jsContent}};' > dist/js/app.main.js`,
            "printf '<html><body><script src=\"/js/app.main.js\"></script></body></html>' > dist/index.html"
        ].join('\n') + '\n'
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const maybeDescribe = DOCKER_AVAILABLE ? describe : describe.skip;

maybeDescribe('E2E: Solution A — /app-source/ immutable copy', () => {
    jest.setTimeout(300000);

    const imageTag = `${IMAGE_PREFIX}-${Date.now()}`;
    const projectDir = path.join(BUILD_DIR, 'restart-app');

    const ENV_VARS = {
        VUE_APP_API_URL: 'http://build-placeholder.local',
        VUE_APP_TITLE: 'PLACEHOLDER_TITLE'
    };

    beforeAll(() => {
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
        fs.mkdirSync(projectDir, { recursive: true });
        createMinimalVueProject(projectDir, ENV_VARS);
        runCli('--start', projectDir);
        fixBuildScriptForDocker(projectDir);
        dockerBuild(imageTag, projectDir);
    });

    afterAll(() => {
        dockerRmi(imageTag);
    });

    // --- Image structure ---

    test('image is built successfully', () => {
        expect(imageExists(imageTag)).toBe(true);
    });

    test('/app-source/ exists in image and contains unmodified JS with placeholders', () => {
        const output = execSync(
            `docker run --rm --entrypoint sh ${imageTag} -c "cat /app-source/js/app.main.js"`,
            { encoding: 'utf-8', timeout: 15000 }
        );
        // Must contain literal $VAR placeholders — not substituted yet.
        expect(output).toContain('$VUE_APP_API_URL');
        expect(output).toContain('$VUE_APP_TITLE');
    });

    test('/app-source/ contains index.html', () => {
        const output = execSync(
            `docker run --rm --entrypoint sh ${imageTag} -c "cat /app-source/index.html"`,
            { encoding: 'utf-8', timeout: 15000 }
        );
        expect(output).toContain('app.main.js');
    });

    test('/usr/share/nginx/html/ also contains original files at image build time', () => {
        const output = execSync(
            `docker run --rm --entrypoint sh ${imageTag} -c "cat /usr/share/nginx/html/js/app.main.js"`,
            { encoding: 'utf-8', timeout: 15000 }
        );
        expect(output).toContain('$VUE_APP_API_URL');
    });
});

// ---------------------------------------------------------------------------

maybeDescribe('E2E: Container restart with PUBLIC_PATH (regression fix)', () => {
    jest.setTimeout(300000);

    const imageTag = `${IMAGE_PREFIX}-path-${Date.now()}`;
    const projectDir = path.join(BUILD_DIR, 'restart-path-app');
    // Unique container name per test run to avoid conflicts.
    const containerName = `jvjr-rc-${Date.now()}`;

    const ENV_VARS = {
        VUE_APP_API_URL: 'http://build-placeholder.local',
        VUE_APP_TITLE: 'PLACEHOLDER_TITLE'
    };

    const RUNTIME_ENV = {
        VUE_APP_API_URL: 'https://api.production.example.com',
        VUE_APP_TITLE: 'Production App',
        PUBLIC_PATH: '/myapp/'
    };

    beforeAll(() => {
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
        fs.mkdirSync(projectDir, { recursive: true });
        createMinimalVueProject(projectDir, ENV_VARS);
        runCli('--start', projectDir);
        fixBuildScriptForDocker(projectDir);
        dockerBuild(imageTag, projectDir);
        // Start the container with PUBLIC_PATH — this is the first run.
        dockerRunDetached(imageTag, containerName, RUNTIME_ENV);
    });

    afterAll(() => {
        dockerRmContainer(containerName);
        dockerRmi(imageTag);
    });

    // --- First run assertions ---

    test('container starts successfully on first run with PUBLIC_PATH=/myapp/', () => {
        expect(containerIsRunning(containerName)).toBe(true);
    });

    test('assets are relocated to /myapp/ subpath after first start', () => {
        const output = dockerExec(containerName, 'ls /usr/share/nginx/html/myapp/');
        expect(output).toContain('index.html');
        expect(output).toContain('js');
    });

    test('index.html has rewritten src paths pointing to /myapp/ after first start', () => {
        const output = dockerExec(containerName, 'cat /usr/share/nginx/html/myapp/index.html');
        expect(output).toContain('/myapp/js/app.main.js');
    });

    test('env vars are substituted in JS bundle after first start', () => {
        const output = dockerExec(containerName, 'cat /usr/share/nginx/html/myapp/js/app.main.js');
        expect(output).toContain('https://api.production.example.com');
        expect(output).toContain('Production App');
        expect(output).not.toContain('$VUE_APP_API_URL');
        expect(output).not.toContain('$VUE_APP_TITLE');
    });

    // --- Restart scenario (this is the regression being fixed) ---

    test('container restarts without error after docker stop (BUG FIX regression)', () => {
        // Stop the container (simulates server reboot, docker stop, etc.)
        execSync(`docker stop ${containerName}`, { encoding: 'utf-8', timeout: 30000 });
        expect(containerIsRunning(containerName)).toBe(false);

        // Restart — pre-fix: entrypoint crashed here because index.html had been
        // mv'd away from base_dir and the path no longer existed.
        // Post-fix: Step 0 restores /usr/share/nginx/html from /app-source/ first.
        execSync(`docker start ${containerName}`, { encoding: 'utf-8', timeout: 30000 });
        execSync('sleep 3', { timeout: 8000 });

        expect(containerIsRunning(containerName)).toBe(true);
    });

    test('assets remain at /myapp/ subpath after restart', () => {
        const output = dockerExec(containerName, 'ls /usr/share/nginx/html/myapp/');
        expect(output).toContain('index.html');
        expect(output).toContain('js');
    });

    test('index.html paths are correct after restart', () => {
        const output = dockerExec(containerName, 'cat /usr/share/nginx/html/myapp/index.html');
        expect(output).toContain('/myapp/js/app.main.js');
    });

    test('env vars are still substituted in JS bundle after restart', () => {
        const output = dockerExec(containerName, 'cat /usr/share/nginx/html/myapp/js/app.main.js');
        expect(output).toContain('https://api.production.example.com');
        expect(output).not.toContain('$VUE_APP_API_URL');
    });

    // --- /app-source/ immutability ---

    test('/app-source/ remains unmodified after runtime mutations and restart', () => {
        // Despite modifyPublicPath moving/patching files in /usr/share/nginx/html,
        // /app-source/ must always retain the original unsubstituted placeholders.
        const output = dockerExec(containerName, 'cat /app-source/js/app.main.js');
        expect(output).toContain('$VUE_APP_API_URL');
        expect(output).toContain('$VUE_APP_TITLE');
        expect(output).not.toContain('https://api.production.example.com');
    });

    test('/app-source/index.html retains original (unmodified) src path', () => {
        const output = dockerExec(containerName, 'cat /app-source/index.html');
        // Original index.html uses /js/app.main.js (root-relative, no /myapp/ prefix)
        expect(output).toContain('/js/app.main.js');
        expect(output).not.toContain('/myapp/');
    });
});

// ---------------------------------------------------------------------------

maybeDescribe('E2E: Multiple restarts — idempotency', () => {
    jest.setTimeout(300000);

    const imageTag = `${IMAGE_PREFIX}-idem-${Date.now()}`;
    const projectDir = path.join(BUILD_DIR, 'idempotent-app');
    const containerName = `jvjr-idem-${Date.now()}`;

    const ENV_VARS = {
        VUE_APP_API_URL: 'http://placeholder.local',
        VUE_APP_TITLE: 'PLACEHOLDER'
    };

    beforeAll(() => {
        if (fs.existsSync(projectDir)) {
            fs.rmSync(projectDir, { recursive: true, force: true });
        }
        fs.mkdirSync(projectDir, { recursive: true });
        createMinimalVueProject(projectDir, ENV_VARS);
        runCli('--start', projectDir);
        fixBuildScriptForDocker(projectDir);
        dockerBuild(imageTag, projectDir);
        dockerRunDetached(imageTag, containerName, {
            VUE_APP_API_URL: 'https://idempotent-api.example.com',
            VUE_APP_TITLE: 'Idempotent Test',
            PUBLIC_PATH: '/stable/'
        });
    });

    afterAll(() => {
        dockerRmContainer(containerName);
        dockerRmi(imageTag);
    });

    function assertWorking() {
        expect(containerIsRunning(containerName)).toBe(true);
        const index = dockerExec(containerName, 'cat /usr/share/nginx/html/stable/index.html');
        expect(index).toContain('/stable/js/app.main.js');
        const js = dockerExec(containerName, 'cat /usr/share/nginx/html/stable/js/app.main.js');
        expect(js).toContain('https://idempotent-api.example.com');
        expect(js).not.toContain('$VUE_APP_API_URL');
    }

    test('container is running correctly after first start', assertWorking);

    test('container is running correctly after second start (restart #1)', () => {
        execSync(`docker stop ${containerName}`, { timeout: 30000 });
        execSync(`docker start ${containerName}`, { timeout: 30000 });
        execSync('sleep 3', { timeout: 8000 });
        assertWorking();
    });

    test('container is running correctly after third start (restart #2)', () => {
        execSync(`docker stop ${containerName}`, { timeout: 30000 });
        execSync(`docker start ${containerName}`, { timeout: 30000 });
        execSync('sleep 3', { timeout: 8000 });
        assertWorking();
    });
});
