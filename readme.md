# Moose Log

When Moose is building a node/express app, he wants to be able to log
messages with request state included in the log messages.

## Usage

This module exports an init function which returns the logger.

### Setup
```
var logger = require('mooselog')({
	"logger":{
		"host":"localhost",
		"port":5000,
		"fields": {
			"environment": "local"
		}
	}
});
```

### Log a Message
To log a message, call one of the log level functions (like with log4js):
```
logger.info("this is awesome!")

logger.error(new Error("boo! an error"))

logger.debug({foo: "bar", message: "this is debug data"})
```

### Express Middleware
To log requests in express, add it as a middleware:
```
// add the route log middleware first
app.use(logger.getMiddleware()); 

// Install other routes and middleware
app.get('/hello', function(req, res, next){
	res.json({ hello: 'world' });
});

// add the error handler middleware last
app.use(logger.getErrorMiddleware()); 
```


## Future Stuff

Features I plan to add in the future:

1. Application name
1. Additional loggers
1. Index name for elasticsearch
