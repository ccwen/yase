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
        	config.output=config.output || config.input.substring(0,config.input.length-4)+'.ydb';

        	//get build number if old ydb exists
    var oldbuild=0;
    if (fs.existsSync(config.output)) {
		var ydb_old=new require('yadb').open(config.output);
		oldbuild=ydb_old.get(['meta','build']) || 0;
		ydb_old.free();
    }

        	var ydb=new Yasew(config);
        	config.schema=config.schema || "TEI";
        	
        	config.encoding=config.encoding||"utf8";
        	if (config.moveupdir) config.output='../'+config.output;
        	if (typeof config.schema=='function') {
        		var s=new require('yase').Genschema();
        		config.schema.call(s);
        		config.schema=s.get();
        	}
	if (typeof config.schema=='string') {
		stock=Schema[config.schema];
		if (!stock) {
			console.log('scheme '+config.schema+' not found');
			return;
		}
		ydb.setschema(stock);//stock schema
	} else if (typeof config.schema=='object') ydb.setschema(config.schema);
	else throw 'no schema';
	
	if (config.customfunc) ydb.setcustomfunc( config.customfunc );	
	else  			ydb.setcustomfunc( require('./yasecustom') );

        	for (var i in files) {
        		ydb.addfilebuffer(fs.readFileSync(files[i],config.encoding),  files[i]);
        		ydb.construct();	
        	}

	ydb.output.meta.build=oldbuild+1;
	ydb.save(config.output);

	return JSON.parse(JSON.stringify(ydb.output.meta)); //prevent memory leak
}