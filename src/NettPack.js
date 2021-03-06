import WebpackConfig from "./WebpackConfig";
import Config from "./Config";
import Neon from "neon-js";
import path from "path";
import fs from "fs";
import _ from "lodash";

export class NettPack {

	constructor(configFile){
		this.config = {...Config};
		if (configFile && fs.existsSync(configFile)) {
			let content = fs.readFileSync(configFile, 'utf8');
			let config = Neon.decode(content).toObject(true);
			if (config.parameters !== undefined && config.parameters.nettpack !== undefined) {
				this.config = this._deepMarge(this.config, config.parameters.nettpack);
			}
		}
		this.modules = {};
		this.appDir = path.dirname(require.main.filename);
	}

	/**
	 * @param {string} name
	 * @param {{}} module
	 */
	addAppModule(name, module){
		this.modules[name] = module
	}

	/**
	 * @return {number}
	 */
	getAppPort() {
		return this.config.port;
	}

	/**
	 * @return {{}}
	 */
	buildModules(){
		const packages = this.loadComposerAssets();

		/** INSTALL MODULE (admin, front.....) */
		let modules = {};
		let resolves = {};
		for (let name in this.modules) {
			let module = this.modules[name];

			let baseWebpack = {};
			if ( typeof WebpackConfig === "function") {
				baseWebpack = WebpackConfig(name, this.config, this);
			} else {
				baseWebpack = {... WebpackConfig};
			}

			this._applyResolve(packages, baseWebpack);
			this._applyEntry(packages, baseWebpack);
			this._applyModule(packages, baseWebpack, name);
			resolves = this._deepMarge(resolves, baseWebpack.resolve);

			let moduleConfig = {};
			if ( typeof module === "function") {
				moduleConfig = module(name, this.config, this);
			} else {
				moduleConfig = {... module};
			}
			modules[name] = this._deepMarge(baseWebpack, moduleConfig);
		}

		return {
			modules: modules,
			resolves: resolves
		};
	}

	_applyEntry(packages, webPackConfig) {
		const vendorPath = this._getPath(this.appDir, this.config.vendorPath);
		for (let i in packages) {
			const packageSettings = packages[i].settings;
			const packageName = packages[i].name;
			if (!packageSettings.entry) {
				continue;
			}

			if (!webPackConfig.entry) {
				webPackConfig.entry = {}
			}

			for (let entryName in packageSettings.entry) {
				const entryPath = packageSettings.entry[entryName];
				webPackConfig.entry[entryName] = this._getPath(vendorPath + "/" + packageName , entryPath);
			}
		}
	}

	_applyResolve(packages, webPackConfig) {
		const vendorPath = this._getPath(this.appDir, this.config.vendorPath);
		for (let i in packages) {
			const packageSettings = packages[i].settings;
			const packageName = packages[i].name;
			if (!packageSettings.resolve) {
				continue;
			}

			if (!webPackConfig.resolve) {
				webPackConfig.resolve = {}
			}

			for (let resolveName in packageSettings.resolve) {
				const resolvePath = packageSettings.resolve[resolveName];
				webPackConfig.resolve.alias[resolveName] = this._getPath(vendorPath + "/" + packageName , resolvePath);
			}
		}
	}

	_applyModule(packages, webPackConfig, moduleName) {
		const vendorPath = this._getPath(this.appDir, this.config.vendorPath);
		for (let i in packages) {
			const packageSettings = packages[i].settings;
			const packageName = packages[i].name;
			if (!packageSettings.modules) {
				continue;
			}

			for (let moduleIndex in packageSettings.modules) {
				if (moduleIndex === moduleName) {
					if (!webPackConfig.entry.packages || !webPackConfig.entry.packages.isArray()){
						webPackConfig.entry.packages = [];
						if (this.mode === "development") {
							webPackConfig.entry.packages.push(this._getHotEntry(moduleName));
						}
					}

					let entries = packageSettings.modules[moduleIndex];
					if (Array.isArray(entries)) {
						for (let index in entries) {
							let entry = entries[index];
							entry = this._getPath(vendorPath + "/" + packageName , entry);
							webPackConfig.entry.packages.push(entry)
						}
						continue;
					}

					let entry = packageSettings.modules[moduleIndex];
					entry = this._getPath(vendorPath + "/" + packageName , entry);
					webPackConfig.entry.packages.push(entry)
				}
			}
		}
	}

	/**
	 * @param {string} name
	 * @return {string}
	 * @private
	 */
	_getHotEntry(name) {
		return "webpack-hot-middleware/client?path=" + this.config.host+ this.config.publicPath + "/" + name + "/__webpack_hmr&timeout=" + this.config.webpackHmr;
	}

	/**
	 * @return {Array}
	 */
	loadComposerAssets() {
		const lockFile = this.config.composerLockFile;
		let content = fs.readFileSync(lockFile, 'utf8');
		content = JSON.parse(content);
		let packages = [];

		for (let i in content.packages) {
			let pack = content.packages[i];

			if (pack.extra && pack.extra.nettpack && pack.extra.nettpack) {
				const nettpackConfig = pack.extra.nettpack;
				packages.push({
					name: pack.name,
					settings: nettpackConfig,
				})
			}
		}

		return packages;
	}

	/**
	 * @param object
	 * @param other
	 * @private
	 */
	_deepMarge(object, other) {
		return _.mergeWith(object, other, function customizer(objValue, srcValue) {
			if (_.isArray(objValue)) {
				return objValue.concat(srcValue);
			}
		});
	}

	/**
	 * @param {string} prefix
	 * @param {string} path
	 * @return {string}
	 * @private
	 */
	_getPath(prefix, path) {
		if (path.substr(0, 1) === ".") {
			return prefix + path.substr(1);
		}
		return path;
	}

}
