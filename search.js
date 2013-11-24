/*
  search rewrite
  SPEC https://docs.google.com/document/d/1CHsr-wnzXdm32xsEt2IY4cneq5AS3zq3dqxeLD3onZU/edit

  QUERY PHASE
  0: ready
  1: all postings loaded
  2: groupposting ready
  3: docs found and ranked
  4: highlighted text ok
*/

var plist=require('./plist.js');
var boolsearch=require('./boolsearch.js');
var rankvsm=require('./rankvsm');
var highlight=require('./highlight');
var querysyntax_google=require('./querysyntax_google');

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
		for (var i in expanded) {
			simplified.push(this.customfunc.simplifiedToken(expanded[i]));
		}
	} else simplified=expanded;

	if (opts.getlengths) {
		for (var i in expanded) {
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
	var term=raw, op=0;
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
	this.terms.forEach(function(T){
		var key=T.key;
		if (cache[key]) T.posting=cache[key];
		if (db.customfunc.expandToken && T.op!='exact') {
			var tree=db.customfunc.token2tree.apply(db,[key]);
			var expanded=db.customfunc.expandToken.apply(db, [ tree,[],{exact:true} ]);
			if (expanded) T.tokens=plist.unique(T.tokens.concat(expanded));
		}
		if (!T.posting && T.op!='wildcard') {
			if (T.tokens && T.tokens.length) { //term expands to multiple tokens
				var postings=[];
				T.tokens.forEach(function(TK){
					var posting=db.getPosting(TK);
					postings.push(posting);
				});
				T.posting=plist.combine(postings);
			} else { //term == token
				T.posting=db.getPosting(key);
			}
			cache[key]=T.posting;
		}
	});

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
		dis++;	i++;
	  }
	  phrase.posting=r;
	  cache[phrase.key]=r;
	  return this;
}
var load=function() {
	loadTerm.apply(this);
	var phrases=this.phrases;
	var that=this;
	phrases.forEach(loadPhrase.bind(this));
	this.phase=1;
	return this;
}
var matchSlot=function(pl) {
	return plist.matchSlot(pl, this.db.meta.slotshift);
}
var matchPosting=function(pl) {
	return plist.matchPosting(pl,this.groupposting);
}
var groupBy=function(gu) {
	if (this.phase<1) this.load();
	if (this.phase>=2) return this;
	gu=gu||this.opts.groupunit||'';
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
	var that=this;
	phrases.forEach(function(P){
		var key=P.key;
		var docfreq=docfreqcache[key];
		if (!docfreq) docfreq=docfreqcache[key]={};
		if (!docfreq[that.groupunit]) {
			docfreq[that.groupunit]={doclist:null,freq:null};
		}		
		if (!P.posting) return;
		var res=matchfunc.apply(that,[P.posting]);;
		P.freq=res.freq;
		P.docs=res.docs;
		docfreq[that.groupunit]={doclist:P.docs,freq:P.freq};
	});
	this.phase=2;
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
	}
	return term;
}

