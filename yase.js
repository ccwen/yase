/*
Ksana Search Engine

yadb for supporting full text search
*/

var plist=require('./plist.js');
var binarysearch=require('./binarysearch')

var getPostingById=function(id) {
	if (this.customfunc.token2tree) {
		var idarr=this.customfunc.token2tree(id);
	} else {
		var idarr=[id];
	}
	idarr.unshift('postings');
	var r=this.get(idarr,true);
	return r;
}
var highlight=function(opts) {
	
	var res=opts.splitter(opts.text);
	var i=0,j=0,last=0,voff=0;
	var off=res.offsets;
	var output='';
	
	while (i<res.tokens.length) {
		if (!res.skips[i]) voff++;

		if (j<off.length && voff==opts.hits[j]) {
			if (i) now=off[i-1]+1; else now=0;
			output+= opts.text.substring(last, now);
			output+= '<hl>';
			var len=opts.phraselength;
			var till=0;
			while (len) {
				if (!res.skips[i+till]) { len--}
				till++;
			}

			output+= opts.text.substring(now,off[i-1+till]);
			last=off[i-1+till];

			output+='</hl>';
			j++;
		}
		i++;

	}
	output+=opts.text.substring(last);
	return output;
}
//return highlighted texts given a raw hits
var highlighttexts=function(dm,seqarr,tofind) {
	var R=dm.phraseSearch(tofind,{raw:true});

	var splitted=dm.customfunc.splitter(tofind);
	var phraselength=splitted.tokens.length-splitted.skiptokencount;

	if (typeof seqarr=='number' || typeof seqarr=='string') {
		var t=dm.getText(parseInt(seqarr));
		if (R[seqarr]) return highlight({ text: t , hits: R[seqarr]} );
		else return t;
	} else {
		var out="";
		for (var i in seqarr) { //TODO : fix overflow slot
			var seq=seqarr[i];
			var hits=R[seq];
			var t=dm.getText(seq);
			var hopts={ text: t , hits: hits, splitter:dm.customfunc.splitter,phraselength:phraselength};
			if (hits) out+= highlight.apply(dm, [ hopts]);
			else out+=t;
		}
		return out;
	}
}
var highlightresult=function(dm,R,phraselength) {
	var rescount=0;
	var blocksize = 2 << (dm.meta.blockshift -1);	
	//console.log('highlightresult',R)
	var lasti='', hits=[],addition=0;
	var output={};
	/* TODO , same sentence in multiple slot render once */
	for (var i in R) {
		var nslot=parseInt(i);
		var text=dm.getText(nslot);
		var hits=R[i];
		addition=0;

		while (!text && nslot) {
			nslot--;
			text=dm.getText(nslot);
			addition+=blocksize;
		}
	
		if (addition) hits=hits.map( function(j) {return addition+j});

		var h=highlight({
			splitter:dm.customfunc.splitter,
			hits:hits,
			text:text,
			phraselength:phraselength
		});
		output[nslot]=h;
	}
	return output;
}
var profile=false;
var phraseSearch=function(tofind,opts) {
	var splitter=this.customfunc.splitter;
	if (!splitter) throw 'no splitter';
	var postings=[];
	var splitted=splitter(tofind);
	var tokens=splitted.tokens;
	var skips=splitted.skips;
	var g=null,raw=null;

	if (this.phrasecache_raw && this.phrasecache_raw[tofind]) {
		raw=this.phrasecache_raw[tofind];
	}

	if (this.phrasecache&& this.phrasecache[tofind]) {
		g=this.phrasecache[tofind];
	} else {
		if (profile) console.time('get posting');
		for (var i in tokens) {
			if (skips[i]) continue;
			var posting=this.getPostingById(tokens[i]);
			postings.push(posting);
		}
		if (profile) console.timeEnd('get posting');
		if (profile) console.time('phrase merge')
		if (!raw) raw=plist.plphrase(postings);
		if (profile) console.timeEnd('phrase merge')
		if (profile) console.time('group block')
		if (opts.ungroup) return raw;
		//console.log(raw)
		var g=plist.groupbyblock(raw, this.meta.blockshift);
		if (profile) console.timeEnd('group block')		
		if (this.phrasecache) this.phrasecache[tofind]=g;
		if (this.phrasecache_raw) this.phrasecache_raw[tofind]=raw;
	}

	//trim output
	if (opts.start!=undefined) {
		opts.maxcount=opts.maxcount||10;
		var o={};
		var count=0;
		for (var i in g) {
			if (opts.start==0) {
				if (count>=opts.maxcount) break;
				o[i]=g[i];
				count++;
			} else {
				opts.start--;
			}
		}
		g=o;
	}
	if (opts.raw) return raw;
	if (opts.grouped) return g;
	if (profile) console.time('highlight')
	var R="";
	if (opts.showtext) {
		R=highlightresult(this,g,tokens.length-splitted.skiptokencount);
	}
	if (profile) console.timeEnd('highlight')
	return R;
}
var getKeys=function(id) {
	throw 'not implemented'
}
//return range of id given start and end

