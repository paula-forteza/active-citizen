// https://gist.github.com/mojodna/1251812

var log = require('../utils/logger');
var sendOneEmail = require('../engine/notifications/emails_utils').sendOneEmail;

var EmailWorker = function () {};

EmailWorker.prototype.sendOne = function (emailLocals, callback) {
  log.info("EmailWorker Started 1", {});
  sendOneEmail(emailLocals, callback);
};

module.exports = new EmailWorker();
