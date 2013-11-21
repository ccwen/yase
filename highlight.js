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
/* return [voff, phraseid, phrasewidth] by slot range*/
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
	res.sort(function(a,b){return a[0]-b[0]});

	return res;
}

var renderHit=function(textarr,startslot,endslot) {
	var output='',hits=hitInRange.apply(this,[startslot,endslot]);

	for (var t=0;t<textarr.length;t++) {
		var tokens=this.tokenize(textarr[t]);
		var voff=(startslot+t)*this.slotsize;
		var i=0,j=0;
		while (i<tokens.length && tokens[i][0]=='<') output+=tokens[i++];
		while (i<tokens.length) {
			if (j<hits.length && voff==hits[j][0]) {
				var nphrase=hits[j][1], width=hits[j][2];
				output+= '<hl n="'+nphrase+'">';
				while (width) {
					output+=tokens[i];
					if (i>=tokens.length) break;
					if (tokens[i][0]!='<') {voff++;width--;}
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
	}
	return output;
}
var highlightDocs=function() {
	if (!this.searched) search.apply(this);
	var startdoc=this.opts.startdoc || 0;
	var enddoc=this.opts.enddoc || -1;
	if (enddoc==-1) enddoc=this.docs.length;
	if (!this.texts) this.texts={};

	for (var i=startdoc;i<enddoc;i++) {
		var docid=this.docs[i];
		var res=getDocText.apply(this,[docid]);
		if (!this.texts[docid]) {
			this.texts[docid]=renderHit.apply(this,[res.text,res.start,res.end]);
		}
	}
	return this;
}
module.exports={highlight:highlightDocs,getPhraseWidth:getPhraseWidth};