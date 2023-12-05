const os = require('os');
const crypto = require('crypto');
const fs = require('fs-extra');
const upath = require('upath');
const Influx = require('influx');
const { IncomingWebhook } = require('ms-teams-webhook');
const si = require('systeminformation');
const isUncPath = require('is-unc-path');
const winston = require('winston');

// Add dependencies
const { Command, Option } = require('commander');

require('winston-daily-rotate-file');

// Variable holding info about all defined schedules
const configSchedule = [];

// Variable to hold information about the computer where Butler is running
let hostInfo;

function checkFileExistsSync(filepath) {
    let flag = true;
    try {
        fs.accessSync(filepath, fs.constants.F_OK);
    } catch (e) {
        flag = false;
    }
    return flag;
}

// Get app version from package.json file
const appVersion = require('../package.json').version;

// Command line parameters
const program = new Command();
program
    .version(appVersion)
    .name('butler')
    .description(
        'Butler gives superpowers to client-managed Qlik Sense Enterprise on Windows!\nAdvanced reload failure alerts, task scheduler, key-value store, file system access and much more.'
    )
    .option('-c, --configfile <file>', 'path to config file')
    .addOption(new Option('-l, --loglevel <level>', 'log level').choices(['error', 'warn', 'info', 'verbose', 'debug', 'silly']))
    .option(
        '--new-relic-account-name  <name...>',
        'New Relic account name. Used within Butler to differentiate between different target New Relic accounts'
    )
    .option('--new-relic-api-key <key...>', 'insert API key to use with New Relic')
    .option('--new-relic-account-id <id...>', 'New Relic account ID')
    .option('--test-email-address <address>', 'send test email to this address. Used to verify email settings in the config file.')
    .option(
        '--test-email-from-address <address>',
        'send test email from this address. Only relevant when SMTP server allows from address to be set.'
    )
    .option('--no-qs-connection', "don't connect to Qlik Sense server at all. Run in isolated mode")
    .option('--api-rate-limit', 'set the API rate limit, per minute. Default is 100 calls/minute. Set to 0 to disable rate limiting.', 100);

// Parse command line params
program.parse(process.argv);
const options = program.opts();

// Is there a config file specified on the command line?
let configFileOption;
let configFileExpanded;
let configFilePath;
let configFileBasename;
let configFileExtension;
if (options.configfile && options.configfile.length > 0) {
    configFileOption = options.configfile;
    configFileExpanded = upath.resolve(options.configfile);
    configFilePath = upath.dirname(configFileExpanded);
    configFileExtension = upath.extname(configFileExpanded);
    configFileBasename = upath.basename(configFileExpanded, configFileExtension);

    if (configFileExtension.toLowerCase() !== '.yaml') {
        // eslint-disable-next-line no-console
        console.log('Error: Config file extension must be yaml');
        process.exit(1);
    }

    if (checkFileExistsSync(options.configfile)) {
        process.env.NODE_CONFIG_DIR = configFilePath;
        process.env.NODE_ENV = configFileBasename;
    } else {
        // eslint-disable-next-line no-console
        console.log('Error: Specified config file does not exist');
        process.exit(1);
    }
} else {
    // Get value of env variable NODE_ENV
    const env = process.env.NODE_ENV;

    // Get path to config file
    configFileExpanded = upath.resolve(__dirname, `./config/${env}.yaml`);
}

// Are we running as standalone app or not?
const isPkg = typeof process.pkg !== 'undefined';
if (isPkg && configFileOption === undefined) {
    // Show help if running as standalone app and mandatory options (e.g. config file) are not specified
    program.help({ error: true });
}

// eslint-disable-next-line import/order
const config = require('config');

