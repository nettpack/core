"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _main = require("../../../../vendor/arkten-bundles/core/main");

Object.keys(_main).forEach(function (key) {
  if (key === "default" || key === "__esModule") return;
  Object.defineProperty(exports, key, {
    enumerable: true,
    get: function get() {
      return _main[key];
    }
  });
});