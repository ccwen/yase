/*Rank by Vector Space Model http://en.wikipedia.org/wiki/Vector_space_model 
  TODO , remove common terms , T.docs.length > this.docs.length*0.5 
*/

var calulateTermsIDFxIDF=function() {
	if (this.IDFready) return;
	for (var i=0;i<this.phrases.length;i++) {
		var T=this.phrases[i];
		var idf = Math.log( this.docs.length / T.docs.length );
		if (!idf) idf=0.0001;
		T.idf2=idf*idf;
	}
	this.IDFready=true;
}
var cosineSimilarity = function (d1, d2) {
	var innerproduct = 0, norm1=0,norm2=0;
	for (var i=0;i<this.phrases.length;i++) {
		var T=this.phrases[i];
		var tf_d1=this.termFrequency(i,d1);
		var tf_d2=this.termFrequency(i,d2);

		innerproduct += tf_d1*tf_d2*T.idf2;
		norm1 += tf_d1*tf_d1*T.idf2;
		norm2 += tf_d2*tf_d2*T.idf2;
	}
	return innerproduct / Math.sqrt(norm1 * norm2);
}
var cosineSimilarityQuery = function (d) {
	var innerproduct = 0, norm1=0,norm2=0;
	this.phrases.forEach(function(a) {norm2+=a.idf2});
	for (var i=0;i<this.phrases.length;i++) {
		var T=this.phrases[i];
		var tf=this.termFrequency(i,d);
		innerproduct += tf*T.idf2;
		norm1 += tf*tf*T.idf2;
	}
	return innerproduct / Math.sqrt(norm1 * norm2);
}

var vsm=function(){
	var minscore=this.opts.minscore||0.5;
	calulateTermsIDFxIDF.apply(this);
	this.score=[];
	for (var i=0;i<this.docs.length;i++) {
		var doc=this.docs[i];
		var sim=cosineSimilarityQuery.apply(this, [doc]);
		if (sim>minscore)
		this.score.push([sim,doc]);
	}
	this.score.sort(function(a,b){return b[0]-a[0]});
}

module.exports={rank:vsm};