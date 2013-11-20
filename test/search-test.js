console.log(process.cwd())
var Yase=require('yase');
var plist=Yase.plist;
var search=Yase.search;

var db=Yase.use('search-test-db.ydb');
var query1=["a1 a2","b2 -b3"];

QUnit.test("match slot",function() {
  var r=plist.matchSlot([1,2,3,32,33,34,128,129],5);
  deepEqual(r.docs,[0,1,4]);
  deepEqual(r.freq,[3,3,2]);
});

/*TODO
  skip leading and ending wildcard
*/

QUnit.test("newQuery 1",function() {
  var res=search.newQuery.apply(db,[query1]);
  deepEqual(res.phrases[0].termid,[0,1]);
  deepEqual(res.phrases[1].termid,[2,3]);
  equal(res.terms[0].key,"a1");
  equal(res.terms[1].key,"a2");
  equal(res.terms[2].key,"b2");
  equal(res.terms[3].key,"b3");
  equal(res.terms[3].exclude,true);

});

var query2=["e%","b5 b6","a1"];
QUnit.test("newQuery 2",function() {
  var res=search.newQuery.apply(db,[query2]);
  deepEqual(res.phrases[0].termid,[0]);
  deepEqual(res.phrases[1].termid,[1,2]);
  equal(res.terms[0].key,"e%");
  equal(res.terms[1].key,"b5");
  equal(res.terms[2].key,"b6");
  deepEqual(res.terms[0].tokens,["e1","e2","e3"]);
  deepEqual(res.terms[1].tokens,[]);

  
});

var query3="a1 2* a3";
QUnit.test("newQuery 3",function() {
  var res=search.newQuery.apply(db,[query3]);
  
  equal(res.terms.length,3);
  equal(res.terms[1].width,2);
  equal(res.terms[1].wildcard,'*');
  deepEqual(res.phrases[0].termid,[0,1,2]);

});
var query4="a3 a4,b4,c4";
QUnit.test("newQuery 4",function() {
  var res=search.newQuery.apply(db,[query4]);
  equal(res.terms[0].key,"a3");
  deepEqual(res.terms[1].tokens,["a4","b4","c4"]);
});

QUnit.test("load and group query2",function() {
  var Q=search.newQuery.apply(db,[query2]);
  Q.load().groupBy('p');
  n=480;
  deepEqual(Q.terms[0].posting,[384,n,n+1,n+2]);
  deepEqual(Q.terms[0].docs,[4,5]);

  deepEqual(Q.terms[1].docs,[1]);
  deepEqual(Q.terms[3].docs,[0,1,4]);
  deepEqual(Q.terms[3].freq,[1,2,1]);
  
  deepEqual(Q.phrases[1].posting,[103]);
});


QUnit.test("a dog",function() {

  var Q=search.newQuery.apply(db,["a 2* dog"]);
  Q.load().groupBy('p');
  deepEqual(Q.phrases[0].posting,[233,297,385]);

  var Q=search.newQuery.apply(db,["a * dog"]);
  Q.load().groupBy('p');
  deepEqual(Q.phrases[0].posting,[233,385]); // a dog , a happy dog

  var Q=search.newQuery.apply(db,["a ? dog"]);
  Q.load().groupBy('p');
  deepEqual(Q.phrases[0].posting,[385]);  // a happy dog 

  var Q=search.newQuery.apply(db,["a 2? dog"]);
  Q.load().groupBy('p');
  deepEqual(Q.phrases[0].posting,[297]);  //a brown happy dog


  var Q=search.newQuery.apply(db,["a -dog"]);
  Q.load().groupBy('p');
  deepEqual(Q.phrases[0].posting,[96,128,256,297,385,516]);  //cat kitty brown happy cow

  var Q=search.newQuery.apply(db,["a 2* -dog"]);
  Q.load().groupBy('p');
  deepEqual(Q.phrases[0].posting,[96,128,256,516]);  //cat kitty mouse cow

});

//TODO Boolean search

QUnit.test("boolean search ",function(){
  var Q=search.newQuery.apply(db,[["cat","kitty"]]);
  Q.load().groupBy('p').search();

  deepEqual(Q.docs,[1,10]);

  var Q=search.newQuery.apply(db,[["cat","cow"]]);
  Q.load().groupBy('p').search({op:'union'});

  deepEqual(Q.docs,[1,4,5,6,7,8,9,10]);

  var Q=search.newQuery.apply(db,[["mouse","cat","happy"]]);
  Q.load().groupBy('p').search({op:['union','intersect']});  
  deepEqual(Q.docs,[2,4]);  
});

QUnit.test("trim posting",function() {
  pl=[11,22,33,44,55,66,77,88,99,100];
  deepEqual( plist.trim(pl,33,66) , [33,44,55,66]);
});

QUnit.test("vsm",function() {
 var Q=search.newQuery.apply(db,[["fish","dog","cat"],
  {groupunit:'p',rank:'vsm'}]);
 Q.search();
 var last=8;
 equal(Q.score[last]>=1,true); //last one is the highest
 deepEqual(Q.score[last-1]==Q.score[last-2],true);//same query same score
 deepEqual(Q.score[last-3]<Q.score[last-2],true); //rare term "fish" has higher rank
 console.log(Q.score) 
 console.log(Q.docs) 
 

});

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
