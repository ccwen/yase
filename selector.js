var parseSelector=function(sel) {  // tag[attr=value]
	  var m=sel.match(/(.*?)\[(.*?)=(.*)/);
	  if (!m) {
	  	var m=sel.match(/(.*?)\[(.*)/);
	  	if (!m) {
	  		return {tag:sel};
	  	}
		var tagname=m[1], key=m[2];
		if (key[key.length-1]===']') key=key.substring(0,key.length-1);
		return {tag:tagname,key:key};
	  } else {
		  var tagname=m[1], attributename=m[2],value=m[3];
		  if (value[value.length-1]===']') value=value.substring(0,value.length-1);
		  return {tag:tagname,attribute:attributename,value:value};
	  }
};

module.exports={parseSelector:parseSelector};