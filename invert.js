var addslot=function(sentencecount,s) {
	var splitted=this.splitter(s);
	var tokens=splitted.tokens;
	this.vpos=sentencecount * this.blocksize ; 
	for (var i=0;i<tokens.length;i++) {
		var t=this.normalize(tokens[i]);
		if (splitted.skips[i]) continue;
		this.vpos++; // vpos start from 1, 0 denote the block itself
		if (!this.postings[t]) {
		  this.postings[t] = [this.vpos];
		  this.postingcount++;
		} else {
		  this.postings[t].push(this.vpos);
		}			
	}
	return splitted;
}
    var packint = function (ar, token) { // pack ar into
      if (!ar || ar.length === 0)
        return []; // empty array
      var r = [],
      i = 0,
      j = 0,
      delta = 0,
      prev = 0;
      
      do {
        delta = ar[i] - prev;
        if (delta < 0) {
          console.error("negative delta " + delta + " at token: " + token);
          break;
        }
        
        r[j++] = delta & 0x7f;
        delta >>= 7;
        while (delta > 0) {
          r[j++] = (delta & 0x7f) | 0x80;
          delta >>= 7;
        }
        prev = ar[i];
        i++;
      } while (i < ar.length);
      return r;
    }
 
 var normalize_default = function(t) {
 	return t.trim().toLowerCase();
 }
var create=function(opts) {
	var handle={};
	handle.blockshift=opts.blockshift || 5 ; //default blocksize 32
	if (handle.blockshift>10) {
		console.warn('max block size is 1024, reduce your blockshift setting');
		handle.blockshift=10;
	}
	handle.blocksize=2 << (handle.blockshift - 1);//Math.pow(2,handle.blockshift);
	handle.postings =  {};
	handle.postingcount =  0;
	handle.vpos =  1;
	handle.normalize=opts.normalize || normalize_default;
	handle.addslot=addslot;
	handle.splitter=opts.splitter;
	return handle;
}
module.exports=create;
