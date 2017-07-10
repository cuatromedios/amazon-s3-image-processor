# Lazy Amazon S3 Image processor

#### by [Cuatromedios](http://www.cuatromedios.com/)
 
 If you don't want to proccess an image once uploaded because you don't know what sizes you will need in the future then this script is for you.
 
 Takes an image from an Amazon S3 bucket, process it, and then stores the result in another bucket. If you configure the S3 Bucket to redirect not found images to this script, the images will be generated on demand without exposing the original file. The next time another user ask for the same image in S3 url, the image will be served from S3 not consuming more bandwidth or process time of the application.
 
### This is how the magic happens:
 
 1. Manually or with your content management system, you upload your original images to your Amazon S3 **source bucket**. For example: ```source-bucket/image.jpg```
 2. In your templates / html files you call the images as if they exist in your **destination bucket** (destination-bucket) using the special **endpoint** provided by amazon in Static Website hosting but you append the preset as a directory, for example: ```https://destination-bucket.s3-website-us-west-1.amazonaws.com/thumb/image.jpg```
 3. Because the image does not exist, Amazon will redirect the call to your application (configuration required), for example: ```https://your-application.com/thumb/image.jpg```
 4. The object name, ```image.jpg``` will be searched in your source-bucket and then download it
 5. The application will take the frist directory ```thumb``` as a preset and will look for it in your configuration, the will process the image (for example resize it) and then:
     1. Send to the client the result image
     2. Send to destination bucket the result image
 6. The next time a user request the image from Amazon, it will **NOT** be redirected to your application because the image will be there already!
 
 ## Configuration
 
 ### Prepare Amazon S3
 
 1. You will need two Amazon S3 buckets, source and destination, create them in Amazon Web Services
 2. Go to IAM Service and create a new user or choose any user you have defined there. You will need the Access Key ID and Secret Access Key
 3. Be sure the user has at least read permissions in the source bucket and write permissions in destination bucket:
    1. Select the user and click on Permissions Tab
    2. Open "Inline Policies" section
    3. Click on "click here" link in "There are no inline policies to show. To create one, click here." messge
    4. Select Policy Generator
    5. Be sure to:
        1. Choose: Effect allow
        2. Select: "Amazon S3"
        3. Actions: At least select "s3:getObject", "s3:ListBucket" if you are configuring the source bucket policy, and  "s3:GetObject", "s3:ListBucket", "s3:PutObject", "s3:PutObjectAcl" for detination bucket policy
        4. Type the Amazon Resource Name (ARN) of your bucket, wnding with a wildcard. Use this syntax: arn:aws:s3:::bucket_name/*
        5. Click on Add Statment
        6. Repeat from step 1 to add an statment for the destination bucket.
  4. Configure your amazon destination bucket to redirect not found images to your app:
     1. In Amazon S3, select your bucket and select Proporties button.
     2. Open "Static Web Hosting"
     3. Enable Website hosting if not done already. **Take note of the special endpoint used for static Websites provided.** these Urls are like ```bucket-name.s3-website-us-west-1.amazonaws.com```
     4. Open "Edit Redirection Rules"
     5. Write the rules like this:
     
```XML
        <RoutingRules>
            <RoutingRule>
                <Condition>
                    <HttpErrorCodeReturnedEquals>404</HttpErrorCodeReturnedEquals>
                </Condition>
                <Redirect>
                    <HostName>your-application.com</HostName>
                    <HttpRedirectCode>302</HttpRedirectCode>
                 </Redirect>
            </RoutingRule>
        </RoutingRules>
```
        
 **Important**
 1. Files in S3 bucket **must** have extension like .jpg or .png, currently, this app does not support changing image format, if the source is a JPG the destination will be a JPG
 2. Use urls provided for Static Websites. **It will not work with any other url** these Urls are like ```bucket-name.s3-website-us-west-1.amazonaws.com``` for example:
     1. ```https://bucket-name.s3-website-us-west-1.amazonaws.com/thumb/image.jpg``` **will work**
     2. ```https://s3-us-west-1.amazonaws.com/bucket-name/thumb/image.jpg``` **WON'T work** 
     2. ```https://bucket-name.s3-us-west-1.amazonaws.com/thumb/image.jpg``` **WON'T work** 
 
### Configure

 1. Edit settings.json file to add your Amazon S3 bucket key and. You can take the settings.sample.json file as a sample
 2. Edit presets.json file to customize the presets for images you need. Yo can take presets.sample.json file as a sample, parameters are taken from [Jimp](https://www.npmjs.com/package/jimp), but not all are supported (yet). You will need one property per preset, each one with its own properties:
     1. **width**: The width of the image in pixels
     2. **height**: The height of the image in pixels
     3. **scaleMode**: how to scale the image:
         1. contain
         2. cover
         3. resize
         4. scaleToFit
     4. **horizontalAlign**: Used in cover and contain
         1. left
         2. center
         3. right
     5. **verticalAlign**: Used in cover and contain
         1. top
         2. middle
         3. bottom
     6. **background**: Color for background, for example for contain in hex format, for example 0xff0000 or 0xffffff
     6. **quality**: Quality for JPEG images from 0 to 100
    

  
Sample presets.json file:
```JSON
 {
   "thumb": {
     "width": 320,
     "height": 320,
     "scaleMode": "contain",
     "horizontalAlign": "center",
     "verticalAlign": "middle",
     "quality": 60
   },
   "icon": {
     "width": 64,
     "height": 64
   }
 }
 ```
 
## Running your app

Remember to `npm install` (first time, only once, to install the required packages).

This application is based on [Express](http://expressjs.com/) so you may find more information there.

If for some reason you change a preset, you can just delete all images processed for that preset in your destination bucket so they can be processed again.

**Important**
 1. **DON'T** use your application URLs directly for calling the images, because for every image, you will be procesing it and upload it to S3, the idea is to use your Amazon S3 urls.

**To Do**
1. Because the expected result is an image, would be interesting to respond alwasy with an image, even if an error ocurred.
2. Remove unused Express packages and packages added by WebStorm by default
3. Processed images are not deleted because they may be requested again and again because the browser will cache the redirect if the redirect continues (need to see that in amazon) so it take the ones already processed


#### Thanks to these awesome packages used in this application:

##### Jimp

An image processing library written entirely in JavaScript 
[https://www.npmjs.com/package/jimp](https://www.npmjs.com/package/jimp)

##### Knox

Amazon S3 client
[https://www.npmjs.com/package/knox](https://www.npmjs.com/package/knox)

##### Express

Fast, unopinionated, minimalist web framework for Node.js
[http://expressjs.com/](http://expressjs.com/)
