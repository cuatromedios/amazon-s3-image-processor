var express = require('express');
var router = express.Router();
var knox = require('knox');
var Jimp = require('jimp');
var fs = require('fs');
var defaults = require("./../config/defaults.json");
var presets = require("./../config/presets.json");
var crypto = require('crypto');

var sendOptions = {
    root: __dirname+"/../",
    dotfiles: 'deny',
    headers: {
        'x-timestamp': Date.now(),
        'x-sent': true
    }
};

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', { title: 'Amazon S3 Image Processor' });
});

/* GET any image by preset and objet id in S3 */
router.get('/:preset/:object*', function(req, res, next) {
    var s3Object = "/" + req.params.object + req.params['0'];
    var preset = req.params.preset;
    var s3ObjectParts = String(s3Object).split(".");
    var fileFormat = s3ObjectParts[s3ObjectParts.length - 1];
    var fileFormatLowercased = String(fileFormat).toLowerCase();
    if (!(fileFormatLowercased == "jpg" || fileFormatLowercased == "png" || fileFormatLowercased == "gif")) {
        var err = new Error('Image format not supported, please use .png, .jpg or .gif');
        err.status = 406;
        next(err);
        return;
    }
    if (!presets[preset]) {
        var err = new Error('Preset ' + preset + ' not configured');
        err.status = 406;
        next(err);
        return;
    }
    var imageSettings = defaults;
    for (var attrname in presets[preset]) {
        imageSettings[attrname] = presets[preset][attrname];
    }

    var s3SourceClient = knox.createClient({
        key: settings.aws.accessKeyId,
        secret: settings.aws.secretAccessKey,
        bucket: settings.aws.sourceBucket
    });
    var fileName = crypto.createHash('md5').update(preset + s3Object).digest('hex') + "." + fileFormat;

    //Check if the file has been already processed
    try {
        fs.accessSync(settings.paths.imagesProcessed + "/" + fileName, fs.F_OK | fs.R_OK);
        res.sendFile(settings.paths.imagesProcessed+"/"+fileName, sendOptions, function (displayError) {
            if (displayError) {
                console.log(err);
                res.status(err.status).end();
            }
        });
        return;
    } catch(e) {
        console.log(e);
    }

    var file = fs.createWriteStream(settings.paths.imagesReceived+"/"+fileName);
    s3SourceClient.getFile(s3Object, function(err, stream){
        if (err) {
            console.error(err.statusCode, err.statusMessage);
        } else {
            if (stream.statusCode == 200) {
            } else {
                console.log(s3Object, stream.statusCode, stream.statusMessage);
                var err = new Error('S3 Object error:'+s3Object+" "+stream.statusMessage);
                err.status = stream.statusCode;
                next(err);
                return;
            }
            stream.on('data', function(chunk) { file.write(chunk); });
            stream.on('end', function(chunk) {
                file.end();
                Jimp.read(settings.paths.imagesReceived+"/"+fileName, function (err, image) {
                    if (err) next(err);

                    image.background(parseInt(imageSettings.background+"FF", 16));

                    //Align bits
                    var horizontalAlign;
                    switch (imageSettings.horizontalAlign) {
                        case "left":
                            horizontalAlign = Jimp.HORIZONTAL_ALIGN_LEFT;
                            break;
                        case "right":
                            horizontalAlign = Jimp.HORIZONTAL_ALIGN_RIGHT;
                            break;
                        default:
                            horizontalAlign = Jimp.HORIZONTAL_ALIGN_CENTER;

                    }
                    var verticalAlign;
                    switch (imageSettings.horizontalAlign) {
                        case "top":
                            verticalAlign = Jimp.VERTICAL_ALIGN_TOP;
                            break;
                        case "bottom":
                            verticalAlign = Jimp.VERTICAL_ALIGN_BOTTOM;
                            break;
                        default:
                            verticalAlign = Jimp.VERTICAL_ALIGN_MIDDLE;

                    }

                    switch (imageSettings.scaleMode) {
                        case "contain":
                            image.contain(imageSettings.width, imageSettings.height, horizontalAlign | verticalAlign);
                            break;
                        case "cover":
                            image.cover(imageSettings.width, imageSettings.height, horizontalAlign | verticalAlign);
                            break;
                        case "scaleToFit":
                            image.scaleToFit(imageSettings.width, imageSettings.height);
                            break;
                        default:
                            image.resize(imageSettings.width, imageSettings.height);
                    }

                    image.quality(imageSettings.quality);
                    image.write(settings.paths.imagesProcessed+"/"+fileName, function(err, result) {
                        //we can now delete the received image so we dont store garbage
                        fs.unlinkSync(settings.paths.imagesReceived+"/"+fileName);
                        if (err) {
                            var error = new Error("Can't write local file");
                            err.status = 406;
                            next(err);
                        } else {
                            res.sendFile(settings.paths.imagesProcessed+"/"+fileName, sendOptions, function (displayError) {
                                if (displayError) {
                                    console.log(err);
                                    res.status(err.status).end();
                                }
                                else {
                                    console.log('Sent:', fileName);
                                    //The image has been sent to the user, now send it to S3
                                    var s3DestinationClient = knox.createClient({
                                        key: settings.aws.accessKeyId,
                                        secret: settings.aws.secretAccessKey,
                                        bucket: settings.aws.destinationBucket
                                    });
                                    s3DestinationClient.putFile(settings.paths.imagesProcessed+"/"+fileName,
                                        '/'+preset+s3Object,
                                        { 'x-amz-acl': 'public-read' },
                                        function(fileUploadError, fileUploadResult){
                                            if (fileUploadError != null) {
                                                return console.log(fileUploadError);
                                            } else {
                                                //Everything is ready, now delete the processed local image
                                                //fs.unlinkSync(settings.paths.imagesProcessed+"/"+fileName);
                                            }
                                        });
                                }
                            });
                        }
                    }); // save
                });
            });
        }

    });
});

/* GET anything else */
router.get('/*', function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

module.exports = router;

