
var unpack = function (ar) { // unpack variable length integer list
  var r = [],
  i = 0,
  v = 0;
  do {
	var shift = 0;
	do {
	  v += ((ar[i] & 0x7F) << shift);
	  shift += 7;
	} while (ar[++i] & 0x80);
	r.push(v);
  } while (i < ar.length);
  return r;
}
var groupbyblock = function (ar, blockshift, opts) {
  if (!ar.length)
	return {};
  
  blockshift = blockshift || 16;
  var g = Math.pow(2,blockshift);
  var i = 0;
  var r = {};
  var groupcount=0;
  do {
	var group = Math.floor(ar[i] / g) ;
	if (!r[group]) {
	  r[group] = [];
	  groupcount++;
	}
	r[group].push(ar[i] % g);
	i++;
  } while (i < ar.length);
  if (opts) opts.groupcount=groupcount;
  return r;
}
/*
var identity = function (value) {
  return value;
};
var sortedIndex = function (array, obj, iterator) { //taken from underscore
  iterator || (iterator = identity);
  var low = 0,
  high = array.length;
  while (low < high) {
	var mid = (low + high) >> 1;
	iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
  }
  return low;
};*/

var sortedIndex = function (array, obj) { 
  var low = 0,
  high = array.length;
  while (low < high) {
  var mid = (low + high) >> 1;
    array[mid] < obj ? low = mid + 1 : high = mid;
  }
  return low;
};

var pland = function (pl1, pl2, distance) {
  var r = [];
  var swap = 0;
  
  if (pl1.length > pl2.length) { //swap for faster compare
	var t = pl2;
	pl2 = pl1;
	pl1 = t;
	swap = distance;
	distance = -distance;
  }
  for (var i = 0; i < pl1.length; i++) {
	var k = sortedIndex(pl2, pl1[i] + distance);
	var t = (pl2[k] === (pl1[i] + distance)) ? k : -1;
	if (t > -1) {
	  r.push(pl1[i] - swap);
	}
  }
  return r;
}
var plphrase = function (postings) {
	
  var r = [];
  for (var i=0;i<postings.length;i++) {
	i = parseInt(i);
	if (!postings[i])
	  return [];
	if (0 === i) {
	  r = postings[0];
	} else {
	  r = pland(r, postings[i], i);
	}
  }
  
  return r;
}
var plist={};
plist.unpack=unpack;
plist.plphrase=plphrase;

plist.groupbyblock=groupbyblock;
module.exports=plist;
return plist;