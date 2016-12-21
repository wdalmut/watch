var fs           = require('fs'),
    util         = require('util'),
    walk         = require('walk'),
    fs           = require('fs'),
    path         = require('path'),
    EventEmitter = require('events').EventEmitter;

var Watch = function(options) {
  if (!options) {
    options = {};
  }

  if (!(this instanceof Watch)) {
    return new Watch(options);
  }

  this.options = Object.assign({}, {exclude: [], recursive: true, followLinks: false, every: 20000}, options);
  this.filesystem = [];
  this.events = [];
  this.eventWatcherId = null;
  this.watcher = null;
};

util.inherits(Watch, EventEmitter);

Watch.prototype._watchFromQueue = function() {
  var operations = {};

  var byName = function(filename) {
    return function(item) {
      return item.fullpath == filename;
    };
  };
  var byInode = function(ino) {
    return function(item) {
      return (item.id == ino);
    };
  };

  var that = this;
  this.events.forEach(function(event) {
    var file = that.filesystem.find(byName(event.filename));
    var fileStat = (file) ? file.stat: null;
    var fileExists = fs.existsSync(event.filename);
    if (!fileStat && fileExists) {
      fileStat = fs.statSync(event.filename);
      // devo cercarlo per ino se c'è è una move
      file = that.filesystem.find(byInode(fileStat.ino));

      if (file) {
        // file nuovo
        operations[fileStat.ino] = {
          eventType: "move",
          filename: event.filename,
          original: file.fullpath,
          stat: fileStat,
        };
      } else {
        // file nuovo
        fileStat = fs.statSync(event.filename);
        operations[fileStat.ino] = {
          eventType: "create",
          filename: event.filename,
          stat: fileStat,
        };
      }
    } else if (fileStat && !fileExists) {
      operations[fileStat.ino] = {
        eventType: "delete",
        filename: event.filename,
        stat: fileStat,
      };
    } else if (fileStat && fileExists) {
      // se non è già stata inserita
      if (!operations.hasOwnProperty(fileStat.ino)) {
        operations[fileStat.ino] = {
          eventType: "change",
          filename: event.filename,
          stat: fileStat,
        };
      }
    }
  });
  this.events = [];

  Object.keys(operations).forEach(function(ino) {
    var op = operations[ino];

    switch (op.eventType) {
      case "create":
        that.filesystem.push({
          id: op.stat.ino,
          fullpath: op.filename,
          stat: op.stat,
        });
        break;
      case "move":
        that.filesystem.find(byInode(op.stat.ino)).fullpath = op.filename;
        break;
      case "delete":
        that.filesystem.splice(that.filesystem.find(byInode(op.stat.ino), 1));
        break;
      case "change":
        that.filesystem.find(byInode(op.stat.ino)).stat = op.stat;
        break;
    }

    that.emit(op.eventType, op);
  });

  that.operations = {};
};

Watch.prototype.watch = function(watchPath) {

  var that = this;
  var walker = walk.walk(watchPath, {followLinks: this.options.followLinks});

  walker.on('file', function(root, stat, next) {
    that.filesystem = that.filesystem.concat([{
      id: stat.ino,
      fullpath: path.join(root, stat.name),
      stat: stat,
    }]);
    next();
  });

  walker.on('end', function() {
    that.eventWatcherId = setInterval(that._watchFromQueue.bind(that), that.options.every);

    that.watcher = fs.watch(watchPath, {recursive: that.options.recursive}, function(eventType, filename) {
      that.events.push({
        type: eventType,
        filename: path.join(watchPath, filename),
        on: new Date().getTime(),
      });
    });

    that.emit("start", watchPath);
  });

  return this;
};

Watch.prototype.close = function() {
  if (this.eventWatcherId) {
    clearInterval(this.eventWatcherId);
  }

  if (this.watcher) {
    this.watcher.close();
  }
};

module.exports = Watch;
