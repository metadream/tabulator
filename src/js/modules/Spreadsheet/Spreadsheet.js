import Module from '../../core/Module.js';
import Sheet from "./Sheet";

export default class Spreadsheet extends Module{
	
	static moduleName = "spreadsheet";
	
	constructor(table){
		super(table);
		
		this.sheets = [];
		
		this.registerTableOption("spreadsheet", false); 
		this.registerTableOption("spreadsheetRows", 50); 
		this.registerTableOption("spreadsheetColumns", 50); 
		this.registerTableOption("spreadsheetDefinition", {}); 
	}
	
	
	initialize(){
		if(this.options("spreadsheet")){
			console.log("Woop! Spreadsheets");
			
			this.subscribe("table-initialized", this.tableInitialized.bind(this));
			
			this.table.options.index = "_id";
		}
	}
	
	tableInitialized(){
		var def = {};
		
		if(this.sheets.length){
			this.loadSheet(this.sheets[0]);
		}else{
			
			if(this.options("spreadsheetData")){
				def.data = this.options("spreadsheetData");
			}
			
			this.loadSheet(this.newSheet(def));
		}
	}
	
	loadSheet(sheet){
		this.activeSheet = sheet;
		sheet.load();
	}
	
	newSheet(definition = {}){
		var sheet;
		
		if(!definition.rows){
			definition.rows = this.options("spreadsheetRows");
		}
		
		if(!definition.columns){
			definition.columns = this.options("spreadsheetColumns");
		}
		
		sheet = new Sheet(this, definition);
		
		this.sheets.push(sheet);
		
		return sheet;
	}
	
	
}