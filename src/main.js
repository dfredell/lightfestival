var CodeMirrorColorPicker = require('codemirror-colorpicker');
var Timer = require('easytimer.js').Timer;
var $ = require('jquery');
window.jquery = $;
const invert = require('invert-color');
require("./admin.js");
var white = 0;

var picker;

$(document).ready(function() {

    window.console.log("Starting color picker");
    document.body.requestFullscreen();

    if ($('#color-container').length) {
        setupTimer();
        setupSubmit();
        setupVerify();
        setupPicker();
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
    var color = mergeRgbWhite();
    var cssColor = getCssColor(color);
    $(".drag-bar").css('background-color', picker.getColor());
    $(".drag-pointer,#send-color").css('background-color', cssColor);
    $("#send-color").attr("disabled", false);
    $(".value-container").css('background-image','linear-gradient(to left, #ffffff 0%, '+picker.getColor()+' 100%)');
}

function mergeRgbWhite(){
    var color = picker.getColor(true);
    color.r = calcColor(color.r,getDragPercent());
    color.g = calcColor(color.g,getDragPercent());
    color.b = calcColor(color.b,getDragPercent());
    return color;
}

function setupPicker() {
    setTimeout(setupPickerDelay, 100);
    picker = new CodeMirrorColorPicker.create({
        position: 'inline',
        container: document.getElementById('color-container'),
        type: 'macos',
        color: 'rgb(250,250,250)',
        // gradient: 'linear-gradient(to right, white 0%, green 100%)',
        // outputFormat: 'hex',
        hideDelay: 0,
        onHide: function (c) {
            console.log('hide', c)
        },
        onChange: function (c) {
            // console.log('change', c);
            updateColors();
        }
    });

}

// setup drag bar after the rest of the page is set
function setupPickerDelay() {
    var element = $('#drag-bar')[0];
    var options = {
        grid: 10,
        onDrag: function(e){
            // window.console.log(e);
            white = getDragPercent() * 255;
            updateColors();
        },
        limit: {x:[0,$("#drag-bar-container").width()- $('#drag-bar').width() - 4],
            y: $('#drag-bar').position().top}
    };
    var draggable = require("draggable");

    new draggable(element, options);
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
    var color = mergeRgbWhite();
    var cssColor = getCssColor(color);
    window.console.log("Submit color" + color);
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
    picker.getColor(true);
    var color = mergeRgbWhite();
    var cssColor = getCssColor(color);
    window.console.log("Submit color" + cssColor);
    color.w = parseInt(white);
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

var cachePerc = 0;
// Return the percentage of the drag bar position
function getDragPercent(){
    var perc = $("#drag-bar").position().left/ $("#drag-bar-container").width();
    if (Number.isNaN(perc)){
        return cachePerc;
    }
    cachePerc = perc;
    return perc;
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
