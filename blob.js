var fs=require('fs');

/*  wrench.readdirSyncRecursive("directory_path");
 *
 *  Recursively dives through directories and read the contents of all the
 *  children directories.
 */
var readdirSyncRecursive = function(baseDir) {
    baseDir = baseDir.replace(/\/$/, '');
var _path = require("path");
var readdirSyncRecursive = function(baseDir) {
        var files = [],
            curFiles,
            nextDirs,
            isDir = function(fname){
                return fs.statSync( _path.join(baseDir, fname) ).isDirectory();
            },
            prependBaseDir = function(fname){
                return _path.join(baseDir, fname);
            };

        curFiles = fs.readdirSync(baseDir);
        nextDirs = curFiles.filter(isDir);
        curFiles = curFiles.map(prependBaseDir);

        files = files.concat( curFiles );

        while (nextDirs.length) {
            files = files.concat( readdirSyncRecursive( _path.join(baseDir, nextDirs.shift()) ) );
        }

        return files;
    };

    // convert absolute paths to relative
    var fileList = readdirSyncRecursive(baseDir).map(function(val){
        return _path.relative(baseDir, val);
    });

    return fileList;
};

/*add blob recursively from file system*/
var addblob=function(blobsetting, output) {
	output.blob={};
	for (var i in blobsetting) {
		var subdir=blobsetting[i];
		var blobs=readdirSyncRecursive(subdir);
		//create subfolder
		var O=output.blob[i]={};
	    for (var i in blobs) {
	        blobs[i]=blobs[i].replace(/\\/g,'/');
	        var idx=blobs[i].lastIndexOf('/');
	        if (idx>-1) {
	        	var folders=blobs[i].substring(0,idx).split('/');
	        	var o=O;
	        	for (var j in folders) {
	        		if (typeof o[folders[j]]=='undefined') o[folders[j]]={};
	        		o=o[folders[j]];
	        	}
	        }
	    }
	    //load blob
	    for (var i in blobs) {
	    	var fn=subdir+'/'+blobs[i];
	        var idx=blobs[i].lastIndexOf('/');
	        if (idx>-1) {
	        	var folders=blobs[i].substring(0,idx).split('/');
	        	var name=blobs[i].substring(idx+1);
	        	var o=O;
	        	for (var j in folders) {
	        		if (typeof o[folders[j]]=='undefined') o[folders[j]]={};
	        		o=o[folders[j]];
	        		if (!fs.statSync(fn).isDirectory())
		        		o[name]=fs.readFileSync(fn); 
	        	}

	        } else {
	        	if (!fs.statSync(fn).isDirectory())
	        		O[blobs[i]]=fs.readFileSync(fn); //root
	        }
	    }
		
		//console.log(blobs)
	}
	return O;
}

module.exports={add:addblob};