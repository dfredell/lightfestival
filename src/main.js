var CodeMirrorColorPicker = require('codemirror-colorpicker');
var Timer = require('easytimer.js').Timer;
var $ = require('jquery');
const invert = require('invert-color');

var picker;

window.onload = function () {

    window.console.log("Starting color picker");
    // document.body.requestFullscreen();

    if($('#color-container').length) {
        setupPicker();
        setupTimer();
        setupSubmit();
        setupVerify();
    }

    if($('#position-image').length) {
        setupPositionImage();
        setupTimer();
    }
};

function setupPicker() {
    picker = new CodeMirrorColorPicker.create({
        position: 'inline',
        container: document.getElementById('color-container'),
        type: 'macos',
        color: 'rgb(177,177,177)',
        gradient: 'linear-gradient(to right, white 0%, green 100%)',
        // outputFormat: 'hex',
        hideDelay: 0,
        onHide: function (c) {
            console.log('hide', c)
        },
        onChange: function (c) {
            // console.log('change', c);
            $(".drag-bar").css('background-color',c);
            $(".drag-pointer").css('background-color',c);
            $("#send-color").attr("disabled", false);
            $("#send-color").css('background-color',c);
        }
    });
}
function setupTimer() {

    var now = new Date();
    var nowSec = now.getUTCSeconds();
    var nowMin = now.getUTCMinutes();
    var remainingMin = 2-(nowMin%3);

    var time = {};
    time.minutes = remainingMin;
    time.seconds = 60 - nowSec;

    // setup countdown
    var timer = new Timer();
    timer.start({countdown: true, startValues: {minutes: time.minutes,seconds:time.seconds}});
    var text = timer.getTimeValues().minutes + ":" + pad(timer.getTimeValues().seconds,2);
    $(".timer").html(text);
    timer.addEventListener('secondsUpdated', function (e) {
        var text = timer.getTimeValues().minutes + ":" + pad(timer.getTimeValues().seconds,2);
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
    $("#verify-color").css("background-color",color);
    $(".verify-color-text").css("color", invert(picker.getColor(true)));
}

function setupSubmit() {
    $('#send-color').on('click',submitColor);
}

function setupVerify() {
    $('#verify-yes').on('click',verifyYes);
    $('#verify-no').on('click',verifyNo);
}

function verifyNo() {
    $("#select-color").show();
    $("#verify-color").hide();
}

function verifyYes() {
    window.console.log("Submit color" + picker.getColor(true));
    var color = picker.getColor();
    $("#show-color").css("background-color",color);
    $.ajax({
        url: '/submitColor',
        contentType: 'application/json',
        method: 'POST',
        json: 'json',
        data: JSON.stringify(picker.getColor(true))
    }).done(function( msg ) {
        $("#verify-color").hide();
        $("#show-color").show();
        $("p.timer").hide();
        setTimeout(function () {
            window.location.href = ("/src/index.html");
        },5000)
    });
}

function setupPositionImage() {
    $('#position-image').prop('src','/src/images/' + new URLSearchParams(window.location.search).get('img'));
}

/**
 * Add zeros in front of a number
 * @param num
 * @param size
 * @returns {string}
 */
function pad(num, size) {
    var s = num+"";
    while (s.length < size) s = "0" + s;
    return s;
}
