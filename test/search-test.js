var vows = require('vows'),
    assert = require('assert'),
    Yase=require('../yase'),
    Search=require('../search');

var fs=require('fs')
vows.describe('yase searchtest suite').addBatch({
    'texts': {
        topic: function () {
        	var db=new Yase('./searchdb.ydb')
        	return db;
	},
	search:function(topic) {
		var command=[
			"a2",
			"b2",
			Search['FOLLOWBY']
		]
		var r=topic.search(command);
		console.log(r);
	},
	}

}).export(module); // Export the Suite