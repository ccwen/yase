var yase=require('./yase');

var phraseSearch=function(opts) {
	var se=yase(opts.db);
	var res=se.phraseSearch(opts.tofind,opts);
	//console.warn('phraseSearch is obsolute')
	return res;
};
var boolSearch=function(opts) {
	var se=yase(opts.db);
	var res=se.boolSearch(opts.tofind,opts);
	console.warn('phraseSearch is obsolute')
	return res;
};

var search1=function(opts) {
	var se=yase(opts.db);
	var res=se[opts.searchtype||'phraseSearch'](opts.tofind,opts);
	console.warn('search1 is obsolute')
	return res;
}
var search=function(opts) {
	var se=yase(opts.db);
	var res=se.search(opts);
	return res;
}
var getTermVariants=function(opts) {
	var se=yase(opts.db);
	var res=se.getTermVariants(opts.term,opts);
	return res;	
}
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

var gettagattr=function(opts) {
	var se=yase(opts.db);
	var res=se.getTagAttr(opts.tag,opts.ntag,opts.attr);
	return res;
}

var customfunc=function( opts) {
	var se=yase(opts.db);
	return se.customfunc[opts.name].apply(se,opts.params);
}
var expandToken=function(opts) {
	var se=yase(opts.db);
	var res=se.expandToken(opts.token,opts);
	return res;
}
/*
var fuzzysearch=function(opts) {
	var se=yase(opts.db);
	se.phrasecache=se.phrasecache||{};
	opts.phrasecache=se.phrasecache; 
	var res=search.fuzzy(se,opts.tofind,opts);
	//console.log(JSON.stringify(res));
	return res;
}
*/

var autoappend=function(sel,parentval) {
		var depth=sel.value.split(".").length;	
		var metadepth=this.meta.schema[sel.tag].indexattributes[sel.attribute].depth;
		if (depth<metadepth) {
			var d=parentval.length-1;
			while (depth<metadepth) {
				sel.value=parentval[d]+'.'+sel.value;
				depth++;d--;
			}
		}
		return sel.tag+'['+sel.attribute+'='+sel.value;	
}
var findTagBySelectors=function(opts) {
	var start=0, o={}, out=[];
	var se=yase(opts.db);
	var parentval=[];
	for (var i=0;i<opts.selectors.length;i++) {
		o.db=opts.db;
		o.selector=opts.selectors[i];
		o.start=start;

		if (i) {
			var sel=se.parseSelector(opts.selectors[i-1]);
			sel.db=opts.db;
			//get the range end of parent
			var next=getNextSelector.apply(se,[sel,out[out.length-1]]);
			o.end=next.slot;
		}

		var sel=se.parseSelector(o.selector);
		//user may readunit[id=d1]  p[n=1]
		//         readunit[id=d1]  p[n=d1.1]  both ok
		if (i) o.selector=autoappend.apply(se,[sel,parentval]);

		parentval.push(sel.value);

		var r=findTag(o);
		if (r&&r.length) {
			start=r[0].slot;
			sel.db=opts.db;
			var nexttag=getNextSelector.apply(se,[sel,r[0]]);
			if (nexttag) {
				r[0].next=nexttag;	
			} else {
				if (i) r[0].next={slot:o.end};	//use parent end range
			}
			
			out.push(r[0]);
		} else {
			return out;
		}
	}
	return out;
}

var getNextSelector=function(sel,fromtag) {
	  var maxgap=1000;
	  var vals=sel.value.split(".");
		vals[vals.length-1]=parseInt(vals[vals.length-1],10);

		if (vals[vals.length-1]) { // try next number
			vals[vals.length-1]++;
			sel.value=vals.join(".");sel.start=fromtag.slot;
			var tags=findTag(sel);
			var tag=null;
			if (tags.length) tag=tags[0];
			if (!tag)return null;
			if (tag.slot-fromtag.slot>maxgap) { //too far , TIK , ATT p[n] is not continuous D15 missing p[n=96,p[n=97
				opts={attributes:[sel.attribute]}
				var range=this.getTagInRange(fromtag.slot,fromtag.slot+maxgap,sel.tag,opts);
				for (var i in range) {
					if (parseInt(range[i].value,10)>=val+1) return range[i];
				}
			} else {
				return tag;
			}
		} else {
			return this.getTag(fromtag.tag,fromtag.ntag+1);	
		}
		return null;
}
var getTextByTag=function(opts) {
	var se=yase(opts.db);

	var maxslot=opts.maxslot || 1000;
	
	var tagseq=opts.ntag;
	var t=null,tnext=null,sel=null;

	if (opts.selector) {
		if (typeof opts.selector=='string') {
			t=se.findTagBySelector(opts.selector);
			sel=se.parseSelector(opts.selector);
			sel.db=opts.db;
			tnext=getNextSelector.apply(se,[sel,t]);
		} else {
			opts.selectors=opts.selector;
			var tags=findTagBySelectors(opts);
			t=tags[tags.length-1];//take the last one
			sel=se.parseSelector(opts.selectors[opts.selectors.length-1]);
			tnext=t.next;
		}
		tagseq=t.ntag;
	} else {
		t=se.getTag(opts.tag,tagseq);	
		tnext=se.getTag(opts.tag,tagseq+1);		
	}
	if (!tnext) return;
	

	var seqarr=[];
	opts.extraslot=opts.extraslot||0;
	for (var i=t.slot;i<tnext.slot+opts.extraslot;i++) {
		seqarr.push(i); 
		if (seqarr.length>maxslot) break; 
	}
	var out={slot:t.slot, ntag: tagseq, starttag:t, endtag:tnext, head:t.head, text:se.getText(seqarr,opts)};
	if (opts.sourceinfo) {
		out.sourceinfo=se.sourceInfo(t.slot);
	}
	return out;
}	


