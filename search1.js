var plist=require('./plist.js');
var boolsearch=require('./boolsearch.js');
var expandKeys=function(fullpath,path,opts) {
	var out=[];
	path=JSON.parse(JSON.stringify(path))
	path.unshift('postings')
	var out1=this.keys(path);
	path.shift();

	var prefix=" ";
	if (path.length<fullpath.length) {
		prefix=fullpath[path.length];
	} else {
		prefix="" ;//final
	}
	out1=out1.sort(function(a,b){
		if (a<b) return -1;
		else if (a>b) return 1;
		else return 0;
	});
	
	for (var i in out1) {
		var lead=out1[i];
		var sim=lead;

		if (path[path.length-1] && prefix!=" ") {
			lead=lead.substring(0, prefix.length);
		}

		var leadsim=lead=this.customfunc.normalizeToken.apply(this,[lead]);
		if (this.customfunc.simplifiedToken) {
			leadsim=this.customfunc.simplifiedToken.apply(this,[lead]);
			sim=this.customfunc.simplifiedToken.apply(this,[out1[i]]);
		}
		
		if (leadsim==prefix || lead==prefix || lead==" " || prefix==" ") {
			//console.log('hit',out1[i])

			var start=0;
			if (path[path.length-1] && prefix!=" ") start=prefix.length;

			//if (out1[i]==" ") out.push(path.join(""));
			if (path.length<fullpath.length-1 && out1[i]!=" ") {

				if (opts.exact && out1[i]!=fullpath[path.length] &&
						sim!=fullpath[path.length]) continue;
				
				path.push(out1[i]);
				out=out.concat(expandKeys.apply(this,[fullpath,path,opts]));	
				path.pop();
			} else {
				if (opts.exact) {
					if (out1[i]==fullpath[path.length] || 
							sim==fullpath[path.length]) {
							out.push(path.join("")+out1[i].trim());		
					}
				} else {
					out.push(path.join("")+out1[i].trim());	
				}
			}
			if (out.length>=opts.max) break;
		}
	}
	return out;
}
var expandToken=function(token,opts) {
	//see test/yase-test.js for spec
	if (!this.customfunc.simplifiedToken) return false;

	opts=opts||{};
	opts.max=opts.max||100;
	var count=0;
	var out=[];
	var tree=this.customfunc.token2tree(token);
	var keys=expandKeys.apply(this, [ tree,[],opts ]);
	var simplified=[],count=[];
	if (this.customfunc.simplifiedToken) {
		for (var i=0;i<keys.length;i++) {
			simplified.push(this.customfunc.simplifiedToken(keys[i]));
		}
	} else simplified=keys;

	if (opts.count) {
		for (var i=0;i<keys.length;i++) {
			var postings=this.getPostingById(keys[i]);
			if (postings) count.push(postings.length);
			else count.push(0)			
		}
	}
	
	return { raw:keys ,simplified:simplified, count: count, more: keys.length>=opts.max};

}
var profile=false;
// TODO , wildcard '?' for 
var loadtoken=function(token) {
	var op='and';
	token=token.trim();
	if (token.trim()[0]=='<') return false;

	var lastchar=token[token.length-1];
	if (lastchar=='^' || lastchar=='*') {
		token=token.substring(0,token.length-1);
	}
	if (lastchar=='^') { //do not expand if ends with ^
		return {posting:this.getPostingById(token),op:op};
	}
	if (lastchar=='!') {
		op='andnot';
		token=token.substring(0,token.length-1)
	}

	var exact=true;
	if (lastchar=='*') exact=false; //automatic prefix
	
	var t=this.customfunc.normalizeToken?
		this.customfunc.normalizeToken.apply(this,[token]):token;
	
	var expandtokens=expandToken.apply(this,[ t , {exact:exact}]);
	var posting=null;
	if (expandtokens){
		tokens=expandtokens.raw;
		if (tokens.length==1) {
			posting=this.getPostingById(tokens[0]);	
		} else {
			var postings=[];
			for (var i in tokens) {
				postings.push(this.getPostingById(tokens[i]));
			}
			posting=plist.combine(postings);
		}
	} else {
		posting=this.getPostingById(t);	
	}	
	return {posting:posting,op:op};
}

var highlight=function(opts) {
	var tokens=opts.tokenize.apply(this,[opts.text]);
	var i=0,j=0,last=0,voff=0,now=0;
	var output='';

	while (tokens[i][0]=='<') output+=tokens[i++];

	while (i<tokens.length) {
		if (voff==opts.hits[j]) {
			var ntoken=opts.ntokens[j];
			var len=opts.tokenlengths[ntoken] || opts.tokenlengths[0];
			output+= '<hl n="'+ntoken+'">';
			while (len) {
				output+=tokens[i];
				if (i>=tokens.length) break;
				if (tokens[i][0]!='<') {
					voff++;
					len--;
				}
				i++;
			}
			output+='</hl>';
			j++;
		} else {
			output+=tokens[i];
			if (tokens[i][0]!='<') voff++;
			i++;
		}
	}
	while (i<tokens.length) output+= tokens[i++];
	return output;
}
//return highlighted texts given a raw hits
var highlighttexts=function(seqarr,tofind,opts) {
	opts.searchtype=opts.searchtype||"phraseSearch";
	var R=this[opts.searchtype](tofind,{all:true});

	if (typeof seqarr=='number' || typeof seqarr=='string') {
		var t=this.getText(parseInt(seqarr));
		if (R.grouped[seqarr]) {
			return highlight({ text: t , hits: R.grouped[seqarr] , ntokens:R.ntokens[seqarr],
			tokenlengths:R.tokenlengths} );
		}
		else return t;
	} else {
		var out="";
		for (var i in seqarr) { //TODO : fix overflow slot
			var seq=seqarr[i];
			var hits=R.grouped[seq];
			var t=this.getText(seq);
			if (typeof t=='undefined') break;
			if (hits) {
				var hopts={ text: t , hits: hits, ntokens:R.ntokens[seq]||R.ntokens, 
					tokenize:this.customfunc.tokenize,tokenlengths:R.tokenlengths};
				out+= highlight.apply(this, [ hopts]);
			}
			else out+=t;
		}
		return out;
	}
}

