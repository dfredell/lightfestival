
let universe = 0;
let olaurl = 'http://localhost:9090/set_dmx';
let request = require('request');

function sendBlackDmx() {
    //fill array with 0s
    let black = new Array(512).fill(0);
    let data = "u=" + universe + "&d=" + black.join(",");

    let clientServerOptions = {
        uri: olaurl,
        body: data,
        method: 'POST',
        headers: {'content-type': 'application/x-www-form-urlencoded'},

    };
    request(clientServerOptions, function (error, response) {
       console.log(error,response.body);
        return;
    });
}

sendBlackDmx();