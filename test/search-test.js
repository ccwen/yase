console.log(process.cwd())
var Yase=require('yase');
var plist=require('../plist');

var db=Yase.use('./searchdb.ydb');
search=require('../search');
var query1="a1 a2.b2 -b3";

QUnit.test("match slot",function() {
  var r=plist.matchSlot([1,2,3,32,33,34,128,129],5);
  deepEqual(r.docs,[0,1,4]);
  deepEqual(r.freq,[3,3,2]);
});

QUnit.test("newQuery 1",function() {
  var res=search.newQuery.apply(db,[query1]);
  deepEqual(res.phrases[0],[0,1]);
  deepEqual(res.phrases[1],[2,3]);
  equal(res.terms[0].term,"a1");
  equal(res.terms[1].term,"a2");
  equal(res.terms[2].term,"b2");
  equal(res.terms[3].term,"b3");
  equal(res.terms[3].op,"exclude");

});

var query2="e%.b2 b3.a1";
QUnit.test("newQuery 2",function() {
  var res=search.newQuery.apply(db,[query2]);
  deepEqual(res.phrases[0],[0]);
  deepEqual(res.phrases[1],[1,2]);
  equal(res.terms[0].term,"e%");
  equal(res.terms[1].term,"b2");
  equal(res.terms[2].term,"b3");
  deepEqual(res.terms[0].tokens,["e1","e2","e3"]);
  deepEqual(res.terms[1].tokens,null);

});

var query3="a1 12? b2";
QUnit.test("newQuery 3",function() {
  var res=search.newQuery.apply(db,[query3]);
  equal(1,1)
  console.log(res)
});

QUnit.test("load and group",function() {
  var Q=search.newQuery.apply(db,[query2]);
  Q.load().groupBy('p');

  deepEqual(Q.terms[0].posting,[288,320,321,322]);
  deepEqual(Q.terms[0].docs,[4,5]);

  deepEqual(Q.terms[1].docs,[1]);
  deepEqual(Q.terms[3].docs,[0,1,4]);
  deepEqual(Q.terms[3].freq,[1,2,1]);
  //TODO doclist of phrase 

});

//QUnit.test("boolean search ",function(){});
/*
QUnit.test( "loadterm", function() {
  var res=search.loadTerm.apply(db,["a"]);
  deepEqual(res.posting, [],'empty token');

  var res=search.loadTerm.apply(db,["a1"]);
  deepEqual(res.posting,[0,32,33,256],'a1')

  var res=search.loadTerm.apply(db,["a%",{expanded:true,getlengths:true}]);
  deepEqual(res.expanded,['a1','a2','a3','a4','a5','a6','a7','a8','a9','aa','ab','ac','ad'],'expanded')
  equal(res.lengths.length,13,'posting lengths');
});
QUnit.test("loadterm.grouped",function() {

  var res=search.loadTerm.apply(db,["a%",{groupunit:"p"}]);
  deepEqual(res.grouped.length,6)

  var res=search.loadTerm.apply(db,["a%",{groupunit:"p[n]"}]);
  deepEqual(res.grouped.length,4)

  var res=search.loadTerm.apply(db,["a%",{groupunit:"p[n=1]"}]);
  deepEqual(res.grouped.length,3)
  deepEqual(res.grouped[0],[0,1])

});
*/
