/*
	better tag support, finer granularity 

	split the input file into sentences.
	textseq is a continuos number.
	each posting = textseq<<blockshift + offset_in_sentence

	multilevel id . each id point to a posting
	user may choose to remove or keep tag during indexing.

	<pb ed="xx" n="xx"/> will probably removed.
	
	text saving strategy:
	a file is sliced into sentences.
	sentence has a mininum size of 64 tokens. 1 slot.
	long sentence will overflow to another slot.
	
	
	internal document pointer = slot+token offset

	tag saving strategy:
	a tag will convert into key,
	    1)where the key is unique and *sane*:
	        multiple level key , with a attached posting number. (vint)
	        defer loading is support, lookup is fast once the group is loaded.
	    2) where the key is unique but not sane:
	       a sorted stringlist with an array of vint.
	       which is fast for thousands of keys and provide very fast lookup,
	        but slower on loading
	    3) the key is not unique , or natural order of keys must be keeped
	        a unsorted stringlist with an array of packed posting number (sorted)

	2013/5/4

	2013/8/6
	move to git, create npm

	yapcheahshen@gmail.com

*/
var fs=require('fs');
var splitter=require('./splitter');
var Invert=require('./invert');
var schema=require('./schema');
var Yadb=require('yadb');
var taghandlers=require('./taghandlers');
var abortbuilding=function(message) {
	console.log('FILE:',context.filename)
	console.log('LINE:',context.crlfcount+1)
	throw message;
}
var parse = function(buffer) {
	context=this.context;
	buffer=buffer.replace(/\r\n/g,'\n');
	buffer=buffer.replace(/\r/g,'\n');		
	context.onsentence = context.onsentence || onsentence;
	context.ontag = context.ontag || ontag;
	context.sentence='';
	context.hidetext=false;

	var i=0;
	while (i<buffer.length) {
		t=buffer[i];
		if (t=='\n') context.crlfcount++;
		if (this.customfunc.isBreaker(t)) {
			while (t&& (this.customfunc.isBreaker(t) || t==' ') && i<buffer.length) {
				context.sentence+=t;
				t=buffer[++i];
			}
		
			context.onsentence(context);
		} else if (t=='<') {
			var tag='';
			while (i<buffer.length) {
				tag+=buffer[i++];
				if (buffer[i-1]=='>') break;
			}
			/*
			context.sentence+=opts.ontag.apply(context, [tag]);
			no working as expected , because context.sentence is changed in ontag handler
			*/
			var r=context.ontag.apply(this, [tag, this.context.schema]);
			context.sentence+=r;
		} else {

			if (!context.hidetext) {
				context.sentence+=t;
			}
			i++;
		}
	}
	if (context.sentence) context.onsentence(context);

}
var extracttagname=function(xml) {
	var tagname=xml.substring(1);
	if (tagname[0]=='/') tagname=tagname.substring(1);
	tagname=tagname.match(/(.*?)[ \/>]/)[1];	
	return tagname;
}

var onsentence=function(context) {
	context.sentences.push(context.sentence);
	//console.log(this.sentences.length,this.sentence);
	context.sentence='';
}
	
var ontag=function(tag, schema) {
	context=this.context;
	var tagname=extracttagname(tag);
	ti=schema[tagname];
	if (!ti) ti={};
	ti.tagname=tagname;
	ti.opentag=true;
	ti.closetag=false;
	ti.tag=tag;

	if (tag.substr(tag.length-2,1)=='/') ti.closetag=true;
	if (tag.substr(1,1)=='/') {ti.closetag=true; ti.opentag=false;}

	if (ti.emptytag) {
		if (!ti.closetag || !ti.opentag) abortbuilding('invalid empty tag, schema:'+JSON.stringify(ti));
	}
	if (ti.comment) {
		if (ti.opentag) context.hidetext=true;
		if (ti.closetag) context.hidetext=false;
	}
	if (ti.opentag) context.tagstack.push(tagname);
	if (ti.closetag) {
		if (context.tagstack.length==0) {
			abortbuilding('tag underflow');
		}
		var tn=context.tagstack.pop();
		if (tn!=tagname) {
			abortbuilding('nested tag');
		}
	} 

	if (ti.handler) ti.handler.apply(this,[ti, context.sentence.length]);
	return defaulttaghandler.apply(this,[ti,context.sentence.length]);
}


