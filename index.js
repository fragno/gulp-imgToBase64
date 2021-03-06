'use strict';
var gutil = require('gulp-util');
var through = require('through2');
var cheerio = require('cheerio');
var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var mime = require('mime');

module.exports = function(opts) {
	opts = JSON.parse(JSON.stringify(opts || {}));
	opts.maxWeightResource = opts.maxWeightResource || 32768;

	// create a stream through which each file will pass
	return through.obj(function(file, enc, callback) {
		if (file.isNull()) {
			this.push(file);
			// do nothing if no contents
			return callback();
		}

		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-axml-base64img', 'Streaming not supported'));
			return callback();
		}

		if (file.isBuffer()) {
			var $ = cheerio.load(String(file.contents), {
				xmlMode: true,
				decodeEntities: false
			});

			var findTinyRootPath = (filePath) => {
				var tmpFilePath = filePath;
				var files = fs.readdirSync(tmpFilePath);
				for (var file of files) {
					if (file === 'app.json') {
						return tmpFilePath;
					}	
				}

				tmpFilePath = path.dirname(tmpFilePath);
				if (tmpFilePath === '/') {
					throw 'tiny root not find!';
				} else {
					return findTinyRootPath(tmpFilePath);
				}
			}

			$('image').each(function(index, elem) {
				if ($(this).attr('src')) {
					var ssrc = $(this).attr('src');
					var isdata = ssrc.indexOf("data");
					if (ssrc != "" && typeof ssrc != 'undefined' && isdata !== 0) {
						var spath = '';
						if (path.isAbsolute(ssrc)) {
							const rootPath = findTinyRootPath(path.dirname(file.path));
							spath = path.join(rootPath, ssrc);
						} else {
							spath = path.join(path.dirname(file.path), ssrc);
						}
						var mtype = mime.lookup(spath);
						if (mtype != 'application/octet-stream') {
							var sfile = fs.readFileSync(spath);
							if (sfile.length > opts.maxWeightResource) {
								console.error(`ignore ${chalk.yellow(spath)}, file length is ${chalk.yellow(sfile.length)}, bigger than threshold ${chalk.yellow(opts.maxWeightResource)}.`);
							} else {
								var simg64 = new Buffer(sfile).toString('base64');
								$(this).attr('src', 'data:' + mtype + ';base64,' + simg64);
							}
						}
					}
				}
			});
			var output = $.html();

			file.contents = new Buffer(output);

			return callback(null, file);
		}
	});
};
