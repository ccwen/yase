console.log(process.cwd())
var Yase=require('yase');

var db=Yase.use('./searchdb.ydb');
search=require('../search');

QUnit.test( "loadtoken", function() {
  var res=search.loadToken.apply(db,["a"]);
  deepEqual(res.posting, [],'empty token');

  var res=search.loadToken.apply(db,["a1"]);
  deepEqual(res.posting,[0,1,128],'a1')

  var res=search.loadToken.apply(db,["a%",{expanded:true,getlengths:true}]);
  deepEqual(res.expanded,['a1','a2','a3','a4','a5','a6','a7','a8','a9'],'expanded')
  equal(res.lengths.length,9,'posting lengths')
});

Qunit.test("groupToken",function(){
	/*
	plist.groupToken(postings,groupunit)
	*/
})