var taghandlers = {
	pb: function(taginfo,offset) {
		if (taginfo.closetag && !taginfo.opentag) return;
		var k=taginfo.tagname;
		var ed=taginfo.tag.match(/ ed="(.*?)"/);
		if (ed) {	
			ed=ed[1]; 
			taginfo.append="."+ed; //with edition
		}
		//if (typeof taginfo.remove =='undefined') taginfo.remove=true;
	}
}

module.exports=taghandlers;