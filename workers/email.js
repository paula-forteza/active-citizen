// https://gist.github.com/mojodna/1251812

var EmailWorker = function () {};

var log = require('../utils/logger');
var sendOneEmail = require('../engine/emails_utils').sendOneEmail;

EmailWorker.prototype.sendOne = function (emailLocals, callback) {
  log.info("EmailWorker Started 1", {});
  sendOneEmail(emailLocals, callback);
};

module.exports = new EmailWorker();
