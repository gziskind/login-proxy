var http = require('http');
var request = require('request');
var fs = require('fs');
var querystring = require('querystring');
var Cookies = require('cookies');
var ini = require('ini');

var loginPage = fs.readFileSync('./login.html');
var config = parseConfig('config.ini');

function handler(req, res) {
	var body = "";
	req.on('data', function (chunk) {
	  body += chunk;
	});

	req.on('end', function() {
		if(req.url == '/login') {
			handleLogin(req, res, body);
		} else {
			handleOther(req, res, body);
		}
	});

}

function handleLogin(req, res, body) {
	var cookies = new Cookies(req, res);

	var params = querystring.parse(body);
	if(params.username == config.username && params.password == config.password) {
		cookies.set('auth', config.username, {expires:new Date(new Date().getTime() + 1000*60*60*24*100)});
		res.writeHead(302, {
		  'Location': '/'
		});
		res.end();
	} else {
		res.write('Invalid Login.');
		res.end();
	}
}

function handleOther(req, res, body) {
	if(checkAuth(req, res)) {
		req.headers['Authorization'] = createAuthorization();

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
		res.write(loginPage);
		res.end();
	}
}

function checkAuth(req, res) {
	var cookies = new Cookies(req, res);
	if(cookies.get('auth') == config.username) {
		return true;
	} else {
		return false;
	}
}

function parseConfig(filePath) {
	if(fs.existsSync(filePath)) {
		return ini.parse(fs.readFileSync(filePath, 'utf-8'));
	} else {
		console.info("Please create a config.ini file.");
		process.exit();
	}
}

function createAuthorization() {
	return "Basic " + new Buffer(config.username + ":" + config.password).toString('base64');
}

http.createServer(handler).listen(config.port);