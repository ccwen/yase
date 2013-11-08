var plist=require('./plist.js');
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
	opts.max=opts.max||30;
	var count=0;
	var out=[];
	var tree=this.customfunc.token2tree(token);
	var keys=expandKeys.apply(this, [ tree,[],opts ]);
	var simplified=[],count=[];
	if (this.customfunc.simplifiedToken) {
		for (var i in keys) {
			simplified.push(this.customfunc.simplifiedToken(keys[i]));

			if (opts.count) {
				var postings=this.getPostingById(keys[i]);
				if (postings) count.push(postings.length);
				else count.push(0)
			}
		}
	} else simplified=keys;
	var counts=[];
	
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
				output+=tokens[i];len--;
				if (i>=tokens.length) break;
				if (tokens[i][0]!='<') voff++;
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
var highlighttexts=function(seqarr,tofind) {

	var R=this.phraseSearch(tofind,{grouped:true});

	var tokens=this.customfunc.tokenize.apply(this,[tofind]);
	var tokenlengths=[tokens.length];

	if (typeof seqarr=='number' || typeof seqarr=='string') {
		var t=this.getText(parseInt(seqarr));
		if (R[seqarr]) return highlight({ text: t , hits: R[seqarr] , ntokens:[0]} );
		else return t;
	} else {
		var out="";
		for (var i in seqarr) { //TODO : fix overflow slot
			var seq=seqarr[i];
			var hits=R[seq];
			var t=this.getText(seq);
			if (typeof t=='undefined') break;
			var hopts={ text: t , hits: hits, ntokens:[0], tokenize:this.customfunc.tokenize,tokenlengths:tokenlengths};
			if (hits) out+= highlight.apply(this, [ hopts]);
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
		return {count:Object.keys(g).length, hitcount: opts.raw.length};
	}

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
		

		var g=plist.groupbyblock(raw, this.meta.slotshift);
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
		g=plist.groupbyblock(raw, this.meta.slotshift);
	}
	opts.raw=raw;
	return renderhits.apply(this,[g,[0],opts]);
}


var nearby=function(op1,op2,opts) {

}
var notnearby=function(op1,op2,opts) {
	
}
/* must have op2 after op1 */
var followby=function(op1,op2,opts) {
	var res=[], ntoken=[];
	var i=0,j=0;
	var pl1=op1[0], pl2=op2[0];
	var g2=Math.floor(pl2[0] / opts.groupsize);
	while (i<pl1.length) {
		while (j<pl2.length && pl2[j]<pl1[i]) {
			j++;
			g2=Math.floor(pl2[j] / opts.groupsize);
		}

		var g1=Math.floor(pl1[i] / opts.groupsize);
		var d=g2-g1;
		if (d>0 && d<opts.distance) {
			var d2=d;
			while (d2>0 && d2<opts.distance) {
				res.push( pl1[i] )
				ntoken.push( op1[1][i]);
				i++;
				d2=g2-Math.floor(pl1[i] / opts.groupsize);
			}
			while (d>0 && d<opts.distance) {
				res.push( pl2[j] );
				ntoken.push( op2[1][j]);
				j++;
				d=Math.floor(pl2[j] / opts.groupsize)-g1;
			}
		}
		if (j>=pl2.length) break;
		while(i<pl1.length && pl1[i]<pl2[j]) i++;
		if (i>=pl1.length) break;
	}
	return [res,ntoken];
}
/* op1 must not followed by op2 */
var notfollowby=function(op1,op2,opts) {
	var res=[], ntoken=[];
	var i=0,j=0;
	var pl1=op1[0], pl2=op2[0];
	var g2=Math.floor(pl2[0] / opts.groupsize);
	while (i<pl1.length) {
		while (j<pl2.length && pl2[j]<pl1[i]) {
			res.push( pl2[j] )
			ntoken.push( op2[1][j]);

			j++;
			g2=Math.floor(pl2[j] / opts.groupsize);
		}

		var g1=Math.floor(pl1[i] / opts.groupsize);
		var d=g2-g1;
		if (d>0 && d<opts.distance) {
			var d2=d;
			while (d2>0 && d2<opts.distance) {
				i++;
				d2=g2-Math.floor(pl1[i] / opts.groupsize);
			}
			while (d>0 && d<opts.distance) {
				j++;
				d=Math.floor(pl2[j] / opts.groupsize)-g1;
			}
		}
		if (j>=pl2.length) break;
		while(i<pl1.length && pl1[i]<pl2[j]) {
			res.push( pl1[i] )
			ntoken.push( op1[1][i]);
			i++;
		}
		if (i>=pl1.length) break;
	}
	while (i<pl1.length) {
		res.push( pl1[i] )
		ntoken.push( op1[1][i]);
		i++;
	}
	return [res,ntoken];
}

var OPERATIONS={
	nearby:nearby,
	notnearby:notnearby,
	followby:followby,
	notfollowby:notfollowby,	
}

var boolSearch=function(operations,opts) {
	var stack=[];
	opts=opts||{};
	var tokenlengths=[];
	opts.distance=opts.distance||2;
    opts.groupsize = Math.pow(2,this.meta.slotshift);
    var n=0;

	for (var i=0;i<operations.length;i++) {
		if (typeof operations[i]=='string') {
			var op=OPERATIONS[operations[i]];
			if (stack.length>=2) {
				var op2=stack.pop(),op1=stack.pop();
				stack.push( op.apply(this,[op1,op2,opts]));
			}
		} else {

			for (var j=0;j<operations[i].length;j++) {
				var r=this.phraseSearch(operations[i][j],{raw:true});
				var ntoken=[];
				for (var k=0;k<r.length;k++) ntoken[k]=n;
				stack.push([r, ntoken]);

				var tokens=this.customfunc.tokenize.apply(this,[operations[i][j].trim()]);
				tokenlengths[n]=tokens.length;
				n++;
			}

			for (var j=0;j<operations[i].length-1;j++) {
				var op2=stack.pop(),op1=stack.pop();
				stack.push( or.apply(this,[op1,op2,opts] ) );
			}

		}
	}
	var r=stack.pop();
	opts.raw=r[0];
	if (opts.grouped || opts.highlight) {
		r=plist.groupbyblock2( r[0],r[1],this.meta.slotshift);
	}
	opts.tokenlengths=tokenlengths;

	return renderhits.apply(this,[r[0],r[1],opts]);
}

/* combine two postings with ntoken */
var or=function(op1,op2,opts) {
	var r=[];
	for (var i=0;i<op1[0].length;i++) r.push( [op1[0][i], op1[1][i]])
	for (var i=0;i<op2[0].length;i++) r.push( [op2[0][i], op2[1][i]])
	r.sort(function(a,b){ return a[0]-b[0] });
	res=r.map(function(a){return a[0]} )
	ntoken=r.map(function(a){return a[1]} )
	return [res,ntoken];
}

module.exports={
	nearby:nearby,
	notnearby:notnearby,
	followby:followby,
	notfollowby:notfollowby,
	boolSearch:boolSearch,
	phraseSearch:phraseSearch,
	expandToken:expandToken,
	highlighttexts:highlighttexts
};