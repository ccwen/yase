var wrench=require('./wrench');

/*add blob recursively from file system*/
var addblob=function(blobsetting, output) {
	output.blob={};
	for (var i in blobsetting) {
		var subdir=blobsetting[i];
		var blobs=wrench.readdirSyncRecursive(subdir);
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