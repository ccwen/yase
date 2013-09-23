var fs=require('fs');
var yase=require('./yase');
var search=require('./search');

var phraseSearch=function(opts) {
	var se=yase(opts.db);
	var res=se.phraseSearch(opts.tofind,opts);
	return res;
};
var buildToc=function(opts) {
	var se=yase(opts.db);
	var res=se.buildToc(opts.toc,opts);
	return res;
}
var getText=function(opts) {
	var se=yase(opts.db);
	var res=se.getText(opts.seq || opts.slot || 0 ,opts);
	return res;
}
var fillText=function(opts) {
	var se=yase(opts.db);
	var output=[];
	if (typeof opts.slots=='undefined' && typeof opts.vpos!='undefined'){
		opts.slots=opts.vpos.map(function(i){return i>>se.meta.slotshift});
	}
	
	if (typeof opts.slots=='undefined') return;
	for (var i in opts.slots) {
		if (opts.slots[i]>=se.meta.slotcount) break;
		output.push({seq:parseInt(i),slot:opts.slots[i], text:se.getText( opts.slots[i],opts)});
	}
	return output;
}
var getRange=function(opts) {
	var se=yase(opts.db);
	var res=se.getRange(opts.start,opts.end,opts);
	return res;
}

var gettextbytag=function(opts) {
	var se=yase(opts.db);
	var res=se.getTextByTag(opts);
	return res;
}
var gettagattr=function(opts) {
	var se=yase(opts.db);
	var res=se.getTagAttr(opts.tag,opts.ntag,opts.attr);
	return res;
}

var customfunc=function( opts) {
	var se=yase(opts.db);
	return se.customfunc[opts.name].apply(se,opts.params);
}

var fuzzysearch=function(opts) {
	var se=yase(opts.db);
	se.phrasecache=se.phrasecache||{};
	opts.phrasecache=se.phrasecache; 
	var res=search.fuzzy(se,opts.tofind,opts);
	//console.log(JSON.stringify(res));
	return res;
}

var findTag=function(opts) {
	var se=yase(opts.db);
	var o=opts;
	if (opts.selector) o=se.parseSelector(opts.selector);
	if (typeof o.value=='object') {
		var t=[];
		for (var i in o.value) {
			t.push(se.findTag(o.tag,o.attribute,o.value[i]));
		}
		return t;
	} else {
		var t=se.findTag(o.tag,o.attribute,o.value);	
		return t;
	}
	
}
var getTagInRange=function(opts) {
	var se=yase(opts.db);
	var res=se.getTagInRange(opts.start,opts.end,opts.tag,opts);
	return res;
}
var getTextRange=function(opts) {
	var se=yase(opts.db);
	var res=se.getTextRange(opts.start,opts.end,opts);
	return res;
}
var enumydb=function() {
	var output={};
	var dbnames=[];
	for (var i in ydbfiles) {
		var fullname=ydbfiles[i];
		fullname=fullname.replace('/',':').replace('.ydb','');
		var dbname=fullname.match(/.*:(.*)/)[1]
		console.log(dbname)
		output [ fullname] ='\0'; //pretend to be loaded
	}
	return output;
}
var getRaw=function(path) { //path including database name
	if (!path || path.length==0) {
		var res=enumydb();
	} else {
		var dbname=path.shift();
		dbname=dbname.replace(':','/');
		var se=yase(dbname);
		var res=se.get(path,true);
	}
	return res;
}
var getBlob=function(opts) {
	var se=yase(opts.db);
	var path=opts.blob.split('/');
	path.unshift('blob');
	return se.get(path);
}
var closestTag=function(opts) {
	if (!opts) return null;
	var se=yase(opts.db);
	var output=[];
	var slots=opts.slots; //default is an array
	opts.slot=parseInt(opts.slot)
	//console.time('closestTag')
	if (typeof opts.slot=='undefined') {
		if (typeof opts.vpos=='object') {
			opts.slot=opts.vpos.map(function(i) {return i >> se.meta.slotshift});
		} else if (typeof opts.vpos=='number') {
			opts.slot=opts.vpos>>se.meta.slotshift;
		}
	}
	if (typeof opts.slot=='number') slots=[opts.slot];
	if (!slots) return [];
	for (var i=0;i<slots.length;i++) {
		var tags=se.closestTag(opts.tag, slots[i]);
		if (!(tags instanceof Array)) {
			tags=[tags];
		}
		var output2=[];
		for (var j in tags) {
			var tag=tags[j];
			tag.values={};
			if (opts.attributes) for (var k in opts.attributes) {
				var attr=opts.attributes[k];
				var v=se.getTagAttr(tag.name , tag.ntag, attr);
				tag.values[attr]=v;
				//console.log(v,attr,tag.ntag)
			}
			output2.push(tag);
		}
		if (output2.length==1) output2=output2[0];
		output.push(output2);
	}
	return output;
}
var installservice=function(services) { // so that it is possible to call other services
	//yase_api(services);
	require('yadb').api(services);
	services['yase']={ 
	getText:getText,
	fillText:fillText,
	getRange:getRange,
	getTextByTag:gettextbytag,
	getTagAttr:gettagattr,
	getTextRange:getTextRange,
	getTagInRange:getTagInRange,
	buildToc:buildToc,
	customfunc:customfunc,
	phraseSearch:phraseSearch,
	closestTag:closestTag,
	findTag:findTag,
	getRaw:getRaw,
	getBlob:getBlob,
	version: function() { return require('./package.json').version },
	//initialize:initialize
	};
	
}
module.exports=installservice;