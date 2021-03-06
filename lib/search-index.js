var async = require('async');
var rmdir = require('rimraf');
var level = require('levelup');
var levelMultiply = require('level-multiply');

var SearchIndex = module.exports = function SearchIndex(options) {
  if (!(this instanceof SearchIndex))
    return new SearchIndex(options);
  //------------libs
  this.level = require('levelup');
  this.levelMultiply = require('level-multiply');
  _ = require('lodash');
  this.defaults = {
    indexPath: 'si',
    logLevel: 'info',
    logSilent: false
  };
  //initialize defaults options
  this.options = _.defaults(options || {}, this.defaults);
  this.calibrater = require('./indexing/calibrater.js');
  this.deleter = require('./indexing/deleter.js');
  this.docGetter = require('./search/docGetter.js');
  this.indexPeek = require('./indexing/indexPeek.js');
  this.indexer = require('./indexing/indexer.js');
  this.matcher = require('./matchers/matcher.js');
  this.replicator = require('./indexing/replicator.js');
  this.searcher = require('./search/searcher.js');
  this.searchIndexLogger = require('./logger/searchIndexLogger');
  this.indexes = (this.options && this.options.db)
    ? this.level(this.options.indexPath, {valueEncoding: 'json', db: this.options.db})
    : this.level(this.options.indexPath, {valueEncoding: 'json'});
  this.indexesMultiply = this.levelMultiply(this.indexes);

  //is there a better way of doing this?
  var searcher = this.searcher;
  this.calibrater.getTotalDocs(this.indexes, function(err, totalDocs) {
    searcher.setTotalDocs(totalDocs);
  });
};


SearchIndex.prototype.getOptions = function() {
  return this.options;
}


SearchIndex.prototype.add = function(options, batch, callback) {
  var filters = options.filters || {};
  this.indexer.addDocToIndex(this.indexes,
                             this.indexesMultiply,
                             batch,
                             options.batchName,
                             filters,
                             function(err) {
                               callback(err);
                             });
};


SearchIndex.prototype.del = function(docID, callback) {
  this.deleter.deleteDoc(docID, this.indexes, this.indexesMultiply, function(err) {
    return callback(err);
  });
};

SearchIndex.prototype.empty = function(callbacky) {
  var deleteOps = [];
  indexes = this.indexes;
  indexes.createKeyStream({'gte':'0', 'lte':'~~~~~~~~~~~~~~~~~~~'})
    .on('data', function (data) {
      deleteOps.push({'type': 'del', 'key': data});
    })
    .on('error', function (err) {
      console.log('Oh my!', err)
    })
    .on('end', function () {
      indexes.batch(deleteOps, function (err) {
        callbacky(err);
      })
    })
};

SearchIndex.prototype.get = function(docID, callback) {
  this.docGetter.getDoc(this.indexes, docID, function(err, doc) {
    callback(err, doc);
  });
};

SearchIndex.prototype.match = function(beginsWith, callback) {
  this.matcher.matcher(this.indexes, beginsWith, function(err, match) {
    callback(err, match);
  });
};


SearchIndex.prototype.replicate = function(readStream, callback) {
  this.replicator.replicateFromSnapShot(readStream, this.indexes, function(err) {
    callback(err);
  });
};


SearchIndex.prototype.search = function (q, callback) {
  this.searcher.search(this.indexes, q, function(results){
    //TODO: make error throwing real
    callback(false, results);
  });
};

SearchIndex.prototype.snapShot = function(callback) {
  this.replicator.createSnapShot(this.indexes, function(msg) {
    callback(msg);
  });
};

SearchIndex.prototype.tellMeAboutMySearchIndex = function(callback) {
  this.calibrater.getTotalDocs(this.indexes, function(err, totalDocs) {
    var metadata = {};
    metadata['totalDocs'] = totalDocs;
    callback(metadata);
  });
};


//utility methods for testing and devlopment
//******************************************
SearchIndex.prototype.indexRange = function(options, callback) {
  this.indexPeek.indexRange(options.start, options.stop, this.indexes, function(err, dump) {
    callback(err, dump);
  });
};

SearchIndex.prototype.indexValue = function(options, callback) {
  this.indexPeek.indexValue(options.key, this.indexes, function(err, value) {
    callback(err, value);
  });
};

//do a full recalibration of the index
SearchIndex.prototype.calibrate = function(callback) {
  this.calibrater.calibrate(this.indexes, function(err, msg) {
    callback(err, msg);
  });
};
