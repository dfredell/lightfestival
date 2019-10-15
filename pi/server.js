/*server.js*/
const http = require('http');
const hostname = '127.0.0.1';
const isDocker = require('is-docker');
let port = 80;
console.log("Starting with isDocker: " + isDocker());
if (!isDocker()) {
    port = 8081;
}
const fs = require('fs');
const url = require('url');
let requirejs = require('requirejs');
const path = require('path'); // For working with file and directory paths
let request = require('request');
const {parse} = require('querystring');
const readLastLines = require('read-last-lines');

// Firebase
let firebase = require('firebase-admin');
let serviceAccount = require("./lightfestival-firebase-adminsdk.json");
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://lightfestival.firebaseio.com"
});

let submittedColors = [];
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


const server = http.createServer(function (req, res) {
    if (req.url.includes('/submitColor')) {
        submitColor(req, res);
        return;
    } else if (req.url.includes('/currentrgbchannels')) {
        currentRgbchannels(req, res);
        return;
    } else if (req.url.includes('/rgbchannels')) {
        submitRgbchannels(req, res);
        return;
    } else if (req.url.includes('/panic')) {
        whiteDmx();
        res.write("Success");
        res.end();
        return;
    } else if (req.url === '/') {
        res.writeHead(302, {'Location': 'src/index.html'});
        return res.end();
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    let q = url.parse(req.url, true);
    let filename = "." + q.pathname;
    fs.readFile(filename, function (err, data) {
        if (err) {
            res.writeHead(404, {'Content-Type': 'text/html'});
            return res.end("404 Not Found");
        }
        let ext = path.parse(filename).ext;
        res.writeHead(200, {'Content-Type': mimeTypes[ext]})
        res.write(data);
        return res.end();
    });

});
server.listen(port, function () {
    console.log('Server running at http://' + hostname + ':' + port + '/');
});

// accept a new color from the user
function submitColor(req, res) {
    let channels = JSON.parse(fs.readFileSync("settings.json")).rgbchannels;

    let body = '';
    req.on('data', function (data) {
        body += data;
        console.log('Partial body: ' + body);
    });
    req.on('end', function () {
        console.log("Submitted color " + body);
        console.log('Body: ' + body);
        //validate there is more room on the queue
        if (channels.length <= submittedColors.length) {
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.write(JSON.stringify({message: "Too many submittions"}));
            res.end();
            return;
        }

        res.writeHead(200, {'Content-Type': 'application/json'});
        // add to queue
        submittedColors.push(body);

        // save log
        fs.appendFile("colorSubmitted.log", new Date().toISOString() + "\t" + body + "\n", function () {
        });

        let data = {};
        data.img = 'map1.png';
        res.write(JSON.stringify(data));
        res.end();
    })
}


// update the settings file
function submitRgbchannels(req, res) {
    let body = '';
    req.on('data', function (data) {
        body += data;
        console.log('Partial body: ' + body);
    });
    req.on('end', function () {
        console.log("Submitted color " + body);
        console.log('Body: ' + body);
        res.writeHead(200, {'Content-Type': 'application/json'});
        let settings = parse(body);
        settings.rgbchannels = settings.rgbchannels.split(",").map(Number);
        settings.parkedchannels = settings.parkedchannels.split(",").map(Number);
        settings.fadetime = parseInt(settings.fadetime);
        settings.waittime = parseInt(settings.waittime);
        fs.writeFile("settings.json", JSON.stringify(settings), function () {
        });
        res.write("Success");
        res.end();
    })
}

// get the settings file for the admin page
function currentRgbchannels(req, res) {
    res.writeHead(200, {
        'Content-Type': 'application/json',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": 0,
    });
    let content = fs.readFileSync("settings.json");
    res.write((content));
    res.end();
}


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
    let settings = JSON.parse(fs.readFileSync("settings.json"));

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

    // load the previous DMX values
    readLastLines.read('colorOutput.log', 1)
        .then((lines) => {
                console.log(dmxOutput);
                if (lines.length > 500) {
                    dmxOutput = lines.split("\t")[1].split(",");
                    console.log("Loaded DMX from file");
                    let i = 0;
                    while (i < dmxOutput.length) {
                        dmxOutput[i] = parseInt(dmxOutput[i]);
                        i++;
                    }
                    console.log(dmxOutput);
                }
            }
        ).catch(function (err) {
        console.log(err.message);
        fs.appendFile("colorOutput.log", "", function () {
        });
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
            console.log(`Received doc snapshot`);
            docSnapshot.forEach(doc => {
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

// The signals we want to handle
// NOTE: although it is tempting, the SIGKILL signal (9) cannot be intercepted and handled
let signals = {
    'SIGHUP': 1,
    'SIGINT': 2,
    'SIGTERM': 15
};
// Do any necessary shutdown logic for our application here
const shutdown = (signal, value) => {
    console.log("shutdown!");
    server.close(() => {
        console.log(`server stopped by ${signal} with value ${value}`);
        process.exit(128 + value);
    });
};
// Create a listener for each of the signals that we want to handle
Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
        console.log(`process received a ${signal} signal`);
        shutdown(signal, signals[signal]);
    });
});

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
