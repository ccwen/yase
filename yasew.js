var debug=false;
var DEFAULTBLOCKSHIFT=5;

var taghandlers=require('./taghandlers');
var Yadb=require('yadb');

var processtag=function() {
	var tag=this.context.token;
	var i=0,T="";
	while (i<tag.length) {
		T+=tag[i++];
		if (tag[i-1]=='>') break;
	}
	while (i<tag.length) if (tag[i++]=='\n') this.context.crlfcount++;

	taghandlers.dotag.apply(this, [T]);
}
var processtoken=function() {
	var ctx=this.context;
	var output=this.output;
	var i=0;
	while (i<ctx.token.length) if (ctx.token[i++]=='\n') this.context.crlfcount++;
	var t=this.customfunc.normalizeToken(ctx.token);
	if (!output.postings[t]) {
		output.postings[t] = [ctx.vpos];
		ctx.postingcount++;
	} else {
		  output.postings[t].push(ctx.vpos);
	}	
}
var addslottext=function() {
	var ctx=this.context;
	if (ctx.lastnchar==ctx.nchar) return;
	var s=ctx.slotbuffer.substring(ctx.lastnchar,ctx.nchar);
	var tokencount=ctx.ntoken-ctx.lastntoken;
	var output=this.output;
	var extraslot=  Math.floor( tokencount / ctx.maxslottoken ); //overflow
	if (extraslot>0) {
		if (!ctx.overflow[ctx.filename]) ctx.overflow[ctx.filename]=[];
		ctx.overflow[ctx.filename].push(ctx.crlfcount);
	}
	
	var slotgroup=Math.floor(ctx.slotcount / ctx.slotperbatch );//

	if (!output.texts[slotgroup]) output.texts[slotgroup]=[];
	output.texts[slotgroup].push(s);
	ctx.slotcount+=(1+extraslot);
	ctx.extraslot+=extraslot;
	while (extraslot--) output.texts[slotgroup].push(''); //insert null slot
	ctx.lastntoken=ctx.ntoken;
	ctx.lastnchar=ctx.nchar;
	ctx.vpos=ctx.slotcount*this.context.blocksize;
}
var doslot=function(now) {
	var ctx=this.context;
	var s=this.buffer.substring(ctx.lastpos,now);
	ctx.slotbuffer=s;

	ctx.ntoken=0; ctx.lastntoken=0;
	ctx.nchar=0;  ctx.lastnchar=0;

	var tokens=this.customfunc.tokenize(s);
	ctx.vpos=ctx.slotcount*this.context.blocksize;
	for (var i=0;i<tokens.length;i++) {
		ctx.token=tokens[i];
		if (ctx.token[0]=='<') { //do not allow space at the beginning of file
			processtag.call(this);
		} else {
			processtoken.call(this);
			ctx.offset++;
			ctx.vpos++;
		}
		ctx.nchar+=ctx.token.length;
		ctx.ntoken=i;
	}
	this.addslottext();
	ctx.lastpos=now;
}
var newfile=function(fn){
	var ctx=this.context;
	ctx.filename=fn;
	ctx.crlfcount=0;
	ctx.slotbuffer="";
	ctx.lastpos=0;
	ctx.totalcrlfcount+=ctx.crlfcount;
}
var indexbuffer=function(B,fn) {
	this.buffer=B;
	var ctx=this.context;
	newfile.apply(this,[fn]);
	
	var i=0,intag=false;

	while (i<B.length) {
		if (B[i]=='<') intag=true;
		if (this.customfunc.isBreaker(B[i]) && !intag) {
			while ( i+1<B.length && (this.customfunc.isBreaker(B[i+1]) 
				|| B.charCodeAt(i+1)<=0x20) ) {
				i++;
			}
			doslot.apply(this,[i+1]);
		}
		if (B[i]=='>') intag=false;
		i++;
	}
	doslot.apply(this,[B.length]);
}

var initinverted=function(opts) {
	var ctx=this.context;
	var output=this.output;
	opts=opts||{};
	ctx.blockshift=opts.blockshift || DEFAULTBLOCKSHIFT ; //default blocksize 32
	if (ctx.blockshift>10) {
		console.warn('max block size is 1024, reduce your blockshift setting');
		ctx.blockshift=10;
	}
	ctx.blocksize=2 << (ctx.blockshift - 1);//Math.pow(2,handle.blockshift);
	console.log('Start indexing',new Date());
	console.log('BLOCKSIZE',ctx.blocksize)
	output.postings =  {};
	ctx.postingcount = 0;
	ctx.vpos  = 0;	
	ctx.offset= 0; // token offset of current slot
}

var initialize=function(options,context,output) {
	options=options||{};
	context.starttime=new Date();
	context.slotcount=0;
	context.overflow={};
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
	meta.schema=JSON.stringify(context.schema);
	//TODO , support boolean type

	return meta;
}

var finalize=function() {
	if (this.finalized) return;
	var ctx=this.context;

	for (var i in this.output.tags) {
		//compress depth array, replace with number if all in same depth
		var D=this.output.tags[i]._depth;
		if (D && D.length>1) {
			for (var j=1;j<D.length;j++) {
				if (D[0]!=D[j]) {
					//console.log(D[0],D[j],'depth no equal')
					break;
				}
			}
			if (j==D.length) {
				//console.log('compact tag depth')
				this.output.tags[i]._depth=D[0]; //all items have same value
			}
		} else if (D&& D.length==1) this.output.tags[i]._depth=D[0]; //only one item
	}	

	if (this.finalized) {
		console.warn('already finalized')
		return;
	}
	if (ctx.overflow) {
		console.log('overflow slots:',ctx.overflow)
	}
	//console.log(JSON.stringify(this.output.texts))
	ctx.totalcrlfcount+=ctx.crlfcount;
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
	finalize.call(this);
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
	console.log('FILE:',ctx.filename,'LINE:',ctx.crlfcount)
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
	initinverted.apply(this,[options]);
	taghandlers.initialize.apply(this,[options]);
	this.options.schema=this.options.schema||"TEI";
	
	this.loadschema(this.options.schema);
	return this;
}
module.exports=Create;