var getText=function(slot,opts) {
	if (opts && opts.tofind) {
	 	//console.log('text with tofind',opts.tofind);
		t=highlighttexts(this, slot,opts.tofind);
	} else {
	 	var t=this.customfunc.getText(this.getdb(),slot,opts);	 	
	 	if (!opts) { if (typeof t!='string') return t.join(""); else return t; }
	}

	var out=[];
	if (opts.tokentag || opts.slottag) {
		if (typeof slot=='number' || typeof slot=='string') slot=[parseInt(slot)];
		if (typeof t=='string') t=[t];
		var blocksize = 2 << (this.meta.blockshift -1);
		for (var j in t) {
			var T="";
			var tokenoffset=0;
			if (opts.tokentag) {
			 	var splitter=this.customfunc.splitter;
			 	var splitted=splitter(t[j]);
			 	for (var i in splitted.tokens) {
			 		var tk=splitted.tokens[i];
			 		if (!splitted.skips[i]) {
			 			tokenoffset++;
				 		//var vpos=slot[j]*blocksize+tokenoffset;
				 		T+='<tk n="'+tokenoffset+'">'+tk+'</tk>';
				 	} else T+=tk;
			 	}
			} else T=t[j];
			if (opts.slottag) out.push('<slot n="'+slot[j]+'">'+T+'</slot>');
		}
		return out.join("");

	 } else {
	 	if (typeof t!='string') return t.join(""); else return t;
	 }
}