var addfilebuffer=function(filebuffer,filename) {
	var context=this.context;

	context.sentences=[];	
	context.filename=filename;
	context.totalcrlfcount+=context.crlfcount;
	context.crlfcount=0;
	parse.apply(this,[filebuffer]);
	context.totalsentencecount+=context.sentences.length;
}
/* handle slot overflow */
var addslot=function(tokencount,sentence) {
	output=this.output;
	context=this.context;
	options=this.options;
	var extraslot=  Math.floor( tokencount / context.maxslottoken ); //overflow
	if (extraslot>0) {
		//console.log('overflow '+tokencount,sentence.substring(0,30)+'...');
	}
	var slotgroup=Math.floor(context.slotcount / options.slotperbatch );//

	if (!output.texts[slotgroup]) output.texts[slotgroup]=[];
	output.texts[slotgroup].push( sentence);
	context.sentence2slot[context.nsentence]=context.slotcount;
	context.slotcount+=(1+extraslot);
	context.extraslot+=extraslot;
	context.nsentence++;
	while (extraslot--) {
		output.texts[slotgroup].push(''); //insert null slot
	}
}
/* convert tags sentence number to slot number */
var tagsentence2slot=function(tags, mapping){
	if (!tags._slot) return; //some tag has no slot field
//	console.log('slotlength',tags._slot.length,mapping)
	for (var j=0;j<tags._slot.length;j++ ) {
//		console.log(tags._slot[j], mapping[ tags._slot[j] ])
		tags._slot[j]= mapping[ tags._slot[j] ];
	}
}
var initialize=function(options,context,output) {
	context.starttime=new Date();
	options.slotperbatch=options.slotperbatch||256;
	options.blockshift=options.blockshift||6;
	output.meta=output.meta||{};
	context.normalize=context.normalize || function( t) {return t.trim()};
	context.maxslottoken = 2 << (options.blockshift -1);
	//console.log('context.meta.blockshift',context.settings.blockshift, ' maxslottoken',context.maxslottoken)
	if (typeof output.texts=='undefined') { //first file
		context.nsentence=0;
		context.slotcount=0;
		context.extraslot=0;
		context.sentence2slot=[]; // sentence number to slot number mapping
		output.texts=[];	
	}


	if (typeof output.tags=='undefined') output.tags={};


}
var construct=function() {
	if (!this.invert) this.invert=new Invert({splitter: this.options.splitter,blockshift: this.options.blockshift });
	this.output.postings=this.invert.postings;
	for (var i=0;i<this.context.sentences.length;i++) {
		var splitted=this.invert.addslot(this.context.slotcount, this.context.sentences[i]);
		var indexabletokencount=splitted.tokens.length-splitted.skiptokencount;
		addslot.apply(this,[indexabletokencount, this.context.sentences[i]]);
	}


	return this;
}

/*
	split multilevel id and create tree structure
*/
var iddepth2tree=function(obj,id,nslot,depth,ai ,tagname) {
	var idarr=null;
	if (ai.cbid2tree) idarr=ai.cbid2tree(id); else {
		if (depth==1) {
			idarr=[id];
		} else {
			idarr=id.split('.');		
		}
	}
	if (idarr.length>depth) {
		abortbuilding('id depth exceed');
		return;
	}
	while (idarr.length<depth) idarr.push('0');
	for (var i=0;i<idarr.length-1;i++) {
		if (!obj[ idarr[i]]) obj[ idarr[i]]={};
		obj = obj[ idarr[i]];
	}
	var val=idarr[idarr.length-1];

	if (typeof obj[val] !=='undefined') {
		if (ai.allowrepeat) {
			if (typeof obj[val]=='number') obj[val]=[ obj[val] ] ; // convert to array
			obj[val].push( nslot );
		} else {
			console.log('repeated val:',val, ', tagname:',tagname);
		}
	} else  {
		obj[val]= nslot; 
	} 
}
var defaulttaghandler=function(taginfo,offset) {
	var k=taginfo.tagname;
	var tags=this.output.tags;
	var hidetag=false;
	if (taginfo.append) k+=taginfo.append;
	if (!tags[k]) tags[k]={ _count:0};
	tags[k]._count++;
	
	if (taginfo.newslot && this.context.sentence) {
		if (taginfo.closetag) {
			if (taginfo.savehead ||taginfo.saveheadkey) {
				var k=taginfo.tagname;
				if (!tags[k]) tags[k]={};
				
				var p=this.context.sentence.indexOf('>');
				var headline=this.context.sentence.substring(p+1);
				if (taginfo.saveheadkey)  {
					var H=tags[k][taginfo.saveheadkey];
					if (!H) {
						H=tags[k][taginfo.saveheadkey]={ _slot:[],_ntag :[],_head:[] , _depth:[]};
						if (!this.context.tagattributeslots) this.context.tagattributeslots=[];
						this.context.tagattributeslots.push(H);
					}

					var slot=this.context.totalsentencecount + this.context.sentences.length;
					H.ntag.push( (tags[k]._count-2) /2 );
					H._slot.push( slot );
					H._head.push(headline);
					
					//console.log(slot,this.tags[k].count,headline)
					taginfo.saveheadkey='';
				} else {
					if (typeof tags[k]._head=='undefined') tags[k]._head=[];
					tags[k]._head.push(headline);
				}
			}
			this.context.sentence+=taginfo.tag;
			hidetag=true; //remove closetag as already put into sentence
		}
		this.context.onsentence(this.context);
	}

	if (taginfo.savepos && taginfo.opentag) {
		if (!tags[k]._slot) tags[k]._slot=[];
		if (!tags[k]._offset) tags[k]._offset=[];
		if (!tags[k]._depth) tags[k]._depth=[];
		tags[k]._slot.push(this.context.totalsentencecount + this.context.sentences.length);
		tags[k]._offset.push(offset);
		tags[k]._depth.push(this.context.tagstack.length);
	}

	if (taginfo.indexattributes && taginfo.opentag) for (var i in taginfo.indexattributes) {
		var attrkey=i+'=';
		if (!tags[k][attrkey]) tags[k][attrkey]={};
		var val=taginfo.tag.match( taginfo.indexattributes[i].regex);		
		if (val) {
			if (val.length>1) val=val[1]; else val=val[0];
			var depth=taginfo.indexattributes[i].depth || 1;
			//console.log(attrkey,val,this.tags[k][attrkey],depth)
			iddepth2tree(tags[k][attrkey], val, tags[k]._slot.length -1,  depth, taginfo.indexattributes[i] , taginfo.tagname);
			if (taginfo.indexattributes[i].savehead) {
				taginfo.saveheadkey=attrkey+val;
			}
		} else if (!taginfo.indexattributes[i].allowempty) {
			abortbuilding('empty val '+taginfo.tag);
		} 

		if (taginfo.indexattributes[i].saveval) {
			if (!tags[k][i]) tags[k][i]=[];
			if (!val) val="";
			tags[k][i].push(val);
		}
	}

	if (hidetag||taginfo.comment|| taginfo.remove) return '' ;else return taginfo.tag;	
}

