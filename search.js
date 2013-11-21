/*
  search rewrite
  SPEC https://docs.google.com/document/d/1CHsr-wnzXdm32xsEt2IY4cneq5AS3zq3dqxeLD3onZU/edit
*/

 

var plist=require('./plist.js');
var boolsearch=require('./boolsearch.js');
var taghandlers=require('./taghandlers.js');

var rankvsm=require('./rankvsm');
var highlight=require('./highlight');

/* load similar token with same prefix or simplified (dediacritic )*/
var getTermVariants=function(term,opts) {

	opts=opts||{};
	opts.max=opts.max||100;
	var count=0;
	var out=[];
	var tree=this.customfunc.token2tree.apply(this,[term]);
	var expanded=this.customfunc.expandToken.apply(this, [ tree,[],opts ]);
	var simplified=[],lengths=[];
	if (this.customfunc.simplifiedToken) {
		for (var i=0;i<expanded.length;i++) {
			simplified.push(this.customfunc.simplifiedToken(expanded[i]));
		}
	} else simplified=expanded;

	if (opts.getlengths) {
		for (var i=0;i<expanded.length;i++) {
			var postings=this.getPosting(expanded[i]);
			if (postings) lengths.push(postings.length);
			else lengths.push(0)			
		}
	}
	
	return { expanded:expanded ,simplified:simplified, 
		lengths: lengths, 
		more: expanded.length>=opts.max};

}


var termFrequency=function(nterm,ndoc) {
	if (ndoc==-1) return 1; //the query
	var T=this.phrases[nterm];
	var i=this.indexOfSorted(T.docs,ndoc);
	if (T.docs[i]===ndoc) return Math.log(T.freq[i]+1);
	else return 0;
}
var isWildcard=function(raw) {
	return !!raw.match(/[\*\?]/);
}
var parseWildcard=function(raw) {
	var n=parseInt(raw,10) || 1;
	var qcount=raw.split('?').length-1;
	var scount=raw.split('*').length-1;
	var type='';
	if (qcount) type='?';
	else if (scount) type='*';
	return {wildcard:type, width: n , op:'wildcard'};
}
var parseTerm = function(raw,opts) {
	var res={raw:raw,tokens:[],term:'',op:''};
	var term=raw;
	var op=0;
	var firstchar=term[0];
	if (firstchar=='-') {
		term=term.substring(1);
		res.exclude=true; //exclude
	}

	term=this.customfunc.normalizeToken.apply(this,[term]);
	var lastchar=term[term.length-1];
	
	if (lastchar=='%') {
		res.tokens=getTermVariants.apply(this,[term.substring(0,term.length-1)]).expanded;
		res.op='prefix'
	} else if (lastchar=='^') {
		term=term.substring(0,term.length-1);
		res.op='exact';
	} else if (lastchar==',') {
		term=term.substring(0,term.length-1);
	}
	res.key=term;
	return res;
}
var loadTerm=function() {
	var db=this.db, cache=db.postingcache;
	var terms=this.terms;
	for (var i in this.terms) {
		var key=terms[i].key;
		if (cache[key]) terms[i].posting=cache[key];
		if (!terms[i].posting && terms[i].op!='wildcard') {
			if (terms[i].tokens && terms[i].tokens.length) { //term expands to multiple tokens
				var postings=[];
				for (var j in terms[i].tokens) {
					var posting=db.getPosting(terms[i].tokens[j]);
					postings.push(posting);
				}
				terms[i].posting=plist.combine(postings);
			} else { //term == token
				terms[i].posting=db.getPosting(key);
			}
			cache[key]=terms[i].posting;
		}
	}

}
var loadPhrase=function(phrase) {
	/* remove leading and ending wildcard */
	var db=this.db, cache=db.postingcache;
	if (cache[phrase.key]) {
		phrase.posting=cache[phrase.key];
		return this;
	}

	if (phrase.termid.length==1) {
		cache[phrase.key]
		 =phrase.posting=this.terms[phrase.termid[0]].posting;
		return this;
	}

	var i=0, r=[],dis=0;
	while(i<phrase.termid.length) {
	    var T=this.terms[phrase.termid[i]];
		if (0 === i) {
			r = T.posting;
		} else {
		    if (T.op=='wildcard') {
		    	T=this.terms[phrase.termid[i++]];
		    	var width=T.width;
		    	var wildcard=T.wildcard;
		    	T=this.terms[phrase.termid[i]];
		    	var mindis=dis;
		    	if (wildcard=='?') mindis=dis+width;
		    	if (T.exclude) r = plist.plnotfollow2(r, T.posting, mindis, dis+width);
		    	else r = plist.plfollow2(r, T.posting, mindis, dis+width);		    	
		    	dis+=(width-1);
		    }else {
		    	if (!T.posting) r=[];
		    	else {
		    		if (T.exclude) r = plist.plnotfollow(r, T.posting, dis);
		    		else r = plist.plfollow(r, T.posting, dis);
		    	}
		    }
		}
		dis++;
		i++;
	  }
	  phrase.posting=r;
	  cache[phrase.key]=r;
	  return this;
}
var load=function() {
	loadTerm.apply(this);
	var phrases=this.phrases;
	for (var i in phrases) {
		loadPhrase.apply(this,[phrases[i]]);
	}
	this.loaded=true;
	return this;
}
var matchSlot=function(pl) {
	return plist.matchSlot(pl, this.db.meta.slotshift);
}
var matchPosting=function(pl) {
	return plist.matchPosting(pl,this.groupposting);
}
var groupBy=function(gu) {
	gu=gu||this.opts.groupunit||'';
	if (!this.loaded) this.load();

	var db=this.db,terms=this.terms,phrases=this.phrases;
	var docfreqcache=this.db.docfreqcache;
	var matchfunc=matchSlot;
	if (gu) {
		var groupcache=this.db.groupcache;
		this.groupposting=groupcache[gu];
		if (!this.groupposting) {
			this.groupposting=groupcache[gu]
			 =db.customfunc.loadGroupPosting.apply(db,[gu]);	
		}
		matchfunc=matchPosting;
	}
	this.groupunit=gu;
	/* might need it in the future
	for (var i in terms) {
		if (terms[i].wildcard) continue;

		var key=terms[i].key;
		var docfreq=docfreqcache[key];
		if (!docfreq) docfreq=docfreqcache[key]={};
		if (!docfreq[this.groupunit]) {
			docfreq[this.groupunit]={doclist:null,freq:null};
		}
		if (!terms[i].posting) continue;
		var res=matchfunc.apply(this,[terms[i].posting]);;
		terms[i].freq=res.freq;
		terms[i].docs=res.docs;
		docfreq[this.groupunit]={doclist:terms[i].docs,freq:terms[i].freq};
	}
	*/
	for (var i in phrases) {
		var key=phrases[i].key;
		var docfreq=docfreqcache[key];
		if (!docfreq) docfreq=docfreqcache[key]={};
		if (!docfreq[this.groupunit]) {
			docfreq[this.groupunit]={doclist:null,freq:null};
		}		
		if (!phrases[i].posting) continue;
		var res=matchfunc.apply(this,[phrases[i].posting]);;
		phrases[i].freq=res.freq;
		phrases[i].docs=res.docs;
		docfreq[this.groupunit]={doclist:phrases[i].docs,freq:phrases[i].freq};
	}
	this.grouped=true;
	return this;
}
var newPhrase=function() {
	return {termid:[],posting:[],raw:''};
}
var isOrTerm=function(term) {
	term=term.trim();
	return (term[term.length-1]===',');
}
var orTerms=function(tokens,now) {
	var raw=tokens[now];
	var term=parseTerm.apply(this,[raw]);
	term.tokens.push(term.key);
	while (isOrTerm(raw))  {
		raw=tokens[++now];
		var term2=parseTerm.apply(this,[raw]);
		term2.tokens.push(term2.key);
		term.tokens=term.tokens.concat(term2.tokens);
		term.key+=','+term2.key;
	} ;
	return term;
}

