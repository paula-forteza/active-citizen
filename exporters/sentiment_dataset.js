var models = require('../../models');
var async = require('async');
var ip = require('ip');
var fs = require('fs');

var trainCategoriesCsv;
var testCategoriesCsv;
var classesCategoriesCsv;

var trainCategoriesCsvFilename = 'datasets/better_reykjavik/sentiment/train.csv';
var testCategoriesCsvFilename = 'datasets/better_reykjavik/sentiment/test.csv';
var classesCategoriesCsvFilename = 'datasets/better_reykjavik/sentiment/classes.csv';

var categories = { 0: [], 1: []};
var categoriesIds = [ 0, 1 ];

MAX_CATEGORY_LENGTH = 500;

var clean = require('./dataset_tools').clean;
var shuffleArray = require('./dataset_tools').shuffleArray;
var replaceBetterReykjavikCategoryId = require('./dataset_tools').replaceBetterReykjavikCategoryId;

async.series([
  function(callback) {
    var categoriesCsvRows = [];

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
            include: [
              {
                model: models.Community,
                required: true,
                include: [
                  {
                    model: models.Domain,
                    required: true,
                    where: {
                      id: 1
                    }
                  }
                ]
              }
            ]
          }
        ]
      }).then(function (posts) {
      console.log('Found '+posts.length+" posts");
      async.eachSeries(posts, function (post, seriesCallback) {
        async.eachSeries(post.Points, function (point, innerSeriesCallback) {
          if (point.value != 0) {
            content = '"'+clean(point.content)+'"';
            if (content!="" && content.length>17) {
              if (content.indexOf('Mypoint my point') == -1 &&
                content.indexOf('Point against Point') == -1) {
                console.log(point.value);
                if (point.value > 0) {
                  categories['0'].push(content);
                } else if (point.value < 0) {
                  categories['1'].push(content);
                }
              }
            }
          }
          innerSeriesCallback();
        }, function () {
          seriesCallback();
        });
      }, function () {
        async.eachSeries(categoriesIds, function (category_id, seriesCallback) {
          console.log(category_id);
          console.log("-----"+category_id+"---------------------------: "+categories[category_id].length);
          if (categories[category_id].length>MAX_CATEGORY_LENGTH) {
            categories[category_id] = categories[category_id].splice(0,MAX_CATEGORY_LENGTH);
            console.log("-----"+category_id+"---------------------------: "+categories[category_id].length);
          }
          async.eachSeries(categories[category_id], function (post, innerSeriesCallback) {
            categoriesCsvRows.push(category_id+','+post);
            console.log("Key: "+category_id+" value: "+post);
            innerSeriesCallback();
          }, function () {
            seriesCallback();
          });
        }, function () {
          trainCategoriesCsv = shuffleArray(categoriesCsvRows);
          testCategoriesCsv = trainCategoriesCsv.splice(0,categoriesCsvRows.length*0.1);
          callback();
        });
      });
    }).catch(function(error) {
      console.log("ERROR: "+error);
    }) ;
  },
  function(callback) {
    fs.writeFile(trainCategoriesCsvFilename, trainCategoriesCsv.join('\n'), function(err) {
      if(err) {
         console.log(err);
      }
      callback();
    });
  },
  function(callback) {
    fs.writeFile(testCategoriesCsvFilename, testCategoriesCsv.join('\n'), function(err) {
      if(err) {
        console.log(err);
      }
      callback();
    });
  },
  function(callback) {
    classesCategoriesCsv = ["0,Positive","1,Negative"];
    callback();
  },
  function(callback) {
    fs.writeFile(classesCategoriesCsvFilename, classesCategoriesCsv.join('\n'), function(err) {
      if(err) {
        console.log(err);
      }
      callback();
    });
  }
], function (error) {
  console.log("FINISHED :)");
});
