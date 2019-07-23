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
            $(".drag-bar").css('background-color', c);
            $(".drag-pointer").css('background-color', c);
            $("#send-color").attr("disabled", false);
            $("#send-color").css('background-color', c);
            $(".value-container").css('background-image','linear-gradient(to left, #ffffff 0%, '+c+' 100%)');
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
            white = $("#drag-bar").position().left/ $("#drag-bar-container").width() * 255;
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
    var color = picker.getColor();
    window.console.log("Submit color" + color);
    // window.location.replace('verify?color=' + color.r +"");
    $("#select-color").hide();
    $("#verify-color").show();
    $("#verify-color").css("background-color", color);
    $(".verify-color-text").css("color", invert(picker.getColor(true)));
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
    window.console.log("Submit color" + picker.getColor(true));
    var color = picker.getColor(true);
    color.w = parseInt(white);
    $("#show-color").css("background-color", picker.getColor(false));
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
