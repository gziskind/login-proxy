var https = require('https');
var request = require('request');
var fs = require('fs');
var querystring = require('querystring');
var Cookies = require('cookies');

var pages = {
  login: fs.readFileSync('./public/login.html'),
  fontawesome: fs.readFileSync('./public/fontawesome.css'),
  reset: fs.readFileSync('./public/reset.css')
};

var fonts = {
  "webfont-ie.eot": fs.readFileSync('./public/fontawesome-webfont-ie.eot'),
  "webfont.eot": fs.readFileSync('./public/fontawesome-webfont.eot'),
  "webfont.svg": fs.readFileSync('./public/fontawesome-webfont.svg'),
  "webfont.ttf": fs.readFileSync('./public/fontawesome-webfont.ttf'),
  "webfont.woff": fs.readFileSync('./public/fontawesome-webfont.woff'),
}

var config = parseConfig();

function handler(req, res) {
  var body = "";
  req.on('data', function (chunk) {
    body += chunk;
  });

  req.on('end', function() {
    var cssMatch = req.url.match( /\/(fontawesome|reset)[.]css/)
    var fontMatch = req.url.match(/\/fontawesome-(.+)/)
    if(cssMatch) {
      res.writeHeader(200, {"Content-Type": "text/css"});  
      res.write(pages[cssMatch[1]]);
      res.end();
    } else if(fontMatch) {
      res.write(fonts[fontMatch[1]]);
      res.end();
    } else if(req.url == '/login') {
      handleLogin(req, res, body);
    } else {
      handleOther(req, res, body);
    }
  });

}

function handleLogin(req, res, body) {
  var cookies = new Cookies(req, res, {secure:true, keys:["BLAH"]});

  var params = querystring.parse(body);
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
    console.info("Login attempt from [" + params.username + "]");
    res.write('Invalid Login.');
    res.end();
  }
}

function handleOther(req, res, body) {
  if(checkAuth(req, res)) {
    req.headers['Authorization'] = createAuthorization();
    delete req.headers.host

    var params = {
      uri: config.serverUrl + req.url,
      method: req.method,
      headers: req.headers,
      body: body
    }

    var response = request(params);
    response.pipe(res);
  } else {
    res.writeHeader(200, {"Content-Type": "text/html"});  
    res.write(pages.login);
    res.end();
  }
}

function checkAuth(req, res) {
  var cookies = new Cookies(req, res, {secure:true, keys:["BLAH"]});
  if(cookies.get('auth_' + config.application, {signed:true}) == config.username) {
    return true;
  } else {
    return false;
  }
}

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

https.createServer(options,handler).listen(config.port);
