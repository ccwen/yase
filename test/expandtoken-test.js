var vows = require('vows'),
    assert = require('assert'),
    Yase=require('../yase');
var fs=require('fs')
vows.describe('yadm 4 test suite').addBatch({
   
	'expandtokens': {
 		topic: function () {
        	var db=new Yase('../../../cst/vrimul.ydb',{nowatch:true})
        	return db;
		},
		
		expand:function(topic) {
			var expanded=topic.expandToken('manus',{max:200});
			assert.equal( expanded.raw.indexOf('manusso')>-1,true )
			assert.equal( expanded.raw.indexOf('mānusenapi')>-1,true )
		},
		expand2:function(topic) {
			var expanded=topic.expandToken('buddham',{max:200});
			assert.equal(expanded.raw.indexOf('buddhamaddakkhiṃ')>-1,true)
			
		},
		expand3:function(topic) {
			var expanded=topic.expandToken('māh',{max:200});
			assert.equal(expanded.raw.indexOf('māhaṃ')>-1,true)
		},
		expand4:function(topic) {
			var expanded=topic.expandToken('buddha',{max:200});
			assert.equal(expanded.raw[0],'buddha')
		},
		expand5:function(topic)	 {
			var expanded=topic.expandToken('maharaja',{max:200,exact	:true});
			assert.deepEqual(expanded.raw,['mahārāja','mahārājā']);
		},
		expand6:function(topic)	 {
			var expanded=topic.expandToken('avut',{max:200,exact:true});
			assert.deepEqual(expanded.raw,[]);
		},
		expand7:function(topic)	 {
			var expanded=topic.expandToken('avuta',{max:200,exact:true});
			assert.deepEqual(expanded.raw,['āvutā','āvuṭā']);
		}

	}	
	

}).export(module); // Export the Suite