var RANK={'vsm':rankvsm};
var run=function(opts) {
	if (this.phase<2) groupBy.apply(this);
	if (this.phase>=3) return this;
	for (var i in opts) this.opts[i]=opts[i];
	
	boolsearch.search.apply(this,[this.opts]);
	if (this.opts.rank ){
		var rankmodel=RANK[this.opts.rank];
		if (rankmodel) {
			rankmodel.rank.apply(this);
		}
	}
	this.phase=3;
	return this;
}
// sequance : load.groupBy.trim.search.rank.highlight
var sortPhrases=function(query) {
	if (typeof query=='string') return query;
	if (!query.length) return query;
	for (var i in query) {
		var first=query[i][0];
		if (first!='-' && first!='+') query[i]=' '+query[i];
	}
	query=query.sort(function(a,b){return a==b?0:(a>b?1:-1)});
	return query.map(function(a){return a.trim()});
}
var getOperator=function(raw) {
	var op='';
	if (raw[0]=='+') op='include';
	if (raw[0]=='-') op='exclude';
	return op;
}
var QUERYSYNTAX={google:querysyntax_google};
var newQuery =function(query,opts) {
	if (!query) return;
	opts=opts||{};

	var phrases=query;
	if (typeof query=='string') {
		var querysyntax=QUERYSYNTAX[opts.querysyntax||'google'];
		phrases=querysyntax.parse(query);
	}
	
	var phrase_terms=[], terms=[],variants=[],termcount=0,operators=[];
	var pc=0;//phrase count
	for  (var i=0;i<phrases.length;i++) {
		var op=getOperator(phrases[pc]);
		operators.push(op);
		if (op) phrases[pc]=phrases[pc].substring(1);

		var j=0,tokens=this.customfunc.tokenize.apply(this,[phrases[pc]]);
		phrase_terms.push(newPhrase());
		while (j<tokens.length) {
			var raw=tokens[j];
			if (isWildcard(raw)) {
				if (phrase_terms[pc].termid.length==0)  { //skip leading wild card
					j++
					continue;
				}
				terms.push(parseWildcard.apply(this,[raw]));
			} else if (isOrTerm(raw)){
				var term=orTerms.apply(this,[tokens,j]);
				terms.push(term);
				j+=term.key.split(',').length-1;
			} else {
				terms.push(parseTerm.apply(this,[raw]));
			}
			phrase_terms[pc].termid.push(termcount++);
			j++;
		}
		phrase_terms[pc].key=phrases[pc];

		//remove ending wildcard
		var P=phrase_terms[pc];
		do {
			T=terms[P.termid[P.termid.length-1]];
			if (!T) break;
			if (T.wildcard) P.termid.pop(); else break;
		} while(T);
		
		if (P.termid.length==0) {
			phrase_terms.pop();
		} else pc++;
	}
	opts.op=operators;

	var Q={
		db:this,opts:opts,query:query,phrases:phrase_terms,terms:terms,groupunit:'',
		load:load,groupBy:groupBy,run:run,
		getPhraseWidth:highlight.getPhraseWidth,
		highlightDocs:highlight.highlightDocs,
		highlightRanked:highlight.highlightRanked,
		termFrequency:termFrequency,
		indexOfSorted:plist.indexOfSorted,phase:0,
	};
	Q.slotsize=Math.pow(2,this.meta.slotshift);
	Q.slotcount=this.meta.slotcount;
	var that=this;
	Q.tokenize=function() {return that.customfunc.tokenize.apply(that,arguments);}
	Q.getRange=function() {return that.getRange.apply(that,arguments)};
	//API.queryid='Q'+(Math.floor(Math.random()*10000000)).toString(16);

	return Q;
}
/* the main entrace */
var resetPhase=function(opts) {
	if (this.opts.rank!=opts.rank) this.phase=2;
	if (this.opts.groupunit!=opts.groupunit) this.phase=1;
	if (this.opts.query!=opts.query) this.phase=0;
}
var db_purgeObsoleteQuery=function() {
	var now=new Date();
	for (var i in this.querycache) {
		var diffms=now-this.querycache[i].lastAccess;
		var diffMins = Math.round(((diffms % 86400000) % 3600000) / 60000); // minutes
		if (diffMins>30) delete this.querycache[i];
	}
}
var search=function(opts) {	
	var Q=this.querycache[opts.query];
	if (!Q) Q=newQuery.apply(this,[opts.query,opts]);
	else resetPhase.apply(Q,[opts]);	
	if (!Q) return;
 	Q.run();
 	var output=opts.output, O={}; //output fields
 	if (typeof output==='string') output=[output];
	for (var i in output) O[output[i]]=true;
	var max=opts.max||20; 
 	var start=opts.start||0;

 	var res={
 		doccount:Q.docs.length,
 		query:opts.query,
 		db:this.filename,
 		opts:opts,
 	};
	if (O['score']) { //for ranked listing
		res.score=Q.score.slice(start,start+max);
		if (O['texts']) {
			Q.highlightRanked();
			res.texts=Q.texts;
		}
	}
	if (O['docs']) { //for natural listing
		res.docs=Q.docs.slice(start,start+max);
		if (O['texts']) {
			Q.highlightDocs();
			res.texts=Q.texts;
		}
	}


	if (O['hits']) {//for rendering a text page
		var startslot=opts.startslot||0;
		var endslot=opts.endslot||this.meta.slotcount;
		res.hits=highlight.hitInRange.apply(this,[startslot,endslot]);
	}

	Q.lastAccess=new Date(); 
 	this.querycache[opts.query]=Q;
	db_purgeObsoleteQuery.call(this);
 	return res;
}

module.exports={
	search:search,
	newQuery:newQuery,//remove this...
	sortPhrases:sortPhrases, //just for testing, should be able to remove
	getTermVariants:getTermVariants //this is needed by Pali terms
};