// Are there New Relic account name(s), API key(s) and account ID(s) specified on the command line?
// There must be the same number of each specified!
// If so, replace any info from the config file with data from command line options
if (
    options?.newRelicAccountName?.length > 0 &&
    options?.newRelicApiKey?.length > 0 &&
    options?.newRelicAccountId?.length > 0 &&
    options?.newRelicAccountName?.length === options?.newRelicApiKey?.length &&
    options?.newRelicApiKey?.length === options?.newRelicAccountId?.length
) {
    config.Butler.thirdPartyToolsCredentials.newRelic = [];

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < options.newRelicApiKey.length; index++) {
        const accountName = options.newRelicAccountName[index];
        const accountId = options.newRelicAccountId[index];
        const insertApiKey = options.newRelicApiKey[index];

        config.Butler.thirdPartyToolsCredentials.newRelic.push({ accountName, accountId, insertApiKey });
    }
} else if (options?.newRelicAccountName?.length > 0 || options?.newRelicApiKey?.length > 0 || options?.newRelicAccountId?.length > 0) {
    // eslint-disable-next-line no-console
    console.log('\n\nIncorrect command line parameters: Number of New Relic account names/IDs/API keys must match. Exiting.');
    process.exit(1);
}

// Is there a log level file specified on the command line?
if (options.loglevel && options.loglevel.length > 0) {
    config.Butler.logLevel = options.loglevel;
}

// Set up logger with timestamps and colors, and optional logging to disk file
const logTransports = [];

logTransports.push(
    new winston.transports.Console({
        name: 'console',
        level: config.get('Butler.logLevel'),
        format: winston.format.combine(
            winston.format.errors({ stack: true }),
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
        ),
    })
);

// const execPath = isPkg ? upath.dirname(process.execPath) : __dirname;
const execPath = isPkg ? upath.dirname(process.execPath) : process.cwd();

if (config.Butler.logLevel === 'verbose' || config.Butler.logLevel === 'debug' || config.Butler.logLevel === 'silly') {
    // We don't have a logging object yet, so use plain console.log

    // Are we in a packaged app?
    if (isPkg) {
        // eslint-disable-next-line no-console
        console.log(`Running in packaged app. Executable path: ${execPath}`);
    } else {
        // eslint-disable-next-line no-console
        console.log(`Running in non-packaged environment. Executable path: ${execPath}`);
    }

    // eslint-disable-next-line no-console
    console.log(`Log file directory: ${upath.join(execPath, config.get('Butler.logDirectory'))}`);

    // eslint-disable-next-line no-console
    console.log(`upath.dirname(process.execPath): ${upath.dirname(process.execPath)}`);

    // eslint-disable-next-line no-console
    console.log(`process.cwd(): ${process.cwd()}`);
}

if (config.get('Butler.fileLogging')) {
    logTransports.push(
        new winston.transports.DailyRotateFile({
            dirname: upath.join(execPath, config.get('Butler.logDirectory')),
            filename: 'butler.%DATE%.log',
            level: config.get('Butler.logLevel'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
        })
    );
}

const logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
});

// Function to get current logging level
const getLoggingLevel = () => logTransports.find((transport) => transport.name === 'console').level;

// Are we running as standalone app or not?
logger.verbose(`Running as standalone app: ${isPkg}`);

// Verbose: Show what New Relic account names/API keys/account IDs have been defined (on command line or in config file)
logger.verbose(
    `New Relic account names/API keys/account IDs (via command line or config file): ${JSON.stringify(
        config.Butler.thirdPartyToolsCredentials.newRelic,
        null,
        2
    )}`
);

// Helper function to read the contents of the certificate files:
const readCert = (filename) => fs.readFileSync(filename);

const certPath = upath.resolve(__dirname, config.get('Butler.cert.clientCert'));
const keyPath = upath.resolve(__dirname, config.get('Butler.cert.clientCertKey'));
const caPath = upath.resolve(__dirname, config.get('Butler.cert.clientCertCA'));

