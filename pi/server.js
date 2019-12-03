/*server.js*/
const fs = require('fs');
const url = require('url');
let requirejs = require('requirejs');
let request = require('request');
const readLastLines = require('read-last-lines');

// Firebase
let firebase = require('firebase-admin');
let serviceAccount = require("./lightfestival-firebase-adminsdk.json");
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://lightfestival.firebaseio.com"
});

let dmxOutput = [];
let incrementalDiff = [];
let transitionFinishDmx = [];

let numOfStepsLeft = 0;
let numOfSteps = 100;
let fadeStepsPerSec = 10;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.ico': 'image/x-icon',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/octet-stream',
    '.json': 'application/json',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

/**
 * send dmxOutput to ola every 100ms
 */
function sendRgbDmx() {
    // console.log("sending DMX update");

    let universe = 0;
    let url = 'http://localhost:9090/set_dmx';
    let data = "u=" + universe + "&d=" + dmxOutput.join(",");

//    require('request').debug = true

    let clientServerOptions = {
        uri: url,
        body: data,
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},

    };
    request(clientServerOptions, function (error, response) {
//        console.log(error,response);
        return;
    });
    setTimeout(sendRgbDmx, 100);
}


/**
 * Create the final dmx value array and start fade/ transition to it
 */
function runTransition(nextColor) {
    nextColor = JSON.parse(nextColor);
    console.log(`Fading to ${JSON.stringify(nextColor)}`);

    let startingDmx = dmxOutput.slice(0);
    let startingDmx2 = dmxOutput.slice(0);
    fullColor(nextColor, startingDmx);
    setTimeout(shiftColor, 11000, nextColor, startingDmx2);
}

/**
 * Fade all fixtures to this color
 * @param nextColor
 * @param startingDmx
 */
function fullColor(nextColor, startingDmx) {
    let settings = JSON.parse(fs.readFileSync("settings.json"));
    transitionFinishDmx = startingDmx;

    // set all the running lights to next color
    let fixtures = settings.rgbchannels;
    for (let i = 0; i < fixtures.length; i++) {
        let fixtureA = fixtures[i];
        transitionFinishDmx[fixtureA - 1] = nextColor.r;
        transitionFinishDmx[fixtureA] = nextColor.g;
        transitionFinishDmx[fixtureA + 1] = nextColor.b;
        transitionFinishDmx[fixtureA + 2] = nextColor.w;
    }

    calcFade();
    startFade();
}

/**
 * Fade sift all of the colors down one fixture
 * @param nextColor
 * @param startingDmx
 */
function shiftColor(nextColor, startingDmx) {
    let settings = JSON.parse(fs.readFileSync("settings.json"));
    transitionFinishDmx = startingDmx;

    // shift all the running lights down one fixture
    let fixtures = settings.rgbchannels;
    for (let i = fixtures.length; i > 0; i--) {
        let fixtureA = fixtures[i];
        let fixtureB = fixtures[i - 1];
        transitionFinishDmx[fixtureA - 1] = transitionFinishDmx[fixtureB - 1];
        transitionFinishDmx[fixtureA] = transitionFinishDmx[fixtureB];
        transitionFinishDmx[fixtureA + 1] = transitionFinishDmx[fixtureB + 1];
        transitionFinishDmx[fixtureA + 2] = transitionFinishDmx[fixtureB + 2];
    }

    // add the new light as fixture one
    transitionFinishDmx[fixtures[0] - 1] = nextColor.r;
    transitionFinishDmx[fixtures[0]] = nextColor.g;
    transitionFinishDmx[fixtures[0] + 1] = nextColor.b;
    transitionFinishDmx[fixtures[0] + 2] = nextColor.w;

    // save log
    fs.appendFile("colorOutput.log", new Date().toISOString() + "\t" + transitionFinishDmx + "\n", function () {
    });

    calcFade();
    startFade();
}

/**
 * Do the calcs to populate incrementalDiff
 */
