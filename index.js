/*YASE entry */
var yase=require('./yase'); // do not invoke with new 
var Yasew=require('./yasew');
var Yasebuild=require('./yasebuild');
var splitter=require('./splitter');
var splitter2=require('./splitter2');
var customfunc=require('./yasecustom');
var api=require('./yase_api');
var schema=require('./schema');
var Genschema=require('./genschema');
var version=require('./package.json').version;
module.exports={use:yase, create: Yasew, build: Yasebuild,
	customfunc:customfunc, schema:schema, splitter:splitter, splitter2:splitter2,
	 api: api, Genschema: Genschema, version:version};