const sleep = require('await-sleep');
require('dotenv').config();
const { Client } = require('tplink-smarthome-api');
var ping = require('ping');
const resin = require('balena-sdk')({
    apiUrl: "https://api.balena-cloud.com/"
});

// SenseHat is optional dependency
try {
    var sense = require("sense-hat-led").sync;
} catch (err) {
    sense = null;
}
// Request is optional dependency (for IFTTT)
try {
    var request = require('request');
} catch (err) {
    request = null;
}

const useSenseHat = (sense && process.env.SENSEHAT);
if (useSenseHat) {
    console.log("SenseHat enabled");
    sense.clear();
    var X = [255, 0, 0];  // Red
    var O = [0, 0, 0];  // Black

    var crossOut = [
        X, O, O, O, O, O, O, X,
        O, X, O, O, O, O, X, O,
        O, O, X, O, O, X, O, O,
        O, O, O, X, X, O, O, O,
        O, O, O, X, X, O, O, O,
        O, O, X, O, O, X, O, O,
        O, X, O, O, O, O, X, O,
        X, O, O, O, O, O, O, X
    ];
    var circle = [
        O, O, O, X, X, O, O, O,
        O, O, X, O, O, X, O, O,
        O, X, O, O, O, O, X, O,
        X, O, O, O, O, O, O, X,
        X, O, O, O, O, O, O, X,
        O, X, O, O, O, O, X, O,
        O, O, X, O, O, X, O, O,
        O, O, O, X, X, O, O, O
    ];
}

const iftttURL = process.env.IFTTT_URL || null;
const useIFTTT = (request && iftttURL);

/**
 * Send notification in the IFTTT format
 *
 * @async
 * @function sendWebNotification
 * @param {string} url - URL of the target IFTTT endpoint
 * @param {string} deviceID - device ID to pass on to the notification
 * @param {string} message - message to pass on to the notification
 * @param {number|string} run - run number to pass on to the notification
 * @return {Promise}
 */
async function sendWebNotification (url, deviceID, message, run) {
    return new Promise((resolve, reject) => {
        request.post({url: url, json: {value1: deviceID, value2: message, value3: run}}, function(err, res, body) {
            if (err) {
                reject;
            } else {
                resolve(res);
            }
        });
    })
}

/**
 * Check online status of a device, either through the resin.io API, or local ping
 *
 * @async
 * @function checkOnlineStatus
 * @param {string} device - device identified to t
 * @param {boolean} onResin - whether to do resin API check to determine online status
 * @return {Promise}
 */
async function checkOnlineStatus(device, onResin) {
    return new Promise((resolve, reject) => {
        if (onResin) {
            resin.models.device.isOnline(device).then(function (res) {
                resolve(res);
            })
        } else {
            ping.promise.probe(device).then(function (res) {
                resolve(res.alive);
            })
        }
    })
}


const client = new Client();

const sleepMinutes = parseInt(process.env.SLEEP_MINS) || 10;
const sleepTime = sleepMinutes * 60 * 1000;
const plugSleepMinutes = parseInt(process.env.PLUG_SLEEP_MINS) || 5;
const plugSleepTime = plugSleepMinutes * 60 * 1000;
const authToken = process.env.AUTH_TOKEN || 'nope';

// Test devices can be resin UUID, or local IP or name such as 'testdevice.local'
// We should be able to distinguish between them by checking whether the name has a `.` in it
const localPattern  =/\./i;
const testDevice = process.env.TEST_DEVICE;
const testDeviceResin = testDevice.match(localPattern) == null;
const testDeviceDisplayName = testDeviceResin ? testDevice.slice(0, 7) : testDevice;

console.log(`Testing: ${testDevice}`);
const plugIP = process.env.PLUG_IP;
var myPlug;
const plugIP2 = process.env.PLUG_IP2 || 'nope';
var myPlug2;
var runNumber = 0;

/**
 * Setup TP-Link Smart Plug
 *
 * @async
 * @function setup
 * @param {string} plug - The IP address of the TP-Link Smart Plug to use
 */
async function setup(plug, plug2) {
    try {
        myPlug = await client.getDevice({host: plug});
        if (plug2 !== 'nope') {
          myPlug2 = await client.getDevice({host: plug2});
        }
        await resin.auth.loginWithToken(authToken);

        if (await checkOnlineStatus(testDevice, testDeviceResin)) {
            console.log("Device is online properly, can get started.");
        } else {
            console.log("Device is offline at the start of the test, unexpected")
            if (useSenseHat) {
                sense.setPixels(circle);
            }
            if (useIFTTT) {
                await sendWebNotification(iftttURL, testDeviceDisplayName, "pre-start check failed", '0');
            }
            process.exit(4);
        }

        testrun();
    } catch (err) {
        console.log('Pretest Bummer', err);
        if (useSenseHat) {
            sense.setPixels(circle);
        }
        if (useIFTTT) {
            await sendWebNotification(iftttURL, testDeviceDisplayName, 'cannot connect to smartplug', '0');
        }
        process.exit(3);
    }
};

/**
 * Running a round of connectivity tests
 *
 * @async
 * @function testrun
 */
async function testrun() {
    try {
        runNumber++;
        console.log(`Run #${runNumber}`);

        console.log("Turning plug off");
        await myPlug.setPowerState(false);
        if (myPlug2) {
          console.log("Turning 2nd plug off");
          await myPlug2.setPowerState(false);
        }
        await sleep(sleepTime);

        if (await checkOnlineStatus(testDevice, testDeviceResin)) {
            console.log("Device is online when it should be offline!");
            console.log("Turning on plug(s) just in case");
            await myPlug.setPowerState(true);
            if (myPlug2) {
              await myPlug.setPowerState(true);
            }
            if (useSenseHat) {
                sense.setPixels(crossOut);
            }
            if (useIFTTT) {
                await sendWebNotification(iftttURL, testDeviceDisplayName, "online when shouldn't", runNumber);
            }
            process.exit(1)
        } else {
            console.log("Device is offline properly.");
        }

        console.log("Turning plug on");
        await myPlug.setPowerState(true);
        if (myPlug2) {
          await sleep(plugSleepTime);
          await myPlug.setPowerState(true);
        }
        await sleep(sleepTime);

        if (await checkOnlineStatus(testDevice, testDeviceResin)) {
            console.log("Device is online properly.");
        } else {
            console.log("Device is offline when it should be online!")
            if (useSenseHat) {
                sense.setPixels(crossOut);
            }
            if (useIFTTT) {
                await sendWebNotification(iftttURL, testDeviceDisplayName, "offline when shouldn't", runNumber);
            }
            process.exit(2);
        }
        console.log("===================");
        // retun since things seem to work
        testrun();
    } catch (err) {
        console.log('Bummer', err);
        if (useSenseHat) {
            sense.setPixels(circle);
        }
        if (useIFTTT) {
            await sendWebNotification(iftttURL, testDeviceDisplayName, 'general bummer', runNumber);
        }
        process.exit(3);
    }
};

// Start testing
setup(plugIP, plugIP2);
