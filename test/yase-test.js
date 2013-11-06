var vows = require('vows'),
    assert = require('assert'),
    Yase=require('../yase'),
    Search=require('../search');
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
	}

}).export(module); // Export the Suite