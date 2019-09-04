/*server.js*/
const http = require('http');
const hostname = '127.0.0.1';
const os = require('os');
var port = 80;
console.log("Starting with os " + os.release());
if(os.hostname().indexOf('manjaro')>0){
    port = 8080;
}
const fs = require('fs');
const url = require('url');
var requirejs = require('requirejs');
const path = require('path') // For working with file and directory paths
var request = require('request');
const { parse } = require('querystring');
var submittedColors = [];
var dmxOutput = [];
var incrementalDiff = [];
var transitionFinishDmx = [];

var numOfStepsLeft = 0;
var numOfSteps = 100;
var fadeStepsPerSec = 10;

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
    if(req.url === '/submitColor'){
        submitColor(req,res);
        return;
    }else if(req.url === '/timer'){
        submitTimer(req,res);
        return;
    }else if(req.url === '/currentrgbchannels'){
        currentRgbchannels(req,res);
        return;
    }else if(req.url === '/rgbchannels'){
        submitRgbchannels(req,res);
        return;
    }else if(req.url === '/panic'){
        initDmx();
        res.write("Success");
        res.end();
        return;
    }else if(req.url === '/'){
        res.writeHead(302, {'Location':'src/index.html'});
        return res.end();
    }
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    var q = url.parse( req.url, true);
    var filename = "." + q.pathname;
    fs.readFile(filename, function(err, data) {
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
    var channels = JSON.parse(fs.readFileSync("settings.json")).rgbchannels;

    var body = '';
    req.on('data', function(data) {
        body += data;
        console.log('Partial body: ' + body);
    });
    req.on('end', function() {
        console.log("Submitted color " + body);
        console.log('Body: ' + body);
        //validate there is more room on the queue
        if (channels.length <= submittedColors.length){
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.write(JSON.stringify({message:"Too many submittions"}));
            res.end();
            return;
        }

        res.writeHead(200, {'Content-Type': 'application/json'});
        // add to queue
        submittedColors.push(body);

        // save log
        fs.appendFile("color.log", new Date().toISOString() + "\t" + body + "\n", function(){});

        var data = {};
        data.img = 'map1.png';
        res.write(JSON.stringify(data));
        res.end();
    })
}

// get the server's version of a 3min countdown
function submitTimer(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.write(JSON.stringify(calcNextSend()));
    res.end();
}

// Returns the next time to send DMX updates
function calcNextSend() {

    var now = new Date();
    var nowSec = now.getUTCSeconds();
    var nowMin = now.getUTCMinutes();
    var remainingMin = 1-(nowMin%2);

    var data = {};
    data.minutes = remainingMin;
    data.seconds = 60 - nowSec;
    return data;
}

// update the settings file
function submitRgbchannels(req, res) {
     var body = '';
        req.on('data', function(data) {
            body += data;
            console.log('Partial body: ' + body);
        });
        req.on('end', function() {
            console.log("Submitted color " + body);
            console.log('Body: ' + body);
            res.writeHead(200, {'Content-Type': 'application/json'});
            var settings = parse(body);
            settings.rgbchannels = settings.rgbchannels.split(",").map(Number);
            settings.parkedchannels = settings.parkedchannels.split(",").map(Number);
            settings.fadetime = parseInt(settings.fadetime);
            fs.writeFile("settings.json", JSON.stringify(settings), function(){});
            res.write("Success");
            res.end();
        })
}

// get the settings file for the admin page
function currentRgbchannels(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    var content = fs.readFileSync("settings.json");
    res.write((content));
    res.end();
}


// send dmxOutput to ola
function sendRgbDmx(){
    // console.log("sending DMX update");

    var universe=0;
    var url = 'http://localhost:9090/set_dmx';
    var data = "u="+universe+"&d="+dmxOutput.join(",");

//    require('request').debug = true

    var clientServerOptions = {
            uri: url,
            body:  data,
            method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },

        };
    request(clientServerOptions, function (error, response) {
//        console.log(error,response);
        return;
    });
    setTimeout(sendRgbDmx, 100);
}


function setupTransitions(){
    var time = calcNextSend();
    // how long between sending the queue to the lights
   setTimeout(setupTransitions, (time.minutes * 60 + time.seconds) * 1000);
    // setTimeout(setupTransitions, 30000);
    runTransition();
}

//Create the final dmx value array
function runTransition(){
    transitionFinishDmx = dmxOutput.slice(0);
    var settings = JSON.parse(fs.readFileSync("settings.json"));

    var submitCount = submittedColors.length;
    var fixtures = settings.rgbchannels;
    var fixtureMap = []; // value of the r channels

    // randomize the fixture placement of submitted colors
    while(fixtureMap.length < submittedColors.length){
        var randFixture = fixtures[Math.floor(Math.random() * fixtures.length)];
        if(!fixtureMap.includes(randFixture)){
            fixtureMap.push(randFixture);
        }
    }
    console.log("fixture map " + fixtureMap);


    var i = 0;
    for(var value of submittedColors) {
        var color = JSON.parse(value);
        transitionFinishDmx[fixtureMap[i]-1] = color.r;
        transitionFinishDmx[fixtureMap[i]] = color.g;
        transitionFinishDmx[fixtureMap[i]+1] = color.b;
        transitionFinishDmx[fixtureMap[i]+2] = color.w;
        i++;
    }

    //clear submitted colors
    submittedColors = [];

    console.log("now  dmx:"+dmxOutput);
    console.log("goal dmx:"+transitionFinishDmx);

    numOfSteps = fadeStepsPerSec * settings.fadetime;

    // calculate the incremental values
    i=0;
    while(i<dmxOutput.length){
        incrementalDiff[i] = (transitionFinishDmx[i]-dmxOutput[i])/numOfSteps;
        i++;
    }
    numOfStepsLeft = numOfSteps;

    console.log("incr dmx:" + incrementalDiff);

    startFade();
}

// start the fade ball rolling, called every 3min then every ~100ms
function startFade(){

    if(numOfStepsLeft>2) {
        numOfStepsLeft--;
        fade();
        setTimeout(startFade, 1000/fadeStepsPerSec);
    } else {
        var i=0;
        while(i<dmxOutput.length){
            dmxOutput[i]=transitionFinishDmx[i];
            i++;
        }
    }
}

// run one incrementalDiff, executes every ~100ms
function fade(){
    var i=0;
    while(i<dmxOutput.length){
        dmxOutput[i]+=incrementalDiff[i];
        i++;
    }
}

function initDmx(){
    var settings = JSON.parse(fs.readFileSync("settings.json"));


    //fill array with 0s
   dmxOutput = new Array(512).fill(0);

    //setup parked channels
    for(let item of settings.parkedchannels) {
        dmxOutput[item - 1] = 255;
    }
    //set rgb ones to white
    for(let value of settings.rgbchannels) {
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

initDmx();
sendRgbDmx();
setupTransitions();