var getRange=function(start,end,opts) {
	var output={};
	for (var i=start;i<end;i++) {
		if (i>=this.meta.slotcount) break;
		output[i] = getText.apply(this,[i,opts]);
	}
	return output;
}
var parseSelector=function(sel) {  // tag[attr=value]
          var m=tag.match(/(.*?)\[(.*?)=(.*)/);
          if (!m) return;
          var tagname=m[1], attributename=m[2],value=m[3];
          if (value[value.length-1]===']') value=value.substring(0,value.length-1);
          return {tag:tagname,attribute:attributename,value:value};
};

var getTextByTag=function(opts) {
	var db=this.getdb();
	var maxslot=opts.maxslot || 1000;
	if (typeof opts.ntag !='undefined') {
		tagseq=parseInt(opts.ntag);
	} else {
		var par=['tags',opts.tag,opts.attribute+'='].concat(opts.value);
		var tagseq=db.get(par) ;
	}

	var t=this.getTag(opts.tag,tagseq);
	t.id=this.getTagAttr(opts.tag, tagseq, opts.attr || 'id');
	var t2=this.getTag(opts.tag,1+tagseq);
	t2.id=this.getTagAttr(opts.tag, 1+tagseq, opts.attr || 'id');

	var seqarr=[];
	for (var i=t.slot;i<t2.slot;i++) {
		seqarr.push(i); 
		if (seqarr.length>maxslot) break; 
	}
	return {slot:t.slot, ntag: tagseq, starttag:t, endtag:t2, head:t.head, text:this.getText(seqarr,opts)};
}	

var getTag=function(tagname,seq) {
	return this.customfunc.getTag(this.getdb(),tagname,seq);
}
var findTag=function(tagname,attributename,value) {
	return this.customfunc.findTag(this.getdb(),tagname,attributename,value);
}
var getTagAttr=function(tagname,ntag,attributename) {
	return this.customfunc.getTagAttr(this.getdb(),tagname,ntag,attributename);
}
var closestTag=function(tagname,nslot,opts) {
	if (typeof tagname =='string') tagname=[tagname];
	var output=[];
	for (var i in tagname) {
		var tn=tagname[i];
		sel=parseSelector(tn);
		if (!sel) { //plain tagname
			var slots= this.getdb().get(['tags',tn,'slot'],true);
			if (!slots) throw 'undefiend TAG '+tagname;
			var c=binarysearch.closest( slots,nslot );
			var tag=this.getTag(tn,c);
			tag.ntag=c;
			output.push( tag);	
		} else { // attr=value selector
			//var slots= this.getdb().get(['tags',sel.tag,'slot'],true);
			var slots=this.getdb().get(['tags',sel.tag,sel.attribute+'='+sel.value,'slot']);
			var c=binarysearch.closest( slots, nslot);
			//convert to ntag
			var ntags=this.getdb().get(['tags',sel.tag,sel.attribute+'='+sel.value,'ntag']);
			var tag=this.getTag(sel.tag,ntags[c]);
			tag.ntag=ntags[c];
			output.push( tag );
		}
	}
	if (output.length==1) return output[0];
	return output;
}
var getTextRange=function(start,end,opts) {
	if (typeof start=='string') {
		o=this.parseSelector(start);
		start=this.findTag(o.tag,o.attribute,o.value).slot;
	} else start=parseInt(start);
	if (typeof end=='string') {
		o=this.parseSelector(end);
		end=this.findTag(o.tag,o.attribute,o.value).slot;
	} else end=parseInt(end);
	var slots=[];
	for (var i=start;i<end;i++) slots.push(i);
	//console.log('fetching',start,end)
	return this.getText(slots,opts);
}
var genToc=function(toctree,opts) {
	var db=this.getdb();
	var start=opts.start || 0;
	var end=opts.end || db.meta.slotcount;

	var output=[];
	for (var i in toctree) {
		var slots=db.get(['tags',toctree[i],'slot']);
		for (var j in slots) {
			output.push( [ 1+parseInt(i), slots[j]])	
		}
		
	}
	output.sort( function(a,b) {return a[1]-b[1]});
	return output;
}
var getToc=function(tagname,seq) {
	return this.getTag(tagname,seq).head;
}
var fetchPage=function(tagname,seq,opts) {
	opts=opts||{};
	var start=this.getTag(tagname,seq);
	var end=this.getTag(tagname,seq+1);

	var r=""
	for (var i=start.slot;i<=end.slot;i++) {
		t=this.getText(i);
		if (i==end.slot) t=t.substr(0,end.offset);
		if (i==start.slot) t=t.substr(start.offset);
		r+=t;
	}
	return r;
}

var yase_use = function(fn) { 
	var db = null;
	var se_preload=function(instance) {
		if (instance.yaseloaded) return;
		instance.meta=instance.get(['meta'],true);
		instance.customfunc=instance.get(['customfunc'],true);
		for (var i in instance.customfunc) {
			//compile the custom function
			var r = new Function(instance.customfunc[i])
			instance.customfunc[i]=r();
		}
		//augment interface
		instance.getToc=getToc;
		instance.getText=getText;
		instance.getTag=getTag;
		instance.findTag=findTag;
		instance.getTagAttr=getTagAttr;
		instance.fetchPage=fetchPage;
		instance.getTextByTag=getTextByTag;
		instance.phraseSearch=phraseSearch;
		instance.getPostingById=getPostingById;
		instance.closestTag=closestTag;
		instance.genToc=genToc;
		instance.phrasecache={};
		instance.phrasecache_raw={};
		instance.parseSelector=parseSelector;
		instance.getTextRange=getTextRange;		
		instance.getRange=getRange;	

		instance.yaseloaded=true;
		instance.getdb=function() {return db};
	}

	if (fn) {
		db = require('yadb').api().open(fn); // make use of yadb db pool 
		se_preload(db);
	} else throw 'missing filename';

	if (!db) throw 'cannot use db '+fn;		
	return db;
}

module.exports=yase_use;
return yase_use;