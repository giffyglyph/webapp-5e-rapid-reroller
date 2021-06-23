/*global Handlebars, console, $, _*/

var Reroller = Reroller || {

	options: {},
	tables: {},
	templates: {},
	queries: 0,

	/**
	 * Initialize the object and load the data.
	 * @param {string} options.url.tables - Url of the tables folder.
	 * @param {string} options.url.templates - Url of the templates folder.
	 * @param {string} options.el.select - ID of the input select.
	 * @param {string} options.el.button - ID of the input button.
	 * @param {string} options.el.log - ID of the output log.
	 */
	initialize: function (options) {
		Reroller.options = options;
		$.when(
			Reroller.loadTables(Reroller.options.url.tables),
			Reroller.loadTemplates(Reroller.options.url.templates)
		).then(function () {
			console.log("OIAJWD");
			_.each(Reroller.getListOfTables(), function (path) {
				$(Reroller.options.el.select).append("<option value='" + path + "'>" + path.replace(/\./g, ', ') + "</option>");
			});
			$(Reroller.options.el.button).click(function () {
				Reroller.triggerReroll();
			});
			$(Reroller.options.el.select).change(function () {
				Reroller.triggerReroll();
			});

			console.debug("Loaded %s templates", _.allKeys(Reroller.templates).length, Reroller.templates);
			console.debug("Loaded %s tables", _.allKeys(Reroller.tables).length, Reroller.tables);
		});
	},

	/**
	 * Generate a new reroll value when the button is clicked or the field is changed.
	 */
	triggerReroll: function () {
		// Get selected tablename and send analytics event
		var selected = $(Reroller.options.el.select).val();
		if (Reroller.options.onRoll) {
			Reroller.options.onRoll(selected);
		}

		// Generate entry and add to the viewable log
		var table = Reroller.getTable(selected);
		var entry = Reroller.getRandomEntryFromTable(table);
		Reroller.addEntryToLog(
			table["_template"],
			Reroller.getQuerySequence(),
			selected.replace(/\./g, ', '),
			entry
		);
	},

	/**
	 * Increment the query counter and return it.
	 * @returns {int} The current query count.
	 */
	getQuerySequence: function () {
		Reroller.queries++;
		return Reroller.queries - 1;
	},

	/**
	 * Load all templates from the templates folder.
	 * @param {string} url - Url of the templates folder.
	 * @returns {Deferred} Async state, resolved when all templates are loaded.
	 */
	loadTemplates: function (url) {
		var asyncStatus = $.Deferred();
		$.get(url, function (data) {
			var promises = [];
			_.each($(data).find("a[href*=hbs]"), function (file) {
				promises.push(Reroller.loadTemplate(url, $(file).attr("href")));
			});
			$.when.apply($, promises).then(function () {
				asyncStatus.resolve();
			});
		});
		return asyncStatus.promise();
	},

	/**
	 * Load all tables from the table folder.
	 * @param {string} url - Url of the table folder.
	 * @returns {Deferred} Async state, resolved when all tables are loaded.
	 */
	loadTables: function (url) {
		var asyncStatus = $.Deferred();
		$.get(url, function (data) {
			var promises = [];
			_.each($(data).find("a[href*=json]"), function (file) {
				promises.push(Reroller.loadTable(url, $(file).attr("href")));
			});
			$.when.apply($, promises).then(function () {
				asyncStatus.resolve();
			});
		});
		return asyncStatus.promise();
	},

	/**
	 * Load a template from a specific url/filename pair.
	 * @param {string} url - Url of the file.
	 * @param {string} filename - Filename.
	 * @returns {Deferred} Async state, resolved when template is loaded.
	 */
	loadTemplate: function (url, filename) {
		var asyncStatus = $.Deferred();
		$.when(
			$.get(url + filename, function (template) {
				Reroller.templates[filename.replace(".hbs", "")] = Handlebars.compile(template);
			})
		).then(function () {
			asyncStatus.resolve();
		}).catch(function () {
			asyncStatus.resolve();
		});
		return asyncStatus.promise();
	},

	/**
	 * Load a table from a specific url/filename pair.
	 * @param {string} url - Url of the file.
	 * @param {string} filename - Filename.
	 * @returns {Deferred} Async state, resolved when table is loaded.
	 */
	loadTable: function (url, filename) {
		var asyncStatus = $.Deferred();
		$.when(
			$.get(url + filename, function (tables) {
				tables = _.mapObject(tables, function (table, key) {
					return Reroller.parseTable(filename.replace(".json", "").replace(/_/g, "."), key, table);
				});
				Reroller.addTable(tables);
			})
		).then(function () {
			asyncStatus.resolve();
		}).catch(function () {
			asyncStatus.resolve();
		});
		return asyncStatus.promise();
	},

	/**
	 * Parse a table object and set expected values.
	 * @param {string} path - Path to this table from root file.
	 * @param {string} key - The table name.
	 * @param {Object} table - Table object to be parsed.
	 * @returns {Object} Parsed table.
	 */
	parseTable: function (path, key, table) {
		table["_id"] = _.has(table, "_id") ? table["_id"] : path + "." + key;
		table["_rows"] = _.has(table, "_rows") ? table["_rows"] : [];
		table["_visible"] = _.has(table, "_visible") ? table["_visible"] : false;
		table["_template"] = _.has(table, "_template") ? table["_template"] : "";

		// Set row min/max range values
		let min = 1;
		_.each(table["_rows"], function (row, i) {
			row["_id"] = _.has(row, "_id") ? row["_id"] : i;
			if (_.has(row, "_range")) {
				let range_tokens = row["_range"].split("-");
				switch (range_tokens.length) {
					case 1:
						min = parseInt(range_tokens[0]);
						row["_min"] = min;
						row["_max"] = min;
						break;
					case 2:
						row["_min"] = parseInt(range_tokens[0]);
						row["_max"] = parseInt(range_tokens[1]);
						min = row["_max"];
						break;
				}
				delete row["_range"];
			} else {
				row["_min"] = min;
				row["_max"] = min;
			}
			min++;
		});

		// Set table min/max range values
		table["_min"] = 1;
		table["_max"] = min - 1;

		// Parse all child tables
		let keys = Reroller.getKeys(table);
		_.each(keys, function (key) {
			table[key] = Reroller.parseTable(table["_id"], key, table[key]);
		});
		return table;
	},

	/**
	 * Add a table and its children to the root table map.
	 * @param {Object} table - Table to be added.
	 */
	addTable: function (table) {
		if (_.has(table, "_id")) {
			Reroller.tables[table["_id"]] = table;
			console.debug("Added table [%s]", table["_id"]);
		}

		// Add all child tables
		let keys = Reroller.getKeys(table);
		_.each(keys, function (key) {
			Reroller.addTable(_.clone(table[key]));
			delete table[key];
		});
	},

	/**
	 * Get all non-data-attribute keys from a table object.
	 * @param {Object} table - Initial table.
	 * @returns {string[]} List of non-data-attribute keys.
	 */
	getKeys: function (table) {
		return _.without(_.allKeys(table), "_id", "_rows", "_visible", "_min", "_max", "_template");
	},

	/**
	 * Get a sorted path list of all loaded, visible tables.
	 * @returns {string[]} List of table paths.
	 */
	getListOfTables: function () {
		let tables = [];
		_.each(Reroller.getKeys(Reroller.tables), function (key) {
			let table = Reroller.getTable(key);
			if (_.isObject(table) && _.has(table, "_rows") && table["_visible"]) {
				tables.push(key);
			}
		});
		return tables.sort();
	},

	/**
	 * Get a table from the tablestore, throw an error if it doesn't exist.
	 * @param {string} id - The unique id of the table.
	 * @returns {Object} The requested table.
	 */
	getTable: function (id) {
		if (_.has(Reroller.tables, id)) {
			return Reroller.tables[id];
		} else {
			console.error("Table [%s] does not exist", id);
		}
	},

	/**
	 * Get a random row from a table.
	 * @param {Object} table - A table containing a collection of rows.
	 * @returns {Object} A copy of a random table row.
	 */
	getRandomRowFromTable: function (table) {
		let random = _.random(table["_min"], table["_max"]);
		let rows = _.filter(table["_rows"], function (row) {
			return row["_min"] <= random && row["_max"] >= random;
		});
		return _.clone(rows[0]);
	},

	/**
	 * Get a specific row from a table, based on row id.
	 * @param {Object} table - A table containing a collection of rows.
	 * @param {string} rowId - The unique row id.
	 * @returns {Object} A copy of a specific table row.
	 */
	getRowFromTable: function (table, rowId) {
		let rows = _.filter(table["_rows"], function (row) {
			return row["_id"] == rowId;
		});
		return _.clone(rows[0]);
	},

	/**
	 * Process a math query, defined as any query within braces (ie "{2+3}").
	 * @param {Object} row - A row with strings to parse.
	 */
	processRowMathQueries: function (row) {
		let targetRow = _.clone(row);
		_.each(Reroller.getKeys(targetRow), function (key) {
			if (_.isArray(targetRow[key])) {
				targetRow[key] = _.map(targetRow[key], function(item) {
					return Reroller.processRowMathQueries({"value": item})["value"];
				});
			} else if (_.isObject(targetRow[key])) {
				targetRow[key] = Reroller.processRowMathQueries(targetRow[key]);
			} else {
				let tokens = String(targetRow[key]).match(new RegExp("\\{[\\s\\S]+?\\}", "g"));
				_.each(tokens, function (token) {
					let formula = token;
					let variables = formula.match(new RegExp("#\\w+", "g"));
					_.each(variables, function (variable) {
						if (_.has(targetRow, variable.substring(1))) {
							formula = formula.replace(variable, targetRow[variable.substring(1)]);
						} else {
							console.warn("Variable [%s] not yet defined in [%s]", variable, targetRow[key]);
						}
					});
					let value = Parser.parse(formula.replace(new RegExp("\\w+:|{|}", "gm"), '')).evaluate();
					targetRow[key] = targetRow[key].replace(token, value);
				});
			}
		});
		return targetRow;
	},

	/**
	 * Process a nested query, defined as any query within square brackets (ie "[/gems]").
	 * @param {Object} table - The target table.
	 * @param {Object} row - A row with strings to parse.
	 */
	processRowNestedQueries: function (table, row) {
		let targetRow = _.clone(row);
		_.each(Reroller.getKeys(targetRow), function (key) {
			if (_.isArray(targetRow[key])) {
				targetRow[key] = _.map(targetRow[key], function(item) {
					return Reroller.processRowNestedQueries(table, {"value": item})["value"];
				});
			} else if (_.isObject(targetRow[key])) {
				targetRow[key] = Reroller.processRowNestedQueries(table, targetRow[key]);
			} else {
				let tokens = String(targetRow[key]).match(new RegExp("\\[[\\s\\S]+?\\]", "g"));
				_.each(tokens, function (token) {
					// Get basic nested query details
					let count = Math.max(new Number(token.match(new RegExp("[0-9]+?(?=\\*)"))), 0);
					let tableId = token.match(new RegExp("[\\w\\.\\/]+?(?=[\\(\\],])"));
					if (tableId) {
						// Update any relative links with the full path
						tableId = tableId[0].replace("/", table["_id"] + ".");
					}
					let rowId = token.match(new RegExp("(\\()([\\w]+?)(\\))"));
					if (rowId) {
						rowId = rowId[2];
					}
					let parameter = token.match(new RegExp("(,)([\\w]+)"))
					if (parameter) {
						parameter = parameter[2];
					}

					if (count >= 1) {
						let table = Reroller.getTable(tableId);
						let results = [];
						for (let i = 0; i < count; i++) {
							let result = Reroller.getRandomEntryFromTable(table, rowId, parameter);

							// Check for duplicates
							let indexOf = -1;
							_.each(results, function (item, i) {
								if (JSON.stringify(_.omit(item, "quantity")) == JSON.stringify(result)) {
									indexOf = i;
								}
							});

							// Update quantity counter if result is a duplicate
							if (indexOf == -1) {
								results.push(result);
							} else {
								if (results[indexOf]["quantity"]) {
									results[indexOf]["quantity"] += 1;
								} else {
									results[indexOf]["quantity"] = 2;
								}
							}
						}
						targetRow[key] = results;
					} else if (parameter) {
						targetRow[key] = targetRow[key].replace(token, Reroller.getRandomEntryFromTable(Reroller.getTable(tableId), rowId, parameter));
					} else {
						targetRow[key] = Reroller.getRandomEntryFromTable(Reroller.getTable(tableId), rowId, parameter);
					}
				});
			}
		});
		return targetRow;
	},

	/**
	 * Generate a random value from a table.
	 * @param {Object} table - The target table.
	 * @param {string} rowId - A specific row id (optional).
	 * @param {string} parameter - A specific row parameter (optional).
	 * @returns {Object} Either an object of values, or a single string if a parameter is requested.
	 */
	getRandomEntryFromTable: function (table, rowId, parameter) {
		let row = rowId ? Reroller.getRowFromTable(table, rowId) : Reroller.getRandomRowFromTable(table);
		row = Reroller.processRowMathQueries(row);
		row = Reroller.processRowNestedQueries(table, row);

		// Format return string
		if (parameter) {
			return row[parameter];
		} else {
			let output = {};
			_.each(Reroller.getKeys(row), function (key) {
				// Only copy populated properties
				if (row[key] != "") {
					output[key] = row[key];
				}
			});
			return output;
		}
	},

	/**
	 * Default rendering for a template-less query.
	 * @param {Object} entry - A list of key/value pairs. May be nested.
	 * @returns {string} A rendered string.
	 */
	renderEntry: function (entry) {
		if (_.allKeys(entry).length > 0) {
			let render = "<ul class='list-unstyled'>";
			let keys = _.allKeys(entry);
			_.each(keys, function (key, i) {
				let comma = i == keys.length - 1 ? "" : ",";
				let name = _.isArray(entry) ? "" : "<span class='key'>" + key + ": </span><span class='value'>";
				if (_.isArray(entry[key])) {
					render += "<li class='array'>" + name + "<span class='value array'>[" + Reroller.renderEntry(entry[key]) + "]" + comma + "</span></li>";
				} else if (_.isObject(entry[key])) {
					if (_.allKeys(entry[key]).length > 0) {
						render += "<li class='object'>" + name + "<span class='value object'>{" + Reroller.renderEntry(entry[key]) + "}" + comma + "</span></li>";
					} else {
						if (render.slice(-13) == ",</span></li>") {
							render = render.slice(0, -13) + "</span></li>";
						}
					}
				} else {
					render += "<li class='param'>" + name + "<span class='value'>" + entry[key] + comma + "</span></li>";
				}
			});
			render += "</ul>";
			return render;
		} else {
			return "";
		}
	},

	/**
	 * Renders and adds a query to the visible log.
	 * @param {string} template - Id of a handlebars template (optional)
	 * @param {Object} entry - The query results to render
	 */
	addEntryToLog: function (template, queryCount, title, entry) {
		let contents = (template == "") ? Reroller.renderEntry(entry) : Reroller.templates[template](_.extend(entry, {"_logId": queryCount}));
		let html = $("<div id='log-" + queryCount + "' class='log card " + ((template == "") ? "" : "template") + "'><button class='close' aria-hidden='true' onclick='deleteLog(" + queryCount + ")'><i class='fa fa-times' aria-hidden='true'></i></button><h4 class='card-header'>#" + queryCount + ": " + title + "</h4><div class='card-block'>" + contents + "</div></div>");

		html.hide().prependTo($(Reroller.options.el.log)).slideDown();
		if ($("body").scrollTop() > 0) {
			$("body").animate({ scrollTop: 0 }, "fast");
		}
	}
};
