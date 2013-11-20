/*Rank by Vector Space Model*/

var plist=require('./plist');
var tf=function(nterm,ndoc) {
	if (ndoc==-1) return 1;
	var T=this.terms[nterm];
	var k=plist.sortedIndex(T.docs,ndoc);
	if (k>-1 && T.docs[k]==ndoc) {
		return Math.log(T.freq[k]+1);
	} else return 0;
	
}
var idf2=function() {
	for (var i=0;i<this.terms.length;i++) { //所有的關鍵字
		var T=this.terms[i];
		var idf = Math.log( this.docs.length / T.docs.length );
		T.idf2=idf*idf;
	}	
}

var norm=function(d) {
	var res = 0;
	for (var i=0;i<this.terms.length;i++) {
		var T=this.terms[i];
		var termfreq=tf.apply(this,[i,d]);
		res += termfreq* termfreq * T.idf2;
	}
	return Math.sqrt(res);
}
var innerproduct = function (d1, d2) {
	var res = 0;
	for (var i=0;i<this.terms.length;i++) {
		var T=this.terms[i];
		var tf_d1=tf.apply(this,[i,d1]);
		var tf_d2=tf.apply(this,[i,d2]);
		res += tf_d1*tf_d2*T.idf2;
	}
	return res;
}

var cosinesim = function (d1, d2) {
	var ip = innerproduct.apply(this,[d1, d2]);
	var norm1 = norm.apply(this,[d1]);
	var norm2 = norm.apply(this,[d2]);
	return ip / (norm1 * norm2);
}

var vsm=function(){
	idf2.apply(this);
	this.score=[];
	for (var i=0;i<this.docs.length;i++) {
		doc=this.docs[i];
		var sim=cosinesim.apply(this, [doc, -1]);
		this.score.push(sim);
	}
}


module.exports={rank:vsm};