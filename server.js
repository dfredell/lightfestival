/*server.js*/
const http = require('http');
const hostname = '127.0.0.1';
const os = require('os');
var port = 80;
if(os.release().indexOf('MANJARO')>0){
    port = 8080;
}
const fs = require('fs');
const url = require('url');
var requirejs = require('requirejs');
const path = require('path') // For working with file and directory paths
var request = require('request');
const { parse } = require('querystring');

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
    // fs.readFile('src/demofile1.html', function(err, data) {
    //     res.writeHead(200, {'Content-Type': 'text/html'});
    //     res.write(data);
    //     res.end();
    // });
    //
    // res.write(req.url);
    //
    // res.end('Hello World\n');

});
server.listen(port, function () {
    console.log('Server running at http://' + hostname + ':' + port + '/');
});


function submitColor(req, res) {
    var body = '';
    req.on('data', function(data) {
        body += data;
        console.log('Partial body: ' + body);
    });
    req.on('end', function() {
        console.log("Submitted color " + body);
        console.log('Body: ' + body);
        res.writeHead(200, {'Content-Type': 'application/json'});

        var data = {};
        data.img = 'map1.png';
        res.write(JSON.stringify(data));
        res.end();
    })
}


function submitTimer(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});

    var now = new Date();
    var nowSec = now.getUTCSeconds();
    var nowMin = now.getUTCMinutes();
    var remainingMin = 2-(nowMin%3);

    var data = {};
    data.minutes = remainingMin;
    data.seconds = 60 - nowSec;
    res.write(JSON.stringify(data));
    res.end();
}

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
            fs.writeFile("settings.json", JSON.stringify(parse(body)), function(){});
            res.write("Success");
            res.end();
        })
}

function currentRgbchannels(req, res) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    var content = fs.readFileSync("settings.json");
    res.write((content));
    res.end();
}

function sendRgbDmx(startChannel, rgbValues){

    var clientServerOptions = {
            uri: 'http://localhost:9090/set_dmx',
            body: JSON.stringify(postData),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        }
    request(clientServerOptions, function (error, response) {
        console.log(error,response.body);
        return;
    });

}