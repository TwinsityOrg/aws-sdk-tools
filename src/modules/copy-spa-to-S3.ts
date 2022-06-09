/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */
import { fromSSO } from '@aws-sdk/credential-provider-sso';
import { CloudFront, S3 } from 'aws-sdk';
import * as fs from 'fs';
const KSUID = require('ksuid');
import * as mime from 'mime-types';
import * as path from 'path';
import { exit } from 'process';

let filePaths = [];
const getFilePaths = (dir) => {
  fs.readdirSync(dir).forEach(function (name) {
    const filePath = path.join(dir, name);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      filePaths.push(filePath);
    } else if (stat.isDirectory()) {
      getFilePaths(filePath);
    }
  });
};

const updateExistingTags = (existingTags, newTags) => {
  const tagSet = existingTags.filter((tag) => tag.Key != 'app_version' && tag.Key != 'app_version_msg');
  tagSet.push(...newTags);
  return tagSet;
};

const uploadToS3 = async (dir, localpath, s3, bucketName) => {
  dir = path.normalize(dir);
  const osSpecificFilePath = localpath.split(`${dir}${path.sep}`)[1];
  console.log(`Uploading:\t${osSpecificFilePath}`);

  let cacheControl;
  if (osSpecificFilePath.endsWith('html')) {
    cacheControl = 'public,max-age=0,no-cache,no-store,must-revalidate';
  } else {
    cacheControl = 'public,max-age=31536000,immutable';
  }

  const fileContent = fs.readFileSync(localpath);
  const fileName = path.basename(osSpecificFilePath);
  const contentType = mime.contentType(fileName) || 'application/octet-stream';

  // in case of windows separators
  const key = osSpecificFilePath.replace(/\\/g, '/');

  console.log(`key: ${key}, contentType: ${contentType}`);
  return s3
    .putObject({
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
      CacheControl: cacheControl,
    })
    .promise();
};

const deleteVersionMarkers = async (s3, Bucket, NextKeyMarker?, list = []) => {
  if (NextKeyMarker || list.length === 0) {
    return await s3
      .listObjectVersions({ Bucket, KeyMarker: NextKeyMarker })
      .promise()
      .then(async ({ DeleteMarkers, Versions, NextKeyMarker }) => {
        if (DeleteMarkers.length) {
          await s3
            .deleteObjects({
              Bucket,
              Delete: {
                Objects: DeleteMarkers.map((item) => ({
                  Key: item.Key,
                  VersionId: item.VersionId,
                })),
              },
            })
            .promise();
          if (NextKeyMarker) {
            console.log('deleted', NextKeyMarker);
          }
          return await deleteVersionMarkers(s3, Bucket, NextKeyMarker, [
            ...list,
            ...DeleteMarkers.map((item) => item.Key),
          ]);
        }
        if (Versions.length) {
          await s3
            .deleteObjects({
              Bucket,
              Delete: {
                Objects: Versions.map((item) => ({
                  Key: item.Key,
                  VersionId: item.VersionId,
                })),
              },
            })
            .promise();
          if (NextKeyMarker) {
            console.log('deleted', NextKeyMarker);
          }
          return await deleteVersionMarkers(s3, Bucket, NextKeyMarker, [...list, ...Versions.map((item) => item.Key)]);
        }
        return list;
      });
  }
  return list;
};

const emptyBucket = async (s3, Bucket, NextContinuationToken?, list = []) => {
  if (NextContinuationToken || list.length === 0) {
    return await s3
      .listObjectsV2({ Bucket, ContinuationToken: NextContinuationToken })
      .promise()
      .then(async ({ Contents, NextContinuationToken }) => {
        if (Contents.length) {
          await s3
            .deleteObjects({
              Bucket,
              Delete: {
                Objects: Contents.map((item) => ({ Key: item.Key })),
              },
            })
            .promise();
          if (NextContinuationToken) {
            console.log('deleted', NextContinuationToken);
          }
          return await emptyBucket(s3, Bucket, NextContinuationToken, [...list, ...Contents.map((item) => item.Key)]);
        }
        return list;
      });
  }
  return list;
};

export const copyBuildFolderToS3 = async ({
  bucketName,
  buildDir,
  profile,
  removeBucketFiles,
  host,
  version = 'undefined',
  versionMsg = 'undefined',
}: {
  bucketName: string;
  buildDir: string;
  profile?: string;
  removeBucketFiles: boolean;
  host: string;
  version: string;
  versionMsg: string;
}) => {
  console.log(`bucketName: ${bucketName}`);
  console.log(`local build folder: ${buildDir}`);
  console.log(`using version for tags: ${version}`);

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

    if (removeBucketFiles) {
      console.warn(`removing all existing files in the given bucket: ${bucketName}`);
      await emptyBucket(s3, bucketName);
      await deleteVersionMarkers(s3, bucketName);
    }

    getFilePaths(buildDir);
    const uploadPromises = filePaths.map((path) => uploadToS3(buildDir, path, s3, bucketName));
    await Promise.all(uploadPromises);

    const { TagSet: existingBucketTags } = await s3
      .getBucketTagging({
        Bucket: bucketName,
      })
      .promise();

    const newTags = [
      { Key: 'app_version', Value: version },
      { Key: 'app_version_msg', Value: versionMsg },
    ];

    const tagSet = updateExistingTags(existingBucketTags, newTags);

    await s3
      .putBucketTagging({
        Bucket: bucketName,
        Tagging: {
          TagSet: tagSet,
        },
      })
      .promise();

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

        const { Tags: existingDistroTags } = await cf.listTagsForResource({ Resource: existingDistro.ARN }).promise();
        const cfTags = updateExistingTags(existingDistroTags.Items, newTags);
        console.dir(cfTags);
        await cf
          .tagResource({
            Resource: existingDistro.ARN,
            Tags: {
              Items: cfTags,
            },
          })
          .promise();
      }
    }

    if (matchingCfDistro.Invalidation) {
      console.log(`invalidation ${matchingCfDistro.Invalidation.Id} started... check AWS console for status`);
    } else {
      console.log(`no invalidation triggered, cause there were no matching cloudfront distributions`);
    }
  } catch (error) {
    console.log(error);
    throw new Error(error);
  }
};
