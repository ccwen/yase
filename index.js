/*YASE entry */
var Yase=require('./yase');
var Yasew=require('./yasew');
var Yasebuild=require('./yasebuild');
var customfunc=require('./yasecustom');
var schema=require('./schema');
module.exports={open:Yase, create: Yasew, build: Yasebuild,customfunc:customfunc, schema:schema};