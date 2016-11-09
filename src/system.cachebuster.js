(function() {
    var systemLocate = System.locate;
    var hashTable = null;
    var loadHashTablePromise = null;
    var baseUrl = "";
    var jsonFileName = "system.cachebuster.json";
    var enableLogs = false;
    
    initBaseUrl();
    patchSystemLocate();
    
    function config(options) {
        enableLogs = (options.enableLogs===undefined ? false : !!options.enableLogs);
        jsonFileName = (options.jsonFileName === undefined ? "system.cachebuster.json" : options.jsonFileName);
    }

    function log(message) {
        if(!enableLogs) {
            return;
        }

        console.log(message);
    }

    function dumpTable() {
        log("SystemJS hash table");
        for(var key in hashTable) {
            log("    " + key + ": " + hashTable[key].hash);
        }
    }

    function initBaseUrl() {
        var baseTag = document.getElementsByTagName("base");
        if (baseTag.length) {
            baseUrl = baseTag[0].href;
        }
        else {
            baseUrl = location.origin;
            if(baseUrl[baseUrl.length-1]!="/") {
                baseUrl += "/";
            }
        }
    }

    function loadHashTable() {
        if(loadHashTablePromise) {
            return loadHashTablePromise;
        }

        return loadHashTablePromise = new Promise(function(resolve, reject) {
            var isAbs = jsonFileName.indexOf('://') != -1;
            var baseJsonFileName = isAbs ? jsonFileName : '/' + jsonFileName;
            var url = baseJsonFileName + "?v=" + new Date().valueOf();

            log("Loading hash table from: " + url);
            var oReq = new XMLHttpRequest();
            oReq.open("GET", url);
            oReq.send();
            oReq.addEventListener("load", function () {
                if(this.status == 200) {
                    hashTable = JSON.parse(this.responseText);
                }
                else {
                    hashTable = {};
                }

                resolve();
            });
        });
    }

    function patchSystemLocate() {
        System.locate = function (load) {
            var me = this;

            return loadHashTable().then(function() {
                return systemLocate.call(me, load).then(function (address) {
                    var url = address;

                    var relUrl = (startsWith(url, baseUrl) ? relUrl = url.substring(baseUrl.length) : url);
                    var entry = hashTable[relUrl];

                    if (entry) {
                        var cacheBuster = "?hash=" + entry.hash
                        url = url + cacheBuster;
                    }

                    log("System.locate: " + url);
                    return url;
                });
            });
        }
    }

    function startsWith(str1, str2) {
        if (str2.length > str1.length) {
            return false;
        }

        var res = (str1.substring(0, str2.length) == str2);
        return res;
    }

    window.SystemCacheBuster = {
        config: config
    };
})();
