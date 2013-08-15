var handlers=require('./taghandlers');
Genschema=function() {
	this.schema={};
	var addtags=function(tags,opts) {
		for (var i in tags) {
			this.schema[tags[i]]=JSON.parse(JSON.stringify(opts));
			if (handlers[tags[i]]) { // attach a handler automatically
				this.schema[tags[i]].handler=tags[i];
			}			
		}
	}
	this.toctag=function(tags) {
		if (typeof tags=='string') tags=[tags];
		addtags.apply(this,[tags,{newslot:true,savepos:true,savehead:true}]);
		return this;
	}
	this.emptytag=function(tags) {
		if (typeof tags=='string') tags=[tags];
		addtags.apply(this,[tags,{emptytag:true,newslot:false,savepos:true,savehead:false}]);
		return this;
	}	
	this.attr=function(tags,attrs,opts) {
		debugger;
		opts=opts||{};
		if (typeof tags=='string') tags=[tags];
		if (typeof attrs=='string') attrs=[attrs];
		for (var i in tags) {
			if (!this.schema[tags[i]]) continue;
			var I=this.schema[tags[i]].indexattributes={};
			for (var j in attrs) {
				I[attrs[j]]={ regstr: ' '+attrs[j]+'="(.*?)"', allowrepeat: !!opts.allowrepeat, depth:opts.depth||1};
			}
		}
		return this;
	}
	this.get=function() {
		return this.schema ;
	}
	return this;
}
module.exports=Genschema;