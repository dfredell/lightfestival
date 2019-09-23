var CodeMirrorColorPicker = require('codemirror-colorpicker');
var Timer = require('easytimer.js').Timer;
var $ = require('jquery');
window.jquery = $;
const invert = require('invert-color');
require("./admin.js");
var draggable;
var picker;
var white = 0;

$(document).ready(function () {
    draggable = require("draggable");
    $.ajaxSetup({ cache: false });

    window.console.log("Starting color picker");
    setupEnter();
    setupBodyClick();

    if ($('#color-container').length) {
        setupTimer();
        setupSubmit();
        setupVerify();
        openFullscreen(document.body);
    }

    if ($('#position-image').length) {
        setupPositionImage();
        setupTimer();
    }

});

function openFullscreen(elem) {
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) { /* Firefox */
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) { /* Chrome, Safari and Opera */
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) { /* IE/Edge */
        elem.msRequestFullscreen();
    }
}

function getCssColor(color) {
    return 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
}

function updateColors() {
    var color = saturationRgbWhite();
    // var color = picker.getColor(true);
    var cssColor = getCssColor(color);
    $(".drag-bar").css('background-color', cssColor);
    $(".drag-pointer,#send-color").css('background-color', cssColor);
    $("#send-color").css('color', 'white');
    $("#send-color").attr("disabled", false);
    $(".value-container").css('background-image', 'linear-gradient(to left, #ffffff 0%, ' + topColor() + ' 100%)');
}

function setupPicker() {
    setTimeout(setupPickerDelay, 100);
    if (picker != null) {
        // Reset the colors
        picker.initColor('rgb(255,255,255)');
        $("#drag-bar").css( {position:"absolute", left: 0});
        $("#send-color").css('color', 'gray');
        $("#send-color").css('background-color', 'black');
        $("#send-color").attr("disabled", true);
        // Reset white bar drag selector
        setupPickerDelay();
        return;
    }
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
            // console.log(rgbToRgbw());
            console.log(saturationRgbWhite());
        }
    });

}

// setup white drag bar after the rest of the page is set
function setupPickerDelay() {
    let $dragBar = $('#drag-bar');
    let $drag = $("#drag-bar-container");

    // remove any existing listeners
    $dragBar.off();
    $drag.off();

    var element = $dragBar[0];
    var options = {
        grid: 1,
        onDrag: function (e) {
            // window.console.log(e);
            white = getDragPercent() * 255;
            updateColors();
        },
        limit: {
            x: [0, $drag.width() - $dragBar.width() - 4],
            y: $drag.position().top
        }
    };
    new draggable(element, options);

    // Setup size
    $dragBar.css( {position:"absolute",
        left: 0,
        top: $drag.position().top,
        height: $drag.height(),
        width: "32px"
    });

    // clicking anywhere on the bar snaps the selector to click position
    $drag.click( function(event) {
        $dragBar.css( {
            position:"absolute",
            left: event.pageX-($dragBar.width()/2),
            top: $drag.position().top
        });
        // window.console.log("White snap " + event.pageX);
        updateColors();
    });
}

function getLocalTime() {

    // calc local time
    var now = new Date();
    var nowSec = now.getUTCSeconds();
    var nowMin = now.getUTCMinutes();
    var remainingMin = 2 - (nowMin % 3);

    var time = {};
    time.minutes = remainingMin;
    time.seconds = 60 - nowSec;

}

function getTime() {

    var time = {};
    // ask server for time
    $.ajax({
        url: '/timer/' + new Date().getTime(),
        contentType: 'application/json',
        method: 'GET',
        json: 'json',
        async: false,
        success: function (msg) {
            time = msg;
        },
        error: function () {
            time = getLocalTime();
        }
    });

    return time;
}

function setupTimer() {
    var time = getTime();

    // setup countdown
    var timer = new Timer();
    timer.start({countdown: true, startValues: {minutes: time.minutes, seconds: time.seconds}});
    var text = timer.getTimeValues().minutes + ":" + pad(timer.getTimeValues().seconds, 2);
    $(".timer").html(text);
    var secondsUpdated = function (e) {
        var text = timer.getTimeValues().minutes + ":" + pad(timer.getTimeValues().seconds, 2);
        $(".timer").html(text);
    };
    timer.addEventListener('secondsUpdated', secondsUpdated);
    timer.addEventListener('targetAchieved', function (e) {
        timer.stop();
        timer.removeEventListener('targetAchieved', this);
        timer.removeEventListener('secondsUpdated', secondsUpdated);
        time = null;
        setupTimer();
    });
}