var setcustomfunc=function(funcs) {
	this.customfunc=funcs;
}
var setschema=function(schema) {
	this.options.schema=schema;
	this.context.schema=JSON.parse(JSON.stringify(schema));
	for (var i in this.context.schema) {
		var h=this.context.schema[i].handler;
		if (typeof h == 'string') {
			this.context.schema[i].handler=taghandlers[h];
		}
		for (var j in this.context.schema[i]) {
			var ATTR=this.context.schema[i].indexattributes;
			if (!ATTR) continue;
			//convert regstr to regex as json cannot hold regex
			for (var k in ATTR) {
				if (ATTR[k].regstr) ATTR[k].regex=new RegExp(ATTR[k].regstr)
			}
		}
	}	
}


var packcustomfunc=function() {
	if (!this.customfunc) abortbuidling('no customfunc');
	var customfunc={};
	for (var i in this.customfunc) {
	//function name is removed after toString()
	//need to add return in the beginning for 
	// new Function() in dmload of yadm.js to work properly
		customfunc[i]='return '+this.customfunc[i].toString();
	}
	return customfunc;
}

var packmeta=function(options,context,output) {
	var meta=output.meta;
	if (options.dbid) meta.dbid=options.dbid;
	if (options.author) meta.author=options.author;
	if (options.website) meta.website=options.website;
	if (options.minyaseversion) meta.minversion=options.minyaseversion;
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
	context.totalcrlfcount+=context.crlfcount;
	//compress depth array)
	this.finalized=true;
}
var debug=false;
var save=function(filename,opts) {
	opts=opts||{};
	var ydb=new Yadb.create(filename,opts);
	if (!this.finalized) finalize.call(this);
	var strencoding=opts.encoding||'utf8';
	ydb.stringEncoding(strencoding);
	
	if (debug) console.time('save file');
	
	this.output.customfunc=packcustomfunc.call(this);
	//console.log(this.output.customfunc)

	if (this.customfunc.processinverted) {
		this.output.inverted=this.customfunc.processinverted(this.output.inverted);
	}
	packmeta(this.options,this.context,this.output);
	ydb.save(this.output);
	ydb.free();
	if (debug) console.timeEnd('save file');
}
var Create=function(options) {
	this.addfilebuffer=addfilebuffer;
	this.context={tagstack:[],crlfcount:0,totalcrlfcount:0,totalsentencecount:0};//default index options
	this.output={tags:{}};
	this.options=options || {};
	if (!this.options.splitter) this.options.splitter=splitter;
	this.setschema=setschema;
	this.setcustomfunc=setcustomfunc;
	this.construct=construct;
	this.save=save;

	initialize(this.options,this.context,this.output);
	this.setcustomfunc(require('./yasecustom'))
	return this;
}
module.exports=Create;