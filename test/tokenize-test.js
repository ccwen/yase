var vows = require('vows'),
    assert = require('assert'),
    yasecustom=require('../yasecustom');
var fs=require('fs');

vows.describe('splitter test suite').addBatch({
    'texts': {
        topic: function () {
        	return yasecustom;
        },
        simple:function(topic){
        	var tokens=topic.tokenize('<a> abc </a>')
        	assert.equal(3,tokens.length,'length');
        	var normalized=topic.normalizeToken(tokens[1])
        	assert.equal("abc",normalized,'normalized');
        },
        simple2:function(topic){
            var tokens=topic.tokenize('<a> abc&abc; </a>')
            assert.equal(4,tokens.length,'length');
            var normalized=topic.normalizeToken(tokens[2])
            assert.equal("&abc;",normalized,'normalized');
        },
        simple3:function(topic){
            var tokens=topic.tokenize('<a> abc一&abc; </a>')
            assert.equal(5,tokens.length,'length');
            var normalized=topic.normalizeToken(tokens[2])
            assert.equal("一",normalized,'normalized');
        },
        chinese:function(topic){
            var tokens=topic.tokenize('<a>日 月  明</a>')
            console.log(tokens)
            assert.equal(5,tokens.length,'length');
            var normalized=topic.normalizeToken(tokens[1])
            assert.equal("日",normalized,'normalized');
        },        
        ids:function(topic){
            var tokens=topic.tokenize('<a> abc⿱⿰日月皿𠀀 &abc; </a>')
            console.log(tokens)
            assert.equal(6,tokens.length,'length');
            var normalized=topic.normalizeToken(tokens[2])
            assert.equal("⿱⿰日月皿",normalized,'normalized');
        }
    }


}).export(module); // Export the Suite