var watch = require('../');

describe("watch", function() {
  it("should be configurable", function() {
    var w = watch({});
    expect(w instanceof watch).toBe(true);
  });

  it("should emit the start signal", function(done) {
    watch().on("start", function() {
      this.close();
      done();
    }).watch(__dirname + "/fixtures/a");
  });

  describe("create events", function() {
    beforeEach(function() {
      require('child_process').execSync("rm -rf "+__dirname+"/fixtures/b/*");
    });

    it("should emit the create signal", function(done) {
      watch({every: 200}).on("create", function(file) {
        expect(file.filename).toEqual(__dirname + "/fixtures/b/test.txt");
        this.close();
        done();
      }).on("change", fail).on("delete", fail).on("move", fail).on("start", function() {
        var a = require('child_process').execSync("touch "+__dirname+"/fixtures/b/test.txt");
      }).watch(__dirname + "/fixtures/b");
    });
  });

  describe("move events", function() {
    beforeEach(function() {
      require('child_process').execSync("rm -rf "+__dirname+"/fixtures/b/*");
      require('child_process').execSync("touch "+__dirname+"/fixtures/b/orig.txt");
    });

    it("should emit the move signal", function(done) {
      watch({every: 200}).on("create", function(file) {
        fail();
      }).on("move", function(file) {
        expect(file.filename).toEqual(__dirname + "/fixtures/b/test.txt");
        expect(file.original).toEqual(__dirname + "/fixtures/b/orig.txt");
        this.close();
        done();
      }).on("change", fail).on("delete", fail).on("create", fail).on("start", function() {
        var a = require('child_process').execSync("mv "+__dirname+"/fixtures/b/orig.txt "+__dirname+"/fixtures/b/test.txt");
      }).watch(__dirname + "/fixtures/b");
    });
  });

  describe("delete events", function() {
    beforeEach(function() {
      require('child_process').execSync("rm -rf "+__dirname+"/fixtures/b/*");
      require('child_process').execSync("touch "+__dirname+"/fixtures/b/test.txt");
    });

    it("should emit the move signal", function(done) {
      watch({every: 200}).on("create", function(file) {
        fail();
      }).on("delete", function(file) {
        expect(file.filename).toEqual(__dirname + "/fixtures/b/test.txt");
        this.close();
        done();
      }).on("change", fail).on("move", fail).on("create", fail).on("start", function() {
        var a = require('child_process').execSync("rm -f "+__dirname+"/fixtures/b/test.txt "+__dirname+"/fixtures/b/test.txt");
      }).watch(__dirname + "/fixtures/b");
    });
  });

  describe("change events", function() {
    beforeEach(function() {
      require('child_process').execSync("rm -rf "+__dirname+"/fixtures/b/*");
      require('child_process').execSync("touch "+__dirname+"/fixtures/b/test.txt");
    });

    it("should emit the change signal", function(done) {
      watch({every: 200}).on("create", function(file) {
        fail();
      }).on("change", function(file) {
        expect(file.filename).toEqual(__dirname + "/fixtures/b/test.txt");
        this.close();
        done();
      }).on("delete", fail).on("move", fail).on("create", fail).on("start", function() {
        var a = require('child_process').execSync("echo w > "+__dirname+"/fixtures/b/test.txt");
      }).watch(__dirname + "/fixtures/b");
    });
  });

  describe("excludes", () => {
    beforeEach(function() {
      require('child_process').execSync("rm -rf "+__dirname+"/fixtures/b/*");
      require('child_process').execSync("touch "+__dirname+"/fixtures/b/test.txt");
    });

    it("should emit a signal on missing excludes", function(done) {
      watch({every: 200, excludes: [/\.exe$/]}).on("create", function(file) {
        fail();
      }).on("change", function(file) {
        expect(file.filename).toEqual(__dirname + "/fixtures/b/test.txt");
        this.close();
        done();
      }).on("delete", fail).on("move", fail).on("create", fail).on("start", function() {
        var a = require('child_process').execSync("echo w > "+__dirname+"/fixtures/b/test.txt "+__dirname+"/fixtures/b/test.txt");
      }).watch(__dirname + "/fixtures/b");
    });


    it("should skip and EXE file", function(done) {
      watch({every: 200, excludes: [/\.exe$/]})
        .on("delete", fail)
        .on("move", fail)
        .on("create", fail)
        .on("change", fail)
        .on("start", function() {
          var a = require('child_process').execSync("echo w > "+__dirname+"/fixtures/b/test.exe");
          setTimeout(done, 350);
        }).watch(__dirname + "/fixtures/b");

    });
  });
});
