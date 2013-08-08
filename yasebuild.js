/*
	build by configuration
*/
var Yasew=require('./yasew');
var Schema=require('./schema');
var fs=require('fs');
var getfiles=function( filelist , maxfile) {
	var files=fs.readFileSync(filelist,'utf8').replace(/\r\n/g,'\n').split('\n');
	var output=[];
	var maxfile=maxfile||0;
	for (var i=0;i<files.length;i++) {
		if (!files[i].trim()) continue;
		if (files[i].charAt(0)==';') continue;
		output.push(files[i]);
		if (maxfile && output.length>=maxfile) break;
	}
	return output;
}

module.exports=function( config ) {
	if (!config.input) {
		console.warn('missing input file');
		return;
	}
	var files=[];
	if (config.input.substring(config.input.length-4)=='.lst') files=getfiles(config.input,config.maxfile);
	else files=[config.input];

        	var ydb=new Yasew(config);
        	config.schema=config.schema || "TEI";
        	
        	config.encoding=config.encoding||"utf8";
        	config.output=config.output || config.input.substring(0,config.input.length-4)+'.ydb';
	if (typeof config.schema=='string') {
		stock=Schema[config.schema];
		if (!stock) {
			console.log('scheme '+config.schema+' not found');
			return;
		}
		ydb.setschema(stock);//stock schema
	} else ydb.setschema(config.schema)
	
	if (config.customfunc) ydb.setcustomfunc( config.customfunc );	
	else  			ydb.setcustomfunc( require('./yasecustom') );

        	for (var i in files) {
        		ydb.addfilebuffer(fs.readFileSync(files[i],config.encoding));
        		ydb.construct();	
        	}
	
	ydb.save(config.output);

	return JSON.parse(JSON.stringify(ydb.output.meta)); //prevent memory leak
}