let configEngine;
let configQRS;
if (config.has('Butler.restServerApiDocGenerate') === false || config.get('Butler.restServerApiDocGenerate') === false) {
    logger.debug('CONFIG: API doc mode=off');
    //  Engine config
    configEngine = {
        engineVersion: config.get('Butler.configEngine.engineVersion'),
        host: config.get('Butler.configEngine.host'),
        port: config.get('Butler.configEngine.port'),
        isSecure: config.get('Butler.configEngine.useSSL'),
        headers: config.get('Butler.configEngine.headers'),
        cert: readCert(config.get('Butler.cert.clientCert')),
        key: readCert(config.get('Butler.cert.clientCertKey')),
        rejectUnauthorized: config.get('Butler.configEngine.rejectUnauthorized'),
    };

    // QRS config
    configQRS = {
        authentication: config.get('Butler.configQRS.authentication'),
        host: config.get('Butler.configQRS.host'),
        port: config.get('Butler.configQRS.port'),
        useSSL: config.get('Butler.configQRS.useSSL'),
        headerKey: config.get('Butler.configQRS.headerKey'),
        headerValue: config.get('Butler.configQRS.headerValue'),
        rejectUnauthorized: config.get('Butler.configQRS.rejectUnauthorized'),
        cert: readCert(certPath),
        key: readCert(keyPath),
        ca: readCert(caPath),
        certPaths: {
            certPath,
            keyPath,
            caPath,
        },
    };
} else {
    logger.debug('CONFIG: API doc mode=on');
}

// MS Teams notification objects
let teamsTaskFailureObj;
let teamsTaskAbortedObj;
let teamsUserSessionObj;
let teamsServiceStoppedMonitorObj;
let teamsServiceStartedMonitorObj;

// ------------------------------------
// MS Teams reload task failed
if (
    config.has('Butler.teamsNotification.enable') &&
    config.has('Butler.teamsNotification.reloadTaskFailure.enable') &&
    config.get('Butler.teamsNotification.enable') === true &&
    config.get('Butler.teamsNotification.reloadTaskFailure.enable') === true
) {
    const webhookUrl = config.get('Butler.teamsNotification.reloadTaskFailure.webhookURL');

    // Create MS Teams object
    teamsTaskFailureObj = new IncomingWebhook(webhookUrl);
}

// MS Teams reload task aborted
if (
    config.has('Butler.teamsNotification.enable') &&
    config.has('Butler.teamsNotification.reloadTaskAborted.enable') &&
    config.get('Butler.teamsNotification.enable') === true &&
    config.get('Butler.teamsNotification.reloadTaskAborted.enable') === true
) {
    const webhookUrl = config.get('Butler.teamsNotification.reloadTaskAborted.webhookURL');

    // Create MS Teams object
    teamsTaskAbortedObj = new IncomingWebhook(webhookUrl);
}

// MS Teams service started/stopped
if (
    config.has('Butler.teamsNotification.enable') &&
    config.has('Butler.serviceMonitor.alertDestination.teams.enable') &&
    config.get('Butler.teamsNotification.enable') === true &&
    config.get('Butler.serviceMonitor.alertDestination.teams.enable') === true
) {
    // Create MS Teams objects
    // Service stopped
    let webhookUrl = config.get('Butler.teamsNotification.serviceStopped.webhookURL');
    teamsServiceStoppedMonitorObj = new IncomingWebhook(webhookUrl);

    // Service started
    webhookUrl = config.get('Butler.teamsNotification.serviceStarted.webhookURL');
    teamsServiceStartedMonitorObj = new IncomingWebhook(webhookUrl);
}

// ------------------------------------
// UDP server connection parameters
const udpHost = config.get('Butler.udpServerConfig.serverHost');

let udpServerReloadTaskSocket = null;
// Prepare to listen on port Y for incoming UDP connections regarding failed tasks
// const udpServerReloadTaskSocket = dgram.createSocket({
//     type: 'udp4',
//     reuseAddr: true,
// });
const udpPortTaskFailure = config.get('Butler.udpServerConfig.portTaskFailure');

// Folder under which QVD folders are to be created
const qvdFolder = config.get('Butler.configDirectories.qvdPath');

// Variables to hold info on what directories are approved for file system operations via Butler's REST API
const fileCopyDirectories = [];
const fileMoveDirectories = [];
const fileDeleteDirectories = [];

