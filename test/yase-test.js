var vows = require('vows'),
    assert = require('assert'),
    Yase=require('../yase');
var fs=require('fs')
vows.describe('yadm 4 test suite').addBatch({
    'texts': {
        topic: function () {
        	var db=new Yase('../../../cst/vrimul.ydb',{nowatch:true})
        	return db;
	},
	gettext:function(topic) {
		assert.equal(topic.getText(0).trim(),'<xml src="s0101m-d1.xml">','gettext')
	},
	gettag:function(topic) {
		var r=topic.getTag('pb.V',0);
		assert.deepEqual(r,{vpos:2562,slot:10,offset:2,name:'pb.V'},'gettag');
	},
	findtag:function(topic) {
		var r=topic.findTag('pb.V','n','1.0001');
		assert.equal(r[0].ntag,0,'findtag');
	},
	},

	'tokens': {
 		topic: function () {
        	var db=new Yase('../../../cst/vrimul.ydb',{nowatch:true})
        	return db;
		},
		expand:function(topic) {
			
			var expanded=topic.expandToken('manus',{max:200});
			
			assert.equal( expanded.indexOf('manusso')>-1,true )
			assert.equal( expanded.indexOf('mānusenapi')>-1,true )

			//assert.deepEqual(['ma','mā'],expanded);
			//for (var i=0;i<expanded.length&&i<10;i++) console.log(expanded[i])
			//console.log(expanded.length)
		}


	}	
	

}).export(module); // Export the Suite