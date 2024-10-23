import path from 'node:path';
import QrsInteract from 'qrs-interact';
import axios from 'axios';
// import https from 'node:https';
// import fs from 'node:fs';
// import { Agent } from 'undici';

import globals from '../globals.js';

/**
 *
 * @param {*} taskId
 * @param {*} cpName
 * @param {*} cpValue
 * @returns
 */
export async function isCustomPropertyValueSet(taskId, cpName, cpValue, logger) {
    const localLogger = logger !== undefined ? logger : globals.logger;

    localLogger.debug(`Checking if value "${cpValue}" is set for custom property "${cpName}"`);

    try {
        // Get http headers from Butler config file
        const httpHeaders = globals.getQRSHttpHeaders();

        const qrsInstance = new QrsInteract({
            hostname: globals.configQRS.host,
            portNumber: globals.configQRS.port,
            headers: httpHeaders,
            certificates: {
                certFile: path.resolve(globals.configQRS.certPaths.certPath),
                keyFile: path.resolve(globals.configQRS.certPaths.keyPath),
            },
        });

        // Get info about the task
        try {
            localLogger.debug(
                `ISCPVALUESET: task/full?filter=id eq ${taskId} and customProperties.definition.name eq '${cpName}' and customProperties.value eq '${cpValue}'`,
            );

            const result = await qrsInstance.Get(
                `task/full?filter=id eq ${taskId} and customProperties.definition.name eq '${cpName}' and customProperties.value eq '${cpValue}'`,
            );
            localLogger.debug(`ISCPVALUESET: Got response: ${result.statusCode} for CP ${cpName}`);

            if (result.body.length === 1) {
                // Yes, the CP/value exists for this task
                return true;
            }

            // Value not set for the CP
            return false;
        } catch (err) {
            localLogger.error(`ISCPVALUESET: Error while getting CP: ${err.message}`);
            return false;
        }
    } catch (err) {
        localLogger.error(`ISCPVALUESET: Error while getting CP: ${err}`);
        return false;
    }
}

/**
 *
 * @param {*} taskId
 * @param {*} cpName
 * @returns
 */
export async function getTaskCustomPropertyValues(taskId, cpName) {
    globals.logger.debug(`GETTASKCPVALUE: Retrieving all values for custom property "${cpName}" of reload task ${taskId}`);

    try {
        // Get http headers from Butler config file
        const httpHeaders = globals.getQRSHttpHeaders();

        const qrsInstance = new QrsInteract({
            hostname: globals.configQRS.host,
            portNumber: globals.configQRS.port,
            headers: httpHeaders,
            certificates: {
                certFile: path.resolve(globals.configQRS.certPaths.certPath),
                keyFile: path.resolve(globals.configQRS.certPaths.keyPath),
            },
        });

        // Get info about the task
        try {
            globals.logger.debug(`GETTASKCPVALUE: task/full?filter=id eq ${taskId} and customProperties.definition.name eq '${cpName}'`);

            const result = await qrsInstance.Get(`task/full?filter=id eq ${taskId} and customProperties.definition.name eq '${cpName}'`);
            globals.logger.debug(`GETTASKCPVALUE: Got response: ${result.statusCode} for CP ${cpName}`);

            if (result.body.length === 1) {
                // Yes, the CP exists for this task. Return all values present for this CP

                // Get array of all values for this CP, for this task
                const cpValues1 = result.body[0].customProperties.filter((cp) => cp.definition.name === cpName);

                // Get array of all CP values
                const cpValues2 = cpValues1.map((item) => item.value);

                return cpValues2;
            }

            // The task and/or the CP does not exist
            return [];
        } catch (err) {
            globals.logger.error(`GETTASKCPVALUE: Error while getting CP: ${err.message}`);
            return [];
        }
    } catch (err) {
        globals.logger.error(`GETTASKCPVALUE: Error while getting CP: ${err}`);
        return false;
    }
}

