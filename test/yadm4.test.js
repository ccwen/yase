var vows = require('vows'),
    assert = require('assert'),
	Yadm4=require('../yadm4');
	

/*
  create a dm file with 
  node launcher/converter.js paliseg/buildya.prj.js
*/

var filename='../../paliseg/vri4.mul.ydb';

// Create a Test Suite
console.log('yadm test suite');
vows.describe('yadm test suite').addBatch({
    'small ya': {
        topic: function () {
			return new Yadm4(filename);

		},

        'check require tables': function (topic) {
			assert.equal( !!topic.meta, true,'error loading meta file' );
        },
		'phraseSearch':function(topic) {
			console.time('phrase search *1000');
			var R=topic.phraseSearch('samādhināti',{showtext:true});
			assert.equal(1,Object.keys(R).length,'number of hit');
			console.timeEnd('phrase search *1000');
		},
		
		'closestTag':function(topic)  {
			var R=topic.phraseSearch('samādhināti',{raw:true});
			var slot=parseInt(Object.keys(R)[0]);
			var tagarr=['div','head','p[rend=subhead]'];
			var t=topic.closestTag(tagarr,slot);
			
			var tagslots=t.map( function(tt) { return tt.ntag});
			assert.deepEqual(tagslots,[337,337,30728],'multiple tag')
		}
	},

}).export(module); // Export the Suite