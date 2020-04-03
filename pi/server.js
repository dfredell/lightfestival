/*server.js*/
const fs = require('fs');
const url = require('url');
let requirejs = require('requirejs');
let request = require('request');
const readLastLines = require('read-last-lines');
let settings = JSON.parse(fs.readFileSync("settings.json"));
var CronJob = require('cron').CronJob;

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
let incrementalDiffUp = [[]];
let incrementalDiffDown = [[]];
let colorOutput = [{}];
let colorOutputNext = [{}];

let numOfStepsLeft = 0;
let numOfSteps = 200;
let fadeStepsPerSec = 20;
let waveFadeTotalSec = 9;
let haveCaughtUp = false;
let hugEnabled = true;
let firestoreWatch = null;

let cronJobs = [];

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
    setTimeout(sendRgbDmx, 50);
}


/**
 * Create the final dmx value array and start fade/ transition to it
 */
function runTransition(nextColor) {
    nextColor = JSON.parse(nextColor);
    console.log(`Fading to ${JSON.stringify(nextColor)}`);

    let startingDmx = dmxOutput.slice(0);
    // let startingDmx2 = dmxOutput.slice(0);

    calcWave(startingDmx, nextColor);
    waveFade(0,nextColor);

    //fullColor(nextColor, startingDmx);
    //setTimeout(shiftColor, 3000, nextColor, startingDmx2);
}

/**
 * make the math easy, just calc 100 steps, I will deal with lowering the steps per sec later on
 */
function calcWave(startingDmx, nextColor) {

    console.log(new Date().toISOString() + " Calculating wave to " + JSON.stringify(nextColor));

    let fixtures = settings.rgbchannels;

    numOfSteps = 100;

    // calculate the incremental values up
    for (let f = 0; f < fixtures.length; f++) {
        incrementalDiffUp[f] = {};
        incrementalDiffUp[f].r = (nextColor.r - colorOutput[f].r) / numOfSteps;
        incrementalDiffUp[f].g = (nextColor.g - colorOutput[f].g) / numOfSteps;
        incrementalDiffUp[f].b = (nextColor.b - colorOutput[f].b) / numOfSteps;
    }

    // shift all the running lights down one fixture
    colorOutputNext = JSON.parse(JSON.stringify(colorOutput));
    colorOutputNext.push(nextColor);
    colorOutputNext.shift();

    // calc the incremental values to the next shift
    for (let f = 0; f < fixtures.length; f++) {
        incrementalDiffDown[f] = {};
        incrementalDiffDown[f].r = (colorOutputNext[f].r - nextColor.r) / numOfSteps;
        incrementalDiffDown[f].g = (colorOutputNext[f].g - nextColor.g) / numOfSteps;
        incrementalDiffDown[f].b = (colorOutputNext[f].b - nextColor.b) / numOfSteps;
    }
}

/**
 *
 * 3 sections of time for fade
 * 1. fading up, each color is delayed 1/3 by for a total of 3 sec
 * 2. static new color for 3 sec
 * 3. fade out, 3 sec
 *
 * @param t time segment in fade
 * @param nextColor new color to add
 */
function waveFade(t, nextColor){

    // each color gets 1.5 sec to fade
    let framesToFade = fadeStepsPerSec * 1.5;
    // frames till we are done with phase one, 3sec
    let phaseOneDone = fadeStepsPerSec * 3;
    // how many method executions to put between starting the fade of the next color output
    let timeToTail = ( phaseOneDone - framesToFade )/colorOutput.length;

    // wait at phase two, full new color, for 3 sec
    let phaseTwoDone = phaseOneDone + fadeStepsPerSec * 3;

    // wait at phase two, full new color, for 4 sec
    let phaseThreeDone = phaseTwoDone + fadeStepsPerSec * 3;

    // fade up to the all the new color
    for (let i = 0; i < colorOutput.length; i++) {
        //delay the color fade start
        if(timeToTail * i <= t && (framesToFade + timeToTail * i ) > t && t < phaseOneDone) {
            colorOutput[i].r += incrementalDiffUp[i].r * 100 / framesToFade;
            colorOutput[i].g += incrementalDiffUp[i].g * 100 / framesToFade;
            colorOutput[i].b += incrementalDiffUp[i].b * 100 / framesToFade;
        } else if (phaseOneDone < t &&  t < phaseTwoDone){
            colorOutput[i].r = nextColor.r;
            colorOutput[i].g = nextColor.g;
            colorOutput[i].b = nextColor.b;
        } else if(phaseTwoDone < t
                    && (phaseTwoDone + timeToTail * i ) <= t
                    && (phaseTwoDone + framesToFade + timeToTail * i ) > t
                    && t < phaseThreeDone) {
            colorOutput[i].r += incrementalDiffDown[i].r * 100 / framesToFade;
            colorOutput[i].g += incrementalDiffDown[i].g * 100 / framesToFade;
            colorOutput[i].b += incrementalDiffDown[i].b * 100 / framesToFade;
        } else if (t >= phaseThreeDone) {
            colorOutput = colorOutputNext;
            if (i===0){
                console.log(new Date().toISOString() + " wave finished to " + JSON.stringify(nextColor));
            }
        }
    }


    if(t < fadeStepsPerSec * waveFadeTotalSec){
        mapColorToOutput();
        t = t+1;
        setTimeout(waveFade,1000/fadeStepsPerSec,t,nextColor)
    }
}

