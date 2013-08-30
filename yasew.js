var debug=false;
var DEFAULTBLOCKSHIFT=5;

var taghandlers=require('./taghandlers');
var Yadb=require('yadb');


var processtag=function(tag) {
	
	var i=0,T="";
	while (i<tag.length) {
		T+=tag[i++];
		if (tag[i-1]=='>') break;
	}

	taghandlers.dotag.apply(this, [T]);
}
var processtoken=function(text) {
	var ctx=this.context;
	var t=this.customfunc.normalizeToken(text);
	if (!ctx.postings[t]) {
		  ctx.postings[t] = [this.vpos];
		  ctx.postingcount++;
		} else {
		  ctx.postings[t].push(ctx.vpos);
	}	
}
var addslottext=function(tokencount,s) {
	var output=this.output;
	var ctx=this.context;
	var extraslot=  Math.floor( tokencount / ctx.maxslottoken ); //overflow
	if (extraslot>0) ctx.overflow.push([ctx.filename,ctx.crlfcount]);
	
	var slotgroup=Math.floor(ctx.slotcount / ctx.slotperbatch );//
	if (!output.texts[slotgroup]) output.texts[slotgroup]=[];
	output.texts[slotgroup].push(s);
	ctx.slotcount+=(1+extraslot);
	ctx.extraslot+=extraslot;
	while (extraslot--) output.texts[slotgroup].push(''); //insert null slot
}
var doslot=function(now) {
	var ctx=this.context;
	if (ctx.lastpos==now) return;
	var s=this.buffer.substring(ctx.lastpos,now)
	var tokens=this.customfunc.tokenize(s);
	ctx.consumed=0;
	ctx.tokenconsumed=0;
	ctx.vpos=ctx.slotcount*this.context.blocksize;
	for (var i=0;i<tokens.length;i++) {
		var T=tokens[i];
		if (T[0]=='<') {
			processtag.apply(this,[T]);
		} else {
			processtoken.apply(this,[tokens[i]]);
			ctx.offset++;
			ctx.vpos++;
		}
	}
	var remain=s.substring(ctx.consumed);
	this.addslottext(tokens.length-ctx.tokenconsumed,remain);
	ctx.lastpos=now;
}
var indexbuffer=function(B,fn) {
	this.buffer=B;
	this.context.filename=fn;
	var i=0,intag;
	while (i<B.length) {
		if (B[i]=='\n') this.context.crlfcount++;
		if (B[i]=='<') intag=true;
		if (this.customfunc.isBreaker(B[i]) && !intag) {
			while (B[i]
				  &&(this.customfunc.isBreaker(B[i]) || B.charCodeAt(i)<=0x20) 
				  && i<B.length) {
				i++;
			}
			doslot.apply(this,[i]);
		}
		if (B[i]=='>') intag=false;
		i++;
	}
	doslot.apply(this,[B.length]);
}

var initinverted=function(context,opts) {
	opts=opts||{};
	context.blockshift=opts.blockshift || DEFAULTBLOCKSHIFT ; //default blocksize 32
	if (context.blockshift>10) {
		console.warn('max block size is 1024, reduce your blockshift setting');
		context.blockshift=10;
	}
	context.blocksize=2 << (context.blockshift - 1);//Math.pow(2,handle.blockshift);
	console.log('BLOCKSIZE',context.blocksize)
	context.postings =  {};
	context.postingcount = 0;
	context.vpos  = 0;	
	context.offset= 0; // token offset of current slot
}

