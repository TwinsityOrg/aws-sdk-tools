#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
const { S3, CloudFront } = require('aws-sdk');
const { fromSSO } = require('@aws-sdk/credential-provider-sso');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const KSUID = require('ksuid');
const { exit } = require('process');
const mime = require('mime-types');

const filePaths = [];
const getFilePaths = (dir) => {
  fs.readdirSync(dir).forEach((name) => {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      filePaths.push(filePath);
    } else if (stat.isDirectory()) {
      getFilePaths(filePath);
    }
  });
};
const uploadToS3 = async (dir, path, s3, bucketName) => {
  const key = path.split(`${dir}/`)[1];

  let cacheControl;
  if (key.endsWith('html')) {
    cacheControl = 'public,max-age=0,no-cache,no-store,must-revalidate';
  } else {
    cacheControl = 'public,max-age=31536000,immutable';
  }
  const fileContent = fs.readFileSync(path);
  const contentType = mime.contentType(key);
  console.log(`key: ${key}, contentType: ${contentType}`);
  return s3
    .putObject({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType || '',
      CacheControl: cacheControl,
    })
    .promise();
};

const main = async () => {
  program
    .name('s3-copy-website')
    .description('uploads a local build folder of a static website to an S3 bucket and optionally invalidates a CloudFront distribution.');
  program
    .requiredOption('-b, --bucketName <name>', 'the bucket to push the website build into')
    .requiredOption('-d, --buildDir <dir>', 'the directory of your website build')
    .option('-h, --host <host>', 'the website domain/host')
    .option('-p, --profile <profileName>');
  program.parse();
  const options = program.opts();

  const { profile, bucketName, buildDir, host } = options;

  console.log(`bucketName: ${bucketName}`);
  console.log(`local build folder: ${buildDir}`);

  try {
    let s3;
    let cf;
    if (profile) {
      console.log(`using SSO profile: ${profile}`);
      const credentials = await fromSSO({ profile: profile })();
      s3 = new S3({
        credentials: credentials,
      });
      cf = new CloudFront({
        credentials: credentials,
      });
    } else {
      s3 = new S3();
      cf = new CloudFront();
    }

    getFilePaths(buildDir);
    const uploadPromises = filePaths.map((path) => uploadToS3(buildDir, path, s3, bucketName));
    await Promise.all(uploadPromises);

    if (!host) {
      console.log(`cloudFront invalidation skipped, because no website-host (-h) argument was provided.`);
      exit(0);
    }

    const { DistributionList } = await cf.listDistributions().promise();
    let matchingCfDistro;
    // TODO: watch out mr. pagination! shouldn't occur right now
    for (let existingDistro of DistributionList.Items) {
      console.log(`existingDistro: ${existingDistro.Id}`);
      // see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-cloudfront/modules/distributionsummary.html
      if (existingDistro.Aliases.Items.includes(host)) {
        console.log(`found domain ${host} in cloudFront distro: ${JSON.stringify(existingDistro)}`);
        const paths = ['/*'];
        matchingCfDistro = await cf
          .createInvalidation({
            DistributionId: existingDistro.Id,
            InvalidationBatch: {
              CallerReference: KSUID.randomSync().toString(),
              Paths: {
                Quantity: `${paths.length}`,
                Items: paths,
              },
            },
          })
          .promise();
      }
    }

    if (matchingCfDistro.Invalidation) {
      console.log(`invalidation ${matchingCfDistro.Invalidation.Id} started... check AWS console for status`);
    } else {
      console.log(`no invalidation triggered, cause there were no matching cloudfront distributions to the domain "${host}"`);
    }
  } catch (error) {
    console.log(error);
  }
};

main();
