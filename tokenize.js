/*
  2013/8/30
  space characters will follow each token
  only the first token might have leading space.
*/
module.exports=function(s) {
	var isCJK=this.customfunc.isCJK;
	var isSpaceChar=this.customfunc.isSpaceChar;
	var res=[];
	var i=0, last=0; 
	addtoken=function(now) {
		if (now>last) {
			var tk=s.substring(last,now);
			res.push(tk);
			last=now;
		}
	}
	parseIDS=function(now) {
		var count=0;
		while (count!=1 && now<s.length) {
			c=s.charCodeAt(now);
			if ( c>=0x2ff0 && c<=0x2fff) {
				count--;
			} else {
				count++;
				if (c>=0xD800 && c<0xDFFF) now++; //extension B,C,D
			}
			now++;
		}
		while ( now<s.length && isSpaceChar(s.charAt(now)) ) now++;
		addtoken(now);
		return now;
	}
	while ( i<s.length && isSpaceChar(s.charAt(i)) ) i++;
	while (i<s.length) {
		var c=s.charAt(i);
		var code=s.charCodeAt(i);
		//console.log(i, c)
		if (isCJK(code)) {
			addtoken(i);
			if (code>=0x2ff0 && code<=0x2fff) {
				i=parseIDS(i);
			} else {
				if (code>=0xD800 && code<0xDFFF) i++; //extension B,C,D
				i++;
				while ( i<s.length && isSpaceChar(s.charAt(i)) ) i++;
				addtoken(i);
			}
		} else {
			if (c=='&' || c=='<') {
				var endchar='>';
				if (c=='&') endchar=';'
				while (i<s.length && s.charAt(i)!=endchar) {
					i++;
				}
				i++;
				while ( i<s.length && isSpaceChar(s.charAt(i)) ) i++;
				addtoken(i);
			} else {
				while ( i<s.length && !isSpaceChar(s.charAt(i))&&s.charAt(i)!='<'
				&&s.charAt(i)!='&' &&!isCJK(s.charCodeAt(i))) {
					i++;
				}
				if (isCJK(s.charCodeAt(i))) continue;
				while ( i<s.length && isSpaceChar(s.charAt(i)) ) i++;

				addtoken(i);
			}			
		}
	}
	addtoken();
	return res;
}
