/*
  these functions will be part of ydb
*/
var version=function() { return 0x20130808};

var isBreaker=function(ch) {
	var c=ch.charCodeAt(0);
	return  ( c==0xf0d ||c==0xf0e || c==0x3002 ||  c==0xff1b || ch=='.' || ch=='|') ;
}

var isSearchableChar=function(c) {
	var code=c.charCodeAt(0);
	return ((code>=0x30 && code<=0x39)||(code>=0x41 && code<=0x5a)
	 || (code>=0x61 && code<=0x7a) || 
	 (code>=0x30 && code<=0x39)||c=='%'); //% for prefix match

}
var isSpaceChar=function(c) {
	return ((c.charCodeAt(0)>=0x2000 && c.charCodeAt(0)<=0x206f) 
		|| c<=' ' 
		|| c=='|' || c=='~' || c=='`' || c==';' || c=='.' || c==','
		|| c=='>' || c==':' || c=='}'
		|| c=='=' || c=='@' || c==']' || c==')' || c=='!'
		|| c=="་" || c=="།" || c=="༎");
}
var isCJK =function(c) {return ((c>=0x3000 && c<=0x9FFF) 
	|| (c>=0xD800 && c<0xDFFF) || (c>=0x2FF0 && c<0x2FFF) || (c>=0xFF00) ) ;}

var getText=function(seq,opts) {
	if (!opts) opts={};
	var slotperbatch=this.get(['meta','slotperbatch']);
	if (typeof seq=='number') {
		var batch=Math.floor(seq / slotperbatch);
		return this.get(['texts',batch, seq % slotperbatch]);
	} else {
		var r=[];
		for (var i in seq) {
			var batch=Math.floor(seq[i] / slotperbatch);
			var t=this.get(['texts',batch, seq[i] % slotperbatch]);
			if (typeof t=='undefined') break;
			r.push(t);
		}
		return r;
	}
}	
var getTag=function(tagname,seq) {
	var vpos= this.get(['tags',tagname,'_vpos',seq]);
	var slot= vpos >>this.meta.slotshift;
	var offset= vpos% this.meta.slotsize;
	var head= this.get(['tags',tagname,'_head',seq]);
	
	var r={};
	if (typeof vpos!=='undefined') r.vpos=vpos;
	if (typeof slot!=='undefined') r.slot=slot;
	if (typeof offset!=='undefined') r.offset=offset;
	if (typeof head!=='undefined') r.head=head;
	r.name=tagname;
	return r;
}
var getTagPosting=function(tagname) {
	//var slot= db.get(['tags',tagname,'_slot'],true);
	//var offset= db.get(['tags',tagname,'_offset'],true);
	var vpos= this.get(['tags',tagname,'_vpos'],true);
	/*
	var out=[];
	var shift=2 << (db.meta.slotshift - 1);
	for (var i=0;i<slot.length;i++) {
		out.push(shift*slot[i] + offset[i]);
	}
	*/
	return vpos;
}
var getTagAttr=function(tagname,ntag,attributename) {
	var par=['tags',tagname,attributename,ntag];
	return this.get(par) ;
}
var getTagAttrs=function(tagname,attributename) {
	var par=['tags',tagname,attributename];
	return this.get(par,true) ;
}

