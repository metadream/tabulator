/* Tabulator v6.3.1 (c) Oliver Folkerd 2025 */
class CoreFeature{

	constructor(table){
		this.table = table;
	}

	//////////////////////////////////////////
	/////////////// DataLoad /////////////////
	//////////////////////////////////////////

	reloadData(data, silent, columnsChanged){
		return this.table.dataLoader.load(data, undefined, undefined, undefined, silent, columnsChanged);
	}

	//////////////////////////////////////////
	///////////// Localization ///////////////
	//////////////////////////////////////////

	langText(){
		return this.table.modules.localize.getText(...arguments);
	}

	langBind(){
		return this.table.modules.localize.bind(...arguments);
	}

	langLocale(){
		return this.table.modules.localize.getLocale(...arguments);
	}


	//////////////////////////////////////////
	////////// Inter Table Comms /////////////
	//////////////////////////////////////////

	commsConnections(){
		return this.table.modules.comms.getConnections(...arguments);
	}

	commsSend(){
		return this.table.modules.comms.send(...arguments);
	}

	//////////////////////////////////////////
	//////////////// Layout  /////////////////
	//////////////////////////////////////////

	layoutMode(){
		return this.table.modules.layout.getMode();
	}

	layoutRefresh(force){
		return this.table.modules.layout.layout(force);
	}


	//////////////////////////////////////////
	/////////////// Event Bus ////////////////
	//////////////////////////////////////////

	subscribe(){
		return this.table.eventBus.subscribe(...arguments);
	}

	unsubscribe(){
		return this.table.eventBus.unsubscribe(...arguments);
	}

	subscribed(key){
		return this.table.eventBus.subscribed(key);
	}

	subscriptionChange(){
		return this.table.eventBus.subscriptionChange(...arguments);
	}

	dispatch(){
		return this.table.eventBus.dispatch(...arguments);
	}

	chain(){
		return this.table.eventBus.chain(...arguments);
	}

	confirm(){
		return this.table.eventBus.confirm(...arguments);
	}

	dispatchExternal(){
		return this.table.externalEvents.dispatch(...arguments);
	}

	subscribedExternal(key){
		return this.table.externalEvents.subscribed(key);
	}

	subscriptionChangeExternal(){
		return this.table.externalEvents.subscriptionChange(...arguments);
	}

	//////////////////////////////////////////
	//////////////// Options /////////////////
	//////////////////////////////////////////

	options(key){
		return this.table.options[key];
	}

	setOption(key, value){
		if(typeof value !== "undefined"){
			this.table.options[key] = value;
		}

		return this.table.options[key];
	}

	//////////////////////////////////////////
	/////////// Deprecation Checks ///////////
	//////////////////////////////////////////

	deprecationCheck(oldOption, newOption,  convert){
		return this.table.deprecationAdvisor.check(oldOption, newOption,  convert);
	}

	deprecationCheckMsg(oldOption, msg){
		return this.table.deprecationAdvisor.checkMsg(oldOption, msg);
	}

	deprecationMsg(msg){
		return this.table.deprecationAdvisor.msg(msg);
	}
	//////////////////////////////////////////
	//////////////// Modules /////////////////
	//////////////////////////////////////////

	module(key){
		return this.table.module(key);
	}
}

class Helpers{

	static elVisible(el){
		return !(el.offsetWidth <= 0 && el.offsetHeight <= 0);
	}

	static elOffset(el){
		var box = el.getBoundingClientRect();

		return {
			top: box.top + window.pageYOffset - document.documentElement.clientTop,
			left: box.left + window.pageXOffset - document.documentElement.clientLeft
		};
	}

	static retrieveNestedData(separator, field, data){
		var structure = separator ? field.split(separator) : [field],
		length = structure.length,
		output;

		for(let i = 0; i < length; i++){

			data = data[structure[i]];

			output = data;

			if(!data){
				break;
			}
		}

		return output;
	}

	static deepClone(obj, clone, list = []){
		var objectProto = {}.__proto__,
		arrayProto = [].__proto__;

		if (!clone){
			clone = Object.assign(Array.isArray(obj) ? [] : {}, obj);
		}

		for(var i in obj) {
			let subject = obj[i],
			match, copy;

			if(subject != null && typeof subject === "object" && (subject.__proto__ === objectProto || subject.__proto__ === arrayProto)){
				match = list.findIndex((item) => {
					return item.subject === subject;
				});

				if(match > -1){
					clone[i] = list[match].copy;
				}else {
					copy = Object.assign(Array.isArray(subject) ? [] : {}, subject);

					list.unshift({subject, copy});

					clone[i] = this.deepClone(subject, copy, list);
				}
			}
		}

		return clone;
	}
}

class Popup extends CoreFeature{
	constructor(table, element, parent){
		super(table);
		
		this.element = element;
		this.container = this._lookupContainer();
		
		this.parent = parent;
		
		this.reversedX = false;
		this.childPopup = null;
		this.blurable = false;
		this.blurCallback = null;
		this.blurEventsBound = false;
		this.renderedCallback = null;
		
		this.visible = false;
		this.hideable = true;
		
		this.element.classList.add("tabulator-popup-container");
		
		this.blurEvent = this.hide.bind(this, false);
		this.escEvent = this._escapeCheck.bind(this);
		
		this.destroyBinding = this.tableDestroyed.bind(this);
		this.destroyed = false;
	}
	
	tableDestroyed(){
		this.destroyed = true;
		this.hide(true);
	}
	
	_lookupContainer(){
		var container = this.table.options.popupContainer;
		
		if(typeof container === "string"){
			container = document.querySelector(container);
			
			if(!container){
				console.warn("Menu Error - no container element found matching selector:",  this.table.options.popupContainer , "(defaulting to document body)");
			}
		}else if (container === true){
			container = this.table.element;
		}
		
		if(container && !this._checkContainerIsParent(container)){
			container = false;
			console.warn("Menu Error - container element does not contain this table:",  this.table.options.popupContainer , "(defaulting to document body)");
		}
		
		if(!container){
			container = document.body;
		}
		
		return container;
	}
	
	_checkContainerIsParent(container, element = this.table.element){
		if(container === element){
			return true;
		}else {
			return element.parentNode ? this._checkContainerIsParent(container, element.parentNode) : false;
		}
	}
	
	renderCallback(callback){
		this.renderedCallback = callback;
	}
	
	containerEventCoords(e){
		var touch = !(e instanceof MouseEvent);
		
		var x = touch ? e.touches[0].pageX : e.pageX;
		var y = touch ? e.touches[0].pageY : e.pageY;
		
		if(this.container !== document.body){
			let parentOffset = Helpers.elOffset(this.container);
			
			x -= parentOffset.left;
			y -= parentOffset.top;
		}
		
		return {x, y};
	}
	
	elementPositionCoords(element, position = "right"){
		var offset = Helpers.elOffset(element),
		containerOffset, x, y;
		
		if(this.container !== document.body){
			containerOffset = Helpers.elOffset(this.container);
			
			offset.left -= containerOffset.left;
			offset.top -= containerOffset.top;
		}
		
		switch(position){
			case "right":
				x = offset.left + element.offsetWidth;
				y = offset.top - 1;
				break;
			
			case "bottom":
				x = offset.left;
				y = offset.top + element.offsetHeight;
				break;
			
			case "left":
				x = offset.left;
				y = offset.top - 1;
				break;
			
			case "top":
				x = offset.left;
				y = offset.top;
				break;
			
			case "center":
				x = offset.left + (element.offsetWidth / 2);
				y = offset.top + (element.offsetHeight / 2);
				break;
			
		}
		
		return {x, y, offset};
	}
	
	show(origin, position){
		var x, y, parentEl, parentOffset, coords;
		
		if(this.destroyed || this.table.destroyed){
			return this;
		}
		
		if(origin instanceof HTMLElement){
			parentEl = origin;
			coords = this.elementPositionCoords(origin, position);
			
			parentOffset = coords.offset;
			x = coords.x;
			y = coords.y;
			
		}else if(typeof origin === "number"){
			parentOffset = {top:0, left:0};
			x = origin;
			y = position;
		}else {
			coords = this.containerEventCoords(origin);
			
			x = coords.x;
			y = coords.y;
			
			this.reversedX = false;
		}
		
		this.element.style.top = y + "px";
		this.element.style.left = x + "px";
		
		this.container.appendChild(this.element);
		
		if(typeof this.renderedCallback === "function"){
			this.renderedCallback();
		}
		
		this._fitToScreen(x, y, parentEl, parentOffset, position);
		
		this.visible = true;
		
		this.subscribe("table-destroy", this.destroyBinding);
		
		this.element.addEventListener("mousedown", (e) => {
			e.stopPropagation();
		});
		
		return this;
	}
	
	_fitToScreen(x, y, parentEl, parentOffset, position){
		var scrollTop = this.container === document.body ? document.documentElement.scrollTop : this.container.scrollTop;
		
		//move menu to start on right edge if it is too close to the edge of the screen
		if((x + this.element.offsetWidth) >= this.container.offsetWidth || this.reversedX){
			this.element.style.left = "";
			
			if(parentEl){
				this.element.style.right = (this.container.offsetWidth - parentOffset.left) + "px";
			}else {
				this.element.style.right = (this.container.offsetWidth - x) + "px";
			}
			
			this.reversedX = true;
		}
		
		//move menu to start on bottom edge if it is too close to the edge of the screen
		let offsetHeight = Math.max(this.container.offsetHeight, scrollTop ? this.container.scrollHeight : 0);
		if((y + this.element.offsetHeight) > offsetHeight) {
			if(parentEl){
				switch(position){
					case "bottom":
						this.element.style.top = (parseInt(this.element.style.top) - this.element.offsetHeight - parentEl.offsetHeight - 1) + "px";
						break;
					
					default:
						this.element.style.top = (parseInt(this.element.style.top) - this.element.offsetHeight + parentEl.offsetHeight + 1) + "px";
				}
				
			}else {
				this.element.style.height = offsetHeight + "px";
			}
		}
	}
	
	isVisible(){
		return this.visible;
	}
	
	hideOnBlur(callback){
		this.blurable = true;
		
		if(this.visible){
			setTimeout(() => {
				if(this.visible){
					this.table.rowManager.element.addEventListener("scroll", this.blurEvent);
					this.subscribe("cell-editing", this.blurEvent);
					document.body.addEventListener("click", this.blurEvent);
					document.body.addEventListener("contextmenu", this.blurEvent);
					document.body.addEventListener("mousedown", this.blurEvent);
					window.addEventListener("resize", this.blurEvent);
					document.body.addEventListener("keydown", this.escEvent);

					this.blurEventsBound = true;
				}
			}, 100);
			
			this.blurCallback = callback;
		}
		
		return this;
	}
	
	_escapeCheck(e){
		if(e.keyCode == 27){
			this.hide();
		}
	}
	
	blockHide(){
		this.hideable = false;
	}
	
	restoreHide(){
		this.hideable = true;
	}
	
	hide(silent = false){
		if(this.visible && this.hideable){
			if(this.blurable && this.blurEventsBound){
				document.body.removeEventListener("keydown", this.escEvent);
				document.body.removeEventListener("click", this.blurEvent);
				document.body.removeEventListener("contextmenu", this.blurEvent);
				document.body.removeEventListener("mousedown", this.blurEvent);
				window.removeEventListener("resize", this.blurEvent);
				this.table.rowManager.element.removeEventListener("scroll", this.blurEvent);
				this.unsubscribe("cell-editing", this.blurEvent);

				this.blurEventsBound = false;
			}
			
			if(this.childPopup){
				this.childPopup.hide();
			}
			
			if(this.parent){
				this.parent.childPopup = null;
			}
			
			if(this.element.parentNode){
				this.element.parentNode.removeChild(this.element);
			}
			
			this.visible = false;
			
			if(this.blurCallback && !silent){
				this.blurCallback();
			}
			
			this.unsubscribe("table-destroy", this.destroyBinding);
		}
		
		return this;
	}
	
	child(element){
		if(this.childPopup){
			this.childPopup.hide();
		}
		
		this.childPopup = new Popup(this.table, element, this);
		
		return this.childPopup;
	}
}

class Module extends CoreFeature{
	
	constructor(table, name){
		super(table);
		
		this._handler = null;
	}
	
	initialize(){
		// setup module when table is initialized, to be overridden in module
	}
	
	
	///////////////////////////////////
	////// Options Registration ///////
	///////////////////////////////////
	
	registerTableOption(key, value){
		this.table.optionsList.register(key, value);
	}
	
	registerColumnOption(key, value){
		this.table.columnManager.optionsList.register(key, value);
	}
	
	///////////////////////////////////
	/// Public Function Registration ///
	///////////////////////////////////
	
	registerTableFunction(name, func){
		if(typeof this.table[name] === "undefined"){
			this.table[name] = (...args) => {
				this.table.initGuard(name);
				
				return func(...args);
			};
		}else {
			console.warn("Unable to bind table function, name already in use", name);
		}
	}
	
	registerComponentFunction(component, func, handler){
		return this.table.componentFunctionBinder.bind(component, func, handler);
	}
	
	///////////////////////////////////
	////////// Data Pipeline //////////
	///////////////////////////////////
	
	registerDataHandler(handler, priority){
		this.table.rowManager.registerDataPipelineHandler(handler, priority);
		this._handler = handler;
	}
	
	registerDisplayHandler(handler, priority){
		this.table.rowManager.registerDisplayPipelineHandler(handler, priority);
		this._handler = handler;
	}
	
	displayRows(adjust){
		var index = this.table.rowManager.displayRows.length - 1, 
		lookupIndex;
		
		if(this._handler){
			lookupIndex = this.table.rowManager.displayPipeline.findIndex((item) => {
				return item.handler === this._handler;
			});

			if(lookupIndex > -1){
				index = lookupIndex;
			}
		}
		
		if(adjust){
			index = index + adjust;
		}

		if(this._handler){
			if(index > -1){
				return this.table.rowManager.getDisplayRows(index);
			}else {
				return this.activeRows();
			}
		}	
	}
	
	activeRows(){
		return this.table.rowManager.activeRows;
	}
	
	refreshData(renderInPosition, handler){
		if(!handler){
			handler = this._handler;
		}
		
		if(handler){
			this.table.rowManager.refreshActiveData(handler, false, renderInPosition);
		}
	}
	
	///////////////////////////////////
	//////// Footer Management ////////
	///////////////////////////////////
	
	footerAppend(element){
		return this.table.footerManager.append(element);
	}
	
	footerPrepend(element){
		return this.table.footerManager.prepend(element);
	}
	
	footerRemove(element){
		return this.table.footerManager.remove(element);
	} 
	
	///////////////////////////////////
	//////// Popups Management ////////
	///////////////////////////////////
	
	popup(menuEl, menuContainer){
		return new Popup(this.table, menuEl, menuContainer);
	}
	
	///////////////////////////////////
	//////// Alert Management ////////
	///////////////////////////////////
	
	alert(content, type){
		return this.table.alertManager.alert(content, type);
	}
	
	clearAlert(){
		return this.table.alertManager.clear();
	}
	
}

var defaultConfig = {
	method: "GET",
};

function generateParamsList$1(data, prefix){
	var output = [];

	prefix = prefix || "";

	if(Array.isArray(data)){
		data.forEach((item, i) => {
			output = output.concat(generateParamsList$1(item, prefix ? prefix + "[" + i + "]" : i));
		});
	}else if (typeof data === "object"){
		for (var key in data){
			output = output.concat(generateParamsList$1(data[key], prefix ? prefix + "[" + key + "]" : key));
		}
	}else {
		output.push({key:prefix, value:data});
	}

	return output;
}

function serializeParams(params){
	var output = generateParamsList$1(params),
	encoded = [];

	output.forEach(function(item){
		encoded.push(encodeURIComponent(item.key) + "=" + encodeURIComponent(item.value));
	});

	return encoded.join("&");
}

function defaultURLGenerator(url, config, params){
	if(url){
		if(params && Object.keys(params).length){
			if(!config.method || config.method.toLowerCase() == "get"){
				config.method = "get";

				url += (url.includes("?") ? "&" : "?") + serializeParams(params);
			}
		}
	}

	return url;
}

function defaultLoaderPromise(url, config, params){
	var contentType;

	return new Promise((resolve, reject) => {
		//set url
		url = this.urlGenerator.call(this.table, url, config, params);

		//set body content if not GET request
		if(config.method.toUpperCase() != "GET"){
			contentType = typeof this.table.options.ajaxContentType === "object" ?  this.table.options.ajaxContentType : this.contentTypeFormatters[this.table.options.ajaxContentType];
			if(contentType){

				for(var key in contentType.headers){
					if(!config.headers){
						config.headers = {};
					}

					if(typeof config.headers[key] === "undefined"){
						config.headers[key] = contentType.headers[key];
					}
				}

				config.body = contentType.body.call(this, url, config, params);

			}else {
				console.warn("Ajax Error - Invalid ajaxContentType value:", this.table.options.ajaxContentType);
			}
		}

		if(url){
			//configure headers
			if(typeof config.headers === "undefined"){
				config.headers = {};
			}

			if(typeof config.headers.Accept === "undefined"){
				config.headers.Accept = "application/json";
			}

			if(typeof config.headers["X-Requested-With"] === "undefined"){
				config.headers["X-Requested-With"] = "XMLHttpRequest";
			}

			if(typeof config.mode === "undefined"){
				config.mode = "cors";
			}

			if(config.mode == "cors"){
				if(typeof config.headers["Origin"] === "undefined"){
					config.headers["Origin"] = window.location.origin;
				}
        
				if(typeof config.credentials === "undefined"){
					config.credentials = 'same-origin';
				}
			}else {
				if(typeof config.credentials === "undefined"){
					config.credentials = 'include';
				}
			}

			//send request
			fetch(url, config)
				.then((response)=>{
					if(response.ok) {
						response.json()
							.then((data)=>{
								resolve(data);
							}).catch((error)=>{
								reject(error);
								console.warn("Ajax Load Error - Invalid JSON returned", error);
							});
					}else {
						console.error("Ajax Load Error - Connection Error: " + response.status, response.statusText);
						reject(response);
					}
				})
				.catch((error)=>{
					console.error("Ajax Load Error - Connection Error: ", error);
					reject(error);
				});
		}else {
			console.warn("Ajax Load Error - No URL Set");
			resolve([]);
		}
	});
}

function generateParamsList(data, prefix){
	var output = [];

	prefix = prefix || "";

	if(Array.isArray(data)){
		data.forEach((item, i) => {
			output = output.concat(generateParamsList(item, prefix ? prefix + "[" + i + "]" : i));
		});
	}else if (typeof data === "object"){
		for (var key in data){
			output = output.concat(generateParamsList(data[key], prefix ? prefix + "[" + key + "]" : key));
		}
	}else {
		output.push({key:prefix, value:data});
	}

	return output;
}

var defaultContentTypeFormatters = {
	"json":{
		headers:{
			'Content-Type': 'application/json',
		},
		body:function(url, config, params){
			return JSON.stringify(params);
		},
	},
	"form":{
		headers:{
		},
		body:function(url, config, params){

			var output = generateParamsList(params),
			form = new FormData();

			output.forEach(function(item){
				form.append(item.key, item.value);
			});

			return form;
		},
	},
};

class Ajax extends Module{

	static moduleName = "ajax";

	//load defaults
	static defaultConfig = defaultConfig;
	static defaultURLGenerator = defaultURLGenerator;
	static defaultLoaderPromise = defaultLoaderPromise;
	static contentTypeFormatters = defaultContentTypeFormatters;
	
	constructor(table){
		super(table);
		
		this.config = {}; //hold config object for ajax request
		this.url = ""; //request URL
		this.urlGenerator = false;
		this.params = false; //request parameters
		
		this.loaderPromise = false;
		
		this.registerTableOption("ajaxURL", false); //url for ajax loading
		this.registerTableOption("ajaxURLGenerator", false);
		this.registerTableOption("ajaxParams", {});  //params for ajax loading
		this.registerTableOption("ajaxConfig", "get"); //ajax request type
		this.registerTableOption("ajaxContentType", "form"); //ajax request type
		this.registerTableOption("ajaxRequestFunc", false); //promise function
		
		this.registerTableOption("ajaxRequesting", function(){});
		this.registerTableOption("ajaxResponse", false);
		
		this.contentTypeFormatters = Ajax.contentTypeFormatters;
	}
	
	//initialize setup options
	initialize(){
		this.loaderPromise = this.table.options.ajaxRequestFunc || Ajax.defaultLoaderPromise;
		this.urlGenerator = this.table.options.ajaxURLGenerator || Ajax.defaultURLGenerator;
		
		if(this.table.options.ajaxURL){
			this.setUrl(this.table.options.ajaxURL);
		}


		this.setDefaultConfig(this.table.options.ajaxConfig);
		
		this.registerTableFunction("getAjaxUrl", this.getUrl.bind(this));
		
		this.subscribe("data-loading", this.requestDataCheck.bind(this));
		this.subscribe("data-params", this.requestParams.bind(this));
		this.subscribe("data-load", this.requestData.bind(this));
	}
	
	requestParams(data, config, silent, params){
		var ajaxParams = this.table.options.ajaxParams;
		
		if(ajaxParams){
			if(typeof ajaxParams === "function"){
				ajaxParams = ajaxParams.call(this.table);
			}
			
			params = Object.assign(Object.assign({}, ajaxParams), params);
		}		
		
		return params;
	}
	
	requestDataCheck(data, params, config, silent){
		return !!((!data && this.url) || typeof data === "string");
	}
	
	requestData(url, params, config, silent, previousData){
		var ajaxConfig;
		
		if(!previousData && this.requestDataCheck(url)){
			if(url){
				this.setUrl(url);
			}
			
			ajaxConfig = this.generateConfig(config);
			
			return this.sendRequest(this.url, params, ajaxConfig);
		}else {
			return previousData;
		}
	}
	
	setDefaultConfig(config = {}){
		this.config = Object.assign({}, Ajax.defaultConfig);

		if(typeof config == "string"){
			this.config.method = config;
		}else {
			Object.assign(this.config, config);
		}
	}
	
	//load config object
	generateConfig(config = {}){
		var ajaxConfig = Object.assign({}, this.config);
		
		if(typeof config == "string"){
			ajaxConfig.method = config;
		}else {
			Object.assign(ajaxConfig, config);
		}
		
		return ajaxConfig;
	}
	
	//set request url
	setUrl(url){
		this.url = url;
	}
	
	//get request url
	getUrl(){
		return this.url;
	}
	
	//send ajax request
	sendRequest(url, params, config){
		if(this.table.options.ajaxRequesting.call(this.table, url, params) !== false){
			return this.loaderPromise(url, config, params)
				.then((data)=>{
					if(this.table.options.ajaxResponse){
						data = this.table.options.ajaxResponse.call(this.table, url, params, data);
					}
				
					return data;
				});
		}else {
			return Promise.reject();
		}
	}
}

function plaintext(cell, formatterParams, onRendered){
	return this.emptyToSpace(this.sanitizeHTML(cell.getValue()));
}

function html(cell, formatterParams, onRendered){
	return cell.getValue();
}

function textarea(cell, formatterParams, onRendered){
	cell.getElement().style.whiteSpace = "pre-wrap";
	return this.emptyToSpace(this.sanitizeHTML(cell.getValue()));
}

function money(cell, formatterParams, onRendered){
	var floatVal = parseFloat(cell.getValue()),
	sign = "",
	number, integer, decimal, rgx, value;

	var decimalSym = formatterParams.decimal || ".";
	var thousandSym = formatterParams.thousand || ",";
	var negativeSign = formatterParams.negativeSign || "-";
	var symbol = formatterParams.symbol || "";
	var after = !!formatterParams.symbolAfter;
	var precision = typeof formatterParams.precision !== "undefined" ? formatterParams.precision : 2;

	if(isNaN(floatVal)){
		return this.emptyToSpace(this.sanitizeHTML(cell.getValue()));
	}

	if(floatVal < 0){
		floatVal = Math.abs(floatVal);
		sign = negativeSign;
	}

	number = precision !== false ? floatVal.toFixed(precision) : floatVal;
	number = String(number).split(".");

	integer = number[0];
	decimal = number.length > 1 ? decimalSym + number[1] : "";

	if (formatterParams.thousand !== false) {
		rgx = /(\d+)(\d{3})/;

		while (rgx.test(integer)){
			integer = integer.replace(rgx, "$1" + thousandSym + "$2");
		}
	}

	value = integer + decimal;
	
	if(sign === true){
		value = "(" + value  + ")";
		return after ? value + symbol : symbol + value;
	}else {
		return after ? sign + value + symbol : sign + symbol + value;
	}
}

function link(cell, formatterParams, onRendered) {
	var value = cell.getValue(),
	urlPrefix = formatterParams.urlPrefix || "",
	download = formatterParams.download,
	label = value,
	el = document.createElement("a"),
	data;

	function labelTraverse(path, data) {
		var item = path.shift(),
		value = data[item];

		if (path.length && typeof value === "object") {
			return labelTraverse(path, value);
		}

		return value;
	}

	if (formatterParams.labelField) {
		data = cell.getData();
		label = labelTraverse(formatterParams.labelField.split(this.table.options.nestedFieldSeparator), data);
	}

	if (formatterParams.label) {
		switch (typeof formatterParams.label) {
			case "string":
				label = formatterParams.label;
				break;

			case "function":
				label = formatterParams.label(cell);
				break;
		}
	}

	if (label) {
		if (formatterParams.urlField) {
			data = cell.getData();

			value = Helpers.retrieveNestedData(this.table.options.nestedFieldSeparator, formatterParams.urlField, data);
		}

		if (formatterParams.url) {
			switch (typeof formatterParams.url) {
				case "string":
					value = formatterParams.url;
					break;

				case "function":
					value = formatterParams.url(cell);
					break;
			}
		}

		el.setAttribute("href", urlPrefix + value);

		if (formatterParams.target) {
			el.setAttribute("target", formatterParams.target);
		}

		if (formatterParams.download) {

			if (typeof download == "function") {
				download = download(cell);
			} else {
				download = download === true ? "" : download;
			}

			el.setAttribute("download", download);
		}

		el.innerHTML = this.emptyToSpace(this.sanitizeHTML(label));

		return el;
	} else {
		return "&#8203;";
	}
}

function image(cell, formatterParams, onRendered){
	var el = document.createElement("img"),
	src = cell.getValue();

	if(formatterParams.urlPrefix){
		src = formatterParams.urlPrefix + cell.getValue();
	}

	if(formatterParams.urlSuffix){
		src = src + formatterParams.urlSuffix;
	}

	el.setAttribute("src", src);

	switch(typeof formatterParams.height){
		case "number":
			el.style.height = formatterParams.height + "px";
			break;

		case "string":
			el.style.height = formatterParams.height;
			break;
	}

	switch(typeof formatterParams.width){
		case "number":
			el.style.width = formatterParams.width + "px";
			break;

		case "string":
			el.style.width = formatterParams.width;
			break;
	}

	el.addEventListener("load", function(){
		cell.getRow().normalizeHeight();
	});

	return el;
}

function tickCross(cell, formatterParams, onRendered){
	var value = cell.getValue(),
	element = cell.getElement(),
	empty = formatterParams.allowEmpty,
	truthy = formatterParams.allowTruthy,
	trueValueSet = Object.keys(formatterParams).includes("trueValue"),
	tick = typeof formatterParams.tickElement !== "undefined" ? formatterParams.tickElement : '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" ><path fill="#5ac262" clip-rule="evenodd" d="M21.652,3.211c-0.293-0.295-0.77-0.295-1.061,0L9.41,14.34  c-0.293,0.297-0.771,0.297-1.062,0L3.449,9.351C3.304,9.203,3.114,9.13,2.923,9.129C2.73,9.128,2.534,9.201,2.387,9.351  l-2.165,1.946C0.078,11.445,0,11.63,0,11.823c0,0.194,0.078,0.397,0.223,0.544l4.94,5.184c0.292,0.296,0.771,0.776,1.062,1.07  l2.124,2.141c0.292,0.293,0.769,0.293,1.062,0l14.366-14.34c0.293-0.294,0.293-0.777,0-1.071L21.652,3.211z" fill-rule="evenodd"/></svg>',
	cross = typeof formatterParams.crossElement !== "undefined" ? formatterParams.crossElement : '<svg enable-background="new 0 0 24 24" height="14" width="14"  viewBox="0 0 24 24" xml:space="preserve" ><path fill="#d74c4c" d="M22.245,4.015c0.313,0.313,0.313,0.826,0,1.139l-6.276,6.27c-0.313,0.312-0.313,0.826,0,1.14l6.273,6.272  c0.313,0.313,0.313,0.826,0,1.14l-2.285,2.277c-0.314,0.312-0.828,0.312-1.142,0l-6.271-6.271c-0.313-0.313-0.828-0.313-1.141,0  l-6.276,6.267c-0.313,0.313-0.828,0.313-1.141,0l-2.282-2.28c-0.313-0.313-0.313-0.826,0-1.14l6.278-6.269  c0.313-0.312,0.313-0.826,0-1.14L1.709,5.147c-0.314-0.313-0.314-0.827,0-1.14l2.284-2.278C4.308,1.417,4.821,1.417,5.135,1.73  L11.405,8c0.314,0.314,0.828,0.314,1.141,0.001l6.276-6.267c0.312-0.312,0.826-0.312,1.141,0L22.245,4.015z"/></svg>';

	if((trueValueSet && value === formatterParams.trueValue) || (!trueValueSet && ((truthy && value) || (value === true || value === "true" || value === "True" || value === 1 || value === "1")))){
		element.setAttribute("aria-checked", true);
		return tick || "";
	}else {
		if(empty && (value === "null" || value === "" || value === null || typeof value === "undefined")){
			element.setAttribute("aria-checked", "mixed");
			return "";
		}else {
			element.setAttribute("aria-checked", false);
			return cross || "";
		}
	}
}

function datetime$1(cell, formatterParams, onRendered){
	var DT = this.table.dependencyRegistry.lookup(["luxon", "DateTime"], "DateTime");
	var inputFormat = formatterParams.inputFormat || "yyyy-MM-dd HH:mm:ss";
	var	outputFormat = formatterParams.outputFormat || "dd/MM/yyyy HH:mm:ss";
	var	invalid = typeof formatterParams.invalidPlaceholder !== "undefined" ? formatterParams.invalidPlaceholder : "";
	var value = cell.getValue();

	if(typeof DT != "undefined"){
		var newDatetime;

		if(DT.isDateTime(value)){
			newDatetime = value;
		}else if(inputFormat === "iso"){
			newDatetime = DT.fromISO(String(value));
		}else {
			newDatetime = DT.fromFormat(String(value), inputFormat);
		}

		if(newDatetime.isValid){
			if(formatterParams.timezone){
				newDatetime = newDatetime.setZone(formatterParams.timezone);
			}

			return newDatetime.toFormat(outputFormat);
		}else {
			if(invalid === true || !value){
				return value;
			}else if(typeof invalid === "function"){
				return invalid(value);
			}else {
				return invalid;
			}
		}
	}else {
		console.error("Format Error - 'datetime' formatter is dependant on luxon.js");
	}
}

function datetimediff (cell, formatterParams, onRendered) {
	var DT = this.table.dependencyRegistry.lookup(["luxon", "DateTime"], "DateTime");
	var inputFormat = formatterParams.inputFormat || "yyyy-MM-dd HH:mm:ss";
	var invalid = typeof formatterParams.invalidPlaceholder !== "undefined" ? formatterParams.invalidPlaceholder : "";
	var suffix = typeof formatterParams.suffix !== "undefined" ? formatterParams.suffix : false;
	var unit = typeof formatterParams.unit !== "undefined" ? formatterParams.unit : "days";
	var humanize = typeof formatterParams.humanize !== "undefined" ? formatterParams.humanize : false;
	var date = typeof formatterParams.date !== "undefined" ? formatterParams.date : DT.now();
	var value = cell.getValue();

	if(typeof DT != "undefined"){
		var newDatetime;

		if(DT.isDateTime(value)){
			newDatetime = value;
		}else if(inputFormat === "iso"){
			newDatetime = DT.fromISO(String(value));
		}else {
			newDatetime = DT.fromFormat(String(value), inputFormat);
		}

		if (newDatetime.isValid){
			if(humanize){
				return newDatetime.diff(date, unit).toHuman()  + (suffix ? " " + suffix : "");
			}else {
				return parseInt(newDatetime.diff(date, unit)[unit]) + (suffix ? " " + suffix : "");
			}
		} else {

			if (invalid === true) {
				return value;
			} else if (typeof invalid === "function") {
				return invalid(value);
			} else {
				return invalid;
			}
		}
	}else {
		console.error("Format Error - 'datetimediff' formatter is dependant on luxon.js");
	}
}

function lookup (cell, formatterParams, onRendered) {
	var value = cell.getValue();

	if (typeof formatterParams[value] === "undefined") {
		console.warn('Missing display value for ' + value);
		return value;
	}

	return formatterParams[value];
}

function star(cell, formatterParams, onRendered) {
	var value = cell.getValue(),
	element = cell.getElement(),
	maxStars = formatterParams && formatterParams.stars ? formatterParams.stars : 5,
	stars = document.createElement("span"),
	star = document.createElementNS('http://www.w3.org/2000/svg', "svg"),
	starActive = '<polygon fill="#ffa500" stroke="#C1AB60" stroke-width="37.6152" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points="259.216,29.942 330.27,173.919 489.16,197.007 374.185,309.08 401.33,467.31 259.216,392.612 117.104,467.31 144.25,309.08 29.274,197.007 188.165,173.919 "/>',
	starInactive = '<polygon fill="#D2D2D2" stroke="#686868" stroke-width="37.6152" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points="259.216,29.942 330.27,173.919 489.16,197.007 374.185,309.08 401.33,467.31 259.216,392.612 117.104,467.31 144.25,309.08 29.274,197.007 188.165,173.919 "/>';

	//style stars holder
	stars.style.verticalAlign = "middle";

	//style star
	star.setAttribute("width", "16");
	star.setAttribute("height", "16");
	star.setAttribute("viewBox", "0 0 512 512");
	star.setAttribute("xml:space", "preserve");
	star.style.padding = "0 1px";

	value = value && !isNaN(value) ? parseInt(value) : 0;

	value = Math.max(0, Math.min(value, maxStars));

	for (var i = 1; i <= maxStars; i++) {
		var nextStar = star.cloneNode(true);
		nextStar.innerHTML = i <= value ? starActive : starInactive;

		stars.appendChild(nextStar);
	}

	element.style.whiteSpace = "nowrap";
	element.style.overflow = "hidden";
	element.style.textOverflow = "ellipsis";

	element.setAttribute("aria-label", value);

	return stars;
}

function traffic(cell, formatterParams, onRendered){
	var value = this.sanitizeHTML(cell.getValue()) || 0,
	el = document.createElement("span"),
	max = formatterParams && formatterParams.max ? formatterParams.max : 100,
	min = formatterParams && formatterParams.min ? formatterParams.min : 0,
	colors = formatterParams && typeof formatterParams.color !== "undefined" ? formatterParams.color : ["red", "orange", "green"],
	color = "#666666",
	percent, percentValue;

	if(isNaN(value) || typeof cell.getValue() === "undefined"){
		return;
	}

	el.classList.add("tabulator-traffic-light");

	//make sure value is in range
	percentValue = parseFloat(value) <= max ? parseFloat(value) : max;
	percentValue = parseFloat(percentValue) >= min ? parseFloat(percentValue) : min;

	//workout percentage
	percent = (max - min) / 100;
	percentValue = Math.round((percentValue - min) / percent);

	//set color
	switch(typeof colors){
		case "string":
			color = colors;
			break;
		case "function":
			color = colors(value);
			break;
		case "object":
			if(Array.isArray(colors)){
				var unit = 100 / colors.length;
				var index = Math.floor(percentValue / unit);

				index = Math.min(index, colors.length - 1);
				index = Math.max(index, 0);
				color = colors[index];
				break;
			}
	}

	el.style.backgroundColor = color;

	return el;
}

//public cell object
class CellComponent {

	constructor (cell){
		this._cell = cell;

		return new Proxy(this, {
			get: function(target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				}else {
					return target._cell.table.componentFunctionBinder.handle("cell", target._cell, name);
				}
			}
		});
	}

	getValue(){
		return this._cell.getValue();
	}

	getOldValue(){
		return this._cell.getOldValue();
	}

	getInitialValue(){
		return this._cell.initialValue;
	}

	getElement(){
		return this._cell.getElement();
	}

	getRow(){
		return this._cell.row.getComponent();
	}

	getData(transform){
		return this._cell.row.getData(transform);
	}
	getType(){
		return "cell";
	}
	getField(){
		return this._cell.column.getField();
	}

	getColumn(){
		return this._cell.column.getComponent();
	}

	setValue(value, mutate){
		if(typeof mutate == "undefined"){
			mutate = true;
		}

		this._cell.setValue(value, mutate);
	}

	restoreOldValue(){
		this._cell.setValueActual(this._cell.getOldValue());
	}

	restoreInitialValue(){
		this._cell.setValueActual(this._cell.initialValue);
	}

	checkHeight(){
		this._cell.checkHeight();
	}

	getTable(){
		return this._cell.table;
	}

	_getSelf(){
		return this._cell;
	}
}

function progress(cell, formatterParams = {}, onRendered) { //progress bar
	var value = this.sanitizeHTML(cell.getValue()) || 0,
	element = cell.getElement(),
	max = formatterParams.max ? formatterParams.max : 100,
	min = formatterParams.min ? formatterParams.min : 0,
	legendAlign = formatterParams.legendAlign ? formatterParams.legendAlign : "center",
	percent, percentValue, color, legend, legendColor;

	//make sure value is in range
	percentValue = parseFloat(value) <= max ? parseFloat(value) : max;
	percentValue = parseFloat(percentValue) >= min ? parseFloat(percentValue) : min;

	//workout percentage
	percent = (max - min) / 100;
	percentValue = Math.round((percentValue - min) / percent);

	//set bar color
	switch (typeof formatterParams.color) {
		case "string":
			color = formatterParams.color;
			break;
		case "function":
			color = formatterParams.color(value);
			break;
		case "object":
			if (Array.isArray(formatterParams.color)) {
				let unit = 100 / formatterParams.color.length;
				let index = Math.floor(percentValue / unit);

				index = Math.min(index, formatterParams.color.length - 1);
				index = Math.max(index, 0);
				color = formatterParams.color[index];
				break;
			}
		default:
			color = "#5ac262";
	}

	//generate legend
	switch (typeof formatterParams.legend) {
		case "string":
			legend = formatterParams.legend;
			break;
		case "function":
			legend = formatterParams.legend(value);
			break;
		case "boolean":
			legend = value;
			break;
		default:
			legend = false;
	}

	//set legend color
	switch (typeof formatterParams.legendColor) {
		case "string":
			legendColor = formatterParams.legendColor;
			break;
		case "function":
			legendColor = formatterParams.legendColor(value);
			break;
		case "object":
			if (Array.isArray(formatterParams.legendColor)) {
				let unit = 100 / formatterParams.legendColor.length;
				let index = Math.floor(percentValue / unit);

				index = Math.min(index, formatterParams.legendColor.length - 1);
				index = Math.max(index, 0);
				legendColor = formatterParams.legendColor[index];
			}
			break;
		default:
			legendColor = "#000";
	}

	element.style.minWidth = "30px";
	element.style.position = "relative";

	element.setAttribute("aria-label", percentValue);

	var barEl = document.createElement("div");
	barEl.style.display = "inline-block";
	barEl.style.width = percentValue + "%";
	barEl.style.backgroundColor = color;
	barEl.style.height = "100%";

	barEl.setAttribute('data-max', max);
	barEl.setAttribute('data-min', min);

	var barContainer = document.createElement("div");
	barContainer.style.position = "relative";
	barContainer.style.width = "100%";
	barContainer.style.height = "100%";

	if (legend) {
		var legendEl = document.createElement("div");
		legendEl.style.position = "absolute";
		legendEl.style.top = 0;
		legendEl.style.left = 0;
		legendEl.style.textAlign = legendAlign;
		legendEl.style.width = "100%";
		legendEl.style.color = legendColor;
		legendEl.innerHTML = legend;
	}

	onRendered(function() {

		//handle custom element needed if formatter is to be included in printed/downloaded output
		if (!(cell instanceof CellComponent)) {
			var holderEl = document.createElement("div");
			holderEl.style.position = "absolute";
			holderEl.style.top = "4px";
			holderEl.style.bottom = "4px";
			holderEl.style.left = "4px";
			holderEl.style.right = "4px";
			element.appendChild(holderEl);
			element = holderEl;
		} else {
			element.innerHTML = "";
		}
		element.appendChild(barContainer);
		barContainer.appendChild(barEl);

		if (legend) {
			barContainer.appendChild(legendEl);
		}
	});

	return "";
}

function color(cell, formatterParams, onRendered){
	cell.getElement().style.backgroundColor = this.sanitizeHTML(cell.getValue());
	return "";
}

function buttonTick(cell, formatterParams, onRendered){
	return '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" ><path fill="#5ac262" clip-rule="evenodd" d="M21.652,3.211c-0.293-0.295-0.77-0.295-1.061,0L9.41,14.34  c-0.293,0.297-0.771,0.297-1.062,0L3.449,9.351C3.304,9.203,3.114,9.13,2.923,9.129C2.73,9.128,2.534,9.201,2.387,9.351  l-2.165,1.946C0.078,11.445,0,11.63,0,11.823c0,0.194,0.078,0.397,0.223,0.544l4.94,5.184c0.292,0.296,0.771,0.776,1.062,1.07  l2.124,2.141c0.292,0.293,0.769,0.293,1.062,0l14.366-14.34c0.293-0.294,0.293-0.777,0-1.071L21.652,3.211z" fill-rule="evenodd"/></svg>';
}

function buttonCross(cell, formatterParams, onRendered){
	return '<svg enable-background="new 0 0 24 24" height="14" width="14" viewBox="0 0 24 24" xml:space="preserve" ><path fill="#d74c4c" d="M22.245,4.015c0.313,0.313,0.313,0.826,0,1.139l-6.276,6.27c-0.313,0.312-0.313,0.826,0,1.14l6.273,6.272  c0.313,0.313,0.313,0.826,0,1.14l-2.285,2.277c-0.314,0.312-0.828,0.312-1.142,0l-6.271-6.271c-0.313-0.313-0.828-0.313-1.141,0  l-6.276,6.267c-0.313,0.313-0.828,0.313-1.141,0l-2.282-2.28c-0.313-0.313-0.313-0.826,0-1.14l6.278-6.269  c0.313-0.312,0.313-0.826,0-1.14L1.709,5.147c-0.314-0.313-0.314-0.827,0-1.14l2.284-2.278C4.308,1.417,4.821,1.417,5.135,1.73  L11.405,8c0.314,0.314,0.828,0.314,1.141,0.001l6.276-6.267c0.312-0.312,0.826-0.312,1.141,0L22.245,4.015z"/></svg>';
}

function toggle(cell, formatterParams, onRendered){
	var value = cell.getValue(),
	size = formatterParams.size ||15,
	sizePx = size + "px",
	containEl, switchEl,
	onValue = formatterParams.hasOwnProperty("onValue") ? formatterParams.onValue : true,
	offValue = formatterParams.hasOwnProperty("offValue") ? formatterParams.offValue : false,


	state = formatterParams.onTruthy ? value : value === onValue;

	
	containEl = document.createElement("div");
	containEl.classList.add("tabulator-toggle");

	if(state){
		containEl.classList.add("tabulator-toggle-on");
		containEl.style.flexDirection = "row-reverse";

		if(formatterParams.onColor){
			containEl.style.background = formatterParams.onColor;
		}
	}else {
		if(formatterParams.offColor){
			containEl.style.background = formatterParams.offColor;
		}
	}

	containEl.style.width = (2.5 * size) + "px";
	containEl.style.borderRadius = sizePx;

	if(formatterParams.clickable){
		containEl.addEventListener("click", (e) => {
			cell.setValue(state ? offValue : onValue);
		});
	}

	switchEl = document.createElement("div");
	switchEl.classList.add("tabulator-toggle-switch");

	switchEl.style.height = sizePx;
	switchEl.style.width = sizePx;
	switchEl.style.borderRadius = sizePx;
	
	containEl.appendChild(switchEl);
	
	return containEl;
}

function rownum(cell, formatterParams, onRendered){
	var content = document.createElement("span");
	var row = cell.getRow();
	var table = cell.getTable();

	row.watchPosition((position) => {
		if (formatterParams.relativeToPage) {
			position += table.modules.page.getPageSize() * (table.modules.page.getPage() - 1);
		}
		content.innerText = position;
	});
	
	return content;
}

function handle(cell, formatterParams, onRendered){
	cell.getElement().classList.add("tabulator-row-handle");
	return "<div class='tabulator-row-handle-box'><div class='tabulator-row-handle-bar'></div><div class='tabulator-row-handle-bar'></div><div class='tabulator-row-handle-bar'></div></div>";
}

function adaptable(cell, params, onRendered){
	var lookup, formatterFunc, formatterParams;
    
	function defaultLookup(cell){
		var value = cell.getValue(),
		formatter = "plaintext";
        
		switch(typeof value){           
			case "boolean":
				formatter = "tickCross";
				break;
            
			case "string":
				if(value.includes("\n")){
					formatter = "textarea";
				}
				break;
		}
        
		return formatter;
	}
    
	lookup = params.formatterLookup ? params.formatterLookup(cell) : defaultLookup(cell);

	if(params.paramsLookup){
		formatterParams = typeof params.paramsLookup === "function" ? params.paramsLookup(lookup, cell) : params.paramsLookup[lookup];
	}

	formatterFunc = this.table.modules.format.lookupFormatter(lookup);
    
	return  formatterFunc.call(this, cell, formatterParams || {}, onRendered);
}

function array$1(cell, formatterParams, onRendered){
	var delimiter = formatterParams.delimiter || ",",
	value = cell.getValue(),
	table = this.table,
	valueMap;
	
	if(formatterParams.valueMap){
		if(typeof formatterParams.valueMap === "string"){
			valueMap = function(value){
				return value.map((item) => {
					return Helpers.retrieveNestedData(table.options.nestedFieldSeparator, formatterParams.valueMap, item);
				});
			};
		}else {
			valueMap = formatterParams.valueMap;
		}
	}

	if(Array.isArray(value)){
		if(valueMap){
			value = valueMap(value);
		}

		return value.join(delimiter);
	}else {
		return value;
	}
}

function json(cell, formatterParams, onRendered){
	var indent = formatterParams.indent || "\t",
	multiline = typeof formatterParams.multiline === "undefined" ? true : formatterParams.multiline,
	replacer = formatterParams.replacer || null,
	value = cell.getValue();
	
	if(multiline){
		cell.getElement().style.whiteSpace = "pre-wrap";
	}

	return JSON.stringify(value, replacer, indent);
}

var defaultFormatters = {
	plaintext:plaintext,
	html:html,
	textarea:textarea,
	money:money,
	link:link,
	image:image,
	tickCross:tickCross,
	datetime:datetime$1,
	datetimediff:datetimediff,
	lookup:lookup,
	star:star,
	traffic:traffic,
	progress:progress,
	color:color,
	buttonTick:buttonTick,
	buttonCross:buttonCross,
	toggle:toggle,
	rownum:rownum,
	handle:handle,
	adaptable:adaptable,
	array:array$1,
	json:json,
};

class Format extends Module {

	static moduleName = "format";

	//load defaults
	static formatters = defaultFormatters;

	constructor(table) {
		super(table);

		this.registerColumnOption("formatter");
		this.registerColumnOption("formatterParams");

		this.registerColumnOption("formatterPrint");
		this.registerColumnOption("formatterPrintParams");
		this.registerColumnOption("formatterClipboard");
		this.registerColumnOption("formatterClipboardParams");
		this.registerColumnOption("formatterHtmlOutput");
		this.registerColumnOption("formatterHtmlOutputParams");
		this.registerColumnOption("titleFormatter");
		this.registerColumnOption("titleFormatterParams");
	}

	initialize() {
		this.subscribe("cell-format", this.formatValue.bind(this));
		this.subscribe("cell-rendered", this.cellRendered.bind(this));
		this.subscribe("column-layout", this.initializeColumn.bind(this));
		this.subscribe("column-format", this.formatHeader.bind(this));
	}

	//initialize column formatter
	initializeColumn(column) {
		column.modules.format = this.lookupTypeFormatter(column, "");

		if (typeof column.definition.formatterPrint !== "undefined") {
			column.modules.format.print = this.lookupTypeFormatter(column, "Print");
		}

		if (typeof column.definition.formatterClipboard !== "undefined") {
			column.modules.format.clipboard = this.lookupTypeFormatter(column, "Clipboard");
		}

		if (typeof column.definition.formatterHtmlOutput !== "undefined") {
			column.modules.format.htmlOutput = this.lookupTypeFormatter(column, "HtmlOutput");
		}
	}

	lookupTypeFormatter(column, type) {
		var config = { params: column.definition["formatter" + type + "Params"] || {} },
		formatter = column.definition["formatter" + type];

		config.formatter = this.lookupFormatter(formatter);

		return config;
	}

	lookupFormatter(formatter) {
		var formatterFunc;

		//set column formatter
		switch (typeof formatter) {
			case "string":
				if (Format.formatters[formatter]) {
					formatterFunc = Format.formatters[formatter];
				} else {
					console.warn("Formatter Error - No such formatter found: ", formatter);
					formatterFunc = Format.formatters.plaintext;
				}
				break;

			case "function":
				formatterFunc = formatter;
				break;

			default:
				formatterFunc = Format.formatters.plaintext;
				break;
		}

		return formatterFunc;
	}

	cellRendered(cell) {
		if (cell.modules.format && cell.modules.format.renderedCallback && !cell.modules.format.rendered) {
			cell.modules.format.renderedCallback();
			cell.modules.format.rendered = true;
		}
	}

	//return a formatted value for a column header
	formatHeader(column, title, el) {
		var formatter, params, onRendered, mockCell;

		if (column.definition.titleFormatter) {
			formatter = this.lookupFormatter(column.definition.titleFormatter);

			onRendered = (callback) => {
				column.titleFormatterRendered = callback;
			};

			mockCell = {
				getValue: function() {
					return title;
				},
				getElement: function() {
					return el;
				},
				getType: function() {
					return "header";
				},
				getColumn: function() {
					return column.getComponent();
				},
				getTable: () => {
					return this.table;
				}
			};

			params = column.definition.titleFormatterParams || {};

			params = typeof params === "function" ? params() : params;

			return formatter.call(this, mockCell, params, onRendered);
		} else {
			return title;
		}
	}

	//return a formatted value for a cell
	formatValue(cell) {
		var component = cell.getComponent(),
		params = typeof cell.column.modules.format.params === "function" ? cell.column.modules.format.params(component) : cell.column.modules.format.params;

		function onRendered(callback) {
			if (!cell.modules.format) {
				cell.modules.format = {};
			}

			cell.modules.format.renderedCallback = callback;
			cell.modules.format.rendered = false;
		}

		return cell.column.modules.format.formatter.call(this, component, params, onRendered);
	}

	formatExportValue(cell, type) {
		var formatter = cell.column.modules.format[type],
		params;

		if (formatter) {
			params = typeof formatter.params === "function" ? formatter.params(cell.getComponent()) : formatter.params;

			function onRendered(callback) {
				if (!cell.modules.format) {
					cell.modules.format = {};
				}

				cell.modules.format.renderedCallback = callback;
				cell.modules.format.rendered = false;
			}

			return formatter.formatter.call(this, cell.getComponent(), params, onRendered);

		} else {
			return this.formatValue(cell);
		}
	}

	sanitizeHTML(value) {
		if (value) {
			var entityMap = {
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
				'/': '&#x2F;',
				'`': '&#x60;',
				'=': '&#x3D;'
			};

			return String(value).replace(/[&<>"'`=/]/g, function(s) {
				return entityMap[s];
			});
		} else {
			return value;
		}
	}

	emptyToSpace(value) {
		return value === null || typeof value === "undefined" || value === "" ? "&#8203;" : value;
	}

}

class FrozenColumns extends Module{

	static moduleName = "frozenColumns";
	
	constructor(table){
		super(table);
		
		this.leftColumns = [];
		this.rightColumns = [];
		this.initializationMode = "left";
		this.active = false;
		this.blocked = true;
		
		this.registerColumnOption("frozen");
	}
	
	//reset initial state
	reset(){
		this.initializationMode = "left";
		this.leftColumns = [];
		this.rightColumns = [];
		this.active = false;
	}
	
	initialize(){
		this.subscribe("cell-layout", this.layoutCell.bind(this));
		this.subscribe("column-init", this.initializeColumn.bind(this));
		this.subscribe("column-width", this.layout.bind(this));
		this.subscribe("row-layout-after", this.layoutRow.bind(this));
		this.subscribe("table-layout", this.layout.bind(this));
		this.subscribe("columns-loading", this.reset.bind(this));
		
		this.subscribe("column-add", this.reinitializeColumns.bind(this));
		this.subscribe("column-deleted", this.reinitializeColumns.bind(this));
		this.subscribe("column-hide", this.reinitializeColumns.bind(this));
		this.subscribe("column-show", this.reinitializeColumns.bind(this));
		this.subscribe("columns-loaded", this.reinitializeColumns.bind(this));
		
		this.subscribe("table-redraw", this.layout.bind(this));
		this.subscribe("layout-refreshing", this.blockLayout.bind(this));
		this.subscribe("layout-refreshed", this.unblockLayout.bind(this));
		this.subscribe("scrollbar-vertical", this.adjustForScrollbar.bind(this));
	}
	
	blockLayout(){
		this.blocked = true;
	}
	
	unblockLayout(){
		this.blocked = false;
	}
	
	layoutCell(cell){
		this.layoutElement(cell.element, cell.column);
	}
	
	reinitializeColumns(){
		this.reset();
		
		this.table.columnManager.columnsByIndex.forEach((column) => {
			this.initializeColumn(column);
		});

		this.layout();
	}
	
	//initialize specific column
	initializeColumn(column){
		var config = {margin:0, edge:false};
		
		if(!column.isGroup){			
			if(this.frozenCheck(column)){
				config.position = this.initializationMode;
				
				if(this.initializationMode == "left"){
					this.leftColumns.push(column);
				}else {
					this.rightColumns.unshift(column);
				}
				
				this.active = true;
				
				column.modules.frozen = config;
			}else {
				this.initializationMode = "right";
			}
		}
	}
	
	frozenCheck(column){
		if(column.parent.isGroup && column.definition.frozen){
			console.warn("Frozen Column Error - Parent column group must be frozen, not individual columns or sub column groups");
		}
		
		if(column.parent.isGroup){
			return this.frozenCheck(column.parent);
		}else {
			return column.definition.frozen;
		}
	}
	
	//layout calculation rows
	layoutCalcRows(){
		if(this.table.modExists("columnCalcs")){
			if(this.table.modules.columnCalcs.topInitialized && this.table.modules.columnCalcs.topRow){
				this.layoutRow(this.table.modules.columnCalcs.topRow);
			}
			
			if(this.table.modules.columnCalcs.botInitialized && this.table.modules.columnCalcs.botRow){
				this.layoutRow(this.table.modules.columnCalcs.botRow);
			}
			
			if(this.table.modExists("groupRows")){
				this.layoutGroupCalcs(this.table.modules.groupRows.getGroups());
			}
		}
	}
	
	layoutGroupCalcs(groups){
		groups.forEach((group) => {
			if(group.calcs.top){
				this.layoutRow(group.calcs.top);
			}
			
			if(group.calcs.bottom){
				this.layoutRow(group.calcs.bottom);
			}
			
			if(group.groupList && group.groupList.length){
				this.layoutGroupCalcs(group.groupList);
			}
		});
	}
	
	//calculate column positions and layout headers
	layoutColumnPosition(allCells){
		var leftParents = [];
		
		var leftMargin = 0;
		var rightMargin = 0;
		
		this.leftColumns.forEach((column, i) => {	
			column.modules.frozen.marginValue = leftMargin;
			column.modules.frozen.margin = column.modules.frozen.marginValue + "px";
			
			if(column.visible){
				leftMargin += column.getWidth();
			}
			
			if(i == this.leftColumns.length - 1){
				column.modules.frozen.edge = true;
			}else {
				column.modules.frozen.edge = false;
			}
			
			if(column.parent.isGroup){
				var parentEl = this.getColGroupParentElement(column);
				if(!leftParents.includes(parentEl)){
					this.layoutElement(parentEl, column);
					leftParents.push(parentEl);
				}
				
				parentEl.classList.toggle("tabulator-frozen-left",  column.modules.frozen.edge && column.modules.frozen.position === "left");
				parentEl.classList.toggle("tabulator-frozen-right", column.modules.frozen.edge && column.modules.frozen.position === "right");
			}else {
				this.layoutElement(column.getElement(), column);
			}
			
			if(allCells){
				column.cells.forEach((cell) => {
					this.layoutElement(cell.getElement(true), column);
				});
			}
		});
		
		this.rightColumns.forEach((column, i) => {
			
			column.modules.frozen.marginValue = rightMargin;
			column.modules.frozen.margin = column.modules.frozen.marginValue + "px";
			
			if(column.visible){
				rightMargin += column.getWidth();
			}
			
			if(i == this.rightColumns.length - 1){
				column.modules.frozen.edge = true;
			}else {
				column.modules.frozen.edge = false;
			}
			
			if(column.parent.isGroup){
				this.layoutElement(this.getColGroupParentElement(column), column);
			}else {
				this.layoutElement(column.getElement(), column);
			}
			
			if(allCells){
				column.cells.forEach((cell) => {
					this.layoutElement(cell.getElement(true), column);
				});
			}
		});
	}
	
	getColGroupParentElement(column){
		return column.parent.isGroup ? this.getColGroupParentElement(column.parent) : column.getElement();
	}
	
	//layout columns appropriately
	layout(){	
		if(this.active && !this.blocked){
			//calculate left columns
			this.layoutColumnPosition();
			
			this.reinitializeRows();
			
			this.layoutCalcRows();
		}
	}
	
	reinitializeRows(){
		var visibleRows = this.table.rowManager.getVisibleRows(true);
		var otherRows = this.table.rowManager.getRows().filter(row => !visibleRows.includes(row));
		
		otherRows.forEach((row) =>{
			row.deinitialize();
		});
		
		visibleRows.forEach((row) =>{
			if(row.type === "row"){
				this.layoutRow(row);
			}
		});
	}
	
	layoutRow(row){
		if(this.table.options.layout === "fitDataFill" && this.rightColumns.length){
			this.table.rowManager.getTableElement().style.minWidth = "calc(100% - " + this.rightMargin + ")";
		}
		
		this.leftColumns.forEach((column) => {
			var cell = row.getCell(column);
			
			if(cell){
				this.layoutElement(cell.getElement(true), column);
			}
		});
		
		this.rightColumns.forEach((column) => {
			var cell = row.getCell(column);
			
			if(cell){
				this.layoutElement(cell.getElement(true), column);
			}
		});
	}
	
	layoutElement(element, column){
		var position;
		
		if(column.modules.frozen && element){
			element.style.position = "sticky";

			if(this.table.rtl){
				position = column.modules.frozen.position === "left" ? "right" : "left";
			}else {
				position = column.modules.frozen.position;
			}
		
			element.style[position] = column.modules.frozen.margin;

			element.classList.add("tabulator-frozen");
			
			element.classList.toggle("tabulator-frozen-left",  column.modules.frozen.edge && column.modules.frozen.position === "left");
			element.classList.toggle("tabulator-frozen-right", column.modules.frozen.edge && column.modules.frozen.position === "right");
		}
	}

	adjustForScrollbar(width){
		if(this.rightColumns.length){
			this.table.columnManager.getContentsElement().style.width = "calc(100% - " + width + "px)";
		}
	}

	getFrozenColumns(){
		return this.leftColumns.concat(this.rightColumns);
	}
	
	_calcSpace(columns, index){
		var width = 0;
		
		for (let i = 0; i < index; i++){
			if(columns[i].visible){
				width += columns[i].getWidth();
			}
		}
		
		return width;
	}
}

class FrozenRows extends Module{

	static moduleName = "frozenRows";

	constructor(table){
		super(table);

		this.topElement = document.createElement("div");
		this.rows = [];

		//register component functions
		this.registerComponentFunction("row", "freeze", this.freezeRow.bind(this));
		this.registerComponentFunction("row", "unfreeze", this.unfreezeRow.bind(this));
		this.registerComponentFunction("row", "isFrozen", this.isRowFrozen.bind(this));

		//register table options
		this.registerTableOption("frozenRowsField", "id"); //field to choose frozen rows by
		this.registerTableOption("frozenRows", false); //holder for frozen row identifiers
	}

	initialize(){
		var	fragment = document.createDocumentFragment();
		
		this.rows = [];

		this.topElement.classList.add("tabulator-frozen-rows-holder");
		
		fragment.appendChild(document.createElement("br"));
		fragment.appendChild(this.topElement);

		// this.table.columnManager.element.append(this.topElement);
		this.table.columnManager.getContentsElement().insertBefore(fragment, this.table.columnManager.headersElement.nextSibling);

		this.subscribe("row-deleting", this.detachRow.bind(this));
		this.subscribe("rows-visible", this.visibleRows.bind(this));

		this.registerDisplayHandler(this.getRows.bind(this), 10);

		if(this.table.options.frozenRows){
			this.subscribe("data-processed", this.initializeRows.bind(this));
			this.subscribe("row-added", this.initializeRow.bind(this));
			this.subscribe("table-redrawing", this.resizeHolderWidth.bind(this));
			this.subscribe("column-resized", this.resizeHolderWidth.bind(this));
			this.subscribe("column-show", this.resizeHolderWidth.bind(this));
			this.subscribe("column-hide", this.resizeHolderWidth.bind(this));
		}

		this.resizeHolderWidth();
	}

	resizeHolderWidth(){
		this.topElement.style.minWidth = this.table.columnManager.headersElement.offsetWidth + "px";
	}

	initializeRows(){
		this.table.rowManager.getRows().forEach((row) => {
			this.initializeRow(row);
		});
	}

	initializeRow(row){
		var frozenRows = this.table.options.frozenRows,
		rowType = typeof frozenRows;

		if(rowType === "number"){
			if(row.getPosition() && (row.getPosition() + this.rows.length) <= frozenRows){
				this.freezeRow(row);
			}
		}else if(rowType === "function"){
			if(frozenRows.call(this.table, row.getComponent())){
				this.freezeRow(row);
			}
		}else if(Array.isArray(frozenRows)){
			if(frozenRows.includes(row.data[this.options("frozenRowsField")])){
				this.freezeRow(row);
			}
		}
	}

	isRowFrozen(row){
		var index = this.rows.indexOf(row);
		return index > -1;
	}

	isFrozen(){
		return !!this.rows.length;
	}

	visibleRows(viewable, rows){
		this.rows.forEach((row) => {
			rows.push(row);
		});

		return rows;
	}

	//filter frozen rows out of display data
	getRows(rows){
		var output = rows.slice(0);

		this.rows.forEach(function(row){
			var index = output.indexOf(row);

			if(index > -1){
				output.splice(index, 1);
			}
		});

		return output;
	}

	freezeRow(row){
		if(!row.modules.frozen){
			row.modules.frozen = true;
			this.topElement.appendChild(row.getElement());
			row.initialize();
			row.normalizeHeight();
		
			this.rows.push(row);

			this.refreshData(false, "display");

			this.table.rowManager.adjustTableSize();

			this.styleRows();

		}else {
			console.warn("Freeze Error - Row is already frozen");
		}
	}

	unfreezeRow(row){
		if(row.modules.frozen){

			row.modules.frozen = false;

			this.detachRow(row);

			this.table.rowManager.adjustTableSize();

			this.refreshData(false, "display");

			if(this.rows.length){
				this.styleRows();
			}

		}else {
			console.warn("Freeze Error - Row is already unfrozen");
		}
	}

	detachRow(row){
		var index = this.rows.indexOf(row);

		if(index > -1){
			var rowEl = row.getElement();

			if(rowEl.parentNode){
				rowEl.parentNode.removeChild(rowEl);
			}

			this.rows.splice(index, 1);
		}
	}

	styleRows(row){
		this.rows.forEach((row, i) => {
			this.table.rowManager.styleRow(row, i);
		});
	}
}

class MoveColumns extends Module{

	static moduleName = "moveColumn";
	
	constructor(table){
		super(table);
		
		this.placeholderElement = this.createPlaceholderElement();
		this.hoverElement = false; //floating column header element
		this.checkTimeout = false; //click check timeout holder
		this.checkPeriod = 250; //period to wait on mousedown to consider this a move and not a click
		this.moving = false; //currently moving column
		this.toCol = false; //destination column
		this.toColAfter = false; //position of moving column relative to the destination column
		this.startX = 0; //starting position within header element
		this.autoScrollMargin = 40; //auto scroll on edge when within margin
		this.autoScrollStep = 5; //auto scroll distance in pixels
		this.autoScrollTimeout = false; //auto scroll timeout
		this.touchMove = false;
		
		this.moveHover = this.moveHover.bind(this);
		this.endMove = this.endMove.bind(this);
		
		this.registerTableOption("movableColumns", false); //enable movable columns
	}
	
	createPlaceholderElement(){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-col");
		el.classList.add("tabulator-col-placeholder");
		
		return el;
	}
	
	initialize(){
		if(this.table.options.movableColumns){
			this.subscribe("column-init", this.initializeColumn.bind(this));
			this.subscribe("alert-show", this.abortMove.bind(this));
		}
	}

	abortMove(){
		clearTimeout(this.checkTimeout);
	}
	
	initializeColumn(column){
		var self = this,
		config = {},
		colEl;

		if(!column.modules.frozen && !column.isGroup && !column.isRowHeader){
			colEl = column.getElement();
			
			config.mousemove = function(e){
				if(column.parent === self.moving.parent){
					if((((self.touchMove ? e.touches[0].pageX : e.pageX) - Helpers.elOffset(colEl).left) + self.table.columnManager.contentsElement.scrollLeft) > (column.getWidth() / 2)){
						if(self.toCol !== column || !self.toColAfter){
							colEl.parentNode.insertBefore(self.placeholderElement, colEl.nextSibling);
							self.moveColumn(column, true);
						}
					}else {
						if(self.toCol !== column || self.toColAfter){
							colEl.parentNode.insertBefore(self.placeholderElement, colEl);
							self.moveColumn(column, false);
						}
					}
				}
			}.bind(self);
			
			colEl.addEventListener("mousedown", function(e){
				self.touchMove = false;
				if(e.which === 1){
					self.checkTimeout = setTimeout(function(){
						self.startMove(e, column);
					}, self.checkPeriod);
				}
			});
			
			colEl.addEventListener("mouseup", function(e){
				if(e.which === 1){
					if(self.checkTimeout){
						clearTimeout(self.checkTimeout);
					}
				}
			});
			
			self.bindTouchEvents(column);
		}
		
		column.modules.moveColumn = config;
	}
	
	bindTouchEvents(column){
		var colEl = column.getElement(),
		startXMove = false, //shifting center position of the cell
		nextCol, prevCol, nextColWidth, prevColWidth, nextColWidthLast, prevColWidthLast;
		
		colEl.addEventListener("touchstart", (e) => {
			this.checkTimeout = setTimeout(() => {
				this.touchMove = true;
				nextCol = column.nextColumn();
				nextColWidth = nextCol ? nextCol.getWidth()/2 : 0;
				prevCol = column.prevColumn();
				prevColWidth = prevCol ? prevCol.getWidth()/2 : 0;
				nextColWidthLast = 0;
				prevColWidthLast = 0;
				startXMove = false;
				
				this.startMove(e, column);
			}, this.checkPeriod);
		}, {passive: true});
		
		colEl.addEventListener("touchmove", (e) => {
			var diff, moveToCol;
			
			if(this.moving){
				this.moveHover(e);
				
				if(!startXMove){
					startXMove = e.touches[0].pageX;
				}
				
				diff = e.touches[0].pageX - startXMove;
				
				if(diff > 0){
					if(nextCol && diff - nextColWidthLast > nextColWidth){
						moveToCol = nextCol;
						
						if(moveToCol !== column){
							startXMove = e.touches[0].pageX;
							moveToCol.getElement().parentNode.insertBefore(this.placeholderElement, moveToCol.getElement().nextSibling);
							this.moveColumn(moveToCol, true);
						}
					}
				}else {
					if(prevCol && -diff - prevColWidthLast >  prevColWidth){
						moveToCol = prevCol;
						
						if(moveToCol !== column){
							startXMove = e.touches[0].pageX;
							moveToCol.getElement().parentNode.insertBefore(this.placeholderElement, moveToCol.getElement());
							this.moveColumn(moveToCol, false);
						}
					}
				}
				
				if(moveToCol){
					nextCol = moveToCol.nextColumn();
					nextColWidthLast = nextColWidth;
					nextColWidth = nextCol ? nextCol.getWidth() / 2 : 0;
					prevCol = moveToCol.prevColumn();
					prevColWidthLast = prevColWidth;
					prevColWidth = prevCol ? prevCol.getWidth() / 2 : 0;
				}
			}
		}, {passive: true});
		
		colEl.addEventListener("touchend", (e) => {
			if(this.checkTimeout){
				clearTimeout(this.checkTimeout);
			}
			if(this.moving){
				this.endMove(e);
			}
		});
	}
	
	startMove(e, column){
		var element = column.getElement(),
		headerElement = this.table.columnManager.getContentsElement(),
		headersElement = this.table.columnManager.getHeadersElement();
		
		//Prevent moving columns when range selection is active
		if(this.table.modules.selectRange && this.table.modules.selectRange.columnSelection){
			if(this.table.modules.selectRange.mousedown && this.table.modules.selectRange.selecting === "column"){
				return;
			}
		}

		this.moving = column;
		this.startX = (this.touchMove ? e.touches[0].pageX : e.pageX) - Helpers.elOffset(element).left;
		
		this.table.element.classList.add("tabulator-block-select");
		
		//create placeholder
		this.placeholderElement.style.width = column.getWidth() + "px";
		this.placeholderElement.style.height = column.getHeight() + "px";
		
		element.parentNode.insertBefore(this.placeholderElement, element);
		element.parentNode.removeChild(element);
		
		//create hover element
		this.hoverElement = element.cloneNode(true);
		this.hoverElement.classList.add("tabulator-moving");
		
		headerElement.appendChild(this.hoverElement);
		
		this.hoverElement.style.left = "0";
		this.hoverElement.style.bottom = (headerElement.clientHeight - headersElement.offsetHeight) + "px";
		
		if(!this.touchMove){
			this._bindMouseMove();
			
			document.body.addEventListener("mousemove", this.moveHover);
			document.body.addEventListener("mouseup", this.endMove);
		}
		
		this.moveHover(e);

		this.dispatch("column-moving", e, this.moving);
	}
	
	_bindMouseMove(){
		this.table.columnManager.columnsByIndex.forEach(function(column){
			if(column.modules.moveColumn.mousemove){
				column.getElement().addEventListener("mousemove", column.modules.moveColumn.mousemove);
			}
		});
	}
	
	_unbindMouseMove(){
		this.table.columnManager.columnsByIndex.forEach(function(column){
			if(column.modules.moveColumn.mousemove){
				column.getElement().removeEventListener("mousemove", column.modules.moveColumn.mousemove);
			}
		});
	}
	
	moveColumn(column, after){
		var movingCells = this.moving.getCells();
		
		this.toCol = column;
		this.toColAfter = after;
		
		if(after){
			column.getCells().forEach(function(cell, i){
				var cellEl = cell.getElement(true);
				
				if(cellEl.parentNode && movingCells[i]){
					cellEl.parentNode.insertBefore(movingCells[i].getElement(), cellEl.nextSibling);
				}
			});
		}else {
			column.getCells().forEach(function(cell, i){
				var cellEl = cell.getElement(true);
				
				if(cellEl.parentNode && movingCells[i]){
					cellEl.parentNode.insertBefore(movingCells[i].getElement(), cellEl);
				}
			});
		}
	}
	
	endMove(e){
		if(e.which === 1 || this.touchMove){
			this._unbindMouseMove();
			
			this.placeholderElement.parentNode.insertBefore(this.moving.getElement(), this.placeholderElement.nextSibling);
			this.placeholderElement.parentNode.removeChild(this.placeholderElement);
			this.hoverElement.parentNode.removeChild(this.hoverElement);
			
			this.table.element.classList.remove("tabulator-block-select");
			
			if(this.toCol){
				this.table.columnManager.moveColumnActual(this.moving, this.toCol, this.toColAfter);
			}

			this.moving = false;
			this.toCol = false;
			this.toColAfter = false;
			
			if(!this.touchMove){
				document.body.removeEventListener("mousemove", this.moveHover);
				document.body.removeEventListener("mouseup", this.endMove);
			}
		}
	}
	
	moveHover(e){
		var columnHolder = this.table.columnManager.getContentsElement(),
		scrollLeft = columnHolder.scrollLeft,
		xPos = ((this.touchMove ? e.touches[0].pageX : e.pageX) - Helpers.elOffset(columnHolder).left) + scrollLeft,
		scrollPos;
		
		this.hoverElement.style.left = (xPos - this.startX) + "px";
		
		if(xPos - scrollLeft < this.autoScrollMargin){
			if(!this.autoScrollTimeout){
				this.autoScrollTimeout = setTimeout(() => {
					scrollPos = Math.max(0,scrollLeft-5);
					this.table.rowManager.getElement().scrollLeft = scrollPos;
					this.autoScrollTimeout = false;
				}, 1);
			}
		}
		
		if(scrollLeft + columnHolder.clientWidth - xPos < this.autoScrollMargin){
			if(!this.autoScrollTimeout){
				this.autoScrollTimeout = setTimeout(() => {
					scrollPos = Math.min(columnHolder.clientWidth, scrollLeft+5);
					this.table.rowManager.getElement().scrollLeft = scrollPos;
					this.autoScrollTimeout = false;
				}, 1);
			}
		}
	}
}

var defaultSenders = {
	delete:function(fromRow, toRow, toTable){
		fromRow.delete();
	}
};

var defaultReceivers = {
	insert:function(fromRow, toRow, fromTable){
		this.table.addRow(fromRow.getData(), undefined, toRow);
		return true;
	},

	add:function(fromRow, toRow, fromTable){
		this.table.addRow(fromRow.getData());
		return true;
	},

	update:function(fromRow, toRow, fromTable){
		if(toRow){
			toRow.update(fromRow.getData());
			return true;
		}

		return false;
	},

	replace:function(fromRow, toRow, fromTable){
		if(toRow){
			this.table.addRow(fromRow.getData(), undefined, toRow);
			toRow.delete();
			return true;
		}

		return false;
	},
};

class MoveRows extends Module{

	static moduleName = "moveRow";

	//load defaults
	static senders = defaultSenders;
	static receivers = defaultReceivers;

	constructor(table){
		super(table);

		this.placeholderElement = this.createPlaceholderElement();
		this.hoverElement = false; //floating row header element
		this.checkTimeout = false; //click check timeout holder
		this.checkPeriod = 150; //period to wait on mousedown to consider this a move and not a click
		this.moving = false; //currently moving row
		this.toRow = false; //destination row
		this.toRowAfter = false; //position of moving row relative to the destination row
		this.hasHandle = false; //row has handle instead of fully movable row
		this.startY = 0; //starting Y position within header element
		this.startX = 0; //starting X position within header element

		this.moveHover = this.moveHover.bind(this);
		this.endMove = this.endMove.bind(this);
		this.tableRowDropEvent = false;

		this.touchMove = false;

		this.connection = false;
		this.connectionSelectorsTables = false;
		this.connectionSelectorsElements = false;
		this.connectionElements = [];
		this.connections = [];

		this.connectedTable = false;
		this.connectedRow = false;

		this.registerTableOption("movableRows", false); //enable movable rows
		this.registerTableOption("movableRowsConnectedTables", false); //tables for movable rows to be connected to
		this.registerTableOption("movableRowsConnectedElements", false); //other elements for movable rows to be connected to
		this.registerTableOption("movableRowsSender", false);
		this.registerTableOption("movableRowsReceiver", "insert");

		this.registerColumnOption("rowHandle");
	}

	createPlaceholderElement(){
		var el = document.createElement("div");

		el.classList.add("tabulator-row");
		el.classList.add("tabulator-row-placeholder");

		return el;
	}

	initialize(){
		if(this.table.options.movableRows){
			this.connectionSelectorsTables = this.table.options.movableRowsConnectedTables;
			this.connectionSelectorsElements = this.table.options.movableRowsConnectedElements;

			this.connection = this.connectionSelectorsTables || this.connectionSelectorsElements;

			this.subscribe("cell-init", this.initializeCell.bind(this));
			this.subscribe("column-init", this.initializeColumn.bind(this));
			this.subscribe("row-init", this.initializeRow.bind(this));
		}
	}

	initializeGroupHeader(group){
		var self = this,
		config = {};

		//inter table drag drop
		config.mouseup = function(e){
			self.tableRowDrop(e, group);
		}.bind(self);

		//same table drag drop
		config.mousemove = function(e){
			var rowEl;

			if(((e.pageY - Helpers.elOffset(group.element).top) + self.table.rowManager.element.scrollTop) > (group.getHeight() / 2)){
				if(self.toRow !== group || !self.toRowAfter){
					rowEl = group.getElement();
					rowEl.parentNode.insertBefore(self.placeholderElement, rowEl.nextSibling);
					self.moveRow(group, true);
				}
			}else {
				if(self.toRow !== group || self.toRowAfter){
					rowEl = group.getElement();
					if(rowEl.previousSibling){
						rowEl.parentNode.insertBefore(self.placeholderElement, rowEl);
						self.moveRow(group, false);
					}
				}
			}
		}.bind(self);

		group.modules.moveRow = config;
	}

	initializeRow(row){
		var self = this,
		config = {},
		rowEl;

		//inter table drag drop
		config.mouseup = function(e){
			self.tableRowDrop(e, row);
		}.bind(self);

		//same table drag drop
		config.mousemove = function(e){
			var rowEl = row.getElement();

			if(((e.pageY - Helpers.elOffset(rowEl).top) + self.table.rowManager.element.scrollTop) > (row.getHeight() / 2)){
				if(self.toRow !== row || !self.toRowAfter){
					rowEl.parentNode.insertBefore(self.placeholderElement, rowEl.nextSibling);
					self.moveRow(row, true);
				}
			}else {
				if(self.toRow !== row || self.toRowAfter){
					rowEl.parentNode.insertBefore(self.placeholderElement, rowEl);
					self.moveRow(row, false);
				}
			}
		}.bind(self);


		if(!this.hasHandle){

			rowEl = row.getElement();

			rowEl.addEventListener("mousedown", function(e){
				if(e.which === 1){
					self.checkTimeout = setTimeout(function(){
						self.startMove(e, row);
					}, self.checkPeriod);
				}
			});

			rowEl.addEventListener("mouseup", function(e){
				if(e.which === 1){
					if(self.checkTimeout){
						clearTimeout(self.checkTimeout);
					}
				}
			});

			this.bindTouchEvents(row, row.getElement());
		}

		row.modules.moveRow = config;
	}

	initializeColumn(column){
		if(column.definition.rowHandle && this.table.options.movableRows !== false){
			this.hasHandle = true;
		}
	}

	initializeCell(cell){
		if(cell.column.definition.rowHandle && this.table.options.movableRows !== false){
			var self = this,
			cellEl = cell.getElement(true);

			cellEl.addEventListener("mousedown", function(e){
				if(e.which === 1){
					self.checkTimeout = setTimeout(function(){
						self.startMove(e, cell.row);
					}, self.checkPeriod);
				}
			});

			cellEl.addEventListener("mouseup", function(e){
				if(e.which === 1){
					if(self.checkTimeout){
						clearTimeout(self.checkTimeout);
					}
				}
			});

			this.bindTouchEvents(cell.row, cellEl);
		}
	}

	bindTouchEvents(row, element){
		var startYMove = false, //shifting center position of the cell
		nextRow, prevRow, nextRowHeight, prevRowHeight, nextRowHeightLast, prevRowHeightLast;

		element.addEventListener("touchstart", (e) => {
			this.checkTimeout = setTimeout(() => {
				this.touchMove = true;
				nextRow = row.nextRow();
				nextRowHeight = nextRow ? nextRow.getHeight()/2 : 0;
				prevRow = row.prevRow();
				prevRowHeight = prevRow ? prevRow.getHeight()/2 : 0;
				nextRowHeightLast = 0;
				prevRowHeightLast = 0;
				startYMove = false;

				this.startMove(e, row);
			}, this.checkPeriod);
		}, {passive: true});
		this.moving, this.toRow, this.toRowAfter;
		element.addEventListener("touchmove", (e) => {

			var diff, moveToRow;

			if(this.moving){
				e.preventDefault();

				this.moveHover(e);

				if(!startYMove){
					startYMove = e.touches[0].pageY;
				}

				diff = e.touches[0].pageY - startYMove;

				if(diff > 0){
					if(nextRow && diff - nextRowHeightLast > nextRowHeight){
						moveToRow = nextRow;

						if(moveToRow !== row){
							startYMove = e.touches[0].pageY;
							moveToRow.getElement().parentNode.insertBefore(this.placeholderElement, moveToRow.getElement().nextSibling);
							this.moveRow(moveToRow, true);
						}
					}
				}else {
					if(prevRow && -diff - prevRowHeightLast >  prevRowHeight){
						moveToRow = prevRow;

						if(moveToRow !== row){
							startYMove = e.touches[0].pageY;
							moveToRow.getElement().parentNode.insertBefore(this.placeholderElement, moveToRow.getElement());
							this.moveRow(moveToRow, false);
						}
					}
				}

				if(moveToRow){
					nextRow = moveToRow.nextRow();
					nextRowHeightLast = nextRowHeight;
					nextRowHeight = nextRow ? nextRow.getHeight() / 2 : 0;
					prevRow = moveToRow.prevRow();
					prevRowHeightLast = prevRowHeight;
					prevRowHeight = prevRow ? prevRow.getHeight() / 2 : 0;
				}
			}
		});

		element.addEventListener("touchend", (e) => {
			if(this.checkTimeout){
				clearTimeout(this.checkTimeout);
			}
			if(this.moving){
				this.endMove(e);
				this.touchMove = false;
			}
		});
	}

	_bindMouseMove(){
		this.table.rowManager.getDisplayRows().forEach((row) => {
			if((row.type === "row" || row.type === "group") && row.modules.moveRow && row.modules.moveRow.mousemove){
				row.getElement().addEventListener("mousemove", row.modules.moveRow.mousemove);
			}
		});
	}

	_unbindMouseMove(){
		this.table.rowManager.getDisplayRows().forEach((row) => {
			if((row.type === "row" || row.type === "group") && row.modules.moveRow && row.modules.moveRow.mousemove){
				row.getElement().removeEventListener("mousemove", row.modules.moveRow.mousemove);
			}
		});
	}

	startMove(e, row){
		var element = row.getElement();

		this.setStartPosition(e, row);

		this.moving = row;

		this.table.element.classList.add("tabulator-block-select");

		//create placeholder
		this.placeholderElement.style.width = row.getWidth() + "px";
		this.placeholderElement.style.height = row.getHeight() + "px";

		if(!this.connection){
			element.parentNode.insertBefore(this.placeholderElement, element);
			element.parentNode.removeChild(element);
		}else {
			this.table.element.classList.add("tabulator-movingrow-sending");
			this.connectToTables(row);
		}

		//create hover element
		this.hoverElement = element.cloneNode(true);
		this.hoverElement.classList.add("tabulator-moving");

		if(this.connection){
			document.body.appendChild(this.hoverElement);
			this.hoverElement.style.left = "0";
			this.hoverElement.style.top = "0";
			this.hoverElement.style.width = this.table.element.clientWidth + "px";
			this.hoverElement.style.whiteSpace = "nowrap";
			this.hoverElement.style.overflow = "hidden";
			this.hoverElement.style.pointerEvents = "none";
		}else {
			this.table.rowManager.getTableElement().appendChild(this.hoverElement);

			this.hoverElement.style.left = "0";
			this.hoverElement.style.top = "0";

			this._bindMouseMove();
		}

		document.body.addEventListener("mousemove", this.moveHover);
		document.body.addEventListener("mouseup", this.endMove);

		this.dispatchExternal("rowMoving", row.getComponent());

		this.moveHover(e);
	}

	setStartPosition(e, row){
		var pageX = this.touchMove ? e.touches[0].pageX : e.pageX,
		pageY = this.touchMove ? e.touches[0].pageY : e.pageY,
		element, position;

		element = row.getElement();
		if(this.connection){
			position = element.getBoundingClientRect();

			this.startX = position.left - pageX + window.pageXOffset;
			this.startY = position.top - pageY + window.pageYOffset;
		}else {
			this.startY = (pageY - element.getBoundingClientRect().top);
		}
	}

	endMove(e){
		if(!e || e.which === 1 || this.touchMove){
			this._unbindMouseMove();

			if(!this.connection){
				this.placeholderElement.parentNode.insertBefore(this.moving.getElement(), this.placeholderElement.nextSibling);
				this.placeholderElement.parentNode.removeChild(this.placeholderElement);
			}

			this.hoverElement.parentNode.removeChild(this.hoverElement);

			this.table.element.classList.remove("tabulator-block-select");

			if(this.toRow){
				this.table.rowManager.moveRow(this.moving, this.toRow, this.toRowAfter);
			}else {
				this.dispatchExternal("rowMoveCancelled", this.moving.getComponent());
			}

			this.moving = false;
			this.toRow = false;
			this.toRowAfter = false;

			document.body.removeEventListener("mousemove", this.moveHover);
			document.body.removeEventListener("mouseup", this.endMove);

			if(this.connection){
				this.table.element.classList.remove("tabulator-movingrow-sending");
				this.disconnectFromTables();
			}
		}
	}

	moveRow(row, after){
		this.toRow = row;
		this.toRowAfter = after;
	}

	moveHover(e){
		if(this.connection){
			this.moveHoverConnections.call(this, e);
		}else {
			this.moveHoverTable.call(this, e);
		}
	}

	moveHoverTable(e){
		var rowHolder = this.table.rowManager.getElement(),
		scrollTop = rowHolder.scrollTop,
		yPos = ((this.touchMove ? e.touches[0].pageY : e.pageY) - rowHolder.getBoundingClientRect().top) + scrollTop;
		
		this.hoverElement.style.top = Math.min(yPos - this.startY, this.table.rowManager.element.scrollHeight - this.hoverElement.offsetHeight) + "px";
	}

	moveHoverConnections(e){
		this.hoverElement.style.left = (this.startX + (this.touchMove ? e.touches[0].pageX : e.pageX)) + "px";
		this.hoverElement.style.top = (this.startY + (this.touchMove ? e.touches[0].pageY : e.pageY)) + "px";
	}

	elementRowDrop(e, element, row){
		this.dispatchExternal("movableRowsElementDrop", e, element, row ? row.getComponent() : false);
	}

	//establish connection with other tables
	connectToTables(row){
		var connectionTables;

		if(this.connectionSelectorsTables){
			connectionTables = this.commsConnections(this.connectionSelectorsTables);

			this.dispatchExternal("movableRowsSendingStart", connectionTables);

			this.commsSend(this.connectionSelectorsTables, "moveRow", "connect", {
				row:row,
			});
		}

		if(this.connectionSelectorsElements){

			this.connectionElements = [];

			if(!Array.isArray(this.connectionSelectorsElements)){
				this.connectionSelectorsElements = [this.connectionSelectorsElements];
			}

			this.connectionSelectorsElements.forEach((query) => {
				if(typeof query === "string"){
					this.connectionElements = this.connectionElements.concat(Array.prototype.slice.call(document.querySelectorAll(query)));
				}else {
					this.connectionElements.push(query);
				}
			});

			this.connectionElements.forEach((element) => {
				var dropEvent = (e) => {
					this.elementRowDrop(e, element, this.moving);
				};

				element.addEventListener("mouseup", dropEvent);
				element.tabulatorElementDropEvent = dropEvent;

				element.classList.add("tabulator-movingrow-receiving");
			});
		}
	}

	//disconnect from other tables
	disconnectFromTables(){
		var connectionTables;

		if(this.connectionSelectorsTables){
			connectionTables = this.commsConnections(this.connectionSelectorsTables);

			this.dispatchExternal("movableRowsSendingStop", connectionTables);

			this.commsSend(this.connectionSelectorsTables, "moveRow", "disconnect");
		}

		this.connectionElements.forEach((element) => {
			element.classList.remove("tabulator-movingrow-receiving");
			element.removeEventListener("mouseup", element.tabulatorElementDropEvent);
			delete element.tabulatorElementDropEvent;
		});
	}

	//accept incomming connection
	connect(table, row){
		if(!this.connectedTable){
			this.connectedTable = table;
			this.connectedRow = row;

			this.table.element.classList.add("tabulator-movingrow-receiving");

			this.table.rowManager.getDisplayRows().forEach((row) => {
				if(row.type === "row" && row.modules.moveRow && row.modules.moveRow.mouseup){
					row.getElement().addEventListener("mouseup", row.modules.moveRow.mouseup);
				}
			});

			this.tableRowDropEvent = this.tableRowDrop.bind(this);

			this.table.element.addEventListener("mouseup", this.tableRowDropEvent);

			this.dispatchExternal("movableRowsReceivingStart", row, table);

			return true;
		}else {
			console.warn("Move Row Error - Table cannot accept connection, already connected to table:", this.connectedTable);
			return false;
		}
	}

	//close incoming connection
	disconnect(table){
		if(table === this.connectedTable){
			this.connectedTable = false;
			this.connectedRow = false;

			this.table.element.classList.remove("tabulator-movingrow-receiving");

			this.table.rowManager.getDisplayRows().forEach((row) =>{
				if(row.type === "row" && row.modules.moveRow && row.modules.moveRow.mouseup){
					row.getElement().removeEventListener("mouseup", row.modules.moveRow.mouseup);
				}
			});

			this.table.element.removeEventListener("mouseup", this.tableRowDropEvent);

			this.dispatchExternal("movableRowsReceivingStop", table);
		}else {
			console.warn("Move Row Error - trying to disconnect from non connected table");
		}
	}

	dropComplete(table, row, success){
		var sender = false;

		if(success){

			switch(typeof this.table.options.movableRowsSender){
				case "string":
					sender = MoveRows.senders[this.table.options.movableRowsSender];
					break;

				case "function":
					sender = this.table.options.movableRowsSender;
					break;
			}

			if(sender){
				sender.call(this, this.moving ? this.moving.getComponent() : undefined, row ? row.getComponent() : undefined, table);
			}else {
				if(this.table.options.movableRowsSender){
					console.warn("Mover Row Error - no matching sender found:", this.table.options.movableRowsSender);
				}
			}

			this.dispatchExternal("movableRowsSent", this.moving.getComponent(), row ? row.getComponent() : undefined, table);
		}else {
			this.dispatchExternal("movableRowsSentFailed", this.moving.getComponent(), row ? row.getComponent() : undefined, table);
		}

		this.endMove();
	}

	tableRowDrop(e, row){
		var receiver = false,
		success = false;

		e.stopImmediatePropagation();

		switch(typeof this.table.options.movableRowsReceiver){
			case "string":
				receiver = MoveRows.receivers[this.table.options.movableRowsReceiver];
				break;

			case "function":
				receiver = this.table.options.movableRowsReceiver;
				break;
		}

		if(receiver){
			success = receiver.call(this, this.connectedRow.getComponent(), row ? row.getComponent() : undefined, this.connectedTable);
		}else {
			console.warn("Mover Row Error - no matching receiver found:", this.table.options.movableRowsReceiver);
		}

		if(success){
			this.dispatchExternal("movableRowsReceived", this.connectedRow.getComponent(), row ? row.getComponent() : undefined, this.connectedTable);
		}else {
			this.dispatchExternal("movableRowsReceivedFailed", this.connectedRow.getComponent(), row ? row.getComponent() : undefined, this.connectedTable);
		}

		this.commsSend(this.connectedTable, "moveRow", "dropcomplete", {
			row:row,
			success:success,
		});
	}

	commsReceived(table, action, data){
		switch(action){
			case "connect":
				return this.connect(table, data.row);

			case "disconnect":
				return this.disconnect(table);

			case "dropcomplete":
				return this.dropComplete(table, data.row, data.success);
		}
	}
}

function rows(pageSize, currentRow, currentPage, totalRows, totalPages){
	var el = document.createElement("span"),
	showingEl = document.createElement("span"),
	valueEl = document.createElement("span"),
	ofEl = document.createElement("span"),
	totalEl = document.createElement("span"),
	rowsEl = document.createElement("span");

	this.table.modules.localize.langBind("pagination|counter|showing", (value) => {
		showingEl.innerHTML = value;
	});

	this.table.modules.localize.langBind("pagination|counter|of", (value) => {
		ofEl.innerHTML = value;
	});

	this.table.modules.localize.langBind("pagination|counter|rows", (value) => {
		rowsEl.innerHTML = value;
	});

	if(totalRows){
		valueEl.innerHTML = " " + currentRow + "-" + Math.min((currentRow + pageSize - 1), totalRows) + " ";
		
		totalEl.innerHTML = " " + totalRows + " ";
		
		el.appendChild(showingEl);
		el.appendChild(valueEl);
		el.appendChild(ofEl);
		el.appendChild(totalEl);
		el.appendChild(rowsEl);
	}else {
		valueEl.innerHTML = " 0 ";

		el.appendChild(showingEl);
		el.appendChild(valueEl);
		el.appendChild(rowsEl);
	}
	
	return el;
}

function pages(pageSize, currentRow, currentPage, totalRows, totalPages){

	var el = document.createElement("span"),
	showingEl = document.createElement("span"),
	valueEl = document.createElement("span"),
	ofEl = document.createElement("span"),
	totalEl = document.createElement("span"),
	rowsEl = document.createElement("span");
	
	this.table.modules.localize.langBind("pagination|counter|showing", (value) => {
		showingEl.innerHTML = value;
	});
	
	valueEl.innerHTML = " " + currentPage + " ";
	
	this.table.modules.localize.langBind("pagination|counter|of", (value) => {
		ofEl.innerHTML = value;
	});
	
	totalEl.innerHTML = " " + totalPages + " ";
	
	this.table.modules.localize.langBind("pagination|counter|pages", (value) => {
		rowsEl.innerHTML = value;
	});
	
	el.appendChild(showingEl);
	el.appendChild(valueEl);
	el.appendChild(ofEl);
	el.appendChild(totalEl);
	el.appendChild(rowsEl);
	
	return el;
}

var defaultPageCounters = {
	rows:rows,
	pages:pages,
};

class Page extends Module {

	static moduleName = "page";

	//load defaults
	static pageCounters = defaultPageCounters;

	constructor(table) {
		super(table);

		this.mode = "local";
		this.progressiveLoad = false;

		this.element = null;
		this.pageCounterElement = null;
		this.pageCounter = null;

		this.size = 0;
		this.page = 1;
		this.count = 5;
		this.max = 1;

		this.remoteRowCountEstimate = null;

		this.initialLoad = true;
		this.dataChanging = false; //flag to check if data is being changed by this module

		this.pageSizes = [];

		this.registerTableOption("pagination", false); //set pagination type
		this.registerTableOption("paginationMode", "local"); //local or remote pagination
		this.registerTableOption("paginationSize", false); //set number of rows to a page
		this.registerTableOption("paginationInitialPage", 1); //initial page to show on load
		this.registerTableOption("paginationCounter", false);  // set pagination counter
		this.registerTableOption("paginationCounterElement", false);  // set pagination counter
		this.registerTableOption("paginationButtonCount", 5);  // set count of page button
		this.registerTableOption("paginationSizeSelector", false); //add pagination size selector element
		this.registerTableOption("paginationElement", false); //element to hold pagination numbers
		// this.registerTableOption("paginationDataSent", {}); //pagination data sent to the server
		// this.registerTableOption("paginationDataReceived", {}); //pagination data received from the server
		this.registerTableOption("paginationAddRow", "page"); //add rows on table or page
		this.registerTableOption("paginationOutOfRange", false); //reset the current page when the last page < this.page, values: false|function|any value accepted by setPage()

		this.registerTableOption("progressiveLoad", false); //progressive loading
		this.registerTableOption("progressiveLoadDelay", 0); //delay between requests
		this.registerTableOption("progressiveLoadScrollMargin", 0); //margin before scroll begins

		this.registerTableFunction("setMaxPage", this.setMaxPage.bind(this));
		this.registerTableFunction("setPage", this.setPage.bind(this));
		this.registerTableFunction("setPageToRow", this.userSetPageToRow.bind(this));
		this.registerTableFunction("setPageSize", this.userSetPageSize.bind(this));
		this.registerTableFunction("getPageSize", this.getPageSize.bind(this));
		this.registerTableFunction("previousPage", this.previousPage.bind(this));
		this.registerTableFunction("nextPage", this.nextPage.bind(this));
		this.registerTableFunction("getPage", this.getPage.bind(this));
		this.registerTableFunction("getPageMax", this.getPageMax.bind(this));

		//register component functions
		this.registerComponentFunction("row", "pageTo", this.setPageToRow.bind(this));
	}

	initialize() {
		if (this.table.options.pagination) {
			this.subscribe("row-deleted", this.rowsUpdated.bind(this));
			this.subscribe("row-added", this.rowsUpdated.bind(this));
			this.subscribe("data-processed", this.initialLoadComplete.bind(this));
			this.subscribe("table-built", this.calculatePageSizes.bind(this));
			this.subscribe("footer-redraw", this.footerRedraw.bind(this));

			if (this.table.options.paginationAddRow == "page") {
				this.subscribe("row-adding-position", this.rowAddingPosition.bind(this));
			}

			if (this.table.options.paginationMode === "remote") {
				this.subscribe("data-params", this.remotePageParams.bind(this));
				this.subscribe("data-loaded", this._parseRemoteData.bind(this));
			}

			if (this.table.options.progressiveLoad) {
				console.error("Progressive Load Error - Pagination and progressive load cannot be used at the same time");
			}

			this.registerDisplayHandler(this.restOnRenderBefore.bind(this), 40);
			this.registerDisplayHandler(this.getRows.bind(this), 50);

			this.createElements();
			this.initializePageCounter();
			this.initializePaginator();
		} else if (this.table.options.progressiveLoad) {
			this.subscribe("data-params", this.remotePageParams.bind(this));
			this.subscribe("data-loaded", this._parseRemoteData.bind(this));
			this.subscribe("table-built", this.calculatePageSizes.bind(this));
			this.subscribe("data-processed", this.initialLoadComplete.bind(this));

			this.initializeProgressive(this.table.options.progressiveLoad);

			if (this.table.options.progressiveLoad === "scroll") {
				this.subscribe("scroll-vertical", this.scrollVertical.bind(this));
			}
		}
	}

	rowAddingPosition(row, top) {
		var rowManager = this.table.rowManager,
		displayRows = rowManager.getDisplayRows(),
		index;

		if (top) {
			if (displayRows.length) {
				index = displayRows[0];
			} else {
				if (rowManager.activeRows.length) {
					index = rowManager.activeRows[rowManager.activeRows.length - 1];
					top = false;
				}
			}
		} else {
			if (displayRows.length) {
				index = displayRows[displayRows.length - 1];
				top = displayRows.length < this.size ? false : true;
			}
		}

		return { index, top };
	}

	calculatePageSizes() {
		var testElRow, testElCell;

		if (this.table.options.paginationSize) {
			this.size = this.table.options.paginationSize;
		} else {
			testElRow = document.createElement("div");
			testElRow.classList.add("tabulator-row");
			testElRow.style.visibility = "hidden";

			testElCell = document.createElement("div");
			testElCell.classList.add("tabulator-cell");
			testElCell.innerHTML = "Page Row Test";

			testElRow.appendChild(testElCell);

			this.table.rowManager.getTableElement().appendChild(testElRow);

			this.size = Math.floor(this.table.rowManager.getElement().clientHeight / testElRow.offsetHeight);

			this.table.rowManager.getTableElement().removeChild(testElRow);
		}

		this.dispatchExternal("pageSizeChanged", this.size);

		this.generatePageSizeSelectList();
	}

	initialLoadComplete() {
		this.initialLoad = false;
	}

	remotePageParams(data, config, silent, params) {
		if (!this.initialLoad) {
			if ((this.progressiveLoad && !silent) || (!this.progressiveLoad && !this.dataChanging)) {
				this.reset(true);
			}
		}

		//configure request params
		params.page = this.page;

		//set page size if defined
		if (this.size) {
			params.size = this.size;
		}

		return params;
	}

	///////////////////////////////////
	///////// Table Functions /////////
	///////////////////////////////////

	userSetPageToRow(row) {
		if (this.table.options.pagination) {
			row = this.table.rowManager.findRow(row);

			if (row) {
				return this.setPageToRow(row);
			}
		}

		return Promise.reject();
	}

	userSetPageSize(size) {
		if (this.table.options.pagination) {
			this.setPageSize(size);
			return this.setPage(1);
		} else {
			return false;
		}
	}

	///////////////////////////////////
	///////// Internal Logic //////////
	///////////////////////////////////

	scrollVertical(top, dir) {
		var element, diff, margin;
		if (!dir && !this.table.dataLoader.loading) {
			element = this.table.rowManager.getElement();
			diff = element.scrollHeight - element.clientHeight - top;
			margin = this.table.options.progressiveLoadScrollMargin || (element.clientHeight * 2);

			if (diff < margin) {
				this.nextPage()
					.catch(() => {}); //consume the exception thrown when on the last page
			}
		}
	}

	restOnRenderBefore(rows, renderInPosition) {
		if (!renderInPosition) {
			if (this.mode === "local") {
				this.reset();
			}
		}

		return rows;
	}

	rowsUpdated() {
		this.refreshData(true, "all");
	}

	createElements() {
		var button;

		this.element = document.createElement("span");
		this.element.classList.add("tabulator-paginator");

		this.pagesElement = document.createElement("span");
		this.pagesElement.classList.add("tabulator-pages");

		button = document.createElement("button");
		button.classList.add("tabulator-page");
		button.setAttribute("type", "button");
		button.setAttribute("role", "button");
		button.setAttribute("aria-label", "");
		button.setAttribute("title", "");

		this.firstBut = button.cloneNode(true);
		this.firstBut.setAttribute("data-page", "first");

		this.prevBut = button.cloneNode(true);
		this.prevBut.setAttribute("data-page", "prev");

		this.nextBut = button.cloneNode(true);
		this.nextBut.setAttribute("data-page", "next");

		this.lastBut = button.cloneNode(true);
		this.lastBut.setAttribute("data-page", "last");

		if (this.table.options.paginationSizeSelector) {
			this.pageSizeSelect = document.createElement("select");
			this.pageSizeSelect.classList.add("tabulator-page-size");
		}
	}

	generatePageSizeSelectList() {
		var pageSizes = [];

		if (this.pageSizeSelect) {

			if (Array.isArray(this.table.options.paginationSizeSelector)) {
				pageSizes = this.table.options.paginationSizeSelector;
				this.pageSizes = pageSizes;

				if (this.pageSizes.indexOf(this.size) == -1) {
					pageSizes.unshift(this.size);
				}
			} else {

				if (this.pageSizes.indexOf(this.size) == -1) {
					pageSizes = [];

					for (let i = 1; i < 5; i++) {
						pageSizes.push(this.size * i);
					}

					this.pageSizes = pageSizes;
				} else {
					pageSizes = this.pageSizes;
				}
			}

			while (this.pageSizeSelect.firstChild) this.pageSizeSelect.removeChild(this.pageSizeSelect.firstChild);

			pageSizes.forEach((item) => {
				var itemEl = document.createElement("option");
				itemEl.value = item;

				if (item === true) {
					this.langBind("pagination|all", function(value) {
						itemEl.innerHTML = value;
					});
				} else {
					itemEl.innerHTML = item;
				}

				this.pageSizeSelect.appendChild(itemEl);
			});

			this.pageSizeSelect.value = this.size;
		}
	}

	initializePageCounter() {
		var counter = this.table.options.paginationCounter,
		pageCounter = null;

		if (counter) {
			if (typeof counter === "function") {
				pageCounter = counter;
			} else {
				pageCounter = Page.pageCounters[counter];
			}

			if (pageCounter) {
				this.pageCounter = pageCounter;

				this.pageCounterElement = document.createElement("span");
				this.pageCounterElement.classList.add("tabulator-page-counter");
			} else {
				console.warn("Pagination Error - No such page counter found: ", counter);
			}
		}
	}

	//setup pagination
	initializePaginator(hidden) {
		var paginationCounterHolder;

		if (!hidden) {
			//build pagination element

			//bind localizations
			this.langBind("pagination|first", (value) => {
				this.firstBut.innerHTML = value;
			});

			this.langBind("pagination|first_title", (value) => {
				this.firstBut.setAttribute("aria-label", value);
				this.firstBut.setAttribute("title", value);
			});

			this.langBind("pagination|prev", (value) => {
				this.prevBut.innerHTML = value;
			});

			this.langBind("pagination|prev_title", (value) => {
				this.prevBut.setAttribute("aria-label", value);
				this.prevBut.setAttribute("title", value);
			});

			this.langBind("pagination|next", (value) => {
				this.nextBut.innerHTML = value;
			});

			this.langBind("pagination|next_title", (value) => {
				this.nextBut.setAttribute("aria-label", value);
				this.nextBut.setAttribute("title", value);
			});

			this.langBind("pagination|last", (value) => {
				this.lastBut.innerHTML = value;
			});

			this.langBind("pagination|last_title", (value) => {
				this.lastBut.setAttribute("aria-label", value);
				this.lastBut.setAttribute("title", value);
			});

			//click bindings
			this.firstBut.addEventListener("click", () => {
				this.setPage(1);
			});

			this.prevBut.addEventListener("click", () => {
				this.previousPage();
			});

			this.nextBut.addEventListener("click", () => {
				this.nextPage();
			});

			this.lastBut.addEventListener("click", () => {
				this.setPage(this.max);
			});

			if (this.table.options.paginationElement) {
				this.element = this.table.options.paginationElement;
			}

			if (this.pageSizeSelect) {
				this.element.appendChild(this.pageSizeSelect);
				this.pageSizeSelect.addEventListener("change", (e) => {
					this.setPageSize(this.pageSizeSelect.value == "true" ? true : this.pageSizeSelect.value);
					this.setPage(1);
				});
			}

			//append to DOM
			this.element.appendChild(this.firstBut);
			this.element.appendChild(this.prevBut);
			this.element.appendChild(this.pagesElement);
			this.element.appendChild(this.nextBut);
			this.element.appendChild(this.lastBut);

			if (!this.table.options.paginationElement) {
				if (this.table.options.paginationCounter) {

					if (this.table.options.paginationCounterElement) {
						if (this.table.options.paginationCounterElement instanceof HTMLElement) {
							this.table.options.paginationCounterElement.appendChild(this.pageCounterElement);
						} else if (typeof this.table.options.paginationCounterElement === "string") {
							paginationCounterHolder = document.querySelector(this.table.options.paginationCounterElement);

							if (paginationCounterHolder) {
								paginationCounterHolder.appendChild(this.pageCounterElement);
							} else {
								console.warn("Pagination Error - Unable to find element matching paginationCounterElement selector:", this.table.options.paginationCounterElement);
							}
						}
					} else {
						this.footerAppend(this.pageCounterElement);
					}

				}

				this.footerAppend(this.element);
			}

			this.page = this.table.options.paginationInitialPage;
			this.count = this.table.options.paginationButtonCount;
		}

		//set default values
		this.mode = this.table.options.paginationMode;
	}

	initializeProgressive(mode) {
		this.initializePaginator(true);
		this.mode = "progressive_" + mode;
		this.progressiveLoad = true;
	}

	trackChanges() {
		this.dispatch("page-changed");
	}

	//calculate maximum page from number of rows
	setMaxRows(rowCount) {
		if (!rowCount) {
			this.max = 1;
		} else {
			this.max = this.size === true ? 1 : Math.ceil(rowCount / this.size);
		}

		if (this.page > this.max) {
			this.page = this.max;
		}
	}

	//reset to first page without triggering action
	reset(force) {
		if (!this.initialLoad) {
			if (this.mode == "local" || force) {
				this.page = 1;
				this.trackChanges();
			}
		}
	}

	//set the maximum page
	setMaxPage(max) {

		max = parseInt(max);

		this.max = max || 1;

		if (this.page > this.max) {
			this.page = this.max;
			this.trigger();
		}
	}

	//set current page number
	setPage(page) {
		switch (page) {
			case "first":
				return this.setPage(1);

			case "prev":
				return this.previousPage();

			case "next":
				return this.nextPage();

			case "last":
				return this.setPage(this.max);
		}

		page = parseInt(page);

		if ((page > 0 && page <= this.max) || this.mode !== "local") {
			this.page = page;

			this.trackChanges();

			return this.trigger();
		} else {
			console.warn("Pagination Error - Requested page is out of range of 1 - " + this.max + ":", page);
			return Promise.reject();
		}
	}

	setPageToRow(row) {
		var rows = this.displayRows(-1);
		var index = rows.indexOf(row);

		if (index > -1) {
			var page = this.size === true ? 1 : Math.ceil((index + 1) / this.size);

			return this.setPage(page);
		} else {
			console.warn("Pagination Error - Requested row is not visible");
			return Promise.reject();
		}
	}

	setPageSize(size) {
		if (size !== true) {
			size = parseInt(size);
		}

		if (size > 0) {
			this.size = size;
			this.dispatchExternal("pageSizeChanged", size);
		}

		if (this.pageSizeSelect) {
			// this.pageSizeSelect.value = size;
			this.generatePageSizeSelectList();
		}

		this.trackChanges();
	}

	_setPageCounter(totalRows, size, currentRow) {
		var content;

		if (this.pageCounter) {

			if (this.mode === "remote") {
				size = this.size;
				currentRow = ((this.page - 1) * this.size) + 1;
				totalRows = this.remoteRowCountEstimate;
			}

			content = this.pageCounter.call(this, size, currentRow, this.page, totalRows, this.max);

			switch (typeof content) {
				case "object":
					if (content instanceof Node) {

						//clear previous cell contents
						while (this.pageCounterElement.firstChild) this.pageCounterElement.removeChild(this.pageCounterElement.firstChild);

						this.pageCounterElement.appendChild(content);
					} else {
						this.pageCounterElement.innerHTML = "";

						if (content != null) {
							console.warn("Page Counter Error - Page Counter has returned a type of object, the only valid page counter object return is an instance of Node, the page counter returned:", content);
						}
					}
					break;
				case "undefined":
					this.pageCounterElement.innerHTML = "";
					break;
				default:
					this.pageCounterElement.innerHTML = content;
			}
		}
	}

	//setup the pagination buttons
	_setPageButtons() {
		let leftSize = Math.floor((this.count - 1) / 2);
		let rightSize = Math.ceil((this.count - 1) / 2);
		let min = this.max - this.page + leftSize + 1 < this.count ? this.max - this.count + 1 : Math.max(this.page - leftSize, 1);
		let max = this.page <= rightSize ? Math.min(this.count, this.max) : Math.min(this.page + rightSize, this.max);

		while (this.pagesElement.firstChild) this.pagesElement.removeChild(this.pagesElement.firstChild);

		if (this.page == 1) {
			this.firstBut.disabled = true;
			this.prevBut.disabled = true;
		} else {
			this.firstBut.disabled = false;
			this.prevBut.disabled = false;
		}

		if (this.page == this.max) {
			this.lastBut.disabled = true;
			this.nextBut.disabled = true;
		} else {
			this.lastBut.disabled = false;
			this.nextBut.disabled = false;
		}

		for (let i = min; i <= max; i++) {
			if (i > 0 && i <= this.max) {
				this.pagesElement.appendChild(this._generatePageButton(i));
			}
		}

		this.footerRedraw();
	}

	_generatePageButton(page) {
		var button = document.createElement("button");

		button.classList.add("tabulator-page");
		if (page == this.page) {
			button.classList.add("active");
		}

		button.setAttribute("type", "button");
		button.setAttribute("role", "button");

		this.langBind("pagination|page_title", (value) => {
			button.setAttribute("aria-label", value + " " + page);
			button.setAttribute("title", value + " " + page);
		});

		button.setAttribute("data-page", page);
		button.textContent = page;

		button.addEventListener("click", (e) => {
			this.setPage(page);
		});

		return button;
	}

	//previous page
	previousPage() {
		if (this.page > 1) {
			this.page--;

			this.trackChanges();

			return this.trigger();

		} else {
			console.warn("Pagination Error - Previous page would be less than page 1:", 0);
			return Promise.reject();
		}
	}

	//next page
	nextPage() {
		if (this.page < this.max) {
			this.page++;

			this.trackChanges();

			return this.trigger();

		} else {
			if (!this.progressiveLoad) {
				console.warn("Pagination Error - Next page would be greater than maximum page of " + this.max + ":", this.max + 1);
			}
			return Promise.reject();
		}
	}

	//return current page number
	getPage() {
		return this.page;
	}

	//return max page number
	getPageMax() {
		return this.max;
	}

	getPageSize(size) {
		return this.size;
	}

	getMode() {
		return this.mode;
	}

	//return appropriate rows for current page
	getRows(data) {
		var actualRowPageSize = 0,
		output, start, end, actualStartRow;

		var actualRows = data.filter((row) => {
			return row.type === "row";
		});

		if (this.mode == "local") {
			output = [];

			this.setMaxRows(data.length);

			if (this.size === true) {
				start = 0;
				end = data.length;
			} else {
				start = this.size * (this.page - 1);
				end = start + parseInt(this.size);
			}

			this._setPageButtons();

			for (let i = start; i < end; i++) {
				let row = data[i];

				if (row) {
					output.push(row);

					if (row.type === "row") {
						if (!actualStartRow) {
							actualStartRow = row;
						}

						actualRowPageSize++;
					}
				}
			}

			this._setPageCounter(actualRows.length, actualRowPageSize, actualStartRow ? (actualRows.indexOf(actualStartRow) + 1) : 0);

			return output;
		} else {
			this._setPageButtons();
			this._setPageCounter(actualRows.length);

			return data.slice(0);
		}
	}

	trigger() {
		var left;

		switch (this.mode) {
			case "local":
				left = this.table.rowManager.scrollLeft;

				this.refreshData();
				this.table.rowManager.scrollHorizontal(left);

				this.dispatchExternal("pageLoaded", this.getPage());

				return Promise.resolve();

			case "remote":
				this.dataChanging = true;
				return this.reloadData(null)
					.finally(() => {
						this.dataChanging = false;
					});

			case "progressive_load":
			case "progressive_scroll":
				return this.reloadData(null, true);

			default:
				console.warn("Pagination Error - no such pagination mode:", this.mode);
				return Promise.reject();
		}
	}

	_parseRemoteData(data) {
		var margin, paginationOutOfRange;

		if (typeof data.last_page === "undefined") {
			console.warn("Remote Pagination Error - Server response missing '" + (this.options("dataReceiveParams").last_page || "last_page") + "' property");
		}

		if (data.data) {
			this.max = parseInt(data.last_page) || 1;

			this.remoteRowCountEstimate = typeof data.last_row !== "undefined" ? data.last_row : (data.last_page * this.size - (this.page == data.last_page ? (this.size - data.data.length) : 0));

			if (this.progressiveLoad) {
				switch (this.mode) {
					case "progressive_load":

						if (this.page == 1) {
							this.table.rowManager.setData(data.data, false, this.page == 1);
						} else {
							this.table.rowManager.addRows(data.data);
						}

						if (this.page < this.max) {
							setTimeout(() => {
								this.nextPage();
							}, this.table.options.progressiveLoadDelay);
						}
						break;

					case "progressive_scroll":
						data = this.page === 1 ? data.data : this.table.rowManager.getData().concat(data.data);

						this.table.rowManager.setData(data, this.page !== 1, this.page == 1);

						margin = this.table.options.progressiveLoadScrollMargin || (this.table.rowManager.element.clientHeight * 2);

						if (this.table.rowManager.element.scrollHeight <= (this.table.rowManager.element.clientHeight + margin)) {
							if (this.page < this.max) {
								setTimeout(() => {
									this.nextPage();
								});
							}
						}
						break;
				}

				return false;
			} else {

				if (this.page > this.max) {
					console.warn("Remote Pagination Error - Server returned last page value lower than the current page");

					paginationOutOfRange = this.options('paginationOutOfRange');

					if (paginationOutOfRange) {
						return this.setPage(typeof paginationOutOfRange === 'function' ? paginationOutOfRange.call(this, this.page, this.max) : paginationOutOfRange);
					}
				}

				// left = this.table.rowManager.scrollLeft;
				this.dispatchExternal("pageLoaded", this.getPage());
				// this.table.rowManager.scrollHorizontal(left);
				// this.table.columnManager.scrollHorizontal(left);
			}

		} else {
			console.warn("Remote Pagination Error - Server response missing '" + (this.options("dataReceiveParams").data || "data") + "' property");
		}

		return data.data;
	}

	//handle the footer element being redrawn
	footerRedraw() {
		var footer = this.table.footerManager.containerElement;

		if ((Math.ceil(footer.clientWidth) - footer.scrollWidth) < 0) {
			this.pagesElement.style.display = 'none';
		} else {
			this.pagesElement.style.display = '';

			if ((Math.ceil(footer.clientWidth) - footer.scrollWidth) < 0) {
				this.pagesElement.style.display = 'none';
			}
		}
	}
}

class ResizeColumns extends Module{

	static moduleName = "resizeColumns";

	constructor(table){
		super(table);
		
		this.startColumn = false;
		this.startX = false;
		this.startWidth = false;
		this.latestX = false;
		this.handle = null;
		this.initialNextColumn = null;
		this.nextColumn = null;
		
		this.initialized = false;
		this.registerColumnOption("resizable", true);
		this.registerTableOption("resizableColumnFit", false);
		this.registerTableOption("resizableColumnGuide", false);
	}
	
	initialize(){
		this.subscribe("column-rendered", this.layoutColumnHeader.bind(this));
	}
	
	initializeEventWatchers(){
		if(!this.initialized){
			
			this.subscribe("cell-rendered", this.layoutCellHandles.bind(this));
			this.subscribe("cell-delete", this.deInitializeComponent.bind(this));
			
			this.subscribe("cell-height", this.resizeHandle.bind(this));
			this.subscribe("column-moved", this.columnLayoutUpdated.bind(this));
			
			this.subscribe("column-hide", this.deInitializeColumn.bind(this));
			this.subscribe("column-show", this.columnLayoutUpdated.bind(this));
			this.subscribe("column-width", this.columnWidthUpdated.bind(this));
			
			this.subscribe("column-delete", this.deInitializeComponent.bind(this));
			this.subscribe("column-height", this.resizeHandle.bind(this));
			
			this.initialized = true;
		}
	}
	
	
	layoutCellHandles(cell){
		if(cell.row.type === "row"){
			this.deInitializeComponent(cell);
			this.initializeColumn("cell", cell, cell.column, cell.element);
		}
	}
	
	layoutColumnHeader(column){
		if(column.definition.resizable){
			this.initializeEventWatchers();
			this.deInitializeComponent(column);
			this.initializeColumn("header", column, column, column.element);
		}
	}
	
	columnLayoutUpdated(column){
		var prev = column.prevColumn();
		
		this.reinitializeColumn(column);
		
		if(prev){
			this.reinitializeColumn(prev);
		}
	}
	
	columnWidthUpdated(column){
		if(column.modules.frozen){
			if(this.table.modules.frozenColumns.leftColumns.includes(column)){
				this.table.modules.frozenColumns.leftColumns.forEach((col) => {
					this.reinitializeColumn(col);
				});
			}else if(this.table.modules.frozenColumns.rightColumns.includes(column)){
				this.table.modules.frozenColumns.rightColumns.forEach((col) => {
					this.reinitializeColumn(col);
				});
			}
		}
	}

	frozenColumnOffset(column){
		var offset = false;

		if(column.modules.frozen){
			offset = column.modules.frozen.marginValue; 

			if(column.modules.frozen.position === "left"){
				offset += column.getWidth() - 3;
			}else {
				if(offset){
					offset -= 3;
				}
			}
		}

		return offset !== false ? offset + "px" : false;
	}
	
	reinitializeColumn(column){
		var frozenOffset = this.frozenColumnOffset(column);
		
		column.cells.forEach((cell) => {
			if(cell.modules.resize && cell.modules.resize.handleEl){
				if(frozenOffset){
					cell.modules.resize.handleEl.style[column.modules.frozen.position] = frozenOffset;
					cell.modules.resize.handleEl.style["z-index"] = 11;
				}
				
				cell.element.after(cell.modules.resize.handleEl);
			}
		});
		
		if(column.modules.resize && column.modules.resize.handleEl){
			if(frozenOffset){
				column.modules.resize.handleEl.style[column.modules.frozen.position] = frozenOffset;
			}
			
			column.element.after(column.modules.resize.handleEl);
		}
	}
	
	initializeColumn(type, component, column, element){
		var self = this,
		variableHeight = false,
		mode = column.definition.resizable,
		config = {},
		nearestColumn = column.getLastColumn();
		
		//set column resize mode
		if(type === "header"){
			variableHeight = column.definition.formatter == "textarea" || column.definition.variableHeight;
			config = {variableHeight:variableHeight};
		}
		
		if((mode === true || mode == type) && this._checkResizability(nearestColumn)){
			
			var handle = document.createElement('span');
			handle.className = "tabulator-col-resize-handle";
			
			handle.addEventListener("click", function(e){
				e.stopPropagation();
			});
			
			var handleDown = function(e){
				self.startColumn = column;
				self.initialNextColumn = self.nextColumn = nearestColumn.nextColumn();
				self._mouseDown(e, nearestColumn, handle);
			};
			
			handle.addEventListener("mousedown", handleDown);
			handle.addEventListener("touchstart", handleDown, {passive: true});
			
			//resize column on  double click
			handle.addEventListener("dblclick", (e) => {
				var oldWidth = nearestColumn.getWidth();
				
				e.stopPropagation();
				nearestColumn.reinitializeWidth(true);
				
				if(oldWidth !== nearestColumn.getWidth()){
					self.dispatch("column-resized", nearestColumn);
					self.dispatchExternal("columnResized", nearestColumn.getComponent());
				}
			});
			
			if(column.modules.frozen){
				handle.style.position = "sticky";
				handle.style[column.modules.frozen.position] = this.frozenColumnOffset(column);
			}
			
			config.handleEl = handle;
			
			if(element.parentNode && column.visible){
				element.after(handle);			
			}
		}
		
		component.modules.resize = config;
	}
	
	deInitializeColumn(column){
		this.deInitializeComponent(column);
		
		column.cells.forEach((cell) => {
			this.deInitializeComponent(cell);
		});
	}
	
	deInitializeComponent(component){
		var handleEl;
		
		if(component.modules.resize){
			handleEl = component.modules.resize.handleEl;
			
			if(handleEl && handleEl.parentElement){
				handleEl.parentElement.removeChild(handleEl);
			}
		}
	}
	
	resizeHandle(component, height){
		if(component.modules.resize && component.modules.resize.handleEl){
			component.modules.resize.handleEl.style.height = height;
		}
	}
	
	resize(e, column){
		var x = typeof e.clientX === "undefined" ? e.touches[0].clientX : e.clientX,
		startDiff = x - this.startX,
		moveDiff = x - this.latestX,
		blockedBefore, blockedAfter;

		this.latestX = x;

		if(this.table.rtl){
			startDiff = -startDiff;
			moveDiff = -moveDiff;
		}

		blockedBefore = column.width == column.minWidth || column.width == column.maxWidth;

		column.setWidth(this.startWidth + startDiff);

		blockedAfter = column.width == column.minWidth || column.width == column.maxWidth;

		if(moveDiff < 0){
			this.nextColumn = this.initialNextColumn;
		}

		if(this.table.options.resizableColumnFit && this.nextColumn && !(blockedBefore && blockedAfter)){
			let colWidth = this.nextColumn.getWidth();

			if(moveDiff > 0){
				if(colWidth <= this.nextColumn.minWidth){
					this.nextColumn = this.nextColumn.nextColumn();
				}
			}

			if(this.nextColumn){
				this.nextColumn.setWidth(this.nextColumn.getWidth() - moveDiff);
			}
		}

		this.table.columnManager.rerenderColumns(true);

		if(!this.table.browserSlow && column.modules.resize && column.modules.resize.variableHeight){
			column.checkCellHeights();
		}
	}

	calcGuidePosition(e, column, handle) {
		var mouseX = typeof e.clientX === "undefined" ? e.touches[0].clientX : e.clientX,
		handleX = handle.getBoundingClientRect().x - this.table.element.getBoundingClientRect().x,
		tableX = this.table.element.getBoundingClientRect().x,
		columnX = column.element.getBoundingClientRect().left - tableX,
		mouseDiff = mouseX - this.startX,
		pos = Math.max(handleX + mouseDiff, columnX + column.minWidth);

		if(column.maxWidth){
			pos = Math.min(pos, columnX + column.maxWidth);
		}

		return pos;
	}

	_checkResizability(column){
		return column.definition.resizable;
	}
	
	_mouseDown(e, column, handle){
		var self = this,
		guideEl;

		this.dispatchExternal("columnResizing", column.getComponent());

		if(self.table.options.resizableColumnGuide){
			guideEl = document.createElement("span");
			guideEl.classList.add('tabulator-col-resize-guide');
			self.table.element.appendChild(guideEl);
			setTimeout(() => {
				guideEl.style.left = self.calcGuidePosition(e, column, handle) + "px";
			});
		}

		self.table.element.classList.add("tabulator-block-select");

		function mouseMove(e){
			if(self.table.options.resizableColumnGuide){
				guideEl.style.left = self.calcGuidePosition(e, column, handle) + "px";
			}else {
				self.resize(e, column);
			}
		}
		
		function mouseUp(e){
			if(self.table.options.resizableColumnGuide){
				self.resize(e, column);
				guideEl.remove();
			}
			
			//block editor from taking action while resizing is taking place
			if(self.startColumn.modules.edit){
				self.startColumn.modules.edit.blocked = false;
			}
			
			if(self.table.browserSlow && column.modules.resize && column.modules.resize.variableHeight){
				column.checkCellHeights();
			}
			
			document.body.removeEventListener("mouseup", mouseUp);
			document.body.removeEventListener("mousemove", mouseMove);
			
			handle.removeEventListener("touchmove", mouseMove);
			handle.removeEventListener("touchend", mouseUp);
			
			self.table.element.classList.remove("tabulator-block-select");
			
			if(self.startWidth !== column.getWidth()){
				self.table.columnManager.verticalAlignHeaders();

				self.dispatch("column-resized", column);
				self.dispatchExternal("columnResized", column.getComponent());
			}
		}
		
		e.stopPropagation(); //prevent resize from interfering with movable columns
		
		//block editor from taking action while resizing is taking place
		if(self.startColumn.modules.edit){
			self.startColumn.modules.edit.blocked = true;
		}
		
		self.startX = typeof e.clientX === "undefined" ? e.touches[0].clientX : e.clientX;
		self.latestX = self.startX;
		self.startWidth = column.getWidth();
		
		document.body.addEventListener("mousemove", mouseMove);
		document.body.addEventListener("mouseup", mouseUp);
		handle.addEventListener("touchmove", mouseMove, {passive: true});
		handle.addEventListener("touchend", mouseUp);
	}
}

//public row object
class RowComponent {

	constructor (row){
		this._row = row;

		return new Proxy(this, {
			get: function(target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				}else {
					return target._row.table.componentFunctionBinder.handle("row", target._row, name);
				}
			}
		});
	}

	getData(transform){
		return this._row.getData(transform);
	}

	getElement(){
		return this._row.getElement();
	}

	getCells(){
		var cells = [];

		this._row.getCells().forEach(function(cell){
			cells.push(cell.getComponent());
		});

		return cells;
	}

	getCell(column){
		var cell = this._row.getCell(column);
		return cell ? cell.getComponent() : false;
	}

	getIndex(){
		return this._row.getData("data")[this._row.table.options.index];
	}

	getPosition(){
		return this._row.getPosition();
	}

	watchPosition(callback){
		return this._row.watchPosition(callback);
	}

	delete(){
		return this._row.delete();
	}

	scrollTo(position, ifVisible){
		return this._row.table.rowManager.scrollToRow(this._row, position, ifVisible);
	}

	move(to, after){
		this._row.moveToRow(to, after);
	}

	update(data){
		return this._row.updateData(data);
	}

	normalizeHeight(){
		this._row.normalizeHeight(true);
	}

	_getSelf(){
		return this._row;
	}

	reformat(){
		return this._row.reinitialize();
	}

	getTable(){
		return this._row.table;
	}

	getNextRow(){
		var row = this._row.nextRow();
		return row ? row.getComponent() : row;
	}

	getPrevRow(){
		var row = this._row.prevRow();
		return row ? row.getComponent() : row;
	}
}

function rowSelection(cell, formatterParams, onRendered){
	var checkbox = document.createElement("input");
	var blocked = false;

	checkbox.type = 'checkbox';

	checkbox.setAttribute("aria-label", "Select Row");
	
	if(this.table.modExists("selectRow", true)){

		checkbox.addEventListener("click", (e) => {
			e.stopPropagation();
		});

		if(typeof cell.getRow == 'function'){
			var row = cell.getRow();

			if(row instanceof RowComponent){

				checkbox.addEventListener("change", (e) => {
					if(this.table.options.selectableRowsRangeMode === "click"){
						if(!blocked){
							row.toggleSelect();
						}else {
							blocked = false;
						}
					}else {
						row.toggleSelect();
					}
				});

				if(this.table.options.selectableRowsRangeMode === "click"){
					checkbox.addEventListener("click", (e) => {
						blocked = true;
						this.table.modules.selectRow.handleComplexRowClick(row._row, e);
					});
				}

				checkbox.checked = row.isSelected && row.isSelected();
				this.table.modules.selectRow.registerRowSelectCheckbox(row, checkbox);
			}else {
				checkbox = "";
			}
		}else {
			checkbox.addEventListener("change", (e) => {
				if(this.table.modules.selectRow.selectedRows.length){
					this.table.deselectRow();
				}else {
					this.table.selectRow(formatterParams.rowRange);
				}
			});

			this.table.modules.selectRow.registerHeaderSelectCheckbox(checkbox);
		}
	}

	return checkbox;
}

var extensions = {
	format:{
		formatters:{
			rowSelection:rowSelection,
		}
	}
};

class SelectRow extends Module{

	static moduleName = "selectRow";
	static moduleExtensions = extensions;
	
	constructor(table){
		super(table);
		
		this.selecting = false; //flag selecting in progress
		this.lastClickedRow = false; //last clicked row
		this.selectPrev = []; //hold previously selected element for drag drop selection
		this.selectedRows = []; //hold selected rows
		this.headerCheckboxElement = null; // hold header select element
		
		this.registerTableOption("selectableRows", "highlight"); //highlight rows on hover
		this.registerTableOption("selectableRowsRangeMode", "drag");  //highlight rows on hover
		this.registerTableOption("selectableRowsRollingSelection", true); //roll selection once maximum number of selectable rows is reached
		this.registerTableOption("selectableRowsPersistence", true); // maintain selection when table view is updated
		this.registerTableOption("selectableRowsCheck", function(data, row){return true;}); //check whether row is selectable
		
		this.registerTableFunction("selectRow", this.selectRows.bind(this));
		this.registerTableFunction("deselectRow", this.deselectRows.bind(this));
		this.registerTableFunction("toggleSelectRow", this.toggleRow.bind(this));
		this.registerTableFunction("getSelectedRows", this.getSelectedRows.bind(this));
		this.registerTableFunction("getSelectedData", this.getSelectedData.bind(this));
		
		//register component functions
		this.registerComponentFunction("row", "select", this.selectRows.bind(this));
		this.registerComponentFunction("row", "deselect", this.deselectRows.bind(this));
		this.registerComponentFunction("row", "toggleSelect", this.toggleRow.bind(this));
		this.registerComponentFunction("row", "isSelected", this.isRowSelected.bind(this));
	}
	
	initialize(){

		this.deprecatedOptionsCheck();

		if(this.table.options.selectableRows === "highlight" && this.table.options.selectableRange){
			this.table.options.selectableRows = false;
		}

		if(this.table.options.selectableRows !== false){
			this.subscribe("row-init", this.initializeRow.bind(this));
			this.subscribe("row-deleting", this.rowDeleted.bind(this));
			this.subscribe("rows-wipe", this.clearSelectionData.bind(this));
			this.subscribe("rows-retrieve", this.rowRetrieve.bind(this));
			
			if(this.table.options.selectableRows && !this.table.options.selectableRowsPersistence){
				this.subscribe("data-refreshing", this.deselectRows.bind(this));
			}
		}
	}

	deprecatedOptionsCheck(){
		// this.deprecationCheck("selectable", "selectableRows", true);
		// this.deprecationCheck("selectableRollingSelection", "selectableRowsRollingSelection", true);
		// this.deprecationCheck("selectableRangeMode", "selectableRowsRangeMode", true);
		// this.deprecationCheck("selectablePersistence", "selectableRowsPersistence", true);
		// this.deprecationCheck("selectableCheck", "selectableRowsCheck", true);
	}
	
	rowRetrieve(type, prevValue){
		return type === "selected" ? this.selectedRows : prevValue;
	}
	
	rowDeleted(row){
		this._deselectRow(row, true);
	}
	
	clearSelectionData(silent){
		var prevSelected = this.selectedRows.length;

		this.selecting = false;
		this.lastClickedRow = false;
		this.selectPrev = [];
		this.selectedRows = [];
		
		if(prevSelected && silent !== true){
			this._rowSelectionChanged();
		}
	}
	
	initializeRow(row){
		var self = this,
		selectable = self.checkRowSelectability(row),
		element = row.getElement();
		
		// trigger end of row selection
		var endSelect = function(){
			
			setTimeout(function(){
				self.selecting = false;
			}, 50);
			
			document.body.removeEventListener("mouseup", endSelect);
		};
		
		row.modules.select = {selected:false};

		element.classList.toggle("tabulator-selectable", selectable);
		element.classList.toggle("tabulator-unselectable", !selectable);
		
		//set row selection class
		if(self.checkRowSelectability(row)){			
			if(self.table.options.selectableRows && self.table.options.selectableRows != "highlight"){
				if(self.table.options.selectableRowsRangeMode === "click"){
					element.addEventListener("click", this.handleComplexRowClick.bind(this, row));
				}else {
					element.addEventListener("click", function(e){
						if(!self.table.modExists("edit") || !self.table.modules.edit.getCurrentCell()){
							self.table._clearSelection();
						}
						
						if(!self.selecting){
							self.toggleRow(row);
						}
					});
					
					element.addEventListener("mousedown", function(e){
						if(e.shiftKey){
							self.table._clearSelection();
							
							self.selecting = true;
							
							self.selectPrev = [];
							
							document.body.addEventListener("mouseup", endSelect);
							document.body.addEventListener("keyup", endSelect);
							
							self.toggleRow(row);
							
							return false;
						}
					});
					
					element.addEventListener("mouseenter", function(e){
						if(self.selecting){
							self.table._clearSelection();
							self.toggleRow(row);
							
							if(self.selectPrev[1] == row){
								self.toggleRow(self.selectPrev[0]);
							}
						}
					});
					
					element.addEventListener("mouseout", function(e){
						if(self.selecting){
							self.table._clearSelection();
							self.selectPrev.unshift(row);
						}
					});
				}
			}
		}
	}
	
	handleComplexRowClick(row, e){
		if(e.shiftKey){
			this.table._clearSelection();
			this.lastClickedRow = this.lastClickedRow || row;
			
			var lastClickedRowIdx = this.table.rowManager.getDisplayRowIndex(this.lastClickedRow);
			var rowIdx = this.table.rowManager.getDisplayRowIndex(row);
			
			var fromRowIdx = lastClickedRowIdx <= rowIdx ? lastClickedRowIdx : rowIdx;
			var toRowIdx = lastClickedRowIdx >= rowIdx ? lastClickedRowIdx : rowIdx;
			
			var rows = this.table.rowManager.getDisplayRows().slice(0);
			var toggledRows = rows.splice(fromRowIdx, toRowIdx - fromRowIdx + 1);
			
			if(e.ctrlKey || e.metaKey){
				toggledRows.forEach((toggledRow)=>{
					if(toggledRow !== this.lastClickedRow){
						
						if(this.table.options.selectableRows !== true && !this.isRowSelected(row)){
							if(this.selectedRows.length < this.table.options.selectableRows){
								this.toggleRow(toggledRow);
							}
						}else {
							this.toggleRow(toggledRow);
						}
					}
				});
				this.lastClickedRow = row;
			}else {
				this.deselectRows(undefined, true);
				
				if(this.table.options.selectableRows !== true){
					if(toggledRows.length > this.table.options.selectableRows){
						toggledRows = toggledRows.slice(0, this.table.options.selectableRows);
					}
				}
				
				this.selectRows(toggledRows);
			}
			this.table._clearSelection();
		}
		else if(e.ctrlKey || e.metaKey){
			this.toggleRow(row);
			this.lastClickedRow = row;
		}else {
			this.deselectRows(undefined, true);
			this.selectRows(row);
			this.lastClickedRow = row;
		}
	}

	checkRowSelectability(row){
		if(row && row.type === "row"){
			return this.table.options.selectableRowsCheck.call(this.table, row.getComponent());
		}

		return false;
	}
	
	//toggle row selection
	toggleRow(row){
		if(this.checkRowSelectability(row)){
			if(row.modules.select && row.modules.select.selected){
				this._deselectRow(row);
			}else {
				this._selectRow(row);
			}
		}
	}
	
	//select a number of rows
	selectRows(rows){
		var changes = [], 
		rowMatch, change;
		
		switch(typeof rows){
			case "undefined":
				rowMatch = this.table.rowManager.rows;
				break;
			
			case "number":
				rowMatch = this.table.rowManager.findRow(rows);
				break;
				
			case "string":
				rowMatch = this.table.rowManager.findRow(rows);
			
				if(!rowMatch){
					rowMatch = this.table.rowManager.getRows(rows);
				}
				break;
			
			default:
				rowMatch = rows;
				break;
		}

		if(Array.isArray(rowMatch)){
			if(rowMatch.length){
				rowMatch.forEach((row) => {
					change = this._selectRow(row, true, true);

					if(change){
						changes.push(change);
					}
				});

				this._rowSelectionChanged(false, changes);
			}
		}else {
			if(rowMatch){
				this._selectRow(rowMatch, false, true);
			}
		}	
	}
	
	//select an individual row
	_selectRow(rowInfo, silent, force){
		//handle max row count
		if(!isNaN(this.table.options.selectableRows) && this.table.options.selectableRows !== true && !force){
			if(this.selectedRows.length >= this.table.options.selectableRows){
				if(this.table.options.selectableRowsRollingSelection){
					this._deselectRow(this.selectedRows[0]);
				}else {
					return false;
				}
			}
		}
		
		var row = this.table.rowManager.findRow(rowInfo);
		
		if(row){
			if(this.selectedRows.indexOf(row) == -1){
				row.getElement().classList.add("tabulator-selected");
				if(!row.modules.select){
					row.modules.select = {};
				}
				
				row.modules.select.selected = true;
				if(row.modules.select.checkboxEl){
					row.modules.select.checkboxEl.checked = true;
				}
				
				this.selectedRows.push(row);
				
				if(this.table.options.dataTreeSelectPropagate){
					this.childRowSelection(row, true);
				}
				
				this.dispatchExternal("rowSelected", row.getComponent());
				
				this._rowSelectionChanged(silent, row);

				return row;
			}
		}else {
			if(!silent){
				console.warn("Selection Error - No such row found, ignoring selection:" + rowInfo);
			}
		}
	}
	
	isRowSelected(row){
		return this.selectedRows.indexOf(row) !== -1;
	}
	
	//deselect a number of rows
	deselectRows(rows, silent){
		var changes = [], 
		rowMatch, change;
		
		switch(typeof rows){
			case "undefined":
				rowMatch = Object.assign([], this.selectedRows);
				break;

			case "number":
				rowMatch = this.table.rowManager.findRow(rows);
				break;
			
			case "string":
				rowMatch = this.table.rowManager.findRow(rows);
			
				if(!rowMatch){
					rowMatch = this.table.rowManager.getRows(rows);
				}
				break;
			
			default:
				rowMatch = rows;
				break;
		}

		if(Array.isArray(rowMatch)){
			if(rowMatch.length){
				rowMatch.forEach((row) => {
					change = this._deselectRow(row, true, true);

					if(change){
						changes.push(change);
					}
				});

				this._rowSelectionChanged(silent, [], changes);
			}
		}else {
			if(rowMatch){
				this._deselectRow(rowMatch, silent, true);
			}
		}	
	}
	
	//deselect an individual row
	_deselectRow(rowInfo, silent){
		var self = this,
		row = self.table.rowManager.findRow(rowInfo),
		index, element;
		
		if(row){
			index = self.selectedRows.findIndex(function(selectedRow){
				return selectedRow == row;
			});
			
			if(index > -1){

				element = row.getElement();
				
				if(element){
					element.classList.remove("tabulator-selected");
				}
				
				if(!row.modules.select){
					row.modules.select = {};
				}
				
				row.modules.select.selected = false;
				if(row.modules.select.checkboxEl){
					row.modules.select.checkboxEl.checked = false;
				}
				self.selectedRows.splice(index, 1);
				
				if(this.table.options.dataTreeSelectPropagate){
					this.childRowSelection(row, false);
				}
				
				this.dispatchExternal("rowDeselected", row.getComponent());
				
				self._rowSelectionChanged(silent, undefined, row);

				return row;
			}
		}else {
			if(!silent){
				console.warn("Deselection Error - No such row found, ignoring selection:" + rowInfo);
			}
		}
	}
	
	getSelectedData(){
		var data = [];
		
		this.selectedRows.forEach(function(row){
			data.push(row.getData());
		});
		
		return data;
	}
	
	getSelectedRows(){
		var rows = [];
		
		this.selectedRows.forEach(function(row){
			rows.push(row.getComponent());
		});
		
		return rows;
	}
	
	_rowSelectionChanged(silent, selected = [], deselected = []){
		if(this.headerCheckboxElement){
			if(this.selectedRows.length === 0){
				this.headerCheckboxElement.checked = false;
				this.headerCheckboxElement.indeterminate = false;
			} else if(this.table.rowManager.rows.length === this.selectedRows.length){
				this.headerCheckboxElement.checked = true;
				this.headerCheckboxElement.indeterminate = false;
			} else {
				this.headerCheckboxElement.indeterminate = true;
				this.headerCheckboxElement.checked = false;
			}
		}
		
		if(!silent){
			if(!Array.isArray(selected)){
				selected = [selected];
			}

			selected = selected.map(row => row.getComponent());

			if(!Array.isArray(deselected)){
				deselected = [deselected];
			}

			deselected = deselected.map(row => row.getComponent());

			this.dispatchExternal("rowSelectionChanged", this.getSelectedData(), this.getSelectedRows(), selected, deselected);
		}
	}
	
	registerRowSelectCheckbox (row, element) {
		if(!row._row.modules.select){
			row._row.modules.select = {};
		}
		
		row._row.modules.select.checkboxEl = element;
	}
	
	registerHeaderSelectCheckbox (element) {
		this.headerCheckboxElement = element;
	}
	
	childRowSelection(row, select){
		var children = this.table.modules.dataTree.getChildren(row, true, true);
		
		if(select){
			for(let child of children){
				this._selectRow(child, true);
			}
		}else {
			for(let child of children){
				this._deselectRow(child, true);
			}
		}
	}
}

//sort numbers
function number(a, b, aRow, bRow, column, dir, params){
	var alignEmptyValues = params.alignEmptyValues;
	var decimal = params.decimalSeparator;
	var thousand = params.thousandSeparator;
	var emptyAlign = 0;

	a = String(a);
	b = String(b);

	if(thousand){
		a = a.split(thousand).join("");
		b = b.split(thousand).join("");
	}

	if(decimal){
		a = a.split(decimal).join(".");
		b = b.split(decimal).join(".");
	}

	a = parseFloat(a);
	b = parseFloat(b);

	//handle non numeric values
	if(isNaN(a)){
		emptyAlign =  isNaN(b) ? 0 : -1;
	}else if(isNaN(b)){
		emptyAlign =  1;
	}else {
		//compare valid values
		return a - b;
	}

	//fix empty values in position
	if((alignEmptyValues === "top" && dir === "desc") || (alignEmptyValues === "bottom" && dir === "asc")){
		emptyAlign *= -1;
	}

	return emptyAlign;
}

//sort strings
function string(a, b, aRow, bRow, column, dir, params){
	var alignEmptyValues = params.alignEmptyValues;
	var emptyAlign = 0;
	var locale;

	//handle empty values
	if(!a){
		emptyAlign =  !b ? 0 : -1;
	}else if(!b){
		emptyAlign =  1;
	}else {
		//compare valid values
		switch(typeof params.locale){
			case "boolean":
				if(params.locale){
					locale = this.langLocale();
				}
				break;
			case "string":
				locale = params.locale;
				break;
		}

		return String(a).toLowerCase().localeCompare(String(b).toLowerCase(), locale);
	}

	//fix empty values in position
	if((alignEmptyValues === "top" && dir === "desc") || (alignEmptyValues === "bottom" && dir === "asc")){
		emptyAlign *= -1;
	}

	return emptyAlign;
}

//sort datetime
function datetime(a, b, aRow, bRow, column, dir, params){
	var DT = this.table.dependencyRegistry.lookup(["luxon", "DateTime"], "DateTime");
	var format = params.format || "dd/MM/yyyy HH:mm:ss",
	alignEmptyValues = params.alignEmptyValues,
	emptyAlign = 0;

	if(typeof DT != "undefined"){
		if(!DT.isDateTime(a)){
			if(format === "iso"){
				a = DT.fromISO(String(a));
			}else {
				a = DT.fromFormat(String(a), format);
			}
		}

		if(!DT.isDateTime(b)){
			if(format === "iso"){
				b = DT.fromISO(String(b));
			}else {
				b = DT.fromFormat(String(b), format);
			}
		}

		if(!a.isValid){
			emptyAlign = !b.isValid ? 0 : -1;
		}else if(!b.isValid){
			emptyAlign =  1;
		}else {
			//compare valid values
			return a - b;
		}

		//fix empty values in position
		if((alignEmptyValues === "top" && dir === "desc") || (alignEmptyValues === "bottom" && dir === "asc")){
			emptyAlign *= -1;
		}

		return emptyAlign;

	}else {
		console.error("Sort Error - 'datetime' sorter is dependant on luxon.js");
	}
}

//sort date
function date(a, b, aRow, bRow, column, dir, params){
	if(!params.format){
		params.format = "dd/MM/yyyy";
	}

	return datetime.call(this, a, b, aRow, bRow, column, dir, params);
}

//sort times
function time(a, b, aRow, bRow, column, dir, params){
	if(!params.format){
		params.format = "HH:mm";
	}

	return datetime.call(this, a, b, aRow, bRow, column, dir, params);
}

//sort booleans
function boolean(a, b, aRow, bRow, column, dir, params){
	var el1 = a === true || a === "true" || a === "True" || a === 1 ? 1 : 0;
	var el2 = b === true || b === "true" || b === "True" || b === 1 ? 1 : 0;

	return el1 - el2;
}

//sort if element contains any data
function array(a, b, aRow, bRow, column, dir, params){
	var type = params.type || "length",
	alignEmptyValues = params.alignEmptyValues,
	emptyAlign = 0,
	table = this.table,
	valueMap;

	if(params.valueMap){
		if(typeof params.valueMap === "string"){
			valueMap = function(value){
				return value.map((item) => {
					return Helpers.retrieveNestedData(table.options.nestedFieldSeparator, params.valueMap, item);
				});
			};
		}else {
			valueMap = params.valueMap;
		}
	}

	function calc(value){
		var result;
		
		if(valueMap){
			value = valueMap(value);
		}

		switch(type){
			case "length":
				result = value.length;
				break;

			case "sum":
				result = value.reduce(function(c, d){
					return c + d;
				});
				break;

			case "max":
				result = Math.max.apply(null, value) ;
				break;

			case "min":
				result = Math.min.apply(null, value) ;
				break;

			case "avg":
				result = value.reduce(function(c, d){
					return c + d;
				}) / value.length;
				break;

			case "string":
				result = value.join("");
				break;
		}

		return result;
	}

	//handle non array values
	if(!Array.isArray(a)){
		emptyAlign = !Array.isArray(b) ? 0 : -1;
	}else if(!Array.isArray(b)){
		emptyAlign = 1;
	}else {
		if(type === "string"){
			return String(calc(a)).toLowerCase().localeCompare(String(calc(b)).toLowerCase());
		}else {
			return calc(b) - calc(a);
		}
	}

	//fix empty values in position
	if((alignEmptyValues === "top" && dir === "desc") || (alignEmptyValues === "bottom" && dir === "asc")){
		emptyAlign *= -1;
	}

	return emptyAlign;
}

//sort if element contains any data
function exists(a, b, aRow, bRow, column, dir, params){
	var el1 = typeof a == "undefined" ? 0 : 1;
	var el2 = typeof b == "undefined" ? 0 : 1;

	return el1 - el2;
}

//sort alpha numeric strings
function alphanum(as, bs, aRow, bRow, column, dir, params){
	var a, b, a1, b1, i= 0, L, rx = /(\d+)|(\D+)/g, rd = /\d/;
	var alignEmptyValues = params.alignEmptyValues;
	var emptyAlign = 0;

	//handle empty values
	if(!as && as!== 0){
		emptyAlign =  !bs && bs!== 0 ? 0 : -1;
	}else if(!bs && bs!== 0){
		emptyAlign =  1;
	}else {

		if(isFinite(as) && isFinite(bs)) return as - bs;
		a = String(as).toLowerCase();
		b = String(bs).toLowerCase();
		if(a === b) return 0;
		if(!(rd.test(a) && rd.test(b))) return a > b ? 1 : -1;
		a = a.match(rx);
		b = b.match(rx);
		L = a.length > b.length ? b.length : a.length;
		while(i < L){
			a1= a[i];
			b1= b[i++];
			if(a1 !== b1){
				if(isFinite(a1) && isFinite(b1)){
					if(a1.charAt(0) === "0") a1 = "." + a1;
					if(b1.charAt(0) === "0") b1 = "." + b1;
					return a1 - b1;
				}
				else return a1 > b1 ? 1 : -1;
			}
		}

		return a.length > b.length;
	}

	//fix empty values in position
	if((alignEmptyValues === "top" && dir === "desc") || (alignEmptyValues === "bottom" && dir === "asc")){
		emptyAlign *= -1;
	}

	return emptyAlign;
}

var defaultSorters = {
	number:number,
	string:string,
	date:date,
	time:time,
	datetime:datetime,
	boolean:boolean,
	array:array,
	exists:exists,
	alphanum:alphanum
};

class Sort extends Module{

	static moduleName = "sort";

	//load defaults
	static sorters = defaultSorters;
	
	constructor(table){
		super(table);
		
		this.sortList = []; //holder current sort
		this.changed = false; //has the sort changed since last render
		
		this.registerTableOption("sortMode", "local"); //local or remote sorting
		
		this.registerTableOption("initialSort", false); //initial sorting criteria
		this.registerTableOption("columnHeaderSortMulti", true); //multiple or single column sorting
		this.registerTableOption("sortOrderReverse", false); //reverse internal sort ordering
		this.registerTableOption("headerSortElement", "<div class='tabulator-arrow'></div>"); //header sort element
		this.registerTableOption("headerSortClickElement", "header"); //element which triggers sort when clicked
		
		this.registerColumnOption("sorter");
		this.registerColumnOption("sorterParams");
		
		this.registerColumnOption("headerSort", true);
		this.registerColumnOption("headerSortStartingDir");
		this.registerColumnOption("headerSortTristate");
		
	}
	
	initialize(){
		this.subscribe("column-layout", this.initializeColumn.bind(this));
		this.subscribe("table-built", this.tableBuilt.bind(this));
		this.registerDataHandler(this.sort.bind(this), 20);
		
		this.registerTableFunction("setSort", this.userSetSort.bind(this));
		this.registerTableFunction("getSorters", this.getSort.bind(this));
		this.registerTableFunction("clearSort", this.clearSort.bind(this));
		
		if(this.table.options.sortMode === "remote"){
			this.subscribe("data-params", this.remoteSortParams.bind(this));
		}
	}
	
	tableBuilt(){
		if(this.table.options.initialSort){
			this.setSort(this.table.options.initialSort);
		}
	}
	
	remoteSortParams(data, config, silent, params){
		var sorters = this.getSort();
		
		sorters.forEach((item) => {
			delete item.column;
		});
		
		params.sort = sorters;
		
		return params;
	}
	
	
	///////////////////////////////////
	///////// Table Functions /////////
	///////////////////////////////////
	
	userSetSort(sortList, dir){
		this.setSort(sortList, dir);
		// this.table.rowManager.sorterRefresh();
		this.refreshSort();
	}
	
	clearSort(){
		this.clear();
		// this.table.rowManager.sorterRefresh();
		this.refreshSort();
	}
	
	
	///////////////////////////////////
	///////// Internal Logic //////////
	///////////////////////////////////
	
	//initialize column header for sorting
	initializeColumn(column){
		var sorter = false,
		colEl,
		arrowEl;
		
		switch(typeof column.definition.sorter){
			case "string":
				if(Sort.sorters[column.definition.sorter]){
					sorter = Sort.sorters[column.definition.sorter];
				}else {
					console.warn("Sort Error - No such sorter found: ", column.definition.sorter);
				}
				break;
			
			case "function":
				sorter = column.definition.sorter;
				break;
		}
		
		column.modules.sort = {
			sorter:sorter, dir:"none",
			params:column.definition.sorterParams || {},
			startingDir:column.definition.headerSortStartingDir || "asc",
			tristate: column.definition.headerSortTristate,
		};
		
		if(column.definition.headerSort !== false){
			
			colEl = column.getElement();
			
			colEl.classList.add("tabulator-sortable");
			
			arrowEl = document.createElement("div");
			arrowEl.classList.add("tabulator-col-sorter");
			
			switch(this.table.options.headerSortClickElement){
				case "icon":
					arrowEl.classList.add("tabulator-col-sorter-element");
					break;
				case "header":
					colEl.classList.add("tabulator-col-sorter-element");
					break;
				default:
					colEl.classList.add("tabulator-col-sorter-element");
					break;
			}
			
			switch(this.table.options.headerSortElement){
				case "function":
				//do nothing
					break;
				
				case "object":
					arrowEl.appendChild(this.table.options.headerSortElement);
					break;
				
				default:
					arrowEl.innerHTML = this.table.options.headerSortElement;
			}
			
			//create sorter arrow
			column.titleHolderElement.appendChild(arrowEl);
			
			column.modules.sort.element = arrowEl;
			
			this.setColumnHeaderSortIcon(column, "none");
			
			if(this.table.options.headerSortClickElement === "icon"){
				arrowEl.addEventListener("mousedown", (e) => {
					e.stopPropagation();
				});
			}
			
			//sort on click
			(this.table.options.headerSortClickElement === "icon" ? arrowEl : colEl).addEventListener("click", (e) => {
				var dir = "",
				sorters=[],
				match = false;
				
				if(column.modules.sort){
					if(column.modules.sort.tristate){
						if(column.modules.sort.dir == "none"){
							dir = column.modules.sort.startingDir;
						}else {
							if(column.modules.sort.dir == column.modules.sort.startingDir){
								dir = column.modules.sort.dir == "asc" ? "desc" : "asc";
							}else {
								dir = "none";
							}
						}
					}else {
						switch(column.modules.sort.dir){
							case "asc":
								dir = "desc";
								break;
							
							case "desc":
								dir = "asc";
								break;
							
							default:
								dir = column.modules.sort.startingDir;
						}
					}
					
					if (this.table.options.columnHeaderSortMulti && (e.shiftKey || e.ctrlKey)) {
						sorters = this.getSort();
						
						match = sorters.findIndex((sorter) => {
							return sorter.field === column.getField();
						});
						
						if(match > -1){
							sorters[match].dir = dir;
							
							match = sorters.splice(match, 1)[0];
							if(dir != "none"){
								sorters.push(match);
							}
						}else {
							if(dir != "none"){
								sorters.push({column:column, dir:dir});
							}
						}
						
						//add to existing sort
						this.setSort(sorters);
					}else {
						if(dir == "none"){
							this.clear();
						}else {
							//sort by column only
							this.setSort(column, dir);
						}
						
					}
					
					// this.table.rowManager.sorterRefresh(!this.sortList.length);
					this.refreshSort();
				}
			});
		}
	}
	
	refreshSort(){
		if(this.table.options.sortMode === "remote"){
			this.reloadData(null, false, false);
		}else {
			this.refreshData(true);
		}
		
		//TODO - Persist left position of row manager
		// left = this.scrollLeft;
		// this.scrollHorizontal(left);
	}
	
	//check if the sorters have changed since last use
	hasChanged(){
		var changed = this.changed;
		this.changed = false;
		return changed;
	}
	
	//return current sorters
	getSort(){
		var self = this,
		sorters = [];
		
		self.sortList.forEach(function(item){
			if(item.column){
				sorters.push({column:item.column.getComponent(), field:item.column.getField(), dir:item.dir});
			}
		});
		
		return sorters;
	}
	
	//change sort list and trigger sort
	setSort(sortList, dir){
		var self = this,
		newSortList = [];
		
		if(!Array.isArray(sortList)){
			sortList = [{column: sortList, dir:dir}];
		}
		
		sortList.forEach(function(item){
			var column;
			
			column = self.table.columnManager.findColumn(item.column);
			
			if(column){
				item.column = column;
				newSortList.push(item);
				self.changed = true;
			}else {
				console.warn("Sort Warning - Sort field does not exist and is being ignored: ", item.column);
			}
			
		});
		
		self.sortList = newSortList;
		
		this.dispatch("sort-changed");
	}
	
	//clear sorters
	clear(){
		this.setSort([]);
	}
	
	//find appropriate sorter for column
	findSorter(column){
		var row = this.table.rowManager.activeRows[0],
		sorter = "string",
		field, value;
		
		if(row){
			row = row.getData();
			field = column.getField();
			
			if(field){
				
				value = column.getFieldValue(row);
				
				switch(typeof value){
					case "undefined":
						sorter = "string";
						break;
					
					case "boolean":
						sorter = "boolean";
						break;
					
					default:
						if(!isNaN(value) && value !== ""){
							sorter = "number";
						}else {
							if(value.match(/((^[0-9]+[a-z]+)|(^[a-z]+[0-9]+))+$/i)){
								sorter = "alphanum";
							}
						}
						break;
				}
			}
		}
		
		return Sort.sorters[sorter];
	}
	
	//work through sort list sorting data
	sort(data, sortOnly){
		var self = this,
		sortList = this.table.options.sortOrderReverse ? self.sortList.slice().reverse() : self.sortList,
		sortListActual = [],
		rowComponents = [];
		
		if(this.subscribedExternal("dataSorting")){
			this.dispatchExternal("dataSorting", self.getSort());
		}
		
		if(!sortOnly) {
			self.clearColumnHeaders();
		}
		
		if(this.table.options.sortMode !== "remote"){
			
			//build list of valid sorters and trigger column specific callbacks before sort begins
			sortList.forEach(function(item, i){
				var sortObj;
				
				if(item.column){
					sortObj = item.column.modules.sort;
					
					if(sortObj){
						
						//if no sorter has been defined, take a guess
						if(!sortObj.sorter){
							sortObj.sorter = self.findSorter(item.column);
						}
						
						item.params = typeof sortObj.params === "function" ? sortObj.params(item.column.getComponent(), item.dir) : sortObj.params;
						
						sortListActual.push(item);
					}
					
					if(!sortOnly) {
						self.setColumnHeader(item.column, item.dir);
					}
				}
			});
			
			//sort data
			if (sortListActual.length) {
				self._sortItems(data, sortListActual);
			}
			
		}else if(!sortOnly) {
			sortList.forEach(function(item, i){
				self.setColumnHeader(item.column, item.dir);
			});
		}

		
		if(this.subscribedExternal("dataSorted")){
			data.forEach((row) => {
				rowComponents.push(row.getComponent());
			});
			
			this.dispatchExternal("dataSorted", self.getSort(), rowComponents);
		}
		
		return data;
	}
	
	//clear sort arrows on columns
	clearColumnHeaders(){
		this.table.columnManager.getRealColumns().forEach((column) => {
			if(column.modules.sort){
				column.modules.sort.dir = "none";
				column.getElement().setAttribute("aria-sort", "none");
				this.setColumnHeaderSortIcon(column, "none");
			}
		});
	}
	
	//set the column header sort direction
	setColumnHeader(column, dir){
		column.modules.sort.dir = dir;
		column.getElement().setAttribute("aria-sort", dir === "asc" ? "ascending" : "descending");
		this.setColumnHeaderSortIcon(column, dir);
	}
	
	setColumnHeaderSortIcon(column, dir){
		var sortEl = column.modules.sort.element,
		arrowEl;
		
		if(column.definition.headerSort && typeof this.table.options.headerSortElement === "function"){
			while(sortEl.firstChild) sortEl.removeChild(sortEl.firstChild);
			
			arrowEl = this.table.options.headerSortElement.call(this.table, column.getComponent(), dir);
			
			if(typeof arrowEl === "object"){
				sortEl.appendChild(arrowEl);
			}else {
				sortEl.innerHTML = arrowEl;
			}
		}
	}
	
	//sort each item in sort list
	_sortItems(data, sortList){
		var sorterCount = sortList.length - 1;
		
		data.sort((a, b) => {
			var result;
			
			for(var i = sorterCount; i>= 0; i--){
				let sortItem = sortList[i];
				
				result = this._sortRow(a, b, sortItem.column, sortItem.dir, sortItem.params);
				
				if(result !== 0){
					break;
				}
			}
			
			return result;
		});
	}
	
	//process individual rows for a sort function on active data
	_sortRow(a, b, column, dir, params){
		var el1Comp, el2Comp;
		
		//switch elements depending on search direction
		var el1 = dir == "asc" ? a : b;
		var el2 = dir == "asc" ? b : a;
		
		a = column.getFieldValue(el1.getData());
		b = column.getFieldValue(el2.getData());
		
		a = typeof a !== "undefined" ? a : "";
		b = typeof b !== "undefined" ? b : "";
		
		el1Comp = el1.getComponent();
		el2Comp = el2.getComponent();
		
		return column.modules.sort.sorter.call(this, a, b, el1Comp, el2Comp, column.getComponent(), dir, params);
	}
}

var allModules = /*#__PURE__*/Object.freeze({
	__proto__: null,
	AjaxModule: Ajax,
	FormatModule: Format,
	FrozenColumnsModule: FrozenColumns,
	FrozenRowsModule: FrozenRows,
	MoveColumnsModule: MoveColumns,
	MoveRowsModule: MoveRows,
	PageModule: Page,
	ResizeColumnsModule: ResizeColumns,
	SelectRowModule: SelectRow,
	SortModule: Sort
});

var defaultOptions = {

	debugEventsExternal:false, //flag to console log events
	debugEventsInternal:false, //flag to console log events
	debugInvalidOptions:true, //allow toggling of invalid option warnings
	debugInvalidComponentFuncs:true, //allow toggling of invalid component warnings
	debugInitialization:true, //allow toggling of pre initialization function call warnings
	debugDeprecation:true, //allow toggling of deprecation warnings

	height:false, //height of tabulator
	minHeight:false, //minimum height of tabulator
	maxHeight:false, //maximum height of tabulator

	columnHeaderVertAlign:"top", //vertical alignment of column headers

	popupContainer:false,

	columns:[],//store for colum header info
	columnDefaults:{}, //store column default props
	rowHeader:false,

	data:false, //default starting data

	autoColumns:false, //build columns from data row structure
	autoColumnsDefinitions:false,

	nestedFieldSeparator:".", //separator for nested data

	footerElement:false, //hold footer element

	index:"id", //filed for row index

	textDirection:"auto",

	addRowPos:"bottom", //position to insert blank rows, top|bottom

	headerVisible:true, //hide header

	renderVertical:"virtual",
	renderHorizontal:"basic",
	renderVerticalBuffer:0, // set virtual DOM buffer size

	scrollToRowPosition:"top",
	scrollToRowIfVisible:true,

	scrollToColumnPosition:"left",
	scrollToColumnIfVisible:true,

	rowFormatter:false,
	rowFormatterPrint:null,
	rowFormatterClipboard:null,
	rowFormatterHtmlOutput:null,

	rowHeight:null,

	placeholder:false,

	dataLoader:true,
	dataLoaderLoading:false,
	dataLoaderError:false,
	dataLoaderErrorTimeout:3000,
	dataSendParams:{},
	dataReceiveParams:{},

	dependencies:{},
};

//public column object
class ColumnComponent {
	constructor (column){
		this._column = column;
		this.type = "ColumnComponent";

		return new Proxy(this, {
			get: function(target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				}else {
					return target._column.table.componentFunctionBinder.handle("column", target._column, name);
				}
			}
		});
	}

	getElement(){
		return this._column.getElement();
	}

	getDefinition(){
		return this._column.getDefinition();
	}

	getField(){
		return this._column.getField();
	}

	getTitleDownload() {
		return this._column.getTitleDownload();
	}

	getCells(){
		var cells = [];

		this._column.cells.forEach(function(cell){
			cells.push(cell.getComponent());
		});

		return cells;
	}

	isVisible(){
		return this._column.visible;
	}

	show(){
		if(this._column.isGroup){
			this._column.columns.forEach(function(column){
				column.show();
			});
		}else {
			this._column.show();
		}
	}

	hide(){
		if(this._column.isGroup){
			this._column.columns.forEach(function(column){
				column.hide();
			});
		}else {
			this._column.hide();
		}
	}

	toggle(){
		if(this._column.visible){
			this.hide();
		}else {
			this.show();
		}
	}

	delete(){
		return this._column.delete();
	}

	getSubColumns(){
		var output = [];

		if(this._column.columns.length){
			this._column.columns.forEach(function(column){
				output.push(column.getComponent());
			});
		}

		return output;
	}

	getParentColumn(){
		return this._column.getParentComponent();
	}

	_getSelf(){
		return this._column;
	}

	scrollTo(position, ifVisible){
		return this._column.table.columnManager.scrollToColumn(this._column, position, ifVisible);
	}

	getTable(){
		return this._column.table;
	}

	move(to, after){
		var toColumn = this._column.table.columnManager.findColumn(to);

		if(toColumn){
			this._column.table.columnManager.moveColumn(this._column, toColumn, after);
		}else {
			console.warn("Move Error - No matching column found:", toColumn);
		}
	}

	getNextColumn(){
		var nextCol = this._column.nextColumn();

		return nextCol ? nextCol.getComponent() : false;
	}

	getPrevColumn(){
		var prevCol = this._column.prevColumn();

		return prevCol ? prevCol.getComponent() : false;
	}

	updateDefinition(updates){
		return this._column.updateDefinition(updates);
	}

	getWidth(){
		return this._column.getWidth();
	}

	setWidth(width){
		var result;

		if(width === true){
			result =  this._column.reinitializeWidth(true);
		}else {
			result =  this._column.setWidth(width);
		}

		this._column.table.columnManager.rerenderColumns(true);

		return result;
	}
}

var defaultColumnOptions = {
	"title": undefined,
	"field": undefined,
	"columns": undefined,
	"visible": undefined,
	"hozAlign": undefined,
	"vertAlign": undefined,
	"width": undefined,
	"minWidth": 40,
	"maxWidth": undefined,
	"maxInitialWidth": undefined,
	"cssClass": undefined,
	"variableHeight": undefined,
	"headerVertical": undefined,
	"headerHozAlign": undefined,
	"headerWordWrap": false,
	"editableTitle": undefined,
};

class Cell extends CoreFeature {
	constructor(column, row) {
		super(column.table);

		this.table = column.table;
		this.column = column;
		this.row = row;
		this.element = null;
		this.value = null;
		this.initialValue;
		this.oldValue = null;
		this.modules = {};

		this.height = null;
		this.width = null;
		this.minWidth = null;

		this.component = null;

		this.loaded = false; //track if the cell has been added to the DOM yet

		this.build();
	}

	//////////////// Setup Functions /////////////////
	//generate element
	build() {
		this.generateElement();

		this.setWidth();

		this._configureCell();

		this.setValueActual(this.column.getFieldValue(this.row.data));

		this.initialValue = this.value;
	}

	generateElement() {
		this.element = document.createElement('div');
		this.element.className = "tabulator-cell";
		this.element.setAttribute("role", "gridcell");

		if (this.column.isRowHeader) {
			this.element.classList.add("tabulator-row-header");
		}
	}

	_configureCell() {
		var element = this.element,
		field = this.column.getField(),
		vertAligns = {
			top: "flex-start",
			bottom: "flex-end",
			middle: "center"
		},
		hozAligns = {
			left: "flex-start",
			right: "flex-end",
			center: "center"
		};

		//set text alignment
		element.style.textAlign = this.column.hozAlign;

		if (this.column.vertAlign) {
			element.style.display = "inline-flex";

			element.style.alignItems = vertAligns[this.column.vertAlign] || "";

			if (this.column.hozAlign) {
				element.style.justifyContent = hozAligns[this.column.hozAlign] || "";
			}
		}

		if (field) {
			element.setAttribute("tabulator-field", field);
		}

		//add class to cell if needed
		if (this.column.definition.cssClass) {
			var classNames = this.column.definition.cssClass.split(" ");
			classNames.forEach((className) => {
				element.classList.add(className);
			});
		}

		this.dispatch("cell-init", this);

		//hide cell if not visible
		if (!this.column.visible) {
			this.hide();
		}
	}

	//generate cell contents
	_generateContents() {
		var val;

		val = this.chain("cell-format", this, null, () => {
			return this.element.innerHTML = this.value;
		});

		switch (typeof val) {
			case "object":
				if (val instanceof Node) {

					//clear previous cell contents
					while (this.element.firstChild) this.element.removeChild(this.element.firstChild);

					this.element.appendChild(val);
				} else {
					this.element.innerHTML = "";

					if (val != null) {
						console.warn("Format Error - Formatter has returned a type of object, the only valid formatter object return is an instance of Node, the formatter returned:", val);
					}
				}
				break;
			case "undefined":
				this.element.innerHTML = "";
				break;
			default:
				this.element.innerHTML = `<span>${val || "&#8203;"}</span>`;
		}
	}

	cellRendered() {
		this.dispatch("cell-rendered", this);
	}

	//////////////////// Getters ////////////////////
	getElement(containerOnly) {
		if (!this.loaded) {
			this.loaded = true;
			if (!containerOnly) {
				this.layoutElement();
			}
		}

		return this.element;
	}

	getValue() {
		return this.value;
	}

	getOldValue() {
		return this.oldValue;
	}

	//////////////////// Actions ////////////////////
	setValue(value, mutate, force) {
		var changed = this.setValueProcessData(value, mutate, force);

		if (changed) {
			this.dispatch("cell-value-updated", this);

			this.cellRendered();

			if (this.column.definition.cellEdited) {
				this.column.definition.cellEdited.call(this.table, this.getComponent());
			}

			this.dispatchExternal("cellEdited", this.getComponent());

			if (this.subscribedExternal("dataChanged")) {
				this.dispatchExternal("dataChanged", this.table.rowManager.getData());
			}
		}
	}

	setValueProcessData(value, mutate, force) {
		var changed = false;

		if (this.value !== value || force) {

			changed = true;

			if (mutate) {
				value = this.chain("cell-value-changing", [this, value], null, value);
			}
		}

		this.setValueActual(value);

		if (changed) {
			this.dispatch("cell-value-changed", this);
		}

		return changed;
	}

	setValueActual(value) {
		this.oldValue = this.value;

		this.value = value;

		this.dispatch("cell-value-save-before", this);

		this.column.setFieldValue(this.row.data, value);

		this.dispatch("cell-value-save-after", this);

		if (this.loaded) {
			this.layoutElement();
		}
	}

	layoutElement() {
		this._generateContents();

		this.dispatch("cell-layout", this);
	}

	setWidth() {
		this.width = this.column.width;
		this.element.style.width = this.column.widthStyled;
	}

	clearWidth() {
		this.width = "";
		this.element.style.width = "";
	}

	getWidth() {
		return this.width || this.element.offsetWidth;
	}

	setMinWidth() {
		this.minWidth = this.column.minWidth;
		this.element.style.minWidth = this.column.minWidthStyled;
	}

	setMaxWidth() {
		this.maxWidth = this.column.maxWidth;
		this.element.style.maxWidth = this.column.maxWidthStyled;
	}

	checkHeight() {
		// var height = this.element.css("height");
		this.row.reinitializeHeight();
	}

	clearHeight() {
		this.element.style.height = "";
		this.height = null;

		this.dispatch("cell-height", this, "");
	}

	setHeight() {
		this.height = this.row.height;
		this.element.style.height = this.row.heightStyled;

		this.dispatch("cell-height", this, this.row.heightStyled);
	}

	getHeight() {
		return this.height || this.element.offsetHeight;
	}

	show() {
		this.element.style.display = this.column.vertAlign ? "inline-flex" : "";
	}

	hide() {
		this.element.style.display = "none";
	}

	delete() {
		this.dispatch("cell-delete", this);

		if (!this.table.rowManager.redrawBlock && this.element.parentNode) {
			this.element.parentNode.removeChild(this.element);
		}

		this.element = false;
		this.column.deleteCell(this);
		this.row.deleteCell(this);
		this.calcs = {};
	}

	getIndex() {
		return this.row.getCellIndex(this);
	}

	//////////////// Object Generation /////////////////
	getComponent() {
		if (!this.component) {
			this.component = new CellComponent(this);
		}

		return this.component;
	}
}

class Column extends CoreFeature {

	static defaultOptionList = defaultColumnOptions;

	constructor(def, parent, rowHeader) {
		super(parent.table);

		this.definition = def; //column definition
		this.parent = parent; //hold parent object
		this.type = "column"; //type of element
		this.columns = []; //child columns
		this.cells = []; //cells bound to this column
		this.isGroup = false;
		this.isRowHeader = rowHeader;
		this.element = this.createElement(); //column header element
		this.contentElement = false;
		this.titleHolderElement = false;
		this.titleElement = false;
		this.groupElement = this.createGroupElement(); //column group holder element
		this.hozAlign = ""; //horizontal text alignment
		this.vertAlign = ""; //vert text alignment

		//multi dimensional filed handling
		this.field = "";
		this.fieldStructure = "";
		this.getFieldValue = "";
		this.setFieldValue = "";

		this.titleDownload = null;
		this.titleFormatterRendered = false;

		this.mapDefinitions();

		this.setField(this.definition.field);

		this.modules = {}; //hold module variables;

		this.width = null; //column width
		this.widthStyled = ""; //column width pre-styled to improve render efficiency
		this.maxWidth = null; //column maximum width
		this.maxWidthStyled = ""; //column maximum pre-styled to improve render efficiency
		this.maxInitialWidth = null;
		this.minWidth = null; //column minimum width
		this.minWidthStyled = ""; //column minimum pre-styled to improve render efficiency
		this.widthFixed = false; //user has specified a width for this column

		this.visible = true; //default visible state

		this.component = null;

		//initialize column
		if (this.definition.columns) {

			this.isGroup = true;

			this.definition.columns.forEach((def, i) => {
				var newCol = new Column(def, this);
				this.attachColumn(newCol);
			});

			this.checkColumnVisibility();
		} else {
			parent.registerColumnField(this);
		}

		this._initialize();
	}

	createElement() {
		var el = document.createElement("div");

		el.classList.add("tabulator-col");
		el.setAttribute("role", "columnheader");
		el.setAttribute("aria-sort", "none");

		if (this.isRowHeader) {
			el.classList.add("tabulator-row-header");
		}

		switch (this.table.options.columnHeaderVertAlign) {
			case "middle":
				el.style.justifyContent = "center";
				break;
			case "bottom":
				el.style.justifyContent = "flex-end";
				break;
		}

		return el;
	}

	createGroupElement() {
		var el = document.createElement("div");

		el.classList.add("tabulator-col-group-cols");

		return el;
	}

	mapDefinitions() {
		var defaults = this.table.options.columnDefaults;

		//map columnDefaults onto column definitions
		if (defaults) {
			for (let key in defaults) {
				if (typeof this.definition[key] === "undefined") {
					this.definition[key] = defaults[key];
				}
			}
		}

		this.definition = this.table.columnManager.optionsList.generate(Column.defaultOptionList, this.definition);
	}

	checkDefinition() {
		Object.keys(this.definition).forEach((key) => {
			if (Column.defaultOptionList.indexOf(key) === -1) {
				console.warn("Invalid column definition option in '" + (this.field || this.definition.title) + "' column:", key);
			}
		});
	}

	setField(field) {
		this.field = field;
		this.fieldStructure = field ? (this.table.options.nestedFieldSeparator ? field.split(this.table.options.nestedFieldSeparator) : [field]) : [];
		this.getFieldValue = this.fieldStructure.length > 1 ? this._getNestedData : this._getFlatData;
		this.setFieldValue = this.fieldStructure.length > 1 ? this._setNestedData : this._setFlatData;
	}

	//register column position with column manager
	registerColumnPosition(column) {
		this.parent.registerColumnPosition(column);
	}

	//register column position with column manager
	registerColumnField(column) {
		this.parent.registerColumnField(column);
	}

	//trigger position registration
	reRegisterPosition() {
		if (this.isGroup) {
			this.columns.forEach(function(column) {
				column.reRegisterPosition();
			});
		} else {
			this.registerColumnPosition(this);
		}
	}

	//build header element
	_initialize() {
		var def = this.definition;

		while (this.element.firstChild) this.element.removeChild(this.element.firstChild);

		if (def.headerVertical) {
			this.element.classList.add("tabulator-col-vertical");

			if (def.headerVertical === "flip") {
				this.element.classList.add("tabulator-col-vertical-flip");
			}
		}

		this.contentElement = this._buildColumnHeaderContent();

		this.element.appendChild(this.contentElement);

		if (this.isGroup) {
			this._buildGroupHeader();
		} else {
			this._buildColumnHeader();
		}

		this.dispatch("column-init", this);
	}

	//build header element for header
	_buildColumnHeader() {
		var def = this.definition;

		this.dispatch("column-layout", this);

		//set column visibility
		if (typeof def.visible != "undefined") {
			if (def.visible) {
				this.show(true);
			} else {
				this.hide(true);
			}
		}

		//assign additional css classes to column header
		if (def.cssClass) {
			var classNames = def.cssClass.split(" ");
			classNames.forEach((className) => {
				this.element.classList.add(className);
			});
		}

		if (def.field) {
			this.element.setAttribute("tabulator-field", def.field);
		}

		//set min width if present
		this.setMinWidth(parseInt(def.minWidth));

		if (def.maxInitialWidth) {
			this.maxInitialWidth = parseInt(def.maxInitialWidth);
		}

		if (def.maxWidth) {
			this.setMaxWidth(parseInt(def.maxWidth));
		}

		this.reinitializeWidth();

		//set horizontal text alignment
		this.hozAlign = this.definition.hozAlign;
		this.vertAlign = this.definition.vertAlign;

		this.titleElement.style.textAlign = this.definition.headerHozAlign;
	}

	_buildColumnHeaderContent() {
		var contentElement = document.createElement("div");
		contentElement.classList.add("tabulator-col-content");

		this.titleHolderElement = document.createElement("div");
		this.titleHolderElement.classList.add("tabulator-col-title-holder");

		contentElement.appendChild(this.titleHolderElement);

		this.titleElement = this._buildColumnHeaderTitle();

		this.titleHolderElement.appendChild(this.titleElement);

		return contentElement;
	}

	//build title element of column
	_buildColumnHeaderTitle() {
		var def = this.definition;

		var titleHolderElement = document.createElement("div");
		titleHolderElement.classList.add("tabulator-col-title");

		if (def.headerWordWrap) {
			titleHolderElement.classList.add("tabulator-col-title-wrap");
		}

		if (def.editableTitle) {
			var titleElement = document.createElement("input");
			titleElement.classList.add("tabulator-title-editor");

			titleElement.addEventListener("click", (e) => {
				e.stopPropagation();
				titleElement.focus();
			});

			titleElement.addEventListener("mousedown", (e) => {
				e.stopPropagation();
			});

			titleElement.addEventListener("change", () => {
				def.title = titleElement.value;
				this.dispatchExternal("columnTitleChanged", this.getComponent());
			});

			titleHolderElement.appendChild(titleElement);

			if (def.field) {
				this.langBind("columns|" + def.field, (text) => {
					titleElement.value = text || (def.title || "&#8203;");
				});
			} else {
				titleElement.value = def.title || "&#8203;";
			}

		} else {
			if (def.field) {
				this.langBind("columns|" + def.field, (text) => {
					this._formatColumnHeaderTitle(titleHolderElement, text || (def.title || "&#8203;"));
				});
			} else {
				this._formatColumnHeaderTitle(titleHolderElement, def.title || "&#8203;");
			}
		}

		return titleHolderElement;
	}

	_formatColumnHeaderTitle(el, title) {
		var contents = this.chain("column-format", [this, title, el], null, () => {
			return title;
		});

		switch (typeof contents) {
			case "object":
				if (contents instanceof Node) {
					el.appendChild(contents);
				} else {
					el.innerHTML = "";
					console.warn("Format Error - Title formatter has returned a type of object, the only valid formatter object return is an instance of Node, the formatter returned:", contents);
				}
				break;
			case "undefined":
				el.innerHTML = "";
				break;
			default:
				el.innerHTML = contents;
		}
	}

	//build header element for column group
	_buildGroupHeader() {
		this.element.classList.add("tabulator-col-group");
		this.element.setAttribute("role", "columngroup");
		this.element.setAttribute("aria-title", this.definition.title);

		//asign additional css classes to column header
		if (this.definition.cssClass) {
			var classNames = this.definition.cssClass.split(" ");
			classNames.forEach((className) => {
				this.element.classList.add(className);
			});
		}

		this.titleElement.style.textAlign = this.definition.headerHozAlign;

		this.element.appendChild(this.groupElement);
	}

	//flat field lookup
	_getFlatData(data) {
		return data[this.field];
	}

	//nested field lookup
	_getNestedData(data) {
		var dataObj = data,
		structure = this.fieldStructure,
		length = structure.length,
		output;

		for (let i = 0; i < length; i++) {

			dataObj = dataObj[structure[i]];

			output = dataObj;

			if (!dataObj) {
				break;
			}
		}

		return output;
	}

	//flat field set
	_setFlatData(data, value) {
		if (this.field) {
			data[this.field] = value;
		}
	}

	//nested field set
	_setNestedData(data, value) {
		var dataObj = data,
		structure = this.fieldStructure,
		length = structure.length;

		for (let i = 0; i < length; i++) {

			if (i == length - 1) {
				dataObj[structure[i]] = value;
			} else {
				if (!dataObj[structure[i]]) {
					if (typeof value !== "undefined") {
						dataObj[structure[i]] = {};
					} else {
						break;
					}
				}

				dataObj = dataObj[structure[i]];
			}
		}
	}

	//attach column to this group
	attachColumn(column) {
		if (this.groupElement) {
			this.columns.push(column);
			this.groupElement.appendChild(column.getElement());

			column.columnRendered();
		} else {
			console.warn("Column Warning - Column being attached to another column instead of column group");
		}
	}

	//vertically align header in column
	verticalAlign(alignment, height) {

		//calculate height of column header and group holder element
		var parentHeight = this.parent.isGroup ? this.parent.getGroupElement().clientHeight : (height || this.parent.getHeadersElement().clientHeight);
		// var parentHeight = this.parent.isGroup ? this.parent.getGroupElement().clientHeight : this.parent.getHeadersElement().clientHeight;

		this.element.style.height = parentHeight + "px";

		this.dispatch("column-height", this, this.element.style.height);

		if (this.isGroup) {
			this.groupElement.style.minHeight = (parentHeight - this.contentElement.offsetHeight) + "px";
		}

		//vertically align cell contents
		// if(!this.isGroup && alignment !== "top"){
		// 	if(alignment === "bottom"){
		// 		this.element.style.paddingTop = (this.element.clientHeight - this.contentElement.offsetHeight) + "px";
		// 	}else{
		// 		this.element.style.paddingTop = ((this.element.clientHeight - this.contentElement.offsetHeight) / 2) + "px";
		// 	}
		// }

		this.columns.forEach(function(column) {
			column.verticalAlign(alignment);
		});
	}

	//clear vertical alignment
	clearVerticalAlign() {
		this.element.style.paddingTop = "";
		this.element.style.height = "";
		this.element.style.minHeight = "";
		this.groupElement.style.minHeight = "";

		this.columns.forEach(function(column) {
			column.clearVerticalAlign();
		});

		this.dispatch("column-height", this, "");
	}

	//// Retrieve Column Information ////
	//return column header element
	getElement() {
		return this.element;
	}

	//return column group element
	getGroupElement() {
		return this.groupElement;
	}

	//return field name
	getField() {
		return this.field;
	}

	getTitleDownload() {
		return this.titleDownload;
	}

	//return the first column in a group
	getFirstColumn() {
		if (!this.isGroup) {
			return this;
		} else {
			if (this.columns.length) {
				return this.columns[0].getFirstColumn();
			} else {
				return false;
			}
		}
	}

	//return the last column in a group
	getLastColumn() {
		if (!this.isGroup) {
			return this;
		} else {
			if (this.columns.length) {
				return this.columns[this.columns.length - 1].getLastColumn();
			} else {
				return false;
			}
		}
	}

	//return all columns in a group
	getColumns(traverse) {
		var columns = [];

		if (traverse) {
			this.columns.forEach((column) => {
				columns.push(column);

				columns = columns.concat(column.getColumns(true));
			});
		} else {
			columns = this.columns;
		}

		return columns;
	}

	//return all columns in a group
	getCells() {
		return this.cells;
	}

	//retrieve the top column in a group of columns
	getTopColumn() {
		if (this.parent.isGroup) {
			return this.parent.getTopColumn();
		} else {
			return this;
		}
	}

	//return column definition object
	getDefinition(updateBranches) {
		var colDefs = [];

		if (this.isGroup && updateBranches) {
			this.columns.forEach(function(column) {
				colDefs.push(column.getDefinition(true));
			});

			this.definition.columns = colDefs;
		}

		return this.definition;
	}

	//////////////////// Actions ////////////////////
	checkColumnVisibility() {
		var visible = false;

		this.columns.forEach(function(column) {
			if (column.visible) {
				visible = true;
			}
		});

		if (visible) {
			this.show();
			this.dispatchExternal("columnVisibilityChanged", this.getComponent(), false);
		} else {
			this.hide();
		}
	}

	//show column
	show(silent, responsiveToggle) {
		if (!this.visible) {
			this.visible = true;

			this.element.style.display = "";

			if (this.parent.isGroup) {
				this.parent.checkColumnVisibility();
			}

			this.cells.forEach(function(cell) {
				cell.show();
			});

			if (!this.isGroup && this.width === null) {
				this.reinitializeWidth();
			}

			this.table.columnManager.verticalAlignHeaders();

			this.dispatch("column-show", this, responsiveToggle);

			if (!silent) {
				this.dispatchExternal("columnVisibilityChanged", this.getComponent(), true);
			}

			if (this.parent.isGroup) {
				this.parent.matchChildWidths();
			}

			if (!this.silent) {
				this.table.columnManager.rerenderColumns();
			}
		}
	}

	//hide column
	hide(silent, responsiveToggle) {
		if (this.visible) {
			this.visible = false;

			this.element.style.display = "none";

			this.table.columnManager.verticalAlignHeaders();

			if (this.parent.isGroup) {
				this.parent.checkColumnVisibility();
			}

			this.cells.forEach(function(cell) {
				cell.hide();
			});

			this.dispatch("column-hide", this, responsiveToggle);

			if (!silent) {
				this.dispatchExternal("columnVisibilityChanged", this.getComponent(), false);
			}

			if (this.parent.isGroup) {
				this.parent.matchChildWidths();
			}

			if (!this.silent) {
				this.table.columnManager.rerenderColumns();
			}
		}
	}

	matchChildWidths() {
		var childWidth = 0;

		if (this.contentElement && this.columns.length) {
			this.columns.forEach(function(column) {
				if (column.visible) {
					childWidth += column.getWidth();
				}
			});

			this.contentElement.style.maxWidth = (childWidth - 1) + "px";
			if (this.table.initialized) {
				this.element.style.width = childWidth + "px";
			}

			if (this.parent.isGroup) {
				this.parent.matchChildWidths();
			}
		}
	}

	removeChild(child) {
		var index = this.columns.indexOf(child);

		if (index > -1) {
			this.columns.splice(index, 1);
		}

		if (!this.columns.length) {
			this.delete();
		}
	}

	setWidth(width) {
		this.widthFixed = true;
		this.setWidthActual(width);
	}

	setWidthActual(width) {
		if (isNaN(width)) {
			width = Math.floor((this.table.element.clientWidth / 100) * parseInt(width));
		}

		width = Math.max(this.minWidth, width);

		if (this.maxWidth) {
			width = Math.min(this.maxWidth, width);
		}

		this.width = width;
		this.widthStyled = width ? width + "px" : "";

		this.element.style.width = this.widthStyled;

		if (!this.isGroup) {
			this.cells.forEach(function(cell) {
				cell.setWidth();
			});
		}

		if (this.parent.isGroup) {
			this.parent.matchChildWidths();
		}

		this.dispatch("column-width", this);

		if (this.subscribedExternal("columnWidth")) {
			this.dispatchExternal("columnWidth", this.getComponent());
		}
	}

	checkCellHeights() {
		var rows = [];

		this.cells.forEach(function(cell) {
			if (cell.row.heightInitialized) {
				if (cell.row.getElement().offsetParent !== null) {
					rows.push(cell.row);
					cell.row.clearCellHeight();
				} else {
					cell.row.heightInitialized = false;
				}
			}
		});

		rows.forEach(function(row) {
			row.calcHeight();
		});

		rows.forEach(function(row) {
			row.setCellHeight();
		});
	}

	getWidth() {
		var width = 0;

		if (this.isGroup) {
			this.columns.forEach(function(column) {
				if (column.visible) {
					width += column.getWidth();
				}
			});
		} else {
			width = this.width;
		}

		return width;
	}

	getLeftOffset() {
		var offset = this.element.offsetLeft;

		if (this.parent.isGroup) {
			offset += this.parent.getLeftOffset();
		}

		return offset;
	}

	getHeight() {
		return Math.ceil(this.element.getBoundingClientRect().height);
	}

	setMinWidth(minWidth) {
		if (this.maxWidth && minWidth > this.maxWidth) {
			minWidth = this.maxWidth;

			console.warn("the minWidth (" + minWidth + "px) for column '" + this.field + "' cannot be bigger that its maxWidth (" + this.maxWidthStyled + ")");
		}

		this.minWidth = minWidth;
		this.minWidthStyled = minWidth ? minWidth + "px" : "";

		this.element.style.minWidth = this.minWidthStyled;

		this.cells.forEach(function(cell) {
			cell.setMinWidth();
		});
	}

	setMaxWidth(maxWidth) {
		if (this.minWidth && maxWidth < this.minWidth) {
			maxWidth = this.minWidth;

			console.warn("the maxWidth (" + maxWidth + "px) for column '" + this.field + "' cannot be smaller that its minWidth (" + this.minWidthStyled + ")");
		}

		this.maxWidth = maxWidth;
		this.maxWidthStyled = maxWidth ? maxWidth + "px" : "";

		this.element.style.maxWidth = this.maxWidthStyled;

		this.cells.forEach(function(cell) {
			cell.setMaxWidth();
		});
	}

	delete() {
		return new Promise((resolve, reject) => {
			if (this.isGroup) {
				this.columns.forEach(function(column) {
					column.delete();
				});
			}

			this.dispatch("column-delete", this);

			var cellCount = this.cells.length;

			for (let i = 0; i < cellCount; i++) {
				this.cells[0].delete();
			}

			if (this.element.parentNode) {
				this.element.parentNode.removeChild(this.element);
			}

			this.element = false;
			this.contentElement = false;
			this.titleElement = false;
			this.groupElement = false;

			if (this.parent.isGroup) {
				this.parent.removeChild(this);
			}

			this.table.columnManager.deregisterColumn(this);

			this.table.columnManager.rerenderColumns(true);

			this.dispatch("column-deleted", this);

			resolve();
		});
	}

	columnRendered() {
		if (this.titleFormatterRendered) {
			this.titleFormatterRendered();
		}

		this.dispatch("column-rendered", this);
	}

	//////////////// Cell Management /////////////////
	//generate cell for this column
	generateCell(row) {
		var cell = new Cell(this, row);

		this.cells.push(cell);

		return cell;
	}

	nextColumn() {
		var index = this.table.columnManager.findColumnIndex(this);
		return index > -1 ? this._nextVisibleColumn(index + 1) : false;
	}

	_nextVisibleColumn(index) {
		var column = this.table.columnManager.getColumnByIndex(index);
		return !column || column.visible ? column : this._nextVisibleColumn(index + 1);
	}

	prevColumn() {
		var index = this.table.columnManager.findColumnIndex(this);
		return index > -1 ? this._prevVisibleColumn(index - 1) : false;
	}

	_prevVisibleColumn(index) {
		var column = this.table.columnManager.getColumnByIndex(index);
		return !column || column.visible ? column : this._prevVisibleColumn(index - 1);
	}

	reinitializeWidth(force) {
		this.widthFixed = false;

		//set width if present
		if (typeof this.definition.width !== "undefined" && !force) {
			// maxInitialWidth ignored here as width specified
			this.setWidth(this.definition.width);
		}

		this.dispatch("column-width-fit-before", this);

		this.fitToData(force);

		this.dispatch("column-width-fit-after", this);
	}

	//set column width to maximum cell width for non group columns
	fitToData(force) {
		if (this.isGroup) {
			return;
		}

		if (!this.widthFixed) {
			this.element.style.width = "";

			this.cells.forEach((cell) => {
				cell.clearWidth();
			});
		}

		var maxWidth = this.element.offsetWidth;

		if (!this.width || !this.widthFixed) {
			this.cells.forEach((cell) => {
				var width = cell.getWidth();

				if (width > maxWidth) {
					maxWidth = width;
				}
			});

			if (maxWidth) {
				var setTo = maxWidth + 1;

				if (force) {
					this.setWidth(setTo);
				} else {
					if (this.maxInitialWidth && !force) {
						setTo = Math.min(setTo, this.maxInitialWidth);
					}
					this.setWidthActual(setTo);
				}
			}
		}
	}

	updateDefinition(updates) {
		var definition;

		if (!this.isGroup) {
			if (!this.parent.isGroup) {
				definition = Object.assign({}, this.getDefinition());
				definition = Object.assign(definition, updates);

				return this.table.columnManager.addColumn(definition, false, this)
					.then((column) => {

						if (definition.field == this.field) {
							this.field = false; //clear field name to prevent deletion of duplicate column from arrays
						}

						return this.delete()
							.then(() => {
								return column.getComponent();
							});

					});
			} else {
				console.error("Column Update Error - The updateDefinition function is only available on ungrouped columns");
				return Promise.reject("Column Update Error - The updateDefinition function is only available on columns, not column groups");
			}
		} else {
			console.error("Column Update Error - The updateDefinition function is only available on ungrouped columns");
			return Promise.reject("Column Update Error - The updateDefinition function is only available on columns, not column groups");
		}
	}

	deleteCell(cell) {
		var index = this.cells.indexOf(cell);

		if (index > -1) {
			this.cells.splice(index, 1);
		}
	}

	//////////////// Object Generation /////////////////
	getComponent() {
		if (!this.component) {
			this.component = new ColumnComponent(this);
		}

		return this.component;
	}

	getPosition() {
		return this.table.columnManager.getVisibleColumnsByIndex().indexOf(this) + 1;
	}

	getParentComponent() {
		return this.parent instanceof Column ? this.parent.getComponent() : false;
	}
}

class OptionsList {
	constructor(table, msgType, defaults = {}){
		this.table = table;
		this.msgType = msgType;
		this.registeredDefaults = Object.assign({}, defaults);
	}
	
	register(option, value){
		this.registeredDefaults[option] = value;
	}
	
	generate(defaultOptions, userOptions = {}){
		var output = Object.assign({}, this.registeredDefaults),
		warn = this.table.options.debugInvalidOptions || userOptions.debugInvalidOptions === true;
		
		Object.assign(output, defaultOptions);
		
		for (let key in userOptions){
			if(!output.hasOwnProperty(key)){
				if(warn){
					console.warn("Invalid " + this.msgType + " option:", key);
				}

				output[key] = userOptions.key;
			}
		}
	
		
		for (let key in output){
			if(key in userOptions){
				output[key] = userOptions[key];
			}else {
				if(Array.isArray(output[key])){
					output[key] = Object.assign([], output[key]);
				}else if(typeof output[key] === "object" && output[key] !== null){
					output[key] = Object.assign({}, output[key]);
				}else if (typeof output[key] === "undefined"){
					delete output[key];
				}
			}
		}
		
		return output;
	}
}

class Renderer extends CoreFeature{
	constructor(table){
		super(table);

		this.elementVertical = table.rowManager.element;
		this.elementHorizontal = table.columnManager.element;
		this.tableElement =  table.rowManager.tableElement;

		this.verticalFillMode = "fit"; // used by row manager to determine how to size the render area ("fit" - fits container to the contents, "fill" - fills the container without resizing it)
	}


	///////////////////////////////////
	/////// Internal Bindings /////////
	///////////////////////////////////

	initialize(){
		//initialize core functionality
	}

	clearRows(){
		//clear down existing rows layout
	}

	clearColumns(){
		//clear down existing columns layout
	}


	reinitializeColumnWidths(columns){
		//resize columns to fit data
	}


	renderRows(){
		//render rows from a clean slate
	}

	renderColumns(){
		//render columns from a clean slate
	}

	rerenderRows(callback){
		// rerender rows and keep position
		if(callback){
			callback();
		}
	}

	rerenderColumns(update, blockRedraw){
		//rerender columns
	}

	renderRowCells(row){
		//render the cells in a row
	}

	rerenderRowCells(row, force){
		//rerender the cells in a row
	}

	scrollColumns(left, dir){
		//handle horizontal scrolling
	}

	scrollRows(top, dir){
		//handle vertical scrolling
	}

	resize(){
		//container has resized, carry out any needed recalculations (DO NOT RERENDER IN THIS FUNCTION)
	}

	scrollToRow(row){
		//scroll to a specific row
	}

	scrollToRowNearestTop(row){
		//determine weather the row is nearest the top or bottom of the table, return true for top or false for bottom
	}

	visibleRows(includingBuffer){
		//return the visible rows
		return [];
	}

	///////////////////////////////////
	//////// Helper Functions /////////
	///////////////////////////////////

	rows(){
		return this.table.rowManager.getDisplayRows();
	}

	styleRow(row, index){
		var rowEl = row.getElement();

		if(index % 2){
			rowEl.classList.add("tabulator-row-even");
			rowEl.classList.remove("tabulator-row-odd");
		}else {
			rowEl.classList.add("tabulator-row-odd");
			rowEl.classList.remove("tabulator-row-even");
		}
	}

	///////////////////////////////////
	/////// External Triggers /////////
	/////// (DO NOT OVERRIDE) /////////
	///////////////////////////////////

	clear(){
		//clear down existing layout
		this.clearRows();
		this.clearColumns();
	}

	render(){
		//render from a clean slate
		this.renderRows();
		this.renderColumns();
	}

	rerender(callback){
		// rerender and keep position
		this.rerenderRows();
		this.rerenderColumns();
	}

	scrollToRowPosition(row, position, ifVisible){
		var rowIndex = this.rows().indexOf(row),
		rowEl = row.getElement(),
		offset = 0;

		return new Promise((resolve, reject) => {
			if(rowIndex > -1){

				if(typeof ifVisible === "undefined"){
					ifVisible = this.table.options.scrollToRowIfVisible;
				}

				//check row visibility
				if(!ifVisible){
					if(Helpers.elVisible(rowEl)){
						offset = Helpers.elOffset(rowEl).top - Helpers.elOffset(this.elementVertical).top;
						
						if(offset > 0 && offset < this.elementVertical.clientHeight - rowEl.offsetHeight){
							resolve();
							return false;
						}
					}
				}

				if(typeof position === "undefined"){
					position = this.table.options.scrollToRowPosition;
				}

				if(position === "nearest"){
					position = this.scrollToRowNearestTop(row) ? "top" : "bottom";
				}

				//scroll to row
				this.scrollToRow(row);

				//align to correct position
				switch(position){
					case "middle":
					case "center":

						if(this.elementVertical.scrollHeight - this.elementVertical.scrollTop == this.elementVertical.clientHeight){
							this.elementVertical.scrollTop = this.elementVertical.scrollTop + (rowEl.offsetTop - this.elementVertical.scrollTop) - ((this.elementVertical.scrollHeight - rowEl.offsetTop) / 2);
						}else {
							this.elementVertical.scrollTop = this.elementVertical.scrollTop - (this.elementVertical.clientHeight / 2);
						}

						break;

					case "bottom":

						if(this.elementVertical.scrollHeight - this.elementVertical.scrollTop == this.elementVertical.clientHeight){
							this.elementVertical.scrollTop = this.elementVertical.scrollTop - (this.elementVertical.scrollHeight - rowEl.offsetTop) + rowEl.offsetHeight;
						}else {
							this.elementVertical.scrollTop = this.elementVertical.scrollTop - this.elementVertical.clientHeight + rowEl.offsetHeight;
						}

						break;

					case "top":
						this.elementVertical.scrollTop = rowEl.offsetTop;					
						break;
				}

				resolve();

			}else {
				console.warn("Scroll Error - Row not visible");
				reject("Scroll Error - Row not visible");
			}
		});
	}
}

class BasicHorizontal extends Renderer{
	constructor(table){
		super(table);
	}
	
	renderRowCells(row, inFragment) {
		const rowFrag = document.createDocumentFragment();
		row.cells.forEach((cell) => {
			rowFrag.appendChild(cell.getElement());
		});
		row.element.appendChild(rowFrag);
		
		if(!inFragment){
			row.cells.forEach((cell) => {
				cell.cellRendered();
			});
		}
	}
	
	reinitializeColumnWidths(columns){
		columns.forEach(function(column){
			column.reinitializeWidth();
		});
	}
}

class VirtualDomHorizontal extends Renderer{
	constructor(table){
		super(table);
		
		this.leftCol = 0;
		this.rightCol = 0;
		this.scrollLeft = 0;
		
		this.vDomScrollPosLeft = 0;
		this.vDomScrollPosRight = 0;
		
		this.vDomPadLeft = 0;
		this.vDomPadRight = 0;
		
		this.fitDataColAvg = 0;
		
		this.windowBuffer = 200; //pixel margin to make column visible before it is shown on screen
		
		this.visibleRows = null;
		
		this.initialized = false;
		this.isFitData = false;
		
		this.columns = [];
	}
	
	initialize(){
		this.compatibilityCheck();
		this.layoutCheck();
		this.vertScrollListen();
	}
	
	compatibilityCheck(){		
		if(this.options("layout") == "fitDataTable"){
			console.warn("Horizontal Virtual DOM is not compatible with fitDataTable layout mode");
		}
		
		if(this.options("responsiveLayout")){
			console.warn("Horizontal Virtual DOM is not compatible with responsive columns");
		}
		
		if(this.options("rtl")){
			console.warn("Horizontal Virtual DOM is not currently compatible with RTL text direction");
		}
	}
	
	layoutCheck(){
		this.isFitData = this.options("layout").startsWith('fitData');
	}
	
	vertScrollListen(){
		this.subscribe("scroll-vertical", this.clearVisRowCache.bind(this));
		this.subscribe("data-refreshed", this.clearVisRowCache.bind(this));
	}
	
	clearVisRowCache(){
		this.visibleRows = null;
	}
	
	//////////////////////////////////////
	///////// Public Functions ///////////
	//////////////////////////////////////
	
	renderColumns(row, force){
		this.dataChange();
	}
	
	
	scrollColumns(left, dir){
		if(this.scrollLeft != left){
			this.scrollLeft = left;
			
			this.scroll(left - (this.vDomScrollPosLeft + this.windowBuffer));
		}
	}
	
	calcWindowBuffer(){
		var buffer = this.elementVertical.clientWidth;
		
		this.table.columnManager.columnsByIndex.forEach((column) => {
			if(column.visible){
				var width = column.getWidth();
				
				if(width > buffer){
					buffer = width;
				}
			}
		});
		
		this.windowBuffer = buffer * 2;
	}
	
	rerenderColumns(update, blockRedraw){		
		var old = {
			cols:this.columns,
			leftCol:this.leftCol,
			rightCol:this.rightCol,
		},
		colPos = 0;
		
		if(update && !this.initialized){
			return;
		}
		
		this.clear();
		
		this.calcWindowBuffer();
		
		this.scrollLeft = this.elementVertical.scrollLeft;
		
		this.vDomScrollPosLeft = this.scrollLeft - this.windowBuffer;
		this.vDomScrollPosRight = this.scrollLeft + this.elementVertical.clientWidth + this.windowBuffer;
		
		this.table.columnManager.columnsByIndex.forEach((column) => {
			var config = {},
			width;
			
			if(column.visible){
				if(!column.modules.frozen){			
					width = column.getWidth();
					
					config.leftPos = colPos;
					config.rightPos = colPos + width;
					
					config.width = width;
					
					if (this.isFitData) {
						config.fitDataCheck = column.modules.vdomHoz ? column.modules.vdomHoz.fitDataCheck : true;
					}
					
					if((colPos + width > this.vDomScrollPosLeft) && (colPos < this.vDomScrollPosRight)){
						//column is visible
						
						if(this.leftCol == -1){
							this.leftCol = this.columns.length;
							this.vDomPadLeft = colPos;
						}
						
						this.rightCol = this.columns.length;
					}else {
						// column is hidden
						if(this.leftCol !== -1){
							this.vDomPadRight += width;
						}
					}
					
					this.columns.push(column);
					
					column.modules.vdomHoz = config;
					
					colPos += width;
				}
			}
		});
		
		this.tableElement.style.paddingLeft = this.vDomPadLeft + "px";
		this.tableElement.style.paddingRight = this.vDomPadRight + "px";
		
		this.initialized = true;
		
		if(!blockRedraw){
			if(!update || this.reinitChanged(old)){
				this.reinitializeRows();
			}
		}
		
		this.elementVertical.scrollLeft = this.scrollLeft;
	}
	
	renderRowCells(row){
		if(this.initialized){
			this.initializeRow(row);
		}else {
			const rowFrag = document.createDocumentFragment();
			row.cells.forEach((cell) => {
				rowFrag.appendChild(cell.getElement());
			});
			row.element.appendChild(rowFrag);
			
			row.cells.forEach((cell) => {
				cell.cellRendered();
			});
		}
	}
	
	rerenderRowCells(row, force){
		this.reinitializeRow(row, force);
	}
	
	reinitializeColumnWidths(columns){
		for(let i = this.leftCol; i <= this.rightCol; i++){
			let col = this.columns[i];
			
			if(col){
				col.reinitializeWidth();
			}
		}
	}
	
	//////////////////////////////////////
	//////// Internal Rendering //////////
	//////////////////////////////////////
	
	deinitialize(){
		this.initialized = false;
	}
	
	clear(){
		this.columns = [];
		
		this.leftCol = -1;
		this.rightCol = 0;
		
		this.vDomScrollPosLeft = 0;
		this.vDomScrollPosRight = 0;
		this.vDomPadLeft = 0;
		this.vDomPadRight = 0;
	}
	
	dataChange(){
		var change = false,
		row, rowEl;
		
		if(this.isFitData){
			this.table.columnManager.columnsByIndex.forEach((column) => {
				if(!column.definition.width && column.visible){
					change = true;
				}
			});
			
			if(change && this.table.rowManager.getDisplayRows().length){
				this.vDomScrollPosRight = this.scrollLeft + this.elementVertical.clientWidth + this.windowBuffer;
				
				row = this.chain("rows-sample", [1], [], () => {
					return this.table.rowManager.getDisplayRows();
				})[0];
				
				if(row){
					rowEl = row.getElement();
					
					row.generateCells();
					
					this.tableElement.appendChild(rowEl);
					
					for(let colEnd = 0; colEnd < row.cells.length; colEnd++){
						let cell = row.cells[colEnd];
						rowEl.appendChild(cell.getElement());
						
						cell.column.reinitializeWidth();
					}
					
					rowEl.parentNode.removeChild(rowEl);
					
					this.rerenderColumns(false, true);
				}
			}
		}else {
			if(this.options("layout") === "fitColumns"){
				this.layoutRefresh();
				this.rerenderColumns(false, true);
			}
		}
	}
	
	reinitChanged(old){
		var match = true;
		
		if(old.cols.length !== this.columns.length || old.leftCol !== this.leftCol || old.rightCol !== this.rightCol){
			return true;
		}
		
		old.cols.forEach((col, i) => {
			if(col !== this.columns[i]){
				match = false;
			}
		});
		
		return !match;
	}
	
	reinitializeRows(){
		var visibleRows = this.getVisibleRows(),
		otherRows = this.table.rowManager.getRows().filter(row => !visibleRows.includes(row));
		
		visibleRows.forEach((row) => {
			this.reinitializeRow(row, true);
		});
		
		otherRows.forEach((row) =>{
			row.deinitialize();
		});
	}
	
	getVisibleRows(){
		if (!this.visibleRows){
			this.visibleRows = this.table.rowManager.getVisibleRows();
		}
		
		return this.visibleRows;	
	}
	
	scroll(diff){
		this.vDomScrollPosLeft += diff;
		this.vDomScrollPosRight += diff;
		
		if(Math.abs(diff) > (this.windowBuffer / 2)){
			this.rerenderColumns();
		}else {
			if(diff > 0){
				//scroll right
				this.addColRight();
				this.removeColLeft();
			}else {
				//scroll left
				this.addColLeft();
				this.removeColRight();
			}
		}
	}
	
	colPositionAdjust (start, end, diff){
		for(let i = start; i < end; i++){
			let column = this.columns[i];
			
			column.modules.vdomHoz.leftPos += diff;
			column.modules.vdomHoz.rightPos += diff;
		}
	}
	
	addColRight(){
		var changes = false,
		working = true;
		
		while(working){
			
			let column = this.columns[this.rightCol + 1];
			
			if(column){
				if(column.modules.vdomHoz.leftPos <= this.vDomScrollPosRight){
					changes = true;
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							var cell = row.getCell(column);
							row.getElement().insertBefore(cell.getElement(), row.getCell(this.columns[this.rightCol]).getElement().nextSibling);
							cell.cellRendered();
						}
					});
					
					this.fitDataColActualWidthCheck(column);
					
					this.rightCol++; // Don't move this below the >= check below
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							row.modules.vdomHoz.rightCol = this.rightCol;
						}
					});
					
					if(this.rightCol >= (this.columns.length - 1)){
						this.vDomPadRight = 0;
					}else {
						this.vDomPadRight -= column.getWidth();
					}	
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}
		
		if(changes){
			this.tableElement.style.paddingRight = this.vDomPadRight + "px";
		}
	}
	
	addColLeft(){
		var changes = false,
		working = true;
		
		while(working){
			let column = this.columns[this.leftCol - 1];
			
			if(column){
				if(column.modules.vdomHoz.rightPos >= this.vDomScrollPosLeft){
					changes = true;
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							var cell = row.getCell(column);
							row.getElement().insertBefore(cell.getElement(), row.getCell(this.columns[this.leftCol]).getElement());
							cell.cellRendered();
						}
					});
					
					this.leftCol--; // don't move this below the <= check below
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							row.modules.vdomHoz.leftCol = this.leftCol;
						}
					});
					
					if(this.leftCol <= 0){ // replicating logic in addColRight
						this.vDomPadLeft = 0;
					}else {
						this.vDomPadLeft -= column.getWidth();
					}
					
					let diff = this.fitDataColActualWidthCheck(column);
					
					if(diff){
						this.scrollLeft = this.elementVertical.scrollLeft = this.elementVertical.scrollLeft + diff;
						this.vDomPadRight -= diff;
					}
					
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}
		
		if(changes){
			this.tableElement.style.paddingLeft = this.vDomPadLeft + "px";
		}
	}
	
	removeColRight(){
		var changes = false,
		working = true;
		
		while(working){
			let column = this.columns[this.rightCol];
			
			if(column){
				if(column.modules.vdomHoz.leftPos > this.vDomScrollPosRight){
					changes = true;
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							var cell = row.getCell(column);
							
							try {
								row.getElement().removeChild(cell.getElement());
							} catch (ex) {
								console.warn("Could not removeColRight", ex.message);
							}
						}
					});
					
					this.vDomPadRight += column.getWidth();
					this.rightCol --;
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							row.modules.vdomHoz.rightCol = this.rightCol;
						}
					});
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}
		
		if(changes){
			this.tableElement.style.paddingRight = this.vDomPadRight + "px";
		}
	}
	
	removeColLeft(){
		var changes = false,
		working = true;
		
		while(working){
			let column = this.columns[this.leftCol];
			
			if(column){
				if(column.modules.vdomHoz.rightPos < this.vDomScrollPosLeft){
					changes = true;
					
					this.getVisibleRows().forEach((row) => {					
						if(row.type !== "group"){
							var cell = row.getCell(column);
							
							try {
								row.getElement().removeChild(cell.getElement());
							} catch (ex) {
								console.warn("Could not removeColLeft", ex.message);
							}
						}
					});
					
					this.vDomPadLeft += column.getWidth();
					this.leftCol ++;
					
					this.getVisibleRows().forEach((row) => {
						if(row.type !== "group"){
							row.modules.vdomHoz.leftCol = this.leftCol;
						}
					});
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}
		
		if(changes){
			this.tableElement.style.paddingLeft = this.vDomPadLeft + "px";
		}
	}
	
	fitDataColActualWidthCheck(column){
		var newWidth, widthDiff;
		
		if(column.modules.vdomHoz.fitDataCheck){
			column.reinitializeWidth();
			
			newWidth = column.getWidth();
			widthDiff = newWidth - column.modules.vdomHoz.width;
			
			if(widthDiff){
				column.modules.vdomHoz.rightPos += widthDiff;
				column.modules.vdomHoz.width = newWidth;
				this.colPositionAdjust(this.columns.indexOf(column) + 1, this.columns.length, widthDiff);
			}
			
			column.modules.vdomHoz.fitDataCheck = false;
		}
		
		return widthDiff;
	}
	
	initializeRow(row){
		if(row.type !== "group"){
			row.modules.vdomHoz = {
				leftCol:this.leftCol,
				rightCol:this.rightCol,
			};
			
			if(this.table.modules.frozenColumns){
				this.table.modules.frozenColumns.leftColumns.forEach((column) => {
					this.appendCell(row, column);
				});
			}
			
			for(let i = this.leftCol; i <= this.rightCol; i++){
				this.appendCell(row, this.columns[i]);
			}
			
			if(this.table.modules.frozenColumns){
				this.table.modules.frozenColumns.rightColumns.forEach((column) => {
					this.appendCell(row, column);
				});
			}
		}
	}
	
	appendCell(row, column){
		if(column && column.visible){
			let cell = row.getCell(column);
			
			row.getElement().appendChild(cell.getElement());
			cell.cellRendered();
		}
	}
	
	reinitializeRow(row, force){
		if(row.type !== "group"){
			if(force || !row.modules.vdomHoz || row.modules.vdomHoz.leftCol !== this.leftCol || row.modules.vdomHoz.rightCol !== this.rightCol){
				
				var rowEl = row.getElement();
				while(rowEl.firstChild) rowEl.removeChild(rowEl.firstChild);
				
				this.initializeRow(row);
			}
		}
	}
}

class ColumnManager extends CoreFeature {
	
	constructor (table){
		super(table);
		
		this.blockHozScrollEvent = false;
		this.headersElement = null;
		this.contentsElement = null;
		this.rowHeader = null;
		this.element = null ; //containing element
		this.columns = []; // column definition object
		this.columnsByIndex = []; //columns by index
		this.columnsByField = {}; //columns by field
		this.scrollLeft = 0;
		this.optionsList = new OptionsList(this.table, "column definition", defaultColumnOptions);
		
		this.redrawBlock = false; //prevent redraws to allow multiple data manipulations before continuing
		this.redrawBlockUpdate = null; //store latest redraw update only status
		
		this.renderer = null;
	}
	
	////////////// Setup Functions /////////////////
	
	initialize(){
		this.initializeRenderer();
		
		this.headersElement = this.createHeadersElement();
		this.contentsElement = this.createHeaderContentsElement();
		this.element = this.createHeaderElement();
		
		this.contentsElement.insertBefore(this.headersElement, this.contentsElement.firstChild);
		this.element.insertBefore(this.contentsElement, this.element.firstChild);
		
		this.initializeScrollWheelWatcher();
		
		this.subscribe("scroll-horizontal", this.scrollHorizontal.bind(this));
		this.subscribe("scrollbar-vertical", this.padVerticalScrollbar.bind(this));
	}
	
	padVerticalScrollbar(width){
		if(this.table.rtl){
			this.headersElement.style.marginLeft = width + "px";
		}else {
			this.headersElement.style.marginRight = width + "px";
		}
	}
	
	initializeRenderer(){
		var renderClass;
		
		var renderers = {
			"virtual": VirtualDomHorizontal,
			"basic": BasicHorizontal,
		};
		
		if(typeof this.table.options.renderHorizontal === "string"){
			renderClass = renderers[this.table.options.renderHorizontal];
		}else {
			renderClass = this.table.options.renderHorizontal;
		}
		
		if(renderClass){
			this.renderer = new renderClass(this.table, this.element, this.tableElement);
			this.renderer.initialize();
		}else {
			console.error("Unable to find matching renderer:", this.table.options.renderHorizontal);
		}
	}
	
	
	createHeadersElement (){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-headers");
		el.setAttribute("role", "row");
		
		return el;
	}
	
	createHeaderContentsElement (){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-header-contents");
		el.setAttribute("role", "rowgroup");
		
		return el;
	}
	
	createHeaderElement (){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-header");
		el.setAttribute("role", "rowgroup");
		
		if(!this.table.options.headerVisible){
			el.classList.add("tabulator-header-hidden");
		}
		
		return el;
	}
	
	//return containing element
	getElement(){
		return this.element;
	}
	
	//return containing contents element
	getContentsElement(){
		return this.contentsElement;
	}
	
	
	//return header containing element
	getHeadersElement(){
		return this.headersElement;
	}
	
	//scroll horizontally to match table body
	scrollHorizontal(left){
		this.contentsElement.scrollLeft = left;
		
		this.scrollLeft = left;
		
		this.renderer.scrollColumns(left);
	}
	
	initializeScrollWheelWatcher(){
		this.contentsElement.addEventListener("wheel", (e) => {
			var left;
			
			if(e.deltaX){
				left = this.contentsElement.scrollLeft + e.deltaX;
				
				this.table.rowManager.scrollHorizontal(left);
				this.table.columnManager.scrollHorizontal(left);
			}
		});
	}
	
	///////////// Column Setup Functions /////////////
	generateColumnsFromRowData(data){
		var cols = [],
		collProgress = {},
		rowSample = this.table.options.autoColumns === "full" ? data : [data[0]],
		definitions = this.table.options.autoColumnsDefinitions;
		
		if(data && data.length){
			
			rowSample.forEach((row) => {
				
				Object.keys(row).forEach((key, index) => {
					let value = row[key],
					col;
					
					if(!collProgress[key]){
						col = {
							field:key,
							title:key,
							sorter:this.calculateSorterFromValue(value),
						};

						cols.splice(index, 0, col);
						collProgress[key] = typeof value === "undefined" ? col : true;
					}else if(collProgress[key] !== true){
						if(typeof value !== "undefined"){
							collProgress[key].sorter = this.calculateSorterFromValue(value);
							collProgress[key] = true;
						}
					}
				});
			});
			
			if(definitions){
				
				switch(typeof definitions){
					case "function":
						this.table.options.columns = definitions.call(this.table, cols);
						break;
					
					case "object":
						if(Array.isArray(definitions)){
							cols.forEach((col) => {
								var match = definitions.find((def) => {
									return def.field === col.field;
								});
								
								if(match){
									Object.assign(col, match);
								}
							});
							
						}else {
							cols.forEach((col) => {
								if(definitions[col.field]){
									Object.assign(col, definitions[col.field]);
								}
							});
						}
						
						this.table.options.columns = cols;
						break;
				}
			}else {
				this.table.options.columns = cols;
			}
			
			this.setColumns(this.table.options.columns);
		}
	}
	
	calculateSorterFromValue(value){
		var sorter;
		
		switch(typeof value){
			case "undefined":
				sorter = "string";
				break;
			
			case "boolean":
				sorter = "boolean";
				break;
			
			case "number":
				sorter = "number";
				break;
			
			case "object":
				if(Array.isArray(value)){
					sorter = "array";
				}else {
					sorter = "string";
				}
				break;
			
			default:
				if(!isNaN(value) && value !== ""){
					sorter = "number";
				}else {
					if(value.match(/((^[0-9]+[a-z]+)|(^[a-z]+[0-9]+))+$/i)){
						sorter = "alphanum";
					}else {
						sorter = "string";
					}
				}
				break;
		}
		
		return sorter;
	}
	
	setColumns(cols, row){
		while(this.headersElement.firstChild) this.headersElement.removeChild(this.headersElement.firstChild);
		
		this.columns = [];
		this.columnsByIndex = [];
		this.columnsByField = {};
		
		this.dispatch("columns-loading");
		this.dispatchExternal("columnsLoading");
		
		if(this.table.options.rowHeader){
			this.rowHeader = new Column(this.table.options.rowHeader === true ? {} : this.table.options.rowHeader, this, true);
			this.columns.push(this.rowHeader);
			this.headersElement.appendChild(this.rowHeader.getElement());
			this.rowHeader.columnRendered();
		}
		
		cols.forEach((def, i) => {
			this._addColumn(def);
		});
		
		this._reIndexColumns();
		
		this.dispatch("columns-loaded");

		if(this.subscribedExternal("columnsLoaded")){
			this.dispatchExternal("columnsLoaded", this.getComponents());
		}
		
		this.rerenderColumns(false, true);
		
		this.redraw(true);
	}
	
	_addColumn(definition, before, nextToColumn){
		var column = new Column(definition, this),
		colEl = column.getElement(),
		index = nextToColumn ? this.findColumnIndex(nextToColumn) : nextToColumn;
		
		//prevent adding of rows in front of row header
		if(before && this.rowHeader && (!nextToColumn || nextToColumn === this.rowHeader)){
			before = false;
			nextToColumn = this.rowHeader;
			index = 0;
		}
		
		if(nextToColumn && index > -1){
			var topColumn = nextToColumn.getTopColumn();
			var parentIndex = this.columns.indexOf(topColumn);
			var nextEl = topColumn.getElement();
			
			if(before){
				this.columns.splice(parentIndex, 0, column);
				nextEl.parentNode.insertBefore(colEl, nextEl);
			}else {
				this.columns.splice(parentIndex + 1, 0, column);
				nextEl.parentNode.insertBefore(colEl, nextEl.nextSibling);
			}
		}else {
			if(before){
				this.columns.unshift(column);
				this.headersElement.insertBefore(column.getElement(), this.headersElement.firstChild);
			}else {
				this.columns.push(column);
				this.headersElement.appendChild(column.getElement());
			}
		}
		
		column.columnRendered();
		
		return column;
	}
	
	registerColumnField(col){
		if(col.definition.field){
			this.columnsByField[col.definition.field] = col;
		}
	}
	
	registerColumnPosition(col){
		this.columnsByIndex.push(col);
	}
	
	_reIndexColumns(){
		this.columnsByIndex = [];
		
		this.columns.forEach(function(column){
			column.reRegisterPosition();
		});
	}
	
	//ensure column headers take up the correct amount of space in column groups
	verticalAlignHeaders(){
		var minHeight = 0;
		
		if(!this.redrawBlock){
			
			this.headersElement.style.height="";
			
			this.columns.forEach((column) => {
				column.clearVerticalAlign();
			});
			
			this.columns.forEach((column) => {
				var height = column.getHeight();
				
				if(height > minHeight){
					minHeight = height;
				}
			});
			
			this.headersElement.style.height = minHeight + "px";
			
			this.columns.forEach((column) => {
				column.verticalAlign(this.table.options.columnHeaderVertAlign, minHeight);
			});
			
			this.table.rowManager.adjustTableSize();
		}
	}
	
	//////////////// Column Details /////////////////
	findColumn(subject){
		var columns;
		
		if(typeof subject == "object"){
			
			if(subject instanceof Column){
				//subject is column element
				return subject;
			}else if(subject instanceof ColumnComponent){
				//subject is public column component
				return subject._getSelf() || false;
			}else if(typeof HTMLElement !== "undefined" && subject instanceof HTMLElement){
				
				columns = [];
				
				this.columns.forEach((column) => {
					columns.push(column);
					columns = columns.concat(column.getColumns(true));
				});
				
				//subject is a HTML element of the column header
				let match = columns.find((column) => {
					return column.element === subject;
				});
				
				return match || false;
			}
			
		}else {
			//subject should be treated as the field name of the column
			return this.columnsByField[subject] || false;
		}
		
		//catch all for any other type of input
		return false;
	}
	
	getColumnByField(field){
		return this.columnsByField[field];
	}
	
	getColumnsByFieldRoot(root){
		var matches = [];
		
		Object.keys(this.columnsByField).forEach((field) => {
			var fieldRoot = this.table.options.nestedFieldSeparator ? field.split(this.table.options.nestedFieldSeparator)[0] : field;
			if(fieldRoot === root){
				matches.push(this.columnsByField[field]);
			}
		});
		
		return matches;
	}
	
	getColumnByIndex(index){
		return this.columnsByIndex[index];
	}
	
	getFirstVisibleColumn(){
		var index = this.columnsByIndex.findIndex((col) => {
			return col.visible;
		});
		
		return index > -1 ? this.columnsByIndex[index] : false;
	}
	
	getVisibleColumnsByIndex() {
		return this.columnsByIndex.filter((col) => col.visible);
	}
	
	getColumns(){
		return this.columns;
	}
	
	findColumnIndex(column){
		return this.columnsByIndex.findIndex((col) => {
			return column === col;
		});
	}
	
	//return all columns that are not groups
	getRealColumns(){
		return this.columnsByIndex;
	}
	
	//traverse across columns and call action
	traverse(callback){
		this.columnsByIndex.forEach((column,i) =>{
			callback(column, i);
		});
	}
	
	//get definitions of actual columns
	getDefinitions(active){
		var output = [];
		
		this.columnsByIndex.forEach((column) => {
			if(!active || (active && column.visible)){
				output.push(column.getDefinition());
			}
		});
		
		return output;
	}
	
	//get full nested definition tree
	getDefinitionTree(){
		var output = [];
		
		this.columns.forEach((column) => {
			output.push(column.getDefinition(true));
		});
		
		return output;
	}
	
	getComponents(structured){
		var output = [],
		columns = structured ? this.columns : this.columnsByIndex;
		
		columns.forEach((column) => {
			output.push(column.getComponent());
		});
		
		return output;
	}
	
	getWidth(){
		var width = 0;
		
		this.columnsByIndex.forEach((column) => {
			if(column.visible){
				width += column.getWidth();
			}
		});
		
		return width;
	}
	
	moveColumn(from, to, after){
		to.element.parentNode.insertBefore(from.element, to.element);
		
		if(after){
			to.element.parentNode.insertBefore(to.element, from.element);
		}
		
		this.moveColumnActual(from, to, after);
		
		this.verticalAlignHeaders();
		
		this.table.rowManager.reinitialize();
	}
	
	moveColumnActual(from, to, after){
		if(from.parent.isGroup){
			this._moveColumnInArray(from.parent.columns, from, to, after);
		}else {
			this._moveColumnInArray(this.columns, from, to, after);
		}
		
		this._moveColumnInArray(this.columnsByIndex, from, to, after, true);
		
		this.rerenderColumns(true);
		
		this.dispatch("column-moved", from, to, after);
		
		if(this.subscribedExternal("columnMoved")){
			this.dispatchExternal("columnMoved", from.getComponent(), this.table.columnManager.getComponents());
		}
	}
	
	_moveColumnInArray(columns, from, to, after, updateRows){
		var	fromIndex = columns.indexOf(from),
		toIndex, rows = [];
		
		if (fromIndex > -1) {
			
			columns.splice(fromIndex, 1);
			
			toIndex = columns.indexOf(to);
			
			if (toIndex > -1) {
				
				if(after){
					toIndex = toIndex+1;
				}
				
			}else {
				toIndex = fromIndex;
			}
			
			columns.splice(toIndex, 0, from);
			
			if(updateRows){
				
				rows = this.chain("column-moving-rows", [from, to, after], null, []) || [];
				
				rows = rows.concat(this.table.rowManager.rows);
				
				rows.forEach(function(row){
					if(row.cells.length){
						var cell = row.cells.splice(fromIndex, 1)[0];
						row.cells.splice(toIndex, 0, cell);
					}
				});
				
			}
		}
	}
	
	scrollToColumn(column, position, ifVisible){
		var left = 0,
		offset = column.getLeftOffset(),
		adjust = 0,
		colEl = column.getElement();
		
		
		return new Promise((resolve, reject) => {
			
			if(typeof position === "undefined"){
				position = this.table.options.scrollToColumnPosition;
			}
			
			if(typeof ifVisible === "undefined"){
				ifVisible = this.table.options.scrollToColumnIfVisible;
			}
			
			if(column.visible){
				
				//align to correct position
				switch(position){
					case "middle":
					case "center":
						adjust = -this.element.clientWidth / 2;
						break;
					
					case "right":
						adjust = colEl.clientWidth - this.headersElement.clientWidth;
						break;
				}
				
				//check column visibility
				if(!ifVisible){
					if(offset > 0 && offset + colEl.offsetWidth < this.element.clientWidth){
						return false;
					}
				}
				
				//calculate scroll position
				left = offset + adjust;
				
				left = Math.max(Math.min(left, this.table.rowManager.element.scrollWidth - this.table.rowManager.element.clientWidth),0);
				
				this.table.rowManager.scrollHorizontal(left);
				this.scrollHorizontal(left);
				
				resolve();
			}else {
				console.warn("Scroll Error - Column not visible");
				reject("Scroll Error - Column not visible");
			}
			
		});
	}
	
	//////////////// Cell Management /////////////////
	generateCells(row){
		var cells = [];
		
		this.columnsByIndex.forEach((column) => {
			cells.push(column.generateCell(row));
		});
		
		return cells;
	}
	
	//////////////// Column Management /////////////////
	getFlexBaseWidth(){
		var totalWidth = this.table.element.clientWidth, //table element width
		fixedWidth = 0;
		
		//adjust for vertical scrollbar if present
		if(this.table.rowManager.element.scrollHeight > this.table.rowManager.element.clientHeight){
			totalWidth -= this.table.rowManager.element.offsetWidth - this.table.rowManager.element.clientWidth;
		}
		
		this.columnsByIndex.forEach(function(column){
			var width, minWidth, colWidth;
			
			if(column.visible){
				
				width = column.definition.width || 0;
				
				minWidth = parseInt(column.minWidth);
				
				if(typeof(width) == "string"){
					if(width.indexOf("%") > -1){
						colWidth = (totalWidth / 100) * parseInt(width) ;
					}else {
						colWidth = parseInt(width);
					}
				}else {
					colWidth = width;
				}
				
				fixedWidth += colWidth > minWidth ? colWidth : minWidth;
				
			}
		});
		
		return fixedWidth;
	}
	
	addColumn(definition, before, nextToColumn){
		return new Promise((resolve, reject) => {
			var column = this._addColumn(definition, before, nextToColumn);
			
			this._reIndexColumns();
			
			this.dispatch("column-add", definition, before, nextToColumn);
			
			if(this.layoutMode() != "fitColumns"){
				column.reinitializeWidth();
			}
			
			this.redraw(true);
			
			this.table.rowManager.reinitialize();
			
			this.rerenderColumns();
			
			resolve(column);
		});
	}
	
	//remove column from system
	deregisterColumn(column){
		var field = column.getField(),
		index;
		
		//remove from field list
		if(field){
			delete this.columnsByField[field];
		}
		
		//remove from index list
		index = this.columnsByIndex.indexOf(column);
		
		if(index > -1){
			this.columnsByIndex.splice(index, 1);
		}
		
		//remove from column list
		index = this.columns.indexOf(column);
		
		if(index > -1){
			this.columns.splice(index, 1);
		}
		
		this.verticalAlignHeaders();
		
		this.redraw();
	}
	
	rerenderColumns(update, silent){
		if(!this.redrawBlock){
			this.renderer.rerenderColumns(update, silent);
		}else {
			if(update === false || (update === true && this.redrawBlockUpdate === null)){
				this.redrawBlockUpdate = update;
			}
		}
	}
	
	blockRedraw(){
		this.redrawBlock = true;
		this.redrawBlockUpdate = null;
	}
	
	restoreRedraw(){
		this.redrawBlock = false;
		this.verticalAlignHeaders();
		this.renderer.rerenderColumns(this.redrawBlockUpdate);
		
	}
	
	//redraw columns
	redraw(force){
		if(Helpers.elVisible(this.element)){
			this.verticalAlignHeaders();
		}
		
		if(force){
			this.table.rowManager.resetScroll();
			this.table.rowManager.reinitialize();
		}
		
		if(!this.confirm("table-redrawing", force)){
			this.layoutRefresh(force);
		}
		
		this.dispatch("table-redraw", force);
		
		this.table.footerManager.redraw();
	}
}

class Row extends CoreFeature{
	constructor (data, parent, type = "row"){
		super(parent.table);
		
		this.parent = parent;
		this.data = {};
		this.type = type; //type of element
		this.element = false;
		this.modules = {}; //hold module variables;
		this.cells = [];
		this.height = 0; //hold element height
		this.heightStyled = ""; //hold element height pre-styled to improve render efficiency
		this.manualHeight = false; //user has manually set row height
		this.outerHeight = 0; //hold elements outer height
		this.initialized = false; //element has been rendered
		this.heightInitialized = false; //element has resized cells to fit
		this.position = 0; //store position of element in row list
		this.positionWatchers = [];
		
		this.component = null;
		
		this.created = false;
		
		this.setData(data);
	}
	
	create(){
		if(!this.created){
			this.created = true;
			this.generateElement();
		}
	}
	
	createElement (){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-row");
		el.setAttribute("role", "row");
		
		this.element = el;
	}
	
	getElement(){
		this.create();
		return this.element;
	}
	
	detachElement(){
		if (this.element && this.element.parentNode){
			this.element.parentNode.removeChild(this.element);
		}
	}
	
	generateElement(){
		this.createElement();
		this.dispatch("row-init", this);
	}
	
	generateCells(){
		this.cells = this.table.columnManager.generateCells(this);
	}
	
	//functions to setup on first render
	initialize(force, inFragment){
		this.create();
		
		if(!this.initialized || force){
			
			this.deleteCells();
			
			while(this.element.firstChild) this.element.removeChild(this.element.firstChild);
			
			this.dispatch("row-layout-before", this);
			
			this.generateCells();
			
			this.initialized = true;
			
			this.table.columnManager.renderer.renderRowCells(this, inFragment);
			
			if(force){
				this.normalizeHeight();
			}
			
			this.dispatch("row-layout", this);
			
			if(this.table.options.rowFormatter){
				this.table.options.rowFormatter(this.getComponent());
			}
			
			this.dispatch("row-layout-after", this);
		}else {
			this.table.columnManager.renderer.rerenderRowCells(this, inFragment);
		}
	}

	rendered(){
		this.cells.forEach((cell) => {
			cell.cellRendered();
		});
	}
	
	reinitializeHeight(){
		this.heightInitialized = false;
		
		if(this.element && this.element.offsetParent !== null){
			this.normalizeHeight(true);
		}
	}

	deinitialize(){
		this.initialized = false;
	}
	
	deinitializeHeight(){
		this.heightInitialized = false;
	}
	
	reinitialize(children){
		this.initialized = false;
		this.heightInitialized = false;
		
		if(!this.manualHeight){
			this.height = 0;
			this.heightStyled = "";
		}
		
		if(this.element && this.element.offsetParent !== null){
			this.initialize(true);
		}
		
		this.dispatch("row-relayout", this);
	}
	
	//get heights when doing bulk row style calcs in virtual DOM
	calcHeight(force){
		var maxHeight = 0, minHeight  = 0;

		if(this.table.options.rowHeight){
			this.height = this.table.options.rowHeight;
		}else {
			minHeight = this.calcMinHeight();
			maxHeight = this.calcMaxHeight();
			
			if(force){
				this.height = Math.max(maxHeight, minHeight);
			}else {
				this.height = this.manualHeight ? this.height : Math.max(maxHeight, minHeight);
			}
		}
		
		this.heightStyled = this.height ? this.height + "px" : "";
		this.outerHeight = this.element.offsetHeight;
	}

	calcMinHeight(){
		return this.table.options.resizableRows ? this.element.clientHeight : 0;
	}

	calcMaxHeight(){
		var maxHeight = 0;

		this.cells.forEach(function(cell){
			var height = cell.getHeight();

			if(height > maxHeight){
				maxHeight = height;
			}
		});

		return maxHeight;
	}
	
	//set of cells
	setCellHeight(){
		this.cells.forEach(function(cell){
			cell.setHeight();
		});
		
		this.heightInitialized = true;
	}
	
	clearCellHeight(){
		this.cells.forEach(function(cell){
			cell.clearHeight();
		});
	}
	
	//normalize the height of elements in the row
	normalizeHeight(force){
		if(force && !this.table.options.rowHeight){
			this.clearCellHeight();
		}
		
		this.calcHeight(force);
		
		this.setCellHeight();
	}
	
	//set height of rows
	setHeight(height, force){
		if(this.height != height || force){
			
			this.manualHeight = true;
			
			this.height = height;
			this.heightStyled = height ? height + "px" : "";
			
			this.setCellHeight();
			
			// this.outerHeight = this.element.outerHeight();
			this.outerHeight = this.element.offsetHeight;

			if(this.subscribedExternal("rowHeight")){
				this.dispatchExternal("rowHeight", this.getComponent());
			}
		}
	}
	
	//return rows outer height
	getHeight(){
		return this.outerHeight;
	}
	
	//return rows outer Width
	getWidth(){
		return this.element.offsetWidth;
	}
	
	//////////////// Cell Management /////////////////
	deleteCell(cell){
		var index = this.cells.indexOf(cell);
		
		if(index > -1){
			this.cells.splice(index, 1);
		}
	}
	
	//////////////// Data Management /////////////////
	setData(data){
		this.data = this.chain("row-data-init-before", [this, data], undefined, data);
		
		this.dispatch("row-data-init-after", this);
	}
	
	//update the rows data
	updateData(updatedData){
		var visible = this.element && Helpers.elVisible(this.element),
		tempData = {},
		newRowData;
		
		return new Promise((resolve, reject) => {
			
			if(typeof updatedData === "string"){
				updatedData = JSON.parse(updatedData);
			}
			
			this.dispatch("row-data-save-before", this);
			
			if(this.subscribed("row-data-changing")){
				tempData = Object.assign(tempData, this.data);
				tempData = Object.assign(tempData, updatedData);
			}
			
			newRowData = this.chain("row-data-changing", [this, tempData, updatedData], null, updatedData);
			
			//set data
			for (let attrname in newRowData) {
				this.data[attrname] = newRowData[attrname];
			}
			
			this.dispatch("row-data-save-after", this);
			
			//update affected cells only
			for (let attrname in updatedData) {
				
				let columns = this.table.columnManager.getColumnsByFieldRoot(attrname);
				
				columns.forEach((column) => {
					let cell = this.getCell(column.getField());
					
					if(cell){
						let value = column.getFieldValue(newRowData);
						if(cell.getValue() !== value){
							cell.setValueProcessData(value);
							
							if(visible){
								cell.cellRendered();
							}
						}
					}
				});
			}
			
			//Partial reinitialization if visible
			if(visible){
				this.normalizeHeight(true);
				
				if(this.table.options.rowFormatter){
					this.table.options.rowFormatter(this.getComponent());
				}
			}else {
				this.initialized = false;
				this.height = 0;
				this.heightStyled = "";
			}
			
			this.dispatch("row-data-changed", this, visible, updatedData);
			
			//this.reinitialize();
			
			this.dispatchExternal("rowUpdated", this.getComponent());
			
			if(this.subscribedExternal("dataChanged")){
				this.dispatchExternal("dataChanged", this.table.rowManager.getData());
			}
			
			resolve();
		});
	}
	
	getData(transform){
		if(transform){
			return this.chain("row-data-retrieve", [this, transform], null, this.data);
		}
		
		return this.data;
	}
	
	getCell(column){
		var match = false;
		
		column = this.table.columnManager.findColumn(column);
		
		if(!this.initialized && this.cells.length === 0){
			this.generateCells();
		}
		
		match = this.cells.find(function(cell){
			return cell.column === column;
		});
		
		return match;
	}
	
	getCellIndex(findCell){
		return this.cells.findIndex(function(cell){
			return cell === findCell;
		});
	}
	
	findCell(subject){
		return this.cells.find((cell) => {
			return cell.element === subject;
		});
	}
	
	getCells(){
		if(!this.initialized && this.cells.length === 0){
			this.generateCells();
		}
		
		return this.cells;
	}
	
	nextRow(){
		var row = this.table.rowManager.nextDisplayRow(this, true);
		return row || false;
	}
	
	prevRow(){
		var row = this.table.rowManager.prevDisplayRow(this, true);
		return row || false;
	}
	
	moveToRow(to, before){
		var toRow = this.table.rowManager.findRow(to);
		
		if(toRow){
			this.table.rowManager.moveRowActual(this, toRow, !before);
			this.table.rowManager.refreshActiveData("display", false, true);
		}else {
			console.warn("Move Error - No matching row found:", to);
		}
	}
	
	///////////////////// Actions  /////////////////////
	delete(){
		this.dispatch("row-delete", this);
		
		this.deleteActual();
		
		return Promise.resolve();
	}
	
	deleteActual(blockRedraw){
		this.detachModules();
		
		this.table.rowManager.deleteRow(this, blockRedraw);
		
		this.deleteCells();
		
		this.initialized = false;
		this.heightInitialized = false;
		this.element = false;
		
		this.dispatch("row-deleted", this);
	}
	
	detachModules(){
		this.dispatch("row-deleting", this);
	}
	
	deleteCells(){
		var cellCount = this.cells.length;
		
		for(let i = 0; i < cellCount; i++){
			this.cells[0].delete();
		}
	}
	
	wipe(){
		this.detachModules();
		this.deleteCells();
		
		if(this.element){
			while(this.element.firstChild) this.element.removeChild(this.element.firstChild);
			
			if(this.element.parentNode){
				this.element.parentNode.removeChild(this.element);
			}
		}
		
		this.element = false;
		this.modules = {};
	}

	isDisplayed(){
		return this.table.rowManager.getDisplayRows().includes(this);
	}

	getPosition(){
		return this.isDisplayed() ? this.position : false;
	}

	setPosition(position){
		if(position != this.position){
			this.position = position;

			this.positionWatchers.forEach((callback) => {
				callback(this.position);
			});
		}
	}

	watchPosition(callback){
		this.positionWatchers.push(callback);

		callback(this.position);
	}
	
	getGroup(){
		return this.modules.group || false;
	}
	
	//////////////// Object Generation /////////////////
	getComponent(){
		if(!this.component){
			this.component = new RowComponent(this);
		}
		
		return this.component;
	}
}

class BasicVertical extends Renderer{
	constructor(table){
		super(table);
		
		this.verticalFillMode = "fill";
		
		this.scrollTop = 0;
		this.scrollLeft = 0;
		
		this.scrollTop = 0;
		this.scrollLeft = 0;
	}
	
	clearRows(){
		var element = this.tableElement;
		
		// element.children.detach();
		while(element.firstChild) element.removeChild(element.firstChild);
		
		element.scrollTop = 0;
		element.scrollLeft = 0;
		
		element.style.minWidth = "";
		element.style.minHeight = "";
		element.style.display = "";
		element.style.visibility = "";
	}
	
	renderRows() {
		var element = this.tableElement,
		onlyGroupHeaders = true,
		tableFrag = document.createDocumentFragment(),
		rows = this.rows();
		
		rows.forEach((row, index) => {
			this.styleRow(row, index);
			row.initialize(false, true);
			
			if (row.type !== "group") {
				onlyGroupHeaders = false;
			}
			
			tableFrag.appendChild(row.getElement());
		});
		
		element.appendChild(tableFrag);
		
		rows.forEach((row) => {
			row.rendered();
			
			if(!row.heightInitialized) {
				row.calcHeight(true);
			}
		});
		
		rows.forEach((row) => {
			if(!row.heightInitialized) {
				row.setCellHeight();
			}
		});
		
		if(onlyGroupHeaders){
			element.style.minWidth = this.table.columnManager.getWidth() + "px";
		}else {
			element.style.minWidth = "";
		}
	}
	
	
	rerenderRows(callback){	
		this.clearRows();
		
		if(callback){
			callback();
		}
		
		this.renderRows();

		if(!this.rows().length){
			this.table.rowManager.tableEmpty();
		}
	}
	
	scrollToRowNearestTop(row){
		var rowTop = Helpers.elOffset(row.getElement()).top;
		
		return !(Math.abs(this.elementVertical.scrollTop - rowTop) > Math.abs(this.elementVertical.scrollTop + this.elementVertical.clientHeight - rowTop));
	}
	
	scrollToRow(row){
		var rowEl = row.getElement();
		
		this.elementVertical.scrollTop = Helpers.elOffset(rowEl).top - Helpers.elOffset(this.elementVertical).top + this.elementVertical.scrollTop;
	}
	
	visibleRows(includingBuffer){
		return this.rows();
	}
	
}

class VirtualDomVertical extends Renderer{
	constructor(table){
		super(table);

		this.verticalFillMode = "fill";

		this.scrollTop = 0;
		this.scrollLeft = 0;

		this.vDomRowHeight = 20; //approximation of row heights for padding

		this.vDomTop = 0; //hold position for first rendered row in the virtual DOM
		this.vDomBottom = 0; //hold position for last rendered row in the virtual DOM

		this.vDomScrollPosTop = 0; //last scroll position of the vDom top;
		this.vDomScrollPosBottom = 0; //last scroll position of the vDom bottom;

		this.vDomTopPad = 0; //hold value of padding for top of virtual DOM
		this.vDomBottomPad = 0; //hold value of padding for bottom of virtual DOM

		this.vDomMaxRenderChain = 90; //the maximum number of dom elements that can be rendered in 1 go

		this.vDomWindowBuffer = 0; //window row buffer before removing elements, to smooth scrolling

		this.vDomWindowMinTotalRows = 20; //minimum number of rows to be generated in virtual dom (prevent buffering issues on tables with tall rows)
		this.vDomWindowMinMarginRows = 5; //minimum number of rows to be generated in virtual dom margin

		this.vDomTopNewRows = []; //rows to normalize after appending to optimize render speed
		this.vDomBottomNewRows = []; //rows to normalize after appending to optimize render speed
	}

	//////////////////////////////////////
	///////// Public Functions ///////////
	//////////////////////////////////////

	clearRows(){
		var element = this.tableElement;

		// element.children.detach();
		while(element.firstChild) element.removeChild(element.firstChild);

		element.style.paddingTop = "";
		element.style.paddingBottom = "";
		element.style.minHeight = "";
		element.style.display = "";
		element.style.visibility = "";

		this.elementVertical.scrollTop = 0;
		this.elementVertical.scrollLeft = 0;

		this.scrollTop = 0;
		this.scrollLeft = 0;

		this.vDomTop = 0;
		this.vDomBottom = 0;
		this.vDomTopPad = 0;
		this.vDomBottomPad = 0;
		this.vDomScrollPosTop = 0;
		this.vDomScrollPosBottom = 0;
	}

	renderRows(){
		this._virtualRenderFill();
	}

	rerenderRows(callback){
		var scrollTop = this.elementVertical.scrollTop;
		var topRow = false;
		var topOffset = false;

		var left = this.table.rowManager.scrollLeft;

		var rows = this.rows();

		for(var i = this.vDomTop; i <= this.vDomBottom; i++){

			if(rows[i]){
				var diff = scrollTop - rows[i].getElement().offsetTop;

				if(topOffset === false || Math.abs(diff) < topOffset){
					topOffset = diff;
					topRow = i;
				}else {
					break;
				}
			}
		}

		rows.forEach((row) => {
			row.deinitializeHeight();
		});

		if(callback){
			callback();
		}

		if(this.rows().length){
			this._virtualRenderFill((topRow === false ? this.rows.length - 1 : topRow), true, topOffset || 0);
		}else {
			this.clear();
			this.table.rowManager.tableEmpty();
		}

		this.scrollColumns(left);
	}

	scrollColumns(left){
		this.table.rowManager.scrollHorizontal(left);
	}

	scrollRows(top, dir){
		var topDiff = top - this.vDomScrollPosTop;
		var bottomDiff = top - this.vDomScrollPosBottom;
		var margin = this.vDomWindowBuffer * 2;
		var rows = this.rows();

		this.scrollTop = top;

		if(-topDiff > margin || bottomDiff > margin){
			//if big scroll redraw table;
			var left = this.table.rowManager.scrollLeft;
			this._virtualRenderFill(Math.floor((this.elementVertical.scrollTop / this.elementVertical.scrollHeight) * rows.length));
			this.scrollColumns(left);
		}else {

			if(dir){
				//scrolling up
				if(topDiff < 0){
					this._addTopRow(rows, -topDiff);
				}

				if(bottomDiff < 0){
					//hide bottom row if needed
					if(this.vDomScrollHeight - this.scrollTop > this.vDomWindowBuffer){
						this._removeBottomRow(rows, -bottomDiff);
					}else {
						this.vDomScrollPosBottom = this.scrollTop;
					}
				}
			}else {

				if(bottomDiff >= 0){
					this._addBottomRow(rows, bottomDiff);
				}

				//scrolling down
				if(topDiff >= 0){
					//hide top row if needed
					if(this.scrollTop > this.vDomWindowBuffer){
						this._removeTopRow(rows, topDiff);
					}else {
						this.vDomScrollPosTop = this.scrollTop;
					}
				}
			}
		}
	}

	resize(){
		this.vDomWindowBuffer = this.table.options.renderVerticalBuffer || this.elementVertical.clientHeight;
	}

	scrollToRowNearestTop(row){
		var rowIndex = this.rows().indexOf(row);

		return !(Math.abs(this.vDomTop - rowIndex) > Math.abs(this.vDomBottom - rowIndex));
	}

	scrollToRow(row){
		var index = this.rows().indexOf(row);

		if(index > -1){
			this._virtualRenderFill(index, true);
		}
	}

	visibleRows(includingBuffer){
		var topEdge = this.elementVertical.scrollTop,
		bottomEdge = this.elementVertical.clientHeight + topEdge,
		topFound = false,
		topRow = 0,
		bottomRow = 0,
		rows = this.rows();

		if(includingBuffer){
			topRow = this.vDomTop;
			bottomRow = this.vDomBottom;
		}else {
			for(var i = this.vDomTop; i <= this.vDomBottom; i++){
				if(rows[i]){
					if(!topFound){
						if((topEdge - rows[i].getElement().offsetTop) >= 0){
							topRow = i;
						}else {
							topFound = true;

							if(bottomEdge - rows[i].getElement().offsetTop >= 0){
								bottomRow = i;
							}else {
								break;
							}
						}
					}else {
						if(bottomEdge - rows[i].getElement().offsetTop >= 0){
							bottomRow = i;
						}else {
							break;
						}
					}
				}
			}
		}

		return rows.slice(topRow, bottomRow + 1);
	}

	//////////////////////////////////////
	//////// Internal Rendering //////////
	//////////////////////////////////////

	//full virtual render
	_virtualRenderFill(position, forceMove, offset) {
		var	element = this.tableElement,
		holder = this.elementVertical,
		topPad = 0,
		rowsHeight = 0,
		rowHeight = 0,
		heightOccupied = 0,
		topPadHeight = 0,
		i = 0,
		rows = this.rows(),
		rowsCount = rows.length,
		index = 0,
		row,
		rowFragment,
		renderedRows = [],
		totalRowsRendered = 0,
		rowsToRender = 0,
		fixedHeight = this.table.rowManager.fixedHeight,
		containerHeight = this.elementVertical.clientHeight, 
		avgRowHeight = this.table.options.rowHeight, 
		resized = true;

		position = position || 0;

		offset = offset || 0;

		if(!position){
			this.clear();
		}else {
			while(element.firstChild) element.removeChild(element.firstChild);

			//check if position is too close to bottom of table
			heightOccupied = (rowsCount - position + 1) * this.vDomRowHeight;

			if(heightOccupied < containerHeight){
				position -= Math.ceil((containerHeight - heightOccupied) / this.vDomRowHeight);
				if(position < 0){
					position = 0;
				}
			}

			//calculate initial pad
			topPad = Math.min(Math.max(Math.floor(this.vDomWindowBuffer / this.vDomRowHeight),  this.vDomWindowMinMarginRows), position);
			position -= topPad;
		}

		if(rowsCount && Helpers.elVisible(this.elementVertical)){
			this.vDomTop = position;
			this.vDomBottom = position -1;

			if(fixedHeight || this.table.options.maxHeight) {
				if(avgRowHeight) {
					rowsToRender = (containerHeight / avgRowHeight) + (this.vDomWindowBuffer / avgRowHeight);
				}
				rowsToRender = Math.max(this.vDomWindowMinTotalRows, Math.ceil(rowsToRender));
			}
			else {
				rowsToRender = rowsCount;
			}

			while(((rowsToRender == rowsCount || rowsHeight <= containerHeight + this.vDomWindowBuffer) || totalRowsRendered < this.vDomWindowMinTotalRows) && this.vDomBottom < rowsCount -1) {
				renderedRows = [];
				rowFragment = document.createDocumentFragment();

				i = 0;

				while ((i < rowsToRender) && this.vDomBottom < rowsCount -1) {	
					index = this.vDomBottom + 1,
					row = rows[index];

					this.styleRow(row, index);

					row.initialize(false, true);
					if(!row.heightInitialized && !this.table.options.rowHeight){
						row.clearCellHeight();
					}

					rowFragment.appendChild(row.getElement());
					renderedRows.push(row);
					this.vDomBottom ++;
					i++;
				}

				if(!renderedRows.length){
					break;
				}

				element.appendChild(rowFragment);
				
				// NOTE: The next 3 loops are separate on purpose
				// This is to batch up the dom writes and reads which drastically improves performance 

				renderedRows.forEach((row) => {
					row.rendered();

					if(!row.heightInitialized) {
						row.calcHeight(true);
					}
				});

				renderedRows.forEach((row) => {
					if(!row.heightInitialized) {
						row.setCellHeight();
					}
				});

				renderedRows.forEach((row) => {
					rowHeight = row.getHeight();
					
					if(totalRowsRendered < topPad){
						topPadHeight += rowHeight;
					}else {
						rowsHeight += rowHeight;
					}

					if(rowHeight > this.vDomWindowBuffer){
						this.vDomWindowBuffer = rowHeight * 2;
					}
					totalRowsRendered++;
				});

				resized = this.table.rowManager.adjustTableSize();
				containerHeight = this.elementVertical.clientHeight;
				if(resized && (fixedHeight || this.table.options.maxHeight))
				{
					avgRowHeight = rowsHeight / totalRowsRendered;
					rowsToRender = Math.max(this.vDomWindowMinTotalRows, Math.ceil((containerHeight / avgRowHeight) + (this.vDomWindowBuffer / avgRowHeight)));
				}
			}

			if(!position){
				this.vDomTopPad = 0;
				//adjust row height to match average of rendered elements
				this.vDomRowHeight = Math.floor((rowsHeight + topPadHeight) / totalRowsRendered);
				this.vDomBottomPad = this.vDomRowHeight * (rowsCount - this.vDomBottom -1);

				this.vDomScrollHeight = topPadHeight + rowsHeight + this.vDomBottomPad - containerHeight;
			}else {
				this.vDomTopPad = !forceMove ? this.scrollTop - topPadHeight : (this.vDomRowHeight * this.vDomTop) + offset;
				this.vDomBottomPad = this.vDomBottom == rowsCount-1 ? 0 : Math.max(this.vDomScrollHeight - this.vDomTopPad - rowsHeight - topPadHeight, 0);
			}
			
			element.style.paddingTop = this.vDomTopPad+"px";
			element.style.paddingBottom = this.vDomBottomPad+"px";

			if(forceMove){
				this.scrollTop = this.vDomTopPad + (topPadHeight) + offset - (this.elementVertical.scrollWidth > this.elementVertical.clientWidth ? this.elementVertical.offsetHeight - containerHeight : 0);
			}

			this.scrollTop = Math.min(this.scrollTop, this.elementVertical.scrollHeight - containerHeight);

			//adjust for horizontal scrollbar if present (and not at top of table)
			if(this.elementVertical.scrollWidth > this.elementVertical.clientWidth && forceMove){
				this.scrollTop += this.elementVertical.offsetHeight - containerHeight;
			}

			this.vDomScrollPosTop = this.scrollTop;
			this.vDomScrollPosBottom = this.scrollTop;

			holder.scrollTop = this.scrollTop;

			this.dispatch("render-virtual-fill");
		}
	}

	_addTopRow(rows, fillableSpace){
		var table = this.tableElement,
		addedRows = [],
		paddingAdjust = 0,
		index = this.vDomTop -1,
		i = 0,
		working = true;

		while(working){
			if(this.vDomTop){
				let row = rows[index],
				rowHeight, initialized;

				if(row && i < this.vDomMaxRenderChain){
					rowHeight = row.getHeight() || this.vDomRowHeight;
					initialized = row.initialized;

					if(fillableSpace >= rowHeight){

						this.styleRow(row, index);
						table.insertBefore(row.getElement(), table.firstChild);

						if(!row.initialized || !row.heightInitialized){
							addedRows.push(row);
						}

						row.initialize();

						if(!initialized){
							rowHeight = row.getElement().offsetHeight;

							if(rowHeight > this.vDomWindowBuffer){
								this.vDomWindowBuffer = rowHeight * 2;
							}
						}

						fillableSpace -= rowHeight;
						paddingAdjust += rowHeight;

						this.vDomTop--;
						index--;
						i++;

					}else {
						working = false;
					}

				}else {
					working = false;
				}

			}else {
				working = false;
			}
		}

		for (let row of addedRows){
			row.clearCellHeight();
		}

		this._quickNormalizeRowHeight(addedRows);

		if(paddingAdjust){
			this.vDomTopPad -= paddingAdjust;

			if(this.vDomTopPad < 0){
				this.vDomTopPad = index * this.vDomRowHeight;
			}

			if(index < 1){
				this.vDomTopPad = 0;
			}

			table.style.paddingTop = this.vDomTopPad + "px";
			this.vDomScrollPosTop -= paddingAdjust;
		}
	}

	_removeTopRow(rows, fillableSpace){
		var removableRows = [],
		paddingAdjust = 0,
		i = 0,
		working = true;

		while(working){
			let row = rows[this.vDomTop],
			rowHeight;

			if(row && i < this.vDomMaxRenderChain){
				rowHeight = row.getHeight() || this.vDomRowHeight;

				if(fillableSpace >= rowHeight){
					this.vDomTop++;

					fillableSpace -= rowHeight;
					paddingAdjust += rowHeight;

					removableRows.push(row);
					i++;
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}

		for (let row of removableRows){
			let rowEl = row.getElement();

			if(rowEl.parentNode){
				rowEl.parentNode.removeChild(rowEl);
			}
		}

		if(paddingAdjust){
			this.vDomTopPad += paddingAdjust;
			this.tableElement.style.paddingTop = this.vDomTopPad + "px";
			this.vDomScrollPosTop += this.vDomTop ? paddingAdjust : paddingAdjust + this.vDomWindowBuffer;
		}
	}

	_addBottomRow(rows, fillableSpace){
		var table = this.tableElement,
		addedRows = [],
		paddingAdjust = 0,
		index = this.vDomBottom + 1,
		i = 0,
		working = true;

		while(working){
			let row = rows[index],
			rowHeight, initialized;

			if(row && i < this.vDomMaxRenderChain){
				rowHeight = row.getHeight() || this.vDomRowHeight;
				initialized = row.initialized;

				if(fillableSpace >= rowHeight){

					this.styleRow(row, index);
					table.appendChild(row.getElement());

					if(!row.initialized || !row.heightInitialized){
						addedRows.push(row);
					}

					row.initialize();

					if(!initialized){
						rowHeight = row.getElement().offsetHeight;

						if(rowHeight > this.vDomWindowBuffer){
							this.vDomWindowBuffer = rowHeight * 2;
						}
					}

					fillableSpace -= rowHeight;
					paddingAdjust += rowHeight;

					this.vDomBottom++;
					index++;
					i++;
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}

		for (let row of addedRows){
			row.clearCellHeight();
		}

		this._quickNormalizeRowHeight(addedRows);

		if(paddingAdjust){
			this.vDomBottomPad -= paddingAdjust;

			if(this.vDomBottomPad < 0 || index == rows.length -1){
				this.vDomBottomPad = 0;
			}

			table.style.paddingBottom = this.vDomBottomPad + "px";
			this.vDomScrollPosBottom += paddingAdjust;
		}
	}

	_removeBottomRow(rows, fillableSpace){
		var removableRows = [],
		paddingAdjust = 0,
		i = 0,
		working = true;

		while(working){
			let row = rows[this.vDomBottom],
			rowHeight;

			if(row && i < this.vDomMaxRenderChain){
				rowHeight = row.getHeight() || this.vDomRowHeight;

				if(fillableSpace >= rowHeight){
					this.vDomBottom --;

					fillableSpace -= rowHeight;
					paddingAdjust += rowHeight;

					removableRows.push(row);
					i++;
				}else {
					working = false;
				}
			}else {
				working = false;
			}
		}

		for (let row of removableRows){
			let rowEl = row.getElement();

			if(rowEl.parentNode){
				rowEl.parentNode.removeChild(rowEl);
			}
		}

		if(paddingAdjust){
			this.vDomBottomPad += paddingAdjust;

			if(this.vDomBottomPad < 0){
				this.vDomBottomPad = 0;
			}

			this.tableElement.style.paddingBottom = this.vDomBottomPad + "px";
			this.vDomScrollPosBottom -= paddingAdjust;
		}
	}

	_quickNormalizeRowHeight(rows){
		for(let row of rows){
			row.calcHeight();
		}

		for(let row of rows){
			row.setCellHeight();
		}
	}
}

class RowManager extends CoreFeature{
	
	constructor(table){
		super(table);
		
		this.element = this.createHolderElement(); //containing element
		this.tableElement = this.createTableElement(); //table element
		this.heightFixer = this.createTableElement(); //table element
		this.placeholder = null; //placeholder element
		this.placeholderContents = null; //placeholder element
		
		this.firstRender = false; //handle first render
		this.renderMode = "virtual"; //current rendering mode
		this.fixedHeight = false; //current rendering mode
		
		this.rows = []; //hold row data objects
		this.activeRowsPipeline = []; //hold calculation of active rows
		this.activeRows = []; //rows currently available to on display in the table
		this.activeRowsCount = 0; //count of active rows
		
		this.displayRows = []; //rows currently on display in the table
		this.displayRowsCount = 0; //count of display rows
		
		this.scrollTop = 0;
		this.scrollLeft = 0;
		
		this.redrawBlock = false; //prevent redraws to allow multiple data manipulations before continuing
		this.redrawBlockRestoreConfig = false; //store latest redraw function calls for when redraw is needed
		this.redrawBlockRenderInPosition = false; //store latest redraw function calls for when redraw is needed
		
		this.dataPipeline = []; //hold data pipeline tasks
		this.displayPipeline = []; //hold data display pipeline tasks
		
		this.scrollbarWidth = 0;
		
		this.renderer = null;
	}
	
	//////////////// Setup Functions /////////////////
	
	createHolderElement (){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-tableholder");
		el.setAttribute("tabindex", 0);
		// el.setAttribute("role", "rowgroup");
		
		return el;
	}
	
	createTableElement (){
		var el = document.createElement("div");
		
		el.classList.add("tabulator-table");
		el.setAttribute("role", "rowgroup");
		
		return el;
	}
	
	initializePlaceholder(){
		var placeholder = this.table.options.placeholder;
		
		if(typeof placeholder === "function"){
			placeholder = placeholder.call(this.table);
		}
		
		placeholder = this.chain("placeholder", [placeholder], placeholder, placeholder) || placeholder;
		
		//configure placeholder element
		if(placeholder){	
			let el = document.createElement("div");
			el.classList.add("tabulator-placeholder");
			
			if(typeof placeholder == "string"){
				let contents = document.createElement("div");
				contents.classList.add("tabulator-placeholder-contents");
				contents.innerHTML = placeholder;
				
				el.appendChild(contents);
				
				this.placeholderContents = contents;
				
			}else if(typeof HTMLElement !== "undefined" && placeholder instanceof HTMLElement){
				
				el.appendChild(placeholder);
				this.placeholderContents = placeholder;
			}else {
				console.warn("Invalid placeholder provided, must be string or HTML Element", placeholder);
				
				this.el = null;
			}
			
			this.placeholder = el;
		}
	}
	
	//return containing element
	getElement(){
		return this.element;
	}
	
	//return table element
	getTableElement(){
		return this.tableElement;
	}
	
	initialize(){
		this.initializePlaceholder();
		this.initializeRenderer();
		
		//initialize manager
		this.element.appendChild(this.tableElement);
		
		this.firstRender = true;
		
		//scroll header along with table body
		this.element.addEventListener("scroll", () => {
			var left = this.element.scrollLeft,
			leftDir = this.scrollLeft > left,
			top = this.element.scrollTop,
			topDir = this.scrollTop > top;
			
			//handle horizontal scrolling
			if(this.scrollLeft != left){
				this.scrollLeft = left;
				
				this.dispatch("scroll-horizontal", left, leftDir);
				this.dispatchExternal("scrollHorizontal", left, leftDir);
				
				this._positionPlaceholder();
			}
			
			//handle vertical scrolling
			if(this.scrollTop != top){
				this.scrollTop = top;
				
				this.renderer.scrollRows(top, topDir);
				
				this.dispatch("scroll-vertical", top, topDir);
				this.dispatchExternal("scrollVertical", top, topDir);
			}
		});
	}
	
	////////////////// Row Manipulation //////////////////
	findRow(subject){
		if(typeof subject == "object"){
			if(subject instanceof Row){
				//subject is row element
				return subject;
			}else if(subject instanceof RowComponent){
				//subject is public row component
				return subject._getSelf() || false;
			}else if(typeof HTMLElement !== "undefined" && subject instanceof HTMLElement){
				//subject is a HTML element of the row
				let match = this.rows.find((row) => {
					return row.getElement() === subject;
				});
				
				return match || false;
			}else if(subject === null){
				return false;
			}
		}else if(typeof subject == "undefined"){
			return false;
		}else {
			//subject should be treated as the index of the row
			let match = this.rows.find((row) => {
				return row.data[this.table.options.index] == subject;
			});
			
			return match || false;
		}
		
		//catch all for any other type of input
		return false;
	}
	
	getRowFromDataObject(data){
		var match = this.rows.find((row) => {
			return row.data === data;
		});
		
		return match || false;
	}
	
	getRowFromPosition(position){
		return this.getDisplayRows().find((row) => {
			return row.type === "row" && row.getPosition() === position && row.isDisplayed();
		});
	}
	
	scrollToRow(row, position, ifVisible){
		return this.renderer.scrollToRowPosition(row, position, ifVisible);
	}
	
	////////////////// Data Handling //////////////////
	setData(data, renderInPosition, columnsChanged){
		return new Promise((resolve, reject)=>{
			if(renderInPosition && this.getDisplayRows().length){
				if(this.table.options.pagination){
					this._setDataActual(data, true);
				}else {
					this.reRenderInPosition(() => {
						this._setDataActual(data);
					});
				}
			}else {
				if(this.table.options.autoColumns && columnsChanged && this.table.initialized){
					this.table.columnManager.generateColumnsFromRowData(data);
				}
				this.resetScroll();
				
				this._setDataActual(data);
			}
			
			resolve();
		});
	}
	
	_setDataActual(data, renderInPosition){
		this.dispatchExternal("dataProcessing", data);
		
		this._wipeElements();
		
		if(Array.isArray(data)){
			this.dispatch("data-processing", data);
			
			data.forEach((def, i) => {
				if(def && typeof def === "object"){
					var row = new Row(def, this);
					this.rows.push(row);
				}else {
					console.warn("Data Loading Warning - Invalid row data detected and ignored, expecting object but received:", def);
				}
			});
			
			this.refreshActiveData(false, false, renderInPosition);
			
			this.dispatch("data-processed", data);
			this.dispatchExternal("dataProcessed", data);
		}else {
			console.error("Data Loading Error - Unable to process data due to invalid data type \nExpecting: array \nReceived: ", typeof data, "\nData:     ", data);
		}
	}
	
	_wipeElements(){
		this.dispatch("rows-wipe");
		
		this.destroy();
		
		this.adjustTableSize();
		
		this.dispatch("rows-wiped");
	}
	
	destroy(){
		this.rows.forEach((row) => {
			row.wipe();
		});
		
		this.rows = [];
		this.activeRows = [];
		this.activeRowsPipeline = [];
		this.activeRowsCount = 0;
		this.displayRows = [];
		this.displayRowsCount = 0;
	}
	
	deleteRow(row, blockRedraw){
		var allIndex = this.rows.indexOf(row),
		activeIndex = this.activeRows.indexOf(row);
		
		if(activeIndex > -1){
			this.activeRows.splice(activeIndex, 1);
		}
		
		if(allIndex > -1){
			this.rows.splice(allIndex, 1);
		}
		
		this.setActiveRows(this.activeRows);
		
		this.displayRowIterator((rows) => {
			var displayIndex = rows.indexOf(row);
			
			if(displayIndex > -1){
				rows.splice(displayIndex, 1);
			}
		});
		
		if(!blockRedraw){
			this.reRenderInPosition();
		}
		
		this.regenerateRowPositions();
		
		this.dispatchExternal("rowDeleted", row.getComponent());
		
		if(!this.displayRowsCount){
			this.tableEmpty();
		}
		
		if(this.subscribedExternal("dataChanged")){
			this.dispatchExternal("dataChanged", this.getData());
		}
	}
	
	addRow(data, pos, index, blockRedraw){
		var row = this.addRowActual(data, pos, index, blockRedraw);
		return row;
	}
	
	//add multiple rows
	addRows(data, pos, index, refreshDisplayOnly){
		var rows = [];
		
		return new Promise((resolve, reject) => {
			pos = this.findAddRowPos(pos);
			
			if(!Array.isArray(data)){
				data = [data];
			}
			
			if((typeof index == "undefined" && pos) || (typeof index !== "undefined" && !pos)){
				data.reverse();
			}
			
			data.forEach((item, i) => {
				var row = this.addRow(item, pos, index, true);
				rows.push(row);
				this.dispatch("row-added", row, item, pos, index);
			});
			
			this.refreshActiveData(refreshDisplayOnly ? "displayPipeline" : false, false, true);
			
			this.regenerateRowPositions();
			
			if(this.displayRowsCount){
				this._clearPlaceholder();
			}
			
			resolve(rows);
		});
	}
	
	findAddRowPos(pos){
		if(typeof pos === "undefined"){
			pos = this.table.options.addRowPos;
		}
		
		if(pos === "pos"){
			pos = true;
		}
		
		if(pos === "bottom"){
			pos = false;
		}
		
		return pos;
	}
	
	addRowActual(data, pos, index, blockRedraw){
		var row = data instanceof Row ? data : new Row(data || {}, this),
		top = this.findAddRowPos(pos),
		allIndex = -1,
		activeIndex, chainResult;
		
		if(!index){
			chainResult = this.chain("row-adding-position", [row, top], null, {index, top});
			
			index = chainResult.index;
			top = chainResult.top;
		}
		
		if(typeof index !== "undefined"){
			index = this.findRow(index);
		}
		
		index = this.chain("row-adding-index", [row, index, top], null, index);
		
		if(index){
			allIndex = this.rows.indexOf(index);
		}
		
		if(index && allIndex > -1){
			activeIndex = this.activeRows.indexOf(index);
			
			this.displayRowIterator(function(rows){
				var displayIndex = rows.indexOf(index);
				
				if(displayIndex > -1){
					rows.splice((top ? displayIndex : displayIndex + 1), 0, row);
				}
			});
			
			if(activeIndex > -1){
				this.activeRows.splice((top ? activeIndex : activeIndex + 1), 0, row);
			}
			
			this.rows.splice((top ? allIndex : allIndex + 1), 0, row);
			
		}else {
			
			if(top){
				
				this.displayRowIterator(function(rows){
					rows.unshift(row);
				});
				
				this.activeRows.unshift(row);
				this.rows.unshift(row);
			}else {
				this.displayRowIterator(function(rows){
					rows.push(row);
				});
				
				this.activeRows.push(row);
				this.rows.push(row);
			}
		}
		
		this.setActiveRows(this.activeRows);
		
		this.dispatchExternal("rowAdded", row.getComponent());
		
		if(this.subscribedExternal("dataChanged")){
			this.dispatchExternal("dataChanged", this.table.rowManager.getData());
		}
		
		if(!blockRedraw){
			this.reRenderInPosition();
		}
		
		return row;
	}
	
	moveRow(from, to, after){
		this.dispatch("row-move", from, to, after);
		
		this.moveRowActual(from, to, after);
		
		this.regenerateRowPositions();
		
		this.dispatch("row-moved", from, to, after);
		this.dispatchExternal("rowMoved", from.getComponent());
	}
	
	moveRowActual(from, to, after){
		this.moveRowInArray(this.rows, from, to, after);
		this.moveRowInArray(this.activeRows, from, to, after);
		
		this.displayRowIterator((rows) => {
			this.moveRowInArray(rows, from, to, after);
		});
		
		this.dispatch("row-moving", from, to, after);
	}
	
	moveRowInArray(rows, from, to, after){
		var	fromIndex, toIndex, start, end;
		
		if(from !== to){
			
			fromIndex = rows.indexOf(from);
			
			if (fromIndex > -1) {
				
				rows.splice(fromIndex, 1);
				
				toIndex = rows.indexOf(to);
				
				if (toIndex > -1) {
					
					if(after){
						rows.splice(toIndex+1, 0, from);
					}else {
						rows.splice(toIndex, 0, from);
					}
					
				}else {
					rows.splice(fromIndex, 0, from);
				}
			}
			
			//restyle rows
			if(rows === this.getDisplayRows()){
				
				start = fromIndex < toIndex ? fromIndex : toIndex;
				end = toIndex > fromIndex ? toIndex : fromIndex +1;
				
				for(let i = start; i <= end; i++){
					if(rows[i]){
						this.styleRow(rows[i], i);
					}
				}
			}
		}
	}
	
	clearData(){
		this.setData([]);
	}
	
	getRowIndex(row){
		return this.findRowIndex(row, this.rows);
	}
	
	getDisplayRowIndex(row){
		var index = this.getDisplayRows().indexOf(row);
		return index > -1 ? index : false;
	}
	
	nextDisplayRow(row, rowOnly){
		var index = this.getDisplayRowIndex(row),
		nextRow = false;
		
		
		if(index !== false && index < this.displayRowsCount -1){
			nextRow = this.getDisplayRows()[index+1];
		}
		
		if(nextRow && (!(nextRow instanceof Row) || nextRow.type != "row")){
			return this.nextDisplayRow(nextRow, rowOnly);
		}
		
		return nextRow;
	}
	
	prevDisplayRow(row, rowOnly){
		var index = this.getDisplayRowIndex(row),
		prevRow = false;
		
		if(index){
			prevRow = this.getDisplayRows()[index-1];
		}
		
		if(rowOnly && prevRow && (!(prevRow instanceof Row) || prevRow.type != "row")){
			return this.prevDisplayRow(prevRow, rowOnly);
		}
		
		return prevRow;
	}
	
	findRowIndex(row, list){
		var rowIndex;
		
		row = this.findRow(row);
		
		if(row){
			rowIndex = list.indexOf(row);
			
			if(rowIndex > -1){
				return rowIndex;
			}
		}
		
		return false;
	}
	
	getData(active, transform){
		var output = [],
		rows = this.getRows(active);
		
		rows.forEach(function(row){
			if(row.type == "row"){
				output.push(row.getData(transform || "data"));
			}
		});
		
		return output;
	}
	
	getComponents(active){
		var	output = [],
		rows = this.getRows(active);
		
		rows.forEach(function(row){
			output.push(row.getComponent());
		});
		
		return output;
	}
	
	getDataCount(active){
		var rows = this.getRows(active);
		
		return rows.length;
	}
	
	scrollHorizontal(left){
		this.scrollLeft = left;
		this.element.scrollLeft = left;
		
		this.dispatch("scroll-horizontal", left);
	}
	
	registerDataPipelineHandler(handler, priority){
		if(typeof priority !== "undefined"){
			this.dataPipeline.push({handler, priority});
			this.dataPipeline.sort((a, b) => {
				return a.priority - b.priority;
			});
		}else {
			console.error("Data pipeline handlers must have a priority in order to be registered");
		}
	}
	
	registerDisplayPipelineHandler(handler, priority){
		if(typeof priority !== "undefined"){
			this.displayPipeline.push({handler, priority});
			this.displayPipeline.sort((a, b) => {
				return a.priority - b.priority;
			});
		}else {
			console.error("Display pipeline handlers must have a priority in order to be registered");
		}
	}
	
	//set active data set
	refreshActiveData(handler, skipStage, renderInPosition){
		var table = this.table,
		stage = "",
		index = 0,
		cascadeOrder = ["all", "dataPipeline", "display", "displayPipeline", "end"];
		
		if(!this.table.destroyed){
			if(typeof handler === "function"){
				index = this.dataPipeline.findIndex((item) => {
					return item.handler === handler;
				});
				
				if(index > -1){
					stage = "dataPipeline";
					
					if(skipStage){
						if(index == this.dataPipeline.length - 1){
							stage = "display";
						}else {
							index++;
						}
					}
				}else {
					index = this.displayPipeline.findIndex((item) => {
						return item.handler === handler;
					});
					
					if(index > -1){
						stage = "displayPipeline";
						
						if(skipStage){
							if(index == this.displayPipeline.length - 1){
								stage = "end";
							}else {
								index++;
							}
						}
					}else {
						console.error("Unable to refresh data, invalid handler provided", handler);
						return;
					}
				}
			}else {
				stage = handler || "all";
				index = 0;
			}
			
			if(this.redrawBlock){
				if(!this.redrawBlockRestoreConfig || (this.redrawBlockRestoreConfig && ((this.redrawBlockRestoreConfig.stage === stage && index < this.redrawBlockRestoreConfig.index) || (cascadeOrder.indexOf(stage) < cascadeOrder.indexOf(this.redrawBlockRestoreConfig.stage))))){
					this.redrawBlockRestoreConfig = {
						handler: handler,
						skipStage: skipStage,
						renderInPosition: renderInPosition,
						stage:stage,
						index:index,
					};
				}
				
				return;
			}else {
				if(Helpers.elVisible(this.element)){
					if(renderInPosition){
						this.reRenderInPosition(this.refreshPipelines.bind(this, handler, stage, index, renderInPosition));
					}else {
						this.refreshPipelines(handler, stage, index, renderInPosition);
						
						if(!handler){
							this.table.columnManager.renderer.renderColumns();
						}
						
						this.renderTable();
						
						if(table.options.layoutColumnsOnNewData){
							this.table.columnManager.redraw(true);
						}
					}
				}else {
					this.refreshPipelines(handler, stage, index, renderInPosition);
				}
				
				this.dispatch("data-refreshed");
			}
		}
	}
	
	refreshPipelines(handler, stage, index, renderInPosition){
		this.dispatch("data-refreshing");
		
		if(!handler || !this.activeRowsPipeline[0]){
			this.activeRowsPipeline[0] = this.rows.slice(0);
		}
		
		//cascade through data refresh stages
		switch(stage){
			case "all":
			//handle case where all data needs refreshing
			
			case "dataPipeline":
				for(let i = index; i < this.dataPipeline.length; i++){
					let result = this.dataPipeline[i].handler(this.activeRowsPipeline[i].slice(0));
				
					this.activeRowsPipeline[i + 1] = result || this.activeRowsPipeline[i].slice(0);
				}
			
				this.setActiveRows(this.activeRowsPipeline[this.dataPipeline.length]);
			
			case "display":
				index = 0;
				this.resetDisplayRows();
			
			case "displayPipeline":
				for(let i = index; i < this.displayPipeline.length; i++){
					let result = this.displayPipeline[i].handler((i ? this.getDisplayRows(i - 1) : this.activeRows).slice(0), renderInPosition);
				
					this.setDisplayRows(result || this.getDisplayRows(i - 1).slice(0), i);
				}
			
			case "end":
			//case to handle scenario when trying to skip past end stage
				this.regenerateRowPositions();
		}
		
		if(this.getDisplayRows().length){
			this._clearPlaceholder();
		}
	}
	
	//regenerate row positions
	regenerateRowPositions(){
		var rows = this.getDisplayRows();
		var index = 1;
		
		rows.forEach((row) => {
			if (row.type === "row"){
				row.setPosition(index);
				index++;
			}
		});
	}
	
	setActiveRows(activeRows){
		this.activeRows = this.activeRows = Object.assign([], activeRows);
		this.activeRowsCount = this.activeRows.length;
	}
	
	//reset display rows array
	resetDisplayRows(){
		this.displayRows = [];
		
		this.displayRows.push(this.activeRows.slice(0));
		
		this.displayRowsCount = this.displayRows[0].length;
	}
	
	//set display row pipeline data
	setDisplayRows(displayRows, index){
		this.displayRows[index] = displayRows;
		
		if(index == this.displayRows.length -1){
			this.displayRowsCount = this.displayRows[this.displayRows.length -1].length;
		}
	}
	
	getDisplayRows(index){
		if(typeof index == "undefined"){
			return this.displayRows.length ? this.displayRows[this.displayRows.length -1] : [];
		}else {
			return this.displayRows[index] || [];
		}
	}
	
	getVisibleRows(chain, viewable){
		var rows =  Object.assign([], this.renderer.visibleRows(!viewable));
		
		if(chain){
			rows = this.chain("rows-visible", [viewable], rows, rows);
		}
		
		return rows;
	}
	
	//repeat action across display rows
	displayRowIterator(callback){
		this.activeRowsPipeline.forEach(callback);
		this.displayRows.forEach(callback);
		
		this.displayRowsCount = this.displayRows[this.displayRows.length -1].length;
	}
	
	//return only actual rows (not group headers etc)
	getRows(type){
		var rows = [];
		
		switch(type){
			case "active":
				rows = this.activeRows;
				break;
			
			case "display":
				rows = this.table.rowManager.getDisplayRows();
				break;
			
			case "visible":
				rows = this.getVisibleRows(false, true);
				break;
			
			default:
				rows = this.chain("rows-retrieve", type, null, this.rows) || this.rows;
		}
		
		return rows;
	}
	
	///////////////// Table Rendering /////////////////
	//trigger rerender of table in current position
	reRenderInPosition(callback){
		if(this.redrawBlock){
			if(callback){
				callback();
			}else {
				this.redrawBlockRenderInPosition = true;
			}
		}else {
			this.dispatchExternal("renderStarted");
			
			this.renderer.rerenderRows(callback);
			
			if(!this.fixedHeight){
				this.adjustTableSize();
			}
			
			this.scrollBarCheck();
			
			this.dispatchExternal("renderComplete");
		}
	}
	
	scrollBarCheck(){
		var scrollbarWidth = 0;
		
		//adjust for vertical scrollbar moving table when present
		if(this.element.scrollHeight > this.element.clientHeight){
			scrollbarWidth = this.element.offsetWidth - this.element.clientWidth;
		}
		
		if(scrollbarWidth !== this.scrollbarWidth){
			this.scrollbarWidth = scrollbarWidth;
			this.dispatch("scrollbar-vertical", scrollbarWidth);
		}
	}
	
	initializeRenderer(){
		var renderClass;
		
		var renderers = {
			"virtual": VirtualDomVertical,
			"basic": BasicVertical,
		};
		
		if(typeof this.table.options.renderVertical === "string"){
			renderClass = renderers[this.table.options.renderVertical];
		}else {
			renderClass = this.table.options.renderVertical;
		}
		
		if(renderClass){
			this.renderMode = this.table.options.renderVertical;
			
			this.renderer = new renderClass(this.table, this.element, this.tableElement);
			this.renderer.initialize();
			
			if((this.table.element.clientHeight || this.table.options.height) && !(this.table.options.minHeight && this.table.options.maxHeight)){
				this.fixedHeight = true;
			}else {
				this.fixedHeight = false;
			}
		}else {
			console.error("Unable to find matching renderer:", this.table.options.renderVertical);
		}
	}
	
	getRenderMode(){
		return this.renderMode;
	}
	
	renderTable(){
		this.dispatchExternal("renderStarted");
		
		this.element.scrollTop = 0;
		
		this._clearTable();
		
		if(this.displayRowsCount){
			this.renderer.renderRows();
			
			if(this.firstRender){
				this.firstRender = false;
				
				if(!this.fixedHeight){
					this.adjustTableSize();
				}
				
				this.layoutRefresh(true);
			}
		}else {
			this.renderEmptyScroll();
		}
		
		if(!this.fixedHeight){
			this.adjustTableSize();
		}
		
		this.dispatch("table-layout");
		
		if(!this.displayRowsCount){
			this._showPlaceholder();
		}
		
		this.scrollBarCheck();
		
		this.dispatchExternal("renderComplete");
	}
	
	//show scrollbars on empty table div
	renderEmptyScroll(){
		if(this.placeholder){
			this.tableElement.style.display = "none";
		}else {
			this.tableElement.style.minWidth = this.table.columnManager.getWidth() + "px";
			// this.tableElement.style.minHeight = "1px";
			// this.tableElement.style.visibility = "hidden";
		}
	}
	
	_clearTable(){	
		this._clearPlaceholder();
		
		this.scrollTop = 0;
		this.scrollLeft = 0;
		
		this.renderer.clearRows();
	}
	
	tableEmpty(){
		this.renderEmptyScroll();
		this._showPlaceholder();
	}

	checkPlaceholder(){
		if(this.displayRowsCount){
			this._clearPlaceholder();
		}else {
			this.tableEmpty();
		}
	}
	
	_showPlaceholder(){
		if(this.placeholder){
			if(this.placeholder && this.placeholder.parentNode){
				this.placeholder.parentNode.removeChild(this.placeholder);
			}
			
			this.initializePlaceholder();
			
			this.placeholder.setAttribute("tabulator-render-mode", this.renderMode);
			
			this.getElement().appendChild(this.placeholder);
			this._positionPlaceholder();

			this.adjustTableSize();
		}
	}
	
	_clearPlaceholder(){
		if(this.placeholder && this.placeholder.parentNode){
			this.placeholder.parentNode.removeChild(this.placeholder);
		}
		
		// clear empty table placeholder min
		this.tableElement.style.minWidth = "";
		this.tableElement.style.display = "";
	}
	
	_positionPlaceholder(){
		if(this.placeholder && this.placeholder.parentNode){
			this.placeholder.style.width = this.table.columnManager.getWidth() + "px";
			this.placeholderContents.style.width = this.table.rowManager.element.clientWidth + "px";
			this.placeholderContents.style.marginLeft = this.scrollLeft + "px";
		}
	}
	
	styleRow(row, index){
		var rowEl = row.getElement();
		
		if(index % 2){
			rowEl.classList.add("tabulator-row-even");
			rowEl.classList.remove("tabulator-row-odd");
		}else {
			rowEl.classList.add("tabulator-row-odd");
			rowEl.classList.remove("tabulator-row-even");
		}
	}
	
	//normalize height of active rows
	normalizeHeight(force){
		this.activeRows.forEach(function(row){
			row.normalizeHeight(force);
		});
	}
	
	//adjust the height of the table holder to fit in the Tabulator element
	adjustTableSize(){
		let initialHeight = this.element.clientHeight, minHeight;
		let resized = false;
		
		if(this.renderer.verticalFillMode === "fill"){
			let otherHeight =  Math.floor(this.table.columnManager.getElement().getBoundingClientRect().height + (this.table.footerManager && this.table.footerManager.active && !this.table.footerManager.external ? this.table.footerManager.getElement().getBoundingClientRect().height : 0));
			
			if(this.fixedHeight){
				minHeight = isNaN(this.table.options.minHeight) ? this.table.options.minHeight : this.table.options.minHeight + "px";
				
				const height = "calc(100% - " + otherHeight + "px)";
				this.element.style.minHeight = minHeight || "calc(100% - " + otherHeight + "px)";
				this.element.style.height = height;
				this.element.style.maxHeight = height;
			} else {
				this.element.style.height = "";
				this.element.style.height =
				this.table.element.clientHeight - otherHeight + "px";
				this.element.scrollTop = this.scrollTop;
			}
			
			this.renderer.resize();
			
			//check if the table has changed size when dealing with variable height tables
			if(!this.fixedHeight && initialHeight != this.element.clientHeight){
				resized = true;
				if(this.subscribed("table-resize")){
					this.dispatch("table-resize");
				}else {
					this.redraw();
				}
			}
			
			this.scrollBarCheck();
		}
		
		this._positionPlaceholder();
		return resized;
	}
	
	//reinitialize all rows
	reinitialize(){
		this.rows.forEach(function(row){
			row.reinitialize(true);
		});
	}
	
	//prevent table from being redrawn
	blockRedraw (){
		this.redrawBlock = true;
		this.redrawBlockRestoreConfig = false;
	}
	
	//restore table redrawing
	restoreRedraw (){
		this.redrawBlock = false;
		
		if(this.redrawBlockRestoreConfig){
			this.refreshActiveData(this.redrawBlockRestoreConfig.handler, this.redrawBlockRestoreConfig.skipStage, this.redrawBlockRestoreConfig.renderInPosition);
			
			this.redrawBlockRestoreConfig = false;
		}else {
			if(this.redrawBlockRenderInPosition){
				this.reRenderInPosition();
			}
		}
		
		this.redrawBlockRenderInPosition = false;
	}
	
	//redraw table
	redraw (force){
		this.adjustTableSize();
		this.table.tableWidth = this.table.element.clientWidth;
		
		if(!force){	
			this.reRenderInPosition();
			this.scrollHorizontal(this.scrollLeft);
		}else {
			this.renderTable();
		}
	}
	
	resetScroll(){
		this.element.scrollLeft = 0;
		this.element.scrollTop = 0;
		
		if(this.table.browser === "ie"){
			var event = document.createEvent("Event");
			event.initEvent("scroll", false, true);
			this.element.dispatchEvent(event);
		}else {
			this.element.dispatchEvent(new Event('scroll'));
		}
	}
}

class FooterManager extends CoreFeature{

	constructor(table){
		super(table);

		this.active = false;
		this.element = this.createElement(); //containing element
		this.containerElement = this.createContainerElement(); //containing element
		this.external = false;
	}

	initialize(){
		this.initializeElement();
	}

	createElement(){
		var el = document.createElement("div");

		el.classList.add("tabulator-footer");

		return el;
	}

	
	createContainerElement(){
		var el = document.createElement("div");

		el.classList.add("tabulator-footer-contents");

		this.element.appendChild(el);

		return el;
	}

	initializeElement(){
		if(this.table.options.footerElement){

			switch(typeof this.table.options.footerElement){
				case "string":
					if(this.table.options.footerElement[0] === "<"){
						this.containerElement.innerHTML = this.table.options.footerElement;
					}else {
						this.external = true;
						this.containerElement = document.querySelector(this.table.options.footerElement);
					}
					break;

				default:
					this.element = this.table.options.footerElement;
					break;
			}
		}
	}

	getElement(){
		return this.element;
	}

	append(element){
		this.activate();

		this.containerElement.appendChild(element);
		this.table.rowManager.adjustTableSize();
	}

	prepend(element){
		this.activate();

		this.element.insertBefore(element, this.element.firstChild);
		this.table.rowManager.adjustTableSize();
	}

	remove(element){
		element.parentNode.removeChild(element);
		this.deactivate();
	}

	deactivate(force){
		if(!this.element.firstChild || force){
			if(!this.external){
				this.element.parentNode.removeChild(this.element);
			}
			this.active = false;
		}
	}

	activate(){
		if(!this.active){
			this.active = true;
			if(!this.external){
				this.table.element.appendChild(this.getElement());
				this.table.element.style.display = '';
			}
		}
	}

	redraw(){
		this.dispatch("footer-redraw");
	}
}

class InteractionManager extends CoreFeature {
	
	constructor (table){
		super(table);
		
		this.el = null;
		
		this.abortClasses = ["tabulator-headers", "tabulator-table"];
		
		this.previousTargets = {};
		
		this.listeners = [
			"click",
			"dblclick",
			"contextmenu",
			"mouseenter",
			"mouseleave",
			"mouseover",
			"mouseout",
			"mousemove",
			"mouseup",
			"mousedown",
			"touchstart",
			"touchend",
		];
		
		this.componentMap = {
			"tabulator-cell":"cell",
			"tabulator-row":"row",
			"tabulator-group":"group",
			"tabulator-col":"column",
		};
		
		this.pseudoTrackers = {
			"row":{
				subscriber:null,
				target:null,
			},
			"cell":{
				subscriber:null,
				target:null,
			},
			"group":{
				subscriber:null,
				target:null,
			},
			"column":{
				subscriber:null,
				target:null,
			},
		};
		
		this.pseudoTracking = false;
	}
	
	initialize(){
		this.el = this.table.element;
		
		this.buildListenerMap();
		this.bindSubscriptionWatchers();
	}
	
	buildListenerMap(){
		var listenerMap = {};
		
		this.listeners.forEach((listener) => {
			listenerMap[listener] = {
				handler:null,
				components:[],
			};
		});
		
		this.listeners = listenerMap;
	}
	
	bindPseudoEvents(){
		Object.keys(this.pseudoTrackers).forEach((key) => {
			this.pseudoTrackers[key].subscriber = this.pseudoMouseEnter.bind(this, key);
			this.subscribe(key + "-mouseover", this.pseudoTrackers[key].subscriber);
		});
		
		this.pseudoTracking = true;
	}
	
	pseudoMouseEnter(key, e, target){
		if(this.pseudoTrackers[key].target !== target){
			
			if(this.pseudoTrackers[key].target){
				this.dispatch(key + "-mouseleave", e, this.pseudoTrackers[key].target);
			}
			
			this.pseudoMouseLeave(key, e);
			
			this.pseudoTrackers[key].target = target;
			
			this.dispatch(key + "-mouseenter", e, target);
		}
	}
	
	pseudoMouseLeave(key, e){
		var leaveList = Object.keys(this.pseudoTrackers),
		linkedKeys = {
			"row":["cell"],
			"cell":["row"],
		};
		
		leaveList = leaveList.filter((item) => {
			var links = linkedKeys[key];
			return item !== key && (!links || (links && !links.includes(item)));
		});
		
		
		leaveList.forEach((key) => {
			var target = this.pseudoTrackers[key].target;
			
			if(this.pseudoTrackers[key].target){
				this.dispatch(key + "-mouseleave", e, target);
				
				this.pseudoTrackers[key].target = null;
			}
		});
	}
	
	
	bindSubscriptionWatchers(){
		var listeners = Object.keys(this.listeners),
		components = Object.values(this.componentMap);
		
		for(let comp of components){
			for(let listener of listeners){
				let key = comp + "-" + listener;
				
				this.subscriptionChange(key, this.subscriptionChanged.bind(this, comp, listener));
			}
		}
		
		this.subscribe("table-destroy", this.clearWatchers.bind(this));
	}
	
	subscriptionChanged(component, key, added){
		var listener = this.listeners[key].components,
		index = listener.indexOf(component),
		changed = false;
		
		if(added){
			if(index === -1){
				listener.push(component);
				changed = true;
			}
		}else {
			if(!this.subscribed(component + "-" + key)){
				if(index > -1){
					listener.splice(index, 1);
					changed = true;
				}
			}
		}
		
		if((key === "mouseenter" || key === "mouseleave") && !this.pseudoTracking){
			this.bindPseudoEvents();
		}
		
		if(changed){
			this.updateEventListeners();
		}
	}
	
	updateEventListeners(){
		for(let key in this.listeners){
			let listener = this.listeners[key];
			
			if(listener.components.length){
				if(!listener.handler){
					listener.handler = this.track.bind(this, key);
					this.el.addEventListener(key, listener.handler);
					// this.el.addEventListener(key, listener.handler, {passive: true})
				}
			}else {
				if(listener.handler){
					this.el.removeEventListener(key, listener.handler);
					listener.handler = null;
				}
			}
		}
	}
	
	track(type, e){
		var path = (e.composedPath && e.composedPath()) || e.path;
		
		var targets = this.findTargets(path);
		targets = this.bindComponents(type, targets);
		
		this.triggerEvents(type, e, targets);
		
		if(this.pseudoTracking && (type == "mouseover" || type == "mouseleave") && !Object.keys(targets).length){
			this.pseudoMouseLeave("none", e);
		}
	}
	
	findTargets(path){
		var targets = {};
		
		let componentMap = Object.keys(this.componentMap);
		
		for (let el of path) {
			let classList = el.classList ? [...el.classList] : [];
			
			let abort = classList.filter((item) => {
				return this.abortClasses.includes(item);
			});
			
			if(abort.length){
				break;
			}
			
			let elTargets = classList.filter((item) => {
				return componentMap.includes(item);
			});
			
			for (let target of elTargets) {
				if(!targets[this.componentMap[target]]){
					targets[this.componentMap[target]] = el;
				}
			}
		}

		if(targets.group && targets.group === targets.row){
			delete targets.row;
		}

		return targets;
	}
	
	bindComponents(type, targets){
		//ensure row component is looked up before cell
		var keys = Object.keys(targets).reverse(),
		listener = this.listeners[type],
		matches = {},
		output = {},
		targetMatches = {};
	
		for(let key of keys){
			let component,
			target = targets[key],
			previousTarget = this.previousTargets[key];
			
			if(previousTarget && previousTarget.target === target){
				component = previousTarget.component;
			}else {
				switch(key){
					case "row":
					case "group":
						if(listener.components.includes("row") || listener.components.includes("cell") || listener.components.includes("group")){
							let rows = this.table.rowManager.getVisibleRows(true);
						
							component = rows.find((row) => {
								return row.getElement() === target;
							});
						
							if(targets["row"] && targets["row"].parentNode && targets["row"].parentNode.closest(".tabulator-row")){
								targets[key] = false;
							}
						}
						break;
					
					case "column":
						if(listener.components.includes("column")){
							component = this.table.columnManager.findColumn(target);
						}
						break;
					
					case "cell":
						if(listener.components.includes("cell")){
							if(matches["row"] instanceof Row){
								component = matches["row"].findCell(target);
							}else {	
								if(targets["row"]){
									console.warn("Event Target Lookup Error - The row this cell is attached to cannot be found, has the table been reinitialized without being destroyed first?");
								}
							}
						}
						break;
				}
			}
			
			if(component){
				matches[key] = component;
				targetMatches[key] = {
					target:target,
					component:component,
				};
			}
		}
		
		this.previousTargets = targetMatches;

		//reverse order keys are set in so events trigger in correct sequence
		Object.keys(targets).forEach((key) => {
			let value = matches[key];
			output[key] = value;
		});
		
		return output;
	}
	
	triggerEvents(type, e, targets){
		var listener = this.listeners[type];

		for(let key in targets){
			if(targets[key] && listener.components.includes(key)){
				this.dispatch(key + "-" + type, e, targets[key]);
			}
		}
	}
	
	clearWatchers(){
		for(let key in this.listeners){
			let listener = this.listeners[key];
			
			if(listener.handler){
				this.el.removeEventListener(key, listener.handler);
				listener.handler = null;
			}
		}
	}
}

class ComponentFunctionBinder{

	constructor(table){
		this.table = table;

		this.bindings = {};
	}

	bind(type, funcName, handler){
		if(!this.bindings[type]){
			this.bindings[type] = {};
		}

		if(this.bindings[type][funcName]){
			console.warn("Unable to bind component handler, a matching function name is already bound", type, funcName, handler);
		}else {
			this.bindings[type][funcName] = handler;
		}
	}

	handle(type, component, name){
		if(this.bindings[type] && this.bindings[type][name] && typeof this.bindings[type][name].bind === 'function'){
			return this.bindings[type][name].bind(null, component);
		}else {
			if(name !== "then" && typeof name === "string" && !name.startsWith("_")){
				if(this.table.options.debugInvalidComponentFuncs){
					console.error("The " + type + " component does not have a " + name + " function, have you checked that you have the correct Tabulator module installed?");
				}
			}
		}
	}
}

class DataLoader extends CoreFeature{
	constructor(table){
		super(table);
		
		this.requestOrder = 0; //prevent requests coming out of sequence if overridden by another load request
		this.loading = false;
	}
	
	initialize(){}
	
	load(data, params, config, replace, silent, columnsChanged){
		var requestNo = ++this.requestOrder;

		if(this.table.destroyed){
			return Promise.resolve();
		}
		
		this.dispatchExternal("dataLoading", data);
		
		//parse json data to array
		if (data && (data.indexOf("{") == 0 || data.indexOf("[") == 0)){
			data = JSON.parse(data);
		}
		
		if(this.confirm("data-loading", [data, params, config, silent])){
			this.loading = true;
			
			if(!silent){
				this.alertLoader();
			}
			
			//get params for request
			params = this.chain("data-params", [data, config, silent], params || {}, params || {});
			
			params = this.mapParams(params, this.table.options.dataSendParams);
			
			var result = this.chain("data-load", [data, params, config, silent], false, Promise.resolve([]));
			
			return result.then((response) => {
				if(!this.table.destroyed){
					if(!Array.isArray(response) && typeof response == "object"){
						response = this.mapParams(response, this.objectInvert(this.table.options.dataReceiveParams));
					}
					
					var rowData = this.chain("data-loaded", [response], null, response);
					
					if(requestNo == this.requestOrder){
						this.clearAlert();
						
						if(rowData !== false){
							this.dispatchExternal("dataLoaded", rowData);
							this.table.rowManager.setData(rowData,  replace, typeof columnsChanged === "undefined" ? !replace : columnsChanged);
						}
					}else {
						console.warn("Data Load Response Blocked - An active data load request was blocked by an attempt to change table data while the request was being made");
					}
				}else {
					console.warn("Data Load Response Blocked - Table has been destroyed");
				}
			}).catch((error) => {
				console.error("Data Load Error: ", error);
				this.dispatchExternal("dataLoadError", error);
				
				if(!silent){
					this.alertError();
				}
				
				setTimeout(() => {
					this.clearAlert();
				}, this.table.options.dataLoaderErrorTimeout);
			})
				.finally(() => {
					this.loading = false;
				});
		}else {
			this.dispatchExternal("dataLoaded", data);
			
			if(!data){
				data = [];
			}
			
			this.table.rowManager.setData(data, replace, typeof columnsChanged === "undefined" ? !replace : columnsChanged);
			return Promise.resolve();
		}
	}
	
	mapParams(params, map){
		var output = {};
		
		for(let key in params){
			output[map.hasOwnProperty(key) ? map[key] : key] = params[key];
		}
		
		return output;
	}
	
	objectInvert(obj){
		var output = {};
		
		for(let key in obj){
			output[obj[key]] = key;
		}
		
		return output;
	}
	
	blockActiveLoad(){
		this.requestOrder++;
	}
	
	alertLoader(){
		var shouldLoad = typeof this.table.options.dataLoader === "function" ? this.table.options.dataLoader() : this.table.options.dataLoader;
		
		if(shouldLoad){
			this.table.alertManager.alert(this.table.options.dataLoaderLoading || this.langText("data|loading"));
		}
	}
	
	alertError(){
		this.table.alertManager.alert(this.table.options.dataLoaderError || this.langText("data|error"), "error");
	}
	
	clearAlert(){
		this.table.alertManager.clear();
	}
}

class ExternalEventBus {

	constructor(table, optionsList, debug){
		this.table = table;
		this.events = {};
		this.optionsList = optionsList || {};
		this.subscriptionNotifiers = {};

		this.dispatch = debug ? this._debugDispatch.bind(this) : this._dispatch.bind(this);
		this.debug = debug;
	}

	subscriptionChange(key, callback){
		if(!this.subscriptionNotifiers[key]){
			this.subscriptionNotifiers[key] = [];
		}

		this.subscriptionNotifiers[key].push(callback);

		if(this.subscribed(key)){
			this._notifySubscriptionChange(key, true);
		}
	}

	subscribe(key, callback){
		if(!this.events[key]){
			this.events[key] = [];
		}

		this.events[key].push(callback);

		this._notifySubscriptionChange(key, true);
	}

	unsubscribe(key, callback){
		var index;

		if(this.events[key]){
			if(callback){
				index = this.events[key].findIndex((item) => {
					return item === callback;
				});

				if(index > -1){
					this.events[key].splice(index, 1);
				}else {
					console.warn("Cannot remove event, no matching event found:", key, callback);
					return;
				}
			}else {
				delete this.events[key];
			}
		}else {
			console.warn("Cannot remove event, no events set on:", key);
			return;
		}

		this._notifySubscriptionChange(key, false);
	}

	subscribed(key){
		return this.events[key] && this.events[key].length;
	}

	_notifySubscriptionChange(key, subscribed){
		var notifiers = this.subscriptionNotifiers[key];

		if(notifiers){
			notifiers.forEach((callback)=>{
				callback(subscribed);
			});
		}
	}

	_dispatch(){
		var args = Array.from(arguments),
		key = args.shift(),
		result;

		if(this.events[key]){
			this.events[key].forEach((callback, i) => {
				let callResult = callback.apply(this.table, args);

				if(!i){
					result = callResult;
				}
			});
		}

		return result;
	}

	_debugDispatch(){
		var args = Array.from(arguments),
		key = args[0];

		args[0] = "ExternalEvent:" + args[0];

		if(this.debug === true || this.debug.includes(key)){
			console.log(...args);
		}

		return this._dispatch(...arguments);
	}
}

class InternalEventBus {

	constructor(debug){
		this.events = {};
		this.subscriptionNotifiers = {};

		this.dispatch = debug ? this._debugDispatch.bind(this) : this._dispatch.bind(this);
		this.chain = debug ? this._debugChain.bind(this) : this._chain.bind(this);
		this.confirm = debug ? this._debugConfirm.bind(this) : this._confirm.bind(this);
		this.debug = debug;
	}

	subscriptionChange(key, callback){
		if(!this.subscriptionNotifiers[key]){
			this.subscriptionNotifiers[key] = [];
		}

		this.subscriptionNotifiers[key].push(callback);

		if(this.subscribed(key)){
			this._notifySubscriptionChange(key, true);
		}
	}

	subscribe(key, callback, priority = 10000){
		if(!this.events[key]){
			this.events[key] = [];
		}

		this.events[key].push({callback, priority});

		this.events[key].sort((a, b) => {
			return a.priority - b.priority;
		});

		this._notifySubscriptionChange(key, true);
	}

	unsubscribe(key, callback){
		var index;

		if(this.events[key]){
			if(callback){
				index = this.events[key].findIndex((item) => {
					return item.callback === callback;
				});

				if(index > -1){
					this.events[key].splice(index, 1);
				}else {
					console.warn("Cannot remove event, no matching event found:", key, callback);
					return;
				}
			}
		}else {
			console.warn("Cannot remove event, no events set on:", key);
			return;
		}

		this._notifySubscriptionChange(key, false);
	}

	subscribed(key){
		return this.events[key] && this.events[key].length;
	}

	_chain(key, args, initialValue, fallback){
		var value = initialValue;

		if(!Array.isArray(args)){
			args = [args];
		}

		if(this.subscribed(key)){
			this.events[key].forEach((subscriber, i) => {
				value = subscriber.callback.apply(this, args.concat([value]));
			});

			return value;
		}else {
			return typeof fallback === "function" ? fallback() : fallback;
		}
	}

	_confirm(key, args){
		var confirmed = false;

		if(!Array.isArray(args)){
			args = [args];
		}

		if(this.subscribed(key)){
			this.events[key].forEach((subscriber, i) => {
				if(subscriber.callback.apply(this, args)){
					confirmed = true;
				}
			});
		}

		return confirmed;
	}

	_notifySubscriptionChange(key, subscribed){
		var notifiers = this.subscriptionNotifiers[key];

		if(notifiers){
			notifiers.forEach((callback)=>{
				callback(subscribed);
			});
		}
	}

	_dispatch(){
		var args = Array.from(arguments),
		key = args.shift();

		if(this.events[key]){
			this.events[key].forEach((subscriber) => {
				subscriber.callback.apply(this, args);
			});
		}
	}

	_debugDispatch(){
		var args = Array.from(arguments),
		key = args[0];

		args[0] = "InternalEvent:" + key;

		if(this.debug === true || this.debug.includes(key)){
			console.log(...args);
		}

		return this._dispatch(...arguments);
	}

	_debugChain(){
		var args = Array.from(arguments),
		key = args[0];

		args[0] = "InternalEvent:" + key;

		if(this.debug === true || this.debug.includes(key)){
			console.log(...args);
		}

		return this._chain(...arguments);
	}

	_debugConfirm(){
		var args = Array.from(arguments),
		key = args[0];

		args[0] = "InternalEvent:" + key;

		if(this.debug === true || this.debug.includes(key)){
			console.log(...args);
		}

		return this._confirm(...arguments);
	}
}

class DeprecationAdvisor extends CoreFeature{
	
	constructor(table){
		super(table);
	}
	
	_warnUser(){
		if(this.options("debugDeprecation")){
			console.warn(...arguments);
		}
	}
	
	check(oldOption, newOption, convert){
		var msg = "";
		
		if(typeof this.options(oldOption) !== "undefined"){
			msg = "Deprecated Setup Option - Use of the %c" + oldOption + "%c option is now deprecated";
			
			if(newOption){
				msg = msg + ", Please use the %c" + newOption + "%c option instead";
				this._warnUser(msg, 'font-weight: bold;', 'font-weight: normal;', 'font-weight: bold;', 'font-weight: normal;');

				if(convert){
					this.table.options[newOption] = this.table.options[oldOption];
				}
			}else {
				this._warnUser(msg, 'font-weight: bold;', 'font-weight: normal;');
			}
			
			return false;
		}else {
			return true;
		}
	}
	
	checkMsg(oldOption, msg){
		if(typeof this.options(oldOption) !== "undefined"){
			this._warnUser("%cDeprecated Setup Option - Use of the %c" + oldOption + " %c option is now deprecated, " + msg, 'font-weight: normal;', 'font-weight: bold;', 'font-weight: normal;');
			
			return false;
		}else {
			return true;
		}
	}
	
	msg(msg){
		this._warnUser(msg);
	}
}

class DependencyRegistry extends CoreFeature{
	
	constructor(table){
		super(table);
		
		this.deps = {};
		
		this.props = {
			
		};
	}
	
	initialize(){
		this.deps = Object.assign({}, this.options("dependencies"));
	}
	
	lookup(key, prop, silent){
		if(Array.isArray(key)){
			for (const item of key) {
				var match = this.lookup(item, prop, true);

				if(match){
					break;
				}
			}

			if(match){
				return match;
			}else {
				this.error(key);
			}
		}else {
			if(prop){
				return this.lookupProp(key, prop, silent);
			}else {
				return this.lookupKey(key, silent);
			}
		}
	}
	
	lookupProp(key, prop, silent){
		var dependency;
		
		if(this.props[key] && this.props[key][prop]){
			return this.props[key][prop];
		}else {
			dependency = this.lookupKey(key, silent);
			
			if(dependency){
				if(!this.props[key]){
					this.props[key] = {};
				}
				
				this.props[key][prop] = dependency[prop] || dependency;
				return this.props[key][prop];
			}
		}
	}
	
	lookupKey(key, silent){
		var dependency;
		
		if(this.deps[key]){
			dependency = this.deps[key];
		}else if(window[key]){
			this.deps[key] = window[key];
			dependency = this.deps[key];
		}else {
			if(!silent){
				this.error(key);
			}
		}
		
		return dependency;
	}

	error(key){
		console.error("Unable to find dependency", key, "Please check documentation and ensure you have imported the required library into your project");
	}
}

//resize columns to fit data they contain
function fitData(columns, forced){
	if(forced){
		this.table.columnManager.renderer.reinitializeColumnWidths(columns);
	}
	
	if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
		this.table.modules.responsiveLayout.update();
	}
}

//resize columns to fit data they contain and stretch row to fill table, also used for fitDataTable
function fitDataGeneral(columns, forced){
	columns.forEach(function(column){
		column.reinitializeWidth();
	});

	if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
		this.table.modules.responsiveLayout.update();
	}
}

//resize columns to fit data the contain and stretch last column to fill table
function fitDataStretch(columns, forced){
	var colsWidth = 0,
	tableWidth = this.table.rowManager.element.clientWidth,
	gap = 0,
	lastCol = false;

	columns.forEach((column, i) => {
		if(!column.widthFixed){
			column.reinitializeWidth();
		}

		if(this.table.options.responsiveLayout ? column.modules.responsive.visible : column.visible){
			lastCol = column;
		}

		if(column.visible){
			colsWidth += column.getWidth();
		}
	});

	if(lastCol){
		gap = tableWidth - colsWidth + lastCol.getWidth();

		if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
			lastCol.setWidth(0);
			this.table.modules.responsiveLayout.update();
		}

		if(gap > 0){
			lastCol.setWidth(gap);
		}else {
			lastCol.reinitializeWidth();
		}
	}else {
		if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
			this.table.modules.responsiveLayout.update();
		}
	}
}

//resize columns to fit
function fitColumns(columns, forced){
	var totalWidth = this.table.rowManager.element.getBoundingClientRect().width; //table element width
	var fixedWidth = 0; //total width of columns with a defined width
	var flexWidth = 0; //total width available to flexible columns
	var flexGrowUnits = 0; //total number of widthGrow blocks across all columns
	var flexColWidth = 0; //desired width of flexible columns
	var flexColumns = []; //array of flexible width columns
	var fixedShrinkColumns = []; //array of fixed width columns that can shrink
	var flexShrinkUnits = 0; //total number of widthShrink blocks across all columns
	var overflowWidth = 0; //horizontal overflow width
	var gapFill = 0; //number of pixels to be added to final column to close and half pixel gaps

	function calcWidth(width){
		var colWidth;

		if(typeof(width) == "string"){
			if(width.indexOf("%") > -1){
				colWidth = (totalWidth / 100) * parseInt(width);
			}else {
				colWidth = parseInt(width);
			}
		}else {
			colWidth = width;
		}

		return colWidth;
	}

	//ensure columns resize to take up the correct amount of space
	function scaleColumns(columns, freeSpace, colWidth, shrinkCols){
		var oversizeCols = [],
		oversizeSpace = 0,
		remainingSpace = 0,
		nextColWidth = 0,
		remainingFlexGrowUnits = flexGrowUnits,
		gap = 0,
		changeUnits = 0,
		undersizeCols = [];

		function calcGrow(col){
			return (colWidth * (col.column.definition.widthGrow || 1));
		}

		function calcShrink(col){
			return  (calcWidth(col.width) - (colWidth * (col.column.definition.widthShrink || 0)));
		}

		columns.forEach(function(col, i){
			var width = shrinkCols ? calcShrink(col) : calcGrow(col);
			if(col.column.minWidth >= width){
				oversizeCols.push(col);
			}else {
				if(col.column.maxWidth && col.column.maxWidth < width){
					col.width = col.column.maxWidth;
					freeSpace -= col.column.maxWidth;

					remainingFlexGrowUnits -= shrinkCols ? (col.column.definition.widthShrink || 1) : (col.column.definition.widthGrow || 1);

					if(remainingFlexGrowUnits){
						colWidth = Math.floor(freeSpace/remainingFlexGrowUnits);
					}
				}else {
					undersizeCols.push(col);
					changeUnits += shrinkCols ? (col.column.definition.widthShrink || 1) : (col.column.definition.widthGrow || 1);
				}
			}
		});

		if(oversizeCols.length){
			oversizeCols.forEach(function(col){
				oversizeSpace += shrinkCols ?  col.width - col.column.minWidth : col.column.minWidth;
				col.width = col.column.minWidth;
			});

			remainingSpace = freeSpace - oversizeSpace;

			nextColWidth = changeUnits ? Math.floor(remainingSpace/changeUnits) : remainingSpace;

			gap = scaleColumns(undersizeCols, remainingSpace, nextColWidth, shrinkCols);
		}else {
			gap = changeUnits ? freeSpace - (Math.floor(freeSpace/changeUnits) * changeUnits) : freeSpace;

			undersizeCols.forEach(function(column){
				column.width = shrinkCols ? calcShrink(column) : calcGrow(column);
			});
		}

		return gap;
	}

	if(this.table.options.responsiveLayout && this.table.modExists("responsiveLayout", true)){
		this.table.modules.responsiveLayout.update();
	}

	//adjust for vertical scrollbar if present
	if(this.table.rowManager.element.scrollHeight > this.table.rowManager.element.clientHeight){
		totalWidth -= this.table.rowManager.element.offsetWidth - this.table.rowManager.element.clientWidth;
	}

	columns.forEach(function(column){
		var width, minWidth, colWidth;

		if(column.visible){

			width = column.definition.width;
			minWidth =  parseInt(column.minWidth);

			if(width){

				colWidth = calcWidth(width);

				fixedWidth += colWidth > minWidth ? colWidth : minWidth;

				if(column.definition.widthShrink){
					fixedShrinkColumns.push({
						column:column,
						width:colWidth > minWidth ? colWidth : minWidth
					});
					flexShrinkUnits += column.definition.widthShrink;
				}

			}else {
				flexColumns.push({
					column:column,
					width:0,
				});
				flexGrowUnits += column.definition.widthGrow || 1;
			}
		}
	});

	//calculate available space
	flexWidth = totalWidth - fixedWidth;

	//calculate correct column size
	flexColWidth = Math.floor(flexWidth / flexGrowUnits);

	//generate column widths
	gapFill = scaleColumns(flexColumns, flexWidth, flexColWidth, false);

	//increase width of last column to account for rounding errors
	if(flexColumns.length && gapFill > 0){
		flexColumns[flexColumns.length-1].width += gapFill;
	}

	//calculate space for columns to be shrunk into
	flexColumns.forEach(function(col){
		flexWidth -= col.width;
	});

	overflowWidth = Math.abs(gapFill) + flexWidth;

	//shrink oversize columns if there is no available space
	if(overflowWidth > 0 && flexShrinkUnits){
		gapFill = scaleColumns(fixedShrinkColumns, overflowWidth, Math.floor(overflowWidth / flexShrinkUnits), true);
	}

	//decrease width of last column to account for rounding errors
	if(gapFill && fixedShrinkColumns.length){
		fixedShrinkColumns[fixedShrinkColumns.length-1].width -= gapFill;
	}

	flexColumns.forEach(function(col){
		col.column.setWidth(col.width);
	});

	fixedShrinkColumns.forEach(function(col){
		col.column.setWidth(col.width);
	});
}

var defaultModes = {
	fitData:fitData,
	fitDataFill:fitDataGeneral,
	fitDataTable:fitDataGeneral,
	fitDataStretch:fitDataStretch,
	fitColumns:fitColumns ,
};

class Layout extends Module{

	static moduleName = "layout";

	//load defaults
	static modes = defaultModes;

	constructor(table){
		super(table, "layout");

		this.mode = null;

		this.registerTableOption("layout", "fitData"); //layout type
		this.registerTableOption("layoutColumnsOnNewData", false); //update column widths on setData

		this.registerColumnOption("widthGrow");
		this.registerColumnOption("widthShrink");
	}

	//initialize layout system
	initialize(){
		var layout = this.table.options.layout;

		if(Layout.modes[layout]){
			this.mode = layout;
		}else {
			console.warn("Layout Error - invalid mode set, defaulting to 'fitData' : " + layout);
			this.mode = 'fitData';
		}

		this.table.element.setAttribute("tabulator-layout", this.mode);
		this.subscribe("column-init", this.initializeColumn.bind(this));
	}

	initializeColumn(column){
		if(column.definition.widthGrow){
			column.definition.widthGrow = Number(column.definition.widthGrow);
		}
		if(column.definition.widthShrink){
			column.definition.widthShrink = Number(column.definition.widthShrink);
		}
	}

	getMode(){
		return this.mode;
	}

	//trigger table layout
	layout(dataChanged){

		var variableHeight = this.table.columnManager.columnsByIndex.find((column) => column.definition.variableHeight || column.definition.formatter === "textarea");
		
		this.dispatch("layout-refreshing");
		Layout.modes[this.mode].call(this, this.table.columnManager.columnsByIndex, dataChanged);

		if(variableHeight){
			this.table.rowManager.normalizeHeight(true);
		}

		this.dispatch("layout-refreshed");
	}
}

var defaultLangs = {
	"default": { //hold default locale text
		"groups": {
			"item": "item",
			"items": "items"
		},
		"columns": {},
		"data": {
			"loading": "Loading",
			"error": "Error"
		},
		"pagination": {
			"page_title": "Show Page",
			"first": "First",
			"first_title": "First Page",
			"last": "Last",
			"last_title": "Last Page",
			"prev": "Prev",
			"prev_title": "Prev Page",
			"next": "Next",
			"next_title": "Next Page",
			"all": "All",
			"counter": {
				"showing": "Showing",
				"of": "of",
				"rows": "rows",
				"pages": "pages"
			}
		},
		"headerFilters": {
			"default": "filter column...",
			"columns": {}
		}
	}
};

class Localize extends Module{

	static moduleName = "localize";

	//load defaults
	static langs = defaultLangs;

	constructor(table){
		super(table);

		this.locale = "default"; //current locale
		this.lang = false; //current language
		this.bindings = {}; //update events to call when locale is changed
		this.langList = {};

		this.registerTableOption("locale", false); //current system language
		this.registerTableOption("langs", {});
	}

	initialize(){
		this.langList = Helpers.deepClone(Localize.langs);

		if(this.table.options.columnDefaults.headerFilterPlaceholder !== false){
			this.setHeaderFilterPlaceholder(this.table.options.columnDefaults.headerFilterPlaceholder);
		}

		for(let locale in this.table.options.langs){
			this.installLang(locale, this.table.options.langs[locale]);
		}

		this.setLocale(this.table.options.locale);

		this.registerTableFunction("setLocale", this.setLocale.bind(this));
		this.registerTableFunction("getLocale", this.getLocale.bind(this));
		this.registerTableFunction("getLang", this.getLang.bind(this));
	}

	//set header placeholder
	setHeaderFilterPlaceholder(placeholder){
		this.langList.default.headerFilters.default = placeholder;
	}

	//setup a lang description object
	installLang(locale, lang){
		if(this.langList[locale]){
			this._setLangProp(this.langList[locale], lang);
		}else {
			this.langList[locale] = lang;
		}
	}

	_setLangProp(lang, values){
		for(let key in values){
			if(lang[key] && typeof lang[key] == "object"){
				this._setLangProp(lang[key], values[key]);
			}else {
				lang[key] = values[key];
			}
		}
	}

	//set current locale
	setLocale(desiredLocale){
		desiredLocale = desiredLocale || "default";

		//fill in any matching language values
		function traverseLang(trans, path){
			for(var prop in trans){
				if(typeof trans[prop] == "object"){
					if(!path[prop]){
						path[prop] = {};
					}
					traverseLang(trans[prop], path[prop]);
				}else {
					path[prop] = trans[prop];
				}
			}
		}

		//determining correct locale to load
		if(desiredLocale === true && navigator.language){
			//get local from system
			desiredLocale = navigator.language.toLowerCase();
		}

		if(desiredLocale){
			//if locale is not set, check for matching top level locale else use default
			if(!this.langList[desiredLocale]){
				let prefix = desiredLocale.split("-")[0];

				if(this.langList[prefix]){
					console.warn("Localization Error - Exact matching locale not found, using closest match: ", desiredLocale, prefix);
					desiredLocale = prefix;
				}else {
					console.warn("Localization Error - Matching locale not found, using default: ", desiredLocale);
					desiredLocale = "default";
				}
			}
		}

		this.locale = desiredLocale;

		//load default lang template
		this.lang = Helpers.deepClone(this.langList.default || {});

		if(desiredLocale != "default"){
			traverseLang(this.langList[desiredLocale], this.lang);
		}

		this.dispatchExternal("localized", this.locale, this.lang);

		this._executeBindings();
	}

	//get current locale
	getLocale(locale){
		return this.locale;
	}

	//get lang object for given local or current if none provided
	getLang(locale){
		return locale ? this.langList[locale] : this.lang;
	}

	//get text for current locale
	getText(path, value){
		var fillPath = value ? path + "|" + value : path,
		pathArray = fillPath.split("|"),
		text = this._getLangElement(pathArray, this.locale);

		// if(text === false){
		// 	console.warn("Localization Error - Matching localized text not found for given path: ", path);
		// }

		return text || "";
	}

	//traverse langs object and find localized copy
	_getLangElement(path, locale){
		var root = this.lang;

		path.forEach(function(level){
			var rootPath;

			if(root){
				rootPath = root[level];

				if(typeof rootPath != "undefined"){
					root = rootPath;
				}else {
					root = false;
				}
			}
		});

		return root;
	}

	//set update binding
	bind(path, callback){
		if(!this.bindings[path]){
			this.bindings[path] = [];
		}

		this.bindings[path].push(callback);

		callback(this.getText(path), this.lang);
	}

	//iterate through bindings and trigger updates
	_executeBindings(){
		for(let path in this.bindings){
			this.bindings[path].forEach((binding) => {
				binding(this.getText(path), this.lang);
			});
		}
	}
}

class Comms extends Module{

	static moduleName = "comms";

	constructor(table){
		super(table);
	}

	initialize(){
		this.registerTableFunction("tableComms", this.receive.bind(this));
	}

	getConnections(selectors){
		var connections = [],
		connection;

		connection = this.table.constructor.registry.lookupTable(selectors);

		connection.forEach((con) =>{
			if(this.table !== con){
				connections.push(con);
			}
		});

		return connections;
	}

	send(selectors, module, action, data){
		var connections = this.getConnections(selectors);

		connections.forEach((connection) => {
			connection.tableComms(this.table.element, module, action, data);
		});

		if(!connections.length && selectors){
			console.warn("Table Connection Error - No tables matching selector found", selectors);
		}
	}

	receive(table, module, action, data){
		if(this.table.modExists(module)){
			return this.table.modules[module].commsReceived(table, action, data);
		}else {
			console.warn("Inter-table Comms Error - no such module:", module);
		}
	}
}

var coreModules = /*#__PURE__*/Object.freeze({
	__proto__: null,
	CommsModule: Comms,
	LayoutModule: Layout,
	LocalizeModule: Localize
});

class TableRegistry {
	static registry = {
		tables:[],
		
		register(table){
			TableRegistry.registry.tables.push(table);
		},
		
		deregister(table){
			var index = TableRegistry.registry.tables.indexOf(table);
			
			if(index > -1){
				TableRegistry.registry.tables.splice(index, 1);
			}
		},
		
		lookupTable(query, silent){
			var results = [],
			matches, match;
			
			if(typeof query === "string"){
				matches = document.querySelectorAll(query);
				
				if(matches.length){
					for(var i = 0; i < matches.length; i++){
						match = TableRegistry.registry.matchElement(matches[i]);
						
						if(match){
							results.push(match);
						}
					}
				}
				
			}else if((typeof HTMLElement !== "undefined" && query instanceof HTMLElement) || query instanceof TableRegistry){
				match = TableRegistry.registry.matchElement(query);
				
				if(match){
					results.push(match);
				}
			}else if(Array.isArray(query)){
				query.forEach(function(item){
					results = results.concat(TableRegistry.registry.lookupTable(item));
				});
			}else {
				if(!silent){
					console.warn("Table Connection Error - Invalid Selector", query);
				}
			}
			
			return results;
		},
		
		matchElement(element){
			return TableRegistry.registry.tables.find(function(table){
				return element instanceof TableRegistry ? table === element : table.element === element;
			});
		}
	};

		
	static findTable(query){
		var results = TableRegistry.registry.lookupTable(query, true);
		return Array.isArray(results) && !results.length ? false : results;
	}
}

class ModuleBinder extends TableRegistry {
	
	static moduleBindings = {};
	static moduleExtensions = {};
	static modulesRegistered = false;
	
	static defaultModules = false;
	
	constructor(){
		super();
	}
	
	static initializeModuleBinder(defaultModules){
		if(!ModuleBinder.modulesRegistered){
			ModuleBinder.modulesRegistered = true;
			ModuleBinder._registerModules(coreModules, true);
			
			if(defaultModules){
				ModuleBinder._registerModules(defaultModules);
			}
		}
	}
	
	static _extendModule(name, property, values){
		if(ModuleBinder.moduleBindings[name]){
			var source = ModuleBinder.moduleBindings[name][property];
			
			if(source){
				if(typeof values == "object"){
					for(let key in values){
						source[key] = values[key];
					}
				}else {
					console.warn("Module Error - Invalid value type, it must be an object");
				}
			}else {
				console.warn("Module Error - property does not exist:", property);
			}
		}else {
			console.warn("Module Error - module does not exist:", name);
		}
	}
	
	static _registerModules(modules, core){
		var mods = Object.values(modules);
		
		if(core){
			mods.forEach((mod) => {
				mod.prototype.moduleCore = true;
			});
		}
		
		ModuleBinder._registerModule(mods);
	}
	
	static _registerModule(modules){
		if(!Array.isArray(modules)){
			modules = [modules];
		}
		
		modules.forEach((mod) => {
			ModuleBinder._registerModuleBinding(mod);
			ModuleBinder._registerModuleExtensions(mod);
		});
	}
	
	static _registerModuleBinding(mod){
		if(mod.moduleName){
			ModuleBinder.moduleBindings[mod.moduleName] = mod;
		}else {
			console.error("Unable to bind module, no moduleName defined", mod.moduleName);
		}
	}
	
	static _registerModuleExtensions(mod){
		var extensions = mod.moduleExtensions;
		
		if(mod.moduleExtensions){
			for (let modKey in extensions) {
				let ext = extensions[modKey];
				
				if(ModuleBinder.moduleBindings[modKey]){
					for (let propKey in ext) {
						ModuleBinder._extendModule(modKey, propKey, ext[propKey]);
					}
				}else {
					if(!ModuleBinder.moduleExtensions[modKey]){
						ModuleBinder.moduleExtensions[modKey] = {};
					}
					
					for (let propKey in ext) {
						if(!ModuleBinder.moduleExtensions[modKey][propKey]){
							ModuleBinder.moduleExtensions[modKey][propKey] = {};
						}

						Object.assign(ModuleBinder.moduleExtensions[modKey][propKey], ext[propKey]);
					}
				}
			}
		}

		ModuleBinder._extendModuleFromQueue(mod);
	}
	
	static _extendModuleFromQueue(mod){
		var extensions = ModuleBinder.moduleExtensions[mod.moduleName];
		
		if(extensions){
			for (let propKey in extensions) {
				ModuleBinder._extendModule(mod.moduleName, propKey, extensions[propKey]);
			}
		}
	}
	
	//ensure that module are bound to instantiated function
	_bindModules(){
		var orderedStartMods = [],
		orderedEndMods = [],
		unOrderedMods = [];
		
		this.modules = {};
		
		for(var name in ModuleBinder.moduleBindings){
			let mod = ModuleBinder.moduleBindings[name];
			let module = new mod(this);
			
			this.modules[name] = module;
			
			if(mod.prototype.moduleCore){
				this.modulesCore.push(module);
			}else {
				if(mod.moduleInitOrder){
					if(mod.moduleInitOrder < 0){
						orderedStartMods.push(module);
					}else {
						orderedEndMods.push(module);
					}
					
				}else {
					unOrderedMods.push(module);
				}
			}
		}
		
		orderedStartMods.sort((a, b) => a.moduleInitOrder > b.moduleInitOrder ? 1 : -1);
		orderedEndMods.sort((a, b) => a.moduleInitOrder > b.moduleInitOrder ? 1 : -1);
		
		this.modulesRegular = orderedStartMods.concat(unOrderedMods.concat(orderedEndMods));
	}
}

class Alert extends CoreFeature{
	constructor(table){
		super(table);
        
		this.element = this._createAlertElement();
		this.msgElement = this._createMsgElement();
		this.type = null;
        
		this.element.appendChild(this.msgElement);
	}
    
	_createAlertElement(){
		var el = document.createElement("div");
		el.classList.add("tabulator-alert");
		return el;
	}
    
	_createMsgElement(){
		var el = document.createElement("div");
		el.classList.add("tabulator-alert-msg");
		el.setAttribute("role", "alert");
		return el;
	}
    
	_typeClass(){
		return "tabulator-alert-state-" + this.type;
	}
    
	alert(content, type = "msg"){
		if(content){
			this.clear();

			this.dispatch("alert-show", type);
            
			this.type = type;
            
			while(this.msgElement.firstChild) this.msgElement.removeChild(this.msgElement.firstChild);
            
			this.msgElement.classList.add(this._typeClass());
            
			if(typeof content === "function"){
				content = content();
			}
            
			if(content instanceof HTMLElement){
				this.msgElement.appendChild(content);
			}else {
				this.msgElement.innerHTML = content;
			}
            
			this.table.element.appendChild(this.element);
		}
	}
    
	clear(){
		this.dispatch("alert-hide", this.type);

		if(this.element.parentNode){
			this.element.parentNode.removeChild(this.element);
		}
        
		this.msgElement.classList.remove(this._typeClass());
	}
}

class Tabulator extends ModuleBinder {

	//default setup options
	static defaultOptions = defaultOptions;

	static extendModule() {
		Tabulator.initializeModuleBinder();
		Tabulator._extendModule(...arguments);
	}

	static registerModule() {
		Tabulator.initializeModuleBinder();
		Tabulator._registerModule(...arguments);
	}

	constructor(element, options, modules) {
		super();

		Tabulator.initializeModuleBinder(modules);

		this.options = {};

		this.columnManager = null; // hold Column Manager
		this.rowManager = null; //hold Row Manager
		this.footerManager = null; //holder Footer Manager
		this.alertManager = null; //hold Alert Manager
		this.vdomHoz = null; //holder horizontal virtual dom
		this.externalEvents = null; //handle external event messaging
		this.eventBus = null; //handle internal event messaging
		this.interactionMonitor = false; //track user interaction
		this.browser = ""; //hold current browser type
		this.browserSlow = false; //handle reduced functionality for slower browsers
		this.browserMobile = false; //check if running on mobile, prevent resize cancelling edit on keyboard appearance
		this.rtl = false; //check if the table is in RTL mode
		this.originalElement = null; //hold original table element if it has been replaced

		this.componentFunctionBinder = new ComponentFunctionBinder(this); //bind component functions
		this.dataLoader = false; //bind component functions

		this.modules = {}; //hold all modules bound to this table
		this.modulesCore = []; //hold core modules bound to this table (for initialization purposes)
		this.modulesRegular = []; //hold regular modules bound to this table (for initialization purposes)

		this.deprecationAdvisor = new DeprecationAdvisor(this);
		this.optionsList = new OptionsList(this, "table constructor");

		this.dependencyRegistry = new DependencyRegistry(this);

		this.initialized = false;
		this.destroyed = false;

		if (this.initializeElement(element)) {

			this.initializeCoreSystems(options);

			//delay table creation to allow event bindings immediately after the constructor
			setTimeout(() => {
				this._create();
			});
		}

		this.constructor.registry.register(this); //register table for inter-device communication
	}

	initializeElement(element) {
		if (typeof HTMLElement !== "undefined" && element instanceof HTMLElement) {
			this.element = element;
			return true;
		} else if (typeof element === "string") {
			this.element = document.querySelector(element);

			if (this.element) {
				return true;
			} else {
				console.error("Tabulator Creation Error - no element found matching selector: ", element);
				return false;
			}
		} else {
			console.error("Tabulator Creation Error - Invalid element provided:", element);
			return false;
		}
	}

	initializeCoreSystems(options) {
		this.columnManager = new ColumnManager(this);
		this.rowManager = new RowManager(this);
		this.footerManager = new FooterManager(this);
		this.dataLoader = new DataLoader(this);
		this.alertManager = new Alert(this);

		this._bindModules();

		this.options = this.optionsList.generate(Tabulator.defaultOptions, options);

		this._clearObjectPointers();

		this._mapDeprecatedFunctionality();

		this.externalEvents = new ExternalEventBus(this, this.options, this.options.debugEventsExternal);
		this.eventBus = new InternalEventBus(this.options.debugEventsInternal);

		this.interactionMonitor = new InteractionManager(this);

		this.dataLoader.initialize();
		this.footerManager.initialize();

		this.dependencyRegistry.initialize();
	}

	//convert deprecated functionality to new functions
	_mapDeprecatedFunctionality() {
		//all previously deprecated functionality removed in the 6.0 release
	}

	_clearSelection() {

		this.element.classList.add("tabulator-block-select");

		if (window.getSelection) {
			if (window.getSelection().empty) {  // Chrome
				window.getSelection().empty();
			} else if (window.getSelection().removeAllRanges) {  // Firefox
				window.getSelection().removeAllRanges();
			}
		} else if (document.selection) {  // IE?
			document.selection.empty();
		}

		this.element.classList.remove("tabulator-block-select");
	}

	//create table
	_create() {
		this.externalEvents.dispatch("tableBuilding");
		this.eventBus.dispatch("table-building");

		this._rtlCheck();

		this._buildElement();

		this._initializeTable();

		this.initialized = true;

		this._loadInitialData()
			.finally(() => {
				this.eventBus.dispatch("table-initialized");
				this.externalEvents.dispatch("tableBuilt");
			});
	}

	_rtlCheck() {
		var style = window.getComputedStyle(this.element);

		switch (this.options.textDirection) {
			case"auto":
				if (style.direction !== "rtl") {
					break;
				}

			case "rtl":
				this.element.classList.add("tabulator-rtl");
				this.rtl = true;
				break;

			case "ltr":
				this.element.classList.add("tabulator-ltr");

			default:
				this.rtl = false;
		}
	}

	//clear pointers to objects in default config object
	_clearObjectPointers() {
		this.options.columns = this.options.columns.slice(0);

		if (Array.isArray(this.options.data) && !this.options.reactiveData) {
			this.options.data = this.options.data.slice(0);
		}
	}

	//build tabulator element
	_buildElement() {
		var element = this.element,
		options = this.options,
		newElement;

		if (element.tagName === "TABLE") {
			this.originalElement = this.element;
			newElement = document.createElement("div");

			//transfer attributes to new element
			var attributes = element.attributes;

			// loop through attributes and apply them on div
			for (var i in attributes) {
				if (typeof attributes[i] == "object") {
					newElement.setAttribute(attributes[i].name, attributes[i].value);
				}
			}

			// replace table with div element
			element.parentNode.replaceChild(newElement, element);

			this.element = element = newElement;
		}

		element.setAttribute("role", "grid");
		element.classList.add("tabulator");
		if (options.bordered) {
			element.classList.add("tabulator-bordered");
		}

		//empty element
		while (element.firstChild) element.removeChild(element.firstChild);

		//set table height
		if (options.height) {
			options.height = isNaN(options.height) ? options.height : options.height + "px";
			element.style.height = options.height;
		}

		//set table min height
		if (options.minHeight !== false) {
			options.minHeight = isNaN(options.minHeight) ? options.minHeight : options.minHeight + "px";
			element.style.minHeight = options.minHeight;
		}

		//set table maxHeight
		if (options.maxHeight !== false) {
			options.maxHeight = isNaN(options.maxHeight) ? options.maxHeight : options.maxHeight + "px";
			element.style.maxHeight = options.maxHeight;
		}
	}

	//initialize core systems and modules
	_initializeTable() {
		var element = this.element,
		options = this.options;

		this.interactionMonitor.initialize();

		this.columnManager.initialize();
		this.rowManager.initialize();

		this._detectBrowser();

		//initialize core modules
		this.modulesCore.forEach((mod) => {
			mod.initialize();
		});

		//build table elements
		element.appendChild(this.columnManager.getElement());
		element.appendChild(this.rowManager.getElement());

		if (options.footerElement) {
			this.footerManager.activate();
		}

		if (options.autoColumns && options.data) {

			this.columnManager.generateColumnsFromRowData(this.options.data);
		}

		//initialize regular modules
		this.modulesRegular.forEach((mod) => {
			mod.initialize();
		});

		this.columnManager.setColumns(options.columns);

		this.eventBus.dispatch("table-built");
	}

	_loadInitialData() {
		return this.dataLoader.load(this.options.data)
			.finally(() => {
				this.columnManager.verticalAlignHeaders();
			});
	}

	//deconstructor
	destroy() {
		var element = this.element;

		this.destroyed = true;

		this.constructor.registry.deregister(this); //deregister table from inter-device communication

		this.eventBus.dispatch("table-destroy");

		//clear row data
		this.rowManager.destroy();

		//clear DOM
		while (element.firstChild) element.removeChild(element.firstChild);
		element.classList.remove("tabulator");
		element.removeAttribute("tabulator-layout");

		this.externalEvents.dispatch("tableDestroyed");
	}

	_detectBrowser() {
		var ua = navigator.userAgent || navigator.vendor || window.opera;

		if (ua.indexOf("Trident") > -1) {
			this.browser = "ie";
			this.browserSlow = true;
		} else if (ua.indexOf("Edge") > -1) {
			this.browser = "edge";
			this.browserSlow = true;
		} else if (ua.indexOf("Firefox") > -1) {
			this.browser = "firefox";
			this.browserSlow = false;
		} else if (ua.indexOf("Mac OS") > -1) {
			this.browser = "safari";
			this.browserSlow = false;
		} else {
			this.browser = "other";
			this.browserSlow = false;
		}

		this.browserMobile = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(ua) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw-(n|u)|c55\/|capi|ccwa|cdm-|cell|chtm|cldc|cmd-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc-s|devi|dica|dmob|do(c|p)o|ds(12|-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(-|_)|g1 u|g560|gene|gf-5|g-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd-(m|p|t)|hei-|hi(pt|ta)|hp( i|ip)|hs-c|ht(c(-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i-(20|go|ma)|i230|iac( |-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|-[a-w])|libw|lynx|m1-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|-([1-8]|c))|phil|pire|pl(ay|uc)|pn-2|po(ck|rt|se)|prox|psio|pt-g|qa-a|qc(07|12|21|32|60|-[2-7]|i-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h-|oo|p-)|sdk\/|se(c(-|0|1)|47|mc|nd|ri)|sgh-|shar|sie(-|m)|sk-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h-|v-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl-|tdg-|tel(i|m)|tim-|t-mo|to(pl|sh)|ts(70|m-|m3|m5)|tx-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas-|your|zeto|zte-/i.test(ua.slice(0, 4));
	}

	initGuard(func, msg) {
		var stack, line;

		if (this.options.debugInitialization && !this.initialized) {
			if (!func) {
				stack = new Error().stack.split("\n");

				line = stack[0] == "Error" ? stack[2] : stack[1];

				if (line[0] == " ") {
					func = line.trim().split(" ")[1].split(".")[1];
				} else {
					func = line.trim().split("@")[0];
				}
			}

			console.warn("Table Not Initialized - Calling the " + func + " function before the table is initialized may result in inconsistent behavior, Please wait for the `tableBuilt` event before calling this function." + (msg ? " " + msg : ""));
		}

		return this.initialized;
	}

	////////////////// Data Handling //////////////////
	//block table redrawing
	blockRedraw() {
		this.initGuard();

		this.eventBus.dispatch("redraw-blocking");

		this.rowManager.blockRedraw();
		this.columnManager.blockRedraw();

		this.eventBus.dispatch("redraw-blocked");
	}

	//restore table redrawing
	restoreRedraw() {
		this.initGuard();

		this.eventBus.dispatch("redraw-restoring");

		this.rowManager.restoreRedraw();
		this.columnManager.restoreRedraw();

		this.eventBus.dispatch("redraw-restored");
	}

	//load data
	setData(data, params, config) {
		this.initGuard(false, "To set initial data please use the 'data' property in the table constructor.");

		return this.dataLoader.load(data, params, config, false);
	}

	//clear data
	clearData() {
		this.initGuard();

		this.dataLoader.blockActiveLoad();
		this.rowManager.clearData();
	}

	//get table data array
	getData(active) {
		return this.rowManager.getData(active);
	}

	//get table data array count
	getDataCount(active) {
		return this.rowManager.getDataCount(active);
	}

	//replace data, keeping table in position with same sort
	replaceData(data, params, config) {
		this.initGuard();

		return this.dataLoader.load(data, params, config, true, true);
	}

	//update table data
	updateData(data) {
		var responses = 0;

		this.initGuard();

		return new Promise((resolve, reject) => {
			this.dataLoader.blockActiveLoad();

			if (typeof data === "string") {
				data = JSON.parse(data);
			}

			if (data && data.length > 0) {
				data.forEach((item) => {
					var row = this.rowManager.findRow(item[this.options.index]);

					if (row) {
						responses++;

						row.updateData(item)
							.then(() => {
								responses--;

								if (!responses) {
									resolve();
								}
							})
							.catch((e) => {
								reject("Update Error - Unable to update row", item, e);
							});
					} else {
						reject("Update Error - Unable to find row", item);
					}
				});
			} else {
				console.warn("Update Error - No data provided");
				reject("Update Error - No data provided");
			}
		});
	}

	addData(data, pos, index) {
		this.initGuard();

		return new Promise((resolve, reject) => {
			this.dataLoader.blockActiveLoad();

			if (typeof data === "string") {
				data = JSON.parse(data);
			}

			if (data) {
				this.rowManager.addRows(data, pos, index)
					.then((rows) => {
						var output = [];

						rows.forEach(function(row) {
							output.push(row.getComponent());
						});

						resolve(output);
					});
			} else {
				console.warn("Update Error - No data provided");
				reject("Update Error - No data provided");
			}
		});
	}

	//update table data
	updateOrAddData(data) {
		var rows = [],
		responses = 0;

		this.initGuard();

		return new Promise((resolve, reject) => {
			this.dataLoader.blockActiveLoad();

			if (typeof data === "string") {
				data = JSON.parse(data);
			}

			if (data && data.length > 0) {
				data.forEach((item) => {
					var row = this.rowManager.findRow(item[this.options.index]);

					responses++;

					if (row) {
						row.updateData(item)
							.then(() => {
								responses--;
								rows.push(row.getComponent());

								if (!responses) {
									resolve(rows);
								}
							});
					} else {
						this.rowManager.addRows(item)
							.then((newRows) => {
								responses--;
								rows.push(newRows[0].getComponent());

								if (!responses) {
									resolve(rows);
								}
							});
					}
				});
			} else {
				console.warn("Update Error - No data provided");
				reject("Update Error - No data provided");
			}
		});
	}

	//get row object
	getRow(index) {
		var row = this.rowManager.findRow(index);

		if (row) {
			return row.getComponent();
		} else {
			console.warn("Find Error - No matching row found:", index);
			return false;
		}
	}

	//get row object
	getRowFromPosition(position) {
		var row = this.rowManager.getRowFromPosition(position);

		if (row) {
			return row.getComponent();
		} else {
			console.warn("Find Error - No matching row found:", position);
			return false;
		}
	}

	//delete row from table
	deleteRow(index) {
		var foundRows = [];

		this.initGuard();

		if (!Array.isArray(index)) {
			index = [index];
		}

		//find matching rows
		for (let item of index) {
			let row = this.rowManager.findRow(item, true);

			if (row) {
				foundRows.push(row);
			} else {
				console.error("Delete Error - No matching row found:", item);
				return Promise.reject("Delete Error - No matching row found");
			}
		}

		//sort rows into correct order to ensure smooth delete from table
		foundRows.sort((a, b) => {
			return this.rowManager.rows.indexOf(a) > this.rowManager.rows.indexOf(b) ? 1 : -1;
		});

		//delete rows
		foundRows.forEach((row) => {
			row.delete();
		});

		this.rowManager.reRenderInPosition();

		return Promise.resolve();
	}

	//add row to table
	addRow(data, pos, index) {
		this.initGuard();

		if (typeof data === "string") {
			data = JSON.parse(data);
		}

		return this.rowManager.addRows(data, pos, index, true)
			.then((rows) => {
				return rows[0].getComponent();
			});
	}

	//update a row if it exists otherwise create it
	updateOrAddRow(index, data) {
		var row = this.rowManager.findRow(index);

		this.initGuard();

		if (typeof data === "string") {
			data = JSON.parse(data);
		}

		if (row) {
			return row.updateData(data)
				.then(() => {
					return row.getComponent();
				});
		} else {
			return this.rowManager.addRows(data)
				.then((rows) => {
					return rows[0].getComponent();
				});
		}
	}

	//update row data
	updateRow(index, data) {
		var row = this.rowManager.findRow(index);

		this.initGuard();

		if (typeof data === "string") {
			data = JSON.parse(data);
		}

		if (row) {
			return row.updateData(data)
				.then(() => {
					return Promise.resolve(row.getComponent());
				});
		} else {
			console.warn("Update Error - No matching row found:", index);
			return Promise.reject("Update Error - No matching row found");
		}
	}

	//scroll to row in DOM
	scrollToRow(index, position, ifVisible) {
		var row = this.rowManager.findRow(index);

		if (row) {
			return this.rowManager.scrollToRow(row, position, ifVisible);
		} else {
			console.warn("Scroll Error - No matching row found:", index);
			return Promise.reject("Scroll Error - No matching row found");
		}
	}

	moveRow(from, to, after) {
		var fromRow = this.rowManager.findRow(from);

		this.initGuard();

		if (fromRow) {
			fromRow.moveToRow(to, after);
		} else {
			console.warn("Move Error - No matching row found:", from);
		}
	}

	getRows(active) {
		return this.rowManager.getComponents(active);
	}

	//get position of row in table
	getRowPosition(index) {
		var row = this.rowManager.findRow(index);

		if (row) {
			return row.getPosition();
		} else {
			console.warn("Position Error - No matching row found:", index);
			return false;
		}
	}

	/////////////// Column Functions  ///////////////
	setColumns(definition) {
		this.initGuard(false, "To set initial columns please use the 'columns' property in the table constructor");

		this.columnManager.setColumns(definition);
	}

	getColumns(structured) {
		return this.columnManager.getComponents(structured);
	}

	getColumn(field) {
		var column = this.columnManager.findColumn(field);

		if (column) {
			return column.getComponent();
		} else {
			console.warn("Find Error - No matching column found:", field);
			return false;
		}
	}

	getColumnDefinitions() {
		return this.columnManager.getDefinitionTree();
	}

	showColumn(field) {
		var column = this.columnManager.findColumn(field);

		this.initGuard();

		if (column) {
			column.show();
		} else {
			console.warn("Column Show Error - No matching column found:", field);
			return false;
		}
	}

	hideColumn(field) {
		var column = this.columnManager.findColumn(field);

		this.initGuard();

		if (column) {
			column.hide();
		} else {
			console.warn("Column Hide Error - No matching column found:", field);
			return false;
		}
	}

	toggleColumn(field) {
		var column = this.columnManager.findColumn(field);

		this.initGuard();

		if (column) {
			if (column.visible) {
				column.hide();
			} else {
				column.show();
			}
		} else {
			console.warn("Column Visibility Toggle Error - No matching column found:", field);
			return false;
		}
	}

	addColumn(definition, before, field) {
		var column = this.columnManager.findColumn(field);

		this.initGuard();

		return this.columnManager.addColumn(definition, before, column)
			.then((column) => {
				return column.getComponent();
			});
	}

	deleteColumn(field) {
		var column = this.columnManager.findColumn(field);

		this.initGuard();

		if (column) {
			return column.delete();
		} else {
			console.warn("Column Delete Error - No matching column found:", field);
			return Promise.reject();
		}
	}

	updateColumnDefinition(field, definition) {
		var column = this.columnManager.findColumn(field);

		this.initGuard();

		if (column) {
			return column.updateDefinition(definition);
		} else {
			console.warn("Column Update Error - No matching column found:", field);
			return Promise.reject();
		}
	}

	moveColumn(from, to, after) {
		var fromColumn = this.columnManager.findColumn(from),
		toColumn = this.columnManager.findColumn(to);

		this.initGuard();

		if (fromColumn) {
			if (toColumn) {
				this.columnManager.moveColumn(fromColumn, toColumn, after);
			} else {
				console.warn("Move Error - No matching column found:", toColumn);
			}
		} else {
			console.warn("Move Error - No matching column found:", from);
		}
	}

	//scroll to column in DOM
	scrollToColumn(field, position, ifVisible) {
		return new Promise((resolve, reject) => {
			var column = this.columnManager.findColumn(field);

			if (column) {
				return this.columnManager.scrollToColumn(column, position, ifVisible);
			} else {
				console.warn("Scroll Error - No matching column found:", field);
				return Promise.reject("Scroll Error - No matching column found");
			}
		});
	}

	//////////// General Public Functions ////////////
	//redraw list without updating data
	redraw(force) {
		this.initGuard();

		this.columnManager.redraw(force);
		this.rowManager.redraw(force);
	}

	setHeight(height) {
		this.options.height = isNaN(height) ? height : height + "px";
		this.element.style.height = this.options.height;
		this.rowManager.initializeRenderer();
		this.rowManager.redraw(true);
	}

	//////////////////// Event Bus ///////////////////

	on(key, callback) {
		this.externalEvents.subscribe(key, callback);
	}

	off(key, callback) {
		this.externalEvents.unsubscribe(key, callback);
	}

	dispatchEvent() {
		var args = Array.from(arguments);
		args.shift();

		this.externalEvents.dispatch(...arguments);
	}

	//////////////////// Alerts ///////////////////

	alert(contents, type) {
		this.initGuard();

		this.alertManager.alert(contents, type);
	}

	clearAlert() {
		this.initGuard();

		this.alertManager.clear();
	}

	////////////// Extension Management //////////////
	modExists(plugin, required) {
		if (this.modules[plugin]) {
			return true;
		} else {
			if (required) {
				console.error("Tabulator Module Not Installed: " + plugin);
			}
			return false;
		}
	}

	module(key) {
		var mod = this.modules[key];

		if (!mod) {
			console.error("Tabulator module not installed: " + key);
		}

		return mod;
	}
}

var Tabulator$1 = Tabulator;

//tabulator with all modules installed

class TabulatorFull extends Tabulator$1 {
	static extendModule(){
		Tabulator$1.initializeModuleBinder(allModules);
		Tabulator$1._extendModule(...arguments);
	}

	static registerModule(){
		Tabulator$1.initializeModuleBinder(allModules);
		Tabulator$1._registerModule(...arguments);
	}

	constructor(element, options, modules){
		super(element, options, allModules);
	}
}

var TabulatorFull$1 = TabulatorFull;

//public group object
class GroupComponent {
	constructor (group){
		this._group = group;
		this.type = "GroupComponent";

		return new Proxy(this, {
			get: function(target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				}else {
					return target._group.groupManager.table.componentFunctionBinder.handle("group", target._group, name);
				}
			}
		});
	}

	getKey(){
		return this._group.key;
	}

	getField(){
		return this._group.field;
	}

	getElement(){
		return this._group.element;
	}

	getRows(){
		return this._group.getRows(true);
	}

	getSubGroups(){
		return this._group.getSubGroups(true);
	}

	getParentGroup(){
		return this._group.parent ? this._group.parent.getComponent() : false;
	}

	isVisible(){
		return this._group.visible;
	}

	show(){
		this._group.show();
	}

	hide(){
		this._group.hide();
	}

	toggle(){
		this._group.toggleVisibility();
	}

	scrollTo(position, ifVisible){
		return this._group.groupManager.table.rowManager.scrollToRow(this._group, position, ifVisible);
	}

	_getSelf(){
		return this._group;
	}

	getTable(){
		return this._group.groupManager.table;
	}
}

class CalcComponent{
	constructor (row){
		this._row = row;

		return new Proxy(this, {
			get: function(target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				}else {
					return target._row.table.componentFunctionBinder.handle("row", target._row, name);
				}
			}
		});
	}

	getData(transform){
		return this._row.getData(transform);
	}

	getElement(){
		return this._row.getElement();
	}

	getTable(){
		return this._row.table;
	}

	getCells(){
		var cells = [];

		this._row.getCells().forEach(function(cell){
			cells.push(cell.getComponent());
		});

		return cells;
	}

	getCell(column){
		var cell = this._row.getCell(column);
		return cell ? cell.getComponent() : false;
	}

	_getSelf(){
		return this._row;
	}
}

class RangeComponent {
	constructor(range) {
		/** @type {import("./Range").default} */
		this._range = range;

		return new Proxy(this, {
			get: function (target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				} else {
					return target._range.table.componentFunctionBinder.handle("range", target._range, name);
				}
			},
		});
	}

	getElement() {
		return this._range.element;
	}

	getData() {
		return this._range.getData();
	}

	getCells() {
		return this._range.getCells(true, true);
	}

	getStructuredCells() {
		return this._range.getStructuredCells();
	}

	getRows() {
		return this._range.getRows().map((row) => row.getComponent());
	}

	getColumns() {
		return this._range.getColumns().map((column) => column.getComponent());
	}
	
	getBounds() {
		return this._range.getBounds();
	}

	getTopEdge() {
		return this._range.top;
	}

	getBottomEdge() {
		return this._range.bottom;
	}

	getLeftEdge() {
		return this._range.left;
	}

	getRightEdge() {
		return this._range.right;
	}

	setBounds(start, end){
		if(this._range.destroyedGuard("setBounds")){
			this._range.setBounds(start ? start._cell : start, end ? end._cell : end);
		}
	}

	setStartBound(start){
		if(this._range.destroyedGuard("setStartBound")){
			this._range.setEndBound(start ? start._cell : start);
			this._range.rangeManager.layoutElement();
		}
	}

	setEndBound(end){
		if(this._range.destroyedGuard("setEndBound")){
			this._range.setEndBound(end ? end._cell : end);
			this._range.rangeManager.layoutElement();
		}
	}

	clearValues(){
		if(this._range.destroyedGuard("clearValues")){
			this._range.clearValues();
		}
	}

	remove(){
		if(this._range.destroyedGuard("remove")){
			this._range.destroy(true);
		}
	}
}

class SheetComponent {
	constructor(sheet) {
		this._sheet = sheet;

		return new Proxy(this, {
			get: function (target, name, receiver) {
				if (typeof target[name] !== "undefined") {
					return target[name];
				} else {
					return target._sheet.table.componentFunctionBinder.handle("sheet", target._sheet, name);
				}
			},
		});
	}

	getTitle(){
		return this._sheet.title;
	}

	getKey(){
		return this._sheet.key;
	}

	getDefinition(){
		return this._sheet.getDefinition();
	}

	getData() {
		return this._sheet.getData();
	}

	setData(data) {
		return this._sheet.setData(data);
	}

	clear(){
		return this._sheet.clear();
	}

	remove(){
		return this._sheet.remove();
	}
	
	active(){
		return this._sheet.active();
	}

	setTitle(title){
		return this._sheet.setTitle(title);
	}

	setRows(rows){
		return this._sheet.setRows(rows);
	}

	setColumns(columns){
		return this._sheet.setColumns(columns);
	}
}

class PseudoRow {

	constructor (type){
		this.type = type;
		this.element = this._createElement();
	}

	_createElement(){
		var el = document.createElement("div");
		el.classList.add("tabulator-row");
		return el;
	}

	getElement(){
		return this.element;
	}

	getComponent(){
		return false;
	}

	getData(){
		return {};
	}

	getHeight(){
		return this.element.outerHeight;
	}

	initialize(){}

	reinitialize(){}

	normalizeHeight(){}

	generateCells(){}

	reinitializeHeight(){}

	calcHeight(){}

	setCellHeight(){}

	clearCellHeight(){}

	rendered(){}
}

export { Ajax as AjaxModule, CalcComponent, CellComponent, ColumnComponent, Format as FormatModule, FrozenColumns as FrozenColumnsModule, FrozenRows as FrozenRowsModule, GroupComponent, Module, MoveColumns as MoveColumnsModule, MoveRows as MoveRowsModule, Page as PageModule, PseudoRow, RangeComponent, Renderer, ResizeColumns as ResizeColumnsModule, RowComponent, SelectRow as SelectRowModule, SheetComponent, Sort as SortModule, Tabulator$1 as Tabulator, TabulatorFull$1 as TabulatorFull };
//# sourceMappingURL=tabulator_esm.js.map
