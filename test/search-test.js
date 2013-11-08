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
	followby:function(topic) {
		var command=[
			"a1",
			"b2",
			Search['FOLLOWBY']
		]
		var r=topic.boolSearch(command);
		assert.deepEqual( r[0] , [0,1,33,34]);
		assert.deepEqual( r[1] , [0,0,1,1]);

		var r=topic.boolSearch(command,{grouped:true});
		assert.deepEqual( r[0], {0:[0,1], 1:[1,2]} );
		assert.deepEqual( r[1], {0:[0,0], 1:[1,1]} );
		
		var r=topic.boolSearch(command,{highlight:true});
		console.log(r)
		
	},
	notfollowby:function(topic) {
		var command=[
			"a1",
			"b2",
			Search['NOTFOLLOWBY']
		]
		var r=topic.boolSearch(command);
		assert.deepEqual( r[0] , [128]);
		assert.deepEqual( r[1] , [0]);

		var command=[
			"a1",
			"d2",
			Search['NOTFOLLOWBY']
		]

		var r=topic.boolSearch(command);
		assert.deepEqual( r[0] , [0,1,97,128]);
		assert.deepEqual( r[1] , [0,0,1,0]);

	},

	or:function(topic){
		var command=[
			"a1","a2",Search['OR']
		]
		var r=topic.boolSearch(command);
		assert.deepEqual( r[0] , [0,1,2,128,129]);
		assert.deepEqual( r[1] , [0,0,1,0  ,1]);
	},
}

}).export(module); // Export the Suite