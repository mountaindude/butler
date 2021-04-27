/*eslint strict: ["error", "global"]*/
/*eslint no-invalid-this: "error"*/

'use strict';

// Load global variables and functions
var globals = require('../globals');
var qrsUtil = require('../qrs_util');
var logRESTCall = require('../lib/logRESTCall').logRESTCall;
const errors = require('restify-errors');
const enigma = require('enigma.js');
const SenseUtilities = require('enigma.js/sense-utilities');
const WebSocket = require('ws');
var fs = require('fs-extra');
const axios = require('axios');

// Set up enigma.js configuration
const qixSchema = require('enigma.js/schemas/' + globals.configEngine.engineVersion);

// Attach to existing app session, or create new session. 
// Connect using Proxy sesvice (QPS) - NOT directly to engine
function createSessionQPS(host, virtualProxy, sessionId, appId, userDirectory, userId) {
    
    if (sessionId == null || sessionId == undefined || sessionId == '') {
        // Don't attach to existing session. Create new one instead.

    } else {
        // Attach to existin schedule
    }

    // Via QPS
    const configEnigma = {
      schema: qixSchema,
      url: `https://${host}${virtualProxy}/app/${appId}/ttl/2`,
      createSocket: (url) =>
        new WebSocket(url, {
          cert: globals.configQPS.cert,
          key: globals.configQPS.key,
          headers: {
            'X-Qlik-User': `UserDirectory=${encodeURIComponent(userDirectory)};UserId=${encodeURIComponent(userId)}`,
            'Cookie':  virtualProxy.length > 0 ? `X-Qlik-Session-${virtualProxy}-HTTP=${sessionId}` : `X-Qlik-Session-HTTP=${sessionId}`,
          },
          rejectUnauthorized: false,
        }),
    };
  
    return enigma.create(configEnigma);
  }


/**
 * @swagger
 *
 * /v4/bookmarks/{appId}:
 *   get:
 *     description: |
 *       Get all bookmarks for an app
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: appId
 *         description: ID of Qlik Sense app
 *         in: path
 *         required: true
 *         type: string
 *         example: "210832b5-6174-4572-bd19-3e61eda675ef"
 *     responses:
 *       200:
 *         description: Bookmarks successfully retrieved
 *         schema:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               meta:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: Bookmark ID.
 *                     example: "210832b5-6174-4572-bd19-3e61eda675ef"
 *                   name:
 *                     type: string
 *                     description: Bookmark name.
 *                     example: "Weekly sales"
 *       409:
 *         description: Required parameter missing.
 *       500:
 *         description: Internal error.
 *
 */
module.exports.respondGET_bookmarksAppUser = async function (req, res, next) {
    logRESTCall(req);
    // TODO: Add app exists test. Return error if not.

    try {
        if (req.params.appId == undefined || req.query.userDirectory == undefined || req.query.userId == undefined) {
            // Required parameter is missing
            res.send(new errors.MissingParameterError({}, 'Required parameter missing'));
        } else {
            var session = createSessionQPS(globals.configQPS.host, globals.configQPS.virtualProxy, '', req.params.appId, req.query.userDirectory, req.query.userId);
            var global = await session.open();

            var engineVersion = await global.engineVersion();
            globals.logger.verbose(
                `BOOKMARK: Getting bookmarks for app ${req.params.appId} on host ${globals.configEngine.host}, engine version is ${engineVersion.qComponentVersion}.`,
            );

            var app = await global.openDoc(req.params.appId, '', '', '', false);

            // Create bookmark list
            // https://help.qlik.com/en-US/sense-developer/February2021/Subsystems/EngineAPI/Content/Sense_EngineAPI/WorkingWithAppsAndVisualizations/CreateSheets/list-app-objects.htm
            // https://help.qlik.com/en-US/sense-developer/February2021/Subsystems/EngineAPI/Content/Sense_EngineAPI/DiscoveringAndAnalysing/Bookmarks/get-layout-bookmark.htm
            var sessionObject = await app.createSessionObject({
                qInfo: {
                    qId: 'BL01',
                    qType: 'BookmarkList',
                },
                qBookmarkListDef: {
                    qType: 'bookmark',
                },
            });

            // Get bookmark list
            var bookmarkList = await sessionObject.getLayout();

            // Build result
            var result = bookmarkList.qBookmarkList.qItems.map(item => {
                return {
                    id: item.qInfo.qId,
                    title: item.qMeta.title,
                    description: item.qMeta.description,
                    createdDate: item.qMeta.createdDate,
                    modifiedDate: item.qMeta.modifiedDate,
                    published: item.qMeta.published,
                    publishTime: item.qMeta.publishTime,
                    approved: item.qMeta.approved,
                    owner: item.qMeta.owner,
                };
            });

            res.send(200, result);
            next();
        }
    } catch (err) {
        globals.logger.error(`BOOKMARK: Failed getting bookmarks for app: ${req.params.appId}, error is: ${JSON.stringify(err, null, 2)}`);
        res.send(new errors.InternalError({}, 'Failed getting bookmarks'));
        next();
    }
};



module.exports.respondPUT_applyBookmark = async function (req, res, next) {
    logRESTCall(req);
    // TODO: Add app exists test. Return error if not.

    try {
        let bookmarkInfo = req.body;
        if(bookmarkInfo.bookmarkId)
    } catch (err) {
        globals.logger.error(`BOOKMARK: Failed applying bookmark ${req.params.bookmarkId} for app: ${req.params.appId}, error is: ${JSON.stringify(err, null, 2)}`);
        res.send(new errors.InternalError({}, 'Failed getting bookmarks'));
        next();
    }
};