var findTag=function(opts) {
	var se=yase(opts.db);
	opts.slot=opts.slot||0;
	opts.end=opts.end||se.meta.slotcount;

	var o=opts, tags=[];
	if (opts.selector) o=se.parseSelector(opts.selector);
	if (typeof o.value=='object') {
		
		for (var i in o.value) {
			var t=se.findTag(o.tag,o.attribute,o.value[i]);
			if (t) t.db=opts.db;
			if (t.slot>opts.slot) tags.push(t);
		}
		return tags;
	} else {
		if (o.key) { //get the first tag with key
			tags=se.firstTagAfter(o.tag,o.key,opts.start);
		} else {
			var t=se.findTag(o.tag,o.attribute,o.value);
			if (!Array.isArray(t)) {
				t=[t];
			}
			for (var i in t) {
				if (t[i].slot<opts.start ) continue;
				if (t[i].slot<opts.end) {
					t[i].db=opts.db;
					tags.push(t[i]);
				}
			}
		}
	}
	return tags;
}
var getTagInRange=function(opts) {
	var se=yase(opts.db);
	var res=se.getTagInRange(opts.start,opts.end,opts.tag,opts);
	if (res) res.db=opts.db;
	return res;
}
var getTextRange=function(opts) {
	var se=yase(opts.db);
	var res=se.getTextRange(opts.start,opts.end,opts);
	return res;
}
var keyExists=function(path) { //path including database name
	var dbname=path.shift();
	dbname=dbname.replace(':','/');
	var se=yase(dbname);
	return se.exists(path);
}
var getRaw=function(path) { //path including database name
	var res=null;
	if (!path || path.length==0) {
		var res=JSON.parse(JSON.stringify(yase.yadb.api().getRaw([],{loadmeta:true})));
	} else {
		var dbname=path.shift();
		dbname=dbname.replace(':','/');
		var se=yase(dbname);
		if (se) res=se.get(path,true);
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
var exist=function(names) {
	if (!Array.isArray(names)) {
		names=[names];
	}
	var out={};
	for (var i in names) {
		out[names[i]]=(!!yase(names[i]));
	}
	return out;
}
var enumLocalYdb=function(folder) {
	return this.yadb.api().getRaw([],{folder:folder,loadmeta:true});
}
//return database and slot with same id, except current db
var sameId=function(opts) {
	var se=yase(opts.db);
	var dbs=opts.local?enumLocalYdb(se.folder):getRaw([]);
	var res=[],o={selectors:opts.selector};
	for (var i in dbs) {
		if (i==opts.db || dbs[i].name==opts.db) continue;
		o.db=i;
		var r=findTagBySelectors(o);
		if (r&&r.length==o.selectors.length) {
			var tag=r[r.length-1];//just return the last one
			res.push(tag); 
		}
	}
	return res;
}
var installservice=function(services) { // so that it is possible to call other services
	if (!services) return;
	//yase_api(services);
	require('yadb').api(services);
	services['yase']={ 
	getText:getText,
	fillText:fillText,
	exist:exist,
	keyExists:keyExists,
	expandToken:expandToken,
	getRange:getRange,
	getTextByTag:getTextByTag,
	getTagAttr:gettagattr,
	getTextRange:getTextRange,
	getTagInRange:getTagInRange,
	buildToc:buildToc,
	customfunc:customfunc,
	phraseSearch:phraseSearch,
	boolSearch:boolSearch,
	search:search,
	getTermVariants:getTermVariants,
	closestTag:closestTag,
	findTag:findTag,
	findTagBySelectors:findTagBySelectors,
	getRaw:getRaw,
	getBlob:getBlob,
	enumLocalYdb:enumLocalYdb,
	sameId:sameId,
	version: function() { return require('./package.json').version },
	//initialize:initialize
	};
	
}
module.exports=installservice;