// Create list of enabled API endpoints
const endpointsEnabled = [];

const getEnabledApiEndpoints = (obj) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null) {
            // Sub-object
            getEnabledApiEndpoints(value);
        }

        if (value === true) {
            endpointsEnabled.push(key);
        }
    }
};

if (config.has('Butler.restServerEndpointsEnable')) {
    const endpoints = config.get('Butler.restServerEndpointsEnable');
    getEnabledApiEndpoints(endpoints);
}

logger.info(`Enabled API endpoints: ${JSON.stringify(endpointsEnabled, null, 2)}`);

// Set up InfluxDB
logger.info(`CONFIG: Influxdb enabled: ${config.get('Butler.influxDb.enable')}`);
logger.info(`CONFIG: Influxdb host IP: ${config.get('Butler.influxDb.hostIP')}`);
logger.info(`CONFIG: Influxdb host port: ${config.get('Butler.influxDb.hostPort')}`);
logger.info(`CONFIG: Influxdb db name: ${config.get('Butler.influxDb.dbName')}`);

// Set up Influxdb client
let influx = null;
if (config.get('Butler.influxDb.enable')) {
    influx = new Influx.InfluxDB({
        host: config.get('Butler.influxDb.hostIP'),
        port: `${config.has('Butler.influxDb.hostPort') ? config.get('Butler.influxDb.hostPort') : '8086'}`,
        database: config.get('Butler.influxDb.dbName'),
        username: `${config.get('Butler.influxDb.auth.enable') ? config.get('Butler.influxDb.auth.username') : ''}`,
        password: `${config.get('Butler.influxDb.auth.enable') ? config.get('Butler.influxDb.auth.password') : ''}`,
        schema: [
            {
                measurement: 'butler_memory_usage',
                fields: {
                    heap_used: Influx.FieldType.FLOAT,
                    heap_total: Influx.FieldType.FLOAT,
                    external: Influx.FieldType.FLOAT,
                    process_memory: Influx.FieldType.FLOAT,
                },
                tags: ['butler_instance'],
            },
            {
                measurement: 'win_service_state',
                fields: {
                    state_num: Influx.FieldType.INTEGER,
                    state_text: Influx.FieldType.STRING,
                    startup_mode_num: Influx.FieldType.INTEGER,
                    startup_mode_text: Influx.FieldType.STRING,
                },
                tags: ['butler_instance', 'host', 'service_name', 'display_name', 'friendly_name'],
            },
        ],
    });
}

function initInfluxDB() {
    const dbName = config.get('Butler.influxDb.dbName');
    const enableInfluxdb = config.get('Butler.influxDb.enable');

    if (enableInfluxdb) {
        influx
            .getDatabaseNames()
            .then((names) => {
                if (!names.includes(dbName)) {
                    influx
                        .createDatabase(dbName)
                        .then(() => {
                            logger.info(`CONFIG: Created new InfluxDB database: ${dbName}`);

                            const newPolicy = config.get('Butler.influxDb.retentionPolicy');

                            // Create new default retention policy
                            influx
                                .createRetentionPolicy(newPolicy.name, {
                                    database: dbName,
                                    duration: newPolicy.duration,
                                    replication: 1,
                                    isDefault: true,
                                })
                                .then(() => {
                                    logger.info(`CONFIG: Created new InfluxDB retention policy: ${newPolicy.name}`);
                                })
                                .catch((err) => {
                                    logger.error(`CONFIG: Error creating new InfluxDB retention policy "${newPolicy.name}"! ${err.stack}`);
                                });
                        })
                        .catch((err) => {
                            logger.error(`CONFIG: Error creating new InfluxDB database "${dbName}"! ${err.stack}`);
                        });
                } else {
                    logger.info(`CONFIG: Found InfluxDB database: ${dbName}`);
                }
            })
            .catch((err) => {
                logger.error(`CONFIG: Error getting list of InfuxDB databases! ${err.stack}`);
            });
    } else {
        logger.info('CONFIG: InfluxDB disabled, not connecting to InfluxDB');
    }
}

