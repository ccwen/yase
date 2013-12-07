/*
	Highlight text with hits
	define <hl> in css
	first phrase is <hl n="0"> , second phrase is <hl n="1"> and so on.
*/
var getDocText=function(docid) {
	if (this.groupunit)	{
		var startslot=Math.floor((this.groupposting[docid-1]||0) / this.slotsize);
		var endslot=Math.floor(this.groupposting[docid]/ this.slotsize);
	} else {
		startslot=docid;
		endslot=(docid+1);
	}
	if (!endslot) endslot=this.slotcount;

	var r= this.getRange(startslot,endslot);
	var text=[];
	//dirty hack, should get endtag from posting
	var endtag='</'+this.groupunit+'>';
	var last=0;
	for (var i in r) {
		var t=r[i].text;
		text.push(t);
		if (t.indexOf(endtag)>-1) last=text.length-1;
	}
	if (last) {
		text=text.slice(0,last);
	}

	return {text:text, start:startslot, end:endslot};
}
var getPhraseWidths=function (phraseid,voffs) {
	var res=[];
	for (var i in voffs) {
		res.push(getPhraseWidth.apply(this,[phraseid,voffs[i]]));
	}
	return res;
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
		if (endpos-voff<width) width=endpos-voff+1;
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
		if (!P.posting) continue;
		var s=this.indexOfSorted(P.posting,startvoff);
		var e=this.indexOfSorted(P.posting,endvoff);
		var r=P.posting.slice(s,e);
		var width=getPhraseWidths.apply(this,[i,r]);

		res=res.concat(r.map(function(voff,idx){ return [voff,i,width[idx]] }));
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
	var output='',O=[],j=0;;
	for (var t=0;t<opts.textarr.length;t++) {
		var slot=opts.startslot+t;
		var voff=slot*this.slotsize;
		if (j<hits.length && hits[j][0]>voff+this.slotsize) { //this slot has no hits
			if (opts.abridged ) {
				output+=opts.abridged.replace(/\$slot/g,slot); // ...
			}
			else output+=opts.textarr[t]; //output as it is
			O.push(output);
			output='';
			continue;
		}

		var tokens=this.tokenize(opts.textarr[t]);
		var i=0;
		while (i<tokens.length && tokens[i][0]=='<') output+=tokens[i++];
		while (i<tokens.length) {
			if (j<hits.length && voff==hits[j][0]) {
				var nphrase=hits[j][1] % 10, width=hits[j][2];
				var tag=hits[j][3] || tag;
				if (width) {
					while (tokens[i][0]=='<') {
						output+=tokens[i];
						i++;
					}
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
		O.push(output);
		output="";
	}
	if (opts.join) return O.join("");
	else return O;
}
var highlight=function(opts) {
	opts=opts||{};

	if (this.phase<4) this.slice.apply(this,[opts]);
	if (this.phase>=5) return this;
	this.texts={};
	var matched=this.matched;
	var renderDoc=function(D) {
		var docid=D[1];
		var res=getDocText.apply(this,[docid]);
		if (!this.texts[docid]) {
			var opt={textarr:res.text,
				startslot:res.start,endslot:res.end,
				hits:null,tag:'hl',abridged:this.opts.abridged,join:true
			};
			opt.hits=hitInRange.apply(this,[res.start,res.end]);
			this.texts[docid]=injectTag.apply(this,[opt]);
		}		
	}
	matched.forEach(renderDoc.bind(this));
	this.phase=5;
	return this;
}

module.exports={
	highlight:highlight,
	injectTag:injectTag,
	hitInRange:hitInRange,
	getPhraseWidth:getPhraseWidth
};