/*Rank by Vector Space Model http://en.wikipedia.org/wiki/Vector_space_model 
  TODO , remove common terms , T.docs.length > this.docs.length*0.5 
*/

var plist=require('./plist');
var termFrequency=function(nterm,ndoc) {
	if (ndoc==-1) return 1; //the query
	var T=this.terms[nterm];
	var i=plist.sortedIndex(T.docs,ndoc);
	if (T.docs[i]===ndoc) return Math.log(T.freq[i]+1);
	else return 0;
	
}
var calulateTermsIDFxIDF=function() {
	if (this.IDFready) return;
	for (var i=0;i<this.terms.length;i++) {
		var T=this.terms[i];
		var idf = Math.log( this.docs.length / T.docs.length );
		T.idf2=idf*idf;
	}
	this.IDFready=true;
}
var cosineSimilarity = function (d1, d2) {
	var innerproduct = 0, norm1=0,norm2=0;
	for (var i=0;i<this.terms.length;i++) {
		var T=this.terms[i];
		var tf_d1=termFrequency.apply(this,[i,d1]);
		var tf_d2=termFrequency.apply(this,[i,d2]);

		innerproduct += tf_d1*tf_d2*T.idf2;
		norm1 += tf_d1*tf_d1*T.idf2;
		norm2 += tf_d2*tf_d2*T.idf2;
	}
	return innerproduct / Math.sqrt(norm1 * norm2);
}

var vsm=function(){
	calulateTermsIDFxIDF.apply(this);
	this.score=[];
	for (var i=0;i<this.docs.length;i++) {
		var doc=this.docs[i];
		var sim=cosineSimilarity.apply(this, [doc, -1]);
		this.score.push(sim);
	}
}

module.exports={rank:vsm};