async function loadApprovedDirectories() {
    try {
        // Load approved fromDir and toDir for fileCopy operation
        if (config.has('Butler.fileCopyApprovedDirectories') && config.get('Butler.fileCopyApprovedDirectories') != null) {
            config.get('Butler.fileCopyApprovedDirectories').forEach((element) => {
                logger.verbose(`fileCopy directories from config file: ${JSON.stringify(element, null, 2)}`);

                // Check if Butler is running on Linux-ish host and UNC path(s) are specified
                // Warn if so
                if (hostInfo.si.os.platform.toLowerCase() !== 'windows') {
                    if (isUncPath(element.fromDirectory) === true) {
                        logger.warn(
                            `FILE COPY CONFIG: UNC paths won't work on non-Windows OSs ("${element.fromDirectory}"). OS is "${hostInfo.si.os.platform}".`
                        );
                    }
                    if (isUncPath(element.toDirectory) === true) {
                        logger.warn(
                            `FILE COPY CONFIG: UNC paths won't work on non-Windows OSs ("${element.toDirectory}"). OS is "${hostInfo.si.os.platform}".`
                        );
                    }
                }

                const newDirCombo = {
                    fromDir: upath.normalizeSafe(element.fromDirectory),
                    toDir: upath.normalizeSafe(element.toDirectory),
                };
                logger.verbose(`Adding normalized fileCopy directories ${JSON.stringify(newDirCombo, null, 2)}`);

                fileCopyDirectories.push(newDirCombo);
            });
        }

        // Load approved fromDir and toDir for fileMove operation
        if (config.has('Butler.fileMoveApprovedDirectories') && config.get('Butler.fileMoveApprovedDirectories') != null) {
            config.get('Butler.fileMoveApprovedDirectories').forEach((element) => {
                logger.verbose(`fileMove directories from config file: ${JSON.stringify(element, null, 2)}`);

                // Check if Butler is running on Linux-ish host and UNC path(s) are specified
                // Warn if so
                if (hostInfo.si.os.platform.toLowerCase() !== 'windows') {
                    if (isUncPath(element.fromDirectory) === true) {
                        logger.warn(
                            `FILE MOVE CONFIG: UNC paths won't work on non-Windows OSs ("${element.fromDirectory}"). OS is "${hostInfo.si.os.platform}".`
                        );
                    }
                    if (isUncPath(element.toDirectory) === true) {
                        logger.warn(
                            `FILE MOVE CONFIG: UNC paths won't work on non-Windows OSs ("${element.toDirectory}"). OS is "${hostInfo.si.os.platform}".`
                        );
                    }
                }

                const newDirCombo = {
                    fromDir: upath.normalizeSafe(element.fromDirectory),
                    toDir: upath.normalizeSafe(element.toDirectory),
                };

                logger.verbose(`Adding normalized fileMove directories ${JSON.stringify(newDirCombo, null, 2)}`);

                fileMoveDirectories.push(newDirCombo);
            });
        }

        // Load approved dir for fileDelete operation
        if (config.has('Butler.fileDeleteApprovedDirectories') && config.get('Butler.fileDeleteApprovedDirectories') != null) {
            config.get('Butler.fileDeleteApprovedDirectories').forEach((element) => {
                logger.verbose(`fileDelete directory from config file: ${element}`);

                // Check if Butler is running on Linux-ish host and UNC path(s) are specified
                // Warn if so
                if (hostInfo.si.os.platform.toLowerCase() !== 'windows') {
                    if (isUncPath(element) === true) {
                        logger.warn(
                            `FILE DELETE CONFIG: UNC paths won't work on non-Windows OSs ("${element}"). OS is "${hostInfo.si.os.platform}".`
                        );
                    }
                }

                const deleteDir = upath.normalizeSafe(element);
                logger.verbose(`Adding normalized fileDelete directory ${deleteDir}`);

                fileDeleteDirectories.push(deleteDir);
            });
        }
    } catch (err) {
        logger.error(`CONFIG: Getting approved directories: ${err}`);
    }
}

