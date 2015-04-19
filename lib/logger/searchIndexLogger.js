var winston = require('winston');

var searchIndexLogger;

if (winston) {
	searchIndexLogger = module.exports =  new (winston.Logger)({
	  transports: [
	    new (winston.transports.Console)({})
	  ]
	});
} else {
	searchIndexLogger = console;
}