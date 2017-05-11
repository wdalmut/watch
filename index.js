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

  this.options = Object.assign({}, {excludes: [], recursive: true, followLinks: false, every: 500}, options);
  this.filesystem = [];
  this.events = [];
  this.eventWatcherId = null;
  this.watcher = null;
};

util.inherits(Watch, EventEmitter);

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

var isSubFolder = function(path) {
  return function(item) {
    if (item.fullpath.indexOf(path) >= 0) {
      return false;
    }
    return true;
  };
};

Watch.prototype._watchFromQueue = function() {
  var that = this;

  var events = this.events;
  this.events = [];

  this.eventWatcherId = clearTimeout(this.eventWatcherId);

  var operations = {};

  for (var index in events) {
    var event = events[index];

    var file = that.filesystem.find(byName(event.filename));
    var fileStat = (file) ? file.stat: null;
    var fileExists = fs.existsSync(event.filename);

    if (!fileStat && fileExists) {
      fileStat = fs.statSync(event.filename);
      // devo cercarlo per ino se c'è è una move
      file = that.filesystem.find(byInode(fileStat.ino));

      if (file) {
        // file move
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
    } else if (!fileStat && !fileExists) {
      // non è presente ne su disco ne in memoria
      operations[Math.random()+"-"+Math.random()] = {
        eventType: "delete",
        filename: event.filename,
        stat: null,
      };
    }
  }

  for (var ino in operations) {
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
        // aggiorno il suo filename
        that.filesystem.find(byInode(op.stat.ino)).fullpath = op.filename;

        // cambia tutte le folder dei file sotto questo
        that.filesystem = that.filesystem.map((item) => {
          if (item.fullpath.indexOf(op.original + path.sep) >= 0) { // look for the same folder
            item.fullpath = item.fullpath.replace(op.original, op.filename); // path change
          }
          return item;
        });
        break;
      case "delete":
        that.filesystem = that.filesystem.filter((item) => (item.fullpath == op.filename) ? false : true);
        that.filesystem = that.filesystem.filter(isSubFolder(op.filename + path.sep));
        break;
      case "change":
        break;
    }

    that.emit(op.eventType, op);
  }

  that.eventWatcherId = setTimeout(that._watchFromQueue.bind(that), that.options.every);
};

Watch.prototype.watch = function(watchPath) {

  var that = this;
  var walker = walk.walk(watchPath, {followLinks: this.options.followLinks});

  walker.on('directory', function(root, stat, next) {
    that.filesystem.push({
      id: stat.ino,
      fullpath: path.join(root, stat.name),
      stat: stat,
    });
    next();
  });

  walker.on('file', function(root, stat, next) {
    that.filesystem.push({
      id: stat.ino,
      fullpath: path.join(root, stat.name),
      stat: stat,
    });
    next();
  });

  walker.on('end', function() {
    that.eventWatcherId = setTimeout(that._watchFromQueue.bind(that), that.options.every);

    var mustExclude = function(filename) {
      return function(regex) {
        return regex.test(filename);
      };
    };

    that.watcher = fs.watch(watchPath, {recursive: that.options.recursive}, function(eventType, filename) {
      // filename non presente (null)
      if (!filename) {
        return;
      }

      that.emit("fs.watch.raw", {eventType: eventType, filename: path.join(watchPath, filename)});
      if (!that.options.excludes.map(mustExclude(path.join(watchPath, filename))).reduce((memo,item) => memo || item, false)) {
        that.emit("fs.watch.valid", {eventType: eventType, filename: filename});
        // stop check timeout (restart later)
        that.eventWatcherId = clearTimeout(that.eventWatcherId);

        that.events.push({
          type: eventType,
          filename: path.join(watchPath, filename),
          on: new Date().getTime(),
        });

        // start check timeout
        that.eventWatcherId = setTimeout(that._watchFromQueue.bind(that), that.options.every);
      }
    });

    that.emit("start", watchPath);
  });

  return this;
};

Watch.prototype.close = function() {
  if (this.watcher) {
    this.watcher.close();
  }

  if (this.eventWatcherId) {
    this.eventWatcherId = clearTimeout(this.eventWatcherId);
  }

};

module.exports = Watch;
