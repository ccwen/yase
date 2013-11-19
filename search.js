/*
  search rewrite


  loadTerm   
     input  : token with suffix operator
        rasa^  //for pali ,exact
        rasa%  //auto expansion (up to 100 words with same prefix)

     output : 
        list of variants 
        raw posting (OR all variants postings)

     each token assign a color.

  groupToken    
     input  : raw posting, group unit (slot, p tag, document , etc)
     output : 
        [ [ngroup , postings from group starting voff] ] //array is much faster
	    
  Phrase Search  ( group by slot )
    input : list of token (wild card, fix length , variable length)
            token delimeter can be space, Tibetan Tsek
            wild card served as token delimeter
            12?  //skip 12 token
            12*  //within 12
            A?B  //skip 1 token
            A*B  // AB or A?B
            A**B // AB or A?B or A??B
            A*2B // same as above
            A*  // same as A
            *A  // same as A
            
	find token in same group. (array intersect)

 	pland //only apply pland on possible group ==>save to cache

 	output: 
 	  {grouped: { ngroup:[array of postings] } , 
 	   tokenlengths: number | {ngroup:[array of phraselength]} }

    grouped postings are keeped when need to check which nphrase at highlight stage
    if phrase consist variable length wildcard, phraselength is an object of arrays.
    otherwise phraselength is a number.

  Boolean Search 
    input: 
       grouped postings of phrase search
       Granularity: slot, sub-paragraph(p) , paragraph (p[n]), readunit

    output: grouped postings of phrases
 	  {grouped: { ngroup:[array of postings] } , 
 	   tokenlengths: [array of phraselength] | {ngroup:[array of phraselength]} 
 	   nphrase: {ngroup:[array of phrase seq]}  }

  Fuzzy Search (sentence similarity match)
    input:
      array of phrase ( no operator)
      Granularity: slot, sub-paragraph(p) , paragraph (p[n]), readunit
    output: ranked by relevancy
    plugin for calculate of similarity
    
    Document length : groupsize in number of token can be retrieved by grouped posting
          groupsize n = g[n+1]-g[n]



  trim (starting and ending voff), for highlight page

  seqcount // must know the total count first
           //for incremental result listing

  highlight //normally trimmed
    input: grouped nphrase , grouped tokenlength, nphrase

*/

 

var plist=require('./plist.js');
var boolsearch=require('./boolsearch.js');
var taghandlers=require('./taghandlers.js');
var STRATEGY={"boolean":boolsearch};

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

/*
  load posting of token and it's variants 
  token may ends with operator 
  ^  verbatim no expansion, 
  %  tokens with same prefix
  !  not operation  //must be last one
  ^! exclue verbatim token
  %! exclude all tokens with same prefix
*/
var loadTerm=function(token,opts) {
	opts=opts||{};
	var PREFIX='%', VERBATIM='^';
	var op='and';
	token=token.trim();
	if (token.trim()[0]=='<') return false;

	if (lastchar=='!') {
		op='andnot';
		token=token.substring(0,token.length-1);
		lastchar=token[token.length-1];
	}

	var lastchar=token[token.length-1];
	if (lastchar==VERBATIM || lastchar==PREFIX) {
		token=token.substring(0,token.length-1);
	}
	if (lastchar==VERBATIM) { //do not expand if ends with ^
		return {posting:this.getPosting(token),op:op};
	}


	opts.exact=true;
	if (lastchar==PREFIX) opts.exact=false; //automatic prefix
	
	var t=this.customfunc.normalizeToken?
		this.customfunc.normalizeToken.apply(this,[token]):token;
	
	var variants=getTermVariants.apply(this,[ t , opts]);
	var posting=null;//try load from cache
	if (!posting) {
		if (variants){
			tokens=variants.expanded;
			if (tokens.length==1) {
				posting=this.getPosting(tokens[0]);	
			} else {
				var postings=[];
				for (var i in tokens) {
					postings.push(this.getPosting(tokens[i]));
				}
				posting=plist.combine(postings);
			}
		} else {
			posting=this.getPosting(t);	
		}
		//put into cache		
	}

	var r={posting:posting,op:op};
	if (opts.expanded) {
		for(var i in variants)r[i]=variants[i];
	};
	if (opts.groupunit) {
		r.guposting=this.customfunc.loadGroupPosting.apply(this,[opts.groupunit]);
		r.grouped=plist.groupbyposting(posting,r.guposting);
		//put into cache
	} else if (opts.groupbyslot) {
		r.grouped=plist.groupbyslot(posting, this.meta.slotshift);
	}
	return r;
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
	gu=gu||'';
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
		this.groupunit=gu;
	}
	
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
var search=function(opts) {
	opts=opts||{};
	var type=opts.strategy||this.strategy||"boolean";
	var strategy=STRATEGY[type];
	return strategy.search.apply(this,[opts]);
}

var newQuery =function(query,opts) {

	var phrases=taghandlers.splitSlot.apply(this,[query]);
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
	return {
		db:this,query:query,phrases:phrase_terms,terms:terms,
		groupunit:'',
		load:load,groupBy:groupBy,
		search:search,
	};
}
module.exports={
	newQuery:newQuery,
	getTermVariants:getTermVariants
};