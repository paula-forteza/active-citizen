var email = require('./email');
var activity = require('./activity');
var notification_delivery = require('./notification_delivery');
var notification_news_feed = require('./notification_news_feed');
var queue = require('./queue');

queue.process('send-one-email', 20, function(job, done) {
  email.sendOne(job.data, done);
});

queue.process('process-activity', 20, function(job, done) {
  activity.process(job.data, done);
});

queue.process('process-notification-delivery', 20, function(job, done) {
  notification_delivery.process(job.data, done);
});

queue.process('process-notification-news-feed', 20, function(job, done) {
  notification_news_feed.process(job.data, done);
});