async function initHostInfo() {
    try {
        const siCPU = await si.cpu();
        const siSystem = await si.system();
        const siMem = await si.mem();
        const siOS = await si.osInfo();
        const siDocker = await si.dockerInfo();
        const siNetwork = await si.networkInterfaces();
        const siNetworkDefault = await si.networkInterfaceDefault();

        const defaultNetworkInterface = siNetworkDefault;

        // Get info about all available network interfaces
        const networkInterface = siNetwork.filter((item) => item.iface === defaultNetworkInterface);

        // Loop through all network interfaces, find the first one with a MAC address
        // and use that to generate a unique ID for this Butler instance
        let id = '';
        for (let i = 0; i < networkInterface.length; ) {
            if (networkInterface[i].mac !== '') {
                const idSrc = networkInterface[i].mac + networkInterface[i].ip4 + config.get('Butler.configQRS.host') + siSystem.uuid;
                const salt = networkInterface[i].mac;
                const hash = crypto.createHmac('sha256', salt);
                hash.update(idSrc);
                id = hash.digest('hex');
                break;
            }
            i += 1;
        }

        // If no MAC address was found, use either of
        // - siOS.serial
        // - siMem.total
        // - siOS.release
        // - siCPU.brand
        if (id === '') {
            let idSrc = '';
            if (siOS.serial !== '') {
                idSrc = siOS.serial + config.get('Butler.configQRS.host') + siSystem.uuid;
            } else if (siMem.total !== '') {
                idSrc = siMem.total + config.get('Butler.configQRS.host') + siSystem.uuid;
            } else if (siOS.release !== '') {
                idSrc = siOS.release + config.get('Butler.configQRS.host') + siSystem.uuid;
            } else if (siCPU.brand !== '') {
                idSrc = siCPU.brand + config.get('Butler.configQRS.host') + siSystem.uuid;
            } else {
                idSrc = config.get('Butler.configQRS.host') + siSystem.uuid;
            }
            const salt = siMem.total;
            const hash = crypto.createHmac('sha256', salt);
            hash.update(idSrc);
            id = hash.digest('hex');
        }

        // Warn if we couldn't create a unique ID
        if (id === '') {
            logger.warn('CONFIG: Could not create a unique ID for this Butler instance!');
        }

        hostInfo = {
            id,
            node: {
                nodeVersion: process.version,
                versions: process.versions,
            },
            os: {
                platform: os.platform(),
                release: os.release(),
                version: os.version(),
                arch: os.arch(),
                cpuCores: os.cpus().length,
                type: os.type(),
                totalmem: os.totalmem(),
            },
            si: {
                cpu: siCPU,
                system: siSystem,
                memory: {
                    total: siMem.total,
                },
                os: siOS,
                network: siNetwork,
                networkDefault: siNetworkDefault,
                docker: siDocker,
            },
        };

        return hostInfo;
    } catch (err) {
        logger.error(`CONFIG: Getting host info: ${err}`);
        return null;
    }
}

function sleep(ms) {
    // eslint-disable-next-line no-promise-executor-return
    return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
    config,
    configEngine,
    configFileExpanded,
    configQRS,
    teamsTaskFailureObj,
    teamsTaskAbortedObj,
    teamsUserSessionObj,
    teamsServiceStoppedMonitorObj,
    teamsServiceStartedMonitorObj,
    udpServerReloadTaskSocket,
    udpHost,
    udpPortTaskFailure,
    // mqttClient,
    qvdFolder,
    logger,
    logTransports,
    appVersion,
    getLoggingLevel,
    configSchedule,
    initInfluxDB,
    influx,
    fileCopyDirectories,
    fileMoveDirectories,
    fileDeleteDirectories,
    endpointsEnabled,
    loadApprovedDirectories,
    initHostInfo,
    hostInfo,
    isPkg,
    checkFileExistsSync,
    options,
    execPath,
    sleep,
};
