/*
	build by configuration
*/
var Yasew=require('./yasew');
var Schema=require('./schema');
var fs=require('fs');
var wrench=require('./wrench');
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
/*add blob recursively from file system*/
var addblob=function(blobsetting, output) {
	output.blob={};
	for (var i in blobsetting) {
		var subdir=blobsetting[i];
		var blobs=wrench.readdirSyncRecursive(subdir);
		//create subfolder
		var O=output.blob[i]={};
	    for (var i in blobs) {
	        blobs[i]=blobs[i].replace(/\\/g,'/');
	        var idx=blobs[i].lastIndexOf('/');
	        if (idx>-1) {
	        	var folders=blobs[i].substring(0,idx).split('/');
	        	var o=O;
	        	for (var j in folders) {
	        		if (typeof o[folders[j]]=='undefined') o[folders[j]]={};
	        		o=o[folders[j]];
	        	}
	        }
	    }
	    //load blob
	    for (var i in blobs) {
	    	var fn=subdir+'/'+blobs[i];
	        var idx=blobs[i].lastIndexOf('/');
	        if (idx>-1) {
	        	var folders=blobs[i].substring(0,idx).split('/');
	        	var name=blobs[i].substring(idx+1);
	        	var o=O;
	        	for (var j in folders) {
	        		if (typeof o[folders[j]]=='undefined') o[folders[j]]={};
	        		o=o[folders[j]];
	        		if (!fs.statSync(fn).isDirectory())
		        		o[name]=fs.readFileSync(fn); 
	        	}

	        } else {
	        	if (!fs.statSync(fn).isDirectory())
	        		O[blobs[i]]=fs.readFileSync(fn); //root
	        }
	    }
		
		//console.log(blobs)
	}
	return O;
}
module.exports=function( config ) {
	if (!config.input) {
		console.warn('missing input file');
		return;
	}
	var files=[],blobs={};
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
	
	var customfunc=require('./yasecustom');
	if (config.customfunc) {
		for (var i in config.customfunc) customfunc[i]=config.customfunc[i]
	}
	ydb.setcustomfunc( customfunc );	

    for (var i in files) {
       	ydb.addfilebuffer(fs.readFileSync(files[i],config.encoding),  files[i]);
    	ydb.construct();	
    }

    if (config.blob) addblob(config.blob,ydb.output);

    ydb.output.extra=config.extra||0;
	ydb.output.meta.build=oldbuild+1;
	ydb.save(config.output, {encoding:config.outputencoding,size:config.estimatesize});

	return JSON.parse(JSON.stringify(ydb.output.meta)); //prevent memory leak
}