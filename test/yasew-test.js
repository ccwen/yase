var vows = require('vows'),
    assert = require('assert'),
    Yasew=require('../Yasew');
var xmlfile='test.xml';
var schema=require('../schema');
var fs=require('fs')
var splitter=require('../splitter');
var Invert=require('../invert');


var taginfo={
	's':{remove:true},
	'chapter':{savepos:true,newslot:true, text:true},
	'pb':{savepos:true,handler:'pb',remove:true, indexattributes:{ n: {regex: / n="(.*?)"/, allowrepeat: false, depth:2}  } }
}

vows.describe('yadb worker 4 test suite').addBatch({
  'indexer':{
        topic: function () {
        		var yasew=new Yasew();
		//indexer.setschema(schema["TEI"]);
        		//indexer.setcustomfunc( require('../yasecustom') );
		yasew.addfilebuffer(fs.readFileSync(xmlfile,'utf8'));
		yasew.build();
		return yasew;
	},
	build:function(topic) {
		console.log(topic.output);
		//assert.deepEqual(topic.tags['pb.a']['n='],{ '1': { '1a': 0, '1b': 1 ,'2a':2} },'id tree')
	},
	write:function(topic) {
		topic.save("test.ydb");
	}

},
  'read_newly_generated':{

  	}

}).export(module); // Export the Suite