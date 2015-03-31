var path = require('path');
var baseDirectory = path.join(__dirname, '..', '..');

var SplitByNamePlugin = module.exports = function (options) {
    this.options = options;

    // process buckets
    this.options.buckets = this.options.buckets.slice(0).map(function (bucket) {
        if (!(bucket.regex instanceof RegExp)) {
            bucket.regex = new RegExp(bucket.regex);
        }
        return bucket;
    });
};

SplitByNamePlugin.prototype.apply = function(compiler) {
    var options = this.options;

    function findMatchingBucket(chunk) {
        //console.log(chunk&&chunk.userRequest);
        if (!chunk || !chunk.userRequest) { return null; }

        var index = chunk.userRequest.lastIndexOf('!');
        var check = index >= 0 ? chunk.userRequest.substring(index+1) : chunk.userRequest;
        check = path.relative(baseDirectory, check);
        if (check.indexOf('webpack') >=  0) { return null; }

        var match = null;
        options.buckets.some(function (bucket) {
            if (bucket.regex.test(check)) {
                match = bucket;
                return true;
            }
        });
        return match;
    }

    compiler.plugin("compilation", function(compilation) {
        var extraChunks = {};

        // Find the chunk which was already created by this bucket.
        // This is also the grossest function name I've written today.
        function bucketToChunk(bucket) {
            return extraChunks[bucket.name];
        }

        var called = false;
        function printFunctions(thing) {
            if (called) { return; }; called = true;
            for (key in thing) {
                //if (typeof thing[key] === 'function') {
                console.log(key)
                //}
            }
        }

        compilation.plugin("optimize-chunks", function(chunks) {

            var addChunk = this.addChunk.bind(this);
            chunks
                // only parse the entry chunk
                .filter(function (chunk) {
                    return chunk.entry;
                })
                .forEach(function(chunk) {
                    chunk.modules.slice().forEach(function (mod) {

                        var bucket = findMatchingBucket(mod),
                            newChunk;
                        if (!bucket) {
                            // it stays in the original bucket
                            return;
                        }
                        if (!(newChunk = bucketToChunk(bucket))) {
                            newChunk = extraChunks[bucket.name] = addChunk(bucket.name);
                        }
                        //printFunctions(mod);
                        // add the module to the new chunk
                        newChunk.addModule(mod);
                        mod.addChunk(newChunk);
                        // remove it from the existing chunk
                        mod.removeChunk(chunk);
                    });

                    options.buckets
                        .map(bucketToChunk)
                        .filter(Boolean)
                        .concat(chunk)
                        .forEach(function (chunk, index, allChunks) { // allChunks = [bucket0, bucket1, .. bucketN, orig]
                            if (index) { // not the first one, they get the first chunk as a parent
                                chunk.parents = [allChunks[0]];
                            } else { // the first chunk, it gets the others as 'sub' chunks
                                chunk.chunks = allChunks.slice(1);
                            }
                            chunk.initial = chunk.entry = !index;
                            //console.log(chunk.name, chunk.entry, chunk.initial, chunk.modules.length);

                            //if (chunk.name === 'vendor') {
                            //    chunk.modules.forEach(function(m) {
                            //        console.log(path.relative(baseDirectory, m.userRequest));
                            //    })
                            //
                            //}
                        });
                });
        });
        compilation.plugin('after-optimize-module-ids', function(modules) {
            modules.forEach(function(mod) {

                //if (mod && mod.id < 20) { console.log(mod.id, mod.debugId, mod.lastId, mod.request); }
            })
        });
    });
};
