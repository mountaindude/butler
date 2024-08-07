import QrsInteract from 'qrs-interact';
import yaml from 'js-yaml';
import { getReloadTasksCustomProperties } from '../../qrs_util/task_cp_util.js';

// Veriify InfluxDb related settings in the config file
export const configFileInfluxDbAssert = async (config, configQRS, logger) => {
    // ------------------------------------------
    // The custom property specified by
    // Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName
    // should be present on reload tasks in the Qlik Sense server

    // Only test if the feature in question is enabled in the config file
    if (
        config.get('Butler.influxDb.reloadTaskSuccess.byCustomProperty.enable') === true &&
        config.has('Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName') &&
        config.has('Butler.influxDb.reloadTaskSuccess.byCustomProperty.enabledValue')
    ) {
        // Get custom property values
        try {
            const res1 = await getReloadTasksCustomProperties(config, configQRS, logger);
            logger.debug(`ASSERT CONFIG INFLUXDB: The following custom properties are available for reload tasks: ${res1}`);

            // CEnsure that the CP name specified in the config file is found in the list of available CPs
            // CP name is case sensitive and found in the "name" property of the CP object
            if (
                res1.findIndex((cp) => cp.name === config.get('Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName')) ===
                -1
            ) {
                logger.error(
                    `ASSERT CONFIG INFLUXDB: Custom property '${config.get(
                        'Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName',
                    )}' not found in Qlik Sense. Aborting.`,
                );
                return false;
            }

            // Ensure that the CP value specified in the config file is found in the list of available CP values
            // CP value is case sensitive and found in the "choiceValues" array of the CP objects in res1
            const res2 = res1.filter(
                (cp) => cp.name === config.get('Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName'),
            )[0].choiceValues;
            logger.debug(
                `ASSERT CONFIG INFLUXDB: The following values are available for custom property '${config.get(
                    'Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName',
                )}': ${res2}`,
            );

            if (
                res2.findIndex((cpValue) => cpValue === config.get('Butler.influxDb.reloadTaskSuccess.byCustomProperty.enabledValue')) ===
                -1
            ) {
                logger.error(
                    `ASSERT CONFIG INFLUXDB: Custom property value '${config.get(
                        'Butler.influxDb.reloadTaskSuccess.byCustomProperty.enabledValue',
                    )}' not found for custom property '${config.get(
                        'Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName',
                    )}'. Aborting.`,
                );
                return false;
            }
        } catch (err) {
            logger.error(`ASSERT CONFIG INFLUXDB: ${err}`);
        }
    }
    return true;
};

/**
 * Verify New Relic settings in the config file
 */
export const configFileNewRelicAssert = async (config, configQRS, logger) => {
    // Set up shared Sense repository service configuration
    const cfg = {
        hostname: config.get('Butler.configQRS.host'),
        portNumber: 4242,
        certificates: {
            certFile: configQRS.certPaths.certPath,
            keyFile: configQRS.certPaths.keyPath,
        },
    };

    cfg.headers = {
        'X-Qlik-User': 'UserDirectory=Internal; UserId=sa_repository',
    };

    const qrsInstance = new QrsInteract(cfg);

    // ------------------------------------------
    // The custom property specified by
    // Butler.incidentToo.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName
    // should only include values present in the Butler.thirdPartyToolsCredentials.newRelic array

    // Only test if the feature in question is enabled in the config file
    if (
        config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.enable') &&
        config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.enable') &&
        config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName')
    ) {
        // Get custom property values
        try {
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: Custom property name: ${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );

            const result1 = await qrsInstance.Get(
                `custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                )}'`,
            );

            // The choice values of the custom property should match the values in Butler.thirdPartyToolsCredentials.newRelic

            // If the custom property doesn't exist that's a problem..
            if (result1.body.length === 0) {
                logger.error(
                    `ASSERT CONFIG NEW RELIC: Custom property specified in config file ('${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                    )})' does not exist in Qlik Sense. Aborting.`,
                );
                return false;
            }

            // If there are no choiceValues that's a problem..
            if (
                result1.body[0].choiceValues === undefined ||
                result1.body[0].choiceValues === null ||
                result1.body[0].choiceValues.length === 0
            ) {
                logger.warn(
                    `ASSERT CONFIG NEW RELIC: Custom property '${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                    )}' does not have any values associated with it. New Relic monitoring may not work as a result of this.`,
                );
            } else if (config.get('Butler.thirdPartyToolsCredentials.newRelic') === null) {
                // New Relic account specified as destination for events, but no account(s) specified in config file or on command line
                logger.warn(
                    `ASSERT CONFIG NEW RELIC: New Relic is set as a destination for alert events, but no New Relic account(s) specified on either command line or in config file. Aborting,`,
                );
                return false;
            } else {
                // Test each custom property choice value for existence in Butler config file
                const availableNewRelicAccounts = config.get('Butler.thirdPartyToolsCredentials.newRelic');

                // eslint-disable-next-line no-restricted-syntax
                for (const value of result1.body[0].choiceValues) {
                    if (availableNewRelicAccounts.findIndex((account) => value === account.accountName) === -1) {
                        logger.warn(
                            `ASSERT CONFIG NEW RELIC: New Relic account name '${value}' of custom property '${config.get(
                                'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                            )}' not found in Butler's config file`,
                        );
                    }
                }
            }
        } catch (err) {
            logger.error(`ASSERT CONFIG NEW RELIC: ${err}`);
        }
    } else {
        // eslint-disable-next-line no-lonely-if
        if (
            config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.enable') &&
            config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.enable') &&
            !config.has(
                'Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName',
            )
        ) {
            logger.error(
                `ASSERT CONFIG NEW RELIC: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName"`,
            );
            return false;
        }
    }

    // ------------------------------------------
    // The custom property specified by
    // Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName
    // should only include values present in the Butler.thirdPartyToolsCredentials.newRelic array

    // Only test if the feature in question is enabled in the config file
    if (
        config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.enable') &&
        config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.enable') &&
        config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName')
    ) {
        // Get custom property values
        try {
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: Custom property name: ${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );

            const result1 = await qrsInstance.Get(
                `custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                )}'`,
            );
            // The choice values of the custom property should match the values in Butler.thirdPartyToolsCredentials.newRelic

            // If the custom property doesn't exist that's a problem..
            if (result1.body.length === 0) {
                logger.error(
                    `ASSERT CONFIG NEW RELIC: Custom property specified in config file ('${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                    )})' does not exist in Qlik Sense. Aborting.`,
                );
                return false;
            }

            // If there are no choiceValues that's a problem..
            if (
                result1.body[0].choiceValues === undefined ||
                result1.body[0].choiceValues === null ||
                result1.body[0].choiceValues.length === 0
            ) {
                logger.warn(
                    `ASSERT CONFIG NEW RELIC: Custom property '${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                    )}' does not have any values associated with it. New Relic monitoring may not work as a result of this.`,
                );
            } else if (config.get('Butler.thirdPartyToolsCredentials.newRelic') === null) {
                // New Relic account specified as destination for events, but no account(s) specified in config file or on command line
                logger.error(
                    `ASSERT CONFIG NEW RELIC: New Relic is set as a destination for failed reload alert logs, but no New Relic account(s) specified on either command line or in config file. Aborting,`,
                );
                return false;
            } else {
                // Test each custom property choice value for existence in Butler config file
                const availableNewRelicAccounts = config.get('Butler.thirdPartyToolsCredentials.newRelic');

                // eslint-disable-next-line no-restricted-syntax
                for (const value of result1.body[0].choiceValues) {
                    if (availableNewRelicAccounts.findIndex((account) => value === account.accountName) === -1) {
                        logger.warn(
                            `ASSERT CONFIG NEW RELIC: New Relic account name '${value}' of custom property '${config.get(
                                'Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                            )}' not found in Butler's config file`,
                        );
                    }
                }
            }
        } catch (err) {
            logger.error(`ASSERT CONFIG NEW RELIC: ${err}`);
        }
    } else {
        // eslint-disable-next-line no-lonely-if
        if (
            config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.enable') &&
            config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.enable') &&
            !config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName')
        ) {
            logger.error(
                `ASSERT CONFIG NEW RELIC: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName"`,
            );
            return false;
        }
    }

    // ------------------------------------------
    // The custom property specified by
    // Butler.incidentToo.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName
    // should only include values present in the Butler.thirdPartyToolsCredentials.newRelic array

    // Only test if the feature in question is enabled in the config file
    if (
        config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.enable') &&
        config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.enable') &&
        config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName')
    ) {
        // Get custom property values
        try {
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: Custom property name: ${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );

            const result1 = await qrsInstance.Get(
                `custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                )}'`,
            );
            // The choice values of the custom property should match the values in Butler.thirdPartyToolsCredentials.newRelic

            // If the custom property doesn't exist that's a problem..
            if (result1.body.length === 0) {
                logger.error(
                    `ASSERT CONFIG NEW RELIC: Custom property specified in config file ('${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                    )})' does not exist in Qlik Sense. Aborting.`,
                );
                return false;
            }

            // If there are no choiceValues that's a problem..
            if (
                result1.body[0].choiceValues === undefined ||
                result1.body[0].choiceValues === null ||
                result1.body[0].choiceValues.length === 0
            ) {
                logger.warn(
                    `ASSERT CONFIG NEW RELIC: Custom property '${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                    )}' does not have any values associated with it. New Relic monitoring may not work as a result of this.`,
                );
            } else if (config.get('Butler.thirdPartyToolsCredentials.newRelic') === null) {
                // New Relic account specified as destination for events, but no account(s) specified in config file or on command line
                logger.warn(
                    `ASSERT CONFIG NEW RELIC: New Relic is set as a destination for alert events, but no New Relic account(s) specified on either command line or in config file. Aborting,`,
                );
                return false;
            } else {
                // Test each custom property choice value for existence in Butler config file
                const availableNewRelicAccounts = config.get('Butler.thirdPartyToolsCredentials.newRelic');

                // eslint-disable-next-line no-restricted-syntax
                for (const value of result1.body[0].choiceValues) {
                    if (availableNewRelicAccounts.findIndex((account) => value === account.accountName) === -1) {
                        logger.warn(
                            `ASSERT CONFIG NEW RELIC: New Relic account name '${value}' of custom property '${config.get(
                                'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
                            )}' not found in Butler's config file`,
                        );
                    }
                }
            }
        } catch (err) {
            logger.error(`ASSERT CONFIG NEW RELIC: ${err}`);
        }
    } else {
        // eslint-disable-next-line no-lonely-if
        if (
            config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.enable') &&
            config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.enable') &&
            !config.has(
                'Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName',
            )
        ) {
            logger.error(
                `ASSERT CONFIG NEW RELIC: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName"`,
            );
            return false;
        }
    }

    // ------------------------------------------
    // The custom property specified by
    // Butler.incidentToo.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName
    // should only include values present in the Butler.thirdPartyToolsCredentials.newRelic array

    // Only test if the feature in question is enabled in the config file
    if (
        config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.enable') &&
        config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.enable') &&
        config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName')
    ) {
        // Get custom property values
        try {
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: Custom property name: ${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );
            logger.debug(
                `ASSERT CONFIG NEW RELIC 1: custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                )}`,
            );

            const result1 = await qrsInstance.Get(
                `custompropertydefinition/full?filter=name eq '${config.get(
                    'Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                )}'`,
            );
            // The choice values of the custom property should match the values in Butler.thirdPartyToolsCredentials.newRelic

            // If the custom property doesn't exist that's a problem..
            if (result1.body.length === 0) {
                logger.error(
                    `ASSERT CONFIG NEW RELIC: Custom property specified in config file ('${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                    )})' does not exist in Qlik Sense. Aborting.`,
                );
                return false;
            }

            // If there are no choiceValues that's a problem..
            if (
                result1.body[0].choiceValues === undefined ||
                result1.body[0].choiceValues === null ||
                result1.body[0].choiceValues.length === 0
            ) {
                logger.warn(
                    `ASSERT CONFIG NEW RELIC: Custom property '${config.get(
                        'Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                    )}' does not have any values associated with it. New Relic monitoring may not work as a result of this.`,
                );
            } else if (config.get('Butler.thirdPartyToolsCredentials.newRelic') === null) {
                // New Relic account specified as destination for events, but no account(s) specified in config file or on command line
                logger.error(
                    `ASSERT CONFIG NEW RELIC: New Relic is set as a destination for aborted reload alert logs, but no New Relic account(s) specified on either command line or in config file. Aborting,`,
                );
                return false;
            } else {
                // Test each custom property choice value for existence in Butler config file
                const availableNewRelicAccounts = config.get('Butler.thirdPartyToolsCredentials.newRelic');

                // eslint-disable-next-line no-restricted-syntax
                for (const value of result1.body[0].choiceValues) {
                    if (availableNewRelicAccounts.findIndex((account) => value === account.accountName) === -1) {
                        logger.warn(
                            `ASSERT CONFIG NEW RELIC: New Relic account name '${value}' of custom property '${config.get(
                                'Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName',
                            )}' not found in Butler's config file`,
                        );
                    }
                }
            }
        } catch (err) {
            logger.error(`ASSERT CONFIG NEW RELIC: ${err}`);
        }
    } else {
        // eslint-disable-next-line no-lonely-if
        if (
            config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.enable') &&
            config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.enable') &&
            !config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName')
        ) {
            logger.error(
                `ASSERT CONFIG NEW RELIC: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName"`,
            );
            return false;
        }
    }

    return true;
};

