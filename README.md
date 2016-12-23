# FS Watch

A simple project that watch filesystem changes using inodes and paths.

```js
var w = require('inode-watch');

w({every: 500})
  .on("start", console.log)
  .on("create", (op) => console.log("create", op))
  .on("move", (op) => console.log("move", op))
  .on("delete", (op) => console.log("delete", op))
  .on("change", (op) => console.log("change", op))
  .watch(__dirname)
;
```

The library scan the whole filesystem in order to create a map of current inodes
used on the disk at a given path. Those inodes are used to understand the kind
of event that is fired (create/update/move/delete)

 * `create` - a file is created
 * `move` - a file is moved
 * `delete` - a file is deleted
 * `change` - a file is changed

The library start watching the filesystem after the `start` event

## Excludes

You can exclude different paths and files (or extensions) using regular
expressions

```js
w({every: 500, excludes: [/\.exe$/,/\.bat$/,/\.com$/]})
  .on("start", console.log)
  .on("create", (op) => console.log("create", op))
  .on("move", (op) => console.log("move", op))
  .on("delete", (op) => console.log("delete", op))
  .on("change", (op) => console.log("change", op))
  .watch(__dirname)
;
```

## Why

Seems that all other projects looks for changes but not detect the **move
operation** (that is often identified as: delete then create).

## Notice

This project is actually a proof of concept about move identification and is
under development and not stable at all.
