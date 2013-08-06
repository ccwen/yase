/*
	better tag support, finer granularity 

	split(/。，/); //split the input file into sentences.
	textseq is a continuos number.
	each posting = textseq<<blockshift + offset_in_sentence

	multilevel id . each id point to a posting
	user may choose to remove or keep tag during indexing.

	<pb ed="xx" n="xx"/> will probably removed.
	pb(xx) : {
		1:  { '20a' : posting ,'20b':posting ,'21a':posting },
		2:  { '20a' : posting ,'20b':posting ,'21a':posting },
	}
	2013/5/4

  default worker for building YA
*/
var Yadb3w=require('./yadb3w.js');	
var fs=require('fs');
var path=require('path');
var Invert=require('./invert4');
var Yadmworker=require('./yasew');

var log=function(status,msg) { //send log to browser
	status.log.push(msg);
	console.log(msg);
}
var outback = function (s) {
    while (s.length < 70) s += ' ';
    var l = s.length; 
    for (var i = 0; i < l; i++) s += String.fromCharCode(8);
    process.stdout.write(s);
}

var initstatus=function(status) {
	status.tokencount=0;  //total token count
	status.lineprocessed=0; //total line processed
}

var processfile=function(fn,session,callback) {
	outback(fn);
    //console.log('processing '+fn);
	session.status.nline=0; //line number of this file
	var absfn=fn;
	if (session.request.datadir) {
		absfn=path.resolve(session.request.datadir,fn);
	}
	var s = fs.readFileSync(absfn,session.request.encoding);
	session.taginfo=session.request.taginfo;
	//session.indexcrlf=true;
	//session.crlfreplacechar='';
	session.slotperbatch = session.meta.slotperbatch;
	//session.crlfperbatch = session.meta.crlfperbatch;
	Yadmworker.parsefile(session,s);
	//console.log('number of sentences',session.sentences.length)
	Yadmworker.build(session);
	//console.log('slottext length',session.slottexts.length)
	callback(0);
}


var initialize=function(session,callback) {
	initstatus(session.status);
	session.meta=session.meta || {};
	session.meta.slotperbatch=256;
	//session.meta.crlfperbatch=1024;
	if (!session.customfunc.splitter) {
		session.customfunc.splitter = require('../ksanadb/splitter');
	}

	yadb3=	new Yadb3w(session.request.outputfilename,session.request);
	var strencoding=session.request.ydbencoding||session.request.encoding||'utf8'
	yadb3.stringEncoding(strencoding);	
	yadb3.openObject();
	var invertopts={splitter:session.customfunc.splitter||splitter,blockshift:session.meta.blockshift};
	session.invert=Invert.create(invertopts);
	Yadmworker.initialize(session);
	log(session.status,'default ydb worker initialized',true);
	setImmediate( function() {callback(0);});	
	console.time('scanfile');
}
var packcustomfunc=function(session) {
	var customfunc={};
	for (var i in session.customfunc) {
	//function name is removed after toString()
	//need to add return in the beginning for 
	// new Function() in dmload of yadm.js to work properly
		customfunc[i]='return '+session.customfunc[i].toString();
	}
	return customfunc;
}

var packmeta=function(session) {
	var meta=session.meta;
	meta.builddatetime=(new Date()).toString();
	meta.slotcount=session.slotcount;
	meta.version=0x20130615;
	return meta;
}
var finalize=function(session) {
	Yadmworker.finalize(session);
	//console.log('f',session.status.userbreak);
	if (session.status.userbreak) {
		log(session.status,'user break, not finalizing');
		return;
	}
	log(session.status,'finalizing');

	console.timeEnd('scanfile');
	console.time('inverted index');
	inverted=session.invert.postings;
	
	if (session.customfunc.processinverted) {
		//log(session.status,'process invert');
		inverted=session.customfunc.processinverted(inverted);
	}
	//console.log( JSON.stringify(inverted,'',' '));
	console.timeEnd('inverted index');
	
	var meta=packmeta(session);
	yadb3.save(meta,'meta',{integerEncoding:'variable'});
	yadb3.save(packcustomfunc(session),'customfunc'); 
	console.log('\nWriting...')
	console.log('meta',yadb3.currentsize());

	console.time('writing');
	yadb3.save(session.slottexts,'texts');
	//console.log(session.slottexts)
	console.log('texts',yadb3.currentsize());
	yadb3.save(inverted,'postings',{integerEncoding:'delta'});
	console.log('postings',yadb3.currentsize());
	//console.log(JSON.stringify(session.tags))
	yadb3.save(session.tags,'tags',{integerEncoding:'variable'});
	console.log('tags',yadb3.currentsize());
	/*
	yadb3.save(session.crlf,'crlf',{integerEncoding:'delta'});
	console.log('crlf',yadb3.currentsize());
	console.log(session.crlf)
	yadb3.save(session.crlfoffset,'crlfoffset',{integerEncoding:'variable'});
	console.log('crlfoffset',yadb3.currentsize());
	yadb3.save(session.crlfstart,'crlfstart',{integerEncoding:'delta'});
	console.log('crlfstart',yadb3.currentsize());
	*/
	yadb3.free();

	session.response.outputfilename=session.request.outputfilename;
	session.response.slotcount=session.slotcount;
	session.response.extraslot=session.extraslot;
	//session.response.outputfilesize=fs.statSync(session.response.outputfilename).size;
	console.timeEnd('writing');
}

//export the job handler
exports.initialize=initialize;
exports.processfile=processfile;
exports.finalize=finalize;
