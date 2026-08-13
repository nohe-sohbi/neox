/**
 * Request correlation + health metadata: every response must carry a usable
 * X-Request-Id, and /api/health must identify the running version.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neox-obs-'));
process.env.DATA_DIR = dataDir;
process.env.JWT_SECRET = 'obs-secret';

const request = require('supertest');
const app = require('./server');
const { version } = require('./package.json');

afterAll(() => fs.rmSync(dataDir, { recursive: true, force: true }));

describe('request correlation', () => {
    it('stamps every response with a generated X-Request-Id', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('echoes a sane inbound X-Request-Id', async () => {
        const res = await request(app).get('/api/health').set('X-Request-Id', 'edge-42.abc');
        expect(res.headers['x-request-id']).toBe('edge-42.abc');
    });

    it('replaces a malformed inbound id instead of reflecting it', async () => {
        const res = await request(app)
            .get('/api/health')
            .set('X-Request-Id', 'x'.repeat(200));
        expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('includes the request id in error bodies for support correlation', async () => {
        const res = await request(app).get('/api/movie/abc').set('X-Request-Id', 'bug-report-1');
        expect(res.status).toBe(400);
        expect(res.body.requestId).toBe('bug-report-1');
    });
});

describe('health metadata', () => {
    it('reports the running version', async () => {
        const res = await request(app).get('/api/health');
        expect(res.body.version).toBe(version);
    });
});
