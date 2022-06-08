#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
import { copyBuildFolderToS3 } from '../../../src/modules/copy-spa-to-S3';
import { getInput } from '@actions/core';
import { lowerCase } from 'lodash';

const main = async () => {
  const stage = lowerCase(getInput('stage', { required: true }));
  const project = lowerCase(getInput('project', { required: true }));
  const app = lowerCase(getInput('app', { required: true }));
  const buildPath = getInput('buildPath', { required: true });
  const fullDomain = getInput('fullDomain', { required: true });
  const removeBucketFiles = getInput('removeBucketFiles');
  const version = getInput('version');
  const versionMsg = getInput('versionMsg');

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
