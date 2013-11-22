/* take Google query format*/

/*
	
*/
var parse=function(input) {
	var match=input.match(/(".+?"|'.+?'|\S+)/g)
	match=match.map(function(str){
		var n=str.length, h=str.charAt(0), t=str.charAt(n-1)
		if (h===t&&(h==='"'|h==="'")) str=str.substr(1,n-2)
		return str
	})
	console.log(input,'==>',match)
	return match;
}
module.exports={parse:parse}