var findTag=function(tagname,attributename,value) {
	var par=['tags',tagname,attributename+'='].concat(value.split('.'));
	var tag={};
	tag.ntag=this.get(par,true);
	if (typeof tag.ntag=='undefined') return {};//not found;
	if (typeof tag.ntag=='number') {
		tag.vpos= this.get(['tags',tagname,'_vpos',tag.ntag]);
		tag.slot= tag.vpos >> this.meta.slotshift;
		tag.offset= tag.vpos % this.meta.slotsize;

		tag.head= this.get(['tags',tagname,'_head',tag.ntag]);
		tag.text=this.getText(tag.slot);
		tag.tag=tagname;
		return tag;
	}

	var out=[],tags=JSON.parse(JSON.stringify(tag.ntag));

	for (var i in tags){
		var tag={};
		tag.ntag=tags[i];

		tag.vpos= this.get(['tags',tagname,'_vpos',tag.ntag]);
		tag.slot= tag.vpos >> this.meta.slotshift;
		tag.offset= tag.vpos % this.meta.slotsize;
		//tag.slot= db.get(['tags',tagname,'_slot',tag.ntag]);
		//tag.offset= db.get(['tags',tagname,'_offset',tag.ntag]);
		tag.head= this.get(['tags',tagname,'_head',tag.ntag]);
		tag.text=this.getText(tag.slot);
		tag.tag=tagname;

		out.push(tag)
	}
	return  out;
}
var token2tree=function(tk) {

	var token2tree_western=function(tk) {
	//for chinese. 
		var vowels=['a','ā','i','o','u','ī','ū','e'];
		var res=[];
		var key="";
		var i=0;
		while (i<tk.length) {
			key+=tk[i];
			if (vowels.indexOf(tk[i])>-1) {
				//if (tk[i+1]=='ṅ' || tk[i+1]=='ṃ') { //not a stand alone consonant
				//	i++;
				//	key+=tk[i];
				//}
				res.push(key);
				key="";
				if (res.length>=3) {
					var remain=tk.substring(i+1);
					if (!remain) remain=' '; //fix bug caused by "sentence"
					res.push( remain);
					break;
				}
			}
			i++;
		}
		if (key) res.push(key);
		
		while (res.length<4) res.push(' ');
		return res;
		
	}
	
	var c=tk.charCodeAt(0);
	if ((c>=0x41 && c<=0x7a) || c==0xF1 ||
	  (c>=0x100 && c<=0x24f  ) || (c>=0x1E00 && c<=0x1EFF)) {
	  	var T=this.customfunc.simplifiedToken?
			token2tree_western.apply(this,[this.customfunc.simplifiedToken.apply(this,[tk])]):tk;
	} else {
		var T=[];
		T.push( '$'+(c >> 8).toString(16) );
		T.push( tk );
		while (T.length<4) T.push(' ');
	}
	return T;
}
var postings2tree=function(o) {
	var res={};
	for (var i in o) {
		var T=token2tree.apply(this,[i]);
		var node=res;
		for (var j=0;j<T.length-1;j++) {
			if (!node[ T[j] ]) node[ T[j] ]={};
			node=node[ T[j] ];
		}
		node[ T[T.length-1] ]=o[i];
	}
	return res;
}
var normalizeToken=function(tk) {
	var isSpaceChar=this.customfunc.isSpaceChar;
	var isSearchableChar=this.customfunc.isSearchableChar;
	var isCJK=this.customfunc.isCJK;
	tk=this.customfunc.simplifiedToken(tk);
	var start,i=0;
	while (i<tk.length && isSpaceChar(tk[i]) ) i++;
	start=i;
	if (tk[i]=='&' || tk[i]=='<' ||
		isCJK(tk.charCodeAt(i))) return tk.substring(start).trim();
	while (i<tk.length && isSearchableChar(tk[i]))i++;
	end=i;
	return tk.substr(start,end);
}


var expandToken=function(fullpath,path,opts) {
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
		var alias=lead;

		if (path[path.length-1] && prefix!=" ") {
			lead=lead.substring(0, prefix.length);
		}

		var leadalias=lead=this.customfunc.normalizeToken.apply(this,[lead]);
		if (this.customfunc.searchNormalizeToken) {
			leadalias=this.customfunc.searchNormalizeToken.apply(this,[lead]);
			alias=this.customfunc.searchNormalizeToken.apply(this,[out1[i]]);
		}
		
		if (leadalias==prefix || lead==prefix || lead==" " || prefix==" ") {
			//console.log('hit',out1[i])
			var start=0;
			if (path[path.length-1] && prefix!=" ") start=prefix.length;

			//if (out1[i]==" ") out.push(path.join(""));
			if (path.length<fullpath.length-1 && out1[i]!=" ") {

				if (opts.exact && out1[i]!=fullpath[path.length] &&
						alias!=fullpath[path.length]) continue;
				
				path.push(out1[i]);
				out=out.concat(arguments.callee.apply(this,[fullpath,path,opts]));	
				path.pop();
			} else {
				if (opts.exact) {
					if (out1[i]==fullpath[path.length] || 
							alias==fullpath[path.length]) {
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
/* get posting from group unit
  group unit may have 3 cases,
  1) pure tag <p>
  2) tag with attribute p[n] match <p n="1"> , <p n="2"> but not <p> or <p id="x">
  3) tag with a given value, e.g div[type=sutta]
*/
var loadGroupPosting=function(groupunit){
	var gu=this.parseSelector(groupunit);
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
var simplifiedToken=function(token) {
	return token.toLowerCase();
}
module.exports={
	getText:getText,
	getTag:getTag,
	findTag:findTag,
	getTagAttr:getTagAttr,
	getTagAttrs:getTagAttrs,
	isBreaker:isBreaker,
	splitter:require('./splitter'),
	tokenize:require('./tokenize'),
	postings2tree:postings2tree,
	token2tree:token2tree,
	getTagPosting:getTagPosting,
	isSpaceChar:isSpaceChar,
	isSearchableChar:isSearchableChar,
	isCJK:isCJK,
	normalizeToken:normalizeToken,
	loadGroupPosting:loadGroupPosting,
	expandToken:expandToken,
	simplifiedToken:simplifiedToken,

	//getCrlf:getCrlf,
	//getCrlfByRange:getCrlfByRange,
	//findCrlf:findCrlf
}