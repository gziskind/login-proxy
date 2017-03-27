var https = require('https');
var express = require('express');
var request = require('request');
var fs = require('fs');
var querystring = require('querystring');
var Cookies = require('cookies');
var bodyParser = require('body-parser');
var url = require('url');

var app = express();

app.use(express.static('public'))
app.use(bodyParser.raw({
  type: '*/*'
}));
// app.use(bodyParser.urlencoded({ extended: true }));

var config = parseConfig();

app.post('/login', function(req, res) {
  var cookies = new Cookies(req, res, {secure:true, keys:["BLAH"]});

  var params = querystring.parse(req.body.toString());
  if(params.username == config.username && params.password == config.password) {
    console.info("Logging in as [" + params.username + "]");
    cookies.set('auth_' + config.application, config.username, {
      expires:new Date(new Date().getTime() + 1000*60*60*24*100),
      secure: true,
      signed: true
    });
    res.writeHead(302, {
      'Location': '/'
    });
    res.end();
  } else {
    console.info("Login attempt from [" + req.body.username + "]");
    res.write('Invalid Login.');
    res.end();
  }
});

app.use(function(req, res, next) {
  var cookies = new Cookies(req, res, {secure:true, keys:["BLAH"]});
  if(cookies.get('auth_' + config.application, {signed:true}) == config.username) {
    next();
  } else {
    res.redirect('/login.html');
  }
});

app.all('/*', function(req, res) {
  req.headers['Authorization'] = createAuthorization();

  // Needed because passing in browser host to proxy breaks the proxy
  if(req.method == 'GET') {
    delete req.headers['host'] 
  } 

  var params = {
    uri: config.serverUrl + req.url,
    method: req.method,
    headers: req.headers
  }

  if(req.body && Object.keys(req.body).length > 0) {
    params.body = req.body;
  }

  res.oldSetHeader = res.setHeader;
  res.setHeader = function(name, val) {
    if(name == 'location') {
      // Needed to rewrite location header to have https protocol
      var location = url.parse(val);
      location.protocol = "https:";
      res.oldSetHeader(name, location.format());
    } else {
      res.oldSetHeader(name,val);
    }
  }

  var response = request(params);
  response.pipe(res);
})

function parseConfig() {
  if(process.argv.length > 2) {
    if(fs.existsSync(process.argv[2])) {
      return require('./' + process.argv[2]);
    } else {
      console.info("File cannot be found");
      process.exit();
    }

  } else {
    console.info("Please specifiy a config file.");
    process.exit();
  }
}

function createAuthorization() {
  return "Basic " + new Buffer(config.username + ":" + config.password).toString('base64');
}

var options = {
  key: fs.readFileSync(config.key),
  cert: fs.readFileSync(config.cert)
}

https.createServer(options, app).listen(config.port);