var trim=function(start,end) {
	if (!this.grouped) groupBy.apply(this);

	if (!this.posting || !this.posting.length)return this;
	if (start==0 && end==-1) {
		this.trimmed=true;
		return;
	}
	start=start||this.opts.start;
	this.opts.start=start;
	end=end||this.opts.end;
	this.opts.end=end;	
	this.posting=plist.trim(this.posting,start,end);
	this.trimmed=true;
	return this;
}
var RANK={'vsm':rankvsm};
var search=function(opts) {
	if (!this.trimmed) trim.apply(this);

	for (var i in opts) this.opts[i]=opts[i];
	//VSM prefer union
	if (!this.opts.op && this.opts.rank=='vsm') this.opts.op='union';
	
	boolsearch.search.apply(this,[this.opts]);
	if (this.opts.rank ){
		var rankmodel=RANK[this.opts.rank];
		if (rankmodel) {
			rankmodel.rank.apply(this);
		}
	}
	this.searched=true;
	return this;
}
// sequance : load.groupBy.trim.search.rank.highlight

var newQuery =function(query,opts) {
	opts=opts||{};
	opts.start=opts.start||0;
	opts.end=opts.end||-1;

	var phrases=query;
	if (typeof query=='string') phrases=[query];
	
	var phrase_terms=[];
	var terms=[],variants=[],termcount=0;

	for  (var i in phrases) {
		var tokens=this.customfunc.tokenize.apply(this,[phrases[i]]);
		phrase_terms.push(newPhrase());
		var j=0;
		while (j<tokens.length) {
			var raw=tokens[j];
			if (isWildcard(raw)) {
				terms.push(parseWildcard.apply(this,[raw]));
			} else if (isOrTerm(raw)){
				var term=orTerms.apply(this,[tokens,j]);
				terms.push(term);
				j+=term.term.split(',').length-1;
			} else {
				terms.push(parseTerm.apply(this,[raw]));
			}
			phrase_terms[i].termid.push(termcount++);
			j++;
		}
		phrase_terms[i].key=phrases[i];
	}
	var Q={
		db:this,opts:opts,query:query,phrases:phrase_terms,terms:terms,groupunit:'',
		load:load,groupBy:groupBy,search:search,trim:trim,
		getPhraseWidth:highlight.getPhraseWidth,
		highlight:highlight.highlight,
		termFrequency:termFrequency,
		indexOfSorted:plist.indexOfSorted,
	};
	Q.slotsize=Math.pow(2,this.meta.slotshift);
	Q.slotcount=this.meta.slotcount;
	var that=this;
	Q.tokenize=function() {return that.customfunc.tokenize.apply(that,arguments);}
	Q.getRange=function() {return that.getRange.apply(that,arguments)};
	//API.queryid='Q'+(Math.floor(Math.random()*10000000)).toString(16);
	return Q;
}
module.exports={
	newQuery:newQuery,
	getTermVariants:getTermVariants
};