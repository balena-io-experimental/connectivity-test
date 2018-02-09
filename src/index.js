const sleep = require('await-sleep');
require('dotenv').config();
const { Client } = require('tplink-smarthome-api');
const resin = require('resin-sdk')({
    apiUrl: "https://api.resin.io/"
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

const client = new Client();

const sleepMinutes = parseInt(process.env.SLEEP_MINS) || 5;
const sleepTime = sleepMinutes * 60 * 1000; // 10 minutes
const authToken = process.env.AUTH_TOKEN || 'nope';
const testDevice = process.env.TEST_DEVICE;
console.log(`Testing: ${testDevice}`);
const plugIP = process.env.PLUG_IP;
var myPlug;
var runNumber = 0;

/**
 * Setup TP-Link Smart Plug
 *
 * @async
 * @function setup
 * @param {string} plug - The IP address of the TP-Link Smart Plug to use
 */
async function setup(plug) {
    try {
        myPlug = await client.getDevice({host: plug});
        await resin.auth.loginWithToken(authToken);
        testrun();
    } catch (err) {
        console.log('Pretest Bummer', err);
        if (useSenseHat) {
            sense.setPixels(circle);
        }
        if (useIFTTT) {
            await sendWebNotification(iftttURL, testDevice.slice(0, 7), 'cannot connect to smartplug', '0');
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
        await sleep(sleepTime);

        if (await resin.models.device.isOnline(testDevice)) {
            console.log("Device is online when it should be offline!");
            console.log("Turning on Wifi just in case");
            await myPlug.setPowerState(true);
            if (useSenseHat) {
                sense.setPixels(crossOut);
            }
            if (useIFTTT) {
                await sendWebNotification(iftttURL, testDevice.slice(0, 7), "online when shouldn't", runNumber);
            }
            process.exit(1)
        } else {
            console.log("Device is offline properly.");
        }

        console.log("Turning plug on");
        await myPlug.setPowerState(true);
        await sleep(sleepTime);

        if (await resin.models.device.isOnline(testDevice)) {
            console.log("Device is online properly.");
        } else {
            console.log("Device is offline when it should be online!")
            if (useSenseHat) {
                sense.setPixels(crossOut);
            }
            if (useIFTTT) {
                await sendWebNotification(iftttURL, testDevice.slice(0, 7), "offline when shouldn't", runNumber);
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
            await sendWebNotification(iftttURL, testDevice.slice(0, 7), 'general bummer', runNumber);
        }
        process.exit(3);
    }
};

// Start testing
setup(plugIP);
