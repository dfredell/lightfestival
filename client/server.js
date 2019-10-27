/*server.js*/
const http = require('http');
const hostname = '0.0.0.0';
const isDocker = require('is-docker');
var port = 80;
console.log("Starting with isDocker: " + isDocker());
if (!isDocker()) {
    port = 8080;
}
const fs = require('fs');
const url = require('url');
var requirejs = require('requirejs');
const path = require('path'); // For working with file and directory paths
var request = require('request');
const {parse} = require('querystring');
const readLastLines = require('read-last-lines');
var auth = require('basic-auth');

// Firebase
var firebase = require('firebase-admin');
var serviceAccount = require("./lightfestival-firebase-adminsdk.json");
firebase.initializeApp({
    credential: firebase.credential.cert(serviceAccount),
    databaseURL: "https://lightfestival.firebaseio.com"
});

var submittedColors = [];
var dmxOutput = [];


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
    if (req.url.includes('/admin') || req.url.includes('/rgbchannels')) {
        // Check credentials
        // The "check" function will typically be against your user store
        var credentials = auth(req);
        if (!credentials || !check(credentials.name, credentials.pass)) {
            res.statusCode = 401;
            res.setHeader('WWW-Authenticate', 'Basic realm="example"');
            res.end('Access denied');
            return;
        }
    }

    if (req.url.includes('/submitColor')) {
        submitColor(req, res);
        return;
    } else if (req.url.includes('/timer')) {
        submitTimer(req, res);
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
        res.writeHead(302, {'Location': 'index.html'});
        return res.end();
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    var q = url.parse(req.url, true);
    var filename;
    if(q.pathname.indexOf("codemirror-colorpicker") > 0) {
        filename = "./node_modules" + q.pathname;
    } else {
        filename = "./src" + q.pathname;
    }
    // security, remove path traversal
    filename = filename.replace(/\.\./gi,"");
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
server.listen(port, hostname, function () {
    console.log('Server running at http://' + hostname + ':' + port + '/');
});

// Basic function to validate credentials for example
function check(name, pass) {
    var valid = true;

    // Simple method to prevent short-circut and use timing-safe compare
    valid = name === 'marco' && valid;
    valid = pass === 'Ar]PcR=Zt3P$G[M' && valid;
    return valid;
}
// accept a new color from the user
function submitColor(req, res) {
    var channels = JSON.parse(fs.readFileSync("settings.json")).rgbchannels;

    var body = '';
    req.on('data', function (data) {
        body += data;
        console.log('Partial body: ' + body);
    });
    req.on('end', function () {
        console.log("Submitted color " + body);
        console.log('Body: ' + body);

        res.writeHead(200, {'Content-Type': 'application/json'});
        // add to queue
        sendDataToDb(body,res);

        // save log
        fs.appendFile("colorSubmitted.log", new Date().toISOString() + "\t" + body + "\n", function () {
        });
    })
}

/**
 * Sends a new color up to firebase
 * @param body
 * @returns {Promise<string>}
 */
function sendDataToDb(body,res) {
    // Get the most future light time so we know when we can go next
    let farthestDateSec = 0;
    var settings = JSON.parse(fs.readFileSync("settings.json"));


    let queryPromise = firebase.firestore()
        .collection('lights')
        .where("date", ">", new Date())
        .orderBy('date', 'desc')
        .limit(1)
        .get()
        .then(result => {
            console.log(`Received doc snapshot`);
            result.forEach(doc => {
                console.log(doc.id, '=>', doc.data());
                farthestDateSec=doc.data().date._seconds;
            });
        }, err => {
            console.log(`Firebase load Encountered error: ${err}`);
            console.log(JSON.stringify(err));
        });

    // wait for query to finish
    return Promise.all([queryPromise]).then(()=> {

        // Calc next available time
        if (farthestDateSec === 0) {
            farthestDateSec = new Date().getTime()/1000;
            // Round up to the next 30 second block
            farthestDateSec = farthestDateSec - farthestDateSec % settings.waittime + settings.waittime;
        } else {
            farthestDateSec += settings.waittime;
        }
        let farthestDate = new Date(farthestDateSec * 1000);
        console.log(`Sending color ${body} for  ` + farthestDate.toISOString());

        // Add new data to firebase
        var submit = firebase.firestore()
            .collection('lights')
            .add({
                date: firebase.firestore.Timestamp.fromDate(farthestDate),
                color: body
            }, err => {
                console.log(`Firebase Save Encountered error: ${err}`);
                console.log(JSON.stringify(err));
            });
        console.log(`Submitted firebase`);
        var cooldown = new Date();
        cooldown.setMinutes(cooldown.getMinutes() + settings.cooldown);
        res.write(JSON.stringify({date: farthestDate,cooldown: cooldown }));
        res.end();
    }, err => {
        console.log(`Firebase never finished Encountered error: ${err}`);
        console.log(JSON.stringify(err));
    });
}

// get the server's version of a 3min countdown
function submitTimer(req, res) {
    res.writeHead(200, {
        'Content-Type': 'application/json',
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": 0,
    });

    res.write(JSON.stringify(calcNextSend()));
    res.end();
}

// Returns the next time to send DMX updates
function calcNextSend() {
    var settings = JSON.parse(fs.readFileSync("settings.json"));
    waittime = Math.max(1, settings.waittime);

    var now = new Date();
    var nowSec = now.getUTCSeconds();
    var nowMin = now.getUTCMinutes();
    var remainingMin = waittime - (nowMin % waittime) - 1;

    var data = {};
    data.minutes = remainingMin;
    data.seconds = 60 - nowSec;
    console.log("CalcNextSend. waittime:" + waittime + " nowMin:" + nowMin + " nowSec:" + nowSec + " data:" + JSON.stringify(data));
    return data;
}

/**
 * If the dmx channels changed from what is in the settings file
 * @param settings
 * @returns {boolean}
 */
function channelsChanged(settings) {
    var file = JSON.parse(fs.readFileSync("settings.json"));
    if (!arrayEquals(settings.rgbchannels, file.rgbchannels)) {
        return true;
    }
    if (!arrayEquals(settings.parkedchannels, file.parkedchannels)) {
        return true;
    }
    return false;
}

function arrayEquals(arr1,arr2) {
    return arr1.length === arr2.length && arr1.every((v) => arr2.indexOf(v) >= 0);
}

// update the settings file
function submitRgbchannels(req, res) {
    var body = '';
    req.on('data', function (data) {
        body += data;
        console.log('Partial body: ' + body);
    });
    req.on('end', function () {
        console.log("Submitted color " + body);
        console.log('Body: ' + body);
        res.writeHead(200, {'Content-Type': 'application/json'});
        var settings = parse(body);
        settings.rgbchannels = settings.rgbchannels.split(",").map(Number);
        settings.parkedchannels = settings.parkedchannels.split(",").map(Number);
        settings.cooldown = parseInt(settings.cooldown);
        settings.waittime = parseInt(settings.waittime);
        let changed = channelsChanged(settings);
        fs.writeFile("settings.json", JSON.stringify(settings), function () {
            if(changed){
                whiteDmx();
            }
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
    var content = fs.readFileSync("settings.json");
    res.write((content));
    res.end();
}



/**
 * Start the parked channels and all channels to full
 */
function whiteDmx() {
    var settings = JSON.parse(fs.readFileSync("settings.json"));


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

// The signals we want to handle
// NOTE: although it is tempting, the SIGKILL signal (9) cannot be intercepted and handled
var signals = {
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


// sendDataToDb("{r:10,g:30,b:60,w:90}");