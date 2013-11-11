var plist=require('./plist.js');

var nearby=function(op1,op2,opts) {

}
var notnearby=function(op1,op2,opts) {
	
}
/* must have op2 after op1 */
/*TODO same token infinite loop*/
var followby=function(op1,op2,opts) {
	var res=[], ntoken=[];
	var i=0,j=0;
	var pl1=op1[0], pl2=op2[0];
	var g2=Math.floor(pl2[0] / opts.groupsize);
	while (i<pl1.length) {
		while (j<pl2.length && pl2[j]<pl1[i]) {
			j++;
			g2=Math.floor(pl2[j] / opts.groupsize);
		}

		var g1=Math.floor(pl1[i] / opts.groupsize);
		var d=g2-g1;
		if (d>=0 && d<=opts.distance) {
			var d2=d;
			while (d2>=0 && d2<=opts.distance) {
				res.push( pl1[i] )
				ntoken.push( op1[1][i]);
				i++;
				d2=g2-Math.floor(pl1[i] / opts.groupsize);
			}
			while (d>=0 && d<=opts.distance) {
				res.push( pl2[j] );
				ntoken.push( op2[1][j]);
				j++;
				d=Math.floor(pl2[j] / opts.groupsize)-g1;
			}
		} else i++;
		if (j>=pl2.length) break;
		while(i<pl1.length && pl1[i]<pl2[j]) i++;
		if (i>=pl1.length) break;
	}
	return [res,ntoken];
}
/* op1 must not followed by op2 */
var notfollowby=function(op1,op2,opts) {
	var res=[], ntoken=[];
	var i=0,j=0;
	var pl1=op1[0], pl2=op2[0];
	var g2=Math.floor(pl2[0] / opts.groupsize);
	while (i<pl1.length) {
		while (j<pl2.length && pl2[j]<pl1[i]) {
			//res.push( pl2[j] )
			//ntoken.push( op2[1][j]);
			j++;
			g2=Math.floor(pl2[j] / opts.groupsize);
		}

		var g1=Math.floor(pl1[i] / opts.groupsize);
		var d=g2-g1;
		if (d>=0 && d<=opts.distance) {
			var d2=d;
			while (d2>=0 && d2<=opts.distance) {
				i++;
				d2=g2-Math.floor(pl1[i] / opts.groupsize);
			}
			while (d>=0 && d<=opts.distance) {
				j++;
				d=Math.floor(pl2[j] / opts.groupsize)-g1;
			}
		} else i++;
		if (j>=pl2.length) break;
		while(i<pl1.length && pl1[i]<pl2[j]) {
			res.push( pl1[i] )
			ntoken.push( op1[1][i]);
			i++;
		}
		if (i>=pl1.length) break;
	}
	while (i<pl1.length) {
		res.push( pl1[i] )
		ntoken.push( op1[1][i]);
		i++;
	}
	return [res,ntoken];
}

var OPERATIONS={
	nearby:nearby,
	notnearby:notnearby,
	followby:followby,
	notfollowby:notfollowby,	
}

var boolSearch=function(operations,opts) {
	var stack=[];
	opts=opts||{};
	var tokenlengths=[];
	if (typeof opts.distance!='number') opts.distance=2;
	
    opts.groupsize = Math.pow(2,this.meta.slotshift);
    var n=0;

	for (var i=0;i<operations.length;i++) {
		if (typeof operations[i]=='string') {
			var op=OPERATIONS[operations[i]];
			if (stack.length>=2) {
				var op2=stack.pop(),op1=stack.pop();
				stack.push( op.apply(this,[op1,op2,opts]));
			}
		} else {

			for (var j=0;j<operations[i].length;j++) {
				var r=this.phraseSearch(operations[i][j],{raw:true});
				var ntoken=[];
				for (var k=0;k<r.length;k++) ntoken[k]=n;
				stack.push([r, ntoken]);

				var tokens=this.customfunc.tokenize.apply(this,[operations[i][j].trim()]);
				tokenlengths[n]=tokens.length;
				n++;
			}

			for (var j=0;j<operations[i].length-1;j++) {
				var op2=stack.pop(),op1=stack.pop();
				stack.push( or.apply(this,[op1,op2,opts] ) );
			}

		}
	}
	var r=stack.pop();
	opts.rawposting=r[0];
	if (opts.rawcountonly) return opts.rawposting.length;
	if (opts.raw) return opts.rawposting;
	r=plist.groupbyblock2( r[0],r[1],this.meta.slotshift);
	opts.tokenlengths=tokenlengths;
	return this.renderhits.apply(this,[r[0],r[1],opts]);
}

/* combine two postings with ntoken */
var or=function(op1,op2,opts) {
	var r=[];
	for (var i=0;i<op1[0].length;i++) r.push( [op1[0][i], op1[1][i]])
	for (var i=0;i<op2[0].length;i++) r.push( [op2[0][i], op2[1][i]])
	r.sort(function(a,b){ return a[0]-b[0] });
	res=r.map(function(a){return a[0]} )
	ntoken=r.map(function(a){return a[1]} )
	return [res,ntoken];
}

module.exports={
	nearby:nearby,
	notnearby:notnearby,
	followby:followby,
	notfollowby:notfollowby,
	boolSearch:boolSearch,
}