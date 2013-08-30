var vows = require('vows'),
    assert = require('assert'),
    //schema=require('../schema');
    Yasew=require('../yasew');
var txtfile='daodejin.txt',xmlfile='daodejin.xml';
var fs=require('fs')

vows.describe('yase 4 test suite').addBatch({
/*
  'text file':{
        topic: function () {
          var yasew2=new Yasew2();
		  return yasew2;
	},
	index:function(topic) {
        topic.indexbuffer(fs.readFileSync(txtfile,'utf8'),txtfile);
	},
  },
  */
  'xml file':{
        topic: function () {
          var yasew2=new Yasew2();
          return yasew2;
    },
    index:function(topic) {
        topic.indexbuffer(fs.readFileSync(xmlfile,'utf8'),xmlfile);
        console.log(topic.output)
    },
  }  
}).export(module); // Export the Suite