/*
	Highlight text with hits
	define <hl> in css
	first phrase is <hl n="0"> , second phrase is <hl n="1"> and so on.
*/
var getDocText=function(docid) {	
	var startslot=Math.floor((this.groupposting[docid-1]||0) / this.slotsize);
	var endslot=Math.floor(this.groupposting[docid]/ this.slotsize);
	if (!endslot) endslot=this.slotcount;

	var r= this.getRange(startslot,endslot);
	var text=[];
	//dirty hack, should get endtag from posting
	var endtag='</'+this.groupunit+'>';
	for (var i in r) {
		var t=r[i].text;
		text.push(t);
		if (t.indexOf(endtag)>-1) break;
	}
	return {text:text, start:startslot, end:endslot};
}

var getPhraseWidth=function (phraseid,voff) {
	var P=this.phrases[phraseid];
	var width=0,varwidth=false;
	if (P.termid.length<2) return P.termid.length;
	var lasttermposting=this.terms[P.termid[P.termid.length-1]].posting;

	for (var i in P.termid) {
		var T=this.terms[P.termid[i]];
		if (T.op=='wildcard') {
			width+=T.width;
			if (T.wildcard=='*') varwidth=true;
		} else {
			width++;
		}
	}
	if (varwidth) { //width might be smaller due to * wildcard
		var at=this.indexOfSorted(lasttermposting,voff);
		var endpos=lasttermposting[at];
		if (endpos-voff<width) width=endpos-voff;
	}

	return width;
}
/* return [voff, phraseid, phrasewidth, optional_tagname] by slot range*/
var hitInRange=function(startslot,endslot) {
	var startvoff=startslot*this.slotsize;
	var endvoff=endslot*this.slotsize;
	var res=[];
	for (var i=0;i<this.phrases.length;i++) {
		var P=this.phrases[i];
		var s=this.indexOfSorted(P.posting,startvoff);
		var e=this.indexOfSorted(P.posting,endvoff);
		var r=P.posting.slice(s,e);
		var width=getPhraseWidth.apply(this,[i,startvoff])

		res=res.concat(r.map(function(voff){ return [voff,i,width] }));
	}
	// order by voff, if voff is the same, larger width come first.
	// so the output will be
	// <tag1><tag2>one</tag2>two</tag1>
	//TODO, might cause overlap if same voff and same width
	//need to check tag name
	res.sort(function(a,b){return a[0]==b[0]? b[2]-a[2] :a[0]-b[0]});

	return res;
}
/* inject xml tags into texts */
var injectTag=function(opts){
	var hits=opts.hits;
	var tag=opts.tag||'hl';
	var output='';
	for (var t=0;t<opts.textarr.length;t++) {
		var voff=(opts.startslot+t)*this.slotsize;
		if (j<hits.length && hits[j][0]>voff+this.slotsize) { //this slot has no hits
			if (opts.abridged ) output+=opts.abridged; // ...
			else output+=opts.textarr[t]; //output as it is
			continue;
		}

		var tokens=this.tokenize(opts.textarr[t]);
		var i=0,j=0;
		while (i<tokens.length && tokens[i][0]=='<') output+=tokens[i++];
		while (i<tokens.length) {
			if (j<hits.length && voff==hits[j][0]) {
				var nphrase=hits[j][1], width=hits[j][2];
				var tag=hits[j][3] || tag;
				if (width) {
					output+= '<'+tag+' n="'+nphrase+'">';
					while (width) {
						output+=tokens[i];
						if (i>=tokens.length) break;
						if (tokens[i][0]!='<') {voff++;width--;}
						i++;
					}
					output+='</'+tag+'>';
				} else {
					output+= '<'+tag+' n="'+nphrase+'"/>';
				}
				j++;
			} else {
				output+=tokens[i];
				if (tokens[i][0]!='<') voff++;
				i++;
			}
		}
		while (i<tokens.length) output+= tokens[i++];
	}
	return output;
}
var highlight=function(opts,type) {
	opts=opts||{};
	if (this.phase<3) run.apply(this);
	if (this.phase>=4) return this;
	var startdoc=opts.start||this.opts.startdoc || 0;
	var enddoc=startdoc+ (opts.max||this.opts.max||20);
	if (enddoc>this.docs.length) enddoc=this.docs.length;
	this.texts={};
	var renderDoc=function(docid) {
		var res=getDocText.apply(this,[docid]);
		if (!this.texts[docid]) {
			var opt={textarr:res.text,
				startslot:res.start,endslot:res.end,
				hits:null,tag:'hl',abridged:this.opts.abridged
			};
			opt.hits=hitInRange.apply(this,[res.start,res.end]);
			this.texts[docid]=injectTag.apply(this,[opt]);
		}		
	}
	if (type=='docs') {
		for (var i=startdoc;i<enddoc;i++) renderDoc.apply(this,[this.docs[i]]);
	} else if (type=='ranked') {
		for (var i=startdoc;i<enddoc;i++) renderDoc.apply(this,[this.score[i][1]]);
	}
	this.phrase=4;
	return this;
}
var highlightDocs=function(opts) {
	return highlight.apply(this,[opts,'docs']);
}
var highlightRanked=function(opts) {
	return highlight.apply(this,[opts,'ranked']);
}
module.exports={
	highlightDocs:highlightDocs,
	highlightRanked:highlightRanked,
	injectTag:injectTag,
	getPhraseWidth:getPhraseWidth
};