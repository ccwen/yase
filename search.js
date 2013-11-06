var plist=require('./plist.js');

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
	//trim by range
	if (opts.rangestart || ( typeof opts.rangeend !='undefined' && opts.rangend!=-1) ) {
		g=trimbyrange.apply(this,[g,opts.rangestart,opts.rangeend]);
	}

	if (opts.countonly) {
		return {count:Object.keys(g).length, hitcount: raw.length};
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
		R=highlightresult.apply(this,[g,tokens.length,!opts.highlight]);
	}
	if (profile) console.timeEnd('highlight');
	if (opts.array || opts.closesttag || opts.sourceinfo ) {
		var out=[];
		var seq=opts.start || 0;
		for (var i in R) {
			i=parseInt(i);
			var obj={seq:seq,slot:i,text:R[i]};
			if (opts.closesttag) {
				obj.closest=closestTag.apply(this,[opts.closesttag,i]);
			}
			if (opts.sourceinfo) {
				obj.sourceinfo=sourceInfo.apply(this,[i]);
			}
			seq++;
			out.push(obj);
		}
		return out;
	} else {
		return R;	
	}
	
}

var search=function(operations,opts) {
	var stack=[];
	opts=opts||{};
	opts.distance=opts.distance||2;
    opts.groupsize = Math.pow(2,this.meta.slotshift);

	for (var i=0;i<operations.length;i++) {
		if (typeof operations[i]=='function') {
			var op2=stack.pop(),op1=stack.pop();
			stack.push( operations[i].apply(this,[op1,op2,opts]));
		} else {
			var r=this.phraseSearch(operations[i],{raw:true});
			var ntoken=[];
			for (var j=0;j<r.length;j++) ntoken[j]=i;
			stack.push([r, ntoken]);
		}
	}
	return stack.pop();
}

var near=function(op1,op2,opts) {

}
var notnear=function(op1,op2,opts) {
	
}
var followby=function(op1,op2,opts) {
	//this.meta.slotshift
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
			res.push( pl1[i] )
			ntoken.push( op1[1][i]);

			res.push( pl2[j] );
			ntoken.push( op2[1][j]);
		}
		if (j==pl2.length) break;
		while(i<pl1.length && pl1[i]<pl2[j]) i++;
		if (i==pl1.length) break;
	}
	return [res,ntoken];
}
var notfollowby=function(op1,op2,opts) {
	
}
var or=function(op1,op2,opts) {

}
module.exports={
	NEAR:near,
	NOTNEAR:notnear,
	FOLLOWBY:followby,
	NOTFOLLOWBY:notfollowby,
	OR:or,
	search:search,
	phraseSearch:phraseSearch,
	expandToken:expandToken
};