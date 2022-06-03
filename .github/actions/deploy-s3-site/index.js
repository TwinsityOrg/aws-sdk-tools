#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const { copyBuildFolderToS3 } = require('../../../src/modules/copy-spa-to-S3');
const core = require('@actions/core');
const _ = require('lodash');

const main = async () => {
  const stage = _.lowerCase(core.getInput('stage', { required: true }));
  const project = _.lowerCase(core.getInput('project', { required: true }));
  const app = _.lowerCase(core.getInput('app', { required: true }));
  const buildPath = core.getInput('buildPath', { required: true });
  const fullDomain = core.getInput('fullDomain', { required: true });
  const removeBucketFiles = core.getInput('removeBucketFiles');
  const version = core.getInput('version');
  const versionMsg = core.getInput('versionMsg');

  const bucketName = `${project}-${app}-${stage}`;

  const options = {
    bucketName,
    buildPath,
    removeBucketFiles,
    host: fullDomain,
    version,
    versionMsg,
  };
  console.log('using the following options: ', options);
  await copyBuildFolderToS3(options);
};

main();
