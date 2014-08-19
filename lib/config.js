var util = require('util');

var AbstractCouch = require('./abstract');
var types = require('./constants/types');
var methods = require('./constants/methods');
var keys = require('./constants/parameters');

var Config = function(options) {
  AbstractCouch.apply(this, arguments);
}

util.inherits(Config, AbstractCouch);

/**
 *  Get a configuration object.
 */
Config.prototype.get = function(opts, cb) {
  opts = this.merge(opts, cb);
  var parts = [opts.server, keys.config];
  if(opts.section) parts.push(opts.section);
  if(opts.key) parts.push(opts.key);
  var u = this.url(parts);
  var req = {url: u, headers: {Accept: types.json}};
  this.request(req, opts, opts.cb);
}

/**
 *  Set a configuration value.
 */
Config.prototype.set = function(opts, cb) {
  opts = this.merge(opts, cb);
  var parts = [opts.server, keys.config];
  if(opts.section) parts.push(opts.section);
  if(opts.key) parts.push(opts.key);
  var u = this.url(parts);
  var req = {
    url: u,
    headers: {Accept: types.json, 'Content-Type': types.json},
    method: methods.put,
    body: JSON.stringify(opts.value)};
  this.request(req, opts, opts.cb);
}

/**
 *  Remove a configuration key.
 */
Config.prototype.rm = function(opts, cb) {
  opts = this.merge(opts, cb);
  var parts = [opts.server, keys.config];
  if(opts.section) parts.push(opts.section);
  if(opts.key) parts.push(opts.key);
  var u = this.url(parts);
  var req = {url: u, headers: {Accept: types.json}, method: methods.delete};
  this.request(req, opts, opts.cb);
}

module.exports = Config;
