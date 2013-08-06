var vows = require('vows'),
    assert = require('assert'),
    Yaseindexer=require('../yaseindexer');
var xmlfile='test.xml';
var schema=require('../schema');
var fs=require('fs')
var splitter=require('../splitter');
var Invert=require('../invert');
        		var indexer=new Yaseindexer();
		//indexer.setschema(schema["TEI"]);
        		//indexer.setcustomfunc( require('../yasecustom') );
		indexer.addfilebuffer(fs.readFileSync(xmlfile,'utf8'));
		indexer.build();
		console.log(indexer.output)
		return indexer;