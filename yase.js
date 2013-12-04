/*
Ksana Search Engine

yadb for supporting full text search
*/

var plist=require('./plist.js');
var binarysearch=require('./binarysearch')
var search1=require('./search1');
var search=require('./search');
var highlight=require('./highlight');
var getPosting=function(token) {
	if (this.customfunc.token2tree) {
		var tokenarr=this.customfunc.token2tree.apply(this,[token]);
	} else {
		var tokenarr=[token];
	}
	tokenarr.unshift('postings');
	var r=this.get(tokenarr,true);
	return r;
}



var getKeys=function(id) {
	return this.getkeys(id);
}



//return range of id given start and end

var getText=function(slot,opts) {
	
	var t=this.customfunc.getText.apply(this,[slot,opts]);
	opts=opts||{};
	var start=0,end=0;
	if (opts && opts.query) {
	 	//console.log('text with tofind',opts.tofind);
		//t=search1.highlighttexts.apply(this, [slot,opts.tofind,opts]);
		if (typeof slot!=='number') {
			start=slot[0];//assume continous
			end=slot[slot.length-1];
		} else {
			start=end=slot;
		}
		var R=this.search({query:opts.query,output:["hits","context"],startslot:start,endslot:end});
		t=highlight.injectTag.apply(R.context,[{textarr:t,hits:R.hits,startslot:start,endslot:end}]);
	}

	//if (!opts) { if (t instanceOf Array) return t.join(""); else return t;}

	var out=[];
	if (opts.tokentag || opts.slotarray || opts.tokenarray) {
		if (typeof slot=='number' || typeof slot=='string') slot=[parseInt(slot)];
		if (typeof t=='string') t=[t];
		var slotsize = 2 << (this.meta.slotshift -1);
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
				 		//var vpos=slot[j]*slotsize+tokenoffset;
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
	var output=[];
	for (var i=start;i<end;i++) {
		if (i>=this.meta.slotcount) break;
		output.push({seq:start-i, slot:i ,text: getText.apply(this,[i,opts])});
	}
	return output;
}
var getTagInRange=function(start,end,tagname,opts) {
	var vpos=this.customfunc.getTagPosting.apply(this,[tagname]);
	var startvpos=start*this.meta.slotsize;
	if (end==-1) end=this.meta.slotcount;
	var endvpos=end*this.meta.slotsize;
	var out=[],count=0;
	opts.maxcount=opts.maxcount||100;
	for (var i=0;i<vpos.length;i++) {
		if (vpos[i]>=startvpos && vpos[i]<endvpos) {
			var T=this.getTag(tagname,i);
			T.values={};
			if (opts.attributes) {
				var hasvalue=false;
				for (var k in opts.attributes) {
					var attr=opts.attributes[k];
					var v=this.getTagAttr(tagname , i, attr);
					T.values[attr]=v;
					T.seq=i;
					if (v) hasvalue=true;
				}
				if (hasvalue) count++; //count only with value
				else if (opts.withattributeonly) continue;
			} else count++;
			out.push(T);
			if (count>=opts.maxcount) break;
		}
	}
	return out;

}

var getTextByTag=function(opts) {
	var maxslot=opts.maxslot || 1000;
	if (opts.selector) {
		sel=this.parseSelector(opts.selector);
		opts.tag=sel.tag;
		opts.attribute=sel.attribute;
		opts.value=sel.value;
	}
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
	t.id=this.getTagAttr(opts.tag, tagseq, opts.attribute || 'id');
	var t2=this.getTag(opts.tag,1+tagseq);
	t2.id=this.getTagAttr(opts.tag, 1+tagseq, opts.attribute || 'id');

	var seqarr=[];
	opts.extraslot=opts.extraslot||0;
	for (var i=t.slot;i<t2.slot+opts.extraslot;i++) {
		seqarr.push(i); 
		if (seqarr.length>maxslot) break; 
	}
	var out={slot:t.slot, ntag: tagseq, starttag:t, endtag:t2, head:t.head, text:this.getText(seqarr,opts)};
	if (opts.sourceinfo) {
		out.sourceinfo=sourceInfo.apply(this,[t.slot]);
	}
	return out;
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

var firstTag=function(tagname,attributename){
	var first=function(obj) { for (var a in obj) return a;}

	if (!attributename) {
		throw 'not implement yet';
	} else {
		var path=['tags',tagname,attributename+'='];
		var t=this.get(path);
		while (typeof t=='object') {
			path.push(first(t));
			t=this.get(path);
		}
		return this.getTag(tagname,t);
	}
}
var firstTagAfter=function(tagname,attributename,start) {
	if (!start) return firstTag.apply(this,[tagname,attributename]);
	var tags=getTagInRange.apply(this,[start,-1,tagname,{attributes:[attributename],maxcount:1,withattributeonly:true}]);
	return tags;
}
var findTagBySelector=function(selector) {
	var T=this.parseSelector(selector);
	return this.customfunc.findTag.apply(this,[T.tag,T.attribute,T.value]);
}
var getTagAttr=function(tagname,ntag,attributename) {
	return this.customfunc.getTagAttr.apply(this,[tagname,ntag,attributename]);
}
var sourceInfo=function(nslot) {
	var starts=this.get(['sourcefilestart'],true);
	var f=binarysearch.closest( starts, nslot*this.meta.slotsize );
	var linebreaks=this.get(['sourcefiles',f,'linebreak'],true);
	var fn=this.get(['sourcefiles',f,'filename']);
	var l=binarysearch.closest(linebreaks, nslot-1);
	return { filename:fn , line:l+2 };
	
	//return file and line number given a slot
}
var closestTag=function(tagname,nslot,opts) {
	if (typeof tagname =='string') tagname=[tagname];
	var output=[];
	for (var i in tagname) {
		var tn=tagname[i];
		sel=this.parseSelector(tn);
		if (sel.attribute && sel.value) { //plain tagname
			//var slots= this.getdb().get(['tags',sel.tag,'slot'],true);
			var vposarr=this.get(['tags',sel.tag,sel.attribute+'='+sel.value,'_vpos']);
			var c=binarysearch.closest( vposarr, nslot*this.meta.slotsize);
			//convert to ntag
			var ntags=this.get(['tags',sel.tag,sel.attribute+'='+sel.value,'ntag']);
			var tag=this.getTag(sel.tag,ntags[c]);
			tag.ntag=ntags[c];
			output.push( tag );
		} else {
			var vposarr= this.get(['tags',sel.tag,'_vpos'],true);
			if (!vposarr) throw 'undefiend TAG '+sel.tag;
			var c=binarysearch.closest( vposarr,nslot*this.meta.slotsize );
			var tag=this.getTag(sel.tag,c);
			if (sel.key) {
				tag.value=this.getTagAttr(sel.tag,c,sel.key);
				var tried=100; //this should be enough
				while (!tag.value && tried && c>=0) {
					tag.value=this.getTagAttr(sel.tag,c--,sel.key);
					tried--;
				}
				if (!tag.value) tag.value=tn+" is undefined, check config.json pagebreak setting or set saveval in indexattributes"
			}
			tag.ntag=c;
			output.push( tag);	
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
	for (var i=start;i<end;i++) {
		slots.push(i);
	}
	//console.log('fetching',start,end)
	return this.getText(slots,opts);
}
var buildToc=function(toc,opts) {
	var toctree=toc;
	if (this.meta.toc && this.meta.toc[toc] ) toctree=this.meta.toc[toc] ;
	
	if (!toctree) return null;
	var R={},hitsvpos=null;
	if (opts.query) {
		R=this.search({query:opts.query,output:['hits']});
		hitsvpos=R.hits.map(function(a){return a[0]}); //take only vpos
	}	
	var T=this.genToc(toctree,opts);
	var Tvpos=T.map(function(a) {return a[1]});
	var Tree=[];
	for (var i in toctree) {
		Tree.push(this.parseSelector(toctree[i]));
	}
	var hits=null;
	if (hitsvpos&&hitsvpos.length) {
		var g=plist.countbyposting(hitsvpos, Tvpos);
		hits=plist.groupsum(g,T.map(function(a){return a[0]}));
	}

	var output=[];
	for (var i=0;i<T.length;i++ ) {
		if (opts.hidenohit && hits && !hits[i]) continue;
		var sel=Tree[T[i][0]];
		var tag=this.getTag(sel.tag,T[i][2]);
		var head=tag.head||"";
		if (sel.key) title=this.getTagAttr(sel.tag,T[i][2],sel.key);
		else title="";
		var tocnode={depth:T[i][0], title:title, head:head,slot: tag.slot, hit:0 };
		if (hits && hits[i]) tocnode.hit=hits[i];
		output.push(tocnode);
	}
	return output;
}

var genToc=function(toc,opts) {
	var toctree=toc;
	if (this.meta.toc && this.meta.toc[toc] ) toctree=this.meta.toc[toc] ;
	//var db=this.getdb();
	var start=opts.start || 0;
	var end=opts.end || this.meta.slotcount;

	var output=[];
	for (var i in toctree) {
		var sel=this.parseSelector(toctree[i]);
		var vposarr=this.get(['tags',sel.tag,'_vpos']);
		for (var j in vposarr) {
			//toc level, vpos, tagseq
			output.push( [ parseInt(i), vposarr[j], parseInt(j)])	
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
		instance.meta.slotsize=2<<(instance.meta.slotshift -1);
		//augment interface
		instance.getToc=getToc;
		instance.getText=getText;
		instance.getTag=getTag;
		instance.getTagPosting=getTagPosting;
		instance.findTag=findTag;
		instance.firstTagAfter=firstTagAfter;
		instance.findTagBySelector=findTagBySelector;
		instance.getTagAttr=getTagAttr;

		instance.fetchPage=fetchPage;
		instance.getTextByTag=getTextByTag;
		instance.search=search.search;

		instance.getPosting=getPosting;
		instance.closestTag=closestTag;
		instance.sourceInfo=sourceInfo;
		instance.getTagInRange=getTagInRange;
		instance.genToc=genToc;
		instance.buildToc=buildToc;
		instance.phrasecache={};
		instance.phrasecache_raw={};

		instance.postingcache={};
		instance.docfreqcache={}; // term/phrase doclist and freq
		instance.groupcache={};  //store group posting
		instance.querycache={};

		instance.tagpostingcache={};
		instance.getTextRange=getTextRange;		
		instance.getRange=getRange;	
		instance.parseSelector=require('./taghandlers').parseSelector;
		instance.yaseloaded=true;
		instance.filename=fn;

		instance.getTermVariants=search.getTermVariants;
		instance.newQuery=search.newQuery;
		instance.getdb=function() {return db};

		/* old interface */
		instance.phraseSearch=search1.phraseSearch;
		instance.boolSearch=search1.boolSearch;
		instance.renderhits=search1.renderhits;
		
	}

	if (fn) {
		var yadb=require('yadb').api();
		db = yadb.open(fn,opts); // make use of yadb db pool 
		if (!db) return null;
		se_preload(db);
	} else throw 'missing filename';

	//if (!db) throw 'cannot use db '+fn;		
	return db;
}

module.exports=yase_use;
return yase_use;
