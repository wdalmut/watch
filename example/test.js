var w = require('../');

w({every: 2500})
  .on("start", console.log)
  .on("create", (op) => console.log("create", op))
  .on("move", (op) => console.log("move", op))
  .on("delete", (op) => console.log("delete", op))
  .on("change", (op) => console.log("change", op))
  .watch(__dirname)
;