// Function to verify that config file is valid YAML
export const configFileYamlAssert = async (configFile) => {
    try {
        const data = await yaml.load(configFile);
    } catch (err) {
        console.error(`ASSERT CONFIG: Config file is not valid YAML: ${err}`);
        return false;
    }

    return true;
};

// Function to verify that config variable have same structure as production.yaml file
export const configFileStructureAssert = async (config, logger) => {
    let configFileCorrect = true;

    if (!config.has('Butler.logLevel')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.logLevel"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.fileLogging')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.fileLogging"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.logDirectory')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.logDirectory"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.anonTelemetry')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.anonTelemetry"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.heartbeat.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.heartbeat.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.heartbeat.remoteURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.heartbeat.remoteURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.heartbeat.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.heartbeat.frequency"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.dockerHealthCheck.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.dockerHealthCheck.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.dockerHealthCheck.port')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.dockerHealthCheck.port"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.frequency"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.logLevel')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.logLevel"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeInInfluxdb.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeInInfluxdb.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeNewRelic.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeNewRelic.destinationAccount')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.destinationAccount"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeNewRelic.url')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.url"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.uptimeMonitor.storeNewRelic.header array are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.uptimeMonitor.storeNewRelic.header')) {
        const headers = config.get('Butler.uptimeMonitor.storeNewRelic.header');

        if (headers) {
            if (!Array.isArray(headers)) {
                logger.error('ASSERT CONFIG: "Butler.uptimeMonitor.storeNewRelic.header" is not an array');
                configFileCorrect = false;
            } else {
                headers.forEach((header, index) => {
                    if (typeof header !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.uptimeMonitor.storeNewRelic.header[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(header, 'name')) {
                            logger.error(`ASSERT CONFIG: Missing "name" property in "Butler.uptimeMonitor.storeNewRelic.header[${index}]"`);
                            configFileCorrect = false;
                        } else if (typeof header.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.uptimeMonitor.storeNewRelic.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(header, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.uptimeMonitor.storeNewRelic.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.uptimeMonitor.storeNewRelic.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.header"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeNewRelic.metric.dynamic.butlerMemoryUsage.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.metric.dynamic.butlerMemoryUsage.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeNewRelic.metric.dynamic.butlerUptime.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.metric.dynamic.butlerUptime.enable"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.uptimeMonitor.storeNewRelic.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }

    if (config.has('Butler.uptimeMonitor.storeNewRelic.attribute.static')) {
        const staticAttributes = config.get('Butler.uptimeMonitor.storeNewRelic.attribute.static');

        if (staticAttributes) {
            if (!Array.isArray(staticAttributes)) {
                logger.error('ASSERT CONFIG: "Butler.uptimeMonitor.storeNewRelic.attribute.static" is not an array');
                configFileCorrect = false;
            } else {
                staticAttributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.uptimeMonitor.storeNewRelic.attribute.static[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.uptimeMonitor.storeNewRelic.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.uptimeMonitor.storeNewRelic.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.uptimeMonitor.storeNewRelic.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.uptimeMonitor.storeNewRelic.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.attribute.static"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.uptimeMonitor.storeNewRelic.attribute.dynamic.butlerVersion.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.uptimeMonitor.storeNewRelic.attribute.dynamic.butlerVersion.enable"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.thirdPartyToolsCredentials.newRelic are objects with the following properties:
    // {
    //     accountName: 'string',
    //     insertApiKey: 'string'
    //     accountId: 123456
    // }
    if (config.has('Butler.thirdPartyToolsCredentials.newRelic')) {
        const newRelicAccounts = config.get('Butler.thirdPartyToolsCredentials.newRelic');

        if (newRelicAccounts) {
            if (!Array.isArray(newRelicAccounts)) {
                logger.error('ASSERT CONFIG: "Butler.thirdPartyToolsCredentials.newRelic" is not an array');
                configFileCorrect = false;
            } else {
                newRelicAccounts.forEach((account, index) => {
                    if (typeof account !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.thirdPartyToolsCredentials.newRelic[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(account, 'accountName')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "accountName" property in "Butler.thirdPartyToolsCredentials.newRelic[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof account.accountName !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "accountName" property in "Butler.thirdPartyToolsCredentials.newRelic[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(account, 'insertApiKey')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "insertApiKey" property in "Butler.thirdPartyToolsCredentials.newRelic[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof account.insertApiKey !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "insertApiKey" property in "Butler.thirdPartyToolsCredentials.newRelic[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(account, 'accountId')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "accountId" property in "Butler.thirdPartyToolsCredentials.newRelic[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof account.accountId !== 'number') {
                            logger.error(
                                `ASSERT CONFIG: "accountId" property in "Butler.thirdPartyToolsCredentials.newRelic[${index}]" is not a number`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.thirdPartyToolsCredentials.newRelic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.hostIP')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.hostIP"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.hostPort')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.hostPort"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.auth.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.auth.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.auth.username')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.auth.username"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.auth.password')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.auth.password"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.dbName')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.dbName"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.instanceTag')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.instanceTag"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.retentionPolicy.name')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.retentionPolicy.name"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.retentionPolicy.duration')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.retentionPolicy.duration"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskFailure.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskFailure.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskFailure.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskFailure.tailScriptLogLines"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.influxDb.reloadTaskFailure.tag.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.influxDb.reloadTaskFailure.tag.static')) {
        const tagsStatic = config.get('Butler.influxDb.reloadTaskFailure.tag.static');

        if (tagsStatic) {
            if (!Array.isArray(tagsStatic)) {
                logger.error('ASSERT CONFIG: "Butler.influxDb.reloadTaskFailure.tag.static" is not an array');
                configFileCorrect = false;
            } else {
                tagsStatic.forEach((tag, index) => {
                    if (typeof tag !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.influxDb.reloadTaskFailure.tag.static[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(tag, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.influxDb.reloadTaskFailure.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.influxDb.reloadTaskFailure.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(tag, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.influxDb.reloadTaskFailure.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.influxDb.reloadTaskFailure.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskFailure.tag.static"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskFailure.tag.dynamic.useAppTags')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskFailure.tag.dynamic.useAppTags"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskFailure.tag.dynamic.useTaskTags')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskFailure.tag.dynamic.useTaskTags"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.allReloadTasks.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.allReloadTasks.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.byCustomProperty.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.byCustomProperty.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.byCustomProperty.customPropertyName"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.byCustomProperty.enabledValue')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.byCustomProperty.enabledValue"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.influxDb.reloadTaskSuccess.tag.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.influxDb.reloadTaskSuccess.tag.static')) {
        const tagsStatic = config.get('Butler.influxDb.reloadTaskSuccess.tag.static');

        if (tagsStatic) {
            if (!Array.isArray(tagsStatic)) {
                logger.error('ASSERT CONFIG: "Butler.influxDb.reloadTaskSuccess.tag.static" is not an array');
                configFileCorrect = false;
            } else {
                tagsStatic.forEach((tag, index) => {
                    if (typeof tag !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.influxDb.reloadTaskSuccess.tag.static[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(tag, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.influxDb.reloadTaskSuccess.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.influxDb.reloadTaskSuccess.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(tag, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.influxDb.reloadTaskSuccess.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.influxDb.reloadTaskSuccess.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.tag.static"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.tag.dynamic.useAppTags')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.tag.dynamic.useAppTags"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.influxDb.reloadTaskSuccess.tag.dynamic.useTaskTags')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.influxDb.reloadTaskSuccess.tag.dynamic.useTaskTags"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.scriptLog.storeOnDisk.reloadTaskFailure.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.scriptLog.storeOnDisk.reloadTaskFailure.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.scriptLog.storeOnDisk.reloadTaskFailure.logDirectory')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.scriptLog.storeOnDisk.reloadTaskFailure.logDirectory"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseUrls.qmc')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseUrls.qmc"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseUrls.hub')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseUrls.hub"');
        configFileCorrect = false;
    }

    // Qlik Sense version monitoring
    if (!config.has('Butler.qlikSenseVersion.versionMonitor.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseVersion.versionMonitor.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseVersion.versionMonitor.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseVersion.versionMonitor.frequency"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseVersion.versionMonitor.host')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseVersion.versionMonitor.host"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseVersion.versionMonitor.rejectUnauthorized')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseVersion.versionMonitor.rejectUnauthorized"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseVersion.versionMonitor.destination.influxDb.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.enabled"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static')) {
        const tagsStatic = config.get('Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static');

        if (tagsStatic) {
            if (!Array.isArray(tagsStatic)) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static" is not an array');
                configFileCorrect = false;
            } else {
                tagsStatic.forEach((tag, index) => {
                    if (typeof tag !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(tag, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(tag, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseVersion.versionMonitor.destination.influxDb.enabled"');
        configFileCorrect = false;
    }

    // Qlik Sense server license monitoring
    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.frequency"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.alert.thresholdDays')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.alert.thresholdDays"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.enabled"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static')) {
        const tagsStatic = config.get('Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static');

        if (tagsStatic) {
            if (!Array.isArray(tagsStatic)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                tagsStatic.forEach((tag, index) => {
                    if (typeof tag !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(tag, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(tag, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.influxDb.tag.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.mqtt.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.mqtt.enabled"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.mqtt.sendRecurring.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.mqtt.sendRecurring.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.mqtt.sendAlert.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.mqtt.sendAlert.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.webhook.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.webhook.enabled"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.webhook.sendRecurring.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.webhook.sendRecurring.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.serverLicenseMonitor.destination.webhook.sendAlert.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.serverLicenseMonitor.destination.webhook.sendAlert.enable"',
        );
        configFileCorrect = false;
    }

    // Qlik Sense access license monitoring
    if (!config.has('Butler.qlikSenseLicense.licenseMonitor.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseMonitor.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseMonitor.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseMonitor.frequency"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.enabled"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static')) {
        const tagsStatic = config.get('Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static');

        if (tagsStatic) {
            if (!Array.isArray(tagsStatic)) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static" is not an array');
                configFileCorrect = false;
            } else {
                tagsStatic.forEach((tag, index) => {
                    if (typeof tag !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(tag, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(tag, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseMonitor.destination.influxDb.enabled"');
        configFileCorrect = false;
    }

    // Release Qlik Sense licenses
    if (!config.has('Butler.qlikSenseLicense.licenseRelease.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.enable"');
        configFileCorrect = false;
    }

    // License release dry run
    if (!config.has('Butler.qlikSenseLicense.licenseRelease.dryRun')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.dryRun"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseRelease.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.frequency"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.qlikSenseLicense.licenseRelease.neverRelease.user are objects with the following properties:
    // {
    //     userDir: 'string'
    //     userId: 'string',
    // }
    if (config.has('Butler.qlikSenseLicense.licenseRelease.neverRelease.user')) {
        const neverReleaseUsers = config.get('Butler.qlikSenseLicense.licenseRelease.neverRelease.user');

        if (neverReleaseUsers) {
            if (!Array.isArray(neverReleaseUsers)) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.user" is not an array');
                configFileCorrect = false;
            } else {
                neverReleaseUsers.forEach((user, index) => {
                    if (typeof user !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.user[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(user, 'userId')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "userId" property in "Butler.qlikSenseLicense.licenseRelease.neverRelease.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.userId !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "userId" property in "Butler.qlikSenseLicense.licenseRelease.neverRelease.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(user, 'userDir')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "userDir" property in "Butler.qlikSenseLicense.licenseRelease.neverRelease.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.userDir !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "userDir" property in "Butler.qlikSenseLicense.licenseRelease.neverRelease.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.neverRelease.user"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.qlikSenseLicense.licenseRelease.neverRelease.tag objects with the following properties:
    // - 'string'
    if (config.has('Butler.qlikSenseLicense.licenseRelease.neverRelease.tag')) {
        const neverReleaseTags = config.get('Butler.qlikSenseLicense.licenseRelease.neverRelease.tag');

        if (neverReleaseTags) {
            if (!Array.isArray(neverReleaseTags)) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.tag" is not an array');
                configFileCorrect = false;
            } else {
                neverReleaseTags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.tag[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.neverRelease.tag"');
        configFileCorrect = false;
    }

    // The custom properties specified in the Butler.qlikSenseLicense.licenseRelease.neverRelease.customProperty array
    // should meet the following requirements:
    // - Each array item should be an object with the following properties:
    //   {
    //       name: 'string',
    //       value: 'string'
    //   }

    // Make sure all entries in Butler.qlikSenseLicense.licenseRelease.neverRelease.userDirectory objects with the following properties:
    // - 'string'
    if (config.has('Butler.qlikSenseLicense.licenseRelease.neverRelease.userDirectory')) {
        const neverReleaseUserDirectories = config.get('Butler.qlikSenseLicense.licenseRelease.neverRelease.userDirectory');

        if (neverReleaseUserDirectories) {
            if (!Array.isArray(neverReleaseUserDirectories)) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.userDirectory" is not an array');
                configFileCorrect = false;
            } else {
                neverReleaseUserDirectories.forEach((userDirectory, index) => {
                    if (typeof userDirectory !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.userDirectory[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.neverRelease.userDirectory"');
        configFileCorrect = false;
    }

    // Make sure the value of Butler.qlikSenseLicense.licenseRelease.neverRelease.inactive meets the following requirements:
    // - Value is either Yes or No
    // - Disregard case
    if (config.has('Butler.qlikSenseLicense.licenseRelease.neverRelease.inactive')) {
        const inactive = config.get('Butler.qlikSenseLicense.licenseRelease.neverRelease.inactive');

        if (inactive) {
            if (typeof inactive !== 'string') {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.inactive" is not a string');
                configFileCorrect = false;
            } else if (!['yes', 'no', 'ignore'].includes(inactive.toLowerCase())) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.inactive" must be either "Yes" or "No"');
                configFileCorrect = false;
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.neverRelease.inactive"');
        configFileCorrect = false;
    }

    // Make sure the value of Butler.qlikSenseLicense.licenseRelease.neverRelease.blocked meets the following requirements:
    // - Value is either Yes or No
    // - Disregard case
    if (config.has('Butler.qlikSenseLicense.licenseRelease.neverRelease.blocked')) {
        const blocked = config.get('Butler.qlikSenseLicense.licenseRelease.neverRelease.blocked');

        if (blocked) {
            if (typeof blocked !== 'string') {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.blocked" is not a string');
                configFileCorrect = false;
            } else if (!['yes', 'no', 'ignore'].includes(blocked.toLowerCase())) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.blocked" must be either "Yes" or "No"');
                configFileCorrect = false;
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.neverRelease.blocked"');
        configFileCorrect = false;
    }

    // Make sure the value of Butler.qlikSenseLicense.licenseRelease.neverRelease.removedExternally meets the following requirements:
    // - Value is either Yes or No
    // - Disregard case
    if (config.has('Butler.qlikSenseLicense.licenseRelease.neverRelease.removedExternally')) {
        const removedExternally = config.get('Butler.qlikSenseLicense.licenseRelease.neverRelease.removedExternally');

        if (removedExternally) {
            if (typeof removedExternally !== 'string') {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.removedExternally" is not a string');
                configFileCorrect = false;
            } else if (!['yes', 'no', 'ignore'].includes(removedExternally.toLowerCase())) {
                logger.error(
                    'ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.neverRelease.removedExternally" must be either "Yes" or "No"',
                );
                configFileCorrect = false;
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.neverRelease.removedExternally"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseRelease.licenseType.analyzer.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.licenseType.analyzer.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseRelease.licenseType.analyzer.releaseThresholdDays')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.licenseType.analyzer.releaseThresholdDays"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseRelease.licenseType.professional.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.licenseType.professional.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseRelease.licenseType.professional.releaseThresholdDays')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.licenseType.professional.releaseThresholdDays"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.qlikSenseLicense.licenseRelease.destination.influxDb.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.enable"');
        configFileCorrect = false;
    }

    if (config.has('Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static')) {
        const tagsStatic = config.get('Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static');

        if (tagsStatic) {
            if (!Array.isArray(tagsStatic)) {
                logger.error('ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static" is not an array');
                configFileCorrect = false;
            } else {
                tagsStatic.forEach((tag, index) => {
                    if (typeof tag !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(tag, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(tag, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof tag.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.qlikSenseLicense.licenseRelease.destination.influxDb.tag.static"');
        configFileCorrect = false;
    }

    // Teams notifications
    if (!config.has('Butler.teamsNotification.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.headScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.headScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.tailScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskFailure.templateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskFailure.templateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.headScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.headScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.reloadTaskAborted.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.reloadTaskAborted.tailScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStopped.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStopped.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStopped.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStopped.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStopped.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStopped.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStopped.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStopped.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStopped.templateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStopped.templateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStarted.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStarted.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStarted.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStarted.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStarted.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStarted.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStarted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStarted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.teamsNotification.serviceStarted.templateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.teamsNotification.serviceStarted.templateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.restMessage.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.restMessage.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.channel')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.channel"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.headScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.headScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.tailScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.templateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.templateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.fromUser')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.fromUser"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskFailure.iconEmoji')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskFailure.iconEmoji"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.channel')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.channel"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.headScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.headScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.tailScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.fromUser')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.fromUser"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.reloadTaskAborted.iconEmoji')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.reloadTaskAborted.iconEmoji"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.channel')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.channel"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.templateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.templateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.fromUser')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.fromUser"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStopped.iconEmoji')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStopped.iconEmoji"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.webhookURL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.webhookURL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.channel')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.channel"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.messageType')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.messageType"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.basicMsgTemplate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.basicMsgTemplate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.templateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.templateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.fromUser')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.fromUser"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.slackNotification.serviceStarted.iconEmoji')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.slackNotification.serviceStarted.iconEmoji"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.appOwnerAlert.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.includeAll')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.includeAll"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user are objects with the following properties:
    // {
    //     directory: 'string',
    //     userId: 'string'
    // }
    if (config.has('Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user')) {
        const users = config.get('Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user');

        if (users) {
            if (!Array.isArray(users)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user" is not an array');
                configFileCorrect = false;
            } else {
                users.forEach((user, index) => {
                    if (typeof user !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(user, 'directory')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "directory" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.directory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "directory" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(user, 'userId')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "userId" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.userId !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "userId" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.includeOwner.user"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user are objects with the following properties:
    // {
    //     directory: 'string',
    //     userId: 'string'
    // }
    if (config.has('Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user')) {
        const users = config.get('Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user');

        if (users) {
            if (!Array.isArray(users)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user" is not an array');
                configFileCorrect = false;
            } else {
                users.forEach((user, index) => {
                    if (typeof user !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(user, 'directory')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "directory" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.directory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "directory" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(user, 'userId')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "userId" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.userId !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "userId" property in "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.appOwnerAlert.excludeOwner.user"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.alertEnableByCustomProperty.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.alertEnableByCustomProperty.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.alertEnableByCustomProperty.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.alertEnableByCustomProperty.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.alertEnableByCustomProperty.enabledValue')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.alertEnableByCustomProperty.enabledValue"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.alertEnabledByEmailAddress.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.alertEnabledByEmailAddress.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.headScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.headScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.tailScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.priority')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.priority"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.subject')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.subject"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.bodyFileDirectory')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.bodyFileDirectory"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.htmlTemplateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.htmlTemplateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskAborted.fromAdress')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.fromAdress"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.reloadTaskAborted.recipients are objects with the following properties:
    // - 'string'
    if (config.has('Butler.emailNotification.reloadTaskAborted.recipients')) {
        const recipients = config.get('Butler.emailNotification.reloadTaskAborted.recipients');

        if (recipients) {
            if (!Array.isArray(recipients)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.reloadTaskAborted.recipients" is not an array');
                configFileCorrect = false;
            } else {
                recipients.forEach((recipient, index) => {
                    if (typeof recipient !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.emailNotification.reloadTaskAborted.recipients[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskAborted.recipients"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.appOwnerAlert.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.includeAll')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.includeAll"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user are objects with the following properties:
    // {
    //     directory: 'string',
    //     userId: 'string'
    // }
    if (config.has('Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user')) {
        const users = config.get('Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user');

        if (users) {
            if (!Array.isArray(users)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user" is not an array');
                configFileCorrect = false;
            } else {
                users.forEach((user, index) => {
                    if (typeof user !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(user, 'directory')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "directory" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.directory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "directory" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(user, 'userId')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "userId" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.userId !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "userId" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.includeOwner.user"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user are objects with the following properties:
    // {
    //     directory: 'string',
    //     userId: 'string'
    // }
    if (config.has('Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user')) {
        const users = config.get('Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user');

        if (users) {
            if (!Array.isArray(users)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user" is not an array');
                configFileCorrect = false;
            } else {
                users.forEach((user, index) => {
                    if (typeof user !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(user, 'directory')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "directory" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.directory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "directory" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(user, 'userId')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "userId" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof user.userId !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "userId" property in "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.appOwnerAlert.excludeOwner.user"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.alertEnableByCustomProperty.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.alertEnableByCustomProperty.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.alertEnableByCustomProperty.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.alertEnableByCustomProperty.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.alertEnableByCustomProperty.enabledValue')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.alertEnableByCustomProperty.enabledValue"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.alertEnabledByEmailAddress.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.alertEnabledByEmailAddress.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.headScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.headScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.tailScriptLogLines')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.tailScriptLogLines"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.priority')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.priority"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.subject')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.subject"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.bodyFileDirectory')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.bodyFileDirectory"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.htmlTemplateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.htmlTemplateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.reloadTaskFailure.fromAdress')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.fromAdress"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.reloadTaskFailure.recipients are objects with the following properties:
    // - 'string'
    if (config.has('Butler.emailNotification.reloadTaskFailure.recipients')) {
        const recipients = config.get('Butler.emailNotification.reloadTaskFailure.recipients');

        if (recipients) {
            if (!Array.isArray(recipients)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.reloadTaskFailure.recipients" is not an array');
                configFileCorrect = false;
            } else {
                recipients.forEach((recipient, index) => {
                    if (typeof recipient !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.emailNotification.reloadTaskFailure.recipients[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.reloadTaskFailure.recipients"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStopped.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStopped.priority')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.priority"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStopped.subject')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.subject"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStopped.bodyFileDirectory')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.bodyFileDirectory"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStopped.htmlTemplateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.htmlTemplateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStopped.fromAdress')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.fromAdress"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.serviceStopped.recipients are objects with the following properties:
    // - 'string'
    if (config.has('Butler.emailNotification.serviceStopped.recipients')) {
        const recipients = config.get('Butler.emailNotification.serviceStopped.recipients');

        if (recipients) {
            if (!Array.isArray(recipients)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.serviceStopped.recipients" is not an array');
                configFileCorrect = false;
            } else {
                recipients.forEach((recipient, index) => {
                    if (typeof recipient !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.emailNotification.serviceStopped.recipients[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStopped.recipients"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStarted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStarted.priority')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.priority"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStarted.subject')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.subject"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStarted.bodyFileDirectory')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.bodyFileDirectory"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStarted.htmlTemplateFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.htmlTemplateFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.serviceStarted.fromAdress')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.fromAdress"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.emailNotification.serviceStarted.recipients are objects with the following properties:
    // - 'string'
    if (config.has('Butler.emailNotification.serviceStarted.recipients')) {
        const recipients = config.get('Butler.emailNotification.serviceStarted.recipients');

        if (recipients) {
            if (!Array.isArray(recipients)) {
                logger.error('ASSERT CONFIG: "Butler.emailNotification.serviceStarted.recipients" is not an array');
                configFileCorrect = false;
            } else {
                recipients.forEach((recipient, index) => {
                    if (typeof recipient !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.emailNotification.serviceStarted.recipients[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.serviceStarted.recipients"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.host')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.host"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.port')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.port"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.secure')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.secure"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.tls.serverName')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.tls.serverName"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.tls.ignoreTLS')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.tls.ignoreTLS"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.tls.requireTLS')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.tls.requireTLS"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.tls.rejectUnauthorized')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.tls.rejectUnauthorized"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.auth.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.auth.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.auth.user')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.auth.user"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.emailNotification.smtp.auth.password')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.emailNotification.smtp.auth.password"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.url')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.url"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskFailure.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskFailure.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskFailure.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskFailure.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskFailure.serviceName')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskFailure.serviceName"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskFailure.severity')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskFailure.severity"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskFailure.includeApp.includeAll')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskFailure.includeApp.includeAll"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.signl4.reloadTaskFailure.includeApp.appId are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.signl4.reloadTaskFailure.includeApp.appId')) {
        const appIds = config.get('Butler.incidentTool.signl4.reloadTaskFailure.includeApp.appId');

        if (appIds) {
            if (!Array.isArray(appIds)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.signl4.reloadTaskFailure.includeApp.appId" is not an array');
                configFileCorrect = false;
            } else {
                appIds.forEach((appId, index) => {
                    if (typeof appId !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.signl4.reloadTaskFailure.includeApp.appId[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskFailure.includeApp.appId"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskAborted.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskAborted.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskAborted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskAborted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskAborted.serviceName')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskAborted.serviceName"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.signl4.reloadTaskAborted.severity')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.signl4.reloadTaskAborted.severity"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.enable"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.destinationAccount.event are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.destinationAccount.event')) {
        const destinationAccount = config.get('Butler.incidentTool.newRelic.destinationAccount.event');

        if (destinationAccount) {
            if (!Array.isArray(destinationAccount)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.newRelic.destinationAccount.event" is not an array');
                configFileCorrect = false;
            } else {
                destinationAccount.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.incidentTool.newRelic.destinationAccount.event[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.destinationAccount.event"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.destinationAccount.log are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.destinationAccount.log')) {
        const destinationAccount = config.get('Butler.incidentTool.newRelic.destinationAccount.log');

        if (destinationAccount) {
            if (!Array.isArray(destinationAccount)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.newRelic.destinationAccount.log" is not an array');
                configFileCorrect = false;
            } else {
                destinationAccount.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.incidentTool.newRelic.destinationAccount.log[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.destinationAccount.log"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.url.event')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.url.event"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.byCustomProperty.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.enable"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.account are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.account')) {
        const accounts = config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.account');

        if (accounts) {
            if (!Array.isArray(accounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.account" is not an array',
                );
                configFileCorrect = false;
            } else {
                accounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.account[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.sendToAccount.always.account"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.dynamic.useAppTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.dynamic.useAppTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.dynamic.useTaskTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.event.attribute.dynamic.useTaskTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.tailScriptLogLines')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.tailScriptLogLines"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.byCustomProperty.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.enable"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.account are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.account')) {
        const accounts = config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.account');

        if (accounts) {
            if (!Array.isArray(accounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.account" is not an array',
                );
                configFileCorrect = false;
            } else {
                accounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.account[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.sendToAccount.always.account"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.dynamic.useAppTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.dynamic.useAppTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.dynamic.useTaskTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.destination.log.attribute.dynamic.useTaskTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.rateLimit"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header')) {
        const headers = config.get('Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header');

        if (headers) {
            if (!Array.isArray(headers)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header" is not an array');
                configFileCorrect = false;
            } else {
                headers.forEach((header, index) => {
                    if (typeof header !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(header, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(header, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.header"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.attribute.static')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskFailure.sharedSettings.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.byCustomProperty.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.enable"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.account are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.account')) {
        const accounts = config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.account');

        if (accounts) {
            if (!Array.isArray(accounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.account" is not an array',
                );
                configFileCorrect = false;
            } else {
                accounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.account[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.sendToAccount.always.account"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.dynamic.useAppTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.dynamic.useAppTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.dynamic.useTaskTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.event.attribute.dynamic.useTaskTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.tailScriptLogLines')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.tailScriptLogLines"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.byCustomProperty.customPropertyName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.enable"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.account are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.account')) {
        const accounts = config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.account');

        if (accounts) {
            if (!Array.isArray(accounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.account" is not an array',
                );
                configFileCorrect = false;
            } else {
                accounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.account[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.sendToAccount.always.account"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.dynamic.useAppTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.dynamic.useAppTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.dynamic.useTaskTags')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.destination.log.attribute.dynamic.useTaskTags"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.rateLimit"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header')) {
        const headers = config.get('Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header');

        if (headers) {
            if (!Array.isArray(headers)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header" is not an array');
                configFileCorrect = false;
            } else {
                headers.forEach((header, index) => {
                    if (typeof header !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(header, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(header, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.header"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.reloadTaskAborted.sharedSettings.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.enable"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.serviceMonitor.destination.event.sendToAccount are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.sendToAccount')) {
        const accounts = config.get('Butler.incidentTool.newRelic.serviceMonitor.destination.event.sendToAccount');

        if (accounts) {
            if (!Array.isArray(accounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.event.sendToAccount" is not an array',
                );
                configFileCorrect = false;
            } else {
                accounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.event.sendToAccount[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.sendToAccount"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceHost')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceHost"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceDisplayName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceDisplayName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceState')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.event.attribute.dynamic.serviceState"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.enable"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.serviceMonitor.destination.log.sendToAccount are objects with the following properties:
    // - 'string'
    if (config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.sendToAccount')) {
        const accounts = config.get('Butler.incidentTool.newRelic.serviceMonitor.destination.log.sendToAccount');

        if (accounts) {
            if (!Array.isArray(accounts)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.log.sendToAccount" is not an array');
                configFileCorrect = false;
            } else {
                accounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.log.sendToAccount[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.sendToAccount"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceHost')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceHost"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceDisplayName')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceDisplayName"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceState')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.destination.log.attribute.dynamic.serviceState"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.monitorServiceState.running.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.monitorServiceState.running.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.monitorServiceState.stopped.enable')) {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.monitorServiceState.stopped.enable"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.rateLimit"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header')) {
        const headers = config.get('Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header');

        if (headers) {
            if (!Array.isArray(headers)) {
                logger.error('ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header" is not an array');
                configFileCorrect = false;
            } else {
                headers.forEach((header, index) => {
                    if (typeof header !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(header, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(header, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.header"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static')) {
        const attributes = config.get('Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.incidentTool.newRelic.serviceMonitor.sharedSettings.attribute.static"',
        );
        configFileCorrect = false;
    }

    // Butler.webhookNotification
    if (!config.has('Butler.webhookNotification.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.enable"');
        configFileCorrect = false;
    }

    // Butler.webhookNotification.reloadTaskFailure
    if (!config.has('Butler.webhookNotification.reloadTaskFailure.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.reloadTaskFailure.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.webhookNotification.reloadTaskFailure.webhooks')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.reloadTaskFailure.webhooks"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.webhookNotification.reloadTaskFailure.webhooks array are objects with the following properties:
    // {
    //     "description": "A description of the webhook",
    //     "webhookURL": "https://webhook.site/...",
    //     "httpMethod": "POST",
    //     "cert": {
    //         "enable": true,
    //         "rejectUnauthorized": true,
    //         "certCA": "/path/to/ca-cert.pem",
    //     },
    // }
    if (config.has('Butler.webhookNotification.reloadTaskFailure.webhooks')) {
        const webhooks = config.get('Butler.webhookNotification.reloadTaskFailure.webhooks');

        if (webhooks) {
            if (!Array.isArray(webhooks)) {
                logger.error('ASSERT CONFIG: "Butler.webhookNotification.reloadTaskFailure.webhooks" must be an array');
                configFileCorrect = false;
            } else {
                webhooks.forEach((webhook, index) => {
                    if (typeof webhook !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}]" must be an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'description')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "description" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'webhookURL')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "webhookURL" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'httpMethod')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "httpMethod" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'cert')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "cert" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof webhook.cert !== 'object') {
                            logger.error(
                                `ASSERT CONFIG: "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}].cert" must be an object`,
                            );
                            configFileCorrect = false;
                        } else {
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'enable')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "enable" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'rejectUnauthorized')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "rejectUnauthorized" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'certCA')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "certCA" in "Butler.webhookNotification.reloadTaskFailure.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.reloadTaskFailure.webhooks"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.webhookNotification.reloadTaskAborted.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.reloadTaskAborted.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.webhookNotification.reloadTaskAborted.webhooks')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.reloadTaskAborted.webhooks"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.webhookNotification.reloadTaskAborted.webhooks are objects with the following properties:
    // {
    //     "description": "A description of the webhook",
    //     "webhookURL": "https://webhook.site/...",
    //     "httpMethod": "POST",
    //     "cert": {
    //         "enable": true,
    //         "rejectUnauthorized": true,
    //         "certCA": "/path/to/ca-cert.pem",
    //     },
    // }
    if (config.has('Butler.webhookNotification.reloadTaskAborted.webhooks')) {
        const webhooks = config.get('Butler.webhookNotification.reloadTaskAborted.webhooks');
        // If there is one or more entries in Butler.webhookNotification.reloadTaskAborted.webhooks, verify that they are objects with the correct properties
        if (webhooks) {
            if (!Array.isArray(webhooks)) {
                logger.error('ASSERT CONFIG: "Butler.webhookNotification.reloadTaskAborted.webhooks" must be an array');
                configFileCorrect = false;
            } else {
                webhooks.forEach((webhook, index) => {
                    if (typeof webhook !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}]" must be an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'description')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "description" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'webhookURL')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "webhookURL" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'httpMethod')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "httpMethod" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'cert')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "cert" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof webhook.cert !== 'object') {
                            logger.error(
                                `ASSERT CONFIG: "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}].cert" must be an object`,
                            );
                            configFileCorrect = false;
                        } else {
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'enable')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "enable" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'rejectUnauthorized')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "rejectUnauthorized" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'certCA')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "certCA" in "Butler.webhookNotification.reloadTaskAborted.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.reloadTaskAborted.webhooks"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.webhookNotification.serviceMonitor.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.serviceMonitor.rateLimit"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.webhookNotification.serviceMonitor.webhooks')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.serviceMonitor.webhooks"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.webhookNotification.serviceMonitor.webhooks are objects with the following properties:
    // {
    //     "description": "A description of the webhook",
    //     "webhookURL": "https://webhook.site/...",
    //     "httpMethod": "POST",
    //     "cert": {
    //         "enable": true,
    //         "rejectUnauthorized": true,
    //         "certCA": "/path/to/ca-cert.pem",
    //     },
    // }
    if (config.has('Butler.webhookNotification.serviceMonitor.webhooks')) {
        const webhooks = config.get('Butler.webhookNotification.serviceMonitor.webhooks');

        if (webhooks) {
            if (!Array.isArray(webhooks)) {
                logger.error('ASSERT CONFIG: "Butler.webhookNotification.serviceMonitor.webhooks" must be an array');
                configFileCorrect = false;
            } else {
                webhooks.forEach((webhook, index) => {
                    if (typeof webhook !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.webhookNotification.serviceMonitor.webhooks[${index}]" must be an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'description')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "description" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'webhookURL')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "webhookURL" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'httpMethod')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "httpMethod" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'cert')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "cert" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof webhook.cert !== 'object') {
                            logger.error(
                                `ASSERT CONFIG: "Butler.webhookNotification.serviceMonitor.webhooks[${index}].cert" must be an object`,
                            );
                            configFileCorrect = false;
                        } else {
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'enable')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "enable" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'rejectUnauthorized')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "rejectUnauthorized" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'certCA')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "certCA" in "Butler.webhookNotification.serviceMonitor.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.serviceMonitor.webhooks"');
        configFileCorrect = false;
    }

    // Butler.webhookNotification.qlikSenseServerLicenseMonitor
    if (!config.has('Butler.webhookNotification.qlikSenseServerLicenseMonitor.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.qlikSenseServerLicenseMonitor.rateLimit"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks are objects with the following properties:
    // {
    //     "description": "A description of the webhook",
    //     "webhookURL": "https://webhook.site/...",
    //     "httpMethod": "POST",
    //     "cert": {
    //         "enable": true,
    //         "rejectUnauthorized": true,
    //         "certCA": "/path/to/ca-cert.pem",
    //     },
    // }
    if (config.has('Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks')) {
        const webhooks = config.get('Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks');

        if (webhooks) {
            if (!Array.isArray(webhooks)) {
                logger.error('ASSERT CONFIG: "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks" must be an array');
                configFileCorrect = false;
            } else {
                webhooks.forEach((webhook, index) => {
                    if (typeof webhook !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}]" must be an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'description')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "description" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'webhookURL')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "webhookURL" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'httpMethod')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "httpMethod" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'cert')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "cert" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof webhook.cert !== 'object') {
                            logger.error(
                                `ASSERT CONFIG: "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}].cert" must be an object`,
                            );
                            configFileCorrect = false;
                        } else {
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'enable')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "enable" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'rejectUnauthorized')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "rejectUnauthorized" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'certCA')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "certCA" in "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.qlikSenseServerLicenseMonitor.webhooks"');
        configFileCorrect = false;
    }

    // Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert
    if (!config.has('Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.rateLimit')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.rateLimit"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks are objects with the following properties:
    // {
    //     "description": "A description of the webhook",
    //     "webhookURL": "https://webhook.site/...",
    //     "httpMethod": "POST",
    //     "cert": {
    //         "enable": true,
    //         "rejectUnauthorized": true,
    //         "certCA": "/path/to/ca-cert.pem",
    //     },
    // }
    if (config.has('Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks')) {
        const webhooks = config.get('Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks');

        if (webhooks) {
            if (!Array.isArray(webhooks)) {
                logger.error('ASSERT CONFIG: "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks" must be an array');
                configFileCorrect = false;
            } else {
                webhooks.forEach((webhook, index) => {
                    if (typeof webhook !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}]" must be an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'description')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "description" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'webhookURL')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "webhookURL" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'httpMethod')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "httpMethod" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        }
                        if (!Object.prototype.hasOwnProperty.call(webhook, 'cert')) {
                            logger.error(
                                `ASSERT CONFIG: Missing property "cert" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof webhook.cert !== 'object') {
                            logger.error(
                                `ASSERT CONFIG: "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}].cert" must be an object`,
                            );
                            configFileCorrect = false;
                        } else {
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'enable')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "enable" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'rejectUnauthorized')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "rejectUnauthorized" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                            if (!Object.prototype.hasOwnProperty.call(webhook.cert, 'certCA')) {
                                logger.error(
                                    `ASSERT CONFIG: Missing property "certCA" in "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks[${index}].cert"`,
                                );
                                configFileCorrect = false;
                            }
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.webhookNotification.qlikSenseServerLicenseExpiryAlert.webhooks"');
        configFileCorrect = false;
    }

    // Butler.scheduler
    if (!config.has('Butler.scheduler.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.scheduler.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.scheduler.configfile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.scheduler.configfile"');
        configFileCorrect = false;
    }

    // Butler.mqttConfig
    if (!config.has('Butler.mqttConfig.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.brokerHost')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.brokerHost"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.brokerPort')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.brokerPort"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.azureEventGrid.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.azureEventGrid.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.azureEventGrid.clientId')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.azureEventGrid.clientId"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.azureEventGrid.clientCertFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.azureEventGrid.clientCertFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.azureEventGrid.clientKeyFile')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.azureEventGrid.clientKeyFile"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskFailureSendFull')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskFailureSendFull"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskAbortedSendFull')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskAbortedSendFull"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.subscriptionRootTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.subscriptionRootTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskStartTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskStartTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskFailureTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskFailureTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskFailureFullTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskFailureFullTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskAbortedTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskAbortedTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.taskAbortedFullTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.taskAbortedFullTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.serviceRunningTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.serviceRunningTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.serviceStoppedTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.serviceStoppedTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.serviceStatusTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.serviceStatusTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.qlikSenseServerLicenseTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.qlikSenseServerLicenseTopic"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.mqttConfig.qlikSenseServerLicenseExpireTopic')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.mqttConfig.qlikSenseServerLicenseExpireTopic"');
        configFileCorrect = false;
    }

    // Butler.udpServerConfig
    if (!config.has('Butler.udpServerConfig.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.udpServerConfig.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.udpServerConfig.serverHost')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.udpServerConfig.serverHost"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.udpServerConfig.portTaskFailure')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.udpServerConfig.portTaskFailure"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerConfig.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerConfig.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerConfig.serverHost')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerConfig.serverHost"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerConfig.serverPort')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerConfig.serverPort"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerConfig.backgroundServerPort')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerConfig.backgroundServerPort"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.fileCopyApprovedDirectories are objects with the following properties:
    // {
    //     fromDirectory: 'string',
    //     toDirectory: 'string'
    // }
    if (config.has('Butler.fileCopyApprovedDirectories')) {
        const directories = config.get('Butler.fileCopyApprovedDirectories');

        if (directories) {
            if (!Array.isArray(directories)) {
                logger.error('ASSERT CONFIG: "Butler.fileCopyApprovedDirectories" is not an array');
                configFileCorrect = false;
            } else {
                directories.forEach((directory, index) => {
                    if (typeof directory !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.fileCopyApprovedDirectories[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(directory, 'fromDirectory')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "fromDirectory" property in "Butler.fileCopyApprovedDirectories[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof directory.fromDirectory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "fromDirectory" property in "Butler.fileCopyApprovedDirectories[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(directory, 'toDirectory')) {
                            logger.error(`ASSERT CONFIG: Missing "toDirectory" property in "Butler.fileCopyApprovedDirectories[${index}]"`);
                            configFileCorrect = false;
                        } else if (typeof directory.toDirectory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "toDirectory" property in "Butler.fileCopyApprovedDirectories[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.fileCopyApprovedDirectories"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.fileMoveApprovedDirectories are objects with the following properties:
    // {
    //     fromDirectory: 'string',
    //     toDirectory: 'string'
    // }
    if (config.has('Butler.fileMoveApprovedDirectories')) {
        const directories = config.get('Butler.fileMoveApprovedDirectories');

        if (directories) {
            if (!Array.isArray(directories)) {
                logger.error('ASSERT CONFIG: "Butler.fileMoveApprovedDirectories" is not an array');
                configFileCorrect = false;
            } else {
                directories.forEach((directory, index) => {
                    if (typeof directory !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.fileMoveApprovedDirectories[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(directory, 'fromDirectory')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "fromDirectory" property in "Butler.fileMoveApprovedDirectories[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof directory.fromDirectory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "fromDirectory" property in "Butler.fileMoveApprovedDirectories[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(directory, 'toDirectory')) {
                            logger.error(`ASSERT CONFIG: Missing "toDirectory" property in "Butler.fileMoveApprovedDirectories[${index}]"`);
                            configFileCorrect = false;
                        } else if (typeof directory.toDirectory !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "toDirectory" property in "Butler.fileMoveApprovedDirectories[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.fileMoveApprovedDirectories"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.fileDeleteApprovedDirectories are objects with the following properties:
    // - name: 'string'
    if (config.has('Butler.fileDeleteApprovedDirectories')) {
        const directories = config.get('Butler.fileDeleteApprovedDirectories');

        if (directories) {
            if (!Array.isArray(directories)) {
                logger.error('ASSERT CONFIG: "Butler.fileDeleteApprovedDirectories" is not an array');
                configFileCorrect = false;
            } else {
                directories.forEach((directory, index) => {
                    if (typeof directory !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.fileDeleteApprovedDirectories[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.fileDeleteApprovedDirectories"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerApiDocGenerate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerApiDocGenerate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.apiListEnbledEndpoints')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.apiListEnbledEndpoints"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.base62ToBase16')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.base62ToBase16"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.base16ToBase62')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.base16ToBase62"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.butlerping')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.butlerping"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.createDir')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.createDir"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.createDirQVD')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.createDirQVD"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.fileDelete')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.fileDelete"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.fileMove')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.fileMove"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.fileCopy')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.fileCopy"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.keyValueStore')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.keyValueStore"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.mqttPublishMessage')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.mqttPublishMessage"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.newRelic.postNewRelicMetric')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.newRelic.postNewRelicMetric"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.newRelic.postNewRelicEvent')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.newRelic.postNewRelicEvent"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.createNewSchedule')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.createNewSchedule"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.getSchedule')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.getSchedule"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.getScheduleStatusAll')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.getScheduleStatusAll"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.updateSchedule')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.updateSchedule"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.deleteSchedule')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.deleteSchedule"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.startSchedule')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.startSchedule"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.scheduler.stopSchedule')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.scheduler.stopSchedule"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.senseAppReload')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.senseAppReload"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.senseAppDump')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.senseAppDump"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.senseListApps')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.senseListApps"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.senseStartTask')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.senseStartTask"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsEnable.slackPostMessage')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsEnable.slackPostMessage"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.destinationAccount are objects with the following properties:
    // - name: 'string'
    if (config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.destinationAccount')) {
        const destinationAccounts = config.get('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.destinationAccount');

        if (destinationAccounts) {
            if (!Array.isArray(destinationAccounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.destinationAccount" is not an array',
                );
                configFileCorrect = false;
            } else {
                destinationAccounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.destinationAccount[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.destinationAccount"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.url')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.url"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header')) {
        const headers = config.get('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header');

        if (headers) {
            if (!Array.isArray(headers)) {
                logger.error('ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header" is not an array');
                configFileCorrect = false;
            } else {
                headers.forEach((header, index) => {
                    if (typeof header !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(header, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(header, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.header"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static')) {
        const attributes = config.get('Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicMetric.attribute.static"',
        );
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.destinationAccount are objects with the following properties:
    // - name: 'string'
    if (config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.destinationAccount')) {
        const destinationAccounts = config.get('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.destinationAccount');

        if (destinationAccounts) {
            if (!Array.isArray(destinationAccounts)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.destinationAccount" is not an array',
                );
                configFileCorrect = false;
            } else {
                destinationAccounts.forEach((account, index) => {
                    if (typeof account !== 'string') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.destinationAccount[${index}]" is not a string`,
                        );
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.destinationAccount"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.url')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.url"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header')) {
        const headers = config.get('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header');

        if (headers) {
            if (!Array.isArray(headers)) {
                logger.error('ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header" is not an array');
                configFileCorrect = false;
            } else {
                headers.forEach((header, index) => {
                    if (typeof header !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(header, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(header, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof header.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.header"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static')) {
        const attributes = config.get('Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static');

        if (attributes) {
            if (!Array.isArray(attributes)) {
                logger.error(
                    'ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static" is not an array',
                );
                configFileCorrect = false;
            } else {
                attributes.forEach((attribute, index) => {
                    if (typeof attribute !== 'object') {
                        logger.error(
                            `ASSERT CONFIG: "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static[${index}]" is not an object`,
                        );
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(attribute, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(attribute, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof attribute.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error(
            'ASSERT CONFIG: Missing config file entry "Butler.restServerEndpointsConfig.newRelic.postNewRelicEvent.attribute.static"',
        );
        configFileCorrect = false;
    }

    if (!config.has('Butler.startTaskFilter.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.startTaskFilter.enable"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.startTaskFilter.allowTask.taskId are objects with the following properties:
    // - name: 'string'
    if (config.has('Butler.startTaskFilter.allowTask.taskId')) {
        const taskIds = config.get('Butler.startTaskFilter.allowTask.taskId');

        if (taskIds) {
            if (!Array.isArray(taskIds)) {
                logger.error('ASSERT CONFIG: "Butler.startTaskFilter.allowTask.taskId" is not an array');
                configFileCorrect = false;
            } else {
                taskIds.forEach((taskId, index) => {
                    if (typeof taskId !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.startTaskFilter.allowTask.taskId[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.startTaskFilter.allowTask.taskId"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.startTaskFilter.allowTask.tag are objects with the following properties:
    // - name: 'string'
    if (config.has('Butler.startTaskFilter.allowTask.tag')) {
        const tags = config.get('Butler.startTaskFilter.allowTask.tag');

        if (tags) {
            if (!Array.isArray(tags)) {
                logger.error('ASSERT CONFIG: "Butler.startTaskFilter.allowTask.tag" is not an array');
                configFileCorrect = false;
            } else {
                tags.forEach((tag, index) => {
                    if (typeof tag !== 'string') {
                        logger.error(`ASSERT CONFIG: "Butler.startTaskFilter.allowTask.tag[${index}]" is not a string`);
                        configFileCorrect = false;
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.startTaskFilter.allowTask.tag"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.startTaskFilter.allowTask.customProperty are objects with the following properties:
    // {
    //     name: 'string',
    //     value: 'string'
    // }
    if (config.has('Butler.startTaskFilter.allowTask.customProperty')) {
        const customProperties = config.get('Butler.startTaskFilter.allowTask.customProperty');

        if (customProperties) {
            if (!Array.isArray(customProperties)) {
                logger.error('ASSERT CONFIG: "Butler.startTaskFilter.allowTask.customProperty" is not an array');
                configFileCorrect = false;
            } else {
                customProperties.forEach((customProperty, index) => {
                    if (typeof customProperty !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.startTaskFilter.allowTask.customProperty[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(customProperty, 'name')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "name" property in "Butler.startTaskFilter.allowTask.customProperty[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof customProperty.name !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "name" property in "Butler.startTaskFilter.allowTask.customProperty[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(customProperty, 'value')) {
                            logger.error(
                                `ASSERT CONFIG: Missing "value" property in "Butler.startTaskFilter.allowTask.customProperty[${index}]"`,
                            );
                            configFileCorrect = false;
                        } else if (typeof customProperty.value !== 'string') {
                            logger.error(
                                `ASSERT CONFIG: "value" property in "Butler.startTaskFilter.allowTask.customProperty[${index}]" is not a string`,
                            );
                            configFileCorrect = false;
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.startTaskFilter.allowTask.customProperty"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.frequency')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.frequency"');
        configFileCorrect = false;
    }

    // Make sure all entries in Butler.serviceMonitor.monitor are objects with the following properties:
    // {
    //     host: 'string',
    //     services: {
    //         name: 'string',
    //         friendlyName: 'string',
    //      }
    // }
    if (config.has('Butler.serviceMonitor.monitor')) {
        const monitors = config.get('Butler.serviceMonitor.monitor');

        if (monitors) {
            if (!Array.isArray(monitors)) {
                logger.error('ASSERT CONFIG: "Butler.serviceMonitor.monitor" is not an array');
                configFileCorrect = false;
            } else {
                monitors.forEach((monitor, index) => {
                    if (typeof monitor !== 'object') {
                        logger.error(`ASSERT CONFIG: "Butler.serviceMonitor.monitor[${index}]" is not an object`);
                        configFileCorrect = false;
                    } else {
                        if (!Object.prototype.hasOwnProperty.call(monitor, 'host')) {
                            logger.error(`ASSERT CONFIG: Missing "host" property in "Butler.serviceMonitor.monitor[${index}]"`);
                            configFileCorrect = false;
                        } else if (typeof monitor.host !== 'string') {
                            logger.error(`ASSERT CONFIG: "host" property in "Butler.serviceMonitor.monitor[${index}]" is not a string`);
                            configFileCorrect = false;
                        }

                        if (!Object.prototype.hasOwnProperty.call(monitor, 'services')) {
                            logger.error(`ASSERT CONFIG: Missing "services" property in "Butler.serviceMonitor.monitor[${index}]"`);
                            configFileCorrect = false;
                        } else if (!Array.isArray(monitor.services)) {
                            logger.error(`ASSERT CONFIG: "services" property in "Butler.serviceMonitor.monitor[${index}]" is not an array`);
                            configFileCorrect = false;
                        } else {
                            monitor.services.forEach((service, serviceIndex) => {
                                if (typeof service !== 'object') {
                                    logger.error(
                                        `ASSERT CONFIG: "Butler.serviceMonitor.monitor[${index}].services[${serviceIndex}]" is not an object`,
                                    );
                                    configFileCorrect = false;
                                } else {
                                    if (!Object.prototype.hasOwnProperty.call(service, 'name')) {
                                        logger.error(
                                            `ASSERT CONFIG: Missing "name" property in "Butler.serviceMonitor.monitor[${index}].services[${serviceIndex}]"`,
                                        );
                                        configFileCorrect = false;
                                    } else if (typeof service.name !== 'string') {
                                        logger.error(
                                            `ASSERT CONFIG: "name" property in "Butler.serviceMonitor.monitor[${index}].services[${serviceIndex}]" is not a string`,
                                        );
                                        configFileCorrect = false;
                                    }

                                    if (!Object.prototype.hasOwnProperty.call(service, 'friendlyName')) {
                                        logger.error(
                                            `ASSERT CONFIG: Missing "friendlyName" property in "Butler.serviceMonitor.monitor[${index}].services[${serviceIndex}]"`,
                                        );
                                        configFileCorrect = false;
                                    } else if (typeof service.friendlyName !== 'string') {
                                        logger.error(
                                            `ASSERT CONFIG: "friendlyName" property in "Butler.serviceMonitor.monitor[${index}].services[${serviceIndex}]" is not a string`,
                                        );
                                        configFileCorrect = false;
                                    }
                                }
                            });
                        }
                    }
                });
            }
        }
    } else {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.monitor"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.influxDb.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.influxDb.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.newRelic.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.newRelic.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.email.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.email.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.mqtt.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.mqtt.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.teams.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.teams.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.slack.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.slack.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.serviceMonitor.alertDestination.webhook.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.serviceMonitor.alertDestination.webhook.enable"');
        configFileCorrect = false;
    }

    // Config visualisation setttings
    if (!config.has('Butler.configVisualisation.enable')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configVisualisation.enable"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configVisualisation.host')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configVisualisation.host"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configVisualisation.port')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configVisualisation.port"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configVisualisation.obfuscate')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configVisualisation.obfuscate"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.cert.clientCert')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.cert.clientCert"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.cert.clientCertKey')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.cert.clientCertKey"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.cert.clientCertCA')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.cert.clientCertCA"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configEngine.engineVersion')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configEngine.engineVersion"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configEngine.host')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configEngine.host"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configEngine.port')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configEngine.port"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configEngine.useSSL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configEngine.useSSL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configEngine.headers.X-Qlik-User')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configEngine.headers.X-Qlik-User"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configEngine.rejectUnauthorized')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configEngine.rejectUnauthorized"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.authentication')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.authentication"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.host')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.host"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.port')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.port"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.useSSL')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.useSSL"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.headerKey')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.headerKey"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.headerValue')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.headerValue"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configQRS.rejectUnauthorized')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configQRS.rejectUnauthorized"');
        configFileCorrect = false;
    }

    if (!config.has('Butler.configDirectories.qvdPath')) {
        logger.error('ASSERT CONFIG: Missing config file entry "Butler.configDirectories.qvdPath"');
        configFileCorrect = false;
    }

    return configFileCorrect;
};
