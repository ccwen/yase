var diff=require('./diff');
var  getutf32 = function (opt) { // return ucs32 value from a utf 16 string, advance the string automatically
	opt.thechar='';
	if (!opt.widestring) return 0;
	var s = opt.widestring;
	var ic = s.charCodeAt(0);
	var c = 1; // default BMP one widechar
	if (ic >= 0xd800 && ic <= 0xdcff) {
	  var ic2 = s.charCodeAt(1);
	  ic = 0x10000 + ((ic & 0x3ff) * 1024) + (ic2 & 0x3ff);
	  c++; // surrogate pair
	}
	opt.thechar = s.substr(0, c);
	opt.widestring = s.substr(c, s.length - c);
	return ic;
};
var isCJK =function(c) {return ((c>=0x3400 && c<=0x9FFF) || (c>=0xD800 && c<0xDFFF) ) ;}

var bigramof=function(query) {
	var r=[];
	var opts={};
	var i=0;
	
	opts.widestring=query;
	getutf32(opts);
	var ch=opts.thechar;
	while (ch) {
		getutf32(opts);
		if (opts.thechar && isCJK(ch.charCodeAt(0)) && 
			isCJK(opts.thechar.charCodeAt(0))) {
			r.push(ch+opts.thechar);
		};
		ch=opts.thechar;
	}
	return r;
}
var excerpt=function(dm,t,s,l) {
	var splitter=dm.customfunc.splitter;
	var splitted=splitter(t);
	
	var startoff=0,endoff=0;
	var tokens=splitted.tokens;
	var skips=splitted.skips;
	var count=0;
	
	for (var i=0;i<tokens.length;i++) {
		if (!skips[i]) count++;
		if (count==s) startoff=splitted.offsets[i];
		if (count==s+l) endoff=splitted.offsets[i]+2;
	}
	return t.substring(startoff,endoff);
}
//given all hits in a block and q,
//first the position of best match
var findbestmatch = function(rowid,q,hits) {
	var start=0,length=0;
	var blockhit=[]; //combine all position into a single array
	for (var i=0;i<hits.length;i++) {
		var s=hits[i][rowid];
		if (s) blockhit=blockhit.concat(s);
	}
	blockhit.sort(function(a,b) {return a-b});
	
	//scan the array with a window ( q.length * 2 by default)
	var matches=[];
	var output=[];
	var winsize=q.length*2;
	//calculate hits in the window, push to an array
	for (var i=0;i<blockhit.length;i++) {
		var s=blockhit[i];
		var c=0;
		while (blockhit[i+c] - s <winsize) c++;
		if (c>1) output.push([i,c-1]);
	}
	//《禮．月令》：中呂，卽仲呂。 wh(中) return the first hit
	if (!output.length) return {start:blockhit[0],length:1};
	
	output.sort( function(a,b) { return b[1]-a[1]});

	//return the top entry
	var start=blockhit[output[0][0]];
	var end=blockhit [ output[0][0]+output[0][1] ];
	//var hitcount=output[0][1];
	return {start:start,length:end-start+1 };
}
var diffof=function(from,to) {
	var dmp=new diff();
	var d=dmp.diff_main( from,to);
	return dmp.diff_prettyHtml(d);	
}

var simplefuzzysearch=function(dm,query,opts) {
		opts=opts||{};
		opts.maxentries=opts.maxentries||10;
		opts.minscore=opts.minscore||0.6;
		
		if (!opts.unigram) {
			var phrases=bigramof(query);
		} else {
			var phrases=dm.customfunc.splitter(query).tokens;
		}
		
		var hits=[];
		for (var i=0;i<phrases.length;i++) {
			var keyword=phrases[i];
			if (opts.phrasecache) {
				var hit=opts.phrasecache[keyword]||dm.phrasesearch(keyword,{raw:true}) ;
				opts.phrasecache[keyword]=hit;
			} else {
				var hit=dm.phrasesearch(keyword,{raw:true});
			}			
			if (hit) hits.push(hit);
		}
		
		var possible={};
		/* todo : add unigram for uncommon char
		
		*/
		for (var i=0;i< hits.length;i++) {
			for (var j in hits[i]) {
				//var g=hits[i].grouped[j];
				if (!possible[j]) possible[j]=0 ;
				possible[j]++ ;
			}
		}
		//console.timeEnd('phase2');
		var minscore=opts.minscore * phrases.length;
		
		var sorted=[];
		
		for (var i in possible) {
			i=parseInt(i);
			//start length... scan for best match
			if (possible[i]>=minscore)
				sorted.push( [ possible[i]/phrases.length,i] );
		}
		//console.log(sorted.length);
		
		sorted.sort(function(a,b){return b[0]-a[0]});
		if (sorted.length>opts.maxentries) sorted.length=opts.maxentries;
		var out=[];
		for (var i=0;i< sorted.length;i++) {
			if (sorted[i][0]<opts.minscore) break;
			var bestmatch={start:0,length:0};
				if (opts.hightlight || opts.showtext) {
					bestmatch=findbestmatch(sorted[i][1],query,hits);
				}
				out.push({
					score:sorted[i][0].toFixed(2),
					seq:sorted[i][1],
					start:bestmatch.start,
					length:bestmatch.length,
				});
		}
		if (opts.showtext) {
			for (var j in out) {
				out[j].id=dm.seq2id(out[j].seq);
				out[j].excerpt=excerpt(dm,dm.getTextById(out[j].id),out[j].start,out[j].length) ;
				if (opts.diff) out[j].diff=diffof(query,out[j].excerpt);
			}
		}
		return out;
}

var api={ fuzzy:simplefuzzysearch, excerpt:excerpt};
module.exports=api;