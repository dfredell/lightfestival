var CodeMirrorColorPicker = require('codemirror-colorpicker');
var Timer = require('easytimer.js').Timer;
var $ = require('jquery');
window.jquery = $;
const invert = require('invert-color');
require("./admin.js");

var picker;

$(document).ready(function() {

    window.console.log("Starting color picker");
    document.body.requestFullscreen();

    if ($('#color-container').length) {
        setupPicker();
        setupTimer();
        setupSubmit();
        setupVerify();
    }

    if ($('#position-image').length) {
        setupPositionImage();
        setupTimer();
    }

});

function getCssColor(color) {
    return 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
}

function updateColors() {
    var color = picker.getColor(true);
    var cssColor = getCssColor(color);
    $(".drag-bar").css('background-color', picker.getColor());
    $(".drag-pointer,#send-color").css('background-color', cssColor);
    $("#send-color").attr("disabled", false);
    $(".value-container").css('background-image','linear-gradient(to right, #000000 0%, '+topColor()+' 100%)');
}

function setupPicker() {
    picker = new CodeMirrorColorPicker.create({
        position: 'inline',
        container: document.getElementById('color-container'),
        type: 'macos',
        color: 'rgb(255,255,255)',
        // gradient: 'linear-gradient(to right, white 0%, green 100%)',
        // outputFormat: 'hex',
        hideDelay: 0,
        onHide: function (c) {
            console.log('hide', c)
        },
        onChange: function (c) {
            // console.log('change', c);
            updateColors();
            console.log(rgbToRgbw());
        }
    });

}

function getTime() {

    var now = new Date();
    var nowSec = now.getUTCSeconds();
    var nowMin = now.getUTCMinutes();
    var remainingMin = 2 - (nowMin % 3);

    var time = {};
    time.minutes = remainingMin;
    time.seconds = 60 - nowSec;

    return time;
}

function setupTimer() {
    var time = getTime();

    // setup countdown
    var timer = new Timer();
    timer.start({countdown: true, startValues: {minutes: time.minutes, seconds: time.seconds}});
    var text = timer.getTimeValues().minutes + ":" + pad(timer.getTimeValues().seconds, 2);
    $(".timer").html(text);
    timer.addEventListener('secondsUpdated', function (e) {
        var text = timer.getTimeValues().minutes + ":" + pad(timer.getTimeValues().seconds, 2);
        $(".timer").html(text);
    });
    timer.addEventListener('targetAchieved', function (e) {
        timer.stop();
        time = null;
        setupTimer();
    });
}

function submitColor() {
    var color = rgbToRgbw();
    var cssColor = getCssColor(color);
    window.console.log("Verify color" + JSON.stringify(color));
    // window.location.replace('verify?color=' + color.r +"");
    $("#select-color").hide();
    $("#verify-color").show();
    $("#verify-color").css("background-color", cssColor);
    $(".verify-color-text").css("color", invert(color));
}

function setupSubmit() {
    $('#send-color').on('click', submitColor);
}

function setupVerify() {
    $('#verify-yes').on('click', verifyYes);
    $('#verify-no').on('click', verifyNo);
}

function verifyNo() {
    $("#select-color").show();
    $("#verify-color").hide();
}

/**
 * User submits their color choice
 */
function verifyYes() {
    var color = rgbToRgbw();
    var cssColor = getCssColor(color);
    window.console.log("Submit color " + JSON.stringify(color));
    $("#show-color").css("background-color", cssColor);
    $.ajax({
        url: '/submitColor',
        contentType: 'application/json',
        method: 'POST',
        json: 'json',
        data: JSON.stringify(color),
        success: function (msg) {
            $("#verify-color").hide();
            $("#show-color").show();
            $("p.timer").hide();
            setTimeout(function () {
                window.location.href = ("/src/index.html");
            }, 5000)
        },
        error: function (msg) {
            $("#verify-color").hide();
            $("#show-color-error").show();
            $("p.timer").hide();
            setTimeout(function () {
                window.location.href = ("/src/index.html");
            }, (getTime().minutes * 60 + getTime().seconds) * 1000)
        }
    });
}

// c color, w white
function calcColor(c,w){
    // Result: DMX R=100+(255-100)/2=177 G=155 + (255-155)/2=205 B= 255 + (255-255)/2= 255 W152
    return parseInt(c+(255-c)*w);
}

function setupPositionImage() {
    $('#position-image').prop('src', '/src/images/' + new URLSearchParams(window.location.search).get('img'));
}

/**
 * Add zeros in front of a number
 * @param num
 * @param size
 * @returns {string}
 */
function pad(num, size) {
    var s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}


/**
 * https://stackoverflow.com/questions/40312216/converting-rgb-to-rgbw/40318604#40318604
 */
function rgbToRgbw(){
    var colorPicker = picker.getColor(true);
    var Ri = colorPicker.r;
    var Gi = colorPicker.g;
    var Bi = colorPicker.b;
    //Get the maximum between R, G, and B
    var tM = Math.max(Ri, Math.max(Gi, Bi));

//If the maximum value is 0, immediately return pure black.
    if(tM === 0)
    { return { r:0,g: 0, b: 0, w: 0 }; }

//This section serves to figure out what the color with 100% hue is
    var multiplier = 255.0 / tM;
    var hR = Ri * multiplier;
    var hG = Gi * multiplier;
    var hB = Bi * multiplier;

//This calculates the Whiteness (not strictly speaking Luminance) of the color
    var M = Math.max(hR, Math.max(hG, hB));
    var m = Math.min(hR, Math.min(hG, hB));
    var Luminance = ((M + m) / 2.0 - 127.5) * (255.0/127.5) / multiplier;

//Calculate the output values
    var Wo = parseInt(Luminance);
    var Bo = parseInt(Bi - Luminance);
    var Ro = parseInt(Ri - Luminance);
    var Go = parseInt(Gi - Luminance);

//Trim them so that they are all between 0 and 255
    if (Wo < 0) Wo = 0;
    if (Bo < 0) Bo = 0;
    if (Ro < 0) Ro = 0;
    if (Go < 0) Go = 0;
    if (Wo > 255) Wo = 255;
    if (Bo > 255) Bo = 255;
    if (Ro > 255) Ro = 255;
    if (Go > 255) Go = 255;
    return { r :Ro, g : Go, b : Bo, w : Wo };
}

/**
 * figure out the brightest color values
 * @returns {string} css
 */
function topColor(){

    var colorPicker = picker.getColor(true);
    var Ri = colorPicker.r;
    var Gi = colorPicker.g;
    var Bi = colorPicker.b;
    //Get the maximum between R, G, and B
    var tM = Math.max(Ri, Math.max(Gi, Bi));

//Calculate the output values
//This section serves to figure out what the color with 100% hue is
    var multiplier = 255.0 / tM;
    var Ro = parseInt(Ri * multiplier);
    var Go = parseInt(Gi * multiplier);
    var Bo = parseInt(Bi * multiplier);


//Trim them so that they are all between 0 and 255
    if (Bo < 0) Bo = 0;
    if (Ro < 0) Ro = 0;
    if (Go < 0) Go = 0;
    if (Bo > 255) Bo = 255;
    if (Ro > 255) Ro = 255;
    if (Go > 255) Go = 255;
    return `rgb(${Ro},${Go},${Bo})`;
    // return { r :Ro, g : Go, b : Bo };

}