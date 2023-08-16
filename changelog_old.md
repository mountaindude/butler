# Change log

## 5.4.2

### New features

### Fixes and patches

* Switched to using GitHub actions for building linux/amd64 Docker images.

### Changed behavior and/or breaking changes

## 5.4.1

### New features

### Fixes and patches

* Updated dependencies to latest versions.

### Changed behavior and/or breaking changes

## 5.4.0

### New features

### Fixes and patches

* Fixed bug occuring when the start-task API was called with an empty PUT body. [#157](https://github.com/ptarmiganlabs/butler/issues/157)

* [Improved documentation](https://butler.ptarmiganlabs.com/docs/getting-started/setup/data-connections/) around the Sense data connections that Butler needs. [#160](https://github.com/ptarmiganlabs/butler/issues/160), [#156](https://github.com/ptarmiganlabs/butler/issues/156).

* Clarified that [Butler requires InfluxDB 1.x](https://butler.ptarmiganlabs.com/docs/getting-started/install/). InfluxDB 2.x is great, but bring breaking features wrt Butler. [#159](https://github.com/ptarmiganlabs/butler/issues/159).

### Changed behavior and/or breaking changes

## 5.3.0

### New features

1. Added REST API endpoint for getting a list of all keys that exist in a given key-value store namespace.
   Useful when you need to iterate over all KV pairs in a namespace. ([#150](https://github.com/ptarmiganlabs/butler/issues/150))

### Fixes and patches

1. The parsing of the YAML config file is now a bit more robust and tolerant for sections that have a header but no contents. ([#152](https://github.com/ptarmiganlabs/butler/issues/152))

### Changed behavior and/or breaking changes

## 5.2.0

### New features

1. It's now possible to include zero or more (i.e. optional) key-value pairs when starting QSEoW reload tasks using the [/v4/reloadtask/{taskId}/start](https://butler.ptarmiganlabs.com/docs/examples/openapi-docs/) REST endpoint. There are also helper subs available in the demo app included in the GitHub repository - as well as in the online docs at butler.ptarmiganlabs.com. ([#147](https://github.com/ptarmiganlabs/butler/issues/147), [#148](https://github.com/ptarmiganlabs/butler/issues/148))

### Fixes and patches

### Changed behavior and/or breaking changes

## 5.1.0

### New features

1. First version of **telemetry** added to Butler ([#142](https://github.com/ptarmiganlabs/butler/issues/142)).  
   More info [here](https://butler.ptarmiganlabs.com/docs/about/telemetry).

### Fixes and patches

1. Fixed minor issue when sending alert emails ([#143](https://github.com/ptarmiganlabs/butler/issues/143)).
2. Show high level system info when starting Butler ([#140](https://github.com/ptarmiganlabs/butler/issues/140)).
3. Don't waste memory when MQTT is not used ([#139](https://github.com/ptarmiganlabs/butler/issues/139)).
4. Refined documentation, fixed typos and updated dependencies. The usual stuff that comes with every release.

### Changed behavior and/or breaking changes

## 5.0.0

### New features

1. A new API endpoint `/v4/app/{appId}/reload` added. It is used to reload apps without having to go via a reload task.  
   The solution is based on [#117](https://github.com/ptarmiganlabs/butler/issues/117).  
   Both full and partial reloads are supported.  
   Regular Sense reload tasks can be triggered when the app reload succeeds or fails.
2. New API endpoints for listing all apps and dumping app metadata. ([#118](https://github.com/ptarmiganlabs/butler/issues/118)).  
   Those features have been available in Butler for many years, they just get a couple of new endpoints that follow Butler's current naming conventions better.
3. MQTT messages can now include full information about the reload task that failed or was aborted, rather than just the task name. A couple of new MQTT topics are used for these MQTT messages. [#128](https://github.com/ptarmiganlabs/butler/issues/128).
4. Notifications for failed and aborted tasks can now be sent as outgoing webhooks. [#129](https://github.com/ptarmiganlabs/butler/issues/129). The idea is to provide a generic way of getting task alerts to 3rd party systems that can't interact with Butler or Qlik Sense in any other way.
5. Automatically sending email notifications for failed and aborted tasks to app owners ([#105](https://github.com/ptarmiganlabs/butler/issues/105)). This will only work if the app owner has an email address available in the Qlik Sense user directory.
6. Make user session start/stop events available as MS Teams messages, just like they are in Slack. ([#122](https://github.com/ptarmiganlabs/butler/issues/122)).
7. Teams task fail/abort messages can now - optionally - use same templating concept that was previously available for emails. Better looking Teams alert messages thus! ([#124](https://github.com/ptarmiganlabs/butler/issues/124)).
8. Make host name (that the user session relates to) available in Slack session start/stop messages.([#123](https://github.com/ptarmiganlabs/butler/issues/123)).
9. Slack task fail/abort messages can now - optionally - use same templating concept that was previously available for emails. Better looking Slack alert messages thus! ([#120](https://github.com/ptarmiganlabs/butler/issues/120)).
10. Added rate limiting option for task fail/aborts sent to Slack and MS Teams. ([#119](https://github.com/ptarmiganlabs/butler/issues/119)).
11. Add MQTT message containing all available info about failed/aborted tasks. Format is stringified JSON. ([#128](https://github.com/ptarmiganlabs/butler/issues/128)).
12. Add exclude list to user activity events sent to Slack and MS Teams. Using this feature it's possible to prevent session start/stop etc notifications for specific users to be sent to Teams and Slack. Useful for example if a system account is used to do API calls - that probably should not be reported as user activity. ([#132](https://github.com/ptarmiganlabs/butler/issues/132)).
13. Improvements around handling of inbound MQTT messages. The root MQTT topic that Butler subscribes to is now configurable ([#137](https://github.com/ptarmiganlabs/butler/issues/137)). The topic through which Sense tasks can be started is now also configurable ([#136](https://github.com/ptarmiganlabs/butler/issues/136)) rather than hard coded.

### Fixes and patches

1. Lack of filtering in the custom log appender XML file used to catch user session events from the QSEoW log files resulted in Butler receiving too many session events (with spammy Slack notifications as a result, at least if Slack is enabled). Fixed in [#121](https://github.com/ptarmiganlabs/butler/issues/121). Now only session start and end events are forwarded to Butler. If more/less/other log messages should be captured this can be configured in the log appender xml files.

2. Updated dependencies. Staying as safe as possible!

3. Lots and lots of documentation additions, fixes and clarifications. Both in the source code and at [butler.ptarmiganlabs.com](https://butler.ptarmiganlabs.com).
4. Send individual alert emails to all recipients instead of a single one with everyone on cc (for both task failures and aborted tasks). [#130](https://github.com/ptarmiganlabs/butler/issues/130).

### Changed behavior and/or breaking changes

1. **BREAKING**: New config file settings `Butler.slackNotification.*` used to configure everything Slack related, including notifications for failed and aborted reload tasks, as well as user start/stop session reporting. ([#125](https://github.com/ptarmiganlabs/butler/issues/125)).

2. **BREAKING**: Related to 1 above. As part of improving Slack notifications for task reload failures, the `Butler.slackConfig.taskFailureChannel` config file setting has been split into two and moved to new locations in the config file: `Butler.slackNotification.reladTaskAborted.channel` and `Butler.slackNotification.reladTaskFailure.channel`.

3. **BREAKING**: Similar to 1 above, all MS Teams configuration has been moved from `Butler.teamsConfig.*` into the larger/more generic `Butler.teamsNotification.*` section of the config file.

4. UDP message format for user session start/stop log appender has changed to follow same principles as other log appender UDP messages sent to Butler. ([#126](https://github.com/ptarmiganlabs/butler/issues/126), [#134](https://github.com/ptarmiganlabs/butler/issues/134)).

## 4.3.0

### New features

- More/better/improved [concepts overview](https://butler.ptarmiganlabs.com/docs/concepts/) and [examples](https://butler.ptarmiganlabs.com/docs/examples/) on [butler.ptarmiganlabs.com](https://butler.ptarmiganlabs.com/). For example, that site now includes examples on how to move/copy/delete files using Butler.

### Fixes and patches

- Fixed a [bug](https://github.com/ptarmiganlabs/butler/issues/114) which prevented Sense reload tasks being started from Butler's REST API.

## 4.2.1

### New features

### Fixes and patches

- Dependencies updated to stay sharp and secure.

## 4.2.0

### New features

- Notifications by email when scheduled reload tasks fail. Notification email (both body and subject) are fully customizable using [Handlebars](https://handlebarsjs.com/guide/) templating syntax. [#92](https://github.com/ptarmiganlabs/butler/issues/92)
- Notification emails include data such as task execution details, customizable number of rows from beginning and end of the reload script log, email priority, support for most email providers and more. [#92](https://github.com/ptarmiganlabs/butler/issues/92)
- Email rate limits used to avoid spamming your inbox. [#92](https://github.com/ptarmiganlabs/butler/issues/92)
- Notifications by email, Slack, MS Teams and MQTT when reload tasks are **aborted** in QMC. Email notifications use Handlebars templating syntax. New config file properties control which Slack/Teams channel these notifications are sent to. [#93](https://github.com/ptarmiganlabs/butler/issues/93)
- Much improved documentation, especially in the [getting started/setup section of butler.ptarmiganlabs.com](https://butler.ptarmiganlabs.com/docs/getting-started/setup/).
- Include non-heap memory in server uptime logging. Also store this metric to InfluxDB. [#100](https://github.com/ptarmiganlabs/butler/issues/100).

### Fiexs and patches

- Refactored code that starts Qlik Sense reload tasks. [#101](https://github.com/ptarmiganlabs/butler/issues/101)

## 4.1.2

### New features

### Fixes and patches

- The included Sense demo app now correctly uses the Butler API endpoint used to start reload tasks.

## 4.1.1

### New features

### Fixes and patches

- API endpoint documentation for starting Sense reload tasks has been corrected.

### Breaking changes

None.

## 4.0.0

### New features

- Task scheduler ([#80](https://github.com/ptarmiganlabs/butler/issues/80))
- Key-value store ([#65](https://github.com/ptarmiganlabs/butler/issues/65))
- Swagger API docs ([#76](https://github.com/ptarmiganlabs/butler/issues/76))
- Move and delete files in the file system ([#84](https://github.com/ptarmiganlabs/butler/issues/84))
- Uptime logging, incl memory usage stored in Influx db for charting/monitoring in Grafana ([#82](https://github.com/ptarmiganlabs/butler/issues/82))
- Configurable Docker healthcheck ([#73](https://github.com/ptarmiganlabs/butler/issues/73))
- Added option to send task failure notifications to MS Teams ([#83](https://github.com/ptarmiganlabs/butler/issues/83))
- Updated dependencies (adresses security issues etc)

### Breaking changes

- http method changed for some API endpoints. This means that some API endpoints are now called in different ways compared to earlier Butler versions. The parameters have also changed in some cases ([#85](https://github.com/ptarmiganlabs/butler/issues/85)).
- API endpoint names are all lowercase (previously camelCase) ([#85](https://github.com/ptarmiganlabs/butler/issues/85)).
- Some keys in the main configuration have new names.
  For example, there was not a single way of using 'enable' vs 'enabled' keys:  
  The config file had both _Butler.heartbeat.enabled_, as well as _Butler.mqttConfig.enable_.
  Confusing - in v4 only _.enable_ is used.
- In the sample `production.yaml` config file, all features are now turned off by default. This is done for several reasons: Force a thorough review of the configuration file before Butler can be used (most problems arise from incorrect config files!), performance (fewer enabled features = less memory used) and Security (fewer enabled features = fewer potential security risks).

## 3.1.0

Stayin' alive: hearbeats are here.

1. Added user configurable heartbeat option. Butler can now (optionally) do http calls to a url, indicating it is alive and well. This is useful in enterprise settings, for use together with network monitoring tools etc.
2. Updated dependencies to their latest versions.

## 3.0.0

This version brings a general refresh of the tool, both in terms of updated dependencies, streamlined configuration settings and more up-to-date documentation.

1. **Breaking change** Streamline the names of configuration options in the production_template.yaml config file. This change however means that the config files for existing Butler environments need to be updated. Please refer to the [documentation site](https://ptarmiganlabs.github.io/butler/install-config/#config_file_syntax) file for info on the most recent config options.
2. Each REST API endpoint can be enabled/disabled. This is useful for deployment scarios when some endpoints for whatever reasons should not be available.
3. Much improved logging of requests to the REST API endpoints. Turning on verbose logging will output lots of info on the requests, including what IP address the request comes from.
4. Better error messages when connection to Sense server for some reason fails.

## 2.2

Support for running Butler as a Docker container is finally here.

While it is still possible to run Butler as a normal Node.js app, deploying Butler as a Docker container has many benefits:

-   No need to install Node.js on your server(s).
-   Make use of your existing Docker runtime environments, or use those offered by Amazon, Google, Microsoft etc.
-   Benefit from the extremely comprehensive tools ecosystem (monitoring, deployment etc) that is available for Docker.
-   Updating Butler to the latest version is as easy as doing a "docker pull ptarmiganlabs/butler:latest".

## 2.1

1. Switched to using YAML config files. JSON config files will still work, but YAML is superior when it comes to readability.
2. Updated to latest versions of modules that Butler uses.
3. Removed disk space REST endpoint. This was done due to difficulties in isntalling the Windows version of the library used to get disk metrics. A full Windows development environment was needed - but as this is typically not desirable on a production Windows server, this REST endpoint was removed.
4. Removed work-in-progress code for retrieving info from Github repositories. While still a good idea, such half-baked code should not be included in actual releases.
5. Improved handling of MQTT messages and MQTT related logging.
6. Added configuration option for setting MQTT broker's port.
7. Changed name of mqttConfig.brokerIP config option to be mqttConfig.brokerHost, to better align with other tools in the Butler family.
8. Switched to using Enigma.js for talking to the Qlik Sense engine.
9. Fixed some minor issues relating to posting messages to Slack.
10. Generally improved and more consistent formatting of the source code.
11. Refined udp_client tool with better help texts.

For information about earlier versions, please see the [releases page](https://github.com/ptarmiganlabs/butler/releases).
