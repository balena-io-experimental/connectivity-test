"use strict";
const sleep = require('await-sleep');
require('dotenv').config()
const { Client } = require('tplink-smarthome-api');
var resin = require('resin-sdk')({
	apiUrl: "https://api.resin.io/"
})
const sense = require("sense-hat-led").sync;
const request = require('request');

const useSenseHat = ( process.env.SENSEHAT )
if (useSenseHat) {
	console.log("SenseHat enabled")
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

async function sendWebNotification (url, value1, value2, value3) {
	return new Promise((resolve, reject) => {
		request.post({url: url, json: {value1: value1, value2: value2, value3: value3}}, function(err, res, body) {
			if (err) {
				reject
			} else {
				resolve(res)
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
const iftttURL = process.env.IFTTT_URL || false;
var myPlug;
var runNumber = 0;

async function setup() {
	try {
		myPlug = await client.getDevice({host: plugIP});
		await resin.auth.loginWithToken(authToken);
		testrun()
	} catch (err) {
		console.log('Bummer', err);
	}
}

async function testrun() {
	try {
		runNumber++;
		console.log(`Run #${runNumber}`);

		console.log("Turning plug off")
		await myPlug.setPowerState(false)
		await sleep(sleepTime)

		if (await resin.models.device.isOnline(testDevice)) {
			console.log("Device is online when it should be offline!")
			console.log("Turning on Wifi just in case")
			await myPlug.setPowerState(true)
			if (useSenseHat) {
				sense.setPixels(crossOut);
			}
			if (iftttURL) {
				await sendWebNotification(iftttURL, testDevice.slice(0, 7), "online when shouldn't", runNumber);
			}
			process.exit(1)
		} else {
			console.log("Device is offline properly.")
		}

		console.log("Turning plug on")
		await myPlug.setPowerState(true)
		await sleep(sleepTime)

		if (await resin.models.device.isOnline(testDevice)) {
			console.log("Device is online properly.")
		} else {
			console.log("Device is offline when it should be online!")
			if (useSenseHat) {
				sense.setPixels(crossOut);
			}
			if (iftttURL) {
				await sendWebNotification(iftttURL, testDevice.slice(0, 7), "offline when shouldn't", runNumber);
			}
			process.exit(2)
		}
		console.log("===================");
		// retun since things seem to work
		testrun()
	} catch (err) {
		console.log('Bummer', err);
		if (useSenseHat) {
			sense.setPixels(circle);
		}
		if (iftttURL) {
			await sendWebNotification(iftttURL, testDevice.slice(0, 7), 'general bummer', runNumber);
		}
		process.exit(3)
	}
}

setup()