function calcFade(){
    numOfSteps = fadeStepsPerSec * 10;
    // numOfSteps = fadeStepsPerSec * settings.fadetime;

    // calculate the incremental values
    let i = 0;
    while (i < dmxOutput.length) {
        incrementalDiff[i] = (transitionFinishDmx[i] - dmxOutput[i]) / numOfSteps;
        i++;
    }
    numOfStepsLeft = numOfSteps;


    // console.log("start dmx:" + dmxOutput);
    // console.log("end dmx:" + transitionFinishDmx);
    // console.log("incr dmx:" + incrementalDiff);
    // console.log("numOfSteps: " + numOfSteps + " fadeStepsPerSec: " + fadeStepsPerSec);

}

// start the fade ball rolling, called every 3min then every ~100ms
function startFade() {

    if (numOfStepsLeft > 2) {
        numOfStepsLeft--;
        fade();
        setTimeout(startFade, 1000 / fadeStepsPerSec);
    } else {
        let i = 0;
        while (i < dmxOutput.length) {
            dmxOutput[i] = transitionFinishDmx[i];
            i++;
        }
    }
}

// run one incrementalDiff, executes every ~100ms
function fade() {
    let i = 0;
    while (i < dmxOutput.length) {
        dmxOutput[i] += incrementalDiff[i];
        i++;
    }
}

/**
 * Start the parked channels and all channels to full
 */
function whiteDmx() {
    let settings = JSON.parse(fs.readFileSync("settings.json"));


    //fill array with 0s
    dmxOutput = new Array(512).fill(0);

    //setup parked channels
    for (let item of settings.parkedchannels) {
        dmxOutput[item - 1] = 255;
    }
    //set rgb ones to white
    for (let value of settings.rgbchannels) {
        dmxOutput[value - 1] = 255; //r
        dmxOutput[value] = 255; //g
        dmxOutput[value + 1] = 255; //b
        dmxOutput[value + 2] = 255; //w
    }
}

function initDmx() {

    whiteDmx();
    let settings = JSON.parse(fs.readFileSync("settings.json"));
    // set all the running lights to next color
    let fixtures = settings.rgbchannels;

    firebase.firestore()
        .collection('lights')
        .limit(fixtures.length)
        .orderBy('date', 'desc')
        .onSnapshot(docSnapshot => {
            console.log(`Received doc snapshot`);
            let fadeStepsPerSecOrg = fadeStepsPerSec;
            docSnapshot.forEach(doc => {
                console.log(doc.id, '=>', doc.data());
                const color = JSON.parse(doc.data().color);
                fadeStepsPerSec = .1;
                shiftColor(color,dmxOutput);
            });
            fadeStepsPerSec = fadeStepsPerSecOrg;
        }, err => {
            console.log(`Firebase Encountered error: ${err}`);
        });
}


/**
 * Start the Firebase listener
 */
function startListeners() {
    firebase.firestore()
        .collection('lights')
        .where("date", ">", new Date())
        .orderBy('date', 'desc')
        .onSnapshot(docSnapshot => {
            docSnapshot.docChanges().forEach(change => {
                let doc = change.doc;
                console.log(`Received doc snapshot ` + change.type);
                console.log(doc.id, '=>', doc.data());
                processFirebaseDoc(doc);
            });
        }, err => {
            console.log(`Firebase Encountered error: ${err}`);
        });
    console.log('New Firebase color notifier started...');
}

/**
 * Handle the submitted data from Firerbase
 * @param doc
 */
function processFirebaseDoc(doc) {
    const dateSec = doc.data().date._seconds;
    const color = doc.data().color;
    const epochNowSec = new Date().getTime() / 1000;
    if (dateSec < epochNowSec) {
        console.log("Not using old data from " + doc.id);
        return;
    }
    // schedule color change
    const secWait = (dateSec - epochNowSec) * 1000;
    setTimeout(runTransition, secWait, color);
    console.log(`Scheduled fade for ${doc.id} to ${color} in ${secWait} ms`);
}
initDmx();
sendRgbDmx();
startListeners();

//runTransition({r:10,g:30,b:60,w:90});
//setTimeout(runTransition.bind(null, {r:20,g:40,b:70,w:100}), 11000);

//
// let db = firebase.firestore();
//
// db.collection('lights').get()
//     .then((snapshot) => {
//         snapshot.forEach((doc) => {
//             console.log(doc.id, '=>', doc.data());
//         });
//     })
//     .catch((err) => {
//         console.log('Error getting documents', err);
//     });
