#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { program } = require('commander');
const { copyBuildFolderToS3 } = require('./modules/copy-spa-to-S3.js');

const main = async () => {
  program
    .name('s3-copy-website')
    .description('CLI to upload a local static website to a S3 bucket, with Caching/CDN/SSL/Domain support ');
  program
    .requiredOption('-b, --bucketName <name>', 'the bucket to push the website build into')
    .requiredOption('-d, --buildDir <dir>', 'the directory of your website build')
    .option('-h, --host <host>', 'the website domain/host')
    .option('-r, --removeBucketFiles', 'deletes all existing files in the bucket')
    .option('-p, --profile <profileName>')
    .option(
      '-t, --tagsLocation <version>',
      'the location to the tags file to be set or updated. Format of the JSON: [{Key: string, Value: string}, ...]'
    );
  program.parse();
  const options = program.opts();

  console.dir(options);
  copyBuildFolderToS3(options);
};

main();
