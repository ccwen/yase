/*
	build by configuration
*/
var Yasew=require('./yasew');
var blob=require('./blob');
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
var outback = function (s) {
    while (s.length < 70) s += ' ';
    var l = s.length; 
    for (var i = 0; i < l; i++) s += String.fromCharCode(8);
    process.stdout.write(s);
}
module.exports=function( config ) {
	if (!config.input) {
		console.warn('missing input file');
		return;
	}
	var files=[],blobs={},fileprefix='';
	if (config.input.substring(config.input.length-4)=='.lst') {
		files=getfiles(config.input,config.maxfile);
		var lstpath=require('path').dirname(config.input);
		if (lstpath!='.') {
			fileprefix=lstpath+'/';
		}		
	}
	else files=[config.input];
    config.output=config.output || config.input.substring(0,config.input.length-4)+'.ydb';

    //get build number if old ydb exists
    var oldbuild=0;
    if (fs.existsSync(config.output)) {
 		var stats = fs.statSync(config.output)
 		if (stats.size>0) {
			var ydb_old=new require('yadb').open(config.output);
			oldbuild=ydb_old.get(['meta','build']) || 0;
			ydb_old.free();
 		}
    }

	var ydb=new Yasew(config);

	
	config.encoding=config.encoding||"utf8";
	if (config.moveupdir) config.output='../'+config.output;
	
	var customfunc=require('./yasecustom');
	if (config.customfunc) {
		for (var i in config.customfunc) customfunc[i]=config.customfunc[i]
	}
	ydb.setcustomfunc( customfunc );	

    for (var i in files) {
    	outback(files[i]);
       	ydb.indexbuffer(fs.readFileSync(fileprefix+files[i],config.encoding),  files[i]);
    }

    if (config.blob) blob.add(config.blob,ydb.output);

    ydb.output.extra=config.extra||0;
	ydb.output.meta.build=oldbuild+1;
	ydb.save(config.output, {encoding:config.outputencoding,size:config.estimatesize});

	return JSON.parse(JSON.stringify(ydb.output.meta)); //prevent memory leak
}