var handlers=require('./taghandlers');
Genschema=function() {
	this.schema={};
	var addtags=function(tags,opts) {
		for (var i in tags) {
			var S=this.schema[tags[i]];
			var newsetting=JSON.parse(JSON.stringify(opts));
			if (!S) S=this.schema[tags[i]]=newsetting;
			else 	for (var i in newsetting) S[i]=newsetting[i];
			if (handlers[tags[i]]) { // attach a handler automatically
				S.handler=tags[i];
			}			
		}
	}
	this.toctag=function(tags) {
		if (typeof tags=='string') tags=[tags];
		addtags.apply(this,[tags,{newslot:true,savepos:true,savehead:true}]);
		return this;
	}
	this.newslot=function(tags) {
		if (typeof tags=='string') tags=[tags];
		addtags.apply(this,[tags,{newslot:true}]);
		return this;
	}	
	this.emptytag=function(tags) {
		if (typeof tags=='string') tags=[tags];
		addtags.apply(this,[tags,{emptytag:true,newslot:false,savepos:true,savehead:false}]);
		return this;
	}	
	this.attr=function(tags,attrs,opts) {
		opts=opts||{};
		if (typeof tags=='string') tags=[tags];
		if (typeof attrs=='string') attrs=[attrs];
		for (var i in tags) {
			if (!this.schema[tags[i]]) continue;
			var I={};
			for (var j in attrs) {
				I[attrs[j]]={ regstr: ' '+attrs[j]+'="(.*?)"', 
				unique: opts.unique, 
				saveval:opts.saveval, 
				prefix:opts.prefix,
				default:opts.default,
				depth:opts.depth};
			}
			this.schema[tags[i]].indexattributes=JSON.parse(JSON.stringify(I));
		}
		return this;
	}
	this.get=function() {
		return this.schema ;
	}
	return this;
}
module.exports=Genschema;