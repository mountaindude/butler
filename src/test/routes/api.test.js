const path = require('path');
const axios = require('axios');

process.env.NODE_CONFIG_DIR = path.resolve('./src/config/');
process.env.NODE_ENV = 'production';
const config = require('config');

const instance = axios.create({
    baseURL: `http://localhost:${config.get('Butler.restServerConfig.serverPort')}`,
    timeout: 15000,
});

let result;

/**
 * B1
 * Get array with all enabled endpoints
 */
describe('B1: GET /v4/configfile/endpointsenabled', () => {
    test('It should respond with 200 to the GET method', async () => {
        result = await instance.get(`/v4/configfile/endpointsenabled`);

        expect(result.status).toBe(200);
    });

    test('Response should be an array', () => {
        expect(Array.isArray(result.data)).toBe(true);
    });
});
