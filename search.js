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
	var out=[];
	var tree=this.customfunc.token2tree.apply(this,[term]);
	var expanded=this.customfunc.expandToken.apply(this, [ tree,[],opts ]);

	var createTermObject=function() {
		var res={text:'',};
		if (this.customfunc.simplifiedToken) res.simplified='';
		if (opts.hit) res.hit=0;
		return res;
	}
	for (var i in expanded) {
		var o=createTermObject.call(this);
		o.simplified=this.customfunc.simplifiedToken(expanded[i]);
		o.text=expanded[i];
		if (opts.hit) {
			var postings=this.getPosting(expanded[i]);
			if (postings) o.hit=postings.length;
			else o.hit=0;			
		}
		out.push(o);
	}
	return { variants:out,	more: expanded.length>=opts.max};
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
	var res={raw:raw,variants:[],term:'',op:''};
	var term=raw, op=0;
	var firstchar=term[0];
	if (firstchar=='-') {
		term=term.substring(1);
		res.exclude=true; //exclude
	}

	term=this.customfunc.normalizeToken.apply(this,[term]);
	var lastchar=term[term.length-1];
	
	if (lastchar=='%') {
		res.variants=getTermVariants.apply(this,[term.substring(0,term.length-1)]).variants;
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
		if (db.customfunc.expandToken && T.op!='exact'  && T.op!='wildcard') {
			var tree=db.customfunc.token2tree.apply(db,[key]);
			var expanded=db.customfunc.expandToken.apply(db, [ tree,[],{exact:true} ]);
			for (var i in expanded) T.variants.push({text:expanded[i]});
		}
		if (!T.posting && T.op!='wildcard') {
			if (T.variants && T.variants.length) { //term expands to multiple tokens
				var postings=[];
				T.variants.forEach(function(TK){
					var posting=db.getPosting(TK.text);
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
	gu=gu||this.opts.groupunit||'';

	if (this.phase<1) this.load();
	if (this.phase>=2) return this;

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
var orterm=function(term,key) {
		var t={text:key};
		if (this.customfunc.simplifiedToken) {
			t.simplified=this.customfunc.simplifiedToken(key);
		}
		term.variants.push(t);
}
var orTerms=function(tokens,now) {
	var raw=tokens[now];
	var term=parseTerm.apply(this,[raw]);
  orterm.apply(this,[term,term.key]);
	while (isOrTerm(raw))  {
		raw=tokens[++now];
		var term2=parseTerm.apply(this,[raw]);
		orterm.apply(this,[term,term2.key]);
		for (var i in term2.variants){
			term.variants[i]=term2.variants[i];
		}
		term.key+=','+term2.key;
	}
	return term;
}

var RANK={'vsm':rankvsm};
var run=function(opts) {
	if (!opts) opts=this.opts;
	if (this.phase<2) groupBy.apply(this);
	if (this.phase>=3) return this;
	
	boolsearch.search.apply(this,[opts]);
	if (opts.rank ){
		var rankmodel=RANK[opts.rank];
		if (rankmodel) {
			rankmodel.rank.apply(this);
		}
	}
	this.phase=3;
	return this;
}
var slice=function(opts) {
	if (!opts) opts=this.opts;
	if (this.phase<3) run.apply(this,[opts]);
	if (this.phase>=4) return this;

	var max=opts.max||this.opts.max||20; 
 	var start=opts.start||this.opts.start||0;
 	var mode=opts.rank||this.opts.rank;
 	if (mode=='vsm') {
 		this.matched=this.score.slice(start,start+max);
 	} else {
 		this.matched=this.docs.slice(start,start+max).map(function(a){return [1,a]});;
 	}
 	this.phase=4;
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
var doc2slot=function(docid) {
	var slot=0;
	if (this.groupunit)	{
		slot=Math.floor((this.groupposting[docid-1]||0) / this.slotsize);
	} else {
		startslot=docid;
	}
	return slot;
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
	var pc=0,termid=0;//phrase count
	for  (var i=0;i<phrases.length;i++) {
		var op=getOperator(phrases[pc]);
		if (op) phrases[pc]=phrases[pc].substring(1);

		/* auto add + for natural order ?*/
		//if (!opts.rank && op!='exclude' &&i) op='include';
		operators.push(op);
		
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
				termid=termcount++;
			} else if (isOrTerm(raw)){
				var term=orTerms.apply(this,[tokens,j]);
				terms.push(term);
				j+=term.key.split(',').length-1;
				termid=termcount++;
			} else {
				var term=parseTerm.apply(this,[raw]);
				termid=terms.map(function(a){return a.key}).indexOf(term.key);
				if (termid==-1) {
					terms.push(term);
					termid=termcount++;
				};
			}
			phrase_terms[pc].termid.push(termid);
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
		highlight:highlight.highlight,
		termFrequency:termFrequency,
		slice:slice,
		doc2slot:doc2slot,
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
	if (this.opts.start!=opts.start || this.opts.max!=opts.max ) this.phase=3;
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
	var R={query:opts.query,opts:opts,db:this.filename,result:[]};
	var Q=this.querycache[opts.query];
	if (!Q) Q=newQuery.apply(this,[opts.query,opts]);
	else resetPhase.apply(Q,[opts]);
	if (!Q || Q.phase==5) return R;

	var defaultgroupunit=this.meta.groupunit||"";
	if (defaultgroupunit instanceof Array) {
		defaultgroupunit=defaultgroupunit[0];
	}
	opts.groupunit=defaultgroupunit;

	for (var i in opts) Q.opts[i]=opts[i]; //use new options

 	Q.slice(opts);
 	var output=opts.output, O={}; //output fields
 	if (typeof output==='string') output=[output];
	for (var i in output) O[output[i]]=true;


 	R.doccount=Q.docs.length;
 	if (Q.score && Q.opts.rank) R.scorecount=Q.score.length;

 	if (O["text"]) Q.highlight();

 	for (var i=0;i<Q.matched.length;i++) {
 		var r={id:Q.matched[i][1],score:Q.matched[i][0]};
 		if (O["text"]) r.text=Q.texts[i];
		if (O['sourceinfo']) {
			var slot=Q.doc2slot(Q.matched[j][1]);
			var lastslot=Q.doc2slot(Q.matched[j][1]+1);
			var si=this.sourceInfo(slot);
			r.slot=slot;
			r.lastslot=lastslot;
		}
	}	

	if (O["hits"]) {
		var startslot=opts.startslot||0;
		var endslot=opts.endslot||this.meta.slotcount;
		R.hits=highlight.hitInRange.apply(this,[startslot,endslot]); 			
	}

 	
	Q.lastAccess=new Date(); 
 	this.querycache[opts.query]=Q;
	db_purgeObsoleteQuery.call(this);
 	return R;
}

module.exports={
	search:search,

	newQuery:newQuery,//remove this...
	sortPhrases:sortPhrases, //just for testing, should be able to remove
	getTermVariants:getTermVariants //this is needed by Pali terms
};