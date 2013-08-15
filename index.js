/*YASE entry */
var yase=require('./yase'); // do not invoke with new 
var Yasew=require('./yasew');
var Yasebuild=require('./yasebuild');
var customfunc=require('./yasecustom');
var api=require('./yase_api');
var schema=require('./schema');
var Genschema=require('./genschema');
module.exports={use:yase, create: Yasew, build: Yasebuild,
	customfunc:customfunc, schema:schema, api: api, Genschema: Genschema};