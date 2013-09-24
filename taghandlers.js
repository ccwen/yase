var Schema=require('./schema');
var selector=require('./selector');
var verbose=false;
var predefined = {
	pb: function(taginfo) {
		if (taginfo.closetag && !taginfo.opentag) return;
		var k=taginfo.tagname;
		var ed=taginfo.tag.match(/ ed="(.*?)"/);
		if (ed) {	
			ed=ed[1]; 
			taginfo.append="."+ed; //with edition
		}
	}
}

var setschema=function(schema) {
	var ctx=this.context;
	//this.options.schema=schema;

	ctx.schema=JSON.parse(JSON.stringify(schema));
	for (var i in ctx.schema) {
		var h=ctx.schema[i].handler;
		if (typeof h == 'string') {
			ctx.schema[i].handler=predefined[h];
		}
		for (var j in ctx.schema[i]) {
			var ATTR=ctx.schema[i].indexattributes;
			if (!ATTR) continue;
			//convert regstr to regex as json cannot hold regex
			for (var k in ATTR) {
				if (ATTR[k].regstr) ATTR[k].regex=new RegExp(ATTR[k].regstr)
			}
		}
	}	
}
var loadschema=function(S) {
	S=S|| "TEI";
	if (typeof S=='function') {
		var generated=new require('yase').Genschema();
		S.call(generated);
		S=generated.get();
	}
	if (typeof S=='string') {
		var stock=Schema[S];
		if (!stock) {
			console.log('scheme '+S+' not found');
			return;
		}
		this.setschema(stock);
	} else if (typeof S=='object') this.setschema(S);
	else throw 'no schema';	
	return JSON.parse(JSON.stringify(S));
}
var iddepth2tree=function(obj,id,ntag,depth,ai ,tagname) {
	var idarr=null;
	if (ai.cbid2tree) idarr=ai.cbid2tree(id); else {
		if (depth==1) {
			idarr=[id];
		} else {
			idarr=id.split('.');		
		}
	}
	if (idarr.length>depth) {
		abortbuilding('id depth exceed');
		return;
	}
	while (idarr.length<depth) idarr.push('0');
	for (var i=0;i<idarr.length-1;i++) {
		if (!obj[ idarr[i]]) obj[ idarr[i]]={};
		obj = obj[ idarr[i]];
	}
	var val=idarr[idarr.length-1];
	if (typeof obj[val] !=='undefined') {
		if (ai.unique) {
			var ctx=this.context;
			if (ai.default!=val) {
				console.log("FILE:",ctx.filename,"LINE:",ctx.linebreakcount);
				console.log('repeated val:',val, ', tagname:',tagname);
			}
		} else {
			if (typeof obj[val]=='number') obj[val]=[ obj[val] ] ; // convert to array
			obj[val].push(ntag);
		}
	} else  {
		obj[val]= ntag; 
	} 
}
var addprefix=function(prefix) {
	var prefixs=prefix.split(".");
	var out=[];
	for (var i in prefixs) {
		var pf=prefixs[i];
		var sel=selector.parseSelector(pf);

		if (sel.key) {
			var V=this.output.tags[sel.tag][sel.key];	
			if (!V) {
				this.abortbuilding('cannot add prefix'+pf+
					" specific saveval:true for prefix attribute")
			}			
			out.push(V[V.length-1]);
		} else {
			if (!this.output.tags[sel.tag]) {
				this.abortbuilding('no such tag '+sel.tag);
			}
			var V=this.output.tags[sel.tag]._count;
			out.push(V);
		}
	}
	return out.join(".")+".";
}
var defaulttaghandler=function(taginfo) {
	var k=taginfo.fulltagname;
	var ctx=this.context;
	var tags=this.output.tags;
	var hidetag=false;
	//if (taginfo.tagname=='注' || taginfo.tagname=='t') {
	//	console.log(taginfo,ctx.filename,ctx.crlfcount)
	//}
	
	if (taginfo.append) k+=taginfo.append;
	if (!tags[k]) tags[k]={ _count:0};
	tags[k]._count++;
	
	if (taginfo.newslot) {
		if (taginfo.opentag) {
			this.addslottext();
		} else if (taginfo.closetag) {
			if (taginfo.savehead ||taginfo.saveheadkey) {
				var k=taginfo.tagname;
				if (!tags[k]) tags[k]={};
				
				var sentence=ctx.slotbuffer.substring(ctx.lastnchar,ctx.nchar);
				var p=sentence.indexOf('>');
				var headline=sentence.substring(p+1);

				if (taginfo.saveheadkey)  {
					var H=tags[k][taginfo.saveheadkey];
					if (!H) {
						H=tags[k][taginfo.saveheadkey]={ _vpos:[],_ntag :[]
							,_head:[] , _depth:[]};//
						if (!ctx.tagattributeslots) ctx.tagattributeslots=[];
						ctx.tagattributeslots.push(H);
					}

					H.ntag.push( (tags[k]._count-2) /2 );
					H._vpos.push( ctx.vpos );
					H._head.push(headline);
					
					taginfo.saveheadkey='';
				} else {
					if (typeof tags[k]._head=='undefined') tags[k]._head=[];
					tags[k]._head.push(headline);
				}
			}
			hidetag=true; //remove closetag as already put into sentence
			ctx.nchar+=ctx.token.length;
			ctx.ntoken++;
			this.addslottext();
			ctx.nchar-=ctx.token.length;
			ctx.ntoken--;

		}
		//TODO call add slot text and automatic add text
		
	}

	if (taginfo.savepos && taginfo.opentag) {
		if (!tags[k]._vpos) tags[k]._vpos=[];
		//if (!tags[k]._offset) tags[k]._offset=[];
		if (!tags[k]._depth) tags[k]._depth=[];
		tags[k]._vpos.push(ctx.vpos);
		//tags[k]._offset.push(ctx.offset);
		tags[k]._depth.push(ctx.tagstack.length);
	}

	if (taginfo.indexattributes && taginfo.opentag) 
	for (var i in taginfo.indexattributes) {
		var I=taginfo.indexattributes[i];
		var attrkey=i+'=';
		if (!tags[k][attrkey]) tags[k][attrkey]={};
		var val=taginfo.tag.match( I.regex);
		if (val && val.length>1) val=val[1]; else if (val) val=val[0];
		if (!val && I.default) val=I.default;
		if (val) {
			if (I.prefix) {
				if (!I.unique) I.unique=true;
				if (typeof I.depth=='undefined' || I.depth<2) {
					I.depth= I.prefix.split(".").length+1;
					console.log('set to depth ',I.depth)
				}
				if (val!=I.default)	val=addprefix.apply(this,[I.prefix])+val;
				if (verbose) console.log('new value ',val,'for',k,i);
			}
			var depth=I.depth || 1;
			iddepth2tree.apply(this,[tags[k][attrkey], val, tags[k]._vpos.length -1,  depth, I , taginfo.tagname]);
			if (I.savehead) {
				taginfo.saveheadkey=attrkey+val;
			}
		} else if (!I.allowempty) {
			this.abortbuilding('empty val '+taginfo.tag);
		} 

		if (I.saveval) {
			if (!tags[k][i]) tags[k][i]=[];
			if (!val) val="";
			tags[k][i].push(val);
		}
	}

	if (hidetag||taginfo.comment|| taginfo.remove) return '' ;else return taginfo.tag;	
}

