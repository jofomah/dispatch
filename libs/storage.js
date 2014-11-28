var q = require("q");
var request = require('request');

var BASE_URI = "http://dev.lomis.ehealth.org.ng:5984/";

this.FACILITY = "facilities";
this.PRODUCT_TYPES = "product_types";
this.CCU_PROFILE = "ccei";
this.CONTACTS = "contacts";
this.STOCK_OUT = "stock_out";
this.CCU_BREAKDOWN = "ccu_breakdown";
this.STOCK_COUNT = "stockcount";
this.OFFLINE_SMS_ALERTS = "offline_sms_alerts";

this.getRecord = function(dbName, uuid){
  var deferred = q.defer();
  var URI = BASE_URI+dbName+"/" + uuid;
  var opts = {
    "uri": URI,
    "method": "GET"
  };
  request(opts, function (err, res, body) {
    if (res) {
      deferred.resolve(JSON.parse(res.body));
    } else {
      deferred.reject(err);
    }
  });
  return deferred.promise;
};

this.createOrUpdate = function(dbName, record){
  var deferred  = q.defer();
  var URI = BASE_URI+dbName+"/";

  if (typeof record._id === 'undefined') {
    record._id = record.uuid;
  }

  var requestSettings = {
    "uri": URI + record._id,
    "method": "GET"
  };

  //try to get remote copy of doc.
  request(requestSettings, function (err, res, body) {

    //prepare request settings for PUT request.
    requestSettings.method = "POST";
    requestSettings.json = record;
    requestSettings.uri = URI;

    if (res) {
      var couchResponse = JSON.parse(res.body);
      if (!couchResponse.error) {
        if(dbName === "stockcount" && (record.ppId && record.quantity)){
          if(typeof couchResponse.unopened ==="undefined"){
            couchResponse.unopened ={};
            couchResponse.unopened[record.ppId] = record.quantity;
          }
        }else{
          //update couchResponse document with record properties
          var recordProperties = Object.keys(record);
          for (var index in recordProperties) {
            var key = recordProperties[index];
            couchResponse[key] = record[key];
          }
        }
        if(dbName=== "bundle"){
            if(record.id){
              if(!couchResponse.bundleLines || (!Array.isArray(couchResponse.bundleLines))){
                couchResponse.bundleLines = [];
              }
              if(record.id){
                var idExist = false;
                couchResponse.bundleLines.forEach(function(line){
                  if(line.id === record.id){
                    idExist =  record.id;
                  }
                });
                if(!idExist){
                  couchResponse.bundleLines.push({id : record.id});
                  idExist = record.id;
                }
                couchResponse.bundleLines.forEach(function(line){
                   if(line.id === idExist){
                     if(record.bno && (!line.batchNo)){
                       line.batchNo = record.bno;
                     }
                     //if(record.product)
                     var keys = Object.keys(record);
                     keys.forEach(function(key){
                       if(key === "vvm"){
                         if(!line.VVMStatus) line.VVMStatus = {};
                         var vvm = key.split(",");
                         vvm.forEach(function(v){
                            var vvm = v.split(":");
                           line.VVMStatus[vvm[0]] = vvm[1];
                         })

                       }else {
                         line[key] = record[key];
                       }
                     })
                   }
                });

              }else{
                var keys = Object.keys(record);
                keys.forEach(function(key){
                  if(key === "sf"){
                    couchResponse["sendingFacility"] = record[key];
                  }else if(key === "rf"){
                    couchResponse["receivingFacility"] = record[key];
                  }else{
                    couchResponse[key] = record[key];
                  }
                })
              }
            }
          }
        //set updated couchResponse as json doc to post to server.
        requestSettings.json = couchResponse;

        //POST updated copy
        request(requestSettings, function (err, res, body) {
          if(!err){
            deferred.resolve(couchResponse);
          }else{
            deferred.reject(err);
          }
        });

      } else {
        if (couchResponse.error === 'not_found' && couchResponse.reason === 'missing') {

          if(record.db === "stockcount") {
            if (!record.unopened) record.unopened = {};
            if (record.ppId && record.quantity) {
              record[ppId] = record.quantity;
              delete record.ppId;
              delete record.quantity;
            }
          }
          if(record.db === "bundle"){
            if(!record.bundleLines) record.bundleLines = [];
            if(record.bno){
              if(record.vvm){
                var VVMStatus = {};
                var vvm = key.split(",");
                vvm.forEach(function(v){
                  var vvm = v.split(":");
                  VVMStatus[vmm[0]] = vvm[1];
                })
                record.bundleLines.push({
                  id : record.id,
                  batchNo: record.bno,
                  VVMStatus: VVMStatus
                });
              }else{
                var lineKeys = Object.keys(record);
                lineKeys.forEach(function(key){
                  var obj = {};
                  obj[key] = record[key];
                  //obj.id = record.id;
                  //obj.batchNo = record.bno || '';
                  record.bundleLines.push(obj)
                })
              }

            }

          }
          //save record as a new doc.
          request(requestSettings, function (err, res, body) {
            if (!err) {
              record._id = res.body.id;
              record._rev = res.body.rev;
              deferred.resolve(record);
            } else {
              deferred.reject(err);
            }
          });
        }else{
          deferred.reject(couchResponse);
        }
      }
    }
  });
  return deferred.promise;
};

//expose storage as a module.
module.storage = this;