var highlightresult=function(R,ntokens,tokenlengths,nohighlight) {
	var rescount=0;
	var slotsize = 2 << (this.meta.slotshift -1);	
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
			addition+=slotsize;
		}
	
		if (addition) hits=hits.map( function(j) {return addition+j});

		if (nohighlight) {
			var h=text;
		} else {
			var h=highlight.apply(this,[{
				tokenize:this.customfunc.tokenize,
				hits:hits,
				ntokens:ntokens[i] || [0],
				text:text,
				tokenlengths:tokenlengths
			}]);

		}
		output[nslot]=h;
	}
	return output;
}
//need optimized, use array slice
var trimbyrange=function(g, start,end) {
	var out={};
	start=start||0;
	if (end==-1) end=this.meta.slotcount+1;
	for (var i in g) {
		i=parseInt(i);
		if (i>=start && i<end)  {
			out[i]=g[i];
		}
	}
	return out;
}

var renderhits=function(g,ntokens,opts) {
	if (opts.countonly) {
		return {count:Object.keys(g).length, hitcount: opts.rawposting.length};
	}

	if (opts.all) return {grouped:g, ntokens:ntokens, tokenlengths:opts.tokenlengths};
	if (!opts.showtext && !opts.highlight) return [g,ntokens];
	
	//trim by range
	if (opts.rangestart || ( typeof opts.rangeend !='undefined' && opts.rangend!=-1) ) {
		g=trimbyrange.apply(this,[g,opts.rangestart,opts.rangeend]);
	}

	//trim output
	if (opts.start!=undefined) {
		opts.maxcount=opts.maxcount||10;
		var o={};
		var count=0,start=opts.start;
		for (var i in g) {
			if (start==0) {
				if (count>=opts.maxcount) break;
				o[i]=g[i];
				count++;
			} else {
				start--;
			}
		}
		g=o;
	}

	if (opts.grouped) return g;
	if (profile) console.time('highlight')
	var R="";
	opts.showtext=opts.showtext || opts.highlight;

	if (opts.showtext) {
		R=highlightresult.apply(this,[g,ntokens,opts.tokenlengths,!opts.highlight]);
	}
	if (profile) console.timeEnd('highlight');
	if (opts.array || opts.closesttag || opts.sourceinfo ) {
		var out=[];
		var seq=opts.start || 0;
		for (var i in R) {
			i=parseInt(i);
			var obj={seq:seq,slot:i,text:R[i]};
			if (opts.closesttag) {
				obj.closest=this.closestTag.apply(this,[opts.closesttag,i]);
			}
			if (opts.sourceinfo) {
				obj.sourceinfo=this.sourceInfo.apply(this,[i]);
			}
			seq++;
			out.push(obj);
		}
		return out;
	} else {
		return R;	
	}
}
var phraseSearch=function(tofind,opts) {
	var tokenize=this.customfunc.tokenize;
	if (!tokenize) throw 'no tokenizer';
	if (!tofind) {
		if (opts.countonly || opts.rawcountonly) return 0;
		return [];
	}
	if (typeof tofind=='number') tofind=tofind.toString();
	var postings=[],ops=[];
	var tokens=tokenize.apply(this,[tofind.trim()]);
	opts.tokenlengths=[tokens.length];
	var g=null,raw=null;
	var tag=opts.tag||"";
	opts.array =true; //default output format
	if (this.phrasecache_raw && this.phrasecache_raw[tofind]) {
		raw=this.phrasecache_raw[tofind];
	}

	if (this.phrasecache&& this.phrasecache[tofind]) {
		g=this.phrasecache[tofind];
	} else {
		if (profile) console.time('get posting');
		for (var i in tokens) {
			var loaded=loadtoken.apply(this,[tokens[i]])
			if (loaded.posting) {
				postings.push(loaded.posting);
				ops.push(loaded.op);
			}
		}
		if (profile) console.timeEnd('get posting');
		if (profile) console.time('phrase merge')
		if (!raw) raw=plist.plphrase(postings,ops);
		if (profile) console.timeEnd('phrase merge')
		if (profile) console.time('group block');
		

		var g=plist.groupbyslot(raw, this.meta.slotshift);
		if (profile) console.timeEnd('group block')		
		if (this.phrasecache) this.phrasecache[tofind]=g;
		if (this.phrasecache_raw) this.phrasecache_raw[tofind]=raw;
	}
	if (opts.rawcountonly) return raw.length;
	if (opts.raw) return raw;

	if (tag) {
		pltag=this.getTagPosting(tag);
		//this.tagpostingcache[tag];
		//if (!pltag) pltag=this.tagpostingcache[tag]=this.getTagPosting(tag);
		
		raw=plist.plhead(raw, pltag );
		if (opts.rawcountonly) return raw.count;
		g=plist.groupbyslot(raw, this.meta.slotshift);
	}
	opts.rawposting=raw;
	return this.renderhits.apply(this,[g,[0],opts]);
}


module.exports={
	nearby:boolsearch.nearby,
	notnearby:boolsearch.notnearby,
	followby:boolsearch.followby,
	notfollowby:boolsearch.notfollowby,
	boolSearch:boolsearch.boolSearch,
	phraseSearch:phraseSearch,
	expandToken:expandToken,
	renderhits:renderhits,
	highlighttexts:highlighttexts
};