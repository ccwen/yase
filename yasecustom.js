/*
  these functions will be part of ydb
*/
var version=function() { return 0x20130808};

var isBreaker=function(ch) {
	var c=ch.charCodeAt(0);
	return  ( c==0xf0d || c==0x3002 ||  c==0xff1b || ch=='.' || ch=='|') ;
}
var isSpaceChar=function(c) {
	return ((c.charCodeAt(0)>=0x2000 && c.charCodeAt(0)<=0x206f) 
		|| c<=' '|| c=='?'
		|| c=='|' || c=='~' || c=='`' || c==';' || c=='.' || c==','
		|| c=='>' || c==':' || c=='}'
		|| c=='=' || c=='@' || c==']'
		|| c=="་" || c=="།");
}
var isCJK =function(c) {return ((c>=0x3000 && c<=0x9FFF) 
	|| (c>=0xD800 && c<0xDFFF) || (c>=0x2FF0 && c<0x2FFF) || (c>=0xFF00) ) ;}

var getText=function(db,seq,opts) {
	if (!opts) opts={};
	var slotperbatch=db.get(['meta','slotperbatch']);
	if (typeof seq=='number') {
		var batch=Math.floor(seq / slotperbatch);
		return db.get(['texts',batch, seq % slotperbatch]);
	} else {
		var r=[];
		for (var i in seq) {
			var batch=Math.floor(seq[i] / slotperbatch);
			var t=db.get(['texts',batch, seq[i] % slotperbatch]);
			r.push(t);
		}
		return r;
	}
}	
var getTag=function(db,tagname,seq) {
	var vpos= db.get(['tags',tagname,'_vpos',seq]);
	var slot= vpos >>db.meta.blockshift;
	var offset= vpos% db.meta.blocksize;
	var head= db.get(['tags',tagname,'_head',seq]);
	
	var r={};
	if (typeof vpos!=='undefined') r.vpos=vpos;
	if (typeof slot!=='undefined') r.slot=slot;
	if (typeof offset!=='undefined') r.offset=offset;
	if (typeof head!=='undefined') r.head=head;
	r.name=tagname;
	return r;
}
var getTagPosting=function(db,tagname) {
	//var slot= db.get(['tags',tagname,'_slot'],true);
	//var offset= db.get(['tags',tagname,'_offset'],true);
	var vpos= db.get(['tags',tagname,'_vpos'],true);
	/*
	var out=[];
	var shift=2 << (db.meta.blockshift - 1);
	for (var i=0;i<slot.length;i++) {
		out.push(shift*slot[i] + offset[i]);
	}
	*/
	return vpos;
}
var getTagAttr=function(db,tagname,ntag,attributename) {
	var par=['tags',tagname,attributename,ntag];
	return db.get(par) ;
}
var findTag=function(db,tagname,attributename,value) {
	var par=['tags',tagname,attributename+'='].concat(value.split('.'));
	var tag={};
	tag.ntag=db.get(par,true);
	if (typeof tag.ntag=='undefined') return {};//not found;
	if (typeof tag.ntag=='number') {
		tag.vpos= db.get(['tags',tagname,'_vpos',tag.ntag]);
		tag.slot= tag.vpos >> db.meta.blockshift;
		tag.offset= tag.vpos % db.meta.blocksize;

		tag.head= db.get(['tags',tagname,'_head',tag.ntag]);
		tag.text=db.getText(tag.slot);
		return tag;
	}

	var out=[],tags=JSON.parse(JSON.stringify(tag.ntag));

	for (var i in tags){
		var tag={};
		tag.ntag=tags[i];

		tag.vpos= db.get(['tags',tagname,'_vpos',tag.ntag]);
		tag.slot= tag.vpos >> db.meta.blockshift;
		tag.offset= tag.vpos % db.meta.blocksize;
		//tag.slot= db.get(['tags',tagname,'_slot',tag.ntag]);
		//tag.offset= db.get(['tags',tagname,'_offset',tag.ntag]);
		tag.head= db.get(['tags',tagname,'_head',tag.ntag]);
		tag.text=db.getText(tag.slot);
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
				if (tk[i+1]=='ṅ' || tk[i+1]=='ṃ') { //not a stand alone consonant
					i++;
					key+=tk[i];
				}
				res.push(key);
				key="";
				if (res.length>=3) {
					res.push( tk.substring(i+1));
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
	if ((c>=0x61 && c<=0x7a) || c==0xF1 ||
	  (c>=0x100 && c<=0x24f  ) || (c>=0x1E00 && c<=0x1EFF)) {
		var T=token2tree_western(tk);
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
		var T=token2tree(i);
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
	if (!isSpaceChar) isSpaceChar=this.customfunc.isSpaceChar;
	if (!isCJK) isCJK=this.customfunc.isCJK;
	var start,i=0;
	while (i<tk.length &&isSpaceChar(tk[i]) ) i++;
	start=i;
	if (tk[i]=='&' || tk[i]=='<' ||
		isCJK(tk.charCodeAt(i))) return tk.substring(start).trim();
	while (i<tk.length && !isSpaceChar(tk[i]))i++;
	end=i;
	return tk.substr(start,end);
}
module.exports={
	getText:getText,
	getTag:getTag,
	findTag:findTag,
	getTagAttr:getTagAttr,
	isBreaker:isBreaker,
	splitter:require('./splitter'),
	tokenize:require('./tokenize'),
	postings2tree:postings2tree,
	token2tree:token2tree,
	getTagPosting:getTagPosting,
	isSpaceChar:isSpaceChar,
	isCJK:isCJK,
	normalizeToken:normalizeToken,

	//getCrlf:getCrlf,
	//getCrlfByRange:getCrlfByRange,
	//findCrlf:findCrlf
}