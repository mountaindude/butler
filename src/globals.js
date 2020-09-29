var slack = require('node-slack');
var mqtt = require('mqtt');
const config = require('config');
var dgram = require('dgram');
var fs = require('fs-extra');
var dict = require('dict');
const path = require('path');
const Influx = require('influx');

const winston = require('winston');
require('winston-daily-rotate-file');

// Variable holding info about all defined schedules
var configSchedule = [];

// Get app version from package.json file
var appVersion = require('./package.json').version;

// Set up logger with timestamps and colors, and optional logging to disk file
const logTransports = [];

logTransports.push(
    new winston.transports.Console({
        name: 'console',
        level: config.get('Butler.logLevel'),
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
        ),
    }),
);

if (config.get('Butler.fileLogging')) {
    logTransports.push(
        new winston.transports.DailyRotateFile({
            dirname: path.join(__dirname, config.get('Butler.logDirectory')),
            filename: 'butler.%DATE%.log',
            level: config.get('Butler.logLevel'),
            datePattern: 'YYYY-MM-DD',
            maxFiles: '30d',
        }),
    );
}

const logger = winston.createLogger({
    transports: logTransports,
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
    ),
});

// Function to get current logging level
const getLoggingLevel = () => {
    return logTransports.find(transport => {
        return transport.name == 'console';
    }).level;
};

// Load our own libs
var qrsUtil = require('./qrsUtil');

// Helper function to read the contents of the certificate files:
// const readCert = filename => fs.readFileSync(path.resolve(__dirname, certificatesPath, filename));
const readCert = filename => fs.readFileSync(filename);

//  Engine config
var configEngine = {
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
const configQRS = {
    authentication: config.get('Butler.configQRS.authentication'),
    host: config.get('Butler.configQRS.host'),
    port: config.get('Butler.configQRS.port'),
    useSSL: config.get('Butler.configQRS.useSSL'),
    headerKey: config.get('Butler.configQRS.headerKey'),
    headerValue: config.get('Butler.configQRS.headerValue'),
    cert: readCert(config.get('Butler.cert.clientCert')),
    key: readCert(config.get('Butler.cert.clientCertKey')),
    ca: readCert(config.get('Butler.cert.clientCertCA')),
};

// ------------------------------------
// Slack config
var slackWebhookURL = config.get('Butler.slackConfig.webhookURL');
var slackLoginNotificationChannel = config.get('Butler.slackConfig.loginNotificationChannel');
var slackTaskFailureChannel = config.get('Butler.slackConfig.taskFailureChannel');

// Create Slack object
var slackObj = new slack(slackWebhookURL);

// ------------------------------------
// Data structures needed to keep track of currently active users/sessions
var currentUsers = dict();
var currentUsersPerServer = dict();

// ------------------------------------
// Create MQTT client object and connect to MQTT broker

var mqttOptions = {
    host: config.get('Butler.mqttConfig.brokerHost'),
    port: config.get('Butler.mqttConfig.brokerPort'),
};

var mqttClient = mqtt.connect(mqttOptions);
/*
Following might be needed for conecting to older Mosquitto versions
var mqttClient  = mqtt.connect('mqtt://<IP of MQTT server>', {
  protocolId: 'MQIsdp',
  protocolVersion: 3
});
*/

// ------------------------------------
// UDP server connection parameters
var udp_host = config.get('Butler.udpServerConfig.serverHost');

// Prepare to listen on port X for incoming UDP connections regarding session starting/stoping, or connection opening/closing
var udpServerSessionConnectionSocket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
});
var udp_port_session_connection = config.get('Butler.udpServerConfig.portSessionConnectionEvents');

// Prepare to listen on port Y for incoming UDP connections regarding failed tasks
var udpServerTaskFailureSocket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true,
});
var udp_port_take_failure = config.get('Butler.udpServerConfig.portTaskFailure');

// ------------------------------------
// Folder under which QVD folders are to be created
var qvdFolder = config.get('Butler.configDirectories.qvdPath');

// Set up InfluxDB
logger.info(`CONFIG: Influxdb enabled: ${config.get('Butler.uptimeMonitor.storeInInfluxdb.enable')}`);
logger.info(`CONFIG: Influxdb host IP: ${config.get('Butler.uptimeMonitor.storeInInfluxdb.hostIP')}`);
logger.info(`CONFIG: Influxdb host port: ${config.get('Butler.uptimeMonitor.storeInInfluxdb.hostPort')}`);
logger.info(`CONFIG: Influxdb db name: ${config.get('Butler.uptimeMonitor.storeInInfluxdb.dbName')}`);

// Set up Influxdb client
const influx = new Influx.InfluxDB({
    host: config.get('Butler.uptimeMonitor.storeInInfluxdb.hostIP'),
    port: `${config.has('Butler.uptimeMonitor.storeInInfluxdb.hostPort') ? config.get('Butler.uptimeMonitor.storeInInfluxdb.hostPort') : '8086'}`,
    database: config.get('Butler.uptimeMonitor.storeInInfluxdb.dbName'),
    username: `${config.get('Butler.uptimeMonitor.storeInInfluxdb.auth.enable') ? config.get('Butler.uptimeMonitor.storeInInfluxdb.auth.username') : ''}`,
    password: `${config.get('Butler.uptimeMonitor.storeInInfluxdb.auth.enable') ? config.get('Butler.uptimeMonitor.storeInInfluxdb.auth.password') : ''}`,
    schema: [
        {
            measurement: 'butler_memory_usage',
            fields: {
                heap_used: Influx.FieldType.FLOAT,
                heap_total: Influx.FieldType.FLOAT,
                process_memory: Influx.FieldType.FLOAT,
            },
            tags: ['butler_instance'],
        },
    ],
});

function initInfluxDB() {
    const dbName = config.get('Butler.uptimeMonitor.storeInInfluxdb.dbName');
    const enableInfluxdb = config.get('Butler.uptimeMonitor.storeInInfluxdb.enable');

    if (enableInfluxdb) {
        influx
            .getDatabaseNames()
            .then(names => {
                if (!names.includes(dbName)) {
                    influx
                        .createDatabase(dbName)
                        .then(() => {
                            logger.info(`CONFIG: Created new InfluxDB database: ${dbName}`);

                            const newPolicy = config.get('Butler.uptimeMonitor.storeInInfluxdb.retentionPolicy');

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
                                .catch(err => {
                                    logger.error(`CONFIG: Error creating new InfluxDB retention policy "${newPolicy.name}"! ${err.stack}`);
                                });
                        })
                        .catch(err => {
                            logger.error(`CONFIG: Error creating new InfluxDB database "${dbName}"! ${err.stack}`);
                        });
                } else {
                    logger.info(`CONFIG: Found InfluxDB database: ${dbName}`);
                }
            })
            .catch(err => {
                logger.error(`CONFIG: Error getting list of InfuxDB databases! ${err.stack}`);
            });
    }
}

module.exports = {
    config,
    qrsUtil,
    configEngine,
    configQRS,
    slackObj,
    slackLoginNotificationChannel,
    slackTaskFailureChannel,
    currentUsers,
    currentUsersPerServer,
    udpServerSessionConnectionSocket,
    udpServerTaskFailureSocket,
    udp_host,
    udp_port_session_connection,
    udp_port_take_failure,
    mqttClient,
    qvdFolder,
    logger,
    logTransports,
    appVersion,
    getLoggingLevel,
    configSchedule,
    initInfluxDB,
    influx
};