var extracttagname=function(xml) {
	var tagname=xml.substring(1);
	if (tagname[0]=='/') tagname=tagname.substring(1);
	tagname=tagname.match(/(.*?)[ \/>]/)[1];	
	return tagname;
}

var dotag=function(tag) {
	var ctx=this.context;
	var tagname=extracttagname(tag);
	var ti=ctx.schema[tagname];
	if (!ti) ti={};
	ti.tagname=tagname;
	ti.opentag=true;
	ti.closetag=false;
	ti.tag=tag;

	if (tag.substr(tag.length-2,1)=='/') ti.closetag=true;
	if (tag.substr(1,1)=='/') {ti.closetag=true; ti.opentag=false;}

	ti.fulltagname=tagname; 
	if (ti.closetag && !ti.opentag) ti.fulltagname='/'+tagname;
	//else if (ti.closetag && ti.opentag) ti.fulltagname=tagname+'/';

	if (ti.emptytag) {
		if (!ti.closetag || !ti.opentag) this.abortbuilding('invalid empty tag, schema:'+JSON.stringify(ti));
	}
	/*
	if (ti.comment) {
		if (ti.opentag) ctx.hidetext=true;
		if (ti.closetag) ctx.hidetext=false;
	}
	*/
	if (ti.opentag) {
		ctx.tagstack.push(tagname);
		ctx.tagstack_fi.push([ctx.filename,ctx.linebreakcount]);
	}

	if (ti.closetag) {
		if (ctx.tagstack.length==0) {
			this.abortbuilding('tag underflow');
		}
		var tn=ctx.tagstack.pop();
		if (tn!=tagname) {
			console.log('\n\nFATAL:\ntag stack not balance',tn,tagname)
			console.log('tag stack file info',JSON.stringify(ctx.tagstack_fi));
			this.abortbuilding('tag stack:'+ JSON.stringify(ctx.tagstack));
		}
		ctx.tagstack_fi.pop();
	} 

	if (ti.handler) ti.handler.apply(this,[ti]);
	return defaulttaghandler.apply(this,[ti]);
}

var initialize=function() {
	this.context.tagstack=[];
	this.context.tagstack_fi=[];
}
module.exports={predefined:predefined,dotag:dotag,
	loadschema:loadschema,setschema:setschema, initialize:initialize};