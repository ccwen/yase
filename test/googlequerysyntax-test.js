var googlequerysyntax=require('../querysyntax_google');
/*
   english query  :   "this is a phrase" box 
   ["this is a phrase","box"]

   chinese:   中文 康熙
   ["中文","康熙"]

   tibetan: ། shad phrase delimter
   གང་བའ།  དང།

   ["གང་བའ","དང།"]
Test drive development.
*/
QUnit.test("",function() {
  var r=googlequerysyntax.parse("中文 +康熙 -陳爽");
  deepEqual(r,["中文","+康熙","-陳爽"]);
});

QUnit.test("",function() {
  var r=googlequerysyntax.parse("this is a book");
  deepEqual(r,["this","is","a","book"]);
});

QUnit.test("",function() {
  var r=googlequerysyntax.parse('there are "a book" and '+"'a pencil'");
  deepEqual(r,['there','are','a book','and','a pencil']);
});
QUnit.test("",function() {
  var r=googlequerysyntax.parse('there are "+a book" and '+"'-a pencil'");
  deepEqual(r,['there','are','+a book','and','-a pencil']);
});