// Function to get all custom properties that are available for reload tasks
export async function getReloadTasksCustomProperties(config, configQRS, logger) {
    logger.debug('GETRELOADTASKSCP: Retrieving all custom properties that are available for reload tasks');

    try {

        // Set env  variables
        // process.env.NODE_EXTRA_CA_CERTS = '/Users/goran/code/secret/pro2win1-nopwd/root.pem';

        // Add x-qlik-xrfkey to headers
        const httpHeaders = {};
        httpHeaders['X-Qlik-Xrfkey'] = 'abcdefghijklmnop';
        httpHeaders['X-Qlik-User'] = 'UserDirectory=Internal;UserId=sa_repository';

        // const url = `https://${globals.configQRS.host}:${globals.configQRS.port}/qrs/custompropertydefinition/full?filter=objectTypes eq 'ReloadTask'&xrfkey=abcdefghijklmnop`;
        const url = `https://${globals.configQRS.host}:${globals.configQRS.port}/qrs/custompropertydefinition/full?filter=objectTypes eq 'ReloadTask'&xrfkey=abcdefghijklmnop`;
        // const url = `https://pro2-win1.lab.ptarmiganlabs.net:4242/qrs/about?xrfkey=abcdefghijklmnop`;

        const cert = await Deno.readTextFile('/Users/goran/code/secret/pro2win1-nopwd/client.pem');
        const key = await Deno.readTextFile('/Users/goran/code/secret/pro2win1-nopwd/client_key.pem');
        const caCert = await Deno.readTextFile('/Users/goran/code/secret/pro2win1-nopwd/root.pem');
        const denoClient = Deno.createHttpClient({ key, cert, caCerts: [caCert] });
        const response = await fetch(url, {
            headers: httpHeaders,
            client: denoClient,
        });

        const result = await response.json();




        // // Works in Node, but not in Deno
        // // const url = `https://${globals.configQRS.host}:${globals.configQRS.port}/qrs/about?xrfkey=abcdefghijklmnop`;

        // const response = await fetch(url, {
        //     method: 'GET',
        //     headers: httpHeaders,
        //     // headers: {
        //     //     'X-Qlik-Xrfkey': 'abcdefghijklmnop',
        //     //     'X-Qlik-User': 'UserDirectory=Internal;UserId=sa_repository',
        //     // },
        //     dispatcher: new Agent({
        //         connect: {
        //             cert: fs.readFileSync('/Users/goran/code/secret/pro2win1-nopwd/client.pem'),
        //             key: fs.readFileSync('/Users/goran/code/secret/pro2win1-nopwd/client_key.pem'),
        //             ca: fs.readFileSync('/Users/goran/code/secret/pro2win1-nopwd/root.pem'),
        //         },
        //     }),
        // });

        const r = response.status;




        // const httpsAgent = new https.Agent({
        //     // rejectUnauthorized: globals.config.get('Butler.configQRS.rejectUnauthorized'),
        //     // rejectUnauthorized: false,
        //     rejectUnauthorized: false,
        //     cert: fs.readFileSync('/Users/goran/code/secret/pro2win1-nopwd/client.pem'),
        //     key: fs.readFileSync('/Users/goran/code/secret/pro2win1-nopwd/client_key.pem'),
        //     // ca: fs.readFileSync('/Users/goran/code/secret/pro2win1-nopwd/root.pem'),

        //     // cert: fs.readFileSync('/Users/goran/parallels_sync/pro2-win2.lab.ptarmiganlabs.net/client.pem'),
        //     // key: fs.readFileSync('/Users/goran/parallels_sync/pro2-win2.lab.ptarmiganlabs.net/client_key.pem'),
        //     // ca: fs.readFileSync('/Users/goran/parallels_sync/pro2-win2.lab.ptarmiganlabs.net/root.pem'),
        //     // cert: globals.configQRS.cert,
        //     // key: globals.configQRS.key,
        //     // ca: globals.configQRS.ca,

        //     // passphrase: '',
        // });

        // const axiosConfig = {
        //     // url: `/qrs/custompropertydefinition/full?filter=objectTypes eq 'ReloadTask'&xrfkey=abcdefghijklmnop`,
        //     url: `/qrs/about`,
        //     params: {
        //         xrfkey: 'abcdefghijklmnop',
        //     },
        //     method: 'get',
        //     // baseURL: `https://${globals.configQRS.host}:${globals.configQRS.port}`,
        //     // baseURL: `https://192.168.100.109:4242`,
        //     baseURL: `https://pro2-win1.lab.ptarmiganlabs.net:4242`,
        //     headers: httpHeaders,
        //     timeout: 10000,
        //     responseType: 'json',
        //     httpsAgent,
        // };

        // const result = await axios.request(axiosConfig);






        // const cfg = {
        //     hostname: config.get('Butler.configQRS.host'),
        //     portNumber: 4242,
        //     certificates: {
        //         certFile: configQRS.certPaths.certPath,
        //         keyFile: configQRS.certPaths.keyPath,
        //         ca: configQRS.certPaths.caPath,
        //     },
        // };

        // cfg.headers = {
        //     'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
        // };

        // const qrsInstance = new QrsInteract(cfg);

        // Get info about the task
        try {
            logger.debug('GETRELOADTASKSCP: custompropertydefinition/full?filter=objectType eq ReloadTask');

            // const result = await qrsInstance.Get(`custompropertydefinition/full?filter=objectTypes eq 'ReloadTask'`);
            logger.debug(`GETRELOADTASKSCP: Got response: ${result.statusCode} for CP`);

            if (result.length > 0) {
                // At least one CP exists for reload tasks.
                return result;
            }

            // The task and/or the CP does not exist
            return [];
        } catch (err) {
            logger.error(`GETRELOADTASKSCP: Error while getting CP: ${err.message}`);
            return [];
        }
    } catch (err) {
        logger.error(`GETRELOADTASKSCP: Error while getting CP: ${err}`);

        // Log stack trace if log level is verbose, debug or silly
        const logLevel = globals.getLoggingLevel();
        if (logLevel === 'verbose' || logLevel === 'debug' || logLevel === 'silly') {
            logger.error(`GETRELOADTASKSCP: ${err.stack}`);
        }
        return false;
    }
}
