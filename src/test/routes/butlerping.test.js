import axios from 'axios';
import config from 'config';

const instance = axios.create({
    baseURL: `http://localhost:${config.get('Butler.restServerConfig.serverPort')}`,
    timeout: 15000,
});

let result;

// Load globals dynamically/async to ensure singleton pattern works
const settingsObj = (await import('../../globals.js')).default;
const globals = await settingsObj.init();

// Get app version from package.json
const { appVersion } = globals;

/**
 * D1
 * Ping Butler, get response
 */
describe('D1: GET /v4/butlerping', () => {
    test('It should respond with 200 to the GET method', async () => {
        result = await instance.get('/v4/butlerping', {});

        expect(result.status).toBe(200);
    });

    test('Response should be an object', () => {
        expect(result.data).toBeTruthy();
        expect(typeof result.data).toBe('object');
    });

    test('Response should contain correct fields', () => {
        expect(result.data.response).toBeTruthy();
        expect(result.data.response).toEqual('Butler reporting for duty');

        expect(result.data.butlerVersion).toBeTruthy();
        // eslint-disable-next-line global-require, import/no-unresolved
        expect(result.data.butlerVersion).toEqual(appVersion);
    });
});
