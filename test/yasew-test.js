var vows = require('vows'),
    assert = require('assert'),
    schema=require('../schema');
    Yasew=require('../yasew');
    Yasebuild=require('../yasebuild')
var xmlfile='test.xml';
var fs=require('fs')

vows.describe('yadb worker 4 test suite').addBatch({
  'yasew':{
        topic: function () {
        		var yasew=new Yasew();
		yasew.setschema(schema["TEI"]);
        		//yasew.setcustomfunc( require('../yasecustom') );
		yasew.addfilebuffer(fs.readFileSync(xmlfile,'utf8'));
		yasew.construct();

		return yasew;
	},
	build:function(topic) {
		//console.log(topic.output);
		//assert.deepEqual(topic.tags['pb.a']['n='],{ '1': { '1a': 0, '1b': 1 ,'2a':2} },'id tree')
	},
	write:function(topic) {
		topic.save("test.ydb");
	}

},
  'buildscript':{
        topic: function () {
        		return Yasebuild({
        			input:'test.lst',
        			ydbfn:'test3.ydb'
        		}
        		);
        },
        check:function(topic) {
        	console.log('check',topic)
        }

  }

}).export(module); // Export the Suite