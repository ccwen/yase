var vows = require('vows'),
    assert = require('assert'),
    plist=require('../plist');

vows.describe('plist test suite').addBatch({
    'countbyposting': {
        topic: function () {
        	return [
                [1,2,3,4,5,6,7],
                [3,5]
            ];
        },
        run:function(topic){
            var res=plist.countbyposting(topic[0],topic[1]);
            assert.deepEqual(res,[3,2,2]);
        }
    },
    'groupsum': {
        topic: function () {
            return [
               [1,2,1,1,1,1,1,1,3],
                 [0,1,1,2,2,0,1,2]
            ];
        },
        run:function(topic){
            var res=plist.groupsum(topic[0],topic[1]);
            assert.deepEqual(res,[6,1,3,1,1,5,4,3]);
        }
    }


}).export(module); // Export the Suite