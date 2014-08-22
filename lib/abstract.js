var assert = require('assert');
var url = require('url');
var request = require('request');
var utils = require('./util');
var CouchError = require('./error');
var types = require('./constants/types');
var methods = require('./constants/methods');

var MAX_STACK_SIZE = 32;
var stack = [];

// user keeps track of current authenticated user
// by server key, cookie tracks cookie headers by server key and user
var auth = {
  user: {},
  cookie: {}
};

var AbstractCouch = function(options) {
  this.options = options || {};
  this.options.parser = this.options.parser || JSON.parse;
  this.auth = auth;
}

AbstractCouch.prototype.url = utils.url.join;
AbstractCouch.prototype.getServerKey = utils.url.key;

AbstractCouch.prototype.deserialize = function(body) {
  var doc = null;
  try{
    doc = this.options.parser(body);
  }catch(e) {
    return e;
  }
  return doc;
}


AbstractCouch.prototype.wrap = function(err, res) {
  var status = res && res.statusCode ? res.statusCode : 500;
  var e = new Error(err.message);
  e.stack = err.stack;
  e.status = status;
  if(err.code) e.code = err.code;
  return e;
}

AbstractCouch.prototype.ok = function(res) {
  return res && res.statusCode >= 200 && res.statusCode < 300;
}

AbstractCouch.prototype.getRequestBody = function(body) {
  if(typeof body !== 'string') {
    return JSON.stringify(body);
  }
  return body;
}

AbstractCouch.prototype.onResponse = function(
  err, res, body, cb, req, opts, item) {
  var ok = !err && res && this.ok(res);
  var json = (res && res.headers['content-type'] === types.json)
    && req.method !== methods.head;
  var doc = json ? this.deserialize(body) : body;
  if(doc instanceof Error) {
    err = doc;
  }
  if(!ok) {
    if(res) {
      err = new CouchError(doc, res);
    }else{
      err = this.wrap(err, res);
    }
  }
  item.err = err;
  item.res = res;
  item.doc = doc;
  item.ok = ok;
  if(ok) {
    cb(null, res, doc);
  }else{
    cb(item.err, res, doc);
  }
}

AbstractCouch.prototype.peek = function() {
  if(stack && stack.length) {
    return stack[stack.length - 1];
  }
  return null;
}

AbstractCouch.prototype.request = function(req, opts, cb, skip) {
  // store database requests so that
  // a request may be repeated after authentication
  var item = {req: req, opts: opts, cb: cb};
  if(!skip && !opts.retries) {
    stack.push(item);
    if(stack.length > MAX_STACK_SIZE) {
      stack.shift();
    }
  }
  var scope = this;
  req.qs = opts.qs;
  //console.log('[%s] url %s', req.method || 'GET', req.url);
  var key = this.getServerKey(req.url);
  var user = this.auth.user[key];
  //console.log('key %s', key);
  //console.log('user %s', user);
  if((req.headers && !req.headers.cookie)
    && user && this.auth.cookie[key][user]) {
    req.headers.cookie = this.auth.cookie[key][user];
  }
  var conn = request(req, function(err, res, body) {
    scope.onResponse(err, res, body, cb, req, opts, item);
  })
  return conn;
}

/**
 *  Repeat the last database request.
 *
 *  @param cb Replace the stashed callback function (optional).
 */
AbstractCouch.prototype.repeat = function(cb) {
  var last = stack.pop();
  if(last) {
    var opts = last.opts;
    cb = cb || last.cb;
    opts.retries = opts.retries || 0;
    opts.retries++;
    return this.request(last.req, opts, cb);
  }
  throw new Error('no request available to repeat');
}


AbstractCouch.prototype.merge = function(opts, cb) {
  if(typeof opts === 'function') {
    cb = opts;
    opts = null;
  }
  var res = {};
  opts = opts || {};
  //console.log('cdb got opts %j', opts);
  for(var z in opts) {res[z] = opts[z]};
  res.server = res.server || this.options.server;
  //console.log('cdb got server %s', res.server);
  assert(typeof(res.server) === 'string',
    'server option is required for database requests')
  res.cb = cb;
  return res;
}

module.exports = AbstractCouch;