var initialize=function(options,context,output) {
	options=options||{};
	context.starttime=new Date();
	context.slotcount=0;
	context.lastpos=0;
	context.tagstack=[];
	context.tagstack_fi=[];
	context.crlfcount=0;
	context.overflow=[];
	context.totalcrlfcount=0;
	context.extraslot=0;	
	options.slotperbatch=options.slotperbatch||256;
	options.blockshift=options.blockshift||DEFAULTBLOCKSHIFT;
	context.slotperbatch=options.slotperbatch;
	output.meta=output.meta||{};
	context.maxslottoken = 2 << (options.blockshift -1);
	if (typeof output.texts=='undefined') { //first file
		output.texts=[];	
	}
	if (typeof output.tags=='undefined') output.tags={};
}
var packmeta=function(options,context,output) {
	var meta=output.meta;
	if (options.dbid) meta.dbid=options.dbid;
	if (options.author) meta.author=options.author;
	if (options.url) meta.url=options.url;
	if (options.min_yase_version) meta.min_yase_version=options.min_yase_version;
	meta.builddatetime=(new Date()).toString();
	meta.buildduration=new Date()-context.starttime;
	meta.slotcount=context.slotcount;
	meta.slotperbatch=options.slotperbatch;
	meta.blockshift=options.blockshift;
	meta.version=options.version || '0.0.0';
	
	meta.tags=Object.keys(output.tags);
	meta.schema=JSON.stringify(options.schema);
	//TODO , support boolean type

	return meta;
}

var finalize=function() {
	if (this.finalized) {
		console.warn('already finalized')
		return;
	}
/*	
	for (var i in this.output.tags) {
		//convert sentence seq to slot seq in tag._slot
		tagsentence2slot(this.output.tags[i], this.context.sentence2slot);
		//compress depth array, replace with number if all in same depth
		var D=this.output.tags[i]._depth;
		if (D && D.length>1) {
			for (var j=1;j<D.length;j++) {
				if (D[0]!=D[j]) break;
			}
			if (j==D.length) this.output.tags[i]._depth=D[0]; //all items have same value
		} else if (D&& D.length==1) this.output.tags[i]._depth=D[0]; //only one item
	}
	for (var i in this.context.tagattributeslots) tagsentence2slot(this.context.tagattributeslots[i], this.context.sentence2slot);
	this.context.sentence2slot=[];	
*/
	this.context.totalcrlfcount+=this.context.crlfcount;
	//compress depth array)
	this.finalized=true;
}

var packcustomfunc=function() {
	if (!this.customfunc) abortbuilding('no customfunc');
	var customfunc={};
	for (var i in this.customfunc) {
		customfunc[i]='return '+this.customfunc[i].toString();
	}
	return customfunc;
}

var save=function(filename,opts) {
	opts=opts||{};
	var ydb=new Yadb.create(filename,opts);
	if (!this.finalized) finalize.call(this);
	var strencoding=opts.encoding||'utf8';
	ydb.stringEncoding(strencoding);
	
	if (debug) console.time('save file');
	if (this.customfunc.postings2tree) {
		console.log('performing postings2tree');
		this.output.postings=this.customfunc.postings2tree(this.output.postings);
	}

	this.output.customfunc=packcustomfunc.call(this);
	packmeta(this.options,this.context,this.output);

	ydb.openObject();
	for (var i in this.output) {
		var enc='variable';
		if (i=='postings') enc='delta';
		ydb.save(this.output[i], i, {integerEncoding:enc});	
	}
	
	ydb.free();
	if (debug) console.timeEnd('save file');
}
var abortbuilding=function(message) {
	var ctx=this.context;
	console.log('FILE:',ctx.filename,'LINE:',ctx.crlfcount+1)
	throw message;
}

var Create=function(options) {
	this.indexbuffer=indexbuffer;
	this.context={};//default index options
	
	this.output={tags:{}};
	this.options=options || {};
	this.loadschema=taghandlers.loadschema;
	this.setschema=taghandlers.setschema;
	this.setcustomfunc=function(funcs) {this.customfunc=funcs};
	this.setcustomfunc(require('./yasecustom'));
	this.save=save;
	this.abortbuilding=abortbuilding;
	this.addslottext=addslottext;
	this.finalize=finalize;

	initialize(this.options,this.context,this.output);
	initinverted(this.context,options);
	return this;
}
module.exports=Create;