/*
Ksana Search Engine

yadb for supporting full text search
*/

var plist=require('./plist.js');
var binarysearch=require('./binarysearch')

var getPostingById=function(id) {
	if (this.customfunc.token2tree) {
		var idarr=this.customfunc.token2tree.apply(this,[id]);
	} else {
		var idarr=[id];
	}
	idarr.unshift('postings');
	var r=this.get(idarr,true);
	return r;
}
var highlight=function(opts) {
	var tokens=opts.tokenize.apply(this,[opts.text]);
	var i=0,j=0,last=0,voff=0,now=0;
	var output='';
	
	while (i<tokens.length) {
		if (voff==opts.hits[j]) {
			while (last<i) output+= tokens[last++];
			while (tokens[i][0]=='<') output+= tokens[i++];
			output+= '<hl>';
			var len=opts.phraselength;
			while (len) {
				output+=tokens[i++];len--;
				if (i>=tokens.length) break;
				if (tokens[i][0]!='<') voff++;				
			}
			output+='</hl>';
			last=i;
			j++;
		}
		if (tokens[i] && tokens[i][0]!='<') voff++;
		i++;
	}
	while (last<tokens.length) output+= tokens[last++];
	return output;
}
//return highlighted texts given a raw hits
var highlighttexts=function(seqarr,tofind) {
	var R=this.phraseSearch(tofind,{grouped:true});

	var tokens=this.customfunc.tokenize.apply(this,[tofind]);
	var phraselength=tokens.length;

	if (typeof seqarr=='number' || typeof seqarr=='string') {
		var t=this.getText(parseInt(seqarr));
		if (R[seqarr]) return highlight({ text: t , hits: R[seqarr]} );
		else return t;
	} else {
		var out="";
		for (var i in seqarr) { //TODO : fix overflow slot
			var seq=seqarr[i];
			var hits=R[seq];
			var t=this.getText(seq);
			var hopts={ text: t , hits: hits, tokenize:this.customfunc.tokenize,phraselength:phraselength};
			if (hits) out+= highlight.apply(this, [ hopts]);
			else out+=t;
		}
		return out;
	}
}
var highlightresult=function(R,phraselength,nohighlight) {
	var rescount=0;
	var blocksize = 2 << (this.meta.blockshift -1);	
	//console.log('highlightresult',R)
	var lasti='', hits=[],addition=0;
	var output={};
	/* TODO , same sentence in multiple slot render once */
	for (var i in R) {
		var nslot=parseInt(i);
		var text=this.getText(nslot);
		var hits=R[i];
		addition=0;

		while (!text && nslot) {
			nslot--;
			text=this.getText(nslot);
			addition+=blocksize;
		}
	
		if (addition) hits=hits.map( function(j) {return addition+j});

		if (nohighlight) {
			var h=text;
		} else {
			var h=highlight.apply(this,[{
				tokenize:this.customfunc.tokenize,
				hits:hits,
				text:text,
				phraselength:phraselength
			}]);

		}
		output[nslot]=h;
	}
	return output;
}
var profile=false;
var phraseSearch=function(tofind,opts) {
	var tokenize=this.customfunc.tokenize;
	if (!tokenize) throw 'no tokenizer';
	var postings=[];
	var tokens=tokenize.apply(this,[tofind]);
	var g=null,raw=null;
	var tag=opts.tag||"";

	if (this.phrasecache_raw && this.phrasecache_raw[tofind]) {
		raw=this.phrasecache_raw[tofind];
	}

	if (this.phrasecache&& this.phrasecache[tofind]) {
		g=this.phrasecache[tofind];
	} else {
		if (profile) console.time('get posting');
		for (var i in tokens) {
			if (tokens[i].trim()[0]=='<') continue;
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

	if (tag) {
		pltag=this.getTagPosting(tag);
		//this.tagpostingcache[tag];
		//if (!pltag) pltag=this.tagpostingcache[tag]=this.getTagPosting(tag);
		
		raw=plist.plhead(raw, pltag );
		g=plist.groupbyblock(raw, this.meta.blockshift);
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
		R=highlightresult.apply(this,[g,tokens.length,!opts.highlight]);
	}
	if (profile) console.timeEnd('highlight');
	if (opts.array || opts.closesttag) {
		var out=[];
		for (var i in R) {
			i=parseInt(i);
			var obj={slot:i,text:R[i]};
			if (opts.closesttag) {
				obj.closest=closestTag.apply(this,[opts.closesttag,i]);
			}
			out.push(obj);
		}
		return out;
	} else {
		return R;	
	}
	
}
var getKeys=function(id) {
	throw 'not implemented'
}
//return range of id given start and end

var getText=function(slot,opts) {
	if (opts && opts.tofind) {
	 	//console.log('text with tofind',opts.tofind);
		t=highlighttexts.apply(this, [slot,opts.tofind]);
	} else {
	 	var t=this.customfunc.getText.apply(this,[slot,opts]);
	 	if (!opts) { if (typeof t=='object') return t.join(""); else return t; }
	}

	var out=[];
	if (opts.tokentag || opts.slotarray || opts.tokenarray) {
		if (typeof slot=='number' || typeof slot=='string') slot=[parseInt(slot)];
		if (typeof t=='string') t=[t];
		var blocksize = 2 << (this.meta.blockshift -1);
		for (var j in t) {
			var T="",TK=[];
			var tokenoffset=0;
			if (opts.tokentag || opts.tokenarray) {
			 	var tokenize=this.customfunc.tokenize;
			 	var tokens=tokenize.apply(this,[t[j]]);
			 	for (var i in tokens) {
			 		var tk=tokens[i];
			 		//if (tk=='\n' && opts.addbr) T+="<br/>";
			 		if (!tokens[i][0]!='<') {
			 			tokenoffset++;
				 		//var vpos=slot[j]*blocksize+tokenoffset;
				 		if (opts.tokenarray) {
				 			TK.push(tk);
				 		} else {
				 			T+='<tk n="'+tokenoffset+'">'+tk+'</tk>';	
				 		}
				 		
				 	} else T+=tk;
			 	}
			} else T=t[j];
			if (opts.slotarray) {
				if (opts.tokenarray) out.push(TK)
				else out.push(T);
			} else {
				if (opts.slottag) out.push('<slot n="'+slot[j]+'">'+T+'</slot>');	
			}
			
		}
		if (opts.slotarray) return out;
		else return out.join("");

	 } else {
	 	if (typeof t=='object') return t.join(""); else return t;
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
          var m=sel.match(/(.*?)\[(.*?)=(.*)/);
          if (!m) return;
          var tagname=m[1], attributename=m[2],value=m[3];
          if (value[value.length-1]===']') value=value.substring(0,value.length-1);
          return {tag:tagname,attribute:attributename,value:value};
};
var getTagInRange=function(start,end,tagname,opts) {
	var vpos=this.customfunc.getTagPosting.apply(this,[tagname]);
	var startvpos=start*this.meta.blocksize;
	var endvpos=end*this.meta.blocksize;
	var out=[];
	for (var i=0;i<vpos.length;i++) {
		if (vpos[i]>=startvpos && vpos[i]<endvpos) {
			var T=this.getTag(tagname,i);
			T.values={};
			if (opts.attributes) for (var k in opts.attributes) {
				var attr=opts.attributes[k];
				var v=this.getTagAttr(tagname , i, attr);
				T.values[attr]=v;
			}
			out.push(T);
		}
	}
	return out;

}

var getTextByTag=function(opts) {
	var maxslot=opts.maxslot || 1000;
	if (typeof opts.ntag !='undefined') {
		tagseq=parseInt(opts.ntag);
	} else {
		if (typeof opts.value=='string') {
			var depth=this.meta.schema[opts.tag]
				      .indexattributes[opts.attribute].depth;
			if (depth>1) {
				opts.value=opts.value.split('.');
				while (opts.value.length<depth) opts.value.push(' ');
			}
		}
		var par=['tags',opts.tag,opts.attribute+'='].concat(opts.value);
		var tagseq=this.get(par) ;
	}

	var t=this.getTag(opts.tag,tagseq);
	t.id=this.getTagAttr(opts.tag, tagseq, opts.attr || 'id');
	var t2=this.getTag(opts.tag,1+tagseq);
	t2.id=this.getTagAttr(opts.tag, 1+tagseq, opts.attr || 'id');

	var seqarr=[];
	opts.extraslot=opts.extraslot||0;
	for (var i=t.slot;i<t2.slot+opts.extraslot;i++) {
		seqarr.push(i); 
		if (seqarr.length>maxslot) break; 
	}
	return {slot:t.slot, ntag: tagseq, starttag:t, endtag:t2, head:t.head, text:this.getText(seqarr,opts)};
}	

var getTag=function(tagname,seq) {
	return this.customfunc.getTag.apply(this,[tagname,seq]);
}
var getTagPosting=function(tagname) {
	return this.customfunc.getTagPosting.apply(this,[tagname]);
}
var findTag=function(tagname,attributename,value) {
	return this.customfunc.findTag.apply(this,[tagname,attributename,value]);
}
var findTagBySelector=function(selector) {
	var T=parseSelector(selector);
	return this.customfunc.findTag.apply(this,[T.tag,T.attribute,T.value]);
}
var getTagAttr=function(tagname,ntag,attributename) {
	return this.customfunc.getTagAttr.apply(this,[tagname,ntag,attributename]);
}
var closestTag=function(tagname,nslot,opts) {
	if (typeof tagname =='string') tagname=[tagname];
	var output=[];
	for (var i in tagname) {
		var tn=tagname[i];
		sel=parseSelector(tn);
		if (!sel) { //plain tagname
			var vposarr= this.get(['tags',tn,'_vpos'],true);
			if (!vposarr) throw 'undefiend TAG '+tn;
			var c=binarysearch.closest( vposarr,nslot*this.meta.blocksize );
			var tag=this.getTag(tn,c);
			tag.ntag=c;
			output.push( tag);	
		} else { // attr=value selector
			//var slots= this.getdb().get(['tags',sel.tag,'slot'],true);
			var vposarr=this.get(['tags',sel.tag,sel.attribute+'='+sel.value,'_vpos']);
			var c=binarysearch.closest( vposarr, nslot*this.meta.blocksize);
			//convert to ntag
			var ntags=this.get(['tags',sel.tag,sel.attribute+'='+sel.value,'ntag']);
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
	//var db=this.getdb();
	var start=opts.start || 0;
	var end=opts.end || this.meta.slotcount;

	var output=[];
	for (var i in toctree) {
		var vposarr=this.get(['tags',toctree[i],'_vpos']);
		for (var j in vposarr) {
			output.push( [ 1+parseInt(i), vposarr[j]])	
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

var yase_use = function(fn,opts) { 
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
		instance.meta.schema=JSON.parse(instance.meta.schema);
		instance.meta.blocksize=2<<(instance.meta.blockshift -1);
		//augment interface
		instance.getToc=getToc;
		instance.getText=getText;
		instance.getTag=getTag;
		instance.getTagPosting=getTagPosting;
		instance.findTag=findTag;
		instance.findTagBySelector=findTagBySelector;
		instance.getTagAttr=getTagAttr;
		instance.fetchPage=fetchPage;
		instance.getTextByTag=getTextByTag;
		instance.phraseSearch=phraseSearch;
		instance.getPostingById=getPostingById;
		instance.closestTag=closestTag;
		instance.getTagInRange=getTagInRange;
		instance.genToc=genToc;
		instance.phrasecache={};
		instance.phrasecache_raw={};
		instance.tagpostingcache={};
		instance.parseSelector=parseSelector;
		instance.getTextRange=getTextRange;		
		instance.getRange=getRange;	

		instance.yaseloaded=true;
		instance.getdb=function() {return db};
	}

	if (fn) {
		db = require('yadb').api().open(fn,opts); // make use of yadb db pool 
		se_preload(db);
	} else throw 'missing filename';

	if (!db) throw 'cannot use db '+fn;		
	return db;
}

module.exports=yase_use;
return yase_use;
