var fs=require('fs');
var processlist=function(opts,callback) {
	var files=fs.readFileSync(opts.filelist,'utf8').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
	var output=[],count=0;
	opts.maxfile=opts.maxfile||0;
	opts.folder=opts.folder||"";
	opts.encoding=opts.encoding||'utf8';

	for (var i=0;i<files.length;i++) {
		var fn=files[i];
		if (!fn.trim()) continue;
		if (fn.charAt(0)==';') continue;
		var content=fs.readFileSync(opts.folder+fn,opts.encoding);
		if (opts.textfile) {
			content=content.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n');
		}
		callback(files[i],content)
		count++;
		if (opts.maxfile && count>=opts.maxfile) break;
	}
}	
module.exports=processlist;