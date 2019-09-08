var CodeMirrorColorPicker = require('codemirror-colorpicker');
var Timer = require('easytimer.js').Timer;
var $ = require('jquery');
const invert = require('invert-color');

var picker;

window.onload = function () {

    window.console.log("Starting admin");
    // document.body.requestFullscreen();

    if($('#rgb-channels')) {
        setupChannels();
    }

};


function setupChannels(){
    window.console.log("getting original channels");
    $.ajax({
        url: '/currentrgbchannels',
        contentType: 'application/json',
        method: 'GET',
        json: 'json'
    }).done(function( msg ) {
        $("#rgbchannels").val(msg.rgbchannels);
        $("#parkedchannels").val(msg.parkedchannels);
        $("#fadetime").val(msg.fadetime);
        $("#waittime").val(msg.waittime);
    });
}

module.exports = onload;
