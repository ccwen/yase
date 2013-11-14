/*
  search rewrite


  loadToken    
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
            ?12  //skip 12 token
            *12  //within 12
            A?B  //skip 1 token
            A*B  // AB or A?B
            A**B // AB or A?B or A??B
            A2B // same as above
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

/*
http://jsfiddle.net/neoswf/aXzWw/
function intersect_safe(a, b)
{
  var ai = bi= 0;
  var result = [];

  while( ai < a.length && bi < b.length ){
     if      (a[ai] < b[bi] ){ ai++; }
     else if (a[ai] > b[bi] ){ bi++; }
     else
     {
       result.push(ai);
       ai++;
       bi++;
     }
  }

  return result;
}

*/   

var plist=require('./plist.js');
var boolsearch=require('./boolsearch.js');
var selector=require('./selector');


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
/* load similar token with same prefix or simplified (dediacritic )*/
var expandToken=function(token,opts) {

	opts=opts||{};
	opts.max=opts.max||100;
	var count=0;
	var out=[];
	var tree=this.customfunc.token2tree(token);
	var expanded=expandKeys.apply(this, [ tree,[],opts ]);
	var simplified=[],lengths=[];
	if (this.customfunc.simplifiedToken) {
		for (var i=0;i<expanded.length;i++) {
			simplified.push(this.customfunc.simplifiedToken(expanded[i]));
		}
	} else simplified=expanded;

	if (opts.getlengths) {
		for (var i=0;i<expanded.length;i++) {
			var postings=this.getPostingById(expanded[i]);
			if (postings) lengths.push(postings.length);
			else lengths.push(0)			
		}
	}
	
	return { expanded:expanded ,simplified:simplified, 
		lengths: lengths, 
		more: expanded.length>=opts.max};

}
/* get posting of group unit
  group unit may have 3 cases,
  1) pure tag <p>
  2) tag with attribute p[n] match <p n="1"> , <p n="2"> but not <p> or <p id="x">
  3) tag with a given value, e.g div[type=sutta]
*/
var loadGroupUnit=function(groupunit){
	var gu=selector.parseSelector(groupunit);
	var guposting=this.customfunc.getTagPosting.apply(this,[gu.tag]);
	if (gu.key) { //no value only attribute
		var newguposting=[];
		var attrs=this.customfunc.getTagAttrs.apply(this,[gu.tag,gu.key]);	
		for (var i in attrs) {
			newguposting.push(guposting[i]);
		}
		guposting=newguposting;
	} else if (gu.value) {
		var newguposting=[];
		var par=['tags',gu.tag,gu.attribute+'='].concat(gu.value.split('.'));
		var ntag=this.get(par,true);
		if (typeof ntag=='number') {
			newguposting.push(guposting[ntag]);
		} else {
			for (var i=0;i<ntag.length;i++)	{
				newguposting.push(guposting[ntag[i]]);
			}
		}
		guposting=newguposting;
	}
	return guposting;
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
var loadToken=function(token,opts) {
	opts=opts||{};
	var PREFIX='%', VERBATIM='^'
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
		return {posting:this.getPostingById(token),op:op};
	}


	opts.exact=true;
	if (lastchar==PREFIX) opts.exact=false; //automatic prefix
	
	var t=this.customfunc.normalizeToken?
		this.customfunc.normalizeToken.apply(this,[token]):token;
	
	var expandtokens=expandToken.apply(this,[ t , opts]);
	var posting=null;//try load from cache
	if (!posting) {
		if (expandtokens){
			tokens=expandtokens.expanded;
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
		//put into cache		
	}

	var r={posting:posting,op:op};
	if (opts.expanded) {
		for(var i in expandtokens)r[i]=expandtokens[i];
	};
	if (opts.groupunit) {
		r.guposting=loadGroupUnit.apply(this,[opts.groupunit]);
		r.grouped=plist.groupbyposting(posting,r.guposting);
		//put into cache
	} else if (opts.groupbyslot) {
		r.grouped=plist.groupbyslot(posting, this.meta.slotshift);
	}
	return r;
}


module.exports={
	loadToken:loadToken,
	expandToken:expandToken,
	loadGroupUnit:loadGroupUnit
};