const sleep = require('await-sleep');
require('dotenv').config()
const { Client } = require('tplink-smarthome-api');
var resin = require('resin-sdk')({
	apiUrl: "https://api.resin.io/"
})

const client = new Client();

const sleepMinutes = parseInt(process.env.SLEEP_MINS) || 10;
const sleepTime = sleepMinutes * 60 * 1000; // 10 minutes
const authToken = process.env.AUTH_TOKEN || 'nope';
const testDevice = process.env.TEST_DEVICE;
const plugIP = process.env.PLUG_IP;
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

		console.log(await resin.models.device.isOnline(testDevice))
		if (await resin.models.device.isOnline(testDevice)) {
			console.log("Device is online when it should be offline!")
			console.log("Turning on Wifi just in case")
			await myPlug.setPowerState(true)
			process.exit(1)
		} else {
			console.log("Device is offline properly.")
		}

		console.log("Turning plug on")
		await myPlug.setPowerState(true)
		await sleep(sleepTime)

		console.log(await resin.models.device.isOnline(testDevice))
		if (await resin.models.device.isOnline(testDevice)) {
			console.log("Device is online properly.")
		} else {
			console.log(await resin.models.device.isOnline(testDevice))
			console.log("Device is offline when it should be online!")
			process.exit(2)
		}
		console.log("===================");
		// retun since things seem to work
		testrun()
	} catch (err) {
		console.log('Bummer', err);
	}
}

setup()
