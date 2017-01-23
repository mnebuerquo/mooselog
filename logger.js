var ulid = require('ulid');
var onFinished = require('on-finished');
var log4js = require('log4js');
var levels = log4js.levels;

function getUrl(req) {
	return req.originalUrl || req.url;
}

function getRemoteAddr(req){
	return req.headers['x-forwarded-for'] ||
		req.ip ||
		req._remoteAddress ||
		(req.socket &&
			(req.socket.remoteAddress ||
				(req.socket.socket && req.socket.socket.remoteAddress)
			)
		);
}

function getTimeElapsed(req){
	return ( new Date() - req._logprops.time );
}

function logMessage(logger, req, res, message=null, level=null){

	if(!level){
		if( message instanceof Error ){
			level = levels.ERROR;
		} else {
			level = levels.INFO;
		}
	}

	var supermessage = {
		cid: req._logprops.ulid,
		date: new Date().toISOString(),
		url: getUrl(req),
		hostname: req.hostname,
		protocol: req.protocol,
		httpVersion: req.httpVersionMajor + '.' + req.httpVersionMinor,
		method: req.method,
		remoteAddr: getRemoteAddr(req),
		userAgent: req.headers['user-agent'],
		referrer: req.headers.referer || req.headers.referrer || '',
		userId: (req.user && req.user.id) || null,
		contentLength:
			onFinished.isFinished(res) ? (
				(res._headers && res._headers['content-length']) ||
					(res.__headers && res.__headers['Content-Length']) || null
			) : null,
		statusCode:
			onFinished.isFinished(res) ? (
				res.__statusCode || res.statusCode || null ) : null,
		timeElapsed: getTimeElapsed(req),
		responseTime:
			onFinished.isFinished(res) ? (
				getTimeElapsed(req) ) : null,
		message: message,
	};

	logger.log(level, supermessage);
}

function prepareRequest(req, res, logger){
	if(!req._logprops){
		// set up for our automatic logging
		req._logprops = {
			ulid: ulid(),
			log: logMessage.bind(null, logger, req, res),
			started: false,
			time: new Date(),
		};

		// this is a convenience function
		req.log = req._logprops.log;

		// queue log for finishing up
		var log = req._logprops.log;
		onFinished(req, function(err, req){
			if(err){
				log(err, levels.ERROR)
			}
			log("request finished")
		});
		onFinished(res, function(err, res){
			if(err){
				log(err, levels.ERROR)
			}
			log("response finished")
		});
	}
}

function getMiddleware(){
	var logger = this;
	return function(req, res, next){
		// make sure log properties have been added to request
		prepareRequest(req, res, logger);

		// in case we have the middleware registered twice
		if(req._logprops.started){
			return next();
		}
		req._logprops.started = true;

		// log first message to show request was received
		req._logprops.log("request received");
		return next();
	}
}

function getErrorMiddleware(logger){
	return function(err, req, res, next){
		prepareRequest(req, res, logger);
		req._logprops.log(err, levels.ERROR);
		return next(err);
	}
}

function init(config){

	var options = {
		"appenders": [
		{ 
			"category": "logstash",
			"type": "console" 
		},
		{
			"category": "logstash",
			"type": "log4js-logstash",
			"host": (config.logger && config.logger.host) || "localhost",
			"port": (config.logger && config.logger.port) || 5000,
			"fields": (config.logger && config.logger.fields) || {},
			"messageParam" : 'msg',
		}
		]
	};
	log4js.configure( options );
	var logger = log4js.getLogger('logstash');

	// wrap the log function so it converts a string arg to 
	// an object with a message
	var logfn = logger.log;
	logger.log = (function(){
		var args = Array.prototype.slice.call(arguments);
		console.log(args);
		var level = args[0];
		var rest = args.slice(1);
		if(typeof args[0] === 'string' || args[0] instanceof String){
			args[0] = {message: args[0]};
		}
		rest.unshift(level);
		logfn.apply(this,rest);
	}).bind(logger);

	logger.getMiddleware = getMiddleware.bind(logger);
	logger.getErrorMiddleware = getErrorMiddleware.bind(logger);

	return logger;
}

module.exports = init;