/**
 * use settings.rgbfixtures to map colorOutput to dmxoutput
 */
function mapColorToOutput(){
    let fixtureGroups = settings.rgbchannels;
    for (let g = 0; g < fixtureGroups.length; g++) {
        for (let i = 0; i < fixtureGroups[g].length; i++) {
            dmxOutput[fixtureGroups[g][i] - 1] = Math.round(colorOutput[g].r);
            dmxOutput[fixtureGroups[g][i] + 0] = Math.round(colorOutput[g].g);
            dmxOutput[fixtureGroups[g][i] + 1] = Math.round(colorOutput[g].b);
        }
    }
    // console.log(colorOutput);
}

function pushWaveColor(nextColor) {
    colorOutput.shift();
    colorOutput.push(nextColor);
    mapColorToOutput();
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
function calcFade() {
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
    let fixtureGroups = settings.rgbchannels;
    for (let g = 0; g < fixtureGroups.length; g++) {
        colorOutput[g] = {};
        colorOutput[g].r = 255; //r
        colorOutput[g].g = 255; //g
        colorOutput[g].b = 255; //b
    }
    //set rgb ones to white
    // for (let value of settings.rgbchannels) {
    //     dmxOutput[value - 1] = 255; //r
    //     dmxOutput[value] = 255; //g
    //     dmxOutput[value + 1] = 255; //b
    //     dmxOutput[value + 2] = 255; //w
    // }
}

function initDmx() {

    whiteDmx();
}


/**
 * Start the Firebase listener
 */
function startListeners() {
    let settings = JSON.parse(fs.readFileSync("settings.json"));
    // set all the running lights to next color
    let fixtures = settings.rgbchannels;
    if(firestoreWatch != null){
        return;
    }
    firestoreWatch = firebase.firestore()
        .collection('lights')
        .limit(fixtures.length)
        .orderBy('date', 'desc')
        .onSnapshot(docSnapshot => {
            docSnapshot.docChanges().forEach(change => {
                let doc = change.doc;
                console.log(`Received doc snapshot ` + change.type);
                if (change.type === 'added' && hugEnabled) {
                    console.log(doc.id, '=>', doc.data());
                    processFirebaseDoc(doc);
                }
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
    // first load the previous top X colors from the DB
    if (dateSec < epochNowSec && !haveCaughtUp) {
        console.log("Old doc instant fade " + doc.id);
        let fadeStepsPerSecOrg = fadeStepsPerSec;
        fadeStepsPerSec = .1;
        const color = JSON.parse(doc.data().color);
        // shiftColor(color, dmxOutput);
        pushWaveColor(color);
        fadeStepsPerSec = fadeStepsPerSecOrg;
        return;
    }
    haveCaughtUp = true;
    // schedule color change
    const secWait = (dateSec - epochNowSec) * 1000;
    setTimeout(runTransition, secWait, color);
    console.log(`Scheduled fade for ${doc.id} to ${color} in ${secWait} ms`);
}

let Handler={};

Handler.startHug = function () {
    hugEnabled=true;
    startListeners();
};
Handler.setDMX = function (dmxValues) {
    dmxOutput = dmxValues;
    hugEnabled=false;
};

/**
 * start the cron jobs that are in the settings file
 */
function setupCrons() {
    let schedules = settings.schedule;
    let currentEvent = "startHug";
    let currentDmx = [];
    let latestDate = 0;

    for (let f = 0; f < schedules.length; f++) {
        let schedule = schedules[f];

        var job = new CronJob('0 ' + schedule.time.minute + ' ' + schedule.time.hour + ' * * *', function () {
            console.log('Calling Cron method ' + schedule.event);
            Handler[schedule.event](schedule.dmx);
        }, null, true, '');

        job.start();

        //find the farthest out job, that is the one that would have ran previously
        for (let f = 0; f < cronJobs.length; f++) {
            if(latestDate < job.nextDate()){
                currentEvent = schedule.event;
                currentDmx = schedule.dmx;
                latestDate = job.nextDate();
            }
        }

        cronJobs.push(job);
    }

    console.log('Starting with event ' + currentEvent);
    Handler[currentEvent](currentDmx);
}

initDmx();
sendRgbDmx();
//startListeners();
setupCrons();

//runTransition('{"r":10,"g":30,"b":60}');
//setTimeout(runTransition.bind(null, '{"r":20,"g":40,"b":70}'), 1000);
// setTimeout(runTransition.bind(null, '{"r":200,"g":40,"b":70}'), 50000);


/**
 * Export the firebase database to a csv
 */
function exportDb() {
    const file = "colors.csv";
    const header = "date,seconds,r,g,b,ip\n";
    let db = firebase.firestore();
    fs.writeFile(file, header, function () {
    });
    db.collection('lights')
        .limit(3)
        .orderBy('date', 'desc')
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                try {
                    let data = doc.data();
                    console.log(doc.id, '=>', data);
                    const dateSec = data.date._seconds;
                    const color = JSON.parse(data.color);
                    const ip = data.ip;
                    const dateString = (new Date(dateSec * 1000)).toISOString();
                    const row = [dateString, dateSec, color.r, color.g, color.b, ip].join(',') + '\n';

                    fs.appendFile(file, row, (err) => {
                    });
                } catch(e) {
                    console.log("Issue parsing")
                }
            });
        })
        .catch((err) => {
            console.log('Error getting documents', err);
        });
}
// exportDb();