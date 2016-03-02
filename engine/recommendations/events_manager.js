var predictionio = require('predictionio-driver');
var models = rquire('../../../models');

var getClient = function (appId) {
  var client = new predictionio.Events({appId: 1, accessKey: process.env["PIO_ACCESS_KEY"],
                                        url: process.env["PIO_ACCESS_URL"] });
};

var importAllUsers = function () {
  var client = getClient();
  models.User.findAll().then(function (users) {
    async.eachSeries(users, function (user, callback) {
      client.createUser({uid: user.id}).
      then(function(result) {
        console.log(result);
        callback();
      }).
      catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("FIN")
    });
  });
};

var importAllPosts = function () {
  var client = getClient();
  models.Post.findAll(
    {
      where: {
        status: 'published'
      },
      include: [
        {
          model: models.Point,
          where: {
            status: 'published'
          }
        },
        {
          model: models.Group,
          required: true,
          where: {
            access: models.Group.ACCESS_PUBLIC
          },
          include: [
            {
              model: models.Community,
              required: true,
              where: {
                access: models.Community.ACCESS_PUBLIC
              },
              include: [
                {
                  model: models.Domain,
                  required: true
                }
              ]
            }
          ]
        }
      ]
    }).then(function (posts) {
    async.eachSeries(posts, function (post, callback) {
      client.createItem({
        iid: post.id,
        properties: {
          itypes: ['type1']
        },
        eventTime: new Date().toISOString()
      }).then(function(result) {
        console.log(result);
        callback();
      }).
      catch(function(error) {
        console.error(error);
        callback();
      });
    }, function () {
      console.log("FIN")
    });
  });
};
