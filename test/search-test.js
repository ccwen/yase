console.log(process.cwd())
var Yase=require('yase');

var db=Yase.use('./searchdb.ydb');
search=require('../search');

QUnit.test( "loadtoken", function() {
  var res=search.loadToken.apply(db,["a"]);
  deepEqual(res.posting, [],'empty token');

  var res=search.loadToken.apply(db,["a1"]);
  deepEqual(res.posting,[0,32,33,256],'a1')

  var res=search.loadToken.apply(db,["a%",{expanded:true,getlengths:true}]);
  deepEqual(res.expanded,['a1','a2','a3','a4','a5','a6','a7','a8','a9'],'expanded')
  equal(res.lengths.length,9,'posting lengths');
});
QUnit.test("loadtoken.grouped",function() {

  var res=search.loadToken.apply(db,["a%",{groupunit:"p"}]);
  deepEqual(res.grouped.length,6)

  var res=search.loadToken.apply(db,["a%",{groupunit:"p[n]"}]);
  deepEqual(res.grouped.length,4)

  var res=search.loadToken.apply(db,["a%",{groupunit:"p[n=1]"}]);
  deepEqual(res.grouped.length,3)
  deepEqual(res.grouped[0],[0,1])

});

