var CodeMirrorColorPicker = require('codemirror-colorpicker');
var Timer = require('easytimer.js').Timer;
var $ = require('jquery');
window.jquery = $;
const invert = require('invert-color');
var md5 = require('md5');

var draggable;
var picker;
var white = 0;
let hugCooldown = "hug-cooldown";
let hugSelectedColor = "hug-selected-color";
// Time window when the user can submit new colors
// time is in 24h clock to the user's browser
let timeFrame = {"starttime":701,"endtime":700};
// The time the user has to wait between being able
// to submit new colors in minutes
let cooldown = 5;

$(document).ready(function () {
    draggable = require("draggable");
    $.ajaxSetup({ cache: false });

    window.console.log("Starting color picker");
    setupEnter();

    if ($('#color-container').length) {
        setupSubmit();
        setupVerify();
    }

    if ($('#position-image').length) {
        setupPositionImage();
    }

});


function getCssColor(color) {
    return 'rgb(' + color.r + ',' + color.g + ',' + color.b + ')';
}

function updateColors() {
    var color = saturationRgbWhite();
    // var color = picker.getColor(true);
    var cssColor = getCssColor(color);
    $(".drag-bar").css('background-color', cssColor);
    $(".drag-pointer").css('background-color', cssColor);
    $("h1.select-color").css('color', cssColor);
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

function submitColor() {
    // var color = picker.getColor(true);
    var color = saturationRgbWhite();
    var cssColor = getCssColor(color);
    window.console.log("Verify color" + JSON.stringify(color));
    // window.location.replace('verify?color=' + color.r +"");
    $(".base-screen").hide();
    $("#verify-color-screen").show();
    $(".base-screen").css("background-color", cssColor);
}

function getTimeFrame() {
    $.ajax({
        url: '/timeframe',
        contentType: 'application/json',
        method: 'GET',
        json: 'json',
        async: false
    }).done(function( msg ) {
        timeFrame = msg;
    });
}

function setupEnter() {
    // getTimeFrame();
    $('#enter-button').on('click', function () {
        let cooldown = checkCooldown();
        let nowTime = new Date().getHours()*100 + new Date().getMinutes();
        let activeShow = timeFrame
            && (timeFrame.starttime < nowTime
                || timeFrame.endtime > nowTime);
        if (cooldown >= new Date().getTime()) {
            $('#submit-cooldown').html(cooldown.toLocaleTimeString());
            let oldColor = localStorage.getItem(hugSelectedColor);
            if (oldColor) {
                $("#show-cooldown-screen,#show-social-media-screen").css("background-color", oldColor);
            }
            countdownToSocialMedia();
            $(".base-screen").hide();
            $('#show-cooldown-screen').show();
        } else if (!activeShow) {
            $('#time-from').html(formatTime(timeFrame.starttime));
            $('#time-to').html(formatTime(timeFrame.endtime));
            $(".base-screen").hide();
            $('#show-timeframe-screen').show();
        } else {
            $(".base-screen").hide();
            $('#select-color-screen').show();
            $("p.timer").show();
            $("p.timer").css('color', 'white');
            setupPicker();
        }
    });
}

/**
 *
 * @param time 900
 * @returns {string} 9:00
 */
function formatTime(time){
    let a = time.toString();
    return a.slice(0,a.length-2) + ":" + a.slice(a.length-2,a.length)
}

function setupSubmit() {
    $('#send-color').on('click', submitColor);
}

function setupVerify() {
    $('#verify-yes').on('click', verifyYes);
    $('#verify-no').on('click', verifyNo);
}

function verifyNo() {
    $(".base-screen").hide();
    $("#select-color-screen").show();
    $("p.timer").css('color', 'white');
}

/**
 * Set the user's cookie to wait
 * @param date
 */
function setCooldownCookie(date) {
    localStorage.setItem(hugCooldown, date.getTime() + "");
}

/**
 * check the cooldown time
 */
function checkCooldown() {
    let item = localStorage.getItem(hugCooldown);
    if (item === null){
        item = 0;
    }
    return new Date(parseInt(item));
}

/**
 * submit rgb color to the Keun server
 */
function verifyYes() {
    // var color = picker.getColor(true);
    var color = saturationRgbWhite();
    var cssColor = getCssColor(color);
    window.console.log("Submit color rgb  " + JSON.stringify(color));
    $("#sending-color-screen").css("background-color", cssColor);
    $("#show-color-screen").css("background-color", cssColor);
    $("#show-color-error-screen").css("background-color", cssColor);

    // show sending... screen
    $(".base-screen").hide();
    $("#sending-color-screen").show();


    let url = calcKurnUrl(color.r + "," + color.g + "," + color.b);
    window.console.log("Submitting to url " + url);

    $.ajax({
        url: url,
        method: 'POST',
        crossDomain : true,
        tryCount: 0,
        retryLimit: 0,
        success: function () {
            $(".base-screen").hide();
            $("#show-color-screen").show();

            // let date = new Date(msg.date);
            // $(".color-date").html(date.toLocaleString());
            $("p.timer").hide();

            // set when the user can submit again
            setCooldownCookie(new Date(new Date().getMinutes() + cooldown));
            localStorage.setItem(hugSelectedColor, cssColor);

            countdownToColumns();
            setTimeout(setupPreviewColumns, 1500);
        },
        error: function (msg) {
            window.console.log("Error sending color " + JSON.stringify(msg));
            this.tryCount++;
            if (this.tryCount <= this.retryLimit) {
                //try again
                $.ajax(this);
                return;
            }
            $(".base-screen").hide();
            $("#show-color-screen").show();
            $("p.timer").hide();
            $("#show-color-screen .countdown-timer").html("ERROR<br/>Please refresh and try again");
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
 * wait 5 sec then show social media page
 */
function countdownToSocialMedia(){
    // setup countdown
    var timer = new Timer();
    timer.start({countdown: true, startValues: {seconds: 10}});
    var text =  timer.getTimeValues().seconds;
    $(".countdown-timer").html(text);

    timer.addEventListener('secondsUpdated', function (e) {
        var text = timer.getTimeValues().seconds;
        $(".countdown-timer").html(text);
    });
    timer.addEventListener('targetAchieved', function (e) {
        timer.stop();
        $(".base-screen").hide();
        $('#show-social-media-screen').show();
    });
}


/**
 * wait 7 sec then show screenshot page
 */
function countdownToScreenshot(){
    // setup countdown
    var timer = new Timer();
    timer.start({countdown: true, startValues: {seconds: 5}});
    var text =  timer.getTimeValues().seconds;
    $(".countdown-timer").html(text);

    timer.addEventListener('secondsUpdated', function (e) {
        var text = timer.getTimeValues().seconds;
        $(".countdown-timer").html(text);
    });
    timer.addEventListener('targetAchieved', function (e) {
        timer.stop();
        $(".base-screen").hide();
        $('#show-screenshot-screen').show();
        countdownToColumns()
    });
}

/**
 * wait 7 sec then show screenshot page
 */
function countdownToColumns(){
    // setup countdown
    var timer = new Timer();
    timer.start({countdown: true, startValues: {seconds: 5}});
    var text =  timer.getTimeValues().seconds;
    $(".countdown-timer").html(text);

    timer.addEventListener('secondsUpdated', function (e) {
        var text = timer.getTimeValues().seconds;
        $(".countdown-timer").html(text);
    });
    timer.addEventListener('targetAchieved', function (e) {
        timer.stop();
        $(".base-screen").hide();
        $('#show-color-column-screen').show();
        countdownToSocialMedia()
    });
}
var sendcolor;
function sendfac(csv) {
	//KEUN ADD CODE FOR F4C
	let secretKey = "123456789";
	let nameapp = "F4C";
	let hash = md5(nameapp + sendcolor + "," + csv + secretKey);

	let url = "https://www.arteamicalights.it/bulgari/addscore.php?ID=34&NOME=" + nameapp + "&SCORE=" + sendcolor + "," + csv + "&hash=" + hash;

	$.ajax({
		url: url,
		method: 'POST',
		crossDomain: true,
		tryCount: 0,
		retryLimit: 0,
		success: function () {
		},
		error: function (msg) {
			window.console.log("Error sending color " + JSON.stringify(msg));
			this.tryCount++;
			if (this.tryCount <= this.retryLimit) {
				//try again
				$.ajax(this);
				return;
			}

		}
	});
	//KEUN ADDED CODE FOR F4C

}

/**
 * Get the newest 5 colors from the server
 * this is a preview of what the user will see
 */
function setupPreviewColumns(){
    $.ajax({
        url: 'https://www.arteamicalights.it/bulgari/display3.php',
        method: 'GET',
        crossDomain : true,
        success: function (csv) {
             let msg = csv.split(',');
			//ADD KEUN
             sendfac(csv);
             $(".column-" + 0).html("");//new Date(msg[i].date._seconds*1000).toLocaleString());
             $(".column-" + 0).css("background-color", "rgb(" + sendcolor + ")");
			//ADDED KEUN

             $(".column-"+1).html("");//new Date(msg[i].date._seconds*1000).toLocaleString());
             $(".column-" +1).css("background-color", "rgb(" + msg[0] + "," + msg[1] + "," + msg[2] + ")");
             $(".column-" + 2).html("");//new Date(msg[i].date._seconds*1000).toLocaleString());
             $(".column-" + 2).css("background-color", "rgb(" + msg[3] + "," + msg[4] + "," + msg[5] + ")");
             $(".column-" + 3).html("");//new Date(msg[i].date._seconds*1000).toLocaleString());
             $(".column-" + 3).css("background-color", "rgb(" + msg[6] + "," + msg[7] + "," + msg[8] + ")");
             $(".column-" + 4).html("");//new Date(msg[i].date._seconds*1000).toLocaleString());
             $(".column-" + 4).css("background-color", "rgb(" + msg[9] + "," + msg[10] + "," + msg[11] + ")");


        },
        error: function (msg) {
            window.console.log("Error reading previous colors " + JSON.stringify(msg));

        }
    });

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
 * calc kurn data packet
 */
function calcKurnUrl(color) {

    let secretKey = "123456789";
    let nameapp ="F4C";
    let hash = md5(nameapp + color + secretKey);



    return "https://www.arteamicalights.it/bulgari/addscore.php?ID=33&NOME=" + nameapp + "&SCORE=" + color + "&hash=" + hash;
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
