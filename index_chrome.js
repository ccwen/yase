/*YASE entry */
var yase=require('./yase'); // do not invoke with new 
var api=require('./yase_api');
var version='0.2.0';
var search=require('./search');
var plist=require('./plist');

module.exports={use:yase,  api: api, version:version, 
	 plist:plist,search:search};