function submitColor() {
    // var color = picker.getColor(true);
    var color = saturationRgbWhite();
    var cssColor = getCssColor(color);
    window.console.log("Verify color" + JSON.stringify(color));
    // window.location.replace('verify?color=' + color.r +"");
    $("#select-color").hide();
    $("#verify-color").show();
    $("#verify-color").css("background-color", cssColor);
    $(".verify-color-text,p.timer").css("color", invert(color));
    $("#show-color").css("background-color", cssColor);
    $("#show-color-error").css("background-color", cssColor);
}

function setupEnter() {
    $('#enter-button').on('click', function () {
        $('#enter-screen').hide();
        $('#select-color').show();
        $("p.timer").show();
        $("p.timer").css('color', 'white');
        setupPicker();
    });
}

function setupSubmit() {
    $('#send-color').on('click', submitColor);
}

function setupBodyClick() {
    $('#enter-screen').on('click', function () {
        openFullscreen(document.body);
    });
}

function setupVerify() {
    $('#verify-yes').on('click', verifyYes);
    $('#verify-no').on('click', verifyNo);
}

function verifyNo() {
    $("#select-color").show();
    $("#verify-color").hide();
    $("p.timer").css('color', 'white');
}

/**
 * User submits their color choice
 */
function verifyYes() {
    // var color = picker.getColor(true);
    var color = saturationRgbWhite();
    var cssColor = getCssColor(color);
    window.console.log("Submit color rgb  " + JSON.stringify(color));
    $("#show-color").css("background-color", cssColor);
    $("#show-color-error").css("background-color", cssColor);
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
                $('#enter-screen').show();
                $('#show-color').hide();
            }, 7000)
        },
        error: function (msg) {
            $("#verify-color").hide();
            $("#show-color-error").show();
            $("p.timer").hide();
            var sec = (getTime().minutes * 60 + getTime().seconds);
            window.console.log("All colors picked waiting " + sec + " seconds");
            setTimeout(function () {
                $('#enter-screen').show();
                $('#show-color-error').hide();
            }, sec * 1000)
        }
    });
}

// c color, w white
function calcColor(c, w) {
    // Result: DMX R=100+(255-100)/2=177 G=155 + (255-155)/2=205 B= 255 + (255-255)/2= 255 W152
    return parseInt(c + (255 - c) * w);
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
 * Result: DMX R=100+(255-100)/2=177 G=155 + (255-155)/2=205 B= 255 + (255-255)/2= 255 W152
 * Screen R=177 G=205 B= 255
 * @returns {*}
 */
function saturationRgbWhite() {
    var color = picker.getColor(true);
    color.r = clamp(calcColor(color.r, getDragPercent()));
    color.g = clamp(calcColor(color.g, getDragPercent()));
    color.b = clamp(calcColor(color.b, getDragPercent()));
    color.w = clamp(parseInt(getDragPercent() * 255));
    return color;
}


function clamp(value) {
    return Math.min(Math.max(value, 0), 255);
}

// c color, w white
function calcColor(c, w) {
    // Result: DMX R=100+(255-100)/2=177 G=155 + (255-155)/2=205 B= 255 + (255-255)/2= 255 W152
    return parseInt(c + (255 - c) * w);
}

var cachePerc = 0;

// Return the percentage of the drag bar position
function getDragPercent() {
    var perc = $("#drag-bar").position().left / ($("#drag-bar-container").width() - $("#drag-bar").width());
    if (Number.isNaN(perc) || $("#drag-bar-container").width() === 0) {
        return cachePerc;
    }
    perc = Math.min(1,perc);
    cachePerc = perc;
    return perc;
}

/**
 * https://stackoverflow.com/questions/40312216/converting-rgb-to-rgbw/40318604#40318604
 */
function rgbToRgbw() {
    var colorPicker = picker.getColor(true);
    var Ri = colorPicker.r;
    var Gi = colorPicker.g;
    var Bi = colorPicker.b;

    // just use the white slide bar, no math
    return {r: Ri, g: Gi, b: Bi, w: parseInt(white)};


    //Get the maximum between R, G, and B
    var tM = Math.max(Ri, Math.max(Gi, Bi));

//If the maximum value is 0, immediately return pure black.
    if (tM === 0) {
        return {r: 0, g: 0, b: 0, w: 0};
    }

//This section serves to figure out what the color with 100% hue is
    var multiplier = 255.0 / tM;
    var hR = Ri * multiplier;
    var hG = Gi * multiplier;
    var hB = Bi * multiplier;

//This calculates the Whiteness (not strictly speaking Luminance) of the color
    var M = Math.max(hR, Math.max(hG, hB));
    var m = Math.min(hR, Math.min(hG, hB));
    var Luminance = ((M + m) / 2.0 - 127.5) * (255.0 / 127.5) / multiplier;

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
    return {r: Ro, g: Go, b: Bo, w: Wo};
}

/**
 * figure out the brightest color values
 * @returns {string} css
 */
function topColor() {

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
