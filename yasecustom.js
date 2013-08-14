/*
  these functions will be part of ydb
*/
var version=function() { return 0x20130808};

var isBreaker=function(ch) {
	var c=ch.charCodeAt(0);
	return  ( c==0xf0d || c==0x3002 ||  c==0xff1b || ch=='.' || ch==';'|| ch=='|') ;
}

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
	var slot= db.get(['tags',tagname,'_slot',seq]);
	var offset= db.get(['tags',tagname,'_offset',seq]);
	var head= db.get(['tags',tagname,'_head',seq]);
	var r={};
	if (typeof slot!=='undefined') r.slot=slot;
	if (typeof offset!=='undefined') r.offset=offset;
	if (typeof head!=='undefined') r.head=head;
	r.name=tagname;
	return r;
}
var getTagAttr=function(db,tagname,ntag,attributename) {
	var par=['tags',tagname,attributename,ntag];
	return db.get(par) ;
}
var findTag=function(db,tagname,attributename,value) {
	var par=['tags',tagname,attributename+'='].concat(value.split('.'));
	var tag={};
	tag.ntag=db.get(par);

	tag.slot= db.get(['tags',tagname,'slot',tag.ntag]);
	tag.offset= db.get(['tags',tagname,'offset',tag.ntag]);
	tag.head= db.get(['tags',tagname,'head',tag.ntag]);	

	return  tag;
}
module.exports={
	getText:getText,
	getTag:getTag,
	findTag:findTag,
	getTagAttr:getTagAttr,
	isBreaker:isBreaker,
	splitter:require('./splitter'),
	//getCrlf:getCrlf,
	//getCrlfByRange:getCrlfByRange,
	//findCrlf:findCrlf
}