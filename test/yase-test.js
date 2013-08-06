var vows = require('vows'),
    assert = require('assert'),
    Yadm4=require('../yadm4');
var fs=require('fs')
vows.describe('yadm 4 test suite').addBatch({
    'texts': {
        topic: function () {
        		return new Yadm4('../../ltpr/jiangkangyur.ydb');
	},
	gettext:function(topic) {
		assert.equal(topic.getText(0).trim(),'རྒྱ་གར་སྐད་དུ།','gettext')
	},
	gettag:function(topic) {
		var r=topic.getTag('pb',1);
		assert.deepEqual(r,{slot:16,offset:1},'gettag');
		//console.log(topic.getText(16));
	},
	findtag:function(topic) {
		var r=topic.findTag('pb','id','1.2a');
		assert.equal(r,1,'findtag');
	},

	fetchpage:function(topic) {
		var r=topic.fetchPage('pb',1);
		assert.equal(r.match(/\n/g).length,8,'lines');
	},	
    },
    'xml texts': {
        topic: function () {
        		return new Yadm4('../yadm4.ydb');
	},
	getText:function(topic) {
		assert.equal(topic.getText(0),'<chapter>c1</chapter>','firstline')
	},
	findtag:function(topic) {
		//s=topic.getdb().get(['tags'],true)
		//console.log(s)
		var r=topic.findTag('pb.a','n','1.1a');
		assert.equal(r,0,'findtag');
		console.log(topic.getTag('pb.a',0));
	},	
	fetchpage:function(topic) {
		var r=topic.fetchPage('pb.b',0);
		assert.equal('45\n6, {\n}789\nabq\nc, de\nfghij. \n',r,'fetchpage')
	},
	text:function(topic) {
		var r=topic.getToc('chapter',1);
		console.log('topic',r)
		assert.equal('c2',r,'text line')
	}
}	

}).export